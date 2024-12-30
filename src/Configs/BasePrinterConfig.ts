import { MediaMediaGapDetectionMode, MediaPrintMode, PrintOrientation, PrintSpeed, PrintSpeedSettings, SpeedTable, ThermalPrintMode, type BackfeedAfterTaken, type Coordinate, type DarknessPercent, type FeedButtonMode, type IPrinterHardware, type IPrinterMedia, type IPrinterSettings } from "./ConfigurationTypes.js";

/** Configured options for a printer */
export abstract class BasePrinterConfig implements IPrinterHardware, IPrinterSettings, IPrinterMedia {

  // Read-only printer config info
  protected _serial = 'no_serial_nm';
  get serialNumber() { return this._serial; }

  protected _model = 'Unknown Model';
  get model() { return this._model; }

  protected _manufacturer = 'Unknown Manufacturer';
  get manufacturer() { return this._manufacturer; }

  protected _dpi = 203;
  get dpi() { return this._dpi; }

  protected _firmware = '';
  get firmware() { return this._firmware; }

  protected _speed = new PrintSpeedSettings(PrintSpeed.unknown);
  get speed() { return this._speed; }

  protected _speedTable = new SpeedTable();
  get speedTable() { return this._speedTable; }

  protected _darkness: DarknessPercent = 50;
  get darknessPercent() { return this._darkness; }

  protected _backfeedAfterTaken: BackfeedAfterTaken = '90';
  get backfeedAfterTaken() { return this._backfeedAfterTaken; }

  protected _feedButtonMode: FeedButtonMode = 'feedBlank';
  get feedButtonMode() { return this._feedButtonMode; }

  protected _maxMediaDarkness = 15;
  get maxMediaDarkness() { return this._maxMediaDarkness; }

  protected _thermalPrintMode = ThermalPrintMode.direct;
  get thermalPrintMode() { return this._thermalPrintMode; }

  protected _mediaPrintMode = MediaPrintMode.tearOff;
  get mediaPrintMode() { return this._mediaPrintMode; }

  public mediaDimensionRoundingStep = 0.25;

  protected _printOrientation = PrintOrientation.normal;
  get printOrientation() { return this._printOrientation; }

  protected _mediaGapDetectMode = MediaMediaGapDetectionMode.webSensing;
  get mediaGapDetectMode() { return this._mediaGapDetectMode; }

  protected _mediaPrintOriginOffsetDots: Coordinate = { left: 0, top: 0}
  get mediaPrintOriginOffsetDots() { return this._mediaPrintOriginOffsetDots; }

  protected _mediaGapDots = 0;
  get mediaGapDots() { return this._mediaGapDots; }
  get mediaGapInches() { return this.dotToInch(this._mediaGapDots); }

  protected _mediaLineOffsetDots = 0;
  get mediaLineOffsetDots() { return this._mediaLineOffsetDots; }
  get mediaLineOffsetInches() { return this.dotToInch(this.mediaLineOffsetDots); }

  protected _mediaWidthDots = 100;
  get mediaWidthDots() { return this._mediaWidthDots; }
  get mediaWidthInches() { return this.dotToInch(this.mediaWidthDots); }
  protected _maxMediaWidthDots = 200;
  get maxMediaWidthDots() { return this._maxMediaWidthDots; }

  protected _mediaLengthDots = 100;
  get mediaLengthDots() { return this._mediaLengthDots; }
  get mediaLengthInches() { return this.dotToInch(this.mediaLengthDots); }
  protected _maxMediaLengthDots = 200;
  get maxMediaLengthDots() { return this._maxMediaLengthDots; }

  public constructor() {}

  protected dotToInch(dots?: number) {
    if (dots === undefined || this.dpi === undefined) { return 0; }
    return Math.round((dots / this.dpi) * 100 + Number.EPSILON) / 100;
  }
}
