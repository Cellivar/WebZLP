import { WebZlpError } from '../../WebZlpError';
/** A communication channel for talking to a printer device. */
export interface IPrinterDeviceChannel {
    /** Whether to print communications to the console. */
    enableConsoleDebug: boolean;

    /** Gets the mode the communication is set up as. */
    get commMode(): PrinterCommMode;

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
    sendCommands(commandBuffer: Uint8Array): Promise<PrinterCommunicationError | null>;
}

/** Error indicating communication with the printer has failed. */
export class PrinterCommunicationError extends WebZlpError {
    constructor(message?: string, innerException?: Error) {
        super(message ?? innerException.message);
        this.innerException = innerException;
    }

    innerException: Error;
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

export enum PrinterCommMode {
    none,
    unidirectional,
    bidirectional
}
