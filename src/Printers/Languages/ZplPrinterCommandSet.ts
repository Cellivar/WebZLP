import * as Options from '../Configuration/PrinterOptions.js';
import {
  PrinterCommandSet,
  TranspiledDocumentState,
  type IPrinterExtendedCommandMapping,
  exhaustiveMatchGuard
} from './PrinterCommandSet.js';
import * as Commands from '../../Documents/Commands.js';
import { AutodetectedPrinter, PrinterModel } from '../Models/PrinterModel.js';
import { PrinterModelDb } from '../Models/PrinterModelDb.js';
import { clampToRange } from '../../NumericRange.js';

export class ZplPrinterCommandSet extends PrinterCommandSet {
  private encoder = new TextEncoder();

  get commandLanguage(): Options.PrinterCommandLanguage {
    return Options.PrinterCommandLanguage.zpl;
  }

  get formStartCommand(): Uint8Array {
    // All ZPL documents start with the start-of-document command.
    return this.encodeCommand('\n^XA\n');
  }

  get formEndCommand(): Uint8Array {
    // All ZPL documents end with the end-of-document command.
    return this.encodeCommand('\n^XZ\n');
  }

  encodeCommand(str = '', withNewline = true): Uint8Array {
    // TODO: ZPL supports omitting the newline, figure out a clever way to
    // handle situations where newlines are optional to reduce line noise.
    return this.encoder.encode(str + (withNewline ? '\n' : ''));
  }

  protected nonFormCommands: (symbol | Commands.CommandType)[] = [
    'AutosenseLabelDimensionsCommand',
    'PrintConfigurationCommand',
    'RawDocumentCommand',
    'RebootPrinterCommand',
    'SetDarknessCommand'
  ];

  constructor(
    extendedCommands: Array<IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    super(Options.PrinterCommandLanguage.zpl, extendedCommands);
  }

  public transpileCommand(
    cmd: Commands.IPrinterCommand,
    docState: TranspiledDocumentState
  ): Uint8Array {
    switch (cmd.type) {
      default:
        exhaustiveMatchGuard(cmd.type);
        break;
      case 'CustomCommand':
        return this.extendedCommandHandler(cmd, docState);
      case 'NewLabelCommand':
        // Should have been compiled out at a higher step.
        return this.unprocessedCommand(cmd);

      case 'RebootPrinterCommand':
        return this.encodeCommand('~JR');
      case 'QueryConfigurationCommand':
        return this.encodeCommand('^HZA\r\n^HH');
      case 'PrintConfigurationCommand':
        return this.encodeCommand('~WC');
      case 'SaveCurrentConfigurationCommand':
        return this.encodeCommand('^JUS');

      case 'SetPrintDirectionCommand':
        return this.setPrintDirectionCommand((cmd as Commands.SetPrintDirectionCommand).upsideDown);
      case 'SetDarknessCommand':
        return this.setDarknessCommand((cmd as Commands.SetDarknessCommand).darknessSetting);
      case 'AutosenseLabelDimensionsCommand':
        return this.encodeCommand('~JC');
      case 'SetPrintSpeedCommand':
        return this.setPrintSpeedCommand(cmd as Commands.SetPrintSpeedCommand);
      case 'SetLabelDimensionsCommand':
        return this.setLabelDimensionsCommand(cmd as Commands.SetLabelDimensionsCommand);
      case 'SetLabelHomeCommand':
        return this.setLabelHomeCommand(cmd as Commands.SetLabelHomeCommand);
      case 'SetLabelPrintOriginOffsetCommand':
        return this.setLabelPrintOriginOffsetCommand(cmd as Commands.SetLabelPrintOriginOffsetCommand);
      case 'SetLabelToContinuousMediaCommand':
        return this.setLabelToContinuousMediaCommand(cmd as Commands.SetLabelToContinuousMediaCommand);
      case 'SetLabelToMarkMediaCommand':
        return this.setLabelToMarkMediaCommand(cmd as Commands.SetLabelToMarkMediaCommand);
      case 'SetLabelToWebGapMediaCommand':
        return this.setLabelToWebGapMediaCommand(cmd as Commands.SetLabelToWebGapMediaCommand);

      case 'ClearImageBufferCommand':
        // Clear image buffer isn't a relevant command on ZPL printers.
        // Closest equivalent is the ~JP (pause and cancel) or ~JA (cancel all) but both
        // affect in-progress printing operations which is unlikely to be desired operation.
        // Translate as a no-op.
        return this.noop;
      case 'SuppressFeedBackupCommand':
        // ZPL needs this for every form printed.
        return this.encodeCommand('^XB');
      case 'EnableFeedBackupCommand':
        // ZPL doesn't have an enable, it just expects XB for every label
        // that should not back up.
        return this.noop;

      case 'OffsetCommand':
        return this.modifyOffset(cmd as Commands.OffsetCommand, docState, this);
      case 'RawDocumentCommand':
        return this.encodeCommand((cmd as Commands.RawDocumentCommand).rawDocument, false);
      case 'AddBoxCommand':
        return this.addBoxCommand(cmd as Commands.AddBoxCommand, docState);
      case 'AddImageCommand':
        return this.addImageCommand(cmd as Commands.AddImageCommand, docState);
      case 'AddLineCommand':
        return this.addLineCommand(cmd as Commands.AddLineCommand, docState);
      case 'CutNowCommand':
        // ZPL doesn't have an OOTB cut command except for one printer.
        // Cutter behavior should be managed by the ^MM command instead.
        return this.noop;

      case 'PrintCommand':
        return this.printCommand(cmd as Commands.PrintCommand);
    }
  }

