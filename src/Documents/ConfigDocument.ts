import { DarknessPercent } from '../NumericRange';
import * as Commands from './Commands';
import { PrinterOptions, PrintSpeed } from '../Printers/Configuration/PrinterOptions';
import { WebZlpError } from '../WebZlpError';

/** A series of printer commands that results in configuration changes. */
export interface IConfigDocumentBuilder
    extends Commands.IDocumentBuilder,
        IPrinterBasicCommandBuilder,
        IPrinterConfigBuilder,
        IPrinterLabelConfigBuilder {}

/** Builder to generate a configuration to apply to a printer. */
export class ConfigDocumentBuilder
    extends Commands.DocumentBuilder
    implements IConfigDocumentBuilder
{
    constructor(config: PrinterOptions) {
        super(config);
    }

    then(command: Commands.IPrinterCommand): IConfigDocumentBuilder {
        super.then(command);
        return this;
    }

    ///////////////////// GENERAL LABEL HANDLING

    clearImageBuffer(): IConfigDocumentBuilder {
        return this.then(new Commands.ClearImageBufferCommand());
    }

    rebootPrinter(): Commands.IDocument {
        return this.then(new Commands.RebootPrinterCommand()).finalize();
    }

    ///////////////////// CONFIG READING

    queryConfiguration(): IConfigDocumentBuilder {
        return this.then(new Commands.QueryConfigurationCommand());
    }

    printConfiguration(): Commands.IDocument {
        return this.then(new Commands.PrintConfigurationCommand()).finalize();
    }

    ///////////////////// ALTER PRINTER CONFIG

    setDarknessConfig(darknessPercent: DarknessPercent) {
        return this.then(
            new Commands.SetDarknessCommand(darknessPercent, this._config.model.maxDarkness)
        );
    }

    setPrintDirection(upsideDown = false) {
        return this.then(new Commands.SetPrintDirectionCommand(upsideDown));
    }

    setPrintSpeed(speed: PrintSpeed, mediaSlewSpeed = PrintSpeed.auto) {
        if (!this._config.model.isSpeedValid(speed)) {
            throw new UnsupportedPrinterConfigError(
                'setPrintSpeed',
                `Print speed ${PrintSpeed[speed]} is not valid for ${this._config.model.model}`
            );
        }
        if (mediaSlewSpeed && !this._config.model.isSpeedValid(mediaSlewSpeed)) {
            throw new UnsupportedPrinterConfigError(
                'setPrintSpeed',
                `Media slew speed ${PrintSpeed[speed]} is not valid for ${this._config.model.model}`
            );
        }

        // If the media slew speed is auto just copy the print speed.
        if (mediaSlewSpeed === PrintSpeed.auto) {
            mediaSlewSpeed = speed;
        }
        return this.then(
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
        return this.then(new Commands.AutosenseLabelDimensionsCommand()).finalize();
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
        return this.then(
            new Commands.SetLabelDimensionsCommand(widthInDots, heightInDots, gapLengthInDots)
        );
    }
}

export interface IPrinterBasicCommandBuilder {
    /** Clear the image buffer and prepare for a new set of commands. */
    clearImageBuffer(): IConfigDocumentBuilder;

    /** Simulate turning the printer off and back on. Must be the final command. */
    rebootPrinter(): Commands.IDocument;
}

export interface IPrinterConfigBuilder {
    /** Query the printer for its config details. */
    queryConfiguration(): IConfigDocumentBuilder;

    /** Print the configuration directly on labels. Must be final command. */
    printConfiguration(): Commands.IDocument;
}

export interface IPrinterLabelConfigBuilder {
    /** Set the darkness of the printer in the stored configuration. */
    setDarknessConfig(darknessPercent: DarknessPercent): IConfigDocumentBuilder;

    /** Set the direction labels print out of the printer. */
    setPrintDirection(upsideDown?: boolean): IConfigDocumentBuilder;

    /** Set the speed at which the labels print. */
    setPrintSpeed(speed: PrintSpeed): IConfigDocumentBuilder;

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

    /** Run the autosense operation to get label length. Must be last command. */
    autosenseLabelLength(): Commands.IDocument;
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
