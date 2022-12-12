import { IPrinterModelInfo, UnknownPrinter } from '../Models/PrinterModel';
import * as Serial from './SerialPortSettings';
export * from './SerialPortSettings';
import * as Media from './MediaOptions';
export * from './MediaOptions';

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

    speed: Media.PrintSpeedSettings;

    darknessPercent: Media.DarknessPercent;
    thermalPrintMode: Media.ThermalPrintMode;
    mediaPrintMode: Media.MediaPrintMode;
    printOrientation: Media.PrintOrientation;
    labelGapDetectMode: Media.LabelMediaGapDetectionMode;
    labelPrintOriginOffsetDots: Media.Coordinate;

    labelGapDots: number;
    get labelGapInches() {
        return this.dotToInch(this.labelGapDots);
    }

    labelWidthDots: number;
    get labelWidthInches() {
        return this.dotToInch(this.labelWidthDots);
    }
    labelHeightDots: number;
    get labelHeightInches() {
        return this.dotToInch(this.labelHeightDots);
    }

    constructor(serialNumber: string, model: IPrinterModelInfo, firmware: string, valid = true) {
        this._serialNum = serialNumber;
        this._model = model;
        this._firmware = firmware;
        this._valid = valid;
    }

    /** Get a default invalid config. */
    public static invalid() {
        return new PrinterOptions('', new UnknownPrinter(), '', false);
    }

    private dotToInch(dots: number) {
        return Math.round((dots / this.model.dpi) * 100 + Number.EPSILON) / 100;
    }

    public copy(): PrinterOptions {
        const copy = new PrinterOptions(this.serialNumber, this.model, this.firmware, this.valid);
        copy.printOrientation = this.printOrientation;
        copy.speed = this.speed;
        copy.darknessPercent = this.darknessPercent;
        copy.thermalPrintMode = this.thermalPrintMode;
        copy.mediaPrintMode = this.mediaPrintMode;
        copy.labelGapDetectMode = this.labelGapDetectMode;
        copy.labelPrintOriginOffsetDots = this.labelPrintOriginOffsetDots;
        copy.labelGapDots = this.labelGapDots;
        copy.labelWidthDots = this.labelWidthDots;
        copy.labelHeightDots = this.labelHeightDots;

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
