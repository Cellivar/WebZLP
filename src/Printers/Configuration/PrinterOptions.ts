import type { IDeviceInformation } from 'web-device-mux';
import { PrinterCommandLanguage } from '../../Languages/index.js';
import { deviceInfoToOptionsUpdate, type ISettingUpdateMessage } from '../../Languages/Messages.js';
import { SpeedTable } from '../Models/PrinterModel.js';
export * from './SerialPortSettings.js';
import * as Media from './MediaOptions.js';
export * from './MediaOptions.js';

/** Hardware information about the printer that can't be modified. */
export interface IPrinterFactoryInformation {
  /** The raw serial number of the printer. */
  get serialNumber(): string;
  /** The model of the printer. */
  get model(): string;
  /** The manufacturer of the printer */
  get manufacturer(): string;
  /** The firmware version information for the printer. */
  get firmware(): string;
  /** The command languages the printer supports. */
  get language(): PrinterCommandLanguage;
  /** Gets the map of speeds this printer supports. */
  get speedTable(): SpeedTable;
}

/** Configured options for a label printer */
export class PrinterOptions implements IPrinterFactoryInformation, Media.IPrinterLabelMediaOptions {
  // Read-only printer config info
  private _serial = 'no_serial_nm';
  get serialNumber() { return this._serial; }

  private _model = 'Unknown Model';
  get model() { return this._model; }

  private _manufacturer = 'Unknown Manufacturer';
  get manufacturer() { return this._manufacturer; }

  private _dpi?: number;
  get labelDpi() { return this._dpi ?? 103; }

  private _firmware = '';
  get firmware() { return this._firmware; }

  private _language = PrinterCommandLanguage.none;
  get language() { return this._language; }

  public labelDimensionRoundingStep = 0.25;

  private _speed = new Media.PrintSpeedSettings(Media.PrintSpeed.unknown);
  get speed() { return this._speed; }

  private _speedTable = new SpeedTable();
  get speedTable() { return this._speedTable; }

  private _darkness: Media.DarknessPercent = 50;
  get darknessPercent() { return this._darkness; }

  private _thermalPrintMode = Media.ThermalPrintMode.direct;
  get thermalPrintMode() { return this._thermalPrintMode; }

  private _mediaPrintMode = Media.MediaPrintMode.tearOff;
  get mediaPrintMode() { return this._mediaPrintMode; }

  private _printOrientation = Media.PrintOrientation.normal;
  get printOrientation() { return this._printOrientation; }

  private _labelGapDetectMode = Media.LabelMediaGapDetectionMode.webSensing;
  get labelGapDetectMode() { return this._labelGapDetectMode; }

  private _labelPrintOriginOffsetDots: Media.Coordinate = { left: 0, top: 0}
  get labelPrintOriginOffsetDots() { return this._labelPrintOriginOffsetDots; }

  private _labelGapDots = 0;
  get labelGapDots() { return this._labelGapDots; }
  get labelGapInches() { return this.dotToInch(this._labelGapDots); }

  private _labelLineOffsetDots = 0;
  get labelLineOffsetDots() { return this._labelLineOffsetDots; }
  get labelLineOffsetInches() { return this.dotToInch(this.labelLineOffsetDots); }

  private _labelWidthDots = 100;
  get labelWidthDots() { return this._labelWidthDots; }
  get labelWidthInches() { return this.dotToInch(this.labelWidthDots); }

  private _labelHeightDots = 100;
  get labelHeightDots() { return this._labelHeightDots; }
  get labelHeightInches() { return this.dotToInch(this.labelHeightDots); }

  public copy(): PrinterOptions {
    return structuredClone(this);
  }

  /** Update these options with newly transmitted settings. */
  public update(msg: ISettingUpdateMessage) {
    this._model        = msg.modelName        ?? this._model;
    this._manufacturer = msg.manufacturerName ?? this._manufacturer;
    this._serial       = msg.serialNumber     ?? this._serial;
  }

  public updateDeviceInfo(deviceInfo: IDeviceInformation) {
    this.update(deviceInfoToOptionsUpdate(deviceInfo));
  }

  private dotToInch(dots?: number) {
    if (dots === undefined || this.labelDpi === undefined) { return 0; }
    return Math.round((dots / this.labelDpi) * 100 + Number.EPSILON) / 100;
  }
}
