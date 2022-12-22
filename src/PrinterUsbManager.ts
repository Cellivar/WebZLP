import { Printer } from './Printers/Printer';
import { PrinterCommunicationOptions } from './Printers/PrinterCommunicationOptions';

export interface PrinterManagerEventMap {
    connectedPrinter: CustomEvent<{ detail: Printer }>;
    disconnectedPrinter: CustomEvent<{ detail: Printer }>;
}

/** Singleton for handling USB printer management.
 *
 * This class can be used to handle the WebUSB communication management for you instead of handling
 * printer communication yourself. The promptToConnect method is used to prompt the user to select
 * a printer using the browser's UI. Once paired at least once the browser will rember and reconnect
 * automatically.
 *
 * This class exposes two events, which your code should add handlers for:
 * *
 *
 * This class will bind to WebUSB events on the Navigator element, your code should ensure only
 * one instance is ever instantiated to avoid conflicts.
 */
export class PrinterUsbManager extends EventTarget {
    private nav: Navigator;

    /** List of tracked printers. */
    private _printers: Printer[] = [];
    public get printers(): readonly Printer[] {
        return this._printers;
    }
    /** Corresponding list of tracked devices */
    private devices: USBDevice[] = [];
    // TODO: Switch to Record since we use this for a reverse mapping.

    /** Default comm options used when connecting to a printer. */
    public printerCommunicationOptions: PrinterCommunicationOptions;

    constructor(nav: Navigator, printerCommOpts?: PrinterCommunicationOptions) {
        super();
        this.nav = nav;
        this.printerCommunicationOptions = printerCommOpts ?? new PrinterCommunicationOptions();

        // Since this was created assume control over USB.
        this.nav.usb.addEventListener('connect', this.handleConnectPrinter.bind(this));
        this.nav.usb.addEventListener('disconnect', this.handleDisconnectPrinter.bind(this));
    }

    public addEventListener<T extends keyof PrinterManagerEventMap>(
        type: T,
        listener: (this: PrinterUsbManager, ev: PrinterManagerEventMap[T]) => void,
        options?: boolean | AddEventListenerOptions
    ): void;
    public addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        super.addEventListener(type, callback, options);
    }

    /** Display the USB device connection dialog to select a printer. */
    public async promptToConnectUsbPrinter(options?: USBDeviceRequestOptions) {
        try {
            const device = await this.nav.usb.requestDevice(
                options ?? {
                    filters: [
                        {
                            vendorId: 0x0a5f // Zebra
                        }
                    ]
                }
            );
            await this.handleConnectPrinter({ device });
        } catch (e) {
            if (
                e instanceof DOMException &&
                e.name === 'NotFoundError' &&
                e.message === 'No device selected.'
            ) {
                console.log('User did not select a printer');
                return;
            }

            console.log('Failed to connect to printer!');
            console.log(e);
            return;
        }
    }

    /** Simulate all printers being disconnected and reconnected. */
    public async reconnectAllPrinters() {
        this.devices = [];
        await Promise.all(this._printers.map(async (p) => await p.dispose()));
        this._printers = [];

        const devices = await navigator.usb.getDevices();
        await Promise.all(
            devices.map(async (device) => await this.handleConnectPrinter({ device }))
        );
    }

    /** Handler for printer connection events. */
    public async handleConnectPrinter({ device }): Promise<void> {
        // Reconnection events may fire for known printers, exclude them.
        if (this.devices.includes(device)) {
            return;
        }
        this.devices.push(device);
        const printer = Printer.fromUSBDevice(device, this.printerCommunicationOptions);
        this._printers.push(printer);

        // Don't notify that the printer exists until it's ready to exist.
        await printer.ready;

        const event = new CustomEvent<Printer>('connectedPrinter', { detail: printer });
        this.dispatchEvent(event);
    }

    /** Handler for printer disconnection events. */
    public async handleDisconnectPrinter({ device }): Promise<void> {
        const idx = this.devices.findIndex((i) => i == device);
        if (idx < 0) {
            return;
        }
        const printer = this._printers[idx];
        this.devices.splice(idx, 1);
        this._printers.splice(idx, 1);
        await printer.dispose();

        const event = new CustomEvent<Printer>('disconnectedPrinter', { detail: printer });
        this.dispatchEvent(event);
    }
}
