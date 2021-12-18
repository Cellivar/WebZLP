import { LabelEpl } from "./LabelEpl.js";
import { LineBreakTransformer } from "./LineBreakTransformer.js";
import { PrinterCommunicationMode } from "./PrinterCommunicationMode.js";

export class LP2844 {
    #inputStream;
    #nextLineCache;

    #device;
    /**
     * Get the underlying USB device this printer represents.
     */
    get device() { return this.#device }

    #deviceOut;
    #deviceIn;

    #serialNumber;
    /**
     * Get the serial number of this printer, if available.
     */
    get serial() { return this.#serialNumber; }

    #modelNumber;
    /**
     * Get the model ID for this printer.
     */
    get modelId() { return this.#modelNumber; }

    #firmware;
    /**
     * Get the firmware version of this printer, if available.
     */
    get firmware() { return this.#firmware; }

    #doubleBuffering = false;
    /**
     * Get whether this printer has double buffering enabled.
     */
    get doubleBuffering() { return this.#doubleBuffering; }

    #commMode = PrinterCommunicationMode.None;
    /**
     * Get the communication mode this printer is in.
     */
    get communicationMode() { return this.#commMode }

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
        return new TextDecoder("ascii").decode(this.rawCommandBuffer);
    }

    #speed = 4;
    /**
     * Get the speed setting for this printer.
     */
    get speed() { return this.#speed; }

    #density = 8;
    /**
     * Get the density (darkness) setting for this printer.
     */
    get density() { return this.#density; }

    #dpi = 203;
    /**
     * Get the DPI of this printer's print head.
     */
    get dpi() { return this.#dpi; }

    /**
     * Get the USB Vendor ID for this type of printer
     */
    static get usbVendorId() { return 0x0a5f; }

    #labelType = LabelEpl;

    #labelWidthIn;
    /**
     * Get the label width in inches.
     */
    get labelWidth() { return this.#labelWidthIn; }

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
    get labelWidthDots() { return this.#xLabel; }

    #labelHeightIn;
    /**
     * Get the label height in inches.
     */
    get labelHeight() { return this.#labelHeightIn; }

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
    get labelHeightDots() { return this.#yLabel; }

    #labelGapIn;
    /**
     * Get the gap between labels in inches.
     */
    get labelGap() { return this.#labelGapIn; }

    #gLabel;
    /**
     * Get the gap between labels in dots.
     */
    get labelGapDots() { return this.#gLabel; }

    /**
     * Create a new instance of the LP2844 class.
     *
     * @param {USBDevice} - The WebUSB device object representing the printer.
     * @param {number} lineSpacing - The default line spacing for creating new labels.
     * @param {number} labelDimensionRoundingStep - The nearest fraction of an inch to round label dimensions to. Usually 0.25.
     */
    constructor(device, lineSpacing, labelDimensionRoundingStep) {
        this.#device = device; // The USB device to work with

        this.labelColor = "#FFFFFF" // Handy to store, not actually used anywhere

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
        return new LabelEpl(this.#xLabel, this.#yLabel, this.#dpi, this.lineSpacing, this.color);
    }

    /**
     * Clear the image buffer. Must be called before printing a new label.
     */
    clearImageBuffer() {
        return this.addCmd("\nN");
    }

    /**
     * Add a P command. Must be called to print a label.
     *
     * @param (int) count - The number of labels to print, 1 or higher.
     */
    addPrintCmd(count) {
        count = Math.trunc(count) || 1;
        count = (count < 1) ? 1 : count;

        return this.addCmd(`P${count}`);
    }

    /**
     * Buffer a label's commands into the command buffer. Handy for batches! Does not add a print command.
     *
     * @param label - The label to load into the command buffer.
     */
    bufferLabel(label) {
        if (!(label instanceof (this.#labelType))) {
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
        await this.bufferLabel(label)
          .addPrintCmd(count)
          .print();
    }

    /**
     * Send the commands in the command buffer to the printer, clearing the buffer.
     */
    async print() {
        console.debug("Sending print command to printer..");
        if (this.debug) {
            console.debug(this.commandBuffer);
        }
        try {
            await this.#device.transferOut(this.#deviceOut.endpointNumber, this.rawCommandBuffer);
            console.debug("Completed sending print command.");
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
        await this.addCmd("C").print();
    }

    /**
     * Feed a blank label.
     */
    async feed() {
        await this.clearImageBuffer().addPrintCmd().print();
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
        for (let endpoint of d.configuration.interfaces[0].alternates[0].endpoints) {
            if (endpoint.direction == 'out') {
                o = endpoint;
            } else if (endpoint.direction == 'in') {
                i = endpoint;
            }
        }

        if (!o) {
            console.error("Failed to find an output for printer, cannot communicate!");
        } else {
            this.#deviceOut = o;
        }

        if (!i) {
            console.warn("Failed to find an input endpoint for printer, using unidirectinal mode.");
        } else {
            this.#deviceIn = i;
        }

        this.#commMode = PrinterCommunicationMode.getCommunicationMode(this.#deviceOut, this.#deviceIn);
        if (this.#commMode === PrinterCommunicationMode.None) {
            // Can't talk to the printer so don't try.
            return;
        }

        // And wire 'em up!
        await d.open();
        await d.selectConfiguration(1);
        await d.claimInterface(0);

        if (this.#commMode === PrinterCommunicationMode.Bidirectional) {
            this.#inputStream = new ReadableStream({
                pull: async (controller) => {
                    const result = await this.#device.transferIn(this.#deviceIn.endpointNumber, 64);
                    const chunk = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
                    controller.enqueue(chunk);
                },
            }).pipeThrough(new TextDecoderStream())
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
            this.#serialNumber = "Manual Setup";
        }

        return this.#commMode;
    }

    /**
     * Get the current configuration from the printer, overwriting any
     * uncommitted configuration changes.
     */
    async configGetFromPrinter() {
        var config;
        var validConfig = false;
        var retryLimit = 3;
        do {
            retryLimit--;

            // Start listening for the response we're about to generate
            let listenResult = this.#listenForData();

            await this.clearImageBuffer().addCmd("UQ").print();

            let rawText = await listenResult;
            config = this.#parseConfigInquiry(rawText);

            if (this.debug) {
                console.debug(config);
            }

            // All firmwares return these values, if they failed to parse
            // out for any reason it means we got an error reading the
            // config and we should try again.
            validConfig = config.hasOwnProperty("labelWidthDots") &&
                config.hasOwnProperty("firmware") &&
                config.hasOwnProperty("speed");
        } while (!validConfig && retryLimit > 0)

        this.#density = config.density;
        this.#doubleBuffering = config.doubleBuffering;
        this.#speed = config.speed;
        this.#serialNumber = config.serial;
        this.#firmware = config.firmware;
        this.#gLabel = config.labelGapDots;

        let rawX = config.labelWidthDots / this.#dpi;
        let rawY = config.labelHeightDots / this.#dpi;
        let inverse = 1.0 / this.labelDimensionRoundingStep

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
            .filter(i => i);

        // UKQ1935HLU     V4.29    # ID code and firmware version
        // First line determines firmware version to read and is consistent
        // across observed dumps.
        const header = lines[0].split(' ').filter(i => i);
        // First element is always the model ID
        const modelId = header[0];
        // Header may include "FDX", indicating a nonstandard unit.
        // We ignore this and jump to the last element, which will be
        // the firmware version
        const firmware = header[header.length - 1];

        let result = {
            model: modelId,
            firmware: firmware,
            serial: "no_serial"
        };

        // All the rest of these follow some kind of standard pattern for
        // each value which we can pick up with regex. The cases here are
        // built out of observed configuration dumps.
        for (let i = 1; i < lines.length; i++) {
            let str = lines[i]
            switch (true) {
                case /^S\/N.*/.test(str):
                    // S/N: 42A000000000       # Serial number
                    result.serial = str.substring(5).trim();
                    break;
                case /^Serial\sport/.test(str):
                    // Serial port:96,N,8,1    # Serial port config
                    result.serialPort = str.substring(12).trim();
                    break;
                case /^q\d+\sQ/.test(str):
                    // q600 Q208,25            # Form width (q) and length (Q), with label gap
                    let settingsForm = str.trim().split(' ');
                    let length = settingsForm[1].split(',');
                    result.labelWidthDots = parseInt(settingsForm[0].substring(1));
                    result.labelGapDots = parseInt(length[1].trim());
                    // Height is more reliable when subtracting the gap. It's still not perfect..
                    result.labelHeightDots = parseInt(length[0].substring(1)) - result.labelGapDots;
                    break;
                case /^S\d\sD\d\d\sR/.test(str):
                    // S4 D08 R112,000 ZB UN   # Config settings 2
                    let settings2 = str.trim().split(' ');
                    let ref = settings2[2].split(',');
                    result.speed = parseInt(settings2[0].substring(1));
                    result.density = parseInt(settings2[1].substring(1));
                    result.xRef = parseInt(ref[0].substring(1));
                    result.yRef = parseInt(ref[1]);
                    break;
                case /^I\d,.,\d\d\d\sr[YN]/.test(str):
                    // I8,A,001 rY JF WY       # Config settings 1
                    let settings1 = str.split(' ');
                    result.doubleBuffering = settings1[1][1] === 'Y'
                    break;
                case /^HEAD\s\s\s\susage\s=/.test(str):
                    // HEAD    usage =     249,392"    # Odometer of the head
                    let headsplit = str.substring(15).split(' ');
                    result.headDistanceIn = headsplit[headsplit.length - 1];
                    break;
                case /^PRINTER\susage\s=/.test(str):
                    // PRINTER usage =     249,392"    # Odometer of the printer
                    let printsplit = str.substring(15).split(' ');
                    result.printerDistanceIn = printsplit[printsplit.length - 1];
                    break;
                case /^\d\d\s\d\d\s\d\d\s$/.test(str):
                // 06 10 14                # AutoSense settings, see below
                case /^oE.,/.test(str):
                // oEv,w,x,y,z             # Config settings 4, see below
                case /^Option:/.test(str):
                // Option:D,Ff             # Config settings 3, see below
                case /^Emem:/.test(str):
                // Emem:031K,0037K avl     # Soft font storage
                case /^Gmem:/.test(str):
                // Gmem:000K,0037K avl     # Graphics storage
                case /^Fmem:/.test(str):
                // Fmem:000.0K,060.9K avl  # Form storage
                case /^Emem used:/.test(str):
                // Emem used: 0     # Soft font storage
                case /^Gmem used:/.test(str):
                // Gmem used: 0            # Graphics storage
                case /^Fmem used:/.test(str):
                // Fmem used: 0 (bytes)    # Form storage
                case /^Available:/.test(str):
                // Available: 130559       # Total memory for Forms, Fonts, or Graphics
                case /^Cover:/.test(str):
                // Cover: T=118, C=129     # (T)reshold and (C)urrent Head Up (open) sensor.
                case /^Image buffer size:/.test(str):
                // Image buffer size:0245K # Image buffer size in use
                case /^Page\sMode/.test(str):
                    // Page mode               # Printer is in page mode
                    // These are status details and are uninteresting, so we skip them.
                    break;
                default:
                    console.log("Unhandled config line '" + str + "', consider reporting a bug!");
                    break;
            }
        }

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

        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                timedOut = true;
                resolve();
            }, 200);
        });

        return Promise.race([nextLinePromise, timeoutPromise]);
    }

    async #listenForDataAndConsoleLogAlways() {
        while (true) {
            const line = await this.#nextLine();
            console.log("PRINTER SAYS TEXT IN SINGLE QUOTES\n'" + line + "'");
        }
    }

    async #listenForData() {
        let aggregate = "";
        while (true) {
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

        let quarter = (label.labelWidthDots / 4);
        let lineHeight = 20;

        label.setOffset(0, 0)
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

        let slashStart = (lineHeight * 6) + 5;
        let slashHeight = 8;
        for (let i = 0; i <= label.labelWidthDots; i += 4) {
            label.setOffset(i + 0, slashStart + 0)
                .addLine(1, slashHeight)
                .setOffset(i + 1, slashStart + slashHeight)
                .addLine(1, slashHeight)
                .setOffset(i + 2, slashStart + (slashHeight * 2))
                .addLine(1, slashHeight)
                .setOffset(i + 3, slashStart + (slashHeight * 3))
                .addLine(1, slashHeight)
        }
        await this.printLabel(label, 1);
    }

    /**
     * Send the configured label width to the printer
     */
    async configLabelWidth() {
        await this.clearImageBuffer().addCmd("q" + this.#xLabel).print();
    }

    /**
     * Perform an autocalibration for the label length
     */
    async setLabelHeightCalibration() {
        await this.clearImageBuffer().addCmd("xa").print();
    }

    /**
     * Configure the density (darkness) of the print.
     *
     * @param (int) density - 0 (light) through 15 (dark) print density.
     */
    async configDensity(density) {
        density = parseInt(density) || 8;
        density = (density < 0 || density > 15) ? 8 : density;

        await this.clearImageBuffer().addCmd("D" + density).print();
    }

    /**
     * Reset the printer, same as turning it off and on.
     */
    async configReset() {
        await this.clearImageBuffer().addCmd("^@").print();
    }

    /**
     * Set the direction the label prints (top to bottom or bottom to top)
     *
     * @param (bool) upsideDown - True to print upside down, otherwise rightside up.
     */
    async configPrintDirection(upsideDown) {
        upsideDown = upsideDown || false;
        let dir = upsideDown ? "T" : "B"
        await this.clearImageBuffer().addCmd("Z" + dir).print();
    }

    /**
     * Configure the speed of the print.
     *
     * @param (int) speed - 1 (slow) to 4 (fast) print speed.
     */
    async configSpeed(speed) {
        speed = parseInt(speed) || 4;
        speed = (speed < 1 || speed > 4) ? 4 : speed;

        await this.clearImageBuffer().addCmd("S" + speed).print();
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
        this.addRawCmd(new TextEncoder().encode(parameters.join(',') + "\n"));
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
