import { WebZlpError } from '../../WebZlpError';
import { PrinterCommandLanguage, PrintSpeed } from '../Configuration/PrinterOptions';

export enum PrinterModel {
    unknown = 'unknown',
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

export interface IPrinterModelInfo {
    /** Gets the command language for this printer. */
    get commandLanguage(): PrinterCommandLanguage;

    /** Gets the DPI of this printer. */
    get dpi(): number;

    /** Gets the model of this printer. */
    get model(): PrinterModel;

    /** Gets the map of speeds this printer supports. */
    get speedTable(): ReadonlyMap<PrintSpeed, number>;

    /** Gets the max value of the darkness, to map to a percent. */
    get maxDarkness(): number;

    /** Determine if a given speed will work with this model. */
    isSpeedValid(speed: PrintSpeed): boolean;

    /** Get the raw value this model understands as the speed. */
    getSpeedValue(speed: PrintSpeed): number | undefined;

    /** Get a print speed for this printer for  */
    fromRawSpeed(rawSpeed: number): PrintSpeed;
}

export abstract class BasePrinterInfo implements IPrinterModelInfo {
    /** Gets the command language for this printer. */
    abstract get commandLanguage(): PrinterCommandLanguage;
    /** Gets the DPI of this printer. */
    abstract get dpi(): number;
    /** Gets the model of this printer. */
    abstract get model(): PrinterModel;

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
    /** Gets the map of speeds this printer supports. */
    abstract get speedTable(): ReadonlyMap<PrintSpeed, number>;
    /** Gets the max value of the darkness, to map to a percent. */
    abstract get maxDarkness(): number;

    /** Determine if a given speed will work with this model. */
    public isSpeedValid(speed: PrintSpeed): boolean {
        return this.speedTable.has(speed);
    }

    /** Get the raw value this model understands as the speed. */
    public getSpeedValue(speed: PrintSpeed): number | undefined {
        const val = this.speedTable.get(speed) ?? this.speedTable[PrintSpeed.auto];
        console.log('Found speed ', val, 'for speed named', PrintSpeed[speed]);
        return val;
    }

    /** Get a print speed for this printer for  */
    public fromRawSpeed(rawSpeed: number): PrintSpeed {
        for (const [key, val] of this.speedTable) {
            if (
                val === rawSpeed &&
                key != PrintSpeed.auto &&
                key != PrintSpeed.ipsPrinterMax &&
                key != PrintSpeed.ipsPrinterMin
            ) {
                return key;
            }
        }
        return PrintSpeed.auto;
    }
}

/** Class representing a printer that could not be identified. */
export class UnknownPrinter extends BasePrinterInfo {
    get commandLanguage(): PrinterCommandLanguage {
        return PrinterCommandLanguage.none;
    }
    get speedTable(): ReadonlyMap<PrintSpeed, number> {
        throw new WebZlpError('Unknown printer, cannot read metadata.');
    }
    get model(): PrinterModel {
        return PrinterModel.unknown;
    }
    get dpi(): number {
        throw new WebZlpError('Unknown printer, cannot read metadata.');
    }
    get maxDarkness(): number {
        throw new WebZlpError('Unknown printer, cannot read metadata.');
    }
}
