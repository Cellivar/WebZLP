import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import type { PowerUpAction } from './Config.js';

const bootActionToCmd: Record<PowerUpAction, string> = {
  feedBlank: 'F',
  calibrateWebSensor: 'C',
  calibrateWebLength: 'L',
  none: 'N'
}

export class CmdSetPowerUpAndHeadCloseAction implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdSetPowerUpAndHeadCloseAction");
  typeExtended = CmdSetPowerUpAndHeadCloseAction.typeE;
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

export const cmdSetPowerUpAndHeadCloseActionMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdSetPowerUpAndHeadCloseAction.typeE,
  transpile: handleCmdSetPowerUpAndHeadCloseAction,
}

export function handleCmdSetPowerUpAndHeadCloseAction(
  cmd: Cmds.IPrinterCommand,
): string {
  if (cmd instanceof CmdSetPowerUpAndHeadCloseAction) {
    const b = bootActionToCmd[cmd.actionPowerUp];
    const c = bootActionToCmd[cmd.actionHeadClose];
    return `^MF${b},${c}`;
  }
  return '';
}
