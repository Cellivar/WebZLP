import { Printer } from './Printers/Printer';
import { PrinterCommunicationOptions } from './Printers/Communication/PrinterCommunication';

export class PrinterUsbManager extends EventTarget {
    private nav: Navigator;

    /** List of tracked printers. */
    private printers: Printer[] = [];
    /** Corresponding list of tracked devices */
    private devices: USBDevice[] = [];

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

    /** Display the USB device connection dialog to select a printer. */
    public async promptToConnectUsbPrinter() {
        try {
            const device = await this.nav.usb.requestDevice({
                filters: [
                    {
                        vendorId: 0x0a5f // Zebra
                    }
                ]
            });
            console.log(device);

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
        this.printers.forEach(async (p) => await p.dispose());
        this.printers = [];

        navigator.usb.getDevices().then((devices) => {
            devices.forEach(async (device) => {
                await this.handleConnectPrinter({ device });
            });
        });
    }

    /** Handler for printer connection events. */
    public async handleConnectPrinter({ device }): Promise<void> {
        // Reconnection events may fire for known printers, exclude them.
        if (!this.devices.includes(device)) {
            this.devices.push(device);
            const printer = Printer.fromUSBDevice(device, this.printerCommunicationOptions);
            this.printers.push(printer);

            const event = new CustomEvent<Printer>('onConnectPrinter', { detail: printer });
            this.dispatchEvent(event);
        }
    }

    /** Handler for printer disconneciton events. */
    public async handleDisconnectPrinter({ device }): Promise<void> {
        const idx = this.devices.findIndex((i) => i == device);
        if (idx > -1) {
            const printer = this.printers[idx];
            this.devices.splice(idx, 1);
            this.printers.splice(idx, 1);
            await printer.dispose();

            const event = new CustomEvent<Printer>('onDisconnectPrinter', { detail: printer });
            this.dispatchEvent(event);
        }
    }
}
