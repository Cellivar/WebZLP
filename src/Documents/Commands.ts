import { NumericRange } from '../NumericRange';
import {
    PrintSpeed,
    PrinterOptions,
    PrinterCommandLanguage
} from '../Printers/Configuration/PrinterOptions';

/** A prepared document, ready to be compiled and sent. */
export interface IDocument {
    /** Gets the series of commands this document contains. */
    get commands(): readonly IPrinterCommand[];

    /** Whether the document uses explicit start/stop commands instead of automatic. */
    get withExplicitDocumentStartStopCommands(): boolean;

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;
}

export class Document implements IDocument {
    private _commands: readonly IPrinterCommand[];
    get commands() {
        return this._commands;
    }
    private _withExplicitDocumentStartStopCommands: boolean;
    get withExplicitDocumentStartStopCommands() {
        return this._withExplicitDocumentStartStopCommands;
    }

    constructor(commandList: IPrinterCommand[], withExplicitDocumentStartStopCommands = false) {
        this._commands = commandList;
        this._withExplicitDocumentStartStopCommands = withExplicitDocumentStartStopCommands;
    }

    /** Display the commands that will be performed in a human-readable format. */
    public showCommands(): string {
        let result = '';
        this._commands.forEach((c) => (result += `${c.toDisplay()}\n`));
        return result;
    }
}

/** A document of raw commands, ready to be sent to a printer. */
export class CompiledDocument {
    private rawCmdBuffer: Uint8Array;
    private _commandLanugage: PrinterCommandLanguage;
    get commandLanguage() {
        return this._commandLanugage;
    }
    private _documentEffectFlags: PrinterCommandEffectFlags;
    get documentEffectFlags(): PrinterCommandEffectFlags {
        return this._documentEffectFlags;
    }

    constructor(
        commandLang: PrinterCommandLanguage,
        flags: PrinterCommandEffectFlags,
        commandBuffer: Uint8Array
    ) {
        this._commandLanugage = commandLang;
        this._documentEffectFlags = flags;
        this.rawCmdBuffer = commandBuffer;
    }

    /**
     * Gets a single buffer of the internal command set.
     */
    get commandBufferRaw(): Uint8Array {
        return this.rawCmdBuffer;
        const bufferLen = this.rawCmdBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
        const buffer = new Uint8Array(bufferLen);
        this.rawCmdBuffer.reduce((offset, arr) => {
            buffer.set(arr, offset);
            return arr.byteLength + offset;
        }, 0);

        return buffer;
    }

    /**
     * Gets the text view of the command buffer. Do not send this to the printer, the encoding
     * will break and commands will fail.
     */
    get commandBufferString(): string {
        return new TextDecoder('ascii').decode(this.rawCmdBuffer);
    }
}

/** A basic document builder, containing internal state to construct a document. */
export abstract class DocumentBuilder implements IDocumentBuilder {
    private _commands: IPrinterCommand[] = [];
    protected _config: PrinterOptions;

    constructor(config: PrinterOptions) {
        this._config = config;
    }

    /** Gets the read-only config information */
    get currentConfig() {
        return structuredClone(this._config);
    }

    clear(): IDocumentBuilder {
        this._commands = [];
        return this;
    }

    showCommands(): string {
        let result = '';
        this._commands.forEach((c) => (result += `${c.name} - ${c.toDisplay()}\n`));
        return result;
    }

    finalize(): IDocument {
        return new Document(this._commands);
    }

    then(command: IPrinterCommand): IDocumentBuilder {
        this._commands.push(command);
        return this;
    }
}

/** Flags to indicate special operations a command might cause. */
export enum PrinterCommandEffectFlags {
    /** No special side-effects outside of what the command does. */
    none = 0,
    /** Changes the printer config, necessitating an update of the cached config. */
    altersPrinterConfig = 1 << 0,
    /** Causes the printer motor to engage, even if nothing is printed. */
    feedsLabel = 1 << 1,
    /** Causes the printer to disconnect or otherwise need reconnecting. */
    lossOfConnection = 1 << 2,
    /** Causes something sharp to move */
    actuatesCutter = 1 << 3,
    /** Indicates multiple different documents are present in this document */
    hasMultipleDocuments = 1 << 4
}

/** The basic functionality of a document builder to arrange document commands. */
export interface IDocumentBuilder {
    /** Gets a read-only copy of the current label configuration. */
    get currentConfig(): PrinterOptions;

    /** Clear the commands in this document and reset it to the starting blank. */
    clear(): IDocumentBuilder;

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;

    /** Return the final built document. */
    finalize(): IDocument;

