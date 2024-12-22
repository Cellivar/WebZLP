import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import { BasicCommand, CommandEffectFlags, NoEffect, type CommandTypeBasic, type IPrinterBasicCommand } from './Commands.js';

export class StartLabel extends BasicCommand {
  name = 'Explicitly start a new label.';
  type = 'StartLabel' as const;
  constructor() { super([]); }
}

export class EndLabel extends BasicCommand {
  name = 'Explicitly end a label.';
  type: CommandTypeBasic = 'EndLabel';
  constructor() { super([]); }
}

export class PrintCommand implements IPrinterBasicCommand {
  name = 'Print label';
  type: CommandTypeBasic = 'Print';
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

export class NoOp extends BasicCommand {
  name = 'No operation placeholder';
  type: CommandTypeBasic = 'NoOp';
  constructor() { super(); }
}

export class GetStatusCommand extends BasicCommand {
  name = 'Get the immediate printer status';
  type: CommandTypeBasic = 'GetStatus';
  constructor() { super(['waitsForResponse']); }
}

export class CutNowCommand extends BasicCommand {
  name = 'Cycle the media cutter now';
  type: CommandTypeBasic = 'CutNow';
  constructor() { super(['actuatesCutter']); }
}

/** A command to clear the image buffer. */
export class ClearImageBufferCommand extends BasicCommand {
  name = 'Clear image buffer';
  type: CommandTypeBasic = 'ClearImageBuffer';
  constructor() { super([]); }
}

/** A command to have the printer send its configuration back over serial. */
export class QueryConfigurationCommand extends BasicCommand {
  name = 'Query for printer config';
  type: CommandTypeBasic = 'QueryConfiguration';
  constructor() { super(['waitsForResponse']); }
}

/** A command to have the printer print its configuration labels. */
export class PrintConfigurationCommand extends BasicCommand {
  get name() { return "Print printer's config onto labels"; }
  type: CommandTypeBasic = 'PrintConfiguration';
  constructor() { super([]); }
}

/** A command to store the current configuration as the stored configuration. */
export class SaveCurrentConfigurationCommand extends BasicCommand {
  name = 'Store the current configuration as the saved configuration.';
  type: CommandTypeBasic = 'SaveCurrentConfiguration';
  constructor() { super([]); }
}

/** A command to set the darkness the printer prints at. */
export class SetDarknessCommand implements IPrinterBasicCommand {
  name = 'Set darkness';
  type: CommandTypeBasic = 'SetDarkness';
  toDisplay(): string {
    return `Set darkness to ${this.darknessPercent}%`;
  }

  constructor(
    public readonly darknessPercent: Conf.DarknessPercent
  ) {}

