import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';

export type PrinterCommandEffectTypes
  = "unknown"
  /** Changes the printer config, necessitating an update of the cached config. */
  | "altersConfig"
  /** Causes the printer motor to engage, even if nothing is printed. */
  | "feedsPaper"
  /** Causes the printer to print labels, regardless of peel settings. */
  | "feedsPaperIgnoringPeeler"
  /** Causes the printer to disconnect or otherwise need reconnecting. */
  | "lossOfConnection"
  /** Causes something sharp to move. */
  | "actuatesCutter"
  /** Expects a response from the printer. */
  | "waitsForResponse";

/** Flags to indicate special operations a command might cause. */
export class CommandEffectFlags extends Set<PrinterCommandEffectTypes> { }
export const NoEffect = new CommandEffectFlags();
export const AwaitsEffect = new CommandEffectFlags(['waitsForResponse']);

/** A command that can be sent to a printer. */
export interface IPrinterCommand {
  /** Get the display name of this command. */
  readonly name: string;
  /** Get the command type of this command. */
  readonly type: CommandType;
  /** Any effects this command may cause the printer to undergo. */
  readonly effectFlags: CommandEffectFlags;

  /** Get the human-readable output of this command. */
  toDisplay(): string;
}

/** A custom command beyond the standard command set, with command-language-specific behavior. */
export interface IPrinterExtendedCommand extends IPrinterCommand {
  /** The unique identifier for this command. */
  get typeExtended(): symbol;

  /** Gets the command languages this extended command can apply to. */
  get commandLanguageApplicability(): Conf.PrinterCommandLanguage;
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
  closeForm = 0,
  /** Reorder non-form commands to the end, retaining order. */
  afterAllForms,
  /** Reorder non-form commands before all forms, retaining order.  */
  beforeAllForms,
  /**
   * Throw an exception if a non-form command is within a form.
   * You will need to explicitly close and open forms to use this option.
   */
  throwError,
}

/** Union type of all possible commands that must be handled by command sets. */
export type CommandType
  // Users/PCLs may supply printer commands. This uses a different lookup table.
  = "CustomCommand"
  // General printer commands
  | "RebootPrinter"
  | "Raw"
  // Status commands
  | "GetStatus"
  | "PrintConfiguration"
  | "QueryConfiguration"
  // Configuration commands
  | "SaveCurrentConfiguration"
  | "AutosenseLabelDimensions"
  | "SetDarkness"
  | "SetLabelDimensions"
  | "SetLabelHome"
  | "SetLabelPrintOriginOffset"
  | "SetLabelToContinuousMedia"
  | "SetLabelToWebGapMedia"
  | "SetLabelToMarkMedia"
  | "SetPrintDirection"
  | "SetPrintSpeed"
  // Document handling
  | "NewLabel"
  | "StartLabel"
  | "EndLabel"
  | "CutNow"
  | "EnableFeedBackup"
  | "SuppressFeedBackup"
  | "Print"
  // Content
  | "ClearImageBuffer"
  | "AddBox"
  | "AddImage"
  | "AddLine"
  | "Offset"

abstract class BasicCommand implements IPrinterCommand {
  abstract name: string;
  abstract type: CommandType;
  effectFlags: CommandEffectFlags;
  toDisplay() { return this.name; }
  constructor(effects: PrinterCommandEffectTypes[] = []) {
    this.effectFlags = new CommandEffectFlags(effects);
  }
}

export class StartLabel extends BasicCommand {
  name = 'Explicitly start a new label.';
  type: CommandType = 'StartLabel';
  constructor() { super([]); }
}

export class EndLabel extends BasicCommand {
  name = 'Explicitly end a label.';
  type: CommandType = 'EndLabel';
  constructor() { super([]); }
}

export class PrintCommand implements IPrinterCommand {
  name = 'Print label';
  type: CommandType = 'Print';
  toDisplay(): string {
    return `Print ${this.labelCount} copies of label`;
  }

  constructor(
    public readonly labelCount = 1,
    public readonly additionalDuplicateOfEach = 1
  ) {
    // TODO: If someone complains that this is lower than what ZPL allows
    // figure out a way to support the 99,999,999 supported.
    // Who needs to print > 65 thousand labels at once??? I want to know.
    this.labelCount = Util.clampToRange(labelCount, 0, 65534);
    this.additionalDuplicateOfEach = Util.clampToRange(additionalDuplicateOfEach, 0, 65534);
  }

  effectFlags = new CommandEffectFlags(['feedsPaper']);
}

