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
export type IPrinterCommand = IPrinterCommandBase & (IPrinterBasicCommand | IPrinterExtendedCommand)

interface IPrinterCommandBase {
  /** Get the display name of this command. */
  readonly name: string;
  /** Any effects this command may cause the printer to undergo. */
  readonly effectFlags: CommandEffectFlags;
  /** Get the human-readable output of this command. */
  toDisplay(): string;
}

export type CommandTypeBasic = Exclude<CommandType, 'CustomCommand'>;
/** A basic printer command, common to all printer languages. */
export interface IPrinterBasicCommand extends IPrinterCommandBase {
  /** Get the command type of this command. */
  readonly type: CommandTypeBasic;
}

/** A custom command beyond the standard command set, with language-specific behavior. */
export interface IPrinterExtendedCommand extends IPrinterCommandBase {
  /** Get the command type of this command. */
  readonly type: Extract<CommandType, 'CustomCommand'>;
  /** The unique identifier for this command. */
  readonly typeExtended: symbol;
  /** Gets the command languages this extended command can apply to. */
  readonly commandLanguageApplicability: Conf.PrinterCommandLanguage;
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

export const basicCommandTypes = [
  // Users/PCLs may supply printer commands. This uses a different lookup table.
  "CustomCommand",
  // General printer commands
  "Identify",
  "RebootPrinter",
  "Raw",
  "NoOp",
  // Status commands
  "GetStatus",
  "PrintConfiguration",
  "QueryConfiguration",
  // Configuration commands
  "SaveCurrentConfiguration",
  "AutosenseMediaDimensions",
  "SetDarkness",
  "SetLabelDimensions",
  "SetLabelHome",
  "SetLabelPrintOriginOffset",
  "SetMediaToContinuousMedia",
  "SetMediaToWebGapMedia",
  "SetMediaToMarkMedia",
  "SetPrintDirection",
  "SetPrintSpeed",
  "SetBackfeedAfterTaken",
  // Document handling
  "NewLabel",
  "StartLabel",
  "EndLabel",
  "CutNow",
  "Print",
  // Content
  "ClearImageBuffer",
  "AddBox",
  "AddImage",
  "AddLine",
  "Offset",
] as const;
/** Union type of all possible commands that must be handled by command sets. */
export type CommandType = typeof basicCommandTypes[number];

/**A regular command or an extended command type. */
export type CommandAnyType = CommandType | symbol;
export function getCommandAnyType(cmd: IPrinterCommand | IPrinterExtendedCommand): CommandAnyType {
  if (cmd.type === 'CustomCommand') {
    return cmd.typeExtended;
  } else {
    return cmd.type;
  }
}

export abstract class BasicCommand implements IPrinterBasicCommand {
  abstract name: string;
  abstract type: CommandTypeBasic;
  effectFlags: CommandEffectFlags;
  toDisplay() { return this.name; }
  constructor(effects: PrinterCommandEffectTypes[] = []) {
    this.effectFlags = new CommandEffectFlags(effects);
  }
}
