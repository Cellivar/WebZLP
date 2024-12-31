import * as Cmds from '../../Commands/index.js';

export type PowerUpAction
  = 'none'
  | 'feedBlank'
  | 'calibrateWebLength'
  | 'calibrateWebSensor';

export type SensorLevels = {
  labelLengthDots    : number,
  markLedBrightness  : number,
  markMediaThreshold : number,
  markThreshold      : number,
  mediaLedBrightness : number,
  mediaThreshold     : number,
  ribbonLedBrightness: number,
  ribbonThreshold    : number,
  webThreshold       : number,
}

export interface IZplSettingUpdateMessage extends Cmds.ISettingUpdateMessage {
  printerZplSettings?: Cmds.UpdateClass<IZplPrinterSettings>;
}

/** ZPL-specific config information about a printer. */
export interface IZplPrinterSettings {
  /** Sensor levels configured through calibration. */
  sensorLevels: SensorLevels;

  /** The action the printer takes on power up. */
  actionPowerUp: PowerUpAction;

  /** The action the printer takes when the head is closed. */
  actionHeadClose: PowerUpAction;
}

export class ZplPrinterConfig extends Cmds.PrinterConfig implements IZplPrinterSettings {

  private _sensorLevels : SensorLevels = {
    labelLengthDots    : 123,
    markLedBrightness  : 50,
    markMediaThreshold : 50,
    markThreshold      : 50,
    mediaLedBrightness : 50,
    mediaThreshold     : 50,
    ribbonLedBrightness: 50,
    ribbonThreshold    : 50,
    webThreshold       : 50,
  };
  public get sensorLevels() : SensorLevels {
    return this._sensorLevels;
  }

  private _actionPowerUp : PowerUpAction = 'none';
  public get actionPowerUp() : PowerUpAction {
    return this._actionPowerUp;
  }

  private _actionHeadClose : PowerUpAction = 'none';
  public get actionHeadClose() : PowerUpAction {
    return this._actionHeadClose;
  }

  public constructor(config?: Cmds.PrinterConfig) {
    super();
    if (config !== undefined) {
      this.update(config.toUpdate());
    }
  }

  public override update(msg: Cmds.ISettingUpdateMessage | IZplSettingUpdateMessage) {
    super.update(msg);

    if ("printerZplSettings" in msg) {
      const s = msg.printerZplSettings;

      this._actionPowerUp = s?.actionPowerUp ?? this._actionPowerUp;
      this._actionHeadClose = s?.actionHeadClose ?? this._actionHeadClose;
      this._sensorLevels = s?.sensorLevels ?? this._sensorLevels;
    }
  }

  public override toUpdate(): IZplSettingUpdateMessage {
    return {
      messageType: 'SettingUpdateMessage',

      printerHardware   : this,
      printerMedia      : this,
      printerSettings   : this,
      printerZplSettings: this,
    }
  }
}