  effectFlags = new CommandEffectFlags(['altersConfig']);
}

export class SetBackfeedAfterTakenMode implements IPrinterBasicCommand {
  name = 'Set backfeed mode after label is taken';
  type: CommandTypeBasic = 'SetBackfeedAfterTaken';
  toDisplay(): string {
    if (this.mode === 'disabled') {
      return 'Disable backfeed';
    } else {
      return `Set backfeed to ${this.mode}% after label cut/taken.`;
    }
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public readonly mode: Conf.BackfeedAfterTaken) { }
}

/** A command to set the direction a label prints, either upside down or not. */
export class SetPrintDirectionCommand implements IPrinterBasicCommand {
  name = 'Set print direction';
  type: CommandTypeBasic = 'SetPrintDirection';
  toDisplay(): string {
    return `Print labels ${this.upsideDown ? 'upside-down' : 'right-side up'}`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public readonly upsideDown: boolean) { }
}

/** A command to set the print speed a printer prints at. Support varies per printer. */
export class SetPrintSpeedCommand implements IPrinterBasicCommand {
  name = 'Set print speed';
  type: CommandTypeBasic = 'SetPrintSpeed';
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
export class SetLabelDimensionsCommand implements IPrinterBasicCommand {
  name = 'Set label dimensions';
  type: CommandTypeBasic = 'SetLabelDimensions';
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

export class SetLabelHomeCommand implements IPrinterBasicCommand {
  name = 'Sets the label home (origin) offset';
  type: CommandTypeBasic = 'SetLabelHome';
  toDisplay(): string {
    return `Set the label home (origin) to ${this.offset.left},${this.offset.top} from the top-left.`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public offset: Conf.Coordinate) { }
}

/** Command class to set the print offset from the top-left of the label. */
export class SetLabelPrintOriginOffsetCommand implements IPrinterBasicCommand {
  name = 'Sets the print offset from the top left corner.';
  type: CommandTypeBasic = 'SetLabelPrintOriginOffset';
  toDisplay(): string {
    return `Sets the print offset to ${this.offset.left} in and ${this.offset.top} down from the top-left.`;
  }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(public offset: Conf.Coordinate) { }
}

/** A command to set the media tracking type to continuous media. */
export class SetMediaToContinuousMediaCommand implements IPrinterBasicCommand {
  name = 'Sets the media tracking type to continuous media.';
  type: CommandTypeBasic = 'SetMediaToContinuousMedia';
  toDisplay(): string { return this.name; }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(
    public mediaLengthInDots: number,
    public formGapInDots: number
  ) { }
}

/** A command to set the media tracking type to web gap detection. */
export class SetMediaToWebGapMediaCommand implements IPrinterBasicCommand {
  name = 'Sets the media tracking type to web gap detection.';
  type: CommandTypeBasic = 'SetMediaToWebGapMedia';
  toDisplay(): string { return this.name; }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(
    public mediaLengthInDots: number,
    public mediaGapInDots: number,
    public mediaGapOffsetInDots: number = 0,
  ) { }
}

/** A command to set the media tracking type to black mark detection. */
export class SetMediaToMarkMediaCommand implements IPrinterBasicCommand {
  name = 'Sets the media tracking type to black mark detection.';
  type: CommandTypeBasic = 'SetMediaToMarkMedia';
  toDisplay(): string { return this.name; }
  effectFlags = new CommandEffectFlags(['altersConfig']);

  constructor(
    public mediaLengthInDots: number,
    public blackLineThicknessInDots: number,
    public blackLineOffset: number = 0
  ) { }
}

/** Command to cause the printer to auto-sense the media length. */
export class AutosenseMediaDimensionsCommand extends BasicCommand {
  get name() { return 'Auto-sense the media length by feeding several labels.'; }
  type: CommandTypeBasic = 'AutosenseMediaDimensions';
  constructor() { super (['altersConfig', 'feedsPaperIgnoringPeeler', 'feedsPaper'])}
  override toDisplay(): string { return this.name; }
}

/** Command class to modify an offset. */
export class OffsetCommand implements IPrinterBasicCommand {
  name = 'Modify offset';
  type: CommandTypeBasic = 'Offset';
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
  type: CommandTypeBasic = 'RebootPrinter';
  constructor() { super(['lossOfConnection']); }
}

/** Command class to draw an image into the image buffer for immediate print. */
export class AddImageCommand implements IPrinterBasicCommand {
  name = 'Add image to label';
  type: CommandTypeBasic = 'AddImage';
  toDisplay(): string {
    return `Adds a ${this.bitmap.width} wide x ${this.bitmap.height} high image.`;
  }
  effectFlags = NoEffect;

  constructor(
    public bitmap: Util.BitmapGRF,
    public imageConversionOptions: Util.ImageConversionOptions
  ) { }
}

/** List of colors to draw elements with */
export enum DrawColor {
  /** Draw in black */
  black,
  /** Draw in white */
  white
}

/** Command class to draw a straight line. */
export class AddLineCommand implements IPrinterBasicCommand {
  name = 'Add perpendicular line to label';
  type: CommandTypeBasic = 'AddLine';
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
export class AddBoxCommand implements IPrinterBasicCommand {
  name = 'Add a box to label';
  type: CommandTypeBasic = 'AddBox';
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
export class Raw implements IPrinterBasicCommand {
  name = 'Sends a raw set of commands directly to the printer unmodified.';
  type: CommandTypeBasic = 'Raw';
  toDisplay(): string { return this.name; }

  constructor(
    public readonly rawDocument: string,
    public readonly effectFlags: CommandEffectFlags
  ) { }
}
