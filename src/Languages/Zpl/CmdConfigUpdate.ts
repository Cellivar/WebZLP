import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export type SetActiveConfig = 'ReloadFactory' | 'ReloadSaved' | 'SaveCurrent';

export class CmdConfigUpdate implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdConfigUpdate");
  typeExtended = CmdConfigUpdate.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = 'Set the active config for the printer';
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['altersConfig']);
  toDisplay() { return this.name; }

  constructor(public readonly config: SetActiveConfig) { }
}

export const cmdConfigUpdateMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdConfigUpdate.typeE,
  transpile: handleCmdConfigUpdate
}

export function handleCmdConfigUpdate(
  cmd: Cmds.IPrinterCommand,
): string {
  if (cmd instanceof CmdConfigUpdate) {
    switch (cmd.config) {
      case 'ReloadFactory':
        return '^JUF'
      case 'ReloadSaved':
        return '^JUR'
      case 'SaveCurrent':
        return '^JUS'
    }
  }
  return '';
}