    /** Add a command to the list of commands. */
    then(command: IPrinterCommand): IDocumentBuilder;
}

/** A command that can be sent to a printer. */
export interface IPrinterCommand {
    /** Get the name of this command. */
    get name(): string;

    /** Get the human-readable output of this command. */
    toDisplay(): string;

    /** Any effects this command may cause the printer to undergo. */
    readonly printerEffectFlags?: PrinterCommandEffectFlags;
}

export class NewLabelCommand implements IPrinterCommand {
    get name(): string {
        return 'End previous label and begin a new label.';
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.hasMultipleDocuments;
}

export class DocumentStartCommand implements IPrinterCommand {
    get name(): string {
        return 'Begin a new document';
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags?: PrinterCommandEffectFlags;
}

export class DocumentEndCommand implements IPrinterCommand {
    get name(): string {
        return 'End a document';
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags?: PrinterCommandEffectFlags;
}

export class PrintCommand implements IPrinterCommand {
    get name(): string {
        return 'Print label';
    }
    toDisplay(): string {
        return `Print ${this.count} copies of label`;
    }

    constructor(labelCount = 1, additionalDuplicateOfEach = 1) {
        // TODO: If someone complains that this is lower than what ZPL allows
        // figure out a way to support the 99,999,999 supported.
        // Who needs to print > 65 thousand labels at once??? I want to know.
        this.count = labelCount <= 0 || labelCount > 65535 ? 0 : labelCount;
        this.additionalDuplicateOfEach =
            additionalDuplicateOfEach <= 0 || additionalDuplicateOfEach > 65535
                ? 0
                : additionalDuplicateOfEach;
    }

    count: number;
    additionalDuplicateOfEach: number;

    printerEffectFlags = PrinterCommandEffectFlags.feedsLabel;
}

export class CutNowCommand implements IPrinterCommand {
    get name(): string {
        return 'Cycle the media cutter now';
    }
    toDisplay(): string {
        return this.name;
    }

    printerEffectFlags = PrinterCommandEffectFlags.actuatesCutter;
}

export class SuppressFeedBackupCommand implements IPrinterCommand {
    get name(): string {
        return 'Disable feed backup after printing label (be sure to re-enable!)';
    }
    toDisplay(): string {
        return this.name;
    }
}

export class EnableFeedBackupCommand implements IPrinterCommand {
    get name(): string {
        return 'Enable feed backup after printing label.';
    }
    toDisplay(): string {
        return this.name;
    }
}

/** A command to clear the image buffer. */
export class ClearImageBufferCommand implements IPrinterCommand {
    get name(): string {
        return 'Clear image buffer';
    }
    toDisplay(): string {
        return this.name;
    }
}

/** A command to have the printer send its configuration back over serial. */
export class QueryConfigurationCommand implements IPrinterCommand {
    get name(): string {
        return 'Query for printer config';
    }
    toDisplay(): string {
        return this.name;
    }
}

/** A command to have the printer print its configuration labels. */
export class PrintConfigurationCommand implements IPrinterCommand {
    get name(): string {
        return "Print printer's config onto labels";
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.feedsLabel;
}

/** A command to set the darkness the printer prints at. */
export class SetDarknessCommand implements IPrinterCommand {
    get name(): string {
        return 'Set darkness';
    }
    toDisplay(): string {
        return `Set darkness to ${this.darknessPercent}%`;
    }

    constructor(darknessPercent: NumericRange<0, 100>, darknessMax: number) {
        this.darknessPercent = darknessPercent;
        this.darknessMax = darknessMax;
        this.darknessSetting = Math.ceil((darknessPercent * darknessMax) / 100);
    }

    darknessPercent: NumericRange<0, 100>;
    darknessMax: number;
    darknessSetting: number;

    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

/** A command to set the direction a label prints, either upside down or not. */
export class SetPrintDirectionCommand implements IPrinterCommand {
    get name(): string {
        return 'Set print direction';
    }
    toDisplay(): string {
        return `Print labels ${this.upsideDown ? 'upside-down' : 'right-side up'}`;
    }

    constructor(upsideDown: boolean) {
        this.upsideDown = upsideDown;
    }

    /** Whether to print labels upside-down. */
    upsideDown: boolean;

    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

/** A command to set the print speed a printer prints at. Support varies per printer. */
export class SetPrintSpeedCommand implements IPrinterCommand {
    get name(): string {
        return 'Set print speed';
    }
    toDisplay(): string {
        return `Set print speed to ${PrintSpeed[this.speed]} (inches per second).`;
    }

