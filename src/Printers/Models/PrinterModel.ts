import { WebZlpError } from '../../WebZlpError.js';
import { PrintSpeed } from '../Configuration/PrinterOptions.js';
import { PrinterCommandLanguage } from '../Languages/index.js';

export enum PrinterModel {
  unknown = 'unknown',
  zplAutodetect = 'ZPL_AUTODETECT',
  lp2824 = 'LP2824',
  lp2824z = 'LP2824Z',
  lp2844 = 'LP2844',
  lp2844ups = 'LP2844UPS',
  lp2844fedex = 'LP2844FEDEX',
  lp2844z = 'LP2844Z',
  tlp2824 = 'TLP2824',
  tlp2824z = 'TLP2824Z',
  tlp2844 = 'TPL2844',
  tlp2844z = 'TPL2844Z'
}

/** Class for representing a printer's relationship between speeds and raw values */
export class SpeedTable {
  // Speed is determined by what the printer supports
  // EPL printers have a table that determines their setting and it needs to be hardcoded.
  // ZPL printers follow this pattern:
  // 1       =  25.4 mm/sec.  (1 inch/sec.)
  // A or 2  =  50.8 mm/sec.  (2 inches/sec.)
  // A is the default print and backfeed speed
  // B or 3  =  76.2 mm/sec.  (3 inches/sec.)
  // C or 4  =  101.6 mm/sec. (4 inches/sec.)
  // 5       =  127 mm/sec.   (5 inches/sec.)
  // D or 6  =  152.4 mm/sec. (6 inches/sec.)
  // D is the default media slew speed
  // 7       =  177.8 mm/sec. (7 inches/sec.)
  // E or 8  =  203.2 mm/sec. (8 inches/sec.)
  // 9       =  220.5 mm/sec. (9 inches/sec.)
  // 10      =  245 mm/sec.   (10 inches/sec.)
  // 11      =  269.5 mm/sec. (11 inches/sec.)
  // 12      =  304.8 mm/sec. (12 inches/sec.)
  // 13      =  13 in/sec
  // 14      =  14 in/sec
  // This gets encoded into the speed table.
  // Every speed table should also have entries for ipsPrinterMin, ipsPrinterMax, and auto.
  // These should be duplicate entries of real values in the speed table so that
  // we have sane defaults for commands to default to.
  constructor(
    private readonly speedTable: Map<PrintSpeed, number> = new Map<PrintSpeed, number>()
  ) {}

  // My kingdom for extension methods on enums in a reasonable manner.
  /** Look up a speed enum value from a given whole number */
  public static getSpeedFromWholeNumber(speed: number): PrintSpeed {
    switch (speed) {
      default: return PrintSpeed.unknown;
      case 0:  return PrintSpeed.ipsAuto;
      case 1:  return PrintSpeed.ips1;
      case 2:  return PrintSpeed.ips2;
      case 3:  return PrintSpeed.ips3;
      case 4:  return PrintSpeed.ips4;
      case 5:  return PrintSpeed.ips5;
      case 6:  return PrintSpeed.ips6;
      case 7:  return PrintSpeed.ips7;
      case 8:  return PrintSpeed.ips8;
      case 9:  return PrintSpeed.ips9;
      case 10: return PrintSpeed.ips10;
      case 11: return PrintSpeed.ips11;
      case 12: return PrintSpeed.ips12;
      case 13: return PrintSpeed.ips13;
      case 14: return PrintSpeed.ips14;
    }
  }

  /** Determine if a given speed will work with this model. */
  isValid(speed: PrintSpeed): boolean {
    return this.speedTable.has(speed);
  }

  /** Get a raw value to send to the printer for a speed. */
  toRawSpeed(speed: PrintSpeed): number {
    const val = this.speedTable.get(speed) ?? this.speedTable.get(PrintSpeed.ipsAuto);
    return val ?? 0;
  }

  /** Get a speed value from the raw value sent by the printer. Defaults to minimum if parse fails. */
  fromRawSpeed(rawSpeed?: number): PrintSpeed {
    for (const [key, val] of this.speedTable) {
      if (
        val === rawSpeed &&
        key != PrintSpeed.ipsAuto &&
        key != PrintSpeed.ipsPrinterMax &&
        key != PrintSpeed.ipsPrinterMin
      ) {
        return key;
      }
    }
    return PrintSpeed.ipsAuto;
  }
}

/** A detail entry listing a printer's hardware capabilities. */
export interface IPrinterModelDetails {
  /** The model name of the printer, as reported via the USB descriptor. */
  readonly model: string;

  /** The command languages the printer supports. */
  readonly commandLanguages: PrinterCommandLanguage

  /** The DPI of the printer. */
  readonly dpi: number;

  /** The speed table of supported speed. */
  readonly speedTable: SpeedTable;

  /** The maximum value for the darkness value. */
  readonly maxDarkness: number;

  /** The maximum print width, in dots. */
  readonly maxMediaWidthDots: number;

  /** The maximum print length, in dots. */
  readonly maxMediaLengthDots: number;
}

export interface IPrinterModelInfo {
  /** Gets the command language for this printer. */
  get commandLanguage(): PrinterCommandLanguage;

  /** Gets the DPI of this printer. */
  get dpi(): number;

  /** Gets the model of this printer. */
  get model():  string;

  /** Gets the map of speeds this printer supports. */
  get speedTable(): SpeedTable;

  /** Gets the max value of the darkness, to map to a percent. */
  get maxDarkness(): number;
}

export abstract class BasePrinterInfo implements IPrinterModelInfo {
  /** Gets the command language for this printer. */
  abstract get commandLanguage(): PrinterCommandLanguage;
  /** Gets the DPI of this printer. */
  abstract get dpi(): number;
  /** Gets the model of this printer. */
  abstract get model():  string;

  /** Gets the map of speeds this printer supports. */
  abstract get speedTable(): SpeedTable;
  /** Gets the max value of the darkness, to map to a percent. */
  abstract get maxDarkness(): number;
}

/** Class representing a printer that could not be identified. */
export class UnknownPrinter extends BasePrinterInfo {
  get commandLanguage(): PrinterCommandLanguage {
    return PrinterCommandLanguage.none;
  }
  get speedTable(): ReadonlyMap<PrintSpeed, number> {
    throw new WebZlpError('Unknown printer, cannot read metadata.');
  }
  get model(): string {
    return '';
  }
  get dpi(): number {
    throw new WebZlpError('Unknown printer, cannot read metadata.');
  }
  get maxDarkness(): number {
    throw new WebZlpError('Unknown printer, cannot read metadata.');
  }
}

/** A printer model object that was autodetected from the printer itself. */
export class AutodetectedPrinter extends BasePrinterInfo {
  get commandLanguage(): PrinterCommandLanguage {
    return this._commandLanugage;
  }
  get dpi(): number {
    return this._dpi;
  }
  get model(): PrinterModel | string {
    return this._model;
  }
  get speedTable(): ReadonlyMap<PrintSpeed, number> {
    return this._speedTable;
  }
  get maxDarkness(): number {
    return this._maxDarkness;
  }

  constructor(
    private _commandLanugage: PrinterCommandLanguage,
    private _dpi: number,
    private _model: PrinterModel | string,
    private _speedTable: ReadonlyMap<PrintSpeed, number>,
    private _maxDarkness: number
  ) {
    super();
  }
}
