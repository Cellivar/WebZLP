import { CompiledDocument, IDocument } from '../../Documents/Document';
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

    /** Transpile a document into a document ready to be sent to the printer. */
    transpileDoc(doc: IDocument): Readonly<CompiledDocument> {
        const validationErrors = [];
        const state = new CompiledDocument(this.commandLanugage);
        state.addRawCmd(this.documentStartCommand);
        doc.commands.forEach((c) => {
            try {
                state.addRawCmd(this.transpileCommand(c, state));
                state.commandEffectFlags |=
                    c.printerEffectFlags ?? Commands.PrinterCommandEffectFlags.none;
            } catch (e) {
                if (e instanceof DocumentValidationError) {
                    validationErrors.push(e);
                } else {
                    throw e;
                }
            }
        });
        state.addRawCmd(this.documentEndCommand);
        if (validationErrors.length > 0) {
            throw new DocumentValidationError('One or more validation errors', validationErrors);
        }
        return Object.freeze(state);
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
        return this.combineCommands(this.documentEndCommand, this.documentStartCommand);
    }

    /** Apply an offset command to a document. */
    protected modifyOffset(cmd: Commands.Offset, outDoc: CompiledDocument) {
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
    abstract transpileCommand(cmd: Commands.IPrinterCommand, outDoc: CompiledDocument): Uint8Array;

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
