import { LabelEpl } from './LabelEpl.js';
import { LineBreakTransformer } from './Printers/Communication/LineBreakTransformer.js';
import { PrinterCommunicationMode } from './Printers/Communication/PrinterCommunication';

export class LP2844 {
    #inputStream;
    #nextLineCache;

    labelColor;
    labelDimensionRoundingStep;
    lineSpacing;
    debug;

    #device;
    /**
     * Get the underlying USB device this printer represents.
     */
    get device() {
        return this.#device;
    }

    #deviceOut;
    #deviceIn;

    #serialNumber;
    /**
     * Get the serial number of this printer, if available.
     */
    get serial() {
        return this.#serialNumber;
    }

    #modelNumber;
    /**
     * Get the model ID for this printer.
     */
    get modelId() {
        return this.#modelNumber;
    }

    #firmware;
    /**
     * Get the firmware version of this printer, if available.
     */
    get firmware() {
        return this.#firmware;
    }

    #doubleBuffering = false;
    /**
     * Get whether this printer has double buffering enabled.
     */
    get doubleBuffering() {
        return this.#doubleBuffering;
    }

    #commMode = PrinterCommunicationMode.none;
    /**
     * Get the communication mode this printer is in.
     */
    get communicationMode() {
        return this.#commMode;
    }

