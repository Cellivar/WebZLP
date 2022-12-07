import { match } from 'ts-pattern';
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

export class PrinterModelDb {
    /** Determine a printer model based on the printer-reported model. */
    public static getModel(rawModelId: string): PrinterModel {
        if (rawModelId == null) {
            return PrinterModel.unknown;
        }
        // Easy mode: if it ends in FDX it's a fedex LP2844
        if (rawModelId.endsWith('FDX')) {
            return PrinterModel.lp2844fedex;
        }

        // Hard mode: Model correlation between observed values and output.
        // This is pretty much all based off of observed values, I can't find a mapping
        // of the config's model number vs the hardware model number.
        return match<string, PrinterModel>(rawModelId)
            .with('UKQ1935HLU', () => PrinterModel.lp2844)
            .with('UKQ1935HMU', () => {
                // HMU units that do not have FDX in the version string appear to be UPS
                // units. Maybe. Mostly. It's not clear.
                return PrinterModel.lp2844ups;
            })
            .with('LP2844-Z-200dpi', () => PrinterModel.lp2844z)
            .otherwise(() => PrinterModel.unknown);
    }

    /** Look up the model information for a given printer model. */
    public static getModelInfo(model: PrinterModel): BasicPrinterInfo {
        return match(model)
            .with(PrinterModel.lp2824, () => new LP2824())
            .with(PrinterModel.lp2844, () => new LP2844())
            .with(PrinterModel.lp2844fedex, () => new LP2844())
            .with(PrinterModel.lp2844ups, () => new LP2844())
            .otherwise(() => new UnknownPrinter());
        // TODO: Switch to this once I have a better way of handling switches..
        // .exhaustive();
    }

    public static guessLanguageFromModelHint(modelHint?: string): PrinterCommandLanguage {
        if (!modelHint) {
            return PrinterCommandLanguage.none;
        }

        // ZPL printers tend to be more trustworthy. They will follow a more standard
        // format.
        switch (true) {
            // LP2844
            // ZTC LP2844-Z-200dpi
            case /\sLP2844-Z-200dpi/gim.test(modelHint):
                return PrinterCommandLanguage.zplEmulateEpl;
            default:
                return PrinterCommandLanguage.none;
        }

        // EPL printers are all over the place. They range from blank to straight up lies.
        // I have an LP 2844 that claims to be a TPL2844 (it is not).
        // I have a FedEx unit that is blank.
        // I have a UPS unit that says UPS. I have another one that doesn't.
        // EPL printer model hints are not to be trusted.

        // I don't have a CPCL printer to test and see what it might say. Someday I
        // may get my hands on one to test. If you'd like me to try one out contact me!
        // I'll be happy to discuss sending one to me to test and implement then send back.
    }
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

export abstract class BasicPrinterInfo implements IPrinterModelInfo {
    abstract get commandLanguage(): PrinterCommandLanguage;
    abstract get dpi(): number;
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
    abstract get speedTable(): ReadonlyMap<PrintSpeed, number>;
    abstract get maxDarkness(): number;

    public isSpeedValid(speed: PrintSpeed): boolean {
        return this.speedTable.has(speed);
    }

    public getSpeedValue(speed: PrintSpeed): number | undefined {
        const val = this.speedTable.get(speed) ?? this.speedTable[PrintSpeed.auto];
        console.log('Found speed ', val, 'for speed named', PrintSpeed[speed]);
        return val;
    }

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

export class UnknownPrinter extends BasicPrinterInfo {
    get commandLanguage(): PrinterCommandLanguage {
        return PrinterCommandLanguage.none;
    }
    get speedTable(): ReadonlyMap<PrintSpeed, number> {
        return null;
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

/** EPL printers have a lot in common. */
export abstract class EplPrinter extends BasicPrinterInfo {
    get commandLanguage(): PrinterCommandLanguage {
        return PrinterCommandLanguage.epl;
    }

    get maxDarkness(): number {
        return 15; // EPL max darkness
    }
}

/** 28XX model printers are mostly the same */
export abstract class LP28XX extends EplPrinter {
    get dpi(): number {
        return 203;
    }

    abstract get model(): PrinterModel;

    private _speedTable = new Map<PrintSpeed, number>([
        [PrintSpeed.auto, 3],
        [PrintSpeed.ipsPrinterMax, 4],
        [PrintSpeed.ipsPrinterMin, 1],
        [PrintSpeed.ips1_5, 1],
        [PrintSpeed.ips2, 2],
        [PrintSpeed.ips2_5, 3],
        [PrintSpeed.ips3_5, 4]
    ]);
    get speedTable(): ReadonlyMap<PrintSpeed, number> {
        return this._speedTable;
    }
}

export class LP2844 extends LP28XX {
    get model() {
        return PrinterModel.lp2824;
    }
}

export class LP2824 extends LP28XX {
    get model() {
        return PrinterModel.lp2824;
    }
}
