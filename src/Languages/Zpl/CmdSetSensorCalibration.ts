import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import * as Util from '../../Util/index.js';
import { ZplPrinterConfig, type IZplPrinterSettings, type SensorLevels } from './Config.js';

export class CmdSetSensorCalibration implements Cmds.IPrinterExtendedCommand {
  public static typeE = Symbol("CmdSetSensorCalibration");
  typeExtended = CmdSetSensorCalibration.typeE;
  commandLanguageApplicability = Conf.PrinterCommandLanguage.zpl;
  name = "Set sensor calibration levels manually";
  type = "CustomCommand" as const;
  effectFlags = new Cmds.CommandEffectFlags(['altersConfig']);
  toDisplay(): string {
    // TODO: better message?
    return `Set sensor levels with ${JSON.stringify(this.levels)}`
  }

  readonly levels: Conf.UpdateFor<SensorLevels>;

  constructor(levels: Conf.UpdateFor<SensorLevels>) {
    this.levels = {
      markGain          : levels.markGain           !== undefined ? Util.clampToRange(levels.markGain, 0, 255) : undefined,
      markMediaThreshold: levels.markMediaThreshold !== undefined ? Util.clampToRange(levels.markMediaThreshold, 0, 100) : undefined,
      markThreshold     : levels.markThreshold      !== undefined ? Util.clampToRange(levels.markThreshold, 0, 100) : undefined,
      transGain         : levels.transGain          !== undefined ? Util.clampToRange(levels.transGain, 0, 255) : undefined,
      mediaThreshold    : levels.mediaThreshold     !== undefined ? Util.clampToRange(levels.mediaThreshold, 0, 100) : undefined,
      ribbonGain        : levels.ribbonGain         !== undefined ? Util.clampToRange(levels.ribbonGain, 0, 255) : undefined,
      ribbonThreshold   : levels.ribbonThreshold    !== undefined ? Util.clampToRange(levels.ribbonThreshold, 1, 100) : undefined,
      webThreshold      : levels.webThreshold       !== undefined ? Util.clampToRange(levels.webThreshold, 0, 100) : undefined,
    }
  }

  public static fromConfig(
    cfg: IZplPrinterSettings,
    levels: Partial<SensorLevels>
  ) {
    return new CmdSetSensorCalibration({
      markGain          : levels.markGain           ?? cfg.markGain,
      markMediaThreshold: levels.markMediaThreshold ?? cfg.markMediaThreshold,
      markThreshold     : levels.markThreshold      ?? cfg.markThreshold,
      transGain         : levels.transGain          ?? cfg.transGain,
      mediaThreshold    : levels.mediaThreshold     ?? cfg.mediaThreshold,
      ribbonGain        : levels.ribbonGain         ?? cfg.ribbonGain,
      ribbonThreshold   : levels.ribbonThreshold    ?? cfg.ribbonThreshold,
      webThreshold      : levels.webThreshold       ?? cfg.webThreshold,
    });
  }
}

export const cmdSetSensorCalibrationMapping: Cmds.IPrinterCommandMapping<string> = {
  commandType: CmdSetSensorCalibration.typeE,
  transpile: handleCmdSetSensorCalibration,
}

export function handleCmdSetSensorCalibration(
  cmd: Cmds.IPrinterCommand,
  docState: Cmds.TranspiledDocumentState,
): string {
  function pad(num: number, len = 3) {
    return num.toString().padStart(len, '0');
  }
  const c = docState.initialConfig;
  if (cmd instanceof CmdSetSensorCalibration && c instanceof ZplPrinterConfig) {
    return [
      `^SS${pad(cmd.levels.webThreshold ?? c.webThreshold)}`,
      pad(cmd.levels.mediaThreshold     ?? c.mediaThreshold),
      pad(cmd.levels.ribbonThreshold    ?? c.ribbonThreshold),
      pad(docState.initialConfig.mediaLengthDots, 4),
      pad(cmd.levels.transGain          ?? c.transGain),
      pad(cmd.levels.ribbonGain         ?? c.ribbonGain),
      pad(cmd.levels.markThreshold      ?? c.markThreshold),
      pad(cmd.levels.markMediaThreshold ?? c.markMediaThreshold),
      pad(cmd.levels.markGain           ?? c.markGain)
    ].join(',');
  }
  return '';
}

