import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Util from '../../Util/index.js';
import type { IZplPrinterSettings, SensorLevels } from './Config.js';

export class CmdSetSensorCalibration implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdSetSensorCalibration");
  typeExtended = CmdSetSensorCalibration.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = "Set sensor calibration levels manually";
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['altersConfig']);
  toDisplay(): string {
    // TODO: better message?
    return `Set sensor levels with ${handleCmdSetSensorCalibration(this)}`
  }

  readonly levels: Readonly<SensorLevels>;

  constructor(levels: SensorLevels) {
    this.levels = {
      labelLengthDots    : Util.clampToRange(levels.labelLengthDots, 1, 32000),
      markLedBrightness  : Util.clampToRange(levels.markLedBrightness, 0, 255),
      markMediaThreshold : Util.clampToRange(levels.markMediaThreshold, 0, 100),
      markThreshold      : Util.clampToRange(levels.markThreshold, 0, 100),
      mediaLedBrightness : Util.clampToRange(levels.mediaLedBrightness, 0, 255),
      mediaThreshold     : Util.clampToRange(levels.mediaThreshold, 0, 100),
      ribbonLedBrightness: Util.clampToRange(levels.ribbonLedBrightness, 0, 255),
      ribbonThreshold    : Util.clampToRange(levels.ribbonThreshold, 1, 100),
      webThreshold       : Util.clampToRange(levels.webThreshold, 0, 100),
    }
  }

  public static fromConfig(
    cfg: IZplPrinterSettings,
    levels: Partial<SensorLevels>
  ) {
    return new CmdSetSensorCalibration({
      labelLengthDots    : levels.labelLengthDots ?? cfg.sensorLevels.labelLengthDots,
      markLedBrightness  : levels.markLedBrightness ?? cfg.sensorLevels.markLedBrightness,
      markMediaThreshold : levels.markMediaThreshold ?? cfg.sensorLevels.markMediaThreshold,
      markThreshold      : levels.markThreshold ?? cfg.sensorLevels.markThreshold,
      mediaLedBrightness : levels.mediaLedBrightness ?? cfg.sensorLevels.mediaLedBrightness,
      mediaThreshold     : levels.mediaThreshold ?? cfg.sensorLevels.mediaThreshold,
      ribbonLedBrightness: levels.ribbonLedBrightness ?? cfg.sensorLevels.ribbonLedBrightness,
      ribbonThreshold    : levels.ribbonThreshold ?? cfg.sensorLevels.ribbonThreshold,
      webThreshold       : levels.webThreshold ?? cfg.sensorLevels.webThreshold,
    });
  }
}

export const cmdSetSensorCalibrationMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdSetSensorCalibration.typeE,
  transpile: handleCmdSetSensorCalibration,
}

export function handleCmdSetSensorCalibration(
  cmd: Cmds.IPrinterCommand,
): string {
  function pad(num: number, len = 3) {
    return num.toString().padStart(len, '0');
  }
  if (cmd instanceof CmdSetSensorCalibration) {
    return [
      `^SS${pad(cmd.levels.webThreshold)}`,
      pad(cmd.levels.mediaThreshold),
      pad(cmd.levels.ribbonThreshold),
      pad(cmd.levels.labelLengthDots, 4),
      pad(cmd.levels.mediaLedBrightness),
      pad(cmd.levels.ribbonLedBrightness),
      pad(cmd.levels.markThreshold),
      pad(cmd.levels.markMediaThreshold),
      pad(cmd.levels.markLedBrightness)
    ].join(',');
  }
  return '';
}

