import * as Cmds from '../../Commands/index.js';
import * as Conf from '../../Configs/index.js';

export type PowerUpAction
  = 'none'
  | 'feedBlank'
  | 'calibrateWebLength'
  | 'calibrateWebSensor';

export interface SensorLevels {
  readonly markGain      : number;
  readonly markThreshold : number;
  readonly markBrightness: number;

  readonly markMediaGain     : number;
  readonly markMediaThreshold: number;

  readonly webThreshold   : number;
  readonly mediaThreshold : number;
  readonly transGain      : number;
  readonly transBrightness: number;

  readonly ribbonGain      : number;
  readonly ribbonThreshold : number;
  readonly ribbonBrightness: number;

  readonly takeLabelThreshold: number;
}

export interface IZplSettingUpdateMessage extends Cmds.ISettingUpdateMessage {
  printerZplSettings?: Conf.UpdateFor<IZplPrinterSettings>;
}

/** ZPL-specific config information about a printer. */
export interface IZplPrinterSettings extends SensorLevels {
  /** The action the printer takes on power up. */
  actionPowerUp: PowerUpAction;

  /** The action the printer takes when the head is closed. */
  actionHeadClose: PowerUpAction;
}

export class ZplPrinterConfig extends Cmds.PrinterConfig implements IZplPrinterSettings, SensorLevels {

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

  // Web sensors, a transmissive sensor by the print head.
  private _webThreshold: number = 50;
  public get webThreshold(): number {
    return this._webThreshold;
  }
  private _mediaThreshold: number = 95;
  public get mediaThreshold(): number {
    return this._mediaThreshold;
  }
  private _transGain: number = 10;
  public get transGain(): number {
    return this._transGain;
  }
  private _transBrightness: number = 50;
  public get transBrightness(): number {
    return this._transBrightness;
  }

  // Mark sensors, a reflective sensor by the print head.
  private _markGain: number = 128;
  public get markGain(): number {
    return this._markGain;
  }
  private _markThreshold: number = 50;
  public get markThreshold(): number {
    return this._markThreshold;
  }
  private _markBrightness: number = 50;
  public get markBrightness(): number {
    return this._markBrightness;
  }

  private _markMediaThreshold: number = 27;
  public get markMediaThreshold(): number {
    return this._markMediaThreshold;
  }
  private _markMediaGain: number = 27;
  public get markMediaGain(): number {
    return this._markMediaGain;
  }

  // Ribbon sensors, by the ribbon spool
  private _ribbonGain: number = 45;
  public get ribbonGain(): number {
    return this._ribbonGain;
  }
  private _ribbonThreshold: number = 67;
  public get ribbonThreshold(): number {
    return this._ribbonThreshold;
  }
  private _ribbonBrightness: number = 51;
  public get ribbonBrightness(): number {
    return this._ribbonBrightness;
  }

  private _takeLabelThreshold: number = 67;
  public get takeLabelThreshold(): number {
    return this._takeLabelThreshold;
  }

  public override update(msg: Cmds.ISettingUpdateMessage | IZplSettingUpdateMessage) {
    super.update(msg);

    if ("printerZplSettings" in msg) {
      const s = msg.printerZplSettings;

      this._actionPowerUp = s?.actionPowerUp ?? this._actionPowerUp;
      this._actionHeadClose = s?.actionHeadClose ?? this._actionHeadClose;

      this._markGain           = s?.markGain ?? this._markGain
      this._markThreshold      = s?.markThreshold ?? this._markThreshold
      this._markBrightness     = s?.markBrightness ?? this._markBrightness
      this._markMediaThreshold = s?.markMediaThreshold ?? this._markMediaThreshold
      this._markMediaGain      = s?.markMediaGain ?? this._markMediaGain
      this._webThreshold       = s?.webThreshold ?? this._webThreshold
      this._mediaThreshold     = s?.mediaThreshold ?? this._mediaThreshold
      this._transGain          = s?.transGain ?? this._transGain
      this._transBrightness    = s?.transBrightness ?? this._transBrightness
      this._ribbonGain         = s?.ribbonGain ?? this._ribbonGain
      this._ribbonThreshold    = s?.ribbonThreshold ?? this._ribbonThreshold
      this._ribbonBrightness   = s?.ribbonBrightness ?? this._ribbonBrightness
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
