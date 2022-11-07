/** A communication channel for talking to a printer device. */
export interface IPrinterDeviceChannel {
    /** Whether to print communications to the console. */
    enableConsoleDebug: boolean;

    /** Gets the mode the communication is set up as. */
    get commMode(): PrinterCommunicationMode;

    /** Gets this channel mode. */
    get channelMode(): PrinterChannelType;

    /** Gets the printer model hint, if available. Used to detect config faster. */
    get modelHint(): string;

    /** A promise indicating this communication channel is ready for use. */
    get ready(): Promise<boolean>;

    /** Gets the stream for receiving data from this printer. */
    get streamFromPrinter(): ReadableStream<string>;

    /** Close the channel, disallowing future communication. */
    dispose(): Promise<void>;

    /**
     * Send a series of commands to the printer.
     * @param commandBuffer The series of commands to execute in order.
     */
    sendCommands(commandBuffer: Uint8Array): Promise<PrinterError | null>;
}

/** Error generated from a print operation. */
export interface PrinterError {
    message: string;
}

/** Possible ways to communicate with a printer */
export enum PrinterChannelType {
    /** Printer is connected to the local machine via USB. */
    usb,
    /** Printer is connected to the local machine via Serial. */
    serial,
    /** Printer is connected to the local machine via Bluetooth. */
    bluetooth,
    /** Printer is available on the network. */
    network
}

/**
 * Enum representing the communication mode of a printer.
 */
export class PrinterCommunicationMode {
    static none = new PrinterCommunicationMode(false, false);
    static unidirectional = new PrinterCommunicationMode(true, false);
    static bidirectional = new PrinterCommunicationMode(true, true);

    output;
    input;

    constructor(output, input) {
        this.output = output;
        this.input = input;
    }

    /**
     * Get the communication mode based on input and output objects
     *
     * @param {*} output - The output endpoint object to check for.
     * @param {*} input - The input endpoint object to check for.
     * @returns The communication mode of the printer based on available endpoints.
     */
    static getCommunicationMode(output, input) {
        if (output === undefined) {
            return PrinterCommunicationMode.none;
        } else if (input === undefined) {
            return PrinterCommunicationMode.unidirectional;
        } else {
            return PrinterCommunicationMode.bidirectional;
        }
    }
}

export class PrinterCommunicationOptions {
    /**
     * Value to use for rounding read-from-config label sizes.
     *
     * When reading the config from a printer the label width and height may be
     * variable. When you set the label width to 4 inches it's translated into
     * dots, and then the printer adds a calculated offset to that. This offset
     * is unique per printer (so far as I have observed) and introduces noise.
     * This value rounds the returned value to the nearest fraction of an inch.
     * If the printer returns a width 4.113 it will be rounded to 4.0
     */
    public labelDimensionRoundingStep = 0.25;

    /**
     * Whether to display printer communication to the dev console
     */
    public debug = false;
}