    constructor(
        speed: PrintSpeed,
        speedVal: number,
        mediaSlewSpeed: PrintSpeed,
        mediaSpeedVal: number
    ) {
        this.speed = speed;
        this.speedVal = speedVal;
        this.mediaSlewSpeed = mediaSlewSpeed;
        this.mediaSpeedVal = mediaSpeedVal;
    }

    speed: PrintSpeed;
    speedVal: number;
    mediaSlewSpeed: PrintSpeed;
    mediaSpeedVal: number;

    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

/** A command to set the label dimensions of this label. */
export class SetLabelDimensionsCommand implements IPrinterCommand {
    get name(): string {
        return 'Set label dimensions';
    }
    toDisplay(): string {
        let str = `Set label size to ${this.widthInDots} wide`;
        if (this.heightInDots) {
            str += ` x ${this.heightInDots} high`;
        }
        if (this.gapLengthInDots) {
            str += ` with a gap length of ${this.gapLengthInDots}`;
        }
        str += ' (in dots).';
        return str;
    }

    get setsHeight() {
        return this.heightInDots != null && this.gapLengthInDots != null;
    }

    // TODO: Black line mode for EPL?
    constructor(widthInDots: number, heightInDots?: number, gapLengthInDots?: number) {
        this.widthInDots = widthInDots;
        this.heightInDots = heightInDots;
        this.gapLengthInDots = gapLengthInDots;
    }

    widthInDots: number;
    heightInDots?: number;
    gapLengthInDots?: number;

    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

export class AutosenseLabelDimensionsCommand implements IPrinterCommand {
    get name(): string {
        return 'Auto-sense the label length by feeding several labels.';
    }
    toDisplay(): string {
        return this.name;
    }

    printerEffectFlags =
        PrinterCommandEffectFlags.altersPrinterConfig | PrinterCommandEffectFlags.feedsLabel;
}

/** Command class to modify an offset. */
export class Offset implements IPrinterCommand {
    get name(): string {
        return 'Modify offset';
    }
    toDisplay(): string {
        let str = `Set offset to ${this.horizontal} from the left`;
        if (this.vertical) {
            str += ` and ${this.vertical} from the top`;
        }
        str += this.absolute ? `of the label.` : ` of the current offset.`;
        return str;
    }

    constructor(horizontal: number, vertical?: number, absolute = false) {
        this.horizontal = horizontal;
        this.vertical = vertical;
        this.absolute = absolute;
    }

    horizontal: number;
    vertical?: number;
    absolute = false;
}

export class RebootPrinterCommand implements IPrinterCommand {
    get name(): string {
        return 'Simulate a power-cycle for the printer. This should be the final command.';
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.lossOfConnection;
}

/** Command class to draw an image into the image buffer for immediate print. */
export class AddImageCommand implements IPrinterCommand {
    get name(): string {
        return 'Add image to label';
    }
    toDisplay(): string {
        if (!this.imageData) {
            return 'Adds a null image';
        }
        return this.name;
    }

    constructor(imageData: ImageData, dithering: DitheringMethod) {
        this.imageData = imageData;
        this.dithering = dithering;
    }

    imageData: ImageData;
    dithering: DitheringMethod;
}

/** Command class to draw a straight line. */
export class AddLineCommand implements IPrinterCommand {
    get name(): string {
        return 'Add perpendicular line to label';
    }
    toDisplay(): string {
        // eslint-disable-next-line prettier/prettier
        return `Add a ${DrawColor[this.color]} line ${this.lengthInDots} wide by ${this.heightInDots} high.`;
    }

    constructor(lengthInDots: number, heightInDots: number, color: DrawColor) {
        this.lengthInDots = lengthInDots;
        this.heightInDots = heightInDots;
        this.color = color;
    }

    lengthInDots: number;
    heightInDots: number;
    color: DrawColor;
}

export class AddBoxCommand implements IPrinterCommand {
    get name(): string {
        return 'Add a box to label';
    }
    toDisplay(): string {
        return `Add a box ${this.lengthInDots} wide by ${this.heightInDots} high.`;
    }

    constructor(lengthInDots: number, heightInDots: number, thickness: number) {
        this.lengthInDots = lengthInDots;
        this.heightInDots = heightInDots;
        this.thickness = thickness;
    }

    lengthInDots: number;
    heightInDots: number;
    thickness: number;
}

/** List of available dithering methods for converting images to black/white. */
export enum DitheringMethod {
    /** No dithering, cutoff with  used. */
    none
}

/** List of colors to draw elements with */
export enum DrawColor {
    /** Draw in black */
    black,
    /** Draw in white */
    white
}
