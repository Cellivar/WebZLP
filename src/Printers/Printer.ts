import {
    IPrinterDeviceChannel,
    PrinterChannelType,
    PrinterCommunicationOptions
} from './Communication/PrinterCommunication';
import { UsbPrinterDeviceChannel } from './Communication/UsbPrinterDeviceChannel';
import { PrinterOptions } from './Configuration/PrinterOptions';

/**
 * A class for working with a label printer.
 */
export class Printer {
    // Printer communication handles
    private channelType: PrinterChannelType;
    private device: USBDevice;
    private printerChannel: IPrinterDeviceChannel;

    // Cache for the nextLine method.
    private nextLineCache: string;

    private _ready: Promise<boolean>;
    /**
     * A promise indicating this printer is ready to be used.
     */
    get ready() {
        return this._ready;
    }

    private _printerCommunicationOptions: PrinterCommunicationOptions;
    get printerCommunicationOptions() {
        return this._printerCommunicationOptions;
    }

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
        await this.getPrinterConfiguration();
        return true;
    }

    /** Close the connection to this printer, preventing future communication from working. */
    public dispose() {
        this.printerChannel.dispose();
    }

    /**
     * Refresh the printer information cache directly from the printer.
     */
    public async getPrinterConfiguration(): Promise<PrinterOptions> {
        throw new Error('Method not implemented.');
    }

    /**
     * Set the static printer options. Don't use often, printer memory has a limited lifecycle.
     * @returns The configuration as reported by the printer, which may differ from set values.
     */
    public async setPrinterConfiguration(options: PrinterOptions): Promise<PrinterOptions> {
        throw new Error('Method not implemented.');
    }

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

    /**
     * Listen for incoming data until a timeout, assuming the source is done.
     */
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
