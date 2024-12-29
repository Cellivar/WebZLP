/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

/** The reporting mode an EPL printer can be placed in. */
export type CmdErrorReportingMode = 'Disabled' | 'Normal' | 'Alternate';

const modeCommandMap: Record<CmdErrorReportingMode, string> = {
  Disabled : "N",
  Normal   : "S",
  Alternate: "T"
}

export class CmdErrorReporting implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdErrorReporting")
  typeExtended = CmdErrorReporting.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.epl;
  name = 'Set error reporting';
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['altersConfig']);
  toDisplay() { return `Set error reporting to ${this.mode}`; }

  constructor(public readonly mode: CmdErrorReportingMode) {}
}

export const cmdErrorReportingMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdErrorReporting.typeE,
  transpile: handleCmdErrorReporting,
  formInclusionMode: Cmds.CommandFormInclusionMode.noForm,
}

export function handleCmdErrorReporting(
  cmd: Cmds.IPrinterCommand,
  _docState: Cmds.TranspiledDocumentState,
  _commandSet: Cmds.CommandSet<string>
): string {
  const command = cmd as CmdErrorReporting;
  return `U${modeCommandMap[command.mode]}\r\n`
}
