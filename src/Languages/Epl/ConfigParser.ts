import { DecodeAscii } from "../../ASCII.js";
import { WebZlpError } from "../../index.js";
import type { IMessageHandlerResult, ISettingUpdateMessage } from "../../Printers/index.js";

export function parseConfiguration(
  msg: Uint8Array,
  sentCommand: Cmds.IPrinterCommand
): IMessageHandlerResult<Uint8Array> {
  const result: IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: new Uint8Array(),
  }
  // Assumption: Everything in the message object is the config response. Given
  // the nature of EPL printers this appears to very consistent behavior.
  const rawText = DecodeAscii(msg);
  // Raw text from the printer contains \r\n, normalize to \n.
  const lines = rawText
    .replaceAll('\r', '')
    .split('\n')
    .filter((i) => i);

  if (lines.length <= 0) {
    // No config provided, can't make a valid config out of it.
    return result;
  }

  // Unfortunately EPL-only printers tended to have a LOT of variance on
  // what they actually put into the config. Firmware versions, especially
  // customized versions, can and do omit information.
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

  const update: ISettingUpdateMessage = {
    messageType: 'SettingUpdateMessage',

    serialNumber: 'no_serial_nm',
    firmware: firmwareVersion,
  }

  // All the rest of these follow some kind of standard pattern for
  // each value which we can pick up with regex. The cases here are
  // built out of observed configuration dumps.
  for (let i = 1; i < lines.length; i++) {
    const str = lines[i];
    switch (true) {
      case /^S\/N.*/.test(str):
        // S/N: 42A000000000       # Serial number
        update.serialNumber = str.substring(5).trim();
        break;
      case /^Serial\sport/.test(str):
        // Serial port:96,N,8,1    # Serial port config
        // TODO: Serial port settings and update
        //printerInfo.serialPort = str.substring(12).trim();
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
        update.headDistanceIn = Number(str.substring(15).trim().replace('"', '').replace(',', ''));
        break;
      }
      case /^PRINTER\susage\s=/.test(str): {
        // PRINTER usage =     249,392"    # Odometer of the printer
        update.printerDistanceIn = Number(str.substring(15).trim().replace('"', '').replace(',', ''));
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
  const options = new PrinterOptions(
    printerInfo.serial,
    expectedModel,
    'EPL', // TODO: Pull dynamically
    printerInfo.firmware);

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
