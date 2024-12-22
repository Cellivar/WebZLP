/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Util from '../../Util/index.js';

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
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: "",
  }
  // Each response should start with STX and end with ETX.
  const msgStart = msg.indexOf(Util.AsciiCodeStrings.STX);
  const msgEnd = msg.indexOf(Util.AsciiCodeStrings.ETX);
  if (msgStart === -1) {
    // Not the message we were looking for?
    result.messageMatchedExpectedCommand = false;
    result.remainder = msg;
    return result;
  }
  if (msgEnd === -1) {
    // Incomplete?
    result.remainder = msg;
    result.messageIncomplete = true;
    return result;
  }
  result.remainder = msg.substring(msgEnd + 3); // TODO: Make sure response includes CRLF.
  const response = msg.substring(msgStart + 1, msgEnd);

  const update: Cmds.ISettingUpdateMessage = {
    messageType: 'SettingUpdateMessage' as const,
  }
  update.printerHardware ??= {};
  update.printerMedia ??= {};
  update.printerSettings ??= {};

  // Raw text from the printer contains \r\n, normalize to \n.
  const lines = response
    .replaceAll('\r', '')
    .split('\n')
    .filter((i) => i);

  lines.forEach(l => {
    const str = l.trim();
    switch (true) {
      case /MEDIA TYPE$/.test(str):
        if (str.startsWith('MARK')) {
          update.printerMedia!.mediaGapDetectMode = Conf.MediaMediaGapDetectionMode.markSensing;
        }
        break;
      default:
        console.debug('Unhandled line: ', str);
    }

    // TODO LMAO

    // +21.0               DARKNESS
    // MEDIUM              DARKNESS SWITCH
    // 6.0 IPS             PRINT SPEED
    // +000                TEAR OFF ADJUST
    // TEAR OFF            PRINT MODE
    // MARK                MEDIA TYPE
    // REFLECTIVE          SENSOR SELECT
    // 203                 PRINT WIDTH
    // 2205                LABEL LENGTH
    // 10.0IN   253MM      MAXIMUM LENGTH
    // MAINT. OFF          EARLY WARNING
    // CONNECTED           USB COMM.
    // AUTO                SER COMM. MODE
    // 9600                BAUD
    // 8 BITS              DATA BITS
    // NONE                PARITY
    // XON/XOFF            HOST HANDSHAKE
    // NONE                PROTOCOL
    // NORMAL MODE         COMMUNICATIONS
    // <~>  7EH            CONTROL PREFIX
    // <^>  5EH            FORMAT PREFIX
    // <,>  2CH            DELIMITER CHAR
    // ZPL II              ZPL MODE
    // INACTIVE            COMMAND OVERRIDE
    // NO MOTION           MEDIA POWER UP
    // FEED                HEAD CLOSE
    // 10%                 BACKFEED
    // +000                LABEL TOP
    // +0000               LEFT POSITION
    // DISABLED            REPRINT MODE
    // 036                 WEB SENSOR
    // 096                 MEDIA SENSOR
    // 128                 TAKE LABEL
    // 050                 MARK SENSOR
    // 004                 MARK MED SENSOR
    // 035                 TRANS GAIN
    // 022                 TRANS LED
    // 017                 MARK GAIN
    // 100                 MARK LED
    // DPCSWFXM            MODES ENABLED
    // ........            MODES DISABLED
    //  448 8/MM FULL      RESOLUTION
    // 6.0                 LINK-OS VERSION
    // V84.20.18Z <-       FIRMWARE
    // 1.3                 XML SCHEMA
    // 6.5.0 0.770         HARDWARE ID
    // 8192k............R: RAM
    // 65536k...........E: ONBOARD FLASH
    // NONE                FORMAT CONVERT
    // ENABLED             IDLE DISPLAY
    // 12/16/24            RTC DATE
    // 14:40               RTC TIME
    // DISABLED            ZBI
    // 2.1                 ZBI VERSION
    // READY               ZBI STATUS
    // 7,332 LABELS        NONRESET CNTR
    // 7,332 LABELS        RESET CNTR1
    // 7,332 LABELS        RESET CNTR2
    // 12,555 IN           NONRESET CNTR
    // 12,543 IN           RESET CNTR1
    // 12,543 IN           RESET CNTR2
    // 31,859 CM           NONRESET CNTR
    // 31,859 CM           RESET CNTR1
    // 31,859 CM           RESET CNTR2
    // 003 WIRED           SLOT 1
    // 0                   MASS STORAGE COUNT
    // 0                   HID COUNT
    // OFF                 USB HOST LOCK OUT
  });

  result.messages = [update];
  return result
}
