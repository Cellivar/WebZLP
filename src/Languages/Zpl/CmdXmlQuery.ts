/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export type CmdXmlQueryType
  = 'All'
  | 'Format'
  | 'ObjectListing'
  // TODO: Object data requires a more complex format for querying,
  // | 'ObjectData'
  | 'Status'

// The ^HZ command is used for returning printer description information in XML format. The printer returns
// information on format parameters, object directories, individual object data, and print status information.
const queryToCmdArg: Record<CmdXmlQueryType, string> = {
  All          : "a",
  Format       : "f",
  ObjectListing: "l",
  // ObjectData   : "o",
  Status       : "r"
}

export class CmdXmlQuery implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdXmlQuery");
  typeExtended                 = CmdXmlQuery.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name                         = 'XML Super Host Status'
  type                         = "CustomCommand" as const;
  effectFlags                  = Cmds.AwaitsEffect;
  toDisplay() { return `${this.name} for ${this.query}`}

  constructor(public readonly query: CmdXmlQueryType = 'All') {}
}

export const cmdXmlQueryTypeMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdXmlQuery.typeE,
  transpile: handleCmdXmlQuery,
  readMessage: parseCmdXmlQuery,
}

export function handleCmdXmlQuery(
  cmd: Cmds.IPrinterCommand,
  _docState: Cmds.TranspiledDocumentState,
  _commandSet: Cmds.CommandSet<string>
): string {
  const command = cmd as CmdXmlQuery;
  return `^HZ${queryToCmdArg[command.query]}`;
}

export function parseCmdXmlQuery(
  msg: string,
  cmd: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  if (cmd.type !== "CustomCommand" || (cmd as CmdXmlQuery).typeExtended !== CmdXmlQuery.typeE) {
    throw new Cmds.MessageParsingError(
      `Incorrect command '${cmd.name}' passed to parseCmdXmlQuery, expected 'CmdXmlQuery' instead.`,
      msg
    );
  }

  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: "",
  }

  // Response is an XML block. In case we got two responses for some reason look
  // for the first instance of the closing block, rest is the remainder.
  const msgUpper = msg.toUpperCase();
  const startText = '<ZEBRA-ELTRON-PERSONALITY>';
  const startIdx = msgUpper.indexOf(startText);
  const endText = '</ZEBRA-ELTRON-PERSONALITY>';
  const endIdx = msgUpper.indexOf(endText);
  if (startIdx === -1) {
    // No start block means this isn't the response we're looking for.
    result.remainder = msg;
    result.messageMatchedExpectedCommand = false;
    return result;
  }
  if (endIdx === -1) {
    // Start block but no end block, partial response, wait for more.
    result.remainder = msg;
    result.messageMatchedExpectedCommand = false;
    result.messageIncomplete = true;
    return result;
  }
  if (startIdx > endIdx) {
    // Found both, but more like the end of one message and the start of another
    // Since this is the end of a previous message we'll never see the start of
    // it, truncate to the end block and return the new message as incomplete.

    result.remainder = msg.substring(endIdx + endText.length);
    result.messageMatchedExpectedCommand = false;
    result.messageIncomplete = true;
    return result;
  }

  // Add the \r\n to the cut text if it's there.
  let pivotIdx = endIdx + endText.length;
  if (msg[pivotIdx] === '\r') {
    pivotIdx++;
  }
  if (msg[pivotIdx] === '\n') {
    pivotIdx++;
  }

  result.remainder = msg.substring(pivotIdx);

  // For reasons I do not understand printers will tend to send _one_ invalid
  // XML line and it looks like
  // ` ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>`
  // This is supposed to look like
  // `<RFID-TYPE ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>`
  // I don't know where it's getting lost.
  // To fix, we do a basic find + replace to replace an instance of the exact
  // text with a fixed version instead.
  // TODO: Deeper investigation with more printers?
  const rawXml = msg
    .substring(msg.indexOf('<?xml '), pivotIdx + 1)
    .replace(
      /^ ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>/gim,
      "<RFID-TYPE ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>"
    );

  // The rest is straightforward: parse it as an XML document and pull out
  // the data. The format is standardized and semi-self-documenting.
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawXml, 'application/xml');
  const errorNode = xmlDoc.querySelector('parsererror');
  if (errorNode) {
    throw new Cmds.MessageParsingError(
      `Error parsing message as XML: '${errorNode.tagName}'`,
      rawXml
    );
  }

  result.messages = [docToUpdate(xmlDoc)];
  return result;
}

