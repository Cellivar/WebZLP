import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';

export class CmdGraphSensorCalibration implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdGraphSensorCalibration");
  typeExtended = CmdGraphSensorCalibration.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = "Print a series of labels showing the media sensor values";
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['feedsPaperIgnoringPeeler']);
  toDisplay() { return this.name; }

  constructor() {}
}

export const cmdGraphSensorCalibrationMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdGraphSensorCalibration.typeE,
  transpile: handleCmdGraphSensorCalibration,
}

export function handleCmdGraphSensorCalibration(
  cmd: Cmds.IPrinterCommand,
): string {
  if (cmd instanceof CmdGraphSensorCalibration) {
    return `~JG`;
  }
  return '';
}
