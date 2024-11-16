import * as Options from '../../Printers/Configuration/PrinterOptions.js';
import * as Commands from '../../Documents/index.js';
import { AutodetectedPrinter, PrinterModel } from '../../Printers/Models/PrinterModel.js';
import { PrinterModelDb } from '../../Printers/Models/PrinterModelDb.js';
import { range } from '../../NumericRange.js';

export function parseConfigurationResponse(
  rawText: string,
  mediaOptions: Options.IPrinterLabelMediaOptions,
): Options.PrinterOptions {
  if (rawText.length <= 0) {
    return Options.PrinterOptions.invalid;
  }

  // The two commands run were ^HH to get the raw two-column config label, and ^HZA to get the
  // full XML configuration block. Unfortunately ZPL doesn't seem to put the serial number in
  // the XML so we must pull it from the first line of the raw two-column config.

  // Fascinatingly, it doesn't matter what order the two commands appear in. The XML will be
  // presented first and the raw label afterwards.
  const pivotText = '</ZEBRA-ELTRON-PERSONALITY>\r\n';
  const pivot = rawText.lastIndexOf(pivotText) + pivotText.length;
  if (pivot == pivotText.length - 1) {
    return Options.PrinterOptions.invalid;
  }

  const rawConfig = rawText.substring(pivot);
  // First line of the raw config should be the serial, which should be alphanumeric.
  const serial = rawConfig.match(/[A-Z0-9]+/i)?.at(0) ?? 'no_serial_nm';

  // ZPL configuration is just XML, parse it into an object and then into config.

  // For reasons I do not understand printers will tend to send _one_ invalid XML line
  // and it looks like
  // ` ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>`
  // This is supposed to look like
  // `<RFID-TYPE ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>`
  // I don't have the appropriate equipment to determine where the XML tag prefix is being
  // lost. Do a basic find + replace to replace an instance of the exact text with a fixed
  // version instead.
  // TODO: Deeper investigation with more printers?
  const xmlStart = rawText.indexOf("<?xml version='1.0'?>");
  const rawXml = rawText
    .substring(xmlStart, pivot)
    .replace(
      "\n ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>",
      "<RFID-TYPE ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>"
    );

  // The rest is straightforward: parse it as an XML document and pull out
  // the data. The format is standardized and semi-self-documenting.
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawXml, 'application/xml');
  const errorNode = xmlDoc.querySelector('parsererror');
  if (errorNode) {
    // TODO: Log? Throw?
    return Options.PrinterOptions.invalid;
  }

  return docToOptions(xmlDoc, serial, mediaOptions);
}

