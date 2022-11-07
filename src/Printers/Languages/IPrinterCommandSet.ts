import { IPrinterCommand } from '../../Documents/Commands';
import { IDocument } from '../../Documents/Commands';
import { WebZplError } from '../../WebZplError';
import { PrinterOptions } from '../Configuration/PrinterOptions';

export interface IPrinterCommandSet {
    /** Get the contets of the command buffer as a single array. */
    get commandBufferRaw(): Uint8Array;

    /**
     * Get the current command buffer as an ASCII string.
     *
     * This SHOULD NOT be used to send to the printer as it will be interpreted
     * as a UTF-8 string. For printer communication use commandBufferRaw instead.
     */
    get commandBufferString(): string;

    /** Add a document as a series of commands to the command buffer. */
    loadDoc(doc: IDocument): IPrinterCommandSet;

    /**
     * Add command, concatenating given parameters with a comma.
     * @param parameters The command and params. First element should be the command and first parameter.
     *
     * @example
     * // EPL Command to print text
     * addCmd("A10", 10, 0, 1, 1, 1, "N", "Hello World!");
     * @example
     * // ZPL Command to set the field origin to 20 dots right, 60 dots down
     * addCmd("^FO20", "60");
     */
    addCmd(...parameters: string[]): IPrinterCommandSet;

    /**
     * Add a raw array of ASCII characters to add as commands.
     *
     * @param array Must be 8-bit ASCII clean command characters.
     */
    addRawCmd(array: Uint8Array): IPrinterCommandSet;

    /** Empty the current command buffer entirely. */
    clearCommandBuffer(): IPrinterCommandSet;

    /** Transpile a command to its native implementation. */
    transpileCommand(cmd: IPrinterCommand): Uint8Array;

    /** Parse the response of a configuration inqury in the command set language. */
    parseConfigurationResponse(rawText: string): PrinterOptions;
}

/** Represents an error when validating a document against a printer's capabilties. */
export class DocumentValidationError extends WebZplError {
    private _innerErrors: DocumentValidationError[] = [];
    get innerErrors() {
        return this._innerErrors;
    }

    constructor(message: string, innerErrors?: DocumentValidationError[]) {
        super(message);
        this._innerErrors = innerErrors;
    }
}
