import { IDocument } from '../Documents/Commands';
import { ConfigDocumentBuilder, IConfigDocumentBuilder } from '../Documents/ConfigDocument';
import {
    ILabelDocumentBuilder,
    LabelDocumentBuilder,
    LabelDocumentType
} from '../Documents/LabelDocument';
import { ReadyToPrintDocuments } from '../Documents/ReadyToPrintDocuments';
import { WebZlpError } from '../WebZlpError';
import {
    IPrinterDeviceChannel,
    PrinterChannelType,
    PrinterCommunicationOptions
} from './Communication/PrinterCommunication';
import { UsbPrinterDeviceChannel } from './Communication/UsbPrinterDeviceChannel';
import { PrinterCommandLanguage, PrinterOptions } from './Configuration/PrinterOptions';
import { EplPrinterCommandSet } from './Languages/EplPrinterCommandSet';
import { PrinterCommandSet } from './Languages/PrinterCommandSet';
import { ZplPrinterCommandSet } from './Languages/ZplPrinterCommandSet';
import { PrinterModelDb } from './Models/PrinterModelDb';

/**
 * A class for working with a label printer.
 */
export class Printer {
    // Printer communication handles
    private channelType: PrinterChannelType;
    private device: USBDevice;
    private printerChannel: IPrinterDeviceChannel;
    private commandset: PrinterCommandSet;

    private _printerConfig: PrinterOptions;

    // Cache for the nextLine method.
    private nextLineCache: string;

    private _ready: Promise<boolean>;
    /** A promise indicating this printer is ready to be used. */
    get ready() {
        return this._ready;
    }

    /** Gets the model of the printer, detected from the printer's config. */
    get printerModel() {
        return this._printerConfig.model;
    }

    /** Gets the read-only copy of the current config of the printer. To modfiy use getConfigDocument. */
    get printerConfig() {
        return this._printerConfig.copy();
    }

    private _printerCommunicationOptions: PrinterCommunicationOptions;
    /** Gets the configured printer communication options. */
    get printerCommunicationOptions() {
        return this._printerCommunicationOptions;
    }

    /** Construct a new printer from a given USB device. */
    static fromUSBDevice(device: USBDevice, options?: PrinterCommunicationOptions): Printer {
        return new this(PrinterChannelType.usb, device, options);
    }

    constructor(
        channelType: PrinterChannelType,
        device: USBDevice,
        options?: PrinterCommunicationOptions
    ) {
        this.channelType = channelType;
        this._printerCommunicationOptions = options ?? new PrinterCommunicationOptions();

        switch (this.channelType) {
            case PrinterChannelType.usb:
                this.device = device;
                this.printerChannel = new UsbPrinterDeviceChannel(
                    this.device,
                    this._printerCommunicationOptions.debug
                );
                break;
            case PrinterChannelType.serial:
            case PrinterChannelType.bluetooth:
            case PrinterChannelType.network:
                throw new WebZlpError('Printer comm method not implemented.');
        }

        this._ready = this.setup();
    }

    private async setup() {
        await this.printerChannel.ready;
        await this.refreshPrinterConfiguration(this.printerChannel.modelHint);
        return true;
    }

    /** Gets a document for configuring this printer. */
    public getConfigDocument(): IConfigDocumentBuilder {
        return new ConfigDocumentBuilder(this._printerConfig);
    }

    /** Gets a document for printing a label. */
    public getLabelDocument(
        docType: LabelDocumentType = LabelDocumentType.instanceForm
    ): ILabelDocumentBuilder {
        return new LabelDocumentBuilder(this._printerConfig, docType);
    }

    /** Send a document to the printer, applying the commands. */
    public async sendDocument(doc: IDocument) {
        await this.ready;

        if (this._printerCommunicationOptions.debug) {
            console.debug('SENDING COMMANDS TO PRINTER:');
            console.debug(doc.showCommands());
        }

        // Exceptions are thrown and handled elsewhere.
        const compiled = this.commandset.transpileDoc(doc);

        if (this._printerCommunicationOptions.debug) {
            console.debug('RAW COMMAND BUFFER:');
            console.debug(compiled.commandBufferString);
        }

        await this.printerChannel.sendCommands(compiled.commandBufferRaw);
    }

    /** Close the connection to this printer, preventing future communication from working. */
    public async dispose() {
        await this.printerChannel.dispose();
    }