function docToOptions(
  doc: Document,
  serial: string,
  mediaOptions: Options.IPrinterLabelMediaOptions
): Options.PrinterOptions {
  // ZPL includes enough information in the document to autodetect the printer's capabilities.
  const rawModel = getXmlText(doc, 'MODEL') ?? 'UNKNOWN_ZPL';
  const model = PrinterModelDb.getModel(rawModel);

  // ZPL rounds, multiplying by 25 gets us to 'inches' in their book.
  // 8 DPM == 200 DPI, for example.
  const dpi = parseInt(getXmlText(doc, 'DOTS-PER-MM') ?? '8') * 25;
  // Max darkness is an attribute on the element
  const maxDarkness = parseInt(
    doc.getElementsByTagName('MEDIA-DARKNESS').item(0)?.getAttribute('MAX')?.valueOf() ?? '30'
  );

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

  const modelInfo = new AutodetectedPrinter(
    Options.PrinterCommandLanguage.zpl,
    dpi,
    model === PrinterModel.unknown ? rawModel : model,
    getSpeedTable(speedMin, speedMax),
    maxDarkness
  );

  const options = new Options.PrinterOptions(
    serial,
    modelInfo,
    'Zebra', // TODO: Pull dynamically
    getXmlText(doc, 'FIRMWARE-VERSION') ?? ''
  );

  const currentDarkness = parseInt(getXmlCurrent(doc, 'MEDIA-DARKNESS') ?? '15');
  const rawDarkness = Math.ceil(currentDarkness * (100 / maxDarkness));
  options.darknessPercent = Math.max(0, Math.min(rawDarkness, 99)) as Options.DarknessPercent;

  const printRate = parseInt(getXmlText(doc, 'PRINT-RATE') ?? '1');
  const slewRate = parseInt(getXmlText(doc, 'SLEW-RATE') ?? '1');
  options.speed = new Options.PrintSpeedSettings(
    Options.PrintSpeedSettings.getSpeedFromWholeNumber(printRate),
    Options.PrintSpeedSettings.getSpeedFromWholeNumber(slewRate)
  );

  // Always in dots
  const labelWidth = parseInt(getXmlCurrent(doc, 'PRINT-WIDTH') ?? '200');
  const labelLength = parseInt(getXmlText(doc, 'LABEL-LENGTH') ?? '200');
  const labelRoundingStep = mediaOptions.labelDimensionRoundingStep ?? 0;
  if (labelRoundingStep > 0) {
    // Label size should be rounded to the step value by round-tripping the value to an inch
    // then rounding, then back to dots.
    const roundedWidth = roundToNearestStep(
      labelWidth / options.model.dpi,
      labelRoundingStep
    );
    options.labelWidthDots = roundedWidth * options.model.dpi;
    const roundedHeight = roundToNearestStep(
      labelLength / options.model.dpi,
      labelRoundingStep
    );
    options.labelHeightDots = roundedHeight * options.model.dpi;
  } else {
    // No rounding
    options.labelWidthDots = labelWidth;
    options.labelHeightDots = labelLength;
  }

  // Some firmware versions let you store this, some only retain while power is on.
  const labelHorizontalOffset = parseInt(getXmlText(doc, 'LABEL-SHIFT') ?? '0') || 0;
  const labelHeightOffset = parseInt(getXmlCurrent(doc, 'LABEL-TOP') ?? '0') || 0;
  options.labelPrintOriginOffsetDots = {
    left: labelHorizontalOffset,
    top: labelHeightOffset
  };

  options.printOrientation =
    getXmlText(doc, 'LABEL-REVERSE') === 'Y'
      ? Options.PrintOrientation.inverted
      : Options.PrintOrientation.normal;

  options.thermalPrintMode =
    getXmlCurrent(doc, 'MEDIA-TYPE') === 'DIRECT-THERMAL'
      ? Options.ThermalPrintMode.direct
      : Options.ThermalPrintMode.transfer;

  options.mediaPrintMode = parsePrintMode(getXmlCurrent(doc, 'PRINT-MODE') ?? '');

  options.labelGapDetectMode = parseMediaType(getXmlCurrent(doc, 'MEDIA-TRACKING') ?? '');

  options.mediaPrintMode =
    getXmlCurrent(doc, 'PRE-PEEL') === 'Y'
      ? Options.MediaPrintMode.peelWithPrePeel
      : options.mediaPrintMode;

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

  return options;
}

function getXmlText(doc: Document, tag: string) {
  return doc.getElementsByTagName(tag).item(0)?.textContent ?? undefined;
}

function getXmlCurrent(doc: Document, tag: string) {
  return doc.getElementsByTagName(tag).item(0)
    ?.getElementsByTagName('CURRENT').item(0)
    ?.textContent ?? undefined;
}

function parsePrintMode(str: string) {
  switch (str) {
    case 'REWIND':
      return Options.MediaPrintMode.rewind;
    case 'PEEL OFF':
      return Options.MediaPrintMode.peel;
    case 'CUTTER':
      return Options.MediaPrintMode.cutter;
    default:
    case 'TEAR OFF':
      return Options.MediaPrintMode.tearOff;
  }
}

function parseMediaType(str: string) {
  switch (str) {
    case 'CONTINUOUS':
      return Options.LabelMediaGapDetectionMode.continuous;
    case 'NONCONT-MARK':
      return Options.LabelMediaGapDetectionMode.markSensing;
    default:
    case 'NONCONT-WEB':
      return Options.LabelMediaGapDetectionMode.webSensing;
  }
}

function getSpeedTable(min: number, max: number) {
  return new Map<Options.PrintSpeed, number>([
    [Options.PrintSpeed.ipsAuto, 0],
    [Options.PrintSpeed.ipsPrinterMin, min],
    [Options.PrintSpeed.ipsPrinterMax, max],
    ...range(min, max).map(s =>
      [Options.PrintSpeedSettings.getSpeedFromWholeNumber(s), s] as [Options.PrintSpeed, number])
  ]);
}
