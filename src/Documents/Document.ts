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
        let result = '';
        this._commands.forEach((c) => (result += `${c.toDisplay()}\n`));
        return result;
    }
}

/** A document of raw commands, ready to be sent to a printer. */
export class CompiledDocument {
    private rawCmdBuffer: Array<Uint8Array> = [];
    private _commandLanugage: Options.PrinterCommandLanguage;
    get commandLanguage() {
        return this._commandLanugage;
    }

    horizontalOffset = 0;
    verticalOffset = 0;
    lineSpacingDots = 5;

    commandEffectFlags = Commands.PrinterCommandEffectFlags.none;

    constructor(commandLang: Options.PrinterCommandLanguage) {
        this._commandLanugage = commandLang;
    }

    /**
     * Gets a single buffer of the internal command set.
     */
    get commandBufferRaw(): Uint8Array {
        const bufferLen = this.rawCmdBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
        const buffer = new Uint8Array(bufferLen);
        this.rawCmdBuffer.reduce((offset, arr) => {
            buffer.set(arr, offset);
            return arr.byteLength + offset;
        }, 0);

        return buffer;
    }

    /**
     * Gets the text view of the command buffer. Do not send this to the printer, the encoding
     * will break and commands will fail.
     */
    get commandBufferString(): string {
        return new TextDecoder('ascii').decode(this.commandBufferRaw);
    }

    /** Add a raw command to the internal buffer. */
    addRawCmd(array: Uint8Array): CompiledDocument {
        this.rawCmdBuffer.push(array);
        return this;
    }

    /** Clear the internal buffer. */
    clearCommandBuffer(): CompiledDocument {
        this.rawCmdBuffer = [];
        return this;
    }
}

/** The basic functionality of a document builder to arrange document commands. */
export interface IDocumentBuilder {
    /** Gets a read-only copy of the current label configuration. */
    get currentConfig(): Options.PrinterOptions;

    /** Clear the commands in this document and reset it to the starting blank. */
    clear(): IDocumentBuilder;

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;

    /** Return the final built document. */
    finalize(): IDocument;

    /** Add a command to the list of commands. */
    then(command: Commands.IPrinterCommand): IDocumentBuilder;
}

/** A basic document builder, containing internal state to construct a document. */
export abstract class DocumentBuilder implements IDocumentBuilder {
    private _commands: Commands.IPrinterCommand[] = [];
    protected _config: Options.PrinterOptions;

    constructor(config: Options.PrinterOptions) {
        this._config = config;
    }

    /** Gets the read-only config information */
    get currentConfig() {
        return structuredClone(this._config);
    }

    clear(): IDocumentBuilder {
        this._commands = [];
        return this;
    }

    showCommands(): string {
        let result = '';
        this._commands.forEach((c) => (result += `${c.name} - ${c.toDisplay()}\n`));
        return result;
    }

    finalize(): IDocument {
        return new Document(this._commands);
    }

    then(command: Commands.IPrinterCommand): IDocumentBuilder {
        this._commands.push(command);
        return this;
    }
}
