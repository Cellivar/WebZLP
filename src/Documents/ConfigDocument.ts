import * as Commands from './Commands.js';
import { IDocument, DocumentBuilder } from './Document.js';
import * as Options from '../Printers/Configuration/PrinterOptions.js';
import { WebZlpError } from '../WebZlpError.js';

/** A series of printer commands that results in configuration changes. */
export interface IConfigDocumentBuilder
    extends DocumentBuilder<IConfigDocumentBuilder>,
        IPrinterBasicCommandBuilder,
        IPrinterConfigBuilder,
        IPrinterLabelConfigBuilder {}

/** Builder to generate a configuration to apply to a printer. */
export class ConfigDocumentBuilder
    extends DocumentBuilder<IConfigDocumentBuilder>
    implements IConfigDocumentBuilder
{
    get commandReorderBehavior() {
        return Commands.CommandReorderBehavior.nonFormCommandsAfterForms;
    }

    constructor(config: Options.PrinterOptions) {
        super(config);
    }

    // The config document appends an additional command to the end of the document
    // to commit the changes to stored memory. EPL does this automatically, ZPL does not
    // so to bring them closer to parity this is automatically implied.
    // TODO: Consider whether this should move to a ZPL extended command.
    finalize() {
        this.andThen(new Commands.SaveCurrentConfigurationCommand());
        return super.finalize();
    }

    ///////////////////// GENERAL LABEL HANDLING

    clearImageBuffer(): IConfigDocumentBuilder {
        return this.andThen(new Commands.ClearImageBufferCommand());
    }

    rebootPrinter(): IDocument {
        return this.andThen(new Commands.RebootPrinterCommand()).finalize();
    }

    ///////////////////// CONFIG READING

    queryConfiguration(): IConfigDocumentBuilder {
        return this.andThen(new Commands.QueryConfigurationCommand());
    }

    printConfiguration(): IDocument {
        return this.andThen(new Commands.PrintConfigurationCommand()).finalize();
    }

    ///////////////////// ALTER PRINTER CONFIG

    setDarknessConfig(darknessPercent: Options.DarknessPercent) {
        return this.andThen(
            new Commands.SetDarknessCommand(darknessPercent, this._config.model.maxDarkness)
        );
    }

    setPrintDirection(upsideDown = false) {
        return this.andThen(new Commands.SetPrintDirectionCommand(upsideDown));
    }

    setPrintSpeed(speed: Options.PrintSpeed, mediaSlewSpeed = Options.PrintSpeed.ipsAuto) {
        if (!this._config.model.isSpeedValid(speed)) {
            throw new UnsupportedPrinterConfigError(
                'setPrintSpeed',
                `Print speed ${Options.PrintSpeed[speed]} is not valid for model ${this._config.model.model}`
            );
        }
        if (mediaSlewSpeed && !this._config.model.isSpeedValid(mediaSlewSpeed)) {
            throw new UnsupportedPrinterConfigError(
                'setPrintSpeed',
                `Media slew speed ${Options.PrintSpeed[speed]} is not valid for model ${this._config.model.model}`
            );
        }

        // If the media slew speed is auto just copy the print speed.
        if (mediaSlewSpeed === Options.PrintSpeed.ipsAuto) {
            mediaSlewSpeed = speed;
        }
        return this.andThen(
            new Commands.SetPrintSpeedCommand(
                speed,
                this._config.model.getSpeedValue(speed),
                mediaSlewSpeed,
                this._config.model.getSpeedValue(mediaSlewSpeed)
            )
        );
    }

    ///////////////////// ALTER LABEL CONFIG

    autosenseLabelLength() {
        return this.andThen(new Commands.AutosenseLabelDimensionsCommand()).finalize();
    }

    setLabelDimensions(widthInInches: number, heightInInches?: number, gapLengthInInches?: number) {
        const dpi = this._config.model.dpi;
        return this.setLabelDimensionsDots(
            widthInInches * dpi,
            heightInInches ? heightInInches * dpi : null,
            gapLengthInInches ? gapLengthInInches * dpi : null
        );
    }

    setLabelDimensionsDots(widthInDots: number, heightInDots?: number, gapLengthInDots?: number) {
        return this.andThen(
            new Commands.SetLabelDimensionsCommand(widthInDots, heightInDots, gapLengthInDots)
        );
    }

    setLabelHomeOffsetDots(horizontalOffsetInDots: number, verticalOffsetInDots: number) {
        return this.andThen(
            new Commands.SetLabelHomeCommand(horizontalOffsetInDots, verticalOffsetInDots)
        );
    }

    setLabelPrintOriginOffsetCommand(horizontalOffsetInDots: number, verticalOffsetInDots: number) {
        return this.andThen(
            new Commands.SetLabelPrintOriginOffsetCommand(
                horizontalOffsetInDots,
                verticalOffsetInDots
            )
        );
    }

    setLabelMediaToContinuous(labelHeightInInches: number): IConfigDocumentBuilder {
        const dpi = this._config.model.dpi;
        return this.andThen(
            new Commands.SetLabelToContinuousMediaCommand(dpi * labelHeightInInches)
        );
    }

    setLabelMediaToWebGapSense(
        labelHeightInInches: number,
        labelGapInInches: number
    ): IConfigDocumentBuilder {
        const dpi = this._config.model.dpi;
        return this.andThen(
            new Commands.SetLabelToWebGapMediaCommand(
                labelHeightInInches * dpi,
                labelGapInInches * dpi
            )
        );
    }

    setLabelMediaToMarkSense(
        labelLengthInInches: number,
        blackLineThicknessInInches: number,
        blackLineOffsetInInches: number
    ): IConfigDocumentBuilder {
        const dpi = this._config.model.dpi;
        return this.andThen(
            new Commands.SetLabelToMarkMediaCommand(
                labelLengthInInches * dpi,
                blackLineThicknessInInches * dpi,
                blackLineOffsetInInches * dpi
            )
        );
    }
}