function docToUpdate(
  doc: Document
): Cmds.ISettingUpdateMessage {

  const update: Cmds.ISettingUpdateMessage = {
    messageType: 'SettingUpdateMessage'
  };

  // Start by pulling basic info
  update.printerHardware = {
    model: getXmlText(doc, 'MODEL') ?? 'UNKNOWN_ZPL',
    firmware: getXmlText(doc, 'FIRMWARE-VERSION'),
    speedTable: getSpeedTable(doc),
    // ZPL rounds, multiplying by 25 gets us to 'inches' in their book.
    // 8 DPM == 200 DPI, for example.
    dpi: parseInt(getXmlText(doc, 'DOTS-PER-MM') ?? '8') * 25
  };
  update.printerMedia = {
    mediaGapDetectMode: getMediaType(doc),
    mediaPrintMode: getPrintMode(doc),
    printOrientation: getPrintOrientation(doc),
    speed: getSpeed(doc),
    thermalPrintMode: getThermalPrintMode(doc)
  };
  update.printerSettings = {};

  const dark = getDarkness(doc);
  update.printerHardware.maxMediaDarkness = dark.maxDarkness;
  update.printerMedia.darknessPercent = dark.currentDarkness;

  update.printerSettings.backfeedAfterTaken = getBackfeedMode(doc);

  addLabelSize(update, doc);

  // TODO: more hardware options:
  // - Figure out how to encode C{num} for cut-after-label-count

  // TODO other options:
  // Autosense settings?
  // Character set?
  // Error handling?
  // Continuous media?
  // Black mark printing?
  // Media feed on power up settings?
  // Pre-peel rewind?

  return update;
}

function getXmlText(doc: Document, tag: string) {
  return doc.getElementsByTagName(tag).item(0)?.textContent ?? undefined;
}

function getXmlCurrent(doc: Document, tag: string) {
  return doc.getElementsByTagName(tag).item(0)
    ?.getElementsByTagName('CURRENT').item(0)
    ?.textContent ?? undefined;
}

function getPrintMode(doc: Document) {
  const str = getXmlCurrent(doc, 'PRINT-MODE') ?? '';
  const prepeel = getXmlCurrent(doc, 'PRE-PEEL') === 'Y';
  switch (str) {
    case 'REWIND':
      return Conf.MediaPrintMode.rewind;
    case 'PEEL OFF':
      return prepeel ? Conf.MediaPrintMode.peelWithPrePeel : Conf.MediaPrintMode.peel;
    case 'CUTTER':
      return Conf.MediaPrintMode.cutter;
    default:
    case 'TEAR OFF':
      return Conf.MediaPrintMode.tearOff;
  }
}

function getMediaType(doc: Document) {
  const str = getXmlCurrent(doc, 'MEDIA-TRACKING') ?? '';
  switch (str) {
    case 'CONTINUOUS':
      return Conf.MediaMediaGapDetectionMode.continuous;
    case 'NONCONT-MARK':
      return Conf.MediaMediaGapDetectionMode.markSensing;
    default:
    case 'NONCONT-WEB':
      return Conf.MediaMediaGapDetectionMode.webSensing;
  }
}

function getThermalPrintMode(doc: Document) {
  return getXmlCurrent(doc, 'MEDIA-TYPE') === 'DIRECT-THERMAL'
    ? Conf.ThermalPrintMode.direct
    : Conf.ThermalPrintMode.transfer;
}

function getDarkness(doc: Document) {
  // Pull the max darkness by grabbing the 'MAX' attribute from the element.
  // It's pretty much always 30.
  const maxDarkness = parseInt(doc.getElementsByTagName('MEDIA-DARKNESS')
    .item(0)?.getAttribute('MAX')?.valueOf() ?? "30");

  const rawDarkness = parseInt(getXmlCurrent(doc, 'MEDIA-DARKNESS') ?? '15');
  const parseDarkness = Math.ceil(rawDarkness * (100 / maxDarkness));
  const currentDarkness = Math.max(0, Math.min(parseDarkness, 99)) as Conf.DarknessPercent;
  return { maxDarkness, currentDarkness }
}

