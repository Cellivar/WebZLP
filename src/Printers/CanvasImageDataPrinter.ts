import { IDocument } from '../Documents/Document.js';
import { ConfigDocumentBuilder, IConfigDocumentBuilder } from '../Documents/ConfigDocument.js';
import {
    ILabelDocumentBuilder,
    LabelDocumentBuilder,
    LabelDocumentType
} from '../Documents/LabelDocument.js';
import { ReadyToPrintDocuments } from '../Documents/ReadyToPrintDocuments.js';
import { WebZlpError } from '../WebZlpError.js';
import { IPrinterDeviceChannel, PrinterChannelType } from './Communication/PrinterCommunication.js';
import { UsbPrinterDeviceChannel } from './Communication/UsbPrinterDeviceChannel.js';
import { PrinterCommandLanguage, PrinterOptions } from './Configuration/PrinterOptions.js';
import { EplPrinterCommandSet } from './Languages/EplPrinterCommandSet.js';
import { PrinterCommandSet } from './Languages/PrinterCommandSet.js';
import { ZplPrinterCommandSet } from './Languages/ZplPrinterCommandSet.js';
import { PrinterModelDb } from './Models/PrinterModelDb.js';
import { PrinterCommunicationOptions } from './PrinterCommunicationOptions.js';
import { CanvasPrinterCommandSet } from './Languages/CanvasPrinterCommandSet.js';

export class CanvasImageDataPrinter {
    private commandset: CanvasPrinterCommandSet;

    private _printerOptions: PrinterOptions;

    private _commOptions: PrinterCommunicationOptions;

    /** A promise indicating this printer is ready to be used. */
    get ready() {
        return Promise.resolve(true);
    }
    /** Gets the model of the printer, detected from the printer's config. */
    get printerModel() {
        return this._printerOptions.model;
    }

    /** Gets the read-only copy of the current config of the printer. To modfiy use getConfigDocument. */
    get printerConfig() {
        return this._printerOptions.copy();
    }

    private _canvas: HTMLCanvasElement;
    get renderedImageData() {
        return this.commandset.canvasImageData;
    }

    constructor(printerOptions: PrinterOptions, commOptions?: PrinterCommunicationOptions) {
        this._printerOptions = printerOptions;
        this._commOptions = commOptions ?? new PrinterCommunicationOptions();

        this.commandset = new CanvasPrinterCommandSet(this._commOptions.additionalCustomCommands);
    }

    /** Gets a document for configuring this printer. */
    public getConfigDocument(): IConfigDocumentBuilder {
        return new ConfigDocumentBuilder(this._printerOptions);
    }

    /** Gets a document for printing a label. */
    public getLabelDocument(
        docType: LabelDocumentType = LabelDocumentType.instanceForm
    ): ILabelDocumentBuilder {
        return new LabelDocumentBuilder(this._printerOptions, docType);
    }

    /** Send a document to the printer, applying the commands. */
    public async sendDocument(doc: IDocument) {
        this.logIfDebug('SENDING COMMANDS TO CANVASPRINTER:');
        this.logResultIfDebug(doc.showCommands);

        // No transpile step because this inteprets the values directly.
    }

    private renderCommandsToDocument(doc: IDocument) {

    }

    private generateCanvasFromOptions(options: PrinterOptions) {
        // TODO: Better figure out what all this should emulate. Should it apply effects
        // based on the speed and darkness settings?
    }

    private logIfDebug(...obj: unknown[]) {
        if (this._commOptions.debug) {
            console.debug(...obj);
        }
    }

    private logResultIfDebug(method: () => unknown) {
        if (this._commOptions.debug) {
            console.debug(method());
        }
    }
}
