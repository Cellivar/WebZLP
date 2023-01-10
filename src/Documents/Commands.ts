import * as Options from '../Printers/Configuration/PrinterOptions.js';
import { BitmapGRF, ImageConversionOptions } from './BitmapGRF.js';

/** Flags to indicate special operations a command might cause. */
export enum PrinterCommandEffectFlags {
    /** No special side-effects outside of what the command does. */
    none = 0,
    /** The effects of this command cannot be determined automatically. */
    unknownEffects = 1 << 0,
    /** Changes the printer config, necessitating an update of the cached config. */
    altersPrinterConfig = 1 << 1,
    /** Causes the printer motor to engage, even if nothing is printed. */
    feedsLabel = 1 << 2,
    /** Causes the printer to disconnect or otherwise need reconnecting. */
    lossOfConnection = 1 << 3,
    /** Causes something sharp to move */
    actuatesCutter = 1 << 4
}

/** A command that can be sent to a printer. */
export interface IPrinterCommand {
    /** Get the display name of this command. */
    get name(): string;
    /** Get the command type of this command. */
    get type(): CommandType;

    /** Get the human-readable output of this command. */
    toDisplay(): string;

    /** Any effects this command may cause the printer to undergo. */
    readonly printerEffectFlags?: PrinterCommandEffectFlags;
}

/** A custom command beyond the standard command set, with command-language-specific behavior. */
export interface IPrinterExtendedCommand extends IPrinterCommand {
    /** The unique identifier for this command. */
    get typeExtended(): symbol;

    /** Gets the command languages this extended command can apply to. */
    get commandLanguageApplicability(): Options.PrinterCommandLanguage;
}

/** List of colors to draw elements with */
export enum DrawColor {
    /** Draw in black */
    black,
    /** Draw in white */
    white
}

/** Behavior to take for commands that belong inside or outside of a form. */
export enum CommandReorderBehavior {
    /** Perform no reordering, non-form commands will be interpreted as form closing.  */
    none = 0,
    /** Reorder non-form commands to the end, retaining order. */
    nonFormCommandsAfterForms
}

// My kingdom for a real type system, or at least a way to autogenerate this in the
// type system. I have given up on TypeScript actually helping me here.
// TODO: Figure out a way to unit test this to make sure it's complete.
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/naming-convention */
/** Enum of all possible commands that can be issued. */
export enum CommandType {
    // Some printer commands can be command-language specific. This uses a different lookup table.
    CommandLanguageSpecificCommand = 'CommandLanguageSpecificCommand',
    // Users may supply printer commands. This uses a different lookup table.
    CommandCustomSpecificCommand = 'CommandCustomSpecificCommand',
    // Everything else is OOTB commands that should be implemented by internal implmentations.
    AddBoxCommand = 'AddBoxCommand',
    AddImageCommand = 'AddImageCommand',
    AddLineCommand = 'AddLineCommand',
    AutosenseLabelDimensionsCommand = 'AutosenseLabelDimensionsCommand',
    ClearImageBufferCommand = 'ClearImageBufferCommand',
    CutNowCommand = 'CutNowCommand',
    EnableFeedBackupCommand = 'EnableFeedBackupCommand',
    NewLabelCommand = 'NewLabelCommand',
    OffsetCommand = 'OffsetCommand',
    PrintCommand = 'PrintCommand',
    PrintConfigurationCommand = 'PrintConfigurationCommand',
    QueryConfigurationCommand = 'QueryConfigurationCommand',
    RawDocumentCommand = 'RawDocumentCommand',
    RebootPrinterCommand = 'RebootPrinterCommand',
    SaveCurrentConfigurationCommand = 'SaveCurrentConfigurationCommand',
    SetDarknessCommand = 'SetDarknessCommand',
    SetLabelDimensionsCommand = 'SetLabelDimensionsCommand',
    SetLabelHomeCommand = 'SetLabelHomeCommand',
    SetLabelPrintOriginOffsetCommand = 'SetLabelPrintOriginOffsetCommand',
    SetLabelToContinuousMediaCommand = 'SetLabelToContinuousMediaCommand',
    SetLabelToWebGapMediaCommand = 'SetLabelToWebGapMediaCommand',
    SetLabelToMarkMediaCommand = 'SetLabelToMarkMediaCommand',
    SetPrintDirectionCommand = 'SetPrintDirectionCommand',
    SetPrintSpeedCommand = 'SetPrintSpeedCommand',
    SuppressFeedBackupCommand = 'SuppressFeedBackupCommand',
}
/* eslint-enable @typescript-eslint/naming-convention */
/* eslint-enable prettier/prettier */

