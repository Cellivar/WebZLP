import { PrinterCommunicationMode } from './PrinterCommunicationMode';

/**
 * A communication channel for talking to a printer device.
 */
export interface IPrinterDeviceChannel {
    /**
     * Gets the mode the communication is set up as.
     */
    CommMode(): PrinterCommunicationMode;

    /**
     * Close the channel, disallowing future communication.
     */
    Dispose(): void;

    /**
     * Gets the stream for receiving data from this printer.
     */
    StreamFromPrinter(): ReadableStream;

    /**
     * A promise indicating this communication channel is ready for use.
     */
    Ready(): Promise<boolean>;

    /**
     * Whether to print communications to the console.
     */
    EnableConsoleDebug: boolean;

    /**
     * Send a series of commands to the printer
     * @param commandBuffer The series of commands to execute in order.
     */
    SendCommands(commandBuffer: Uint8Array): void;
}
