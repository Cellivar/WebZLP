/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

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
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: "",
  }
  console.log("Got message: \n", msg);

  // TODO LMAO

  return result
}
