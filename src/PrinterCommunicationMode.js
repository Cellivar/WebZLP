
/**
 * Enum representing the communication mode of a printer.
 */
export class PrinterCommunicationMode {
    static None = new PrinterCommunicationMode(false, false);
    static Unidirectional = new PrinterCommunicationMode(true, false);
    static Bidirectional = new PrinterCommunicationMode(true, true);

    constructor(output, input){
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
            return PrinterCommunicationMode.None;
        } else if (input === undefined) {
            return PrinterCommunicationMode.Unidirectional;
        } else {
            return PrinterCommunicationMode.Bidirectional;
        }
    }
}