  parseConfigurationResponse(
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

    return this.docToOptions(xmlDoc, serial, mediaOptions);
  }

  private docToOptions(
    doc: Document,
    serial: string,
    mediaOptions: Options.IPrinterLabelMediaOptions
  ): Options.PrinterOptions {
    // ZPL includes enough information in the document to autodetect the printer's capabilities.
    const rawModel = this.getXmlText(doc, 'MODEL') ?? 'UNKNOWN_ZPL';
    const model = PrinterModelDb.getModel(rawModel);

    // ZPL rounds, multiplying by 25 gets us to 'inches' in their book.
    // 8 DPM == 200 DPI, for example.
    const dpi = parseInt(this.getXmlText(doc, 'DOTS-PER-MM') ?? '8') * 25;
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
      this.getSpeedTable(speedMin, speedMax),
      maxDarkness
    );

    const options = new Options.PrinterOptions(
      serial,
      modelInfo,
      'Zebra', // TODO: Pull dynamically
      this.getXmlText(doc, 'FIRMWARE-VERSION') ?? ''
    );

    const currentDarkness = parseInt(this.getXmlCurrent(doc, 'MEDIA-DARKNESS') ?? '15');
    const rawDarkness = Math.ceil(currentDarkness * (100 / maxDarkness));
    options.darknessPercent = Math.max(0, Math.min(rawDarkness, 99)) as Options.DarknessPercent;

    const printRate = parseInt(this.getXmlText(doc, 'PRINT-RATE') ?? '1');
    const slewRate = parseInt(this.getXmlText(doc, 'SLEW-RATE') ?? '1');
    options.speed = new Options.PrintSpeedSettings(
      Options.PrintSpeedSettings.getSpeedFromWholeNumber(printRate),
      Options.PrintSpeedSettings.getSpeedFromWholeNumber(slewRate)
    );

