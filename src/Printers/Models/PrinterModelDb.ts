import { PrinterModel } from './PrinterModel';
import { match } from 'ts-pattern';
import { PrinterCommandLanguage } from '../Configuration/PrinterOptions';
import * as EPL from './EplPrinterModels';
import { IPrinterModelInfo, UnknownPrinter } from './PrinterModel';

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
            .with('UKQ1915HLU', () => PrinterModel.lp2824)
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
    public static getModelInfo(model: PrinterModel): IPrinterModelInfo {
        return match(model)
            .with(PrinterModel.lp2824, () => new EPL.LP2824())
            .with(PrinterModel.lp2844, () => new EPL.LP2844())
            .with(PrinterModel.lp2844fedex, () => new EPL.LP2844())
            .with(PrinterModel.lp2844ups, () => new EPL.LP2844())
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
