import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import type { PowerUpAction } from './Config.js';

const bootActionToCmd: Record<PowerUpAction, string> = {
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
    return `Set boot action to ${this.actionPowerUp} and head close action to ${this.actionHeadClose}`;
  }

  constructor(
    public readonly actionPowerUp: PowerUpAction,
    public readonly actionHeadClose: PowerUpAction
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
    const b = bootActionToCmd[cmd.actionPowerUp];
    const c = bootActionToCmd[cmd.actionHeadClose];
    return `^MF${b},${c}`;
  }
  return '';
}
