export class PrinterCommunicationOptions {
    /**
     * Value to use for rounding read-from-config label sizes.
     *
     * When reading the config from a printer the label width and height may be
     * variable. When you set the label width to 4 inches it's translated into
     * dots, and then the printer adds a calculated offset to that. This offset
     * is unique per printer (so far as I have observed) and introduces noise.
     * This value rounds the returned value to the nearest fraction of an inch.
     * If the printer returns a width 4.113 it will be rounded to 4.0
     */
    public LabelDimensionRoundingStep = 0.25;

    /**
     * Whether to display printer communication to the dev console
     */
    public Debug = false;
}
