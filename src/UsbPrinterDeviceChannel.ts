import { IPrinterDeviceChannel } from './IPrinterDeviceChannel';
import { LineBreakTransformer } from './LineBreakTransformer';
import { PrinterCommunicationMode } from './PrinterCommunicationMode';

/**
 * Class for managing the WebUSB communication with a printer.
 */
export class UsbPrinterDeviceChannel extends EventTarget implements IPrinterDeviceChannel {
    private device: USBDevice;
    private deviceIn: USBEndpoint;
    private deviceOut: USBEndpoint;

    public EnableConsoleDebug = false;

    private commMode: PrinterCommunicationMode;
    /**
     * Gets the mode the communication is set up as.
     */
    public CommMode() {
        return this.commMode;
    }

    private ready: Promise<boolean>;
    public Ready(): Promise<boolean> {
        return this.ready;
    }

    private inputStream: ReadableStream;
    public StreamFromPrinter() {
        return this.inputStream;
    }

    constructor(device: USBDevice, enableConsoleDebug = false) {
        super();

        this.device = device;
        this.EnableConsoleDebug = enableConsoleDebug;

        this.ready = new Promise((resolve, reject) => {
            this.Connect()
                .then(() => {
                    resolve(true);
                })
                .catch(reject);
        });
    }

    public Dispose() {
        this.device.close();
    }

    public async SendCommands(commandBuffer: Uint8Array) {
        if (this.EnableConsoleDebug) {
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
            if (this.EnableConsoleDebug) {
                console.timeEnd('sendPrintBuffer');
                console.debug('Completed sending print command.');
            }
        }
    }

    private async Connect() {
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
            console.error('Failed to find an output for USB printer, cannot communicate!');
        } else {
            this.deviceOut = o;
        }

        if (!i) {
            console.warn(
                'Failed to find an input endpoint for USB printer, using unidirectinal mode.'
            );
        } else {
            this.deviceIn = i;
        }

        this.commMode = PrinterCommunicationMode.getCommunicationMode(
            this.deviceOut,
            this.deviceIn
        );
        if (this.commMode === PrinterCommunicationMode.None) {
            // Can't talk to the printer so don't try.
            return;
        }

        // Open the connections! Stop having it be closed!
        await d.open();
        await d.selectConfiguration(1);
        await d.claimInterface(0);

        if (this.commMode === PrinterCommunicationMode.Bidirectional) {
            this.inputStream = new ReadableStream({
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
