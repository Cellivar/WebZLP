/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Util from '../../Util/index.js';
import type { IZplSettingUpdateMessage, PowerUpAction } from './Config.js';

const powerUpMap: Record<string, PowerUpAction> = {
  "NO MOTION": 'none',
  "CALIBRATION": 'calibrateWebSensor',
  "FEED": 'feedBlank',
}

export class CmdHostConfig implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdHostStatus");
  typeExtended = CmdHostConfig.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = 'Get host config';
  type = "CustomCommand" as const;
  effectFlags = Cmds.AwaitsEffect;
  toDisplay() { return this.name; }

  constructor() { }
}

export const cmdHostConfigMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdHostConfig.typeE,
  transpile: handleCmdHostConfig,
  readMessage: parseCmdHostConfig,
}

export function handleCmdHostConfig(
  _cmd: Cmds.IPrinterCommand,
  _docState: Cmds.TranspiledDocumentState,
  _commandSet: Cmds.CommandSet<string>
): string {
  return '^HH';
}

export function parseCmdHostConfig(
  msg: string,
  _cmd: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  // Each response should start with STX and end with ETX. The ETX is the last
  // character in the message, no CR/LF after it.
  const msgStart = msg.indexOf(Util.AsciiCodeStrings.STX);
  const msgEnd   = msg.indexOf(Util.AsciiCodeStrings.ETX);
  if (msgStart === -1) {
    // Not the message we were looking for?
    return result;
  }
  if (msgEnd === -1) {
    // Incomplete?
    result.messageIncomplete = true;
    return result;
  }

  // Other messages may have STX/ETX, make sure this is our config message.
  const response = msg.substring(msgStart + 1, msgEnd);
  if (response.indexOf('ZPL MODE') === -1) {
    return result;
  }
  result.messageMatchedExpectedCommand = true;

  // Content before and after should be preserved.
  result.remainder = msg.substring(0, msgStart) + msg.substring(msgEnd + 1);

  const update: IZplSettingUpdateMessage = {
    messageType: 'SettingUpdateMessage' as const,
  }
  update.printerHardware    ??= {};
  update.printerMedia       ??= {};
  update.printerSettings    ??= {};
  update.printerZplSettings ??= {};

  if (window.location.hostname === "localhost") {
    console.debug(
      "Full ZPL config message:\n",
      `${Util.AsciiCodeStrings.STX}${response}${Util.AsciiCodeStrings.ETX}`
    );
  }

  // Store these for disambiguation later on..
  let markLed, ribbonLed: number | undefined;
  let sawGain = false;
  let sawNonCont = false;
  let sawSensorType: string | undefined;

  response
    .split('\n')
    .map((s) => {
      // ZPL config lines are 40 chars long, indented 2 spaces and padded.
      // For example:
      //  TRANSMISSIVE        SENSOR SELECT
      // 2 spaces indent, 20 spaces value, 18 spaces key
      // We slice at 22 chars and construct a dictionary.
      let key = s.substring(22).trim().toUpperCase();
      const value = s.substring(0, 22).trim();
      if (value.length === 12 && key === "") {
        // There's at least one exception: old ZPL versions will include the serial
        // at the top with no key.
        key = "SERIAL NUMBER";
      }
      return { key, value };
    })
    .forEach(l => {
      switch (l.key) {
        default:
          console.debug('Unhandled line: ', l.key, l.value);
          break;

        case "":
          // Empty key??
          break;

        case "MEDIA TYPE": {
          switch (l.value) {
            case "MARK":
              update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.markSensing;
              break;
            case "CONTINUOUS":
              update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.continuous;
              break;
            case "GAP/NOTCH":
              update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.webSensing;
              break;
            case "NON-CONTINUOUS":
              // Older printers use this for both mark and web, then use SENSOR TYPE
              // to determine what type of non-continuous.
              sawNonCont = true;
              break;
          }
          break;
        }
        case "SENSOR SELECT": // TRANSMISSIVE, REFLECTIVE, MANUAL
          // Seems to be present on newer firmware revisions
          // This should be set automatically with MEDIA TYPE.
          // TODO: Don't ignore this if it disagrees with MEDIA TYPE?
          break;
        case "SENSOR TYPE": // MARK, WEB
          // Seems to be present on older firmware revisions. Will still be set
          // when in continuous mode, so disambiguate later on.
          sawSensorType = l.value
          break;

        // Cases handled by XML.
        // TODO: Handle them here too, eventually deprecate XML for performance?
        case "FIRMWARE":
          // The firmware value should match that of the USB info. Here though
          // it's displayed with a <- appended, to make it easier to find. Strip
          // it before returning.
          break;
        case "SERIAL NUMBER":
          // This is often not present on newer printers.
          break;
        case "HARDWARE ID":
        case "DARKNESS":
        case "DARKNESS SWITCH": // Physical hardware must be present
          break;

        case "PRINT SPEED": // Unreliably present
          break;

        case "TEAR OFF ADJUST":
        case "TEAR OFF": // Older synonym
          break;

        case "PRINT METHOD": // DIRECT-THERMAL, older?
        case "PRINT MODE": // tear-off, peel, etc.
        case "PRINT  WIDTH": // Older has two spaces?
        case "PRINT WIDTH":
          // Newer firmware will be raw dots
          // Older firmware is humanized, so
          // 025 0/8 MM
          // and must be parsed...
          break;
        case "LABEL LENGTH":
          update.printerMedia!.mediaLengthDots = Number(l.value);
          break;
        case "MAXIMUM LENGTH":
          // Humanized, must be parsed
          // 2.0IN   50MM
          break;

        case "MEDIA POWER UP":
          update.printerZplSettings!.actionPowerUp = powerUpMap[l.value] ?? 'none';
          break;
        case "HEAD CLOSE":
          update.printerZplSettings!.actionHeadClose = powerUpMap[l.value] ?? 'none';
          break;

        case "BACKFEED":
        case "LABEL TOP":
        case "LEFT POSITION":
        case "REPRINT MODE":
        case "MODES ENABLED":
        case "MODES DISABLED":
        case "RESOLUTION":
        case "RFID VERSION":
          break;

        case "TAKE LABEL":
          update.printerZplSettings!.takeLabelThreshold = Number(l.value);
          break;

        // These next values are special depending on the vintage of the printer.
        // Somewhere beteween the ZP505 and the ZD410 the XML values for
        // "LED-INTENSITY" became "GAIN", and a new "LED-BRIGHTNESS" was added
        // for the ribbon and mark sensors. The MEDIA-LED-INTENSITY became
        // TRANSMISSIVE-GAIN, and a new command ^SI was added to set the LED
        // brightness itself. There are also separate SET-GET-DO commands.

        // The LP2824Plus seems to be part of this migration, having no "LED"
        // values and no "TRANS" config lines.

        // My R2844-Z has "LED" lines, LP2824Plus has "GAIN", ZD410 has BOTH!
        // The "MARK LED" and "RIBBON LED" lines on newer printers are not the same
        // so we must store them here and figure out which one they mean later.
        // Yay backwards incompatible changes!
        // Ribbon sensor is consistent, if present.
        case "RIBBON SENSOR":
        case "RIBBON S.": //older synonym
          update.printerZplSettings!.ribbonThreshold = Number(l.value);
          break;
        case "RIBBON GAIN":
          sawGain = true;
          update.printerZplSettings!.ribbonGain = Number(l.value);
          break;
        case "RIBBON LED":
          // May be gain or brightness, defer disambiguation
          ribbonLed = Number(l.value);
          break;

        // Web sense
        // Web threshold
        case "WEB SENSOR":
        case "WEB S.": // older synonym
          update.printerZplSettings!.webThreshold = Number(l.value);
          break;
        case "WEB GAIN": // 2824Plus synonym?
        case "TRANS GAIN": // whos lives matter yo
          sawGain = true;
          update.printerZplSettings!.transGain = Number(l.value);
          break;
        case "MEDIA LED": // Older name for same setting???
          // My kingdom for an hour with a Zebra firmware architect...
          update.printerZplSettings!.transGain = Number(l.value);
          break;
        // Media out threshold
        case "MEDIA SENSOR":
        case "MEDIA S.": // older synonym
          update.printerZplSettings!.mediaThreshold = Number(l.value);
          break;
        case "TRANS LED":
          update.printerZplSettings!.transBrightness = Number(l.value);
          break;

        // Mark sense
        // Web threshold
        case "MARK SENSOR":
        case "MARK S.": // older synonym
          update.printerZplSettings!.markThreshold = Number(l.value);
          break;
        case "MARK GAIN":
          sawGain = true;
          update.printerZplSettings!.markGain = Number(l.value);
          break;
        case "MARK LED":
          // May be gain or brightness, defer disambiguation
          markLed = Number(l.value);
          break;
        // Media out threshold
        case "MARK MED SENSOR":
        case "MARK MED S.": // older synonym
          update.printerZplSettings!.markMediaThreshold = Number(l.value);
          break;
        case "MARK MEDIA GAIN":
          // Only shows on ZP505 and LP2824Plus..?
          sawGain = true;
          update.printerZplSettings!.markMediaGain = Number(l.value);
          break;

        // These are on a ZP505 and an LP2824Plus, I don't know what they're
        // for or how to configure them..
        case 'CONT MEDIA SENSOR':
        case 'CONT MEDIA S.': // Older synonym
          break;
        case "CONT MEDIA GAIN":
          sawGain = true;
          break;

        // Time and counters, maybe useful?
        case "RTC DATE":
        case "RTC TIME":
          break;

        // There is one non-resettable counter and two resettable ones
        // like a car odometer and trip, haha.
        // Unfortunately, they use the same key! You have to split by suffix.
        // LABELS, IN, CM
        case "NONRESET CNTR":
        case "RESET CNTR1":
        case "RESET CNTR2":
        case "LAST CLEANED":
        case "HEAD USAGE":
        case "TOTAL USAGE":
        case "HEAD CLEANING":
        case "HEAD LIFE":
          break;

        // Comm modes flags that might not be needed ever?
        case "EARLY WARNING":
        case "USB COMM.":
        case "SER COMM. MODE":
        case "BAUD":
        case "DATA BITS":
        case "PARITY":
        case "HOST HANDSHAKE":
        case "PROTOCOL":
        case "COMMUNICATIONS":
        case "LINK-OS VERSION":
        case "SLOT 1":
        case "MASS STORAGE COUNT":
        case "HID COUNT":
        case "USB HOST LOCK OUT":
        case "XML SCHEMA": // Validate?
        case "HEXDUMP": // Fedex only?
        case "IDLE DISPLAY":
        case "CONFIGURATION": // CUSTOMIZED, older?
        case "FORMAT CONVERT":
        case "ZBI":
        case "ZBI VERSION":
        case "ZBI STATUS":
        case "RAM":
        case "ONBOARD FLASH":
        case "PARALLEL COMM.":
        case "SERIAL COMM.":
        case "NETWORK ID":
        case "TWINAX/COAX ID":
        case "ZEBRA NET II":
          break;

        // TODO: Sanity check these, throw a fit if they're set differently
        case "CONTROL PREFIX":
        case "CONTROL CHAR": // old synonym
        case "FORMAT PREFIX":
        case "COMMAND CHAR": // old synonym
        case "DELIMITER CHAR":
        case "DELIM. CHAR": // old synonym
        case "ZPL MODE":
        case "COMMAND OVERRIDE":
          break;
      }
  });

  // If any 'GAIN' lines were observed the LED values are for brightness,
  // otherwise the values are for 'intensity' which is synonymous with 'gain'.
  if (sawGain) {
    update.printerZplSettings!.markBrightness = markLed;
    update.printerZplSettings!.ribbonBrightness = ribbonLed;
  } else {
    update.printerZplSettings!.markGain  = markLed;
    update.printerZplSettings!.ribbonGain = ribbonLed;
  }

  // On older printers 'NON-CONTINOUS' media type is used for web and mark
  // then the SENSOR TYPE is used to determine the gap mode.
  if (sawNonCont && sawSensorType !== undefined) {
    if (sawSensorType === "MARK") {
      update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.markSensing;
    } else if (sawSensorType === "WEB") {
      update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.webSensing;
    }
  }

  result.messages = [update];
  return result
}

