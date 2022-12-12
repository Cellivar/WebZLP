import { WebZlpError } from '../../WebZlpError';
import { PrinterCommandLanguage, PrinterOptions } from '../Configuration/PrinterOptions';
import * as Commands from '../../Documents/Commands';
import { PrinterCommunicationOptions } from '../Communication/PrinterCommunication';

export abstract class PrinterCommandSet {
    /** Encode a raw string command into a Uint8Array according to the command language rules. */
    abstract encodeCommand(str: string): Uint8Array;

    /** Get an empty command to be used as a no-op. */
    protected get noop() {
        return new Uint8Array();
    }

    /** Gets the command to start a new document. */
    abstract get documentStartCommand(): Uint8Array;
    /** Gets the command to end a document. */
    abstract get documentEndCommand(): Uint8Array;
    /** Gets the command language this command set implements */
    abstract get commandLanugage(): PrinterCommandLanguage;

    private documents: Array<CompiledDocumentMetadata> = [new CompiledDocumentMetadata()];
    private activeDocumentIdx = 0;
    protected get currentDocument() {
        return this.documents[this.activeDocumentIdx];
    }

    /** Transpile a document into a document ready to be sent to the printer. */
    transpileDoc(doc: Commands.IDocument): Readonly<Commands.CompiledDocument> {
        const validationErrors = [];
        this.documents = [];
        this.activeDocumentIdx = 0;
        this.documents.push(new CompiledDocumentMetadata());

        if (!doc.withExplicitDocumentStartStopCommands) {
            this.currentDocument.addRawCmd(this.documentStartCommand);
        }
        doc.commands.forEach((c) => {
            try {
                this.currentDocument.addRawCmd(this.transpileCommand(c, this.currentDocument));
                this.currentDocument.commandEffectFlags |=
                    c.printerEffectFlags ?? Commands.PrinterCommandEffectFlags.none;
            } catch (e) {
                if (e instanceof DocumentValidationError) {
                    validationErrors.push(e);
                } else {
                    throw e;
                }
            }
        });
        if (!doc.withExplicitDocumentStartStopCommands) {
            this.currentDocument.addRawCmd(this.documentEndCommand);
        }
        if (validationErrors.length > 0) {
            throw new DocumentValidationError('One or more validation errors', validationErrors);
        }

        // From the array of individual documents construct the full doc.
        const out = new Commands.CompiledDocument(
            this.commandLanugage,
            this.documents.reduce<Commands.PrinterCommandEffectFlags>(
                (aggregate, current) => (aggregate |= current.commandEffectFlags),
                Commands.PrinterCommandEffectFlags.none
            ),
            this.documents.reduce<Uint8Array>((aggregate, current) => {
                return this.combineCommands(aggregate, current.combinedBuffer);
            }, this.noop)
        );
        return Object.freeze(out);
    }

    /**
     * Round a raw value to the nearest step.
     */
    protected roundToNearestStep(value: number, step: number): number {
        const inverse = 1.0 / step;
        return Math.round(value * inverse) / inverse;
    }

    /** Strip a string of invalid characters for a command. */
    protected cleanString(str: string) {
        return str
            .replace(/\\/gi, '\\\\')
            .replace(/"/gi, '\\"')
            .replace(/[\r\n]+/gi, ' ');
    }

    /** Start a new label within the same command batch. */
    protected startNewDocument() {
        this.currentDocument.addRawCmd(
            this.transpileCommand(new Commands.DocumentEndCommand(), this.currentDocument)
        );
        this.documents.push(new CompiledDocumentMetadata());
        this.activeDocumentIdx += 1;
        this.currentDocument.addRawCmd(
            this.transpileCommand(new Commands.DocumentStartCommand(), this.currentDocument)
        );
        return this.noop;
    }

    /** Apply an offset command to a document. */
    protected modifyOffset(cmd: Commands.Offset, outDoc: CompiledDocumentMetadata) {
        const newHoriz = cmd.absolute ? cmd.horizontal : outDoc.horizontalOffset + cmd.horizontal;
        outDoc.horizontalOffset = newHoriz < 0 ? 0 : newHoriz;
        if (cmd.vertical) {
            const newVert = cmd.absolute ? cmd.vertical : outDoc.verticalOffset + cmd.vertical;
            outDoc.verticalOffset = newVert < 0 ? 0 : newVert;
        }
        return this.noop;
    }

    /** Combine two commands into one command array. */
    protected combineCommands(cmd1: Uint8Array, cmd2: Uint8Array) {
        const merged = new Uint8Array(cmd1.length + cmd2.length);
        merged.set(cmd1);
        merged.set(cmd2, cmd1.length);
        return merged;
    }

    /** Transpile a command to its native command equivalent. */
    abstract transpileCommand(
        cmd: Commands.IPrinterCommand,
        outDoc: CompiledDocumentMetadata
    ): Uint8Array;

    /** Parse the response of a configuration inqury in the command set language. */
    abstract parseConfigurationResponse(
        rawText: string,
        commOpts: PrinterCommunicationOptions
    ): PrinterOptions;
}

/** Represents an error when validating a document against a printer's capabilties. */
export class DocumentValidationError extends WebZlpError {
    private _innerErrors: DocumentValidationError[] = [];
    get innerErrors() {
        return this._innerErrors;
    }

    constructor(message: string, innerErrors?: DocumentValidationError[]) {
        super(message);
        this._innerErrors = innerErrors;
    }
}

/** Class for storing in-progress document generation information */
export class CompiledDocumentMetadata {
    horizontalOffset = 0;
    verticalOffset = 0;
    lineSpacingDots = 5;

    dpi;

    commandEffectFlags = Commands.PrinterCommandEffectFlags.none;

    rawCmdBuffer: Array<Uint8Array> = [];

    /** Add a raw command to the internal buffer. */
    addRawCmd(array: Uint8Array) {
        this.rawCmdBuffer.push(array);
    }

    /**
     * Gets a single buffer of the internal command set.
     */
    get combinedBuffer(): Uint8Array {
        const bufferLen = this.rawCmdBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
        const buffer = new Uint8Array(bufferLen);
        this.rawCmdBuffer.reduce((offset, arr) => {
            buffer.set(arr, offset);
            return arr.byteLength + offset;
        }, 0);

        return buffer;
    }
}
