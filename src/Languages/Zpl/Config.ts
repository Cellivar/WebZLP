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

export type NetworkIpResolutionMode
  = 'ALL'
  | 'BOOTP'
  | 'DHCP_AND_BOOTP'
  | 'DHCP'
  | 'GLEANING'
  | 'RARP'
  | 'PERMANENT';

export type NetworkInterface
  = 'ExternalWired'
  | 'InternalWired'
  | 'Wireless';

/** ZPL-specific config information about a printer. */
export interface IZplPrinterSettings extends SensorLevels {
  /** The action the printer takes on power up. */
  actionPowerUp: PowerUpAction;

  /** The action the printer takes when the head is closed. */
  actionHeadClose: PowerUpAction;

  ipResolutionMode?: NetworkIpResolutionMode;

  ipAddress?: string | undefined;

  subnetMask?: string | undefined;

  defaultGateway?: string | undefined;
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

  // Networking, if hardware is present
  private _ipResolutionMode?: NetworkIpResolutionMode = undefined;
  public get ipResolutionMode(): NetworkIpResolutionMode | undefined {
    return this._ipResolutionMode;
  }
  private _ipAddress?: string; // TODO: Real types
  public get ipAddress(): string | undefined {
    return this._ipAddress;
  }
  private _subnetMask?: string;
  public get subnetMask(): string | undefined {
    return this._subnetMask;
  }
  private _defaultGateway?: string;
  public get defaultGateway(): string | undefined {
    return this._defaultGateway;
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

      this._ipAddress        = s?.ipAddress ?? this._ipAddress;
      this._subnetMask       = s?.subnetMask ?? this._subnetMask;
      this._defaultGateway   = s?.defaultGateway ?? this._defaultGateway;
      this._ipResolutionMode = s?.ipResolutionMode ?? this._ipResolutionMode;
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
