import { NumericRange } from '../NumericRange';
import * as Commands from './Commands';
import { IPrinterLabelMediaOptions } from '../Printers/Configuration/PrinterOptions';

/** A series of printer commands that results in configuration changes. */
export interface IConfigDocumentBuilder
    extends Commands.IDocumentBuilder,
        IPrinterBasicCommandBuilder,
        IPrinterConfigBuilder,
        IPrinterLabelConfigBuilder {}

/** Builder to generate a configuration to apply to a printer. */
export class ConfigDocumentBuilder implements IConfigDocumentBuilder {
    private _commands: Commands.IPrinterCommand[] = [];
    private _config: IPrinterLabelMediaOptions;

    constructor(config: IPrinterLabelMediaOptions) {
        this._config = config;
    }

    clear(): IConfigDocumentBuilder {
        this._commands = [];
        return this;
    }

    showCommands(): string {
        let result = '';
        this._commands.forEach((c) => (result += `${c.name} - ${c.toDisplay()}\n`));
        return result;
    }

    finalize(): Commands.IDocument {
        // Perform some kind of validation on the set of commands
        // such as making sure it has a print command or whatever.
        return new Commands.Document(this._commands);
    }

    clearImageBuffer(): IConfigDocumentBuilder {
        return this.then(new Commands.ClearImageBufferCommand());
    }

    queryConfiguration(): IConfigDocumentBuilder {
        return this.then(new Commands.QueryConfigurationCommand());
    }

    setDarknessConfig(darknessPercent: NumericRange<1, 100>) {
        return this.then(new Commands.SetDarknessCommand(darknessPercent));
    }

    setPrintDirection(upsideDown: boolean) {
        return this.then(new Commands.SetPrintDirectionCommand(upsideDown));
    }

    setPrintSpeed(speed: number) {
        return this.then(new Commands.SetPrintSpeedCommand(speed));
    }

    setLabelDimensions(width: number, height?: number, gapLength?: number) {
        return this.then(new Commands.SetLabelDimensionsCommand(width, height, gapLength));
    }

    private then(command: Commands.IPrinterCommand) {
        this._commands.push(command);
        return this;
    }
}

export interface IPrinterLabelConfigBuilder {
    /** Set the darkness of the printer in the stored configuration. */
    setDarknessConfig(darkness: number);

    /** Set the direction labels print out of the printer. */
    setPrintDirection(upsideDown: boolean);

    /** Set the speed at which the labels print. */
    setPrintSpeed(speed: number);

    /** Set the size of the labels in the printer. Height and gapLength can be omitted if determined through autosense. */
    setLabelDimensions(width: number, height?: number, gapLength?: number);
}

export interface IPrinterBasicCommandBuilder {
    /** Clear the image buffer and prepare for a new set of commands. */
    clearImageBuffer(): IConfigDocumentBuilder;
}

export interface IPrinterConfigBuilder {
    /** Query the printer for its config details. */
    queryConfiguration(): IConfigDocumentBuilder;
}
