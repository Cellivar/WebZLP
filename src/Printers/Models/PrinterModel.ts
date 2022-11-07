import { PrinterCommandLanguage } from '../Configuration/PrinterOptions';

export enum PrinterModel {
    unknown = 0,
    lp2824,
    lp2824z,
    lp2844,
    lp2844ups,
    lp2844fedex,
    lp2844z,
    tlp2824,
    tlp2824z,
    tlp2844,
    tlp2844z
}

/** Determine a printer model based on the printer-reported model */
export function getModel(rawModelId: string): PrinterModel {
    // Easy mode: if it ends in FDX it's a fedex LP2844
    if (rawModelId.endsWith('FDX')) {
        return PrinterModel.lp2844fedex;
    }

    return PrinterModel.unknown;
}

export class PrinterModelInfo {
    public get model(): PrinterModel {
        return PrinterModel.unknown;
    }
}

export function guessLanguageFromModelHint(modelHint?: string): PrinterCommandLanguage {
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
