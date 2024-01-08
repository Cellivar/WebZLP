/* eslint-disable no-fallthrough */
import { WebZlpError } from '../../WebZlpError.js';
import * as Options from '../Configuration/PrinterOptions.js';
import { PrinterOptions } from '../Configuration/PrinterOptions.js';
import { PrinterModelDb } from '../Models/PrinterModelDb.js';
import { PrinterModel } from '../Models/PrinterModel.js';
import {
  PrinterCommandSet,
  TranspiledDocumentState,
  type IPrinterExtendedCommandMapping,
  exhaustiveMatchGuard
} from './PrinterCommandSet.js';
import * as Commands from '../../Documents/Commands.js';
import { clampToRange } from '../../NumericRange.js';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends PrinterCommandSet {
  private encoder = new TextEncoder();

  get commandLanguage(): Options.PrinterCommandLanguage {
    return Options.PrinterCommandLanguage.epl;
  }

  get formStartCommand(): Uint8Array {
    // Start of any EPL document should include a clear image buffer to prevent
    // previous commands from affecting the document.
    return this.encodeCommand('\r\nN');
  }

  get formEndCommand(): Uint8Array {
    // There's no formal command for the end of an EPL doc, but just in case
    // add a newline.
    return this.encodeCommand();
  }

  protected nonFormCommands: (symbol | Commands.CommandType)[] = [
    'AutosenseLabelDimensionsCommand',
    'PrintConfigurationCommand',
    'QueryConfigurationCommand',
    'RawDocumentCommand',
    'RebootPrinterCommand'
  ];

  constructor(
    extendedCommands: Array<IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    super(Options.PrinterCommandLanguage.epl, extendedCommands);
  }

  public encodeCommand(str = '', withNewline = true): Uint8Array {
    // Every command in EPL ends with a newline.
    return this.encoder.encode(str + (withNewline ? '\r\n' : ''));
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
        return this.encodeCommand('^@');
      case 'QueryConfigurationCommand':
        return this.encodeCommand('UQ');
      case 'PrintConfigurationCommand':
        return this.encodeCommand('U');
      case 'SaveCurrentConfigurationCommand':
        // EPL doesn't have an explicit save step.
        return this.noop;

      case 'SetPrintDirectionCommand':
        return this.setPrintDirectionCommand((cmd as Commands.SetPrintDirectionCommand).upsideDown);
      case 'SetDarknessCommand':
        return this.setDarknessCommand((cmd as Commands.SetDarknessCommand).darknessSetting);
      case 'AutosenseLabelDimensionsCommand':
        return this.encodeCommand('xa');
      case 'SetPrintSpeedCommand':
        // EPL has no separate media slew speed setting.
        return this.setPrintSpeedCommand((cmd as Commands.SetPrintSpeedCommand).speedVal);
      case 'SetLabelDimensionsCommand':
        return this.setLabelDimensionsCommand(cmd as Commands.SetLabelDimensionsCommand);
      case 'SetLabelHomeCommand':
        return this.setLabelHomeCommand(cmd as Commands.SetLabelHomeCommand, docState, this);
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
        return this.formStartCommand;
      case 'SuppressFeedBackupCommand':
        // EPL uses an on/off style for form backup, it'll remain off until reenabled.
        return this.encodeCommand('JB');
      case 'EnableFeedBackupCommand':
        // Thus EPL needs an explicit command to re-enable.
        return this.encodeCommand('JF');

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
        return this.encodeCommand('C');

      case 'PrintCommand':
        return this.printCommand(cmd as Commands.PrintCommand);
    }
  }

  public parseConfigurationResponse(
    rawText: string,
    mediaOptions: Options.IPrinterLabelMediaOptions,
  ): PrinterOptions {
    // Raw text from the printer contains \r\n, normalize to \n.
    const lines = rawText
      .replaceAll('\r', '')
      .split('\n')
      .filter((i) => i);

    if (lines.length <= 0) {
      // No config provided, can't make a valid config out of it.
      return PrinterOptions.invalid;
    }

    // We make a lot of assumptions about the format of the config output.
    // Unfortunately EPL-only printers tended to have a LOT of variance on
    // what they actually put into the config. Firmware versions, especially
    // shipper-customized versions, can and do omit information.
    // This method attempts to get what we can out of it.

    // See the docs folder for more information on this format.

    // First line determines firmware version and model number. When splitting
    // the string by spaces the last element should always be the version and
    // the rest of the elements are the model number.
    // UKQ1935HLU     V4.29   // Normal LP244
    // UKQ1935HMU  FDX V4.45  // FedEx modified LP2844
    // UKQ1935H U UPS V4.14   // UPS modified LP2844
    const header = lines[0].split(' ').filter((i) => i);
    const firmwareVersion = header.pop() ?? '';
    const rawModelId = header.join(' ');

    const model = PrinterModelDb.getModel(rawModelId);
    const expectedModel = PrinterModelDb.getModelInfo(model);

    const printerInfo: {
      firmware: string,
      serial: string,
      serialPort?: string | undefined,
      speed?: number,
      doubleBuffering?: boolean,
      headDistanceIn?: string,
      printerDistanceIn?: string,
      hardwareOptions: string[]
    } = {
      firmware: firmwareVersion,
      hardwareOptions: [],
      serial: 'no_serial_nm'
    };

    const labelInfo: {
      labelWidthDots?: number,
      labelGapDots?: number,
      labelGapOffsetDots?: number,
      labelHeightDots?: number,
      density: number,
      xRef: number,
      yRef: number,
      orientation?: string,
      mediaMode: Options.LabelMediaGapDetectionMode
    } = {
      xRef: 0,
      yRef: 0,
      density: (expectedModel.maxDarkness / 2),
      mediaMode: Options.LabelMediaGapDetectionMode.webSensing
    };

    // All the rest of these follow some kind of standard pattern for
    // each value which we can pick up with regex. The cases here are
    // built out of observed configuration dumps.
    for (let i = 1; i < lines.length; i++) {
      const str = lines[i];
      switch (true) {
        case /^S\/N.*/.test(str):
          // S/N: 42A000000000       # Serial number
          printerInfo.serial = str.substring(5).trim();
          break;
        case /^Serial\sport/.test(str):
          // Serial port:96,N,8,1    # Serial port config
          printerInfo.serialPort = str.substring(12).trim();
          break;
        case /^q\d+\sQ/.test(str): {
          // q600 Q208,25            # Form width (q) and length (Q), with label gap
          const settingsForm = str.trim().split(' ');
          // Label width includes 4 dots of padding. Ish. Maybe.
          labelInfo.labelWidthDots = parseInt(settingsForm[0].substring(1)) - 4;
          // Length is fuzzy, depending on the second value this can be
          // A: The length of the label surface
          // B: The distance between black line marks
          // C: The length of the form on continuous media
          // Format is Qp1,p2[,p3]
          const length = settingsForm[1].split(',');
          // p1 is always present and can be treated as the 'label height' consistently.
          labelInfo.labelHeightDots = parseInt(length[0].substring(1));
          // p2 value depends on...
          const rawGapMode = length[1].trim();
          if (rawGapMode === '0') {
            // Length of '0' indicates continuous media.
            labelInfo.mediaMode = Options.LabelMediaGapDetectionMode.continuous;
          } else if (rawGapMode.startsWith('B')) {
            // A B character enables black line detect mode, gap is the line width.
            labelInfo.mediaMode = Options.LabelMediaGapDetectionMode.markSensing;
            labelInfo.labelGapDots = parseInt(rawGapMode.substring(1));
          } else {
            // Otherwise this is the gap length between labels.
            labelInfo.mediaMode = Options.LabelMediaGapDetectionMode.webSensing;
            labelInfo.labelGapDots = parseInt(rawGapMode);
          }
          // A third value is required for black line, ignored for others.
          if (length[2]) {
            labelInfo.labelGapOffsetDots = parseInt(length[2]);
          }
          break;
        }
        case /^S\d\sD\d\d\sR/.test(str): {
          // S4 D08 R112,000 ZB UN   # Config settings 2
          const settings2 = str.trim().split(' ');
          const ref = settings2[2].split(',');
          printerInfo.speed = parseInt(settings2[0].substring(1));
          labelInfo.density = parseInt(settings2[1].substring(1));
          labelInfo.xRef = parseInt(ref[0].substring(1));
          labelInfo.yRef = parseInt(ref[1]);
          labelInfo.orientation = settings2[3].substring(1);
          break;
        }
        case /^I\d,.,\d\d\d\sr[YN]/.test(str): {
          // I8,A,001 rY JF WY       # Config settings 1
          const settings1 = str.split(' ');
          printerInfo.doubleBuffering = settings1[1][1] === 'Y';
          break;
        }
        case /^HEAD\s\s\s\susage\s=/.test(str): {
          // HEAD    usage =     249,392"    # Odometer of the head
          const headSplit = str.substring(15).split(' ');
          printerInfo.headDistanceIn = headSplit[headSplit.length - 1];
          break;
        }
        case /^PRINTER\susage\s=/.test(str): {
          // PRINTER usage =     249,392"    # Odometer of the printer
          const printSplit = str.substring(15).split(' ');
          printerInfo.printerDistanceIn = printSplit[printSplit.length - 1];
          break;
        }
        case /^Option:/.test(str):
          // Option:D,Ff         # Config settings 4
          printerInfo.hardwareOptions = str.substring(7).split(',');
          break;
        case /^Line\sMode/.test(str):
          // Line mode           # Printer is in EPL1 mode
          throw new WebZlpError(
            'Printer is in EPL1 mode, this library does not support EPL1. Reset printer.'
          );
        //
        // Everything else isn't parsed into something interesting.
        // We explicitly parse and handle them to better identify things we don't
        // parse, so we can log that information.
        //
        case /^Page\sMode/.test(str):
        // Page mode           # Printer is in EPL2 mode
        // No-op, this is the mode we want in WebZLP
        case /^oE.,/.test(str):
        // oEv,w,x,y,z             # Config settings 5
        // Line mode font substitution settings, ignored in WebZLP
        case /^oU.,/.test(str):
        // oUs,t,u                 # UNKNOWN!
        // Unknown information, only seen on a UPS model so far.
        case /^\d\d\s\d\d\s\d\d\s$/.test(str):
        // 06 10 14                # Config setting 6
        // Not useful information, ignored in WebZLP
        case /^Emem[:\s]/.test(str):
        // Emem:031K,0037K avl     # Soft font storage
        // Emem used: 0            # Soft font storage
        case /^Gmem[:\s]/.test(str):
        // Gmem:000K,0037K avl     # Graphics storage
        // Gmem used: 0            # Graphics storage
        case /^Fmem[:\s]/.test(str):
        // Fmem:000.0K,060.9K avl  # Form storage
        // Fmem used: 0 (bytes)    # Form storage
        case /^Available:/.test(str):
        // Available: 130559       # Total memory for Forms, Fonts, or Graphics
        case /^Cover:/.test(str):
        // Cover: T=118, C=129     # (T)reshold and (C)urrent Head Up (open) sensor.
        case /^Image buffer size:/.test(str):
          // Image buffer size:0245K # Image buffer size in use
          break;
        default:
          console.log(
            "WebZLP observed a config line from your printer that was not handled. We'd love it if you could report this bug! Send '" +
            str +
            "' to https://github.com/Cellivar/WebZLP/issues"
          );
          break;
      }
    }

    // For any of the called-out sections above see the docs for WebZLP.

    if (model === PrinterModel.unknown) {
      // Break the rule of not directly logging errors for this ask.
      console.error(
        `An EPL printer was detected, but WebZLP doesn't know what model it is to communicate with it. Consider submitting an issue to the project at https://github.com/Cellivar/WebZLP/issues to have your printer added so the library can work with it. The information to attach is:`,
        '\nmodel:',
        rawModelId,
        '\nfirmware:',
        printerInfo.firmware,
        '\nconfigLine',
        lines[0],
        '\nAnd include any other details you have about your printer. Thank you!'
      );
      return PrinterOptions.invalid;
    }

    // Marshall it into a real data structure as best we can.
    // TODO: Better way to do this?
    const options = new PrinterOptions(printerInfo.serial, expectedModel, printerInfo.firmware);

    const darkPercent = Math.ceil(labelInfo.density * (100 / expectedModel.maxDarkness));
    options.darknessPercent = clampToRange(darkPercent, 0, expectedModel.maxDarkness) as Options.DarknessPercent;

    options.speed = new Options.PrintSpeedSettings(
      options.model.fromRawSpeed(printerInfo.speed)
    );
    const rounding = mediaOptions.labelDimensionRoundingStep;
    if (rounding > 0 && labelInfo.labelWidthDots !== undefined && labelInfo.labelHeightDots !== undefined) {
      // Label size should be rounded to the step value by round-tripping the value to an inch
      // then rounding, then back to dots.
      const roundedWidth = this.roundToNearestStep(
        labelInfo.labelWidthDots / options.model.dpi,
        rounding
      );
      options.labelWidthDots = roundedWidth * options.model.dpi;
      const roundedHeight = this.roundToNearestStep(
        labelInfo.labelHeightDots / options.model.dpi,
        rounding
      );
      options.labelHeightDots = roundedHeight * options.model.dpi;
    } else {
      // No rounding
      options.labelWidthDots = labelInfo.labelWidthDots ?? 100;
      options.labelHeightDots = labelInfo.labelHeightDots ?? 100;
    }

    // No rounding applied to other offsets, those tend to be stable.
    options.labelGapDots = labelInfo.labelGapDots ?? 0;
    options.labelLineOffsetDots = labelInfo.labelGapOffsetDots ?? 0;

    options.labelGapDetectMode = labelInfo.mediaMode;

    options.labelPrintOriginOffsetDots = { left: labelInfo.xRef, top: labelInfo.yRef };

    options.printOrientation =
      labelInfo.orientation === 'T'
        ? Options.PrintOrientation.inverted
        : Options.PrintOrientation.normal;

    // Hardware options are listed as various flags.
    // Presence of d or D indicates direct thermal printing, absence indicates transfer.
    if (printerInfo.hardwareOptions.some((o) => o === 'd' || o === 'D')) {
      options.thermalPrintMode = Options.ThermalPrintMode.direct;
    } else {
      options.thermalPrintMode = Options.ThermalPrintMode.transfer;
    }

    // EPL spreads print mode across multiple settings that are mutually exclusive.
    if (printerInfo.hardwareOptions.some((o) => o === 'C')) {
      options.mediaPrintMode = Options.MediaPrintMode.cutter;
    }
    if (printerInfo.hardwareOptions.some((o) => o === 'Cp')) {
      options.mediaPrintMode = Options.MediaPrintMode.cutterWaitForCommand;
    }
    if (printerInfo.hardwareOptions.some((o) => o === 'P')) {
      options.mediaPrintMode = Options.MediaPrintMode.peel;
    }
    if (printerInfo.hardwareOptions.some((o) => o === 'L')) {
      options.mediaPrintMode = Options.MediaPrintMode.peelWithButtonTap;
    }

    // TODO: more hardware options:
    // - Form feed button mode (Ff, Fr, Fi)
    // - Figure out what reverse gap sensor mode S means
    // - Figure out how to encode C{num} for cut-after-label-count

    // TODO other options:
    // Autosense settings?
    // Character set?
    // Error handling?
    // Continuous media?
    // Black mark printing?

    return options;
  }

  private setPrintDirectionCommand(
    upsideDown: boolean
  ): Uint8Array {
    const dir = upsideDown ? 'T' : 'B';
    return this.encodeCommand(`Z${dir}`);
  }

  private setDarknessCommand(
    darkness: number
  ): Uint8Array {
    const dark = Math.trunc(darkness);
    return this.encodeCommand(`D${dark}`);
  }

  private setPrintSpeedCommand(
    speed: number
  ): Uint8Array {
    // Validation should have happened on setup, printer will just reject
    // invalid speeds.
    return this.encodeCommand(`S${speed}`);
  }

  private setLabelDimensionsCommand(
    cmd: Commands.SetLabelDimensionsCommand,
  ): Uint8Array {
    const width = Math.trunc(cmd.widthInDots);
    const widthCmd = this.encodeCommand(`q${width}`);
    if (cmd.setsHeight && cmd.heightInDots !== undefined && cmd.gapLengthInDots !== undefined) {
      const height = Math.trunc(cmd.heightInDots);
      const gap = Math.trunc(cmd.gapLengthInDots);
      const heightCmd = this.encodeCommand(`Q${height},${gap}`);
      return this.combineCommands(widthCmd, heightCmd);
    }
    return widthCmd;
  }

  private setLabelHomeCommand(
    cmd: Commands.SetLabelHomeCommand,
    outDoc: TranspiledDocumentState,
    cmdSet: EplPrinterCommandSet
  ): Uint8Array {
    return this.modifyOffset(
      new Commands.OffsetCommand(cmd.xOffset, cmd.yOffset, true),
      outDoc,
      cmdSet
    );
  }

  private setLabelPrintOriginOffsetCommand(
    cmd: Commands.SetLabelPrintOriginOffsetCommand,
  ): Uint8Array {
    const xOffset = Math.trunc(cmd.xOffset);
    const yOffset = Math.trunc(cmd.yOffset);
    return this.encodeCommand(`R${xOffset},${yOffset}`);
  }

  private setLabelToContinuousMediaCommand(
    cmd: Commands.SetLabelToContinuousMediaCommand,
  ): Uint8Array {
    // EPL seems to not have a static label length? All labels are variable?
    // Needs testing.
    const length = Math.trunc(cmd.labelLengthInDots);
    return this.encodeCommand(`Q${length},0`);
  }

  private setLabelToWebGapMediaCommand(
    cmd: Commands.SetLabelToWebGapMediaCommand,
  ): Uint8Array {
    const length = Math.trunc(cmd.labelLengthInDots);
    const gap = Math.trunc(cmd.labelGapInDots);
    return this.encodeCommand(`Q${length},${gap}`);
  }

  private setLabelToMarkMediaCommand(
    cmd: Commands.SetLabelToMarkMediaCommand,
  ): Uint8Array {
    const length = Math.trunc(cmd.labelLengthInDots);
    const lineLength = Math.trunc(cmd.blackLineThicknessInDots);
    const lineOffset = Math.trunc(cmd.blackLineOffset);
    return this.encodeCommand(`Q${length},B${lineLength},${lineOffset}`);
  }

  private printCommand(
    cmd: Commands.PrintCommand,
  ): Uint8Array {
    const total = Math.trunc(cmd.count);
    const dup = Math.trunc(cmd.additionalDuplicateOfEach);
    return this.encodeCommand(`P${total},${dup}`);
  }

  private addImageCommand(
    cmd: Commands.AddImageCommand,
    outDoc: TranspiledDocumentState,
  ): Uint8Array {
    // EPL only supports raw binary, get that.
    const bitmap = cmd.bitmap;
    const buffer = bitmap.toBinaryGRF();

    // Add the text command prefix to the buffer data
    const parameters = [
      'GW' + Math.trunc(outDoc.horizontalOffset + bitmap.boundingBox.paddingLeft),
      Math.trunc(outDoc.verticalOffset + bitmap.boundingBox.paddingTop),
      bitmap.bytesPerRow,
      bitmap.height
    ];
    // Bump the offset according to the image being added.
    outDoc.verticalOffset += bitmap.boundingBox.height;
    const rawCmd = this.encodeCommand(parameters.join(',') + ',', false);
    return this.combineCommands(
      rawCmd,
      this.combineCommands(buffer, this.encodeCommand(''))
    );
  }

  private addLineCommand(
    cmd: Commands.AddLineCommand,
    outDoc: TranspiledDocumentState,
  ): Uint8Array {
    const length = Math.trunc(cmd.lengthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    let drawMode = 'LO';
    switch (cmd.color) {
      case Commands.DrawColor.black:
        drawMode = 'LO';
        break;
      case Commands.DrawColor.white:
        drawMode = 'LW';
        break;
    }

    return this.encodeCommand(
      `${drawMode}${outDoc.horizontalOffset},${outDoc.verticalOffset},${length},${height}`
    );
  }

  private addBoxCommand(
    cmd: Commands.AddBoxCommand,
    outDoc: TranspiledDocumentState,
  ): Uint8Array {
    const length = Math.trunc(cmd.lengthInDots) || 0;
    const height = Math.trunc(cmd.heightInDots) || 0;
    const thickness = Math.trunc(cmd.thickness) || 0;

    return this.encodeCommand(
      `X${outDoc.horizontalOffset},${outDoc.verticalOffset},${thickness},${length},${height}`
    );
  }
}