    // Always in dots
    const labelWidth = parseInt(this.getXmlCurrent(doc, 'PRINT-WIDTH') ?? '200');
    const labelLength = parseInt(this.getXmlText(doc, 'LABEL-LENGTH') ?? '200');
    const labelRoundingStep = mediaOptions.labelDimensionRoundingStep ?? 0;
    if (labelRoundingStep > 0) {
      // Label size should be rounded to the step value by round-tripping the value to an inch
      // then rounding, then back to dots.
      const roundedWidth = this.roundToNearestStep(
        labelWidth / options.model.dpi,
        labelRoundingStep
      );
      options.labelWidthDots = roundedWidth * options.model.dpi;
      const roundedHeight = this.roundToNearestStep(
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
    const labelHorizontalOffset = parseInt(this.getXmlText(doc, 'LABEL-SHIFT') ?? '0') || 0;
    const labelHeightOffset = parseInt(this.getXmlCurrent(doc, 'LABEL-TOP') ?? '0') || 0;
    options.labelPrintOriginOffsetDots = {
      left: labelHorizontalOffset,
      top: labelHeightOffset
    };

    options.printOrientation =
      this.getXmlText(doc, 'LABEL-REVERSE') === 'Y'
        ? Options.PrintOrientation.inverted
        : Options.PrintOrientation.normal;

    options.thermalPrintMode =
      this.getXmlCurrent(doc, 'MEDIA-TYPE') === 'DIRECT-THERMAL'
        ? Options.ThermalPrintMode.direct
        : Options.ThermalPrintMode.transfer;

    options.mediaPrintMode = this.parsePrintMode(this.getXmlCurrent(doc, 'PRINT-MODE') ?? '');

    options.labelGapDetectMode = this.parseMediaType(this.getXmlCurrent(doc, 'MEDIA-TRACKING') ?? '');

    options.mediaPrintMode =
      this.getXmlCurrent(doc, 'PRE-PEEL') === 'Y'
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

  private range(start: number, stop: number, step = 1) {
    return Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);
  }

  private getXmlText(doc: Document, tag: string) {
    return doc.getElementsByTagName(tag).item(0)?.textContent ?? undefined;
  }

  private getXmlCurrent(doc: Document, tag: string) {
    return doc.getElementsByTagName(tag).item(0)
      ?.getElementsByTagName('CURRENT').item(0)
      ?.textContent ?? undefined;
  }

  private parsePrintMode(str: string) {
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

  private parseMediaType(str: string) {
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

  private getSpeedTable(min: number, max: number) {
    return new Map<Options.PrintSpeed, number>([
      [Options.PrintSpeed.ipsAuto, 0],
      [Options.PrintSpeed.ipsPrinterMin, min],
      [Options.PrintSpeed.ipsPrinterMax, max],
      ...this.range(min, max).map(s =>
        [Options.PrintSpeedSettings.getSpeedFromWholeNumber(s), s] as [Options.PrintSpeed, number])
    ]);
  }

  private getFieldOffsetCommand(
    formMetadata: TranspiledDocumentState,
    additionalHorizontal = 0,
    additionalVertical = 0
  ) {
    const xOffset = Math.trunc(formMetadata.horizontalOffset + additionalHorizontal);
    const yOffset = Math.trunc(formMetadata.verticalOffset + additionalVertical);
    return `^FO${xOffset},${yOffset}`;
  }

  private addImageCommand(
    cmd: Commands.AddImageCommand,
    outDoc: TranspiledDocumentState
  ): Uint8Array {
    // ZPL treats colors as print element enable. 1 means black, 0 means white.
    const bitmap = cmd.bitmap;
    // TODO: support image conversion options.
    //const imageOptions = cmd.imageConversionOptions;

    // ZPL supports compressed binary on pretty much all firmware, default to that.
    // TODO: ASCII-compressed formats are only supported on newer firmware.
    // Implement feature detection into the transpiler operation to choose the most
    // appropriate compression format such as LZ77/DEFLATE compression for Z64.
    const buffer = bitmap.toZebraCompressedGRF();

    // Because the image may be trimmed add an offset command to position to the image data.
    const fieldStart = this.getFieldOffsetCommand(
      outDoc,
      bitmap.boundingBox.paddingLeft,
      bitmap.boundingBox.paddingTop
    );

    const byteLen = bitmap.bytesUncompressed;
    const graphicCmd = `^GFA,${byteLen},${byteLen},${bitmap.bytesPerRow},${buffer}`;

    const fieldEnd = '^FS';

    // Finally, bump the document offset according to the image height.
    outDoc.verticalOffset += bitmap.boundingBox.height;

    return this.encodeCommand(fieldStart + graphicCmd + fieldEnd);
  }

  private setPrintDirectionCommand(
    upsideDown: boolean
  ): Uint8Array {
    const dir = upsideDown ? 'I' : 'N';
    return this.encodeCommand(`^PO${dir}`);
  }

  private setDarknessCommand(
    darkness: number
  ): Uint8Array {
    const dark = Math.trunc(darkness);
    return this.encodeCommand(`~SD${dark}`);
  }

  private setPrintSpeedCommand(
    cmd: Commands.SetPrintSpeedCommand,
  ): Uint8Array {
    // ZPL uses separate print, slew, and backfeed speeds. Re-use print for backfeed.
    return this.encodeCommand(`^PR${cmd.speedVal},${cmd.mediaSpeedVal},${cmd.speedVal}`);
  }

  private setLabelDimensionsCommand(
    cmd: Commands.SetLabelDimensionsCommand
  ): Uint8Array {
    const width = Math.trunc(cmd.widthInDots);
    const widthCmd = this.encodeCommand(`^PW${width}`);
    if (cmd.setsHeight && cmd.heightInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const height = Math.trunc(cmd.heightInDots);
      const heightCmd = this.encodeCommand(`^LL${height},N`);
      return this.combineCommands(widthCmd, heightCmd);
    }
    return widthCmd;
  }

  private setLabelHomeCommand(
    cmd: Commands.SetLabelHomeCommand
  ): Uint8Array {
    const xOffset = Math.trunc(cmd.xOffset);
    const yOffset = Math.trunc(cmd.yOffset);
    return this.encodeCommand(`^LH${xOffset},${yOffset}`);
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Commands.SetLabelPrintOriginOffsetCommand
  ): Uint8Array {
    // This ends up being two commands, one to set the top and one to set the
    // horizontal shift. LS moves the horizontal, LT moves the top. LT is
    // clamped to +/- 120 dots, horizontal is 9999.
    const xOffset = clampToRange(Math.trunc(cmd.xOffset), -9999, 9999);
    const yOffset = clampToRange(Math.trunc(cmd.yOffset), -120, 120);
    return this.encodeCommand(`^LS${xOffset}^LT${yOffset}`);
  }

  private setLabelToContinuousMediaCommand(
    cmd: Commands.SetLabelToContinuousMediaCommand
  ): Uint8Array {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return this.encodeCommand(`^MNN^LL${length + gap}`);
  }

  private setLabelToWebGapMediaCommand(
    cmd: Commands.SetLabelToWebGapMediaCommand
  ): Uint8Array {
    const length = Math.trunc(cmd.labelLengthInDots);
    return this.encodeCommand(`^MNY^LL${length},Y`);
  }

  private setLabelToMarkMediaCommand(
    cmd: Commands.SetLabelToMarkMediaCommand
  ): Uint8Array {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return this.encodeCommand(`^MNM,${length}^LL${lineOffset}`);
  }

  private printCommand(
    cmd: Commands.PrintCommand
  ): Uint8Array {
    // TODO: Make sure this actually works this way..
    // According to the docs the first parameter is "total" labels,
    // while the third is duplicates.
    const total = Math.trunc(cmd.count * (cmd.additionalDuplicateOfEach + 1));
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return this.encodeCommand(`^PQ${total},0,${dup},N`);
  }

  private addLineCommand(
    cmd: Commands.AddLineCommand,
    outDoc: TranspiledDocumentState
  ): Uint8Array {
    return this.lineOrBoxToCmd(
      outDoc,
      cmd.heightInDots,
      cmd.lengthInDots,
      cmd.color,
      // A line is just a box filled in!
      Math.min(cmd.heightInDots, cmd.lengthInDots)
    );
  }

  private addBoxCommand(
    cmd: Commands.AddBoxCommand,
    outDoc: TranspiledDocumentState,
  ): Uint8Array {
    return this.lineOrBoxToCmd(
      outDoc,
      cmd.heightInDots,
      cmd.lengthInDots,
      Commands.DrawColor.black,
      cmd.thickness
    );
  }

  private lineOrBoxToCmd(
    outDoc: TranspiledDocumentState,
    height: number,
    length: number,
    color: Commands.DrawColor,
    thickness?: number
  ): Uint8Array {
    height = Math.trunc(height) || 0;
    thickness = Math.trunc(thickness ?? 1) || 1;
    length = Math.trunc(length) || 0;
    let drawMode: string;
    switch (color) {
      case Commands.DrawColor.black:
        drawMode = 'B';
        break;
      case Commands.DrawColor.white:
        drawMode = 'W';
        break;
    }
    const fieldStart = this.getFieldOffsetCommand(outDoc);

    // TODO: Support rounding?
    return this.encodeCommand(
      [fieldStart, `^GB${length}`, height, thickness, drawMode, '^FS'].join(',')
    );
  }
}
