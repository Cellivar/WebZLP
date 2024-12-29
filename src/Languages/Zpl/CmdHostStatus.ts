/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Util from '../../Util/index.js';

export class CmdHostStatus implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdHostStatus");
  typeExtended = CmdHostStatus.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.epl;
  name = 'Get host status';
  type = "CustomCommand" as const;
  effectFlags = Cmds.AwaitsEffect;
  toDisplay() { return this.name; }

  constructor() {}
}

export const cmdHostStatusMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdHostStatus.typeE,
  transpile: handleCmdHostStatus,
  readMessage: parseCmdHostStatus,
  formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
}

export function handleCmdHostStatus(
  _cmd: Cmds.IPrinterCommand,
  _docState: Cmds.TranspiledDocumentState,
  _commandSet: Cmds.CommandSet<string>
): string {
  return '~HS\n';
}

export function parseCmdHostStatus(
  msg: string,
  _cmd: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  // Each line is wrapped in an STX_ETX\r\n pattern. Make sure there's one there
  const msgStart = msg.indexOf(Util.AsciiCodeStrings.STX);
  if (msgStart === -1) {
    // Not the message we were looking for?
    return result;
  }
  // This should be the first line, which we can validate.
  const line1Maybe = msg.substring(msgStart);

  // The structure of each line is always the same.
  const { sliced: line1, remainder: line1r } = Util.sliceToCRLF(line1Maybe);
  // Note, regex appears to ignore STX/ETX characters.
  if (!/^\d{3},\d,\d,\d{4},\d{3},\d,\d,\d,000,\d,\d,\d$/.test(line1.slice(1, -1))) {
    return result;
  }
  // First line is unique, so if it matched it's the right command.
  result.messageMatchedExpectedCommand = true;
  const { sliced: line2, remainder: line2r } = Util.sliceToCRLF(line1r);
  if (!/^\d{3},\d,\d,\d,\d,\d,\d,\d,\d{8},1,\d{3}$/.test(line2.slice(1, -1))) {
    // First line matched but not second, incomplete??
    result.messageIncomplete = true;
    return result;
  }
  const { sliced: line3, remainder: line3r } = Util.sliceToCRLF(line2r);
  if (!/^\d{4},\d$/.test(line3.slice(1, -1))) {
    result.messageIncomplete = true;
    return result;
  }
  result.remainder = msg.substring(0, msgStart) + line3r;

  const settingsMsg = {
    messageType: 'SettingUpdateMessage'
  } as Cmds.ISettingUpdateMessage
  const statusMsg = {
    messageType: 'StatusMessage',
  } as Cmds.IStatusMessage;
  const errorMsg = {
    messageType: 'ErrorMessage',
    errors: new Cmds.ErrorStateSet()
  } as Cmds.IErrorMessage;

  const l1 = line1.split(',');
  // Serial port bitflag
  if (l1.at(1) === '1') { errorMsg.errors.add(Cmds.ErrorState.MediaEmptyError); }
  if (l1.at(2) === '1') { errorMsg.errors.add(Cmds.ErrorState.PrinterPaused); }
  // label length
  // formats in receive buffer
  if (l1.at(5) === '1') { errorMsg.errors.add(Cmds.ErrorState.ReceiveBufferFull); }
  // diag mode
  // partial format in progress
  // unused (always 000)
  // corrupt RAM
  if (l1.at(10) === '1') { errorMsg.errors.add(Cmds.ErrorState.PrintheadTooCold); }
  if (l1.at(11) === '1') { errorMsg.errors.add(Cmds.ErrorState.PrintheadTooHot); }

  const l2 = line2.split(',');
  // function settings
  // unused
  if (l2.at(2) === '1') { errorMsg.errors.add(Cmds.ErrorState.PrintheadUp); }
  if (l2.at(3) === '1') { errorMsg.errors.add(Cmds.ErrorState.RibbonEmptyError); }
  // thermal transfer mode
  // print mode???
  // print width mode
  if (l2.at(7) === '1') { errorMsg.errors.add(Cmds.ErrorState.LabelWaitingToBeTaken); }
  // labels remaining in batch
  // always 1
  // images stored in memory

  //const l3 = line3.split(',');
  // password
  // static ram installed flag

  result.messages = [settingsMsg, statusMsg, errorMsg];
  return result
}