export class GetStatusCommand extends BasicCommand {
  name = 'Get the immediate printer status';
  type: CommandType = 'GetStatus';
  constructor() { super(['waitsForResponse']); }
}

export class CutNowCommand extends BasicCommand {
  name = 'Cycle the media cutter now';
  type: CommandType = 'CutNow';
  constructor() { super(['actuatesCutter']); }
}

export class SuppressFeedBackupCommand extends BasicCommand {
  name = 'Disable feed backup after printing label (be sure to re-enable!)';
  type: CommandType = 'SuppressFeedBackup';
  constructor() { super([]); }
}

export class EnableFeedBackupCommand extends BasicCommand {
  name = 'Enable feed backup after printing label.';
  type: CommandType = 'EnableFeedBackup';
  constructor() { super([]); }
}

/** A command to clear the image buffer. */
export class ClearImageBufferCommand extends BasicCommand {
  name = 'Clear image buffer';
  type: CommandType = 'ClearImageBuffer';
  constructor() { super([]); }
}

/** A command to have the printer send its configuration back over serial. */
export class QueryConfigurationCommand extends BasicCommand {
  name = 'Query for printer config';
  type: CommandType = 'QueryConfiguration';
  constructor() { super([]); }
}

/** A command to have the printer print its configuration labels. */
export class PrintConfigurationCommand extends BasicCommand {
  get name() { return "Print printer's config onto labels"; }
  type: CommandType = 'PrintConfiguration';
  constructor() { super([]); }
}

/** A command to store the current configuration as the stored configuration. */
export class SaveCurrentConfigurationCommand extends BasicCommand {
  name = 'Store the current configuration as the saved configuration.';
  type: CommandType = 'SaveCurrentConfiguration';
  constructor() { super([]); }
}

/** A command to set the darkness the printer prints at. */
export class SetDarknessCommand implements IPrinterCommand {
  name = 'Set darkness';
  type: CommandType = 'SetDarkness';
  toDisplay(): string {
    return `Set darkness to ${this.darknessPercent}%`;
  }

  constructor(
    public readonly darknessPercent: Conf.DarknessPercent
  ) {}

  effectFlags = new CommandEffectFlags(['altersConfig']);
}

/** A command to set the direction a label prints, either upside down or not. */
export class SetPrintDirectionCommand implements IPrinterCommand {
  name = 'Set print direction';
  type: CommandType = 'SetPrintDirection';
  toDisplay(): string {
    return `Print labels ${this.upsideDown ? 'upside-down' : 'right-side up'}`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public readonly upsideDown: boolean) { }
}

/** A command to set the print speed a printer prints at. Support varies per printer. */
export class SetPrintSpeedCommand implements IPrinterCommand {
  name = 'Set print speed';
  type: CommandType = 'SetPrintSpeed';
  toDisplay(): string {
    return `Set print speed to ${Conf.PrintSpeed[this.speed]} (inches per second).`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(
    public readonly speed: Conf.PrintSpeed,
    public readonly mediaSlewSpeed: Conf.PrintSpeed,
  ) { }
}

/** A command to set the label dimensions of this label. */
export class SetLabelDimensionsCommand implements IPrinterCommand {
  name = 'Set label dimensions';
  type: CommandType = 'SetLabelDimensions';
  toDisplay(): string {
    let str = `Set label size to ${this.widthInDots} wide`;
    if (this.lengthInDots) {
      str += ` x ${this.lengthInDots} high`;
    }
    if (this.gapLengthInDots) {
      str += ` with a gap length of ${this.gapLengthInDots}`;
    }
    str += ' (in dots).';
    return str;
  }

  get setsLength() {
    return this.lengthInDots !== undefined && this.gapLengthInDots !== undefined;
  }

  // TODO: Black line mode for EPL?
  constructor(
    public readonly widthInDots: number,
    public readonly lengthInDots?: number,
    public readonly gapLengthInDots?: number) { }

