import { WebZlpError } from '../../WebZlpError.js';
import { LineBreakTransformer } from './LineBreakTransformer.js';
import {
    PrinterChannelType,
    IPrinterDeviceChannel,
    PrinterCommMode,
    PrinterCommunicationError
} from './PrinterCommunication.js';

/** Class for managing the WebUSB communication with a printer. */
export class UsbPrinterDeviceChannel extends EventTarget implements IPrinterDeviceChannel {
    private device: USBDevice;
    private deviceIn: USBEndpoint;
    private deviceOut: USBEndpoint;

    public enableConsoleDebug = false;

    private _commMode: PrinterCommMode;
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

    public get modelHint(): string {
        return this.device?.productName;
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

    public async dispose() {
        try {
            await this.device.close();
        } catch (e) {
            if (
                e instanceof DOMException &&
                e.name === 'NotFoundError' &&
                e.message ===
                    "Failed to execute 'close' on 'USBDevice': The device was disconnected."
            ) {
                // Device was already closed, no-op.
                return;
            }

            throw e;
        }
    }

    public async sendCommands(
        commandBuffer: Uint8Array
    ): Promise<PrinterCommunicationError | null> {
        if (this.enableConsoleDebug) {
            console.debug('Sending print command buffer to printer via USB..');
            console.time('sendPrintBuffer');
        }

        try {
            // TOOD: Add timeout in case of communication hang.
            await this.device.transferOut(this.deviceOut.endpointNumber, commandBuffer);
            return null;
        } catch (e: unknown) {
            if (typeof e === 'string') {
                return new PrinterCommunicationError(e);
            }
            if (e instanceof Error) {
                return new PrinterCommunicationError(null, e);
            }
            // Dunno what this is but we can't wrap it.
            throw e;
        } finally {
            if (this.enableConsoleDebug) {
                console.timeEnd('sendPrintBuffer');
                console.debug('Completed sending print command.');
            }
        }
    }

    private async connect() {
        const d = this.device;

        // Any sane USB device should expose at least one configuration with one
        // interface.
        if (
            d.configurations.length === 0 ||
            d.configurations[0].interfaces.length === 0 ||
            d.configurations[0].interfaces[0].alternates.length === 0
        ) {
            throw new WebZlpError('USB printer did not expose any interfaces.');
        }

        // A standard Zebra printer will have two endpoints on one interface.
        // One of them will be output, one of them will be input. They can be
        // in a random order (or missing!) so we must enumerate them to find them.
        let o: USBEndpoint, i: USBEndpoint;
        for (const endpoint of d.configurations[0].interfaces[0].alternates[0].endpoints) {
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
            throw new WebZlpError(
                'USB printer did not expose an output endpoint. Try power-cycling the printer. This is a hardware problem.'
            );
        } else {
            this.deviceOut = o;
        }

        if (!i) {
            console.warn('USB printer did not expose an input endpoint, using unidirectinal mode.');
        } else {
            this.deviceIn = i;
        }

        this._commMode = this.getCommMode(this.deviceOut != null, this.deviceIn != null);
        if (this._commMode === PrinterCommMode.none) {
            // Can't talk to the printer so don't try.
            return;
        }

        if (this.enableConsoleDebug) {
            console.debug('Comm mode with printer is', PrinterCommMode[this._commMode]);
        }

        // Open the connections! Stop having it be closed!
        try {
            await d.open();
        } catch (e) {
            if (
                e instanceof DOMException &&
                e.name === 'SecurityError' &&
                e.message === "Failed to execute 'open' on 'USBDevice': Access denied."
            ) {
                // This can happen if something else, usually the operating system, has taken
                // exclusive access of the USB device and won't allow WebUSB to take control.
                // This most often happens on Windows. You can use Zadig to replace the driver.
                throw new DriverAccessDeniedError();
            }

            throw e;
        }

        await d.selectConfiguration(1);
        await d.claimInterface(0);

        // Can only read if there's an endpoint to read from, otherwise skip.
        if (this._commMode === PrinterCommMode.bidirectional) {
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

    private getCommMode(output: boolean, input: boolean) {
        if (output === false) {
            // No output means we can't control the printer at all.
            return PrinterCommMode.none;
        }
        if (input === false) {
            // No input means we can't listen for feedback, but can send commands.
            return PrinterCommMode.unidirectional;
        }
        return PrinterCommMode.bidirectional;
    }
}

/** Error indicating the printer's driver cannot be used by WebUSB. */
export class DriverAccessDeniedError extends WebZlpError {
    constructor() {
        super(
            'Operating system prevented accessing the USB device. If this is on Windows you may need to replace the driver. See https://cellivar.github.io/WebZLP/docs/windows_driver for more details.'
        );
    }
}
