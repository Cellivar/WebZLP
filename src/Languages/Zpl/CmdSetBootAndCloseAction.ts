import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export type PrinterBootAction
  = 'none'
  | 'feedBlank'
  | 'calibrateWebLength'
  | 'calibrateWebSensor';

const bootActionToCmd: Record<PrinterBootAction, string> = {
  feedBlank: 'F',
  calibrateWebSensor: 'C',
  calibrateWebLength: 'L',
  none: 'N'
}

export class CmdSetBootAndCloseAction implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdSetBootAndCloseAction");
  typeExtended = CmdSetBootAndCloseAction.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = 'Set the action when the printer boots or the head is closed.';
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['altersConfig']);
  toDisplay() {
    return `Set boot action to ${this.bootAction} and head close action to ${this.closeAction}`;
  }

  constructor(
    public readonly bootAction: PrinterBootAction,
    public readonly closeAction: PrinterBootAction
  ) {}
}

export const cmdSetBootAndCloseActionMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdSetBootAndCloseAction.typeE,
  transpile: handleCmdSetBootAndCloseAction,
}

export function handleCmdSetBootAndCloseAction(
  cmd: Cmds.IPrinterCommand,
): string {
  if (cmd instanceof CmdSetBootAndCloseAction) {
    const b = bootActionToCmd[cmd.bootAction];
    const c = bootActionToCmd[cmd.closeAction];
    return `^MF${b},${c}`;
  }
  return '';
}
