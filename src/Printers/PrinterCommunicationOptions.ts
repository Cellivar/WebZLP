import { PrinterCommandLanguage } from './Configuration/PrinterOptions.js';
import { CommandFormInclusionMode, TranspileCommandDelegate } from './Languages/PrinterCommandSet.js';

export class PrinterCommunicationOptions {
    /**
     * Value to use for rounding read-from-config label sizes.
     *
     * When reading the config from a printer the label width and height may be
     * variable. When you set the label width to 4 inches it's translated into
     * dots, and then the printer adds a calculated offset to that. This offset
     * is unique per printer (so far as I have observed) and introduces noise.
     * This value rounds the returned value to the nearest fraction of an inch.
     *
     * For example, with a rounding step of 0.25 (the default) if the printer
     * returns a width 4.113 it will be rounded to 4.0
     */
    public labelDimensionRoundingStep = 0.25;

    /**
     * Whether to display printer communication to the dev console
     */
    public debug = false;

    /**
     * Custom printer commands added to the base set for a given language.
     *
     * See the documentation for more details on how to implement this.
     */
    public additionalCustomCommands: Array<{
        commandType: symbol;
        applicableLanguages: PrinterCommandLanguage;
        transpileDelegate: TranspileCommandDelegate;
        commandInclusionMode: CommandFormInclusionMode;
    }> = null;
}
