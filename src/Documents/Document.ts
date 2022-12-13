import * as Commands from './Commands';
import * as Options from '../Printers/Configuration/PrinterOptions';

/** A prepared document, ready to be compiled and sent. */
export interface IDocument {
    /** Gets the series of commands this document contains. */
    get commands(): readonly Commands.IPrinterCommand[];

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;
}

export class Document implements IDocument {
    private _commands: readonly Commands.IPrinterCommand[];
    get commands() {
        return this._commands;
    }

    constructor(commandList: Commands.IPrinterCommand[]) {
        this._commands = commandList;
    }

    /** Display the commands that will be performed in a human-readable format. */
    public showCommands(): string {
        return this._commands.map((c) => c.toDisplay()).join('\n');
    }
}

/** A document of raw commands, ready to be sent to a printer. */
export class CompiledDocument {
    constructor(
        public commandLanguage: Options.PrinterCommandLanguage,
        public effectFlags: Commands.PrinterCommandEffectFlags,
        public commandBuffer: Uint8Array
    ) {}

    /**
     * Gets the text view of the command buffer. Do not send this to the printer, the encoding
     * will break and commands will fail.
     */
    get commandBufferString(): string {
        return new TextDecoder('ascii').decode(this.commandBuffer);
    }
}

/** A basic document builder, containing internal state to construct a document. */
export abstract class DocumentBuilder<TBuilder extends DocumentBuilder<TBuilder>> {
    private _commands: Commands.IPrinterCommand[] = [];
    protected _config: Options.PrinterOptions;

    constructor(config: Options.PrinterOptions) {
        this._config = config;
    }

    /** Gets a read-only copy of the current label configuration. */
    get currentConfig() {
        return structuredClone(this._config);
    }

    /** Clear the commands in this document and reset it to the starting blank. */
    clear(): TBuilder {
        this._commands = [];
        return this as unknown as TBuilder;
    }

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string {
        return this._commands.map((c) => c.toDisplay()).join('\n');
    }

    /** Return the final built document. */
    finalize(): Document {
        return new Document(this._commands);
    }

    protected then(command: Commands.IPrinterCommand): TBuilder {
        this._commands.push(command);
        return this as unknown as TBuilder;
    }
}
