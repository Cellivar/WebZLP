import { type IPrinterModelInfo, UnknownPrinter } from '../Models/PrinterModel.js';
export * from './SerialPortSettings.js';
import * as Media from './MediaOptions.js';
export * from './MediaOptions.js';

/** Firmware information about the printer that can't be modified. */
export interface IPrinterFactoryInformation {
  /** The raw serial number of the printer. */
  get serialNumber(): string;
  /** The model of the printer. */
  get model(): IPrinterModelInfo;
  /** The firmware version information for the printer. */
  get firmware(): string;
  /** The command languages the printer supports. */
  get language(): PrinterCommandLanguage;
}

/** Configured options for a label printer */
export class PrinterOptions implements IPrinterFactoryInformation, Media.IPrinterLabelMediaOptions {
  // Read-only printer config info
  private _serialNum: string;
  get serialNumber(): string {
    return this._serialNum;
  }
  private _model: IPrinterModelInfo;
  get model(): IPrinterModelInfo {
    return this._model;
  }

  get labelDpi(): number {
    return this._model.dpi;
  }

  private _firmware: string;
  get firmware(): string {
    return this._firmware;
  }

  get language(): PrinterCommandLanguage {
    return this._model.commandLanguage;
  }

  private _valid: boolean;
  get valid(): boolean {
    return this._valid;
  }

  public labelDimensionRoundingStep = 0.25;

  speed: Media.PrintSpeedSettings = new Media.PrintSpeedSettings(Media.PrintSpeed.unknown);
  darknessPercent: Media.DarknessPercent = 50;
  thermalPrintMode = Media.ThermalPrintMode.direct;
  mediaPrintMode = Media.MediaPrintMode.tearOff;
  printOrientation = Media.PrintOrientation.normal;
  labelGapDetectMode = Media.LabelMediaGapDetectionMode.webSensing;
  labelPrintOriginOffsetDots: Media.Coordinate = { left: 0, top: 0 };

  labelGapDots: number = 0;
  get labelGapInches() {
    return this.dotToInch(this.labelGapDots);
  }

  labelLineOffsetDots: number = 0;
  get labelLineOffsetInches() {
    return this.dotToInch(this.labelLineOffsetDots);
  }

  labelWidthDots: number = 100;
  get labelWidthInches() {
    return this.dotToInch(this.labelWidthDots);
  }
  labelHeightDots: number = 100;
  get labelHeightInches() {
    return this.dotToInch(this.labelHeightDots);
  }

  constructor(
    serialNumber: string,
    model: IPrinterModelInfo,
    firmware: string,
    valid = true
  ) {
    this._serialNum = serialNumber;
    this._model = model;
    this._firmware = firmware;
    this._valid = valid;
  }

  /** Get a default invalid config. */
  public static readonly invalid = new PrinterOptions('', new UnknownPrinter(), '', false);

  private dotToInch(dots?: number) {
    if (dots === undefined || this.model.dpi === undefined) { return 0; }
    return Math.round((dots / this.model.dpi) * 100 + Number.EPSILON) / 100;
  }

  public copy(): PrinterOptions {
    const copy = new PrinterOptions(this.serialNumber, this.model, this.firmware, this.valid);
    copy.printOrientation           = this.printOrientation;
    copy.speed                      = this.speed;
    copy.darknessPercent            = this.darknessPercent;
    copy.thermalPrintMode           = this.thermalPrintMode;
    copy.mediaPrintMode             = this.mediaPrintMode;
    copy.labelGapDetectMode         = this.labelGapDetectMode;
    copy.labelPrintOriginOffsetDots = this.labelPrintOriginOffsetDots;
    copy.labelGapDots               = this.labelGapDots;
    copy.labelWidthDots             = this.labelWidthDots;
    copy.labelHeightDots            = this.labelHeightDots;

    return copy;
  }
}

// [flags] I miss C#.
/** Command languages a printer could support. One printer may support multiple. */
export enum PrinterCommandLanguage {
  /** Error condition indicating autodetect failed. */
  none = 0,
  /** Printer can be set to EPL mode. */
  epl = 1 << 0,
  /** Printer can be set to ZPL mode. */
  zpl = 1 << 1,
  /** Printer can be set to CPCL mode. */
  cpcl = 1 << 2,

  /** Printer is capable of switching between EPL and ZPL. */
  zplEmulateEpl = epl | zpl,
  /** Printer is CPCL native and can emulate EPL and ZPL. */
  cpclEmulateBoth = cpcl | epl | zpl
}
