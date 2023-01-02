import * as Commands from './Commands.js';
import * as Options from '../Printers/Configuration/PrinterOptions.js';

/** A prepared document, ready to be compiled and sent. */
export interface IDocument {
    /** Gets the series of commands this document contains. */
    get commands(): ReadonlyArray<Commands.IPrinterCommand>;

    /** Gets the behavior allowed for reordering commands in this document.  */
    get commandReorderBehavior(): Commands.CommandReorderBehavior;

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;
}

export class Document implements IDocument {
    constructor(
        public readonly commands: ReadonlyArray<Commands.IPrinterCommand>,
        public readonly commandReorderBehavior = Commands.CommandReorderBehavior.none
    ) {}

    /** Display the commands that will be performed in a human-readable format. */
    public showCommands(): string {
        return this.commands.map((c) => c.toDisplay()).join('\n');
    }
}

/** A document of raw commands, ready to be sent to a printer. */
export class CompiledDocument {
    constructor(
        public readonly commandLanguage: Options.PrinterCommandLanguage,
        public readonly effectFlags: Commands.PrinterCommandEffectFlags,
        public readonly commandBuffer: Uint8Array
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

    /** The reordering behavior for commands that should not be present within a document. */
    abstract get commandReorderBehavior(): Commands.CommandReorderBehavior;

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
        return new Document(this._commands, this.commandReorderBehavior);
    }

    protected andThen(command: Commands.IPrinterCommand): TBuilder {
        this._commands.push(command);
        return this as unknown as TBuilder;
    }
}