    /** Refresh the printer information cache directly from the printer. */
    public async refreshPrinterConfiguration(modelHint?: string): Promise<PrinterOptions> {
        if (!this._printerConfig) {
            // First time pulling the config. Detect language and model.
            this._printerConfig = await this.detectLanguageAndSetConfig(modelHint);
        } else {
            this._printerConfig = await this.tryGetConfig(this.commandset);
        }

        if (!this._printerConfig?.valid) {
            throw new WebZlpError(
                'Failed to detect the printer information, either the printer is unknown or the config can not be parsed. This printer can not be used.'
            );
        }
        return this._printerConfig;
    }

    private async detectLanguageAndSetConfig(modelHint?: string): Promise<PrinterOptions> {
        const guess = PrinterModelDb.guessLanguageFromModelHint(modelHint);
        // Guess order is easiest to detect and support.. to least
        const guessOrder = [
            guess,
            PrinterCommandLanguage.zpl,
            PrinterCommandLanguage.epl,
            PrinterCommandLanguage.cpcl
        ];

        // For each language, we send the appropriate command to try and get the
        // config dump. If we get something legible back break out.
        for (let i = 0; i < guessOrder.length; i++) {
            const set = this.getCommandSetForLanguage(guessOrder[i]);
            if (set == null) {
                continue;
            }
            this.logIfDebug('Trying printer language guess', PrinterCommandLanguage[guessOrder[i]]);
            const config = await this.tryGetConfig(set);
            if (config.valid) {
                this.commandset = set;
                return config;
            }
        }

        return { valid: false } as PrinterOptions;
    }

    private getCommandSetForLanguage(lang: PrinterCommandLanguage): PrinterCommandSet {
        // In order of preferred communication method
        if (PrinterCommandLanguage.zpl === (lang & PrinterCommandLanguage.zpl)) {
            return new ZplPrinterCommandSet();
        }
        if (PrinterCommandLanguage.epl === (lang & PrinterCommandLanguage.epl)) {
            return new EplPrinterCommandSet();
        }
        return null;
    }

    private async tryGetConfig(cmdSet: PrinterCommandSet): Promise<PrinterOptions> {
        // TODO: Move this elsewhere so we don't create a new one each time.
        // Safe to use a raw document with null metadata since the data isn't used here.
        const compiled = cmdSet.transpileDoc(ReadyToPrintDocuments.configDocument);
        this.logIfDebug('Querying printer config with', compiled.commandBufferString);

        let config: PrinterOptions;
        // Querying for a config doesn't always.. work? Like, just straight up
        // for reasons I can't figure out some printers will refuse to return
        // a valid config. Mostly EPL models.
        // Give it 3 chances before we give up.
        let retryLimit = 3;
        do {
            retryLimit--;

            // Start listening for the return from the
            const listenEpl = this.listenForData();

            // Config isn't set up yet, send command directly without the send command.
            await this.printerChannel.sendCommands(compiled.commandBufferRaw);
            const rawResult = await listenEpl;
            config = cmdSet.parseConfigurationResponse(
                rawResult,
                this._printerCommunicationOptions
            );
        } while (!config.valid && retryLimit > 0);

        this.logIfDebug(`Config result is ${config.valid ? 'valid' : 'not valid.'}`);

        return config;
    }

    /** Wait for the next line of data sent from the printer, or null if nothing is received. */
    private async nextLine(timeoutMs: number): Promise<string | void> {
        // If we have a cached line return that.
        if (this.nextLineCache) {
            const line = this.nextLineCache;
            this.nextLineCache = null;
            return line;
        }

        let timedOut = false;
        let reader: ReadableStreamDefaultReader<string>;
        const nextLinePromise = (async () => {
            reader = this.printerChannel.streamFromPrinter.getReader();
            const { value, done } = await reader.read();
            reader.releaseLock();

            if (done) {
                return;
            }

            if (timedOut) {
                this.nextLineCache = value;
                return;
            }

            return value;
        })();

        const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                timedOut = true;
                reader.releaseLock();
                resolve();
            }, timeoutMs);
        });

        return Promise.race([nextLinePromise, timeoutPromise]);
    }

    /** Listen for incoming data until a timeout, assuming the source is done. */
    private async listenForData(timeoutMs = 300) {
        let aggregate = '';
        for (;;) {
            const line = await this.nextLine(timeoutMs);
            if (line === undefined) {
                this.logIfDebug(
                    'Received',
                    aggregate.length,
                    'long message from printer:\n',
                    aggregate
                );
                return aggregate;
            }
            aggregate += line + '\n';
        }
    }

    private logIfDebug(...obj: unknown[]) {
        if (this._printerCommunicationOptions.debug) {
            console.debug(...obj);
        }
    }
}