function getSpeedTable(doc: Document) {
  // Speed table is specially constructed with a few rules.
  // Each table should have at least an auto, min, and max value. We assume we can use the whole
  // number speeds between the min and max values. If the min and max values are the same though
  // that indicates a mobile printer.
  const printSpeedElement = doc.getElementsByTagName('PRINT-RATE').item(0);
  const slewSpeedElement = doc.getElementsByTagName('SLEW-RATE').item(0);
  const speedDefault = '0';
  // Highest minimum wins
  const printMin = parseInt(printSpeedElement?.getAttribute('MIN')?.valueOf() ?? speedDefault);
  const slewMin = parseInt(slewSpeedElement?.getAttribute('MIN')?.valueOf() ?? speedDefault);
  const speedMin = printMin >= slewMin ? printMin : slewMin;
  // Lowest max wins
  const printMax = parseInt(printSpeedElement?.getAttribute('MAX')?.valueOf() ?? speedDefault);
  const slewMax = parseInt(slewSpeedElement?.getAttribute('MAX')?.valueOf() ?? speedDefault);
  const speedMax = printMax <= slewMax ? printMax : slewMax;

  return new Conf.SpeedTable(
    new Map<Conf.PrintSpeed, number>([
      [Conf.PrintSpeed.ipsAuto, 0],
      [Conf.PrintSpeed.ipsPrinterMin, speedMin],
      [Conf.PrintSpeed.ipsPrinterMax, speedMax],
      ...Util.range(speedMin, speedMax).map(s =>
        [Conf.SpeedTable.getSpeedFromWholeNumber(s), s] as [Conf.PrintSpeed, number])
    ])
  );
}

const backfeedTable: Map<string, Conf.BackfeedAfterTaken> = new Map([
  ['BEFORE', '0'],
  ['10%', '10'],
  ['20%', '20'],
  ['30%', '30'],
  ['40%', '40'],
  ['50%', '50'],
  ['60%', '60'],
  ['70%', '70'],
  ['80%', '80'],
  ['DEFAULT', '90'],
  ['AFTER', '100'],
  ['OFF', 'disabled'],
]);

function getBackfeedMode(doc: Document): Conf.BackfeedAfterTaken {
  return backfeedTable.get(getXmlCurrent(doc, 'BACKFEED-PERCENT') ?? 'DEFAULT') ?? '90';
}

function getSpeed(doc: Document) {
  const printRate = parseInt(getXmlText(doc, 'PRINT-RATE') ?? '1');
  const slewRate = parseInt(getXmlText(doc, 'SLEW-RATE') ?? '1');
  return new Conf.PrintSpeedSettings(
    Conf.SpeedTable.getSpeedFromWholeNumber(printRate),
    Conf.SpeedTable.getSpeedFromWholeNumber(slewRate)
  );
}

function getPrintOrientation(doc: Document) {
  return getXmlText(doc, 'LABEL-REVERSE') === 'Y'
    ? Conf.PrintOrientation.inverted
    : Conf.PrintOrientation.normal;
}

function addLabelSize(update: Cmds.ISettingUpdateMessage, doc: Document) {
  update.printerMedia ??= {};
  update.printerHardware ??= {};

  // ZPL printers may add or subtract a factory-set offset to label dimensions.
  // You tell it 200 dots wide it will store 204. No idea why. Round to a reasonable
  // step value to deal with this.
  // Label size should be rounded to the step value by round-tripping the value to an inch
  // then rounding, then back to dots.
  // TODO: Make this configurable!
  const rounding = 0.25;// mediaOptions.labelDimensionRoundingStep;
  const dpi = update.printerHardware.dpi ?? 200;

  // Always in dots
  update.printerMedia.mediaWidthDots =
    parseInt(getXmlCurrent(doc, 'PRINT-WIDTH') ?? '200');
  if (rounding) {
    update.printerMedia.mediaWidthDots = Math.floor(Util.roundToNearestStep(
      update.printerMedia.mediaWidthDots,
      rounding * dpi
    ))
  }
  const maxWidth = parseInt(doc.getElementsByTagName('PRINT-WIDTH')
    .item(0)?.getAttribute('MAX')?.valueOf() ?? "2000");
  update.printerHardware.maxMediaWidthDots = maxWidth;

  update.printerMedia.mediaLengthDots =
    parseInt(getXmlText(doc, 'LABEL-LENGTH') ?? '200');
  if (rounding) {
    update.printerMedia.mediaLengthDots = Math.floor(Util.roundToNearestStep(
      update.printerMedia.mediaLengthDots,
      rounding * dpi
    ))
  }
  const maxLength = parseInt(doc.getElementsByTagName('LABEL-LENGTH')
    .item(0)?.getAttribute('MAX')?.valueOf() ?? "9999");
  update.printerHardware.maxMediaLengthDots = maxLength;

  // Some firmware versions let you store this, some only retain while power is on.
  const labelHorizontalOffset = parseInt(getXmlText(doc, 'LABEL-SHIFT') ?? '0') || 0;
  const labelLengthOffset = parseInt(getXmlCurrent(doc, 'LABEL-TOP') ?? '0') || 0;
  update.printerMedia.mediaPrintOriginOffsetDots = {
    left: labelHorizontalOffset,
    top: labelLengthOffset
  };
}

