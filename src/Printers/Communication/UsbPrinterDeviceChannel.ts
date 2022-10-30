import { WebZplError } from '../../WebZplError';
import { LineBreakTransformer } from './LineBreakTransformer';
import {
    PrinterChannelType,
    PrinterCommunicationMode,
    IPrinterDeviceChannel
} from './PrinterCommunication';

/** Class for managing the WebUSB communication with a printer. */
export class UsbPrinterDeviceChannel extends EventTarget implements IPrinterDeviceChannel {
    private device: USBDevice;
    private deviceIn: USBEndpoint;
    private deviceOut: USBEndpoint;

    public enableConsoleDebug = false;

    private _commMode: PrinterCommunicationMode;
    public get commMode() {
        return this._commMode;
    }

    get channelMode(): PrinterChannelType {
        return PrinterChannelType.usb;
    }

    private _ready: Promise<boolean>;
    public get ready(): Promise<boolean> {
        return this._ready;
    }

    private inputStream: ReadableStream<string>;
    public get streamFromPrinter() {
        return this.inputStream;
    }

    constructor(device: USBDevice, enableConsoleDebug = false) {
        super();

        this.device = device;
        this.enableConsoleDebug = enableConsoleDebug;

        this._ready = this.setup();
    }

    private async setup() {
        await this.connect();
        return true;
    }

    public dispose() {
        this.device.close();
    }

    public async sendCommands(commandBuffer: Uint8Array) {
        if (this.enableConsoleDebug) {
            console.debug('Sending print command buffer to printer via USB..');
            console.debug(commandBuffer);
            console.time('sendPrintBuffer');
        }

        try {
            await this.device.transferOut(this.deviceOut.endpointNumber, commandBuffer);
        } catch (e: unknown) {
            const event = new CustomEvent<unknown>('usbPrinterDeviceOutError', e);
            this.dispatchEvent(event);
        } finally {
            if (this.enableConsoleDebug) {
                console.timeEnd('sendPrintBuffer');
                console.debug('Completed sending print command.');
            }
        }
    }

    private async connect() {
        const d = this.device;

        // A standard Zebra printer will have two endpoints on one interface.
        // One of them will be output, one of them will be input. They can be
        // in a random order (or missing!) so we must enumerate them to find them.
        let o: USBEndpoint, i: USBEndpoint;
        for (const endpoint of d.configuration.interfaces[0].alternates[0].endpoints) {
            if (endpoint.direction == 'out') {
                o = endpoint;
            } else if (endpoint.direction == 'in') {
                i = endpoint;
            }
        }

        // For no apparent reason sometimes printers will omit to advertise the
        // input endpoint. Sometimes they'll also omit the output endpoint. This
        // attempts to handle those situations in a degraded mode.
        if (!o) {
            throw new WebZplError(
                'USB printer did not expose an output channel. Try power-cycling the printer. This is a hardware problem.'
            );
        } else {
            this.deviceOut = o;
        }

        if (!i) {
            console.warn('USB printer did not expose an input channel, using unidirectinal mode.');
        } else {
            this.deviceIn = i;
        }

        this._commMode = PrinterCommunicationMode.getCommunicationMode(
            this.deviceOut,
            this.deviceIn
        );
        if (this._commMode === PrinterCommunicationMode.none) {
            // Can't talk to the printer so don't try.
            return;
        }

        // Open the connections! Stop having it be closed!
        await d.open();
        await d.selectConfiguration(1);
        await d.claimInterface(0);

        if (this._commMode === PrinterCommunicationMode.bidirectional) {
            this.inputStream = new ReadableStream<Uint8Array>({
                pull: async (controller) => {
                    const result = await this.device.transferIn(this.deviceIn.endpointNumber, 64);
                    const chunk = new Uint8Array(
                        result.data.buffer,
                        result.data.byteOffset,
                        result.data.byteLength
                    );
                    controller.enqueue(chunk);
                }
            })
                .pipeThrough(new TextDecoderStream())
                .pipeThrough(new TransformStream(new LineBreakTransformer()));
        }
    }
}