export interface IPrinterBasicCommandBuilder {
    /** Clear the image buffer and prepare for a new set of commands. */
    clearImageBuffer(): IConfigDocumentBuilder;

    /** Simulate turning the printer off and back on. Must be the final command. */
    rebootPrinter(): IDocument;
}

export interface IPrinterConfigBuilder {
    /** Query the printer for its config details. */
    queryConfiguration(): IConfigDocumentBuilder;

    /** Print the configuration directly on labels. Must be final command. */
    printConfiguration(): IDocument;
}

export interface IPrinterLabelConfigBuilder {
    /** Set the darkness of the printer in the stored configuration. */
    setDarknessConfig(darknessPercent: Options.DarknessPercent): IConfigDocumentBuilder;

    /** Set the direction labels print out of the printer. */
    setPrintDirection(upsideDown?: boolean): IConfigDocumentBuilder;

    /** Set the speed at which the labels print. */
    setPrintSpeed(speed: Options.PrintSpeed): IConfigDocumentBuilder;

    /**
     * Set the size of the labels in the printer.
     *
     * Omit height and gap if an autosense was or will be run. Both must be provided
     * to set the length and gap manually, otherwise the length will be ignored. This
     * is usually only necessary when using continuous media, see the documentation.
     *
     * Note that different printers often have slightly different values, copying
     * values between printers may have unintended effects.
     */
    setLabelDimensions(
        widthInInches: number,
        heightInInches?: number,
        gapLengthInInches?: number
    ): IConfigDocumentBuilder;

    /**
     * Set the size of the labels in the printer, sized in dots. Dots are printer DPI specific.
     *
     * Omit height and gap if an autosense was or will be run. Both must be provided
     * to set the length and gap manually, otherwise the length will be ignored. This
     * is usually only necessary when using continuous media, see the documentation.
     *
     * Note that different printers often have slightly different values, copying
     * values between printers may have unintended effects.
     */
    setLabelDimensionsDots(
        widthInDots: number,
        heightInDots?: number,
        gapLengthInDots?: number
    ): IConfigDocumentBuilder;

    /**
     * Sets the temporary origin offset from the top-left of the label that all
     * other offsets are calculated from. Only applies to current label.
     *
     * Use this to fine-tune the alignment of your printer to your label stock.
     *
     * Avoid printing off the edges of a label, which can cause excessive head wear.
     */
    setLabelHomeOffsetDots(
        horizontalOffsetInDots: number,
        verticalOffsetInDots: number
    ): IConfigDocumentBuilder;

    /** Sets the retained origin offset from the top-left of the label that all
     * other offets are calculated from. Applies to all labels until a printer reset
     * or power cycle.
     *
     * May or may not be stored depending on printer firmware.
     *
     * Avoid printing off the edges of a label, which can cause excessive head wear.
     */
    setLabelPrintOriginOffsetCommand(
        horizontalOffsetInDots: number,
        verticalOffsetInDots: number
    ): IConfigDocumentBuilder;

    /** Run the autosense operation to get label length. Must be last command. */
    autosenseLabelLength(): IDocument;

    /** Sets the media type to continuous (gapless) media. */
    setLabelMediaToContinuous(labelLengthInDots: number): IConfigDocumentBuilder;

    /** Sets the media type to web gap sensing media. It's recommended to run autosense after this. */
    setLabelMediaToWebGapSense(
        labelLengthInDots: number,
        labelGapInDots: number
    ): IConfigDocumentBuilder;

    /** Sets the media type to mark sensing media. */
    setLabelMediaToMarkSense(
        labelLengthInDots: number,
        blackLineThicknessInDots: number,
        blackLineOffset: number
    ): IConfigDocumentBuilder;
}

/** Error indicating setting a config value failed. */
export class UnsupportedPrinterConfigError extends WebZlpError {
    constructor(settingName: string, settingError: string) {
        super(`Error setting ${settingName}: ${settingError}`);
        this.name = this.constructor.name;
        this.settingName = settingName;
        this.settingError = settingError;
    }

    settingName: string;
    settingError: string;
}