  effectFlags = new CommandEffectFlags(['altersConfig']);
}

export class SetLabelHomeCommand implements IPrinterCommand {
  name = 'Sets the label home (origin) offset';
  type: CommandType = 'SetLabelHome';
  toDisplay(): string {
    return `Set the label home (origin) to ${this.offset.left},${this.offset.top} from the top-left.`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public offset: Conf.Coordinate) { }
}

/** Command class to set the print offset from the top-left of the label. */
export class SetLabelPrintOriginOffsetCommand implements IPrinterCommand {
  name = 'Sets the print offset from the top left corner.';
  type: CommandType = 'SetLabelPrintOriginOffset';
  toDisplay(): string {
    return `Sets the print offset to ${this.offset.left} in and ${this.offset.top} down from the top-left.`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public offset: Conf.Coordinate) { }
}

/** A command class to set the media handling mode to continuous media. */
export class SetLabelToContinuousMediaCommand implements IPrinterCommand {
  name = 'Sets the media handling mode to continuous media.';
  type: CommandType = 'SetLabelToContinuousMedia';
  toDisplay(): string {
    return this.name;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public labelLengthInDots: number, public labelGapInDots = 0) { }
}

/** A command class to set the media handling mode to web gap detection. */
export class SetLabelToWebGapMediaCommand implements IPrinterCommand {
  name = 'Sets the media handling mode to web gap detection.';
  type: CommandType = 'SetLabelToWebGapMedia';
  toDisplay(): string {
    return this.name;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public labelLengthInDots: number, public labelGapInDots: number) { }
}

/** A command class to set the media handling mode to black mark detection. */
export class SetLabelToMarkMediaCommand implements IPrinterCommand {
  name = 'Sets the media handling mode to black mark detection.';
  type: CommandType = 'SetLabelToMarkMedia';
  toDisplay(): string {
    return this.name;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(
    public labelLengthInDots: number,
    public blackLineThicknessInDots: number,
    public blackLineOffset: number
  ) { }
}

/** Command class to cause the printer to auto-sense the media length. */
export class AutosenseLabelDimensionsCommand extends BasicCommand {
  get name() { return 'Auto-sense the label length by feeding several labels.'; }
  type: CommandType = 'AutosenseLabelDimensions';
  constructor() { super (['altersConfig', 'feedsPaperIgnoringPeeler', 'feedsPaper'])}
  toDisplay(): string {
    return this.name;
  }
}

/** Command class to modify an offset. */
export class OffsetCommand implements IPrinterCommand {
  name = 'Modify offset';
  type: CommandType = 'Offset';
  toDisplay(): string {
    let str = `Set offset to ${this.horizontal} from the left`;
    if (this.vertical) {
      str += ` and ${this.vertical} from the top`;
    }
    str += this.absolute ? `of the label.` : ` of the current offset.`;
    return str;
  }
  effectFlags = NoEffect;

  constructor(
    public readonly horizontal: number,
    public readonly vertical?: number,
    public readonly absolute = false
  ) {
    this.horizontal = Math.floor(horizontal);
    this.vertical = vertical !== undefined ? Math.floor(vertical) : undefined;
    this.absolute = absolute;
  }
}

/** Command class to force a printer to reset. */
export class RebootPrinterCommand extends BasicCommand {
  get name() { return 'Simulate a power-cycle for the printer. This should be the final command.'; }
  type: CommandType = 'RebootPrinter';
  constructor() { super(['lossOfConnection']); }
}

/** Command class to draw an image into the image buffer for immediate print. */
export class AddImageCommand implements IPrinterCommand {
  name = 'Add image to label';
  type: CommandType = 'AddImage';
  toDisplay(): string {
    return `Adds a ${this.bitmap.width} wide x ${this.bitmap.height} high image.`;
  }
  effectFlags = NoEffect;

  constructor(
    public bitmap: Util.BitmapGRF,
    public imageConversionOptions: Util.ImageConversionOptions
  ) { }
}

/** Command class to draw a straight line. */
export class AddLineCommand implements IPrinterCommand {
  name = 'Add perpendicular line to label';
  type: CommandType = 'AddLine';
  toDisplay(): string {
    return `Add a ${DrawColor[this.color]} line ${this.widthInDots} wide by ${this.heightInDots} high.`;
  }
  effectFlags = NoEffect;

  constructor(
    public readonly widthInDots: number,
    public readonly heightInDots: number,
    public readonly color: DrawColor
  ) { }
}

/** Command to draw a box on a label */
export class AddBoxCommand implements IPrinterCommand {
  name = 'Add a box to label';
  type: CommandType = 'AddBox';
  toDisplay(): string {
    return `Add a box ${this.widthInDots} wide by ${this.heightInDots} high.`;
  }
  effectFlags = NoEffect;

  constructor(
    public readonly widthInDots: number,
    public readonly heightInDots: number,
    public readonly thickness: number
  ) { }
}

/** Sending a raw instruction to the printer. */
export class Raw implements IPrinterCommand {
  name = 'Sends a raw set of commands directly to the printer unmodified.';
  type: CommandType = 'Raw';
  toDisplay(): string { return this.name; }

  constructor(
    public readonly rawDocument: string,
    public readonly effectFlags: CommandEffectFlags
  ) { }
}
