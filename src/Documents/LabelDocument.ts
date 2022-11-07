import * as Commands from './Commands';
import { IPrinterLabelMediaOptions } from '../Printers/Configuration/PrinterOptions';

export interface ILabelDocumentBuilder
    extends Commands.IDocumentBuilder,
        ILabelActionCommandBuilder,
        ILabelPositionCommandBuilder {}

/** Types of label documents to send to printers. See the docs. */
export enum LabelDocumentType {
    /** A form that is only used for one set of commands, then discarded. */
    instanceForm,
    /** A form that is stored in the printer to be re-used. */
    storedForm,
    /** A form that is rendered as an image before being sent to the printer. */
    imageForm
}

/** Class for storing printer-defined label information. */
export class PrinterLabelConfig {
    private _labelWidthDots: number;
    /** Gets the label's width in dots. */
    get labelWidthDots() {
        return this._labelWidthDots;
    }
    /** Gets the label's width in inches. */
    get labelWidthInch() {
        return this._labelWidthDots / this._printerDpi;
    }

    private _labelHeightDots: number;
    /** Gets the label's height in dots. */
    get labelHeightDots() {
        return this._labelHeightDots;
    }
    /** Gets the lable's height in inches. */
    get labelHeightInch() {
        return this._labelHeightDots / this._printerDpi;
    }

    private _printerDpi: number;
    /** Gets the printer's DPI, defined by the print head. */
    get printerDpi() {
        return this._printerDpi;
    }

    constructor(labelWidthDots: number, labelHeightDots: number, printerDpi: number) {
        this._labelWidthDots = labelWidthDots;
        this._labelHeightDots = labelHeightDots;
        this._printerDpi = printerDpi;
    }
}

export interface ILabelActionCommandBuilder {
    /** Add a commant to print a number of the preceding label instructions. */
    addPrintCmd(count: number): ILabelDocumentBuilder;

    /** Clear the image buffer to prepare for a new label. Usually only at the start of a label. */
    clearImageBuffer(): ILabelDocumentBuilder;

    /** Add a command to cut a label, usually at the end of a label and right before the print command. */
    addCutCommand(): ILabelDocumentBuilder;
}

export interface ILabelPositionCommandBuilder {
    /** Set the aboslute offset from the top left position of the label. */
    setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder;

    /** Add a relative offset to the current offset from the top left position of the label. */
    addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder;

    /** Sets the automatic spacing between added lines of text. */
    setLineSpacing(spacing: number): ILabelDocumentBuilder;
}

export class LabelDocumentBuilder implements ILabelDocumentBuilder {
    private _commands: Commands.IPrinterCommand[] = [];
    private _config: IPrinterLabelMediaOptions;
    private _docType: LabelDocumentType = LabelDocumentType.instanceForm;

    constructor(
        config: IPrinterLabelMediaOptions,
        docType: LabelDocumentType = LabelDocumentType.instanceForm
    ) {
        this._config = config;
        this._docType = docType;
    }

    clear(): ILabelDocumentBuilder {
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

    addPrintCmd(count: number): ILabelDocumentBuilder {
        throw new Error('Method not implemented.');
    }
    clearImageBuffer(): ILabelDocumentBuilder {
        throw new Error('Method not implemented.');
    }
    addCutCommand(): ILabelDocumentBuilder {
        throw new Error('Method not implemented.');
    }
    setOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
        throw new Error('Method not implemented.');
    }
    addOffset(horizontal: number, vertical?: number): ILabelDocumentBuilder {
        throw new Error('Method not implemented.');
    }
    setLineSpacing(spacing: number): ILabelDocumentBuilder {
        throw new Error('Method not implemented.');
    }
}
