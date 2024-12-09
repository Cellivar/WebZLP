/* eslint-disable no-fallthrough */
import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as eplPrinters from "./EplPrinters.json" assert { type: 'json' };

type SpeedMaps = keyof typeof eplPrinters.default.speedMaps;
interface EplSpeedMap {
  "auto"?: number;
  "1.0"?: number;
  "1.5"?: number;
  "2.0"?: number;
  "2.5"?: number;
  "3.0"?: number;
  "3.5"?: number;
  "4.0"?: number;
  "5.0"?: number;
  "6.0"?: number;
}

export function parseConfigResponse(
  msg: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _cmd: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: "",
  }

  // Assumption: Everything in the message object is the config response. Given
  // the nature of EPL printers this appears to very consistent behavior.

  // Raw text from the printer contains \r\n, normalize to \n.
  const lines = msg
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
  const firmware = header.pop() ?? '';
  const rawModelId = header.join(' ');

  // Not all EPL printer information can be read from the printer, some data
  // must be looked up. Figure out the right printer based on the model hint.
  const hardware = getModel(rawModelId);
  if (hardware.model === "Unknown_EPL") {
    console.warn(
      `An EPL printer was detected, but WebZLP doesn't know what model it is to communicate with it. Consider submitting an issue to the project at https://github.com/Cellivar/WebZLP/issues to have your printer added so the library can work with it. The information to attach is:`,
      '\nmodel:',
      rawModelId,
      '\nconfigLine',
      lines[0],
      '\nAnd include any other details you have about your printer. Thank you!'
    );
  }

  const update: Cmds.ISettingUpdateMessage = {
    messageType: 'SettingUpdateMessage',
    printerHardware: {
      ...hardware,
      firmware
    },
    printerMedia: {},
  }

  // All the rest of these follow some kind of standard pattern for
  // each value which we can pick up with regex. The cases here are
  // built out of observed configuration dumps.
  for (let i = 1; i < lines.length; i++) {
    const str = lines[i];
    switch (true) {
      case /^S\/N.*/.test(str):
        // S/N: 42A000000000       # Serial number
        update.printerHardware.serialNumber = str.substring(5).trim();
        break;

      case str.startsWith("Serial port:"):
        // Serial port:96,N,8,1    # Serial port config
        // TODO: Serial port settings and update
        //printerInfo.serialPort = str.substring(12).trim();
        break;

      case /^q\d+ Q/.test(str): {
        // q600 Q208,25            # Form width (q) and length (Q), with label gap
        updateFormDimensions(str.trim(), update);
        break;
      }

      case /^I\d,.+,\d\d\d r[YN]/.test(str): {
        // I8,A,001 rY JF WY       # Config settings J
        updateSettingsLines(str.trim(), update);
        break;
      }

      case /^S\d D\d\d R/.test(str): {
        // S4 D08 R112,000 ZB UN   # Config settings K
        updateSettingsLines(str.trim(), update);
        break;
      }

      case /^HEAD {4}usage =/.test(str): {
        // HEAD    usage =     249,392"    # Odometer of the head
        update.headDistanceIn = Number(str.replaceAll(/[^\d]/g, ''));
        break;
      }

      case /^PRINTER usage =/.test(str): {
        // PRINTER usage =     249,392"    # Odometer of the printer
        update.printerDistanceIn = Number(str.replaceAll(/[^\d]/g, ''));
        break;
      }

      case /^Option:/.test(str):
        // Option:D,Ff         # Config settings M1
        updateHardwareOptions(str.trim(), update);
        break;

      case /^\d\d \d\d \d\d/.test(str):
        // 00 04 08          # Config settings N
        // TODO: Extract threshold values for sensors?
        //updateThresholds(str.trim(), update);
        break;

      case /^Line Mode/.test(str):
        // Line mode           # Printer is in EPL1 mode
        throw new Util.WebZlpError(
          'Printer is in EPL1 mode, this library does not support EPL1. Reset printer.'
        );
      //
      // Everything else isn't parsed into something interesting.
      // We explicitly parse and handle them to better identify things we don't
      // parse, so we can log that information.
      //
      case /^Page Mode/i.test(str):
      // Page mode           # Printer is in EPL2 mode
      // No-op, this is the mode we want in WebZLP
      case /^oE.,/.test(str):
      // oEv,w,x,y,z             # Config settings M2
      // Line mode font substitution settings, ignored in WebZLP
      case /^oU.,/.test(str):
      // oUs,t,u                 # UNKNOWN!
      // Unknown information, only seen on a UPS model so far.
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


  result.messages.push(update);
  return result;
}

function updateFormDimensions(str: string, msg: Cmds.ISettingUpdateMessage) {

  const settingsForm = str.trim().split(' ');

  // EPL printers will add or subtract a factory-set offset to label dimensions.
  // You tell it 203 dots wide it will store 207. No idea why. Round to a reasonable
  // step value to deal with this.
  // Label size should be rounded to the step value by round-tripping the value to an inch
  // then rounding, then back to dots.
  // TODO: Make this configurable!
  const rounding = 0.25;// mediaOptions.labelDimensionRoundingStep;
  const dpi = msg.printerHardware.dpi ?? 203;

  // Label width includes 4 dots of padding. Ish. Maybe.
  msg.printerMedia.mediaWidthDots =
    parseInt(settingsForm[0].substring(1)) - 4;
  if (rounding) {
    msg.printerMedia.mediaWidthDots = Math.floor(Util.roundToNearestStep(
      msg.printerMedia.mediaWidthDots,
      rounding * dpi
    ));
  }

  // Length is fuzzy, depending on the second value this can be
  // A: The length of the label surface
  // B: The distance between black line marks
  // C: The length of the form on continuous media
  // Format is Qp1,p2[,p3]
  const length = settingsForm[1].split(',');
  // p1 is always present and can be treated as the 'label length' consistently.
  msg.printerMedia.mediaLengthDots = parseInt(length[0].substring(1));
  if (rounding > 0) {
    msg.printerMedia.mediaLengthDots = Math.floor(Util.roundToNearestStep(
      msg.printerMedia.mediaLengthDots,
      rounding * dpi
    ));
  }

  // p2 value depends on...
  const rawGapMode = length[1].trim();
  if (rawGapMode === '0') {
    // Length of '0' indicates continuous media.
    msg.printerMedia.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.continuous;
    msg.printerMedia.mediaGapDots = 0;
  } else if (rawGapMode.startsWith('B')) {
    // A B character enables black line detect mode, gap is the line width.
    msg.printerMedia.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.markSensing;
    msg.printerMedia.mediaGapDots = parseInt(rawGapMode.substring(1));
  } else {
    // Otherwise this is the gap length between labels.
    msg.printerMedia.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.webSensing;
    msg.printerMedia.mediaGapDots = parseInt(rawGapMode);
  }
  // A third value is required for black line, ignored for others.
  if (length[2]) {
    msg.printerMedia.mediaLineOffsetDots = parseInt(length[2]);
  }
}

function updateSettingsLines(settingLine: string, msg: Cmds.ISettingUpdateMessage) {
  if (settingLine.at(0) === "I") {
    // Line J from the EPL manual.
    //const lineJ = settingLine.split(' ');
    // I8,A,001 rY JF WY
    //lineJ.at(0); // I8,A,001 - Character set (ignored)
    //lineJ.at(1); // rY - Double buffering (ignored, always on)
    // TODO: Top of form backup
    //lineJ.at(2); // JF - ? Top of form backup (ignored)
    //lineJ.at(3); // WY - ? Windows mode (ignored)
  }

  if (settingLine.at(0) === "S") {
    // Line K from the EPL manual.
    const lineK = settingLine.split(' ');
    // S4 D08 R112,000 ZB UN   # Config settings K
    const speed = Number(lineK.at(0)?.substring(1) ?? "2");
    msg.printerMedia.speed = new Conf.PrintSpeedSettings(
      msg.printerHardware.speedTable?.fromRawSpeed(speed) ?? Conf.PrintSpeed.ipsAuto
    );

    const rawD = Number(lineK.at(1)?.substring(1) ?? 7);
    const percentD = Util.clampToRange(Math.ceil((rawD / 15) * 100), 1, 100);
    msg.printerMedia.darknessPercent = percentD as Conf.DarknessPercent;

    // R112,000 sets the label home origin.
    const ref = lineK.at(2)?.substring(1).split(',') ?? ["0", "0"];
    msg.printerMedia.mediaPrintOriginOffsetDots = {
      left: Number(ref[0]),
      top:  Number(ref[1])
    }

    const orientation = lineK.at(3);
    msg.printerMedia.printOrientation =
      orientation === "ZT"
        ? Conf.PrintOrientation.inverted
        : Conf.PrintOrientation.normal;

    // TODO: Detect current error handling mode.
    //const errorSetting = lineK.at(4);
  }
}

function updateHardwareOptions(str: string, msg: Cmds.ISettingUpdateMessage) {
  // Option:D,Ff         # Config settings M1

  // TODO: Other options
  // Ff - Button tap to feed
  // Fr - Button tap to reprint last
  // Fi - Button ignored
  // S - ? Reverse (reflective) gap sensor
  // P - ? Label dispenser sensor enabled
  // C{num} - ? Cut after every {num} batch

  // Presence of d or D indicates direct thermal printing, absence indicates transfer.
  msg.printerMedia.thermalPrintMode = Conf.ThermalPrintMode.transfer;

  str.substring(7).split(',').forEach(o => {
    switch (o.trim()) {
      case "d":
      case "D":
        msg.printerMedia.thermalPrintMode = Conf.ThermalPrintMode.direct;
        break;
      case "C":
        msg.printerMedia.mediaPrintMode = Conf.MediaPrintMode.cutter;
        break;
      case "Cb":
        msg.printerMedia.mediaPrintMode = Conf.MediaPrintMode.cutterWaitForCommand;
        break;
      case "P":
        msg.printerMedia.mediaPrintMode = Conf.MediaPrintMode.peel;
        break;
      case "L":
        msg.printerMedia.mediaPrintMode = Conf.MediaPrintMode.peelWithButtonTap;
        break;
    }
  });
}

// TODO: Way to have user supply new models?
function getModel(rawModel: string): Conf.IPrinterHardwareUpdate {
  const speeds = eplPrinters.default.speedMaps;
  const models = eplPrinters.default.models;

  const model = models.find(m => {
    return m.modelHints.some(h => rawModel.match(h));
  }) ?? {
    modelName: "Unknown_EPL",
    dpi: 203,
    modelHints: [],
    printArea: {
      length: 2223,
      width: 832
    },
    speedMap: "28X4"
  };

  return {
    dpi: model.dpi,
    manufacturer: 'Zebra Corporation',
    maxMediaLengthDots: model.printArea.length,
    maxMediaWidthDots: model.printArea.width,
    maxMediaDarkness: 15,
    model: model.modelName,
    speedTable: getSpeedTable(speeds[model.speedMap as SpeedMaps])
  }
}

function getSpeedTable(speedMap: EplSpeedMap): Conf.SpeedTable {
  // Special case: mobile printers have a single speed.
  if (speedMap.auto) {
    return new Conf.SpeedTable(new Map<Conf.PrintSpeed, number>([
      [Conf.PrintSpeed.ipsAuto, 0],
      [Conf.PrintSpeed.ipsPrinterMax, 0],
      [Conf.PrintSpeed.ipsPrinterMin, 0]
    ]));
  }

  // Add in order so it's easier to pull out min/median/max later.
  const smap = new Map<Conf.PrintSpeed, number>();
  if (speedMap["1.0"] !== undefined) { smap.set(Conf.PrintSpeed.ips1,   speedMap["1.0"]); }
  if (speedMap["1.5"] !== undefined) { smap.set(Conf.PrintSpeed.ips1_5, speedMap["1.5"]); }
  if (speedMap["2.0"] !== undefined) { smap.set(Conf.PrintSpeed.ips2,   speedMap["2.0"]); }
  if (speedMap["2.5"] !== undefined) { smap.set(Conf.PrintSpeed.ips2_5, speedMap["2.5"]); }
  if (speedMap["3.0"] !== undefined) { smap.set(Conf.PrintSpeed.ips3,   speedMap["3.0"]); }
  if (speedMap["3.5"] !== undefined) { smap.set(Conf.PrintSpeed.ips3_5, speedMap["3.5"]); }
  if (speedMap["4.0"] !== undefined) { smap.set(Conf.PrintSpeed.ips4,   speedMap["4.0"]); }
  if (speedMap["5.0"] !== undefined) { smap.set(Conf.PrintSpeed.ips5,   speedMap["5.0"]); }
  if (speedMap["6.0"] !== undefined) { smap.set(Conf.PrintSpeed.ips6,   speedMap["6.0"]); }

  // Default common to all EPL printers: 2 ips!
  const def = [Conf.PrintSpeed.ips2, 2];

  const array = Array.from(smap);
  const med = Math.ceil(array.length / 2);
  smap.set(Conf.PrintSpeed.ipsPrinterMin, (array.at(0) ?? def)[1]);
  smap.set(Conf.PrintSpeed.ipsPrinterMax, (array.at(-1) ?? def)[1]);
  smap.set(Conf.PrintSpeed.ipsAuto, (array.at(med) ?? def)[1]);

  return new Conf.SpeedTable(smap);
}
