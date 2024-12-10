/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { AsciiCodeStrings } from '../../Util/ASCII.js';

export type CmdHostQueryType
  = 'Error status'
  | 'Hardware address'
  | 'Head test'
  | 'Maintenance alert'
  | 'Maintenance info'
  | 'Odometer read'
  | 'Printhead history'
  | 'Plug and play string'
  | 'Serial number'
  | 'USB info'

const queryToCmdArg: Record<CmdHostQueryType, string> = {
  "Error status"        : 'ES',
  "Hardware address"    : 'HA',
  "Head test"           : 'JT',
  "Maintenance alert"   : 'MA',
  "Maintenance info"    : 'MI',
  'Odometer read'       : 'OD',
  "Printhead history"   : 'PH',
  "Plug and play string": 'PP',
  "Serial number"       : 'SN',
  "USB info"            : 'UI'
}

const queryToHandler: Record<CmdHostQueryType, (msg: string) => Cmds.IStatusMessage> = {
  "Error status"        : getErrorStatus,
  "Hardware address"    : getHardwareAddress,
  "Head test"           : getHeadTest,
  "Maintenance alert"   : getMaintAlert,
  "Maintenance info"    : getMaintInfo,
  "Odometer read"       : getOdometerRead,
  "Plug and play string": getPnP,
  "Printhead history"   : getHeadHistory,
  "Serial number"       : getSerialNumber,
  "USB info"            : getUsbInfo
}

/** Warning flags that could be returned by the Error Status query. */
export enum HostQueryWarningFlags {
  /** No warnings present. */
  none = 0,
  // Nibble 1
  /** Media calibration needs to be performed. */
  calibrateMedia = 1 << 0,
  /** Printhead needs to be cleaned. */
  cleanPrinthead = 1 << 1,
  /** Printhead needs to be replaced. */
  replacePrinthead = 1 << 2,
  /** KR403 paper is near the end. */
  paperNearEndSensor = 1 << 3,
}

/** Error flags that could be returned by the Error Status query. */
export enum HostQueryErrorFlags {
  /** No errors present. */
  none = 0,
}

export class CmdHostQuery implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdHostQuery")
  typeExtended = CmdHostQuery.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.epl;
  name = 'Query printer status';
  type = "CustomCommand" as const;
  effectFlags = Cmds.AwaitsEffect;
  toDisplay() { return `Query for ${this.query}`; }

  constructor(public readonly query: CmdHostQueryType) {}
}

export function handleCmdHostQuery(
  cmd: Cmds.IPrinterCommand,
  docState: Cmds.TranspiledDocumentState,
  _commandSet: Cmds.CommandSet<string>
): string | Cmds.TranspileDocumentError {
  // Version check.
  // The V45 (LP28XX series) firmware version doesn't support this command. I
  // am not sure what other firmware versions don't.
  const badVers = ['V45.'];
  if (badVers.filter(v => docState.initialConfig.firmware.startsWith(v)).length > 0) {
    return new Cmds.TranspileDocumentError(`The command CmdHostQuery ~HQ is not supported on printer firmware ${docState.initialConfig.firmware}. Remove the command from your document.`);
  }

  const command = cmd as CmdHostQuery;
  return `~HQ${queryToCmdArg[command.query]}\n`;
}

export function parseCmdHostQuery(
  msg: string,
  cmd: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  if (cmd.type !== "CustomCommand" || (cmd as CmdHostQuery).typeExtended !== CmdHostQuery.typeE) {
    throw new Cmds.MessageParsingError(
      `Incorrect command '${cmd.name}' passed to parseCmdHostQuery, expected 'CmdHostQuery' instead.`,
      msg
    );
  }

  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: "",
  }

  // Each response should start with STX and end with ETX.
  const msgStart = msg.indexOf(AsciiCodeStrings.STX);
  const msgEnd = msg.indexOf(AsciiCodeStrings.ETX);
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
  result.messages.push(queryToHandler[(cmd as CmdHostQuery).query](response));

  return result;
}

