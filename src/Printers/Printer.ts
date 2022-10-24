import { IPrinterDeviceChannel } from '../IPrinterDeviceChannel';
import { PrinterCommunicationOptions } from '../PrinterCommunicationOptions';
import { UsbPrinterDeviceChannel } from '../UsbPrinterDeviceChannel';

/**
 * A class for working with a label printer.
 */
export class Printer {
    // Printer communication handles
    private device: USBDevice;
    private printerChannel: IPrinterDeviceChannel;

    private ready: Promise<boolean>;
    /**
     * A promise indicating this printer is ready to be used.
     */
    get Ready() {
        return this.ready;
    }

    private printerCommunicationOptions: PrinterCommunicationOptions;
    get PrinterCommunicationOptions() {
        return this.printerCommunicationOptions;
    }

    constructor(device: USBDevice, options?: PrinterCommunicationOptions) {
        this.printerCommunicationOptions = options ?? new PrinterCommunicationOptions();

        // Future TODO: Make this able to be dynamically changed out with
        // WebSerial, WebBluetooth, etc. for other comm modes.
        // Some kind of factory.
        this.device = device;
        this.printerChannel = new UsbPrinterDeviceChannel(
            this.device,
            this.PrinterCommunicationOptions.Debug
        );

        this.ready = new Promise((resolve, reject) => {
            this.printerChannel
                .Ready()
                .then(() => {
                    this.GetPrinterConfiguration().then(() => {
                        resolve(true);
                    });
                })
                .catch(reject);
        });
    }

    /**
     * Refresh the printer information cache directly from the printer.
     */
    private async GetPrinterConfiguration() {
        throw new Error('Method not implemented.');
    }

    public async SetPrinterOptions(options: PrinterOptions) {
        throw new Error('Method not implemented.');
    }

    /**
     * Round a raw inch value to the nearest configured inch step.
     */
    private RoundToNearestIncheStep(value: number): number {
        const inverse = 1.0 / this.printerCommunicationOptions.LabelDimensionRoundingStep;
        return Math.round(value * inverse) / inverse;
    }
}