    /**
     * @type {Array.<Uint8Array>}
     */
    #rawCmdBuffer = [];
    /**
     * Get the raw command buffer queued for this printer to print.
     * @type {Uint8Array}
     */
    get rawCommandBuffer() {
        const bufferLen = this.#rawCmdBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
        const buffer = new Uint8Array(bufferLen);
        this.#rawCmdBuffer.reduce((offset, arr) => {
            buffer.set(arr, offset);
            return arr.byteLength + offset;
        }, 0);

        return buffer;
    }

    /**
     * Get the ASCII interpreted command buffer. Note that it is not safe to print this directly as it may be sent to the printer as UTF-8.
     */
    get commandBuffer() {
        return new TextDecoder('ascii').decode(this.rawCommandBuffer);
    }

    #speed = 4;
    /**
     * Get the speed setting for this printer.
     */
    get speed() {
        return this.#speed;
    }

    #density = 8;
    /**
     * Get the density (darkness) setting for this printer.
     */
    get density() {
        return this.#density;
    }

    #dpi = 203;
    /**
     * Get the DPI of this printer's print head.
     */
    get dpi() {
        return this.#dpi;
    }

    /**
     * Get the USB Vendor ID for this type of printer
     */
    static get usbVendorId() {
        return 0x0a5f;
    }

    #labelType = LabelEpl;

    #labelWidthIn;
    /**
     * Get the label width in inches.
     */
    get labelWidth() {
        return this.#labelWidthIn;
    }

    /**
     * Set the label's width in inches.
     */
    set labelWidth(value) {
        this.#labelWidthIn = value;
        this.#xLabel = Math.trunc(value * this.#dpi);
    }

    #xLabel;
    /**
     * Get the label width in dots.
     */
    get labelWidthDots() {
        return this.#xLabel;
    }

    #labelHeightIn;
    /**
     * Get the label height in inches.
     */
    get labelHeight() {
        return this.#labelHeightIn;
    }

    /**
     * Set the label heigh in inches.
     */
    set labelHeight(value) {
        this.#labelHeightIn = value;
        this.#yLabel = Math.trunc(value * this.#dpi);
    }

    #yLabel;
    /**
     * Get the label height in dots.
     */
    get labelHeightDots() {
        return this.#yLabel;
    }

    #labelGapIn;
    /**
     * Get the gap between labels in inches.
     */
    get labelGap() {
        return this.#labelGapIn;
    }

    #gLabel;
    /**
     * Get the gap between labels in dots.
     */
    get labelGapDots() {
        return this.#gLabel;
    }

    /**
     * Create a new instance of the LP2844 class.
     *
     * @param {USBDevice} - The WebUSB device object representing the printer.
     * @param {number} lineSpacing - The default line spacing for creating new labels.
     * @param {number} labelDimensionRoundingStep - The nearest fraction of an inch to round label dimensions to. Usually 0.25.
     */
    constructor(device, lineSpacing, labelDimensionRoundingStep) {
        this.#device = device; // The USB device to work with

        this.labelColor = '#FFFFFF'; // Handy to store, not actually used anywhere

        // Additional spacing between lines of text, in dots.
        this.lineSpacing = lineSpacing || 0;

        // Debug flag for dumping commands to the console before sending
        // to the printer
        this.debug = true;

        // The value to round read-from-config label sizes to.
        // Configuration values can often be slightly off from the
        // human-readable value, so this normalizes them.
        // Most labels come in 0.25" increments, if your labels are a different
        // fraction then set the appropriate rounding fraction.
        this.labelDimensionRoundingStep = labelDimensionRoundingStep || 0.25;
    }

    /**
     * Get a label based on this printer's configuration.
     */
    getLabel() {
        return new LabelEpl(
            this.#xLabel,
            this.#yLabel,
            this.#dpi,
            this.lineSpacing,
            this.labelColor
        );
    }

    /**
     * Clear the image buffer. Must be called before printing a new label.
     */
    clearImageBuffer() {
        return this.addCmd('\nN');
    }

    /**
     * Add a P command. Must be called to print a label.
     *
     * @param (int) count - The number of labels to print, 1 or higher.
     */
    addPrintCmd(count) {
        count = Math.trunc(count) || 1;
        count = count < 1 ? 1 : count;

        return this.addCmd(`P${count}`);
    }

    /**
     * Buffer a label's commands into the command buffer. Handy for batches! Does not add a print command.
     *
     * @param label - The label to load into the command buffer.
     */
    bufferLabel(label) {
        if (!(label instanceof this.#labelType)) {
            console.log(`Printer can only print ${this.#labelType} labels.`);
        }

        return this.addRawCmd(label.rawCommandBuffer);
    }

    /**
     * Print a label
     *
     * @param label - The label to print.
     * @param (int) count - The number of copies to print.
     */
    async printLabel(label, count) {
        await this.bufferLabel(label).addPrintCmd(count).print();
    }

    /**
     * Send the commands in the command buffer to the printer, clearing the buffer.
     */
    async print() {
        console.debug('Sending print command to printer..');
        if (this.debug) {
            console.debug(this.commandBuffer);
        }
        try {
            await this.#device.transferOut(this.#deviceOut.endpointNumber, this.rawCommandBuffer);
            console.debug('Completed sending print command.');
        } catch (e) {
            console.error(`Print error: ${e.name}: ${e.message}`);
        } finally {
            this.clearCommandBuffer();
        }
    }

    /**
     * Cut the last printed label. Avoid cutting when there is nothing to cut.
     */
    async cut() {
        await this.addCmd('C').print();
    }

    /**
     * Feed a blank label.
     */
    async feed() {
        await this.clearImageBuffer().addPrintCmd(1).print();
    }

    /**
     * Set up the printer connection. Must be done before calling any
     * other methods.
     */
    async connect(debugByLoggingPrinterToConsole) {
        const d = this.#device;

        // Each printer will have one input and one output interface
        // Go find them.
        let o, i;
        for (const endpoint of d.configuration.interfaces[0].alternates[0].endpoints) {
            if (endpoint.direction == 'out') {
                o = endpoint;
            } else if (endpoint.direction == 'in') {
                i = endpoint;
            }
        }

        if (!o) {
            console.error('Failed to find an output for printer, cannot communicate!');
        } else {
            this.#deviceOut = o;
        }

        if (!i) {
            console.warn('Failed to find an input endpoint for printer, using unidirectinal mode.');
        } else {
            this.#deviceIn = i;
        }

        this.#commMode = PrinterCommunicationMode.getCommunicationMode(
            this.#deviceOut,
            this.#deviceIn
        );
        if (this.#commMode === PrinterCommunicationMode.none) {
            // Can't talk to the printer so don't try.
            return;
        }

        // And wire 'em up!
        await d.open();
        await d.selectConfiguration(1);
        await d.claimInterface(0);

        if (this.#commMode === PrinterCommunicationMode.bidirectional) {
            this.#inputStream = new ReadableStream({
                pull: async (controller) => {
                    const result = await this.#device.transferIn(this.#deviceIn.endpointNumber, 64);
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

            // Test the connection by pulling the current configuration.
            await this.configGetFromPrinter();

            if (debugByLoggingPrinterToConsole) {
                // Whatever messages arrive will be dumped straight to the
                // console. Note that this eats up the incoming data so
                // other listening commands won't work while this is active.
                this.#listenForDataAndConsoleLogAlways();
            }
        } else {
            this.#serialNumber = 'Manual Setup';
        }

        return this.#commMode;
    }

    /**
     * Get the current configuration from the printer, overwriting any
     * uncommitted configuration changes.
     */
    async configGetFromPrinter() {
        let config;
        let validConfig = false;
        let retryLimit = 3;
        do {
            retryLimit--;

            // Start listening for the response we're about to generate
            const listenResult = this.#listenForData();

            await this.clearImageBuffer().addCmd('UQ').print();

            const rawText = await listenResult;
            config = this.#parseConfigInquiry(rawText);

            if (this.debug) {
                console.debug(config);
            }

            // All firmwares return these values, if they failed to parse
            // out for any reason it means we got an error reading the
            // config and we should try again.
            validConfig =
                Object.prototype.hasOwnProperty.call(config, 'labelWidthDots') &&
                Object.prototype.hasOwnProperty.call(config, 'firmware') &&
                Object.prototype.hasOwnProperty.call(config, 'speed');
        } while (!validConfig && retryLimit > 0);

        this.#density = config.density;
        this.#doubleBuffering = config.doubleBuffering;
        this.#speed = config.speed;
        this.#serialNumber = config.serial;
        this.#firmware = config.firmware;
        this.#gLabel = config.labelGapDots;

        const rawX = config.labelWidthDots / this.#dpi;
        const rawY = config.labelHeightDots / this.#dpi;
        const inverse = 1.0 / this.labelDimensionRoundingStep;

        this.labelWidth = Math.round(rawX * inverse) / inverse;
        this.labelHeight = Math.round(rawY * inverse) / inverse;
    }

    /**
     * Parse the configuration coming from the printer
     */
    #parseConfigInquiry(rawText) {
        const lines = rawText
            .replaceAll('\r', '')
            .split('\n')
            .filter((i) => i);

        // UKQ1935HLU     V4.29    # ID code and firmware version
        // First line determines firmware version to read and is consistent
        // across observed dumps.
        const header = lines[0].split(' ').filter((i) => i);
        // First element is always the model ID
        const modelId = header[0];
        // Header may include "FDX", indicating a nonstandard unit.
        // We ignore this and jump to the last element, which will be
        // the firmware version
        const firmware = header[header.length - 1];

        const result = {
            model: modelId,
            firmware: firmware,
            serial: 'no_serial'
        };

        return result;
    }

    async #nextLine() {
        if (this.#nextLineCache) {
            const line = this.#nextLineCache;
            this.#nextLineCache = null;
            return line;
        }

        let timedOut = false;
        const nextLinePromise = (async () => {
            const reader = this.#inputStream.getReader();
            const { value, done } = await reader.read();
            reader.releaseLock();

            if (done) {
                return;
            }

            if (timedOut) {
                this.#nextLineCache = value;
                return;
            }

            return value;
        })();

        const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                timedOut = true;
                resolve();
            }, 200);
        });

        return Promise.race([nextLinePromise, timeoutPromise]);
    }

    async #listenForDataAndConsoleLogAlways() {
        for (;;) {
            const line = await this.#nextLine();
            console.log("PRINTER SAYS TEXT IN SINGLE QUOTES\n'" + line + "'");
        }
    }

    async #listenForData() {
        let aggregate = '';
        for (;;) {
            const line = await this.#nextLine();
            if (line === undefined) {
                return aggregate;
            }
            aggregate += line + '\n';
        }
    }

    /**
     * Disconnect from the printer. Further commands will fail. Create a
     * new instance instead of trying to re-use this one after disposal.
     */
    async dispose() {
        await this.#device.close();
    }

    /**
     * Draw a test pattern that looks like
     * ████████████
     * ███
     *    ███
     *       ███
     *          ███
     * ////////////
     */
    async printTestPage() {
        await this.configLabelWidth();

        const label = this.getLabel();

        const quarter = label.labelWidthDots / 4;
        const lineHeight = 20;

        label
            .setOffset(0, 0)
            .addLine(label.labelWidthDots, lineHeight * 2)
            .setOffset(0, lineHeight * 2)
            .addLine(quarter, lineHeight)
            .setOffset(quarter, lineHeight * 3)
            .addLine(quarter, lineHeight)
            .setOffset(quarter * 2, lineHeight * 4)
            .addLine(quarter, lineHeight)
            .setOffset(quarter * 3, lineHeight * 5)
            .addLine(quarter, lineHeight)
            .setOffset(0, lineHeight * 6);

        const slashStart = lineHeight * 6 + 5;
        const slashHeight = 8;
        for (let i = 0; i <= label.labelWidthDots; i += 4) {
            label
                .setOffset(i + 0, slashStart + 0)
                .addLine(1, slashHeight)
                .setOffset(i + 1, slashStart + slashHeight)
                .addLine(1, slashHeight)
                .setOffset(i + 2, slashStart + slashHeight * 2)
                .addLine(1, slashHeight)
                .setOffset(i + 3, slashStart + slashHeight * 3)
                .addLine(1, slashHeight);
        }
        await this.printLabel(label, 1);
    }

    /**
     * Send the configured label width to the printer
     */
    async configLabelWidth() {
        await this.clearImageBuffer()
            .addCmd('q' + this.#xLabel)
            .print();
    }

    /**
     * Perform an autocalibration for the label length
     */
    async setLabelHeightCalibration() {
        await this.clearImageBuffer().addCmd('xa').print();
    }

    /**
     * Configure the density (darkness) of the print.
     *
     * @param (int) density - 0 (light) through 15 (dark) print density.
     */
    async configDensity(density) {
        density = parseInt(density) || 8;
        density = density < 0 || density > 15 ? 8 : density;

        await this.clearImageBuffer()
            .addCmd('D' + density)
            .print();
    }

    /**
     * Reset the printer, same as turning it off and on.
     */
    async configReset() {
        await this.clearImageBuffer().addCmd('^@').print();
    }

    /**
     * Set the direction the label prints (top to bottom or bottom to top)
     *
     * @param (bool) upsideDown - True to print upside down, otherwise rightside up.
     */
    async configPrintDirection(upsideDown) {
        upsideDown = upsideDown || false;
        const dir = upsideDown ? 'T' : 'B';
        await this.clearImageBuffer()
            .addCmd('Z' + dir)
            .print();
    }

    /**
     * Configure the speed of the print.
     *
     * @param (int) speed - 1 (slow) to 4 (fast) print speed.
     */
    async configSpeed(speed) {
        speed = parseInt(speed) || 4;
        speed = speed < 1 || speed > 4 ? 4 : speed;

        await this.clearImageBuffer()
            .addCmd('S' + speed)
            .print();
    }

    /**
     * Add command, concatenating given parameters with a comma.
     *
     * @param (array) parameters - The command and parameters to add, first element should be the command and the first parameter.
     *
     * @example
     * addCmd("A10", 10, 0, 1, 1, 1, "N", "Hello World!");
     */
    addCmd(...parameters) {
        this.addRawCmd(new TextEncoder().encode(parameters.join(',') + '\n'));
        return this;
    }

    /**
     * Add a raw byte array to the command buffer.
     *
     * @param (Uint8Array) array - Array of ASCII characters for the command to add.
     */
    addRawCmd(array) {
        this.#rawCmdBuffer.push(array);
        return this;
    }

    /**
     * Empty the command buffer.
     */
    clearCommandBuffer() {
        this.#rawCmdBuffer = [];
        return this;
    }
}