export class NewLabelCommand implements IPrinterCommand {
    get name(): string {
        return 'End previous label and begin a new label.';
    }
    get type() {
        return CommandType.NewLabelCommand;
    }
    toDisplay(): string {
        return this.name;
    }
}

export class PrintCommand implements IPrinterCommand {
    get name(): string {
        return 'Print label';
    }
    get type() {
        return CommandType.PrintCommand;
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
    get type() {
        return CommandType.CutNowCommand;
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
    get type() {
        return CommandType.SuppressFeedBackupCommand;
    }
    toDisplay(): string {
        return this.name;
    }
}

export class EnableFeedBackupCommand implements IPrinterCommand {
    get name(): string {
        return 'Enable feed backup after printing label.';
    }
    get type() {
        return CommandType.EnableFeedBackupCommand;
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
    get type() {
        return CommandType.ClearImageBufferCommand;
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
    get type() {
        return CommandType.QueryConfigurationCommand;
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
    get type() {
        return CommandType.PrintConfigurationCommand;
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.feedsLabel;
}

/** A command to store the current configuration as the stored configuration. */
export class SaveCurrentConfigurationCommand implements IPrinterCommand {
    get name(): string {
        return 'Store the current configuration as the saved configuration.';
    }
    get type(): CommandType {
        return CommandType.SaveCurrentConfigurationCommand;
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

/** A command to set the darkness the printer prints at. */
export class SetDarknessCommand implements IPrinterCommand {
    get name(): string {
        return 'Set darkness';
    }
    get type() {
        return CommandType.SetDarknessCommand;
    }
    toDisplay(): string {
        return `Set darkness to ${this.darknessPercent}%`;
    }

    constructor(darknessPercent: Options.DarknessPercent, darknessMax: number) {
        this.darknessPercent = darknessPercent;
        this.darknessMax = darknessMax;
        this.darknessSetting = Math.ceil((darknessPercent * darknessMax) / 100);
    }

    darknessPercent: Options.DarknessPercent;
    darknessMax: number;
    darknessSetting: number;

    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

/** A command to set the direction a label prints, either upside down or not. */
export class SetPrintDirectionCommand implements IPrinterCommand {
    get name(): string {
        return 'Set print direction';
    }
    get type() {
        return CommandType.SetPrintDirectionCommand;
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
    get type() {
        return CommandType.SetPrintSpeedCommand;
    }
    toDisplay(): string {
        return `Set print speed to ${Options.PrintSpeed[this.speed]} (inches per second).`;
    }

    constructor(
        speed: Options.PrintSpeed,
        speedVal: number,
        mediaSlewSpeed: Options.PrintSpeed,
        mediaSpeedVal: number
    ) {
        this.speed = speed;
        this.speedVal = speedVal;
        this.mediaSlewSpeed = mediaSlewSpeed;
        this.mediaSpeedVal = mediaSpeedVal;
    }

    speed: Options.PrintSpeed;
    speedVal: number;
    mediaSlewSpeed: Options.PrintSpeed;
    mediaSpeedVal: number;

    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;
}

/** A command to set the label dimensions of this label. */
export class SetLabelDimensionsCommand implements IPrinterCommand {
    get name(): string {
        return 'Set label dimensions';
    }
    get type() {
        return CommandType.SetLabelDimensionsCommand;
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

export class SetLabelHomeCommand implements IPrinterCommand {
    get name(): string {
        return 'Sets the label home (origin) offset';
    }
    get type(): CommandType {
        return CommandType.SetLabelHomeCommand;
    }
    toDisplay(): string {
        return `Set the label home (origin) to ${this.xOffset},${this.yOffset} from the top-left.`;
    }
    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;

    constructor(public xOffset: number, public yOffset: number) {}
}

/** Command class to set the print offset from the top-left of the label. */
export class SetLabelPrintOriginOffsetCommand implements IPrinterCommand {
    get name(): string {
        return 'Sets the print offset from the top left corner.';
    }
    get type(): CommandType {
        return CommandType.SetLabelPrintOriginOffsetCommand;
    }
    toDisplay(): string {
        return `Sets the print offset to ${this.xOffset} in and ${this.yOffset} down frmo the top-left.`;
    }
    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;

    constructor(public xOffset: number, public yOffset: number) {}
}

/** A command class to set the media handling mode to continuous media. */
export class SetLabelToContinuousMediaCommand implements IPrinterCommand {
    get name(): string {
        return 'Sets the media handling mode to continuous media.';
    }
    get type(): CommandType {
        return CommandType.SetLabelToContinuousMediaCommand;
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;

    constructor(public labelLengthInDots: number, public labelGapInDots = 0) {}
}

/** A command class to set the media handling mode to web gap detection. */
export class SetLabelToWebGapMediaCommand implements IPrinterCommand {
    get name(): string {
        return 'Sets the media handling mode to web gap detection.';
    }
    get type(): CommandType {
        return CommandType.SetLabelToWebGapMediaCommand;
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;

    constructor(public labelLengthInDots: number, public labelGapInDots: number) {}
}

/** A command class to set the media handling mode to black mark detection. */
export class SetLabelToMarkMediaCommand implements IPrinterCommand {
    get name(): string {
        return 'Sets the media handling mode to black mark detection.';
    }
    get type(): CommandType {
        return CommandType.SetLabelToMarkMediaCommand;
    }
    toDisplay(): string {
        return this.name;
    }
    printerEffectFlags = PrinterCommandEffectFlags.altersPrinterConfig;

    constructor(
        public labelLengthInDots: number,
        public blackLineThicknessInDots: number,
        public blackLineOffset: number
    ) {}
}

/** Command class to cause the printer to auto-sense the media length. */
export class AutosenseLabelDimensionsCommand implements IPrinterCommand {
    get name(): string {
        return 'Auto-sense the label length by feeding several labels.';
    }
    get type() {
        return CommandType.AutosenseLabelDimensionsCommand;
    }
    toDisplay(): string {
        return this.name;
    }

    printerEffectFlags =
        PrinterCommandEffectFlags.altersPrinterConfig | PrinterCommandEffectFlags.feedsLabel;
}

/** Command class to modify an offset. */
export class OffsetCommand implements IPrinterCommand {
    get name(): string {
        return 'Modify offset';
    }
    get type() {
        return CommandType.OffsetCommand;
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
        this.horizontal = Math.floor(horizontal);
        this.vertical = Math.floor(vertical);
        this.absolute = absolute;
    }

    horizontal: number;
    vertical?: number;
    absolute = false;
}

/** Command class to force a printer to reset. */
export class RebootPrinterCommand implements IPrinterCommand {
    get name(): string {
        return 'Simulate a power-cycle for the printer. This should be the final command.';
    }
    get type() {
        return CommandType.RebootPrinterCommand;
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
    get type() {
        return CommandType.AddImageCommand;
    }
    toDisplay(): string {
        if (!this.bitmap) {
            return 'Adds a blank image';
        }
        return `Adds a ${this.bitmap.width} wide x ${this.bitmap.height} high image.`;
    }

    constructor(public bitmap: BitmapGRF, public imageConversionOptions: ImageConversionOptions) {}
}

/** Command class to draw a straight line. */
export class AddLineCommand implements IPrinterCommand {
    get name(): string {
        return 'Add perpendicular line to label';
    }
    get type() {
        return CommandType.AddLineCommand;
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

/** Command to draw a box on a label */
export class AddBoxCommand implements IPrinterCommand {
    get name(): string {
        return 'Add a box to label';
    }
    get type() {
        return CommandType.AddBoxCommand;
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

export class RawDocumentCommand implements IPrinterCommand {
    get name(): string {
        return 'Sends a raw set of commands directly to the printer unmodified.';
    }
    get type(): CommandType {
        return CommandType.RawDocumentCommand;
    }
    toDisplay(): string {
        throw new Error('Method not implemented.');
    }
    printerEffectFlags = PrinterCommandEffectFlags.unknownEffects;

    constructor(
        public rawDocument: string,
        printerEffectFlags = PrinterCommandEffectFlags.unknownEffects
    ) {
        this.printerEffectFlags = printerEffectFlags;
    }
}