function getErrorStatus(msg: string): Cmds.IStatusMessage {
  // TODO: Is this seriously what the printer sends back??
  // PRINTER STATUS
  // ERRORS:   1 00000000 00000005
  // WARNINGS: 0 00000000 00000000
  //           ^ This is a flag indicating if there are any errors or warnings.
  // The message digits are one flag and 16 separate 'nibbles' which each are a
  // hexadecimal number 0-F. Taken together they form a big-endian 256 bit field
  // of status flags.
  // The flag value will be 1 if there are any warnings or errors at all.
  // According to the ZPL guide I have only 'nibbles' 1-5 are used for errors
  // and 'nibbles' 1-3 are used for warnings. We sanity check the rest are zero.
  console.log("Error status returned from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getHardwareAddress(msg: string): Cmds.IStatusMessage {

  // MAC ADDRESS
  // 00:07:4d:2c:e0:7a

  console.log("Hardware address from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getHeadTest(msg: string): Cmds.IStatusMessage {

  // PRINT HEAD TEST RESULTS:
  // 0,A,0015,0367,0000
  // Split by comma:
  // 0: Element failure (dead pixel?)
  // 1: Manual (M) or automatic (A) range
  // 2: First test element
  // 3: Last test element
  // 4: Failure count
  // Related to the ^JT head test config command.

  console.log("Head test results from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getMaintAlert(msg: string): Cmds.IStatusMessage {

  // MAINTENANCE ALERT SETTINGS
  // HEAD REPLACEMENT INTERVAL:    1 km
  // HEAD REPLACEMENT FREQUENCY:   0 M
  // HEAD CLEANING INTERVAL:       0 M
  // HEAD CLEANING FREQUENCY:      0 M
  // PRINT REPLACEMENT ALERT:       NO
  // PRINT CLEANING ALERT:          NO
  // UNITS:                          C

  console.log("Maintenance alerts from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getMaintInfo(msg: string): Cmds.IStatusMessage {
  // MAINTENANCE ALERT MESSAGES
  // CLEAN: PLEASE CLEAN PRINT HEAD
  // REPLACE: PLEASE REPLACE PRINT HEAD

  console.log("Maintenance messages from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getOdometerRead(msg: string): Cmds.IStatusMessage {
  // PRINT METERS
  // TOTAL NONRESETTABLE:     8560 "
  // USER RESETTABLE CNTR1:      9 "
  // USER RESETTABLE CNTR2:   8560 "

  // Note that the units of measure are controlled by the ^MA command. Also, if the "Early Warning
  // Maintenance State" is turned "ON" the printer response would also list LAST CLEANED and CURRENT
  // PRINTHEAD LIFE counters.

  // PRINT METERS
  // TOTAL NONRESETTABLE: 21744 cm
  // USER RESETTABLE CNTR1: 24 cm
  // USER RESETTABLE CNTR2: 21744 cm

  console.log("Odometer from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }

}

function getPnP(msg: string): Cmds.IStatusMessage {
  // PLUG AND PLAY MESSAGES
  // MFG: Zebra Technologies
  // CMD: ZPL
  // MDL: GX420t

  console.log("Plug and Play messages from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getHeadHistory(msg: string): Cmds.IStatusMessage {
  // LAST CLEANED: 257 "
  // HEAD LIFE HISTORY
  // # DISTANCE
  // 1: 257 "
  // 2: 1489 "
  // 3: 7070 "
  // Line 1 is the currently installed printhead
  // Lines 2 through 10 (variable) are previous print head distances.

  console.log("Head history from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }

}

function getSerialNumber(msg: string): Cmds.IStatusMessage {
  // SERIAL NUMBER
  // 41A06440023

  console.log("Serial number from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}

function getUsbInfo(msg: string): Cmds.IStatusMessage {
  // USB INFORMATION
  // PID: 0085
  // RELEASE VERSION: 15.01

  console.log("USB info from printer: ", msg);
  return {
    messageType: 'StatusMessage'
  }
}
