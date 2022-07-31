
/**
 * A label for use with EPL printers
 */
export class LabelEpl {
    #rawCmdBuffer = [];
    #fontNumber = 1;
    #dpi;
    #lineSpacing;

    color;
    labelWidthDots;
    labelHeightDots;

    // Temp holders on a per-label basis.
    #xOffset = 0;
    #yOffset = 0;

    /**
     * Create a new EPL-language label.
     *
     * @param {number} labelWidthDots - The width of the label in dots
     * @param {number} labelHeightDots - The height of the label in dots
     * @param {number} dpi - The DPI of the label.
     * @param {number} lineSpacing - The number of dots between lines of text
     * @param {string} color - The color of the label.
     */
    constructor(labelWidthDots, labelHeightDots, dpi, lineSpacing, color) {
        this.labelWidthDots = labelWidthDots;
        this.labelHeightDots = labelHeightDots;
        this.#dpi = dpi;
        this.#lineSpacing = lineSpacing === 0 ? 0 : (lineSpacing || 5);
        this.color = color || "#FFFFFF";

        this.clearCommandBuffer();
    }

    /**
     * Get the raw command buffer representing all of the operations of this label.
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
     * Gets the current font selection
     */
    get font() { return this.#fontNumber; }

    /**
     * Gets the line spacing setting.
     */
    get lineSpacing() { return this.#lineSpacing; }

    /**
     * Get the ASCII text representation of the operations of this label. Only useful for debugging.
     */
    get commandBuffer() {
        return new TextDecoder("ascii").decode(this.rawCommandBuffer);
    }

    /**
     * Get the built-in font size info for this label's DPI.
     */
    get fontSizes() {
        switch (this.#dpi) {
            default:
                console.error("Unknown DPI requested for font size! " + this.#dpi);
                return;
            case 203:
                return {
                    // Each character has 2 dots of inter-character space added
                    // between each character and one dot added for vertical
                    // Note that the font sizes here do not correspond to the
                    // documentation, they were discovered through trial and error
                    // They are zero-height as line spacing must be handled manually
                    // while character spacing is automatic.
                    // And yes font 4 is somewhere beween 16 and 17 characters wide.
                    // 16.2 seems to be stable over the full 4" print width.
                    "1": { "y": 10, "x": 10 },
                    "2": { "y": 14, "x": 12 },
                    "3": { "y": 16, "x": 14 },
                    "4": { "y": 20, "x": 16.2 },
                    "5": { "y": 48, "x": 36 },
                    "6": { "y": 19, "x": 16 },
                    "7": { "y": 19, "x": 16 },
                };
        }
    }

    /**
     * Gets the current horizontal offset.
     */
    get horizontalOffset() { return this.#xOffset; }

    /**
     * Gets the current vertical offset.
     */
    get verticalOffset() { return this.#yOffset; }

    /**
     * Complete a label. Must be called to print the label.
     *
     * @param {number} count - The number of labels to print, 1 or higher.
     */
    end(count=1) {
        count = Math.trunc(count);
        count = (count < 1) ? 1 : count;

        return this.addCmd(`P${count}`);
    }

    /**
     * Set the font to be used for subsequent text commands
     *
     * @param {number} fontNumber - The font to use. See the font docs for details. 1-5.
     */
    setFont(fontNumber=1) {
        fontNumber = Math.trunc(fontNumber);

        if (fontNumber < 1 || fontNumber > 7) {
            console.log("Invalid font size! Defaulting to 1");
            fontNumber = 1;
        }

        this.#fontNumber = fontNumber;
        return this;
    }

    /**
     * Change the current offset from the top-left of the label
     *
     * @param {number} x - Horizontal offset to the right
     * @param {number} y - Vertical offset down from the top
     */
    setOffset(x=this.#xOffset, y=0) {
        this.#xOffset = Math.trunc(x);
        this.#yOffset = Math.trunc(y);

        return this;
    }

    /**
     * Add to the current offset from the top-left of the label.
     *
     * @param {number} x - Horizontal offset to add to the right.
     * @param {number} y - Vertical offset to add down the label.
     */
    addOffset(x, y) {
        this.#xOffset += Math.trunc(x) || 0;

        if (y !== undefined) {
            this.#yOffset += Math.trunc(y) || 0;
        }
        return this;
    }

    /**
     * Reset the offsets to 0.
     */
    clearOffsets() {
        this.#xOffset = 0;
        this.#yOffset = 0;
        return this;
    }

    /**
     * Set the line spacing between added lines of text.
     *
     * @param {number} dots - The size in dots to add.
     */
    setLineSpacing(dots) {
        this.#lineSpacing = Math.trunc(dots);
        return this;
    }

    /**
     * Draw an image into the buffer.
     *
     * @param {ImageData} imageData - An ImageData object, see Canvas.getImageData.
     */
    addImage(imageData) {
        // Only supports sRGB as RGBA data.
        if (imageData.colorSpace !== "srgb") {
            console.error("Unknown color space for given imageData! Expected srgb but got " + imageData.colorSpace);
            return this;
        }

        // TODO: Figure out how to add padding to ensure the image width
        // lands on an 8 byte boundary. Right now it'll just end up truncating
        // the extra data on each line which is not ideal.

        // RGBA data gets compressed down to 1 bit, then packed into a byte array.
        // Note that the passed in width and height aren't relevant here, just
        // what the imageData says.
        const buffer = new Uint8Array(imageData.height * imageData.width / 8);
        const d = imageData.data;

        // If the grayscale version of the pixel + alpha is above this
        // value treat it as white, else black.
        const threshold = 200;

        for (var y = 0; y < imageData.height; y++) {
            for (var x = 0; x < imageData.width; x++) {
                let o = (y * imageData.width * 4) + (x * 4);
                let gray = Math.min(Math.pow((Math.pow(d[o] / 255.0, 2.2) * 0.2126 + Math.pow(d[o + 1] / 255.0, 2.2) * 0.7152 + Math.pow(d[o + 2] / 255.0, 2.2) * 0.0722), 0.454545) * 255)
                let alpha = d[o + 3] / 255;
                let grayAlpha = ((1 - alpha) * 255) + (alpha * gray);
                let bit = (grayAlpha > threshold ? 1 : 0) << (7 - x % 8);

                buffer[(y * imageData.width / 8) + Math.floor(x / 8)] |= bit;
            }
        }

        let parameters = ["GW" + this.#xOffset, this.#yOffset, Math.trunc(imageData.width / 8), imageData.height];
        return this
            .addRawCmd(new TextEncoder().encode(parameters.join(',') + ','))
            .addRawCmd(buffer)
            .addCmd("")
            .addOffset(0, imageData.height);
    }

    /**
     * Add text, advancing the yOffset by the font height + line spacing.
     *
     * @param {string} text - The text to add
     * @param {number} size - The size to scale the font, 1-6
     *
     * @example
     *     addText("Hello world!", 1)
     */
    addText(text="", size=1) {
        text = text;
        size = Math.trunc(size);

        // Font size 5 only supports uppercase letters.
        if (this.#fontNumber == 5) {
            text = text.toUpperCase();
        }

        this.#addTextRaw(this.#xOffset, this.#yOffset, 0, this.#fontNumber, size, size, false, text);

        let textHeight = (size * this.fontSizes[this.#fontNumber]["y"]);

        return this.addOffset(0, Math.trunc(textHeight + this.#lineSpacing));
    }

    /**
     * Add text centered on the label, advancing the yOffset by the font height + line spacing.
     *
     * @param {string} text - The text to add
     * @param {number} size - The size to scale the font, 1-6
     *
     * @example
     *     addTextCentered("Hello world!", 1)
     */
    addTextCentered(text, size) {
        text = text || "";
        size = Math.trunc(size) || 1;

        // Font size 5 only supports uppercase letters.
        if (this.#fontNumber == 5) {
            text = text.toUpperCase();
        }

        // Width = string length * character width * char size stretch
        let textWidth = (text.length * size * this.fontSizes[this.#fontNumber]["x"]);
        let centerOffset = Math.trunc((this.labelWidthDots - textWidth) / 2);

        this.#addTextRaw(centerOffset, this.#yOffset, 0, this.#fontNumber, size, size, false, text);

        let textHeight = (size * this.fontSizes[this.#fontNumber]["y"]);

        return this.addOffset(0, Math.trunc(textHeight + this.#lineSpacing));
    }

    /**
     * Draw a line, starting at the current offset and going for length and height.
     *
     * @param {number} length - The horizontal length of the line
     * @param {number} height - The vertical height of the line
     * @param {string} drawmode - The mode to draw with, either 'black' (default), 'white', or 'xor'.
     */
    addLine(length, height, drawmode="black") {
        length = Math.trunc(length) || 0;
        height = Math.trunc(height) || 0;

        switch (drawmode) {
            case "black":
                drawmode = "LO";
                break;
            case "white":
                drawmode = "LW";
                break;
            case "xor":
                drawmode = "LE";
                break;
        }

        return this.addCmd(drawmode + this.#xOffset, this.#yOffset, length, height);
    }

    /**
     * Draw a box
     *
     * @param {number} length - The width of the box to draw
     * @param {number} height - The height of the box to draw
     * @param {number} thickness - The thickness of the box's lines
     */
    addBox(length, height, thickness) {
        length = Math.trunc(length) || 0;
        height = Math.trunc(height) || 0;
        thickness = Math.trunc(thickness) || 0;

        return this.addCmd("X" + this.#xOffset, this.#yOffset, thickness, length, height);
    }

    /**
     * Add command to the command buffer, concatenating given parameters with a comma.
     *
     * @param {Array.<String>} parameters - The command and parameters to add, first element should be the command and the first parameter.
     *
     * @example
     * addCmd("A10", 10, 0, 1, 1, 1, "N", "Hello World!");
     */
    addCmd(...parameters) {
        return this.addRawCmd(new TextEncoder().encode(parameters.join(',') + "\n"));
    }

    /**
     * Add a raw byte array to the command buffer.
     *
     * @param {Uint8Array} array - Array of ASCII characters for the command to add.
     */
    addRawCmd(array) {
        this.#rawCmdBuffer.push(array);
        return this;
    }

    /**
     * Empty the command buffer and re-add the initial clear image buffer command.
     */
    clearCommandBuffer() {
        this.#rawCmdBuffer = [];
        return this.addCmd("\nN");
    }

    #addTextRaw(xOffset, yOffset, rotation, font, xMultiplier, yMultiplier, reverse, data) {
        data = this.#cleanString((data || ""));
        let reverseImage = (reverse || false) ? "R" : "N";

        if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) {
            rotation = 0;
        }

        xMultiplier = ((xMultiplier >= 1 && xMultiplier <= 6) || xMultiplier === 8) ? xMultiplier : 1;
        yMultiplier = ((yMultiplier >= 1 && yMultiplier <= 9)) ? yMultiplier : 1;

        this.addCmd("A" + xOffset, yOffset, rotation, font, xMultiplier, yMultiplier, reverseImage, "\"" + data + "\"");
    }

    #cleanString(str) {
        return str.replace(/\\/gi, "\\\\")
            .replace(/"/gi, "\\\"")
            .replace(/[\r\n]+/gi, " ");
    }
}
