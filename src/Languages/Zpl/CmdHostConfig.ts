/* eslint-disable no-fallthrough */
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
  update.printerZplSettings ??= {
    sensorLevels: {
      labelLengthDots: 1,
      markLedBrightness   : 50,
      markThreshold      : 50,
      markMediaThreshold : 50,
      mediaLedBrightness  : 50,
      mediaThreshold     : 50,
      ribbonLedBrightness : 50,
      ribbonThreshold    : 50,
      webThreshold       : 50,
    }
  };

  if (window.location.hostname === "localhost") {
    console.debug(
      "Full ZPL config message:\n",
      `${Util.AsciiCodeStrings.STX}${response}${Util.AsciiCodeStrings.ETX}`
    );
  }

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
        key = "SERIAL";
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
            case "NON-CONTINUOUS":
              update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.webSensing;
              break;
          }
          break;
        }
        case "SENSOR SELECT": // TRANSMISSIVE, REFLECTIVE, MANUAL
          // This should be set automatically with MEDIA TYPE.
          // TODO: Don't ignore this if it disagrees with MEDIA TYPE?
          break;
        case "SENSOR TYPE": // MARK, WEB
          // This should be set automatically with MEDIA TYPE. LP2844-Z units.
          // TODO: Don't ignore this if it disagrees with MEDIA TYPE?
          break;

        // Cases handled by XML.
        // TODO: Handle them here too, eventually deprecate XML for performance?
        case "FIRMWARE":
        case "SERIAL":
        case "HARDWARE ID":
        case "DARKNESS":
        case "DARKNESS SWITCH": // Physical hardware must be present

        case "PRINT SPEED": // Unreliably present

        case "TEAR OFF ADJUST":
        case "TEAR OFF": // Older synonym

        case "PRINT METHOD": // DIRECT-THERMAL, older?
        case "PRINT MODE": // tear-off, peel, etc.
        case "PRINT  WIDTH": // Older has two spaces?
        case "PRINT WIDTH":
          // Newer firmware will be raw dots
          // Older firmware is humanized, so
          // 025 0/8 MM
          // and must be parsed...
        case "LABEL LENGTH":
          update.printerMedia!.mediaLengthDots = Number(l.value);
          break;
        case "MAXIMUM LENGTH":
          // Humanized, must be parsed
          // 2.0IN   50MM

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

        // Sensor levels, also in XML. These have synonyms
        // in old config formats
        case "WEB SENSOR":
        case "WEB S.": // older synonym
          update.printerZplSettings!.sensorLevels!.webThreshold = Number(l.value);
          break;
        case "MEDIA SENSOR":
        case "MEDIA S.": // older synonym
          update.printerZplSettings!.sensorLevels!.mediaThreshold = Number(l.value);
          break;
        case "MARK SENSOR":
        case "MARK S.": // older synonym
          update.printerZplSettings!.sensorLevels!.markThreshold = Number(l.value);
          break;
        case "MARK MED SENSOR":
        case "MARK MED S.": // older synonym
          update.printerZplSettings!.sensorLevels!.markMediaThreshold = Number(l.value);
          break;
        case "MARK LED":
          update.printerZplSettings!.sensorLevels!.markLedBrightness = Number(l.value);
          break;
        case "MEDIA LED":
        case "RIBBON LED":
          update.printerZplSettings!.sensorLevels!.ribbonLedBrightness = Number(l.value);
          break;
        case "RIBBON SENSOR":
        case "RIBBON S.": //older synonym
          update.printerZplSettings!.sensorLevels!.ribbonThreshold = Number(l.value);
          break;

        // These values don't correspond to ones that can be set via ^SS, so
        // I'm not sure what they're for.
        // TODO: Figure out what these sense and how to change them.
        case "TRANS GAIN": // whos lives matter yo
        case "TRANS LED":
        case "MARK GAIN":
        case "TAKE LABEL":

        // Time and counters, maybe useful?
        case "RTC DATE":
        case "RTC TIME":
        // There is one nonresettable counter and two resettable ones
        // like a car odometer and trip, haha.
        // Unfortunately, they use the same key! You have to split by suffix.
        // LABELS, IN, CM
        case "NONRESET CNTR":
        case "RESET CNTR1":
        case "RESET CNTR2":

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
        case "XML SCHEMA":
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

        // TODO: Sanity check these, throw a fit if they're set differntly
        case "CONTROL PREFIX":
        case "FORMAT PREFIX":
        case "DELIMITER CHAR":
        case "ZPL MODE":
        case "COMMAND OVERRIDE":
          break;
      }

  });

  result.messages = [update];
  return result
}

