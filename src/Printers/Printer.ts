import { IDocument } from '../Documents/Commands';
import { ConfigDocumentBuilder, IConfigDocumentBuilder } from '../Documents/ConfigDocument';
import {
    ILabelDocumentBuilder,
    LabelDocumentBuilder,
    LabelDocumentType
} from '../Documents/LabelDocument';
import { WebZplError } from '../WebZplError';
import {
    IPrinterDeviceChannel,
    PrinterChannelType,
    PrinterCommunicationOptions,
    PrinterError
} from './Communication/PrinterCommunication';
import { UsbPrinterDeviceChannel } from './Communication/UsbPrinterDeviceChannel';
import { PrinterCommandLanguage, PrinterOptions } from './Configuration/PrinterOptions';
import { EplPrinterCommandSet } from './Languages/EplPrinterCommandSet';
import { IPrinterCommandSet } from './Languages/IPrinterCommandSet';
import { ZplPrinterCommandSet } from './Languages/ZplPrinterCommandSet';
import { guessLanguageFromModelHint } from './Models/PrinterModel';

/**
 * A class for working with a label printer.
 */
export class Printer {
    // Printer communication handles
    private channelType: PrinterChannelType;
    private device: USBDevice;
    private printerChannel: IPrinterDeviceChannel;
    private commandset: IPrinterCommandSet;

    private printerConfig: PrinterOptions;

    // Cache for the nextLine method.
    private nextLineCache: string;

    private _ready: Promise<boolean>;
    /** A promise indicating this printer is ready to be used. */
    get ready() {
        return this._ready;
    }

    /** Gets the model of the printer, detected from the printer's config. */
    get printerModel() {
        return this.printerConfig.model;
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
                throw new Error('Printer comm method not implemented.');
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
        return new ConfigDocumentBuilder(this.printerConfig);
    }

    /** Gets a document for printing a label. */
    public getLabelDocument(
        docType: LabelDocumentType = LabelDocumentType.instanceForm
    ): ILabelDocumentBuilder {
        return new LabelDocumentBuilder(this.printerConfig, docType);
    }

    /** Send a document to the printer, applying the commands. */
    public async sendDocument(doc: IDocument) {
        await this.ready;

        // Exceptions are thrown and handled elsewhere.
        this.commandset.clearCommandBuffer().loadDoc(doc);
        await this.send();
    }

    /** Close the connection to this printer, preventing future communication from working. */
    public async dispose() {
        await this.printerChannel.dispose();
    }

    /**
     * Refresh the printer information cache directly from the printer.
     */
    public async refreshPrinterConfiguration(modelHint?: string): Promise<PrinterOptions> {
        if (!this.printerConfig) {
            // First time pulling the config. Detect language and model.
            this.printerConfig = await this.detectLanguageAndSetConfig(modelHint);
        } else {
            this.printerConfig = await this.tryGetConfig(this.commandset);
        }

        if (!this.printerConfig?.valid) {
            throw new WebZplError(
                'Failed to get a configuration from the printer, printer cannot be used'
            );
        }
        return this.printerConfig;
    }

    private async send(cmdSet: IPrinterCommandSet = this.commandset): Promise<PrinterError | null> {
        console.debug('Sending commands to printer..');
        if (this._printerCommunicationOptions.debug) {
            console.debug(cmdSet.commandBufferString);
        }
        try {
            const result = await this.printerChannel.sendCommands(cmdSet.commandBufferRaw);
            console.debug('Completed sending commands to printer.');
            return result;
        } catch (e) {
            return { message: e } as PrinterError;
        } finally {
            cmdSet.clearCommandBuffer();
        }
    }

    private async detectLanguageAndSetConfig(modelHint?: string): Promise<PrinterOptions> {
        const guess = guessLanguageFromModelHint(modelHint);
        // Guess order is easiest to detect and support.. to least
        const guessOrder = [
            guess,
            PrinterCommandLanguage.zpl,
            PrinterCommandLanguage.epl,
            PrinterCommandLanguage.cpcl
        ];

        // For each language, we send the appropriate command to try and get the
        // config dump. If we get something legible back break out.
        guessOrder.forEach(async (guess) => {
            const set = this.getCommandSetForLanguage(guess);
            const config = await this.tryGetConfig(set);
            if (config.valid) {
                this.commandset = set;
                return config;
            }
        });

        return { valid: false } as PrinterOptions;
    }

    private getCommandSetForLanguage(lang: PrinterCommandLanguage): IPrinterCommandSet {
        // In order of preferred communication method
        if (PrinterCommandLanguage.zpl === (lang & PrinterCommandLanguage.zpl)) {
            return new ZplPrinterCommandSet();
        }
        if (PrinterCommandLanguage.epl === (lang & PrinterCommandLanguage.epl)) {
            return new EplPrinterCommandSet();
        }
        throw new Error('Command language not implemented');
    }

    private async tryGetConfig(cmdSet: IPrinterCommandSet): Promise<PrinterOptions> {
        // Safe to use a raw document without metadata since the data isn't used here.
        const configDoc = new ConfigDocumentBuilder(null)
            .clearImageBuffer()
            .queryConfiguration()
            .finalize();

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

            // Can't use the standard methods because they're not configured
            // yet, so buffer and send the commands manually.
            cmdSet.clearCommandBuffer().loadDoc(configDoc);
            await this.send(cmdSet);
            const rawResult = await listenEpl;
            config = cmdSet.parseConfigurationResponse(rawResult);
        } while (!config.valid && retryLimit > 0);

        return config;
    }

    /** Wait for the next line of data sent from the printer, or null if nothing is received. */
    private async nextLine(timeoutMs = 200): Promise<string | void> {
        // If we have a cached line return that.
        if (this.nextLineCache) {
            const line = this.nextLineCache;
            this.nextLineCache = null;
            return line;
        }

        let timedOut = false;
        const nextLinePromise = (async () => {
            const reader = this.printerChannel.streamFromPrinter.getReader();
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
                resolve();
            }, timeoutMs);
        });

        return Promise.race([nextLinePromise, timeoutPromise]);
    }

    /** Listen for incoming data until a timeout, assuming the source is done. */
    private async listenForData(timeoutMs = 200) {
        let aggregate = '';
        for (;;) {
            const line = await this.nextLine(timeoutMs);
            if (line === undefined) {
                return aggregate;
            }
            aggregate += line + '\n';
        }
    }

    /**
     * Round a raw inch value to the nearest configured inch step.
     */
    private roundToNearestIncheStep(value: number): number {
        const inverse = 1.0 / this._printerCommunicationOptions.labelDimensionRoundingStep;
        return Math.round(value * inverse) / inverse;
    }
}
