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
export function detectModel(rawModelId: string): PrinterModel {
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
