import { ConfigDocumentBuilder } from '../Documents/ConfigDocument.js';
import { LabelDocumentBuilder } from '../Documents/LabelDocument.js';
import { Printer } from '../Printers/Printer.js';
import { DarknessPercent, PrintSpeed } from '../Printers/Configuration/PrinterOptions.js';

/** Collection of handy documents ready to go. */
export class ReadyToPrintDocuments {
    private static readonly printerGetConfigDoc = new ConfigDocumentBuilder(null)
        .queryConfiguration()
        .finalize();
    /** A command document to query the printer for configuration. */
    static get configDocument() {
        return this.printerGetConfigDoc;
    }

    /* eslint-disable prettier/prettier */
    private static readonly printerPrintConfigDoc = new ConfigDocumentBuilder(null)
        .printConfiguration();
    /* eslint-enable prettier/prettier */
    /** A command document to make the printer print its configuration. */
    static get printConfigDocument() {
        return this.printerPrintConfigDoc;
    }

    private static readonly feedLabelDoc = new LabelDocumentBuilder(null).addPrintCmd(1).finalize();
    /** A label document to feed a single label. */
    static get feedLabelDocument() {
        return this.feedLabelDoc;
    }

    /**
     * Print a test pattern that looks like
     *
     * ████████████
     *
     * ███
     *    ███
     *       ███
     *          ███
     *
     * ////////////
     *
     * Needs to know the width to adjust the pattern.
     */
    static printTestLabelDocument(labelWidthInDots: number) {
        const label = new LabelDocumentBuilder(null);
        const labelWidth = labelWidthInDots;
        const quarter = labelWidth / 4;
        const lineHeight = 20;

        // Blocks
        label
            .resetOffset()
            .addLine(labelWidth, lineHeight * 2)
            .setOffset(0, lineHeight * 2)
            .addLine(quarter, lineHeight)
            .setOffset(quarter, lineHeight * 3)
            .addLine(quarter, lineHeight)
            .setOffset(quarter * 2, lineHeight * 4)
            .addLine(quarter, lineHeight)
            .setOffset(quarter * 3, lineHeight * 5)
            .addLine(quarter, lineHeight)
            .setOffset(0, lineHeight * 6);

        // Lines
        const slashStart = lineHeight * 6 + 5;
        const slashHeight = 8;
        for (let i = 0; i <= labelWidth; i += 4) {
            label
                .setOffset(i + 0, slashStart + 0)
                .addLine(1, slashHeight)
                .setOffset(i + 1, slashStart + slashHeight)
                .addLine(1, slashHeight)
                .setOffset(i + 2, slashStart + slashHeight * 2)
                .addLine(1, slashHeight)
                .setOffset(i + 3, slashStart + slashHeight * 3)
                .addLine(1, slashHeight);
        }
        return label.addPrintCmd().finalize();
    }

    /** Combine the common label settings into one config document. */
    static configLabelSettings(
        printer: Printer,
        labelWidthInches: number,
        darknessPercent: DarknessPercent
    ) {
        return printer
            .getConfigDocument()
            .setPrintDirection()
            .setPrintSpeed(PrintSpeed.ipsAuto)
            .setDarknessConfig(darknessPercent)
            .setLabelDimensions(labelWidthInches)
            .autosenseLabelLength();
    }
}
