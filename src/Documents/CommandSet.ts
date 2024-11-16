import type { PrinterCommandLanguage } from "../Languages/index.js";
import * as Commands from './Commands.js';
import type { Coordinate, IMessageHandlerResult, IPrinterLabelMediaOptions, MessageArrayLike } from "../Printers/index.js";
import type { TranspileDocumentError } from "./TranspileDocumentError.js";

/** How a command should be wrapped into a form, if at all */
export enum CommandFormInclusionMode {
  /** Command can appear in a shared form with other commands. */
  sharedForm = 0,
  /** Command should not be wrapped in a form at all. */
  noForm
}

export interface CommandSet<TMessageType extends MessageArrayLike> {
  /** Encode a raw string command into a raw command according to the command language rules. */
  encodeCommand<TOut extends MessageArrayLike>(cmd?: TMessageType, withNewline?: boolean): TOut;

  /** Display raw commands in a debugger-friendly string. */
  debugDisplayCommands<TCommands extends MessageArrayLike>(...commands: TCommands[]): string;

  /** Gets the command language this command set implements */
  get commandLanguage(): PrinterCommandLanguage;
  /** Get an empty command to do nothing at all. */
  get noop(): TMessageType;
  /** Gets the commands to start a new document. */
  get documentStartCommands(): Commands.IPrinterCommand[];
  /** Gets the commands to end a document. */
  get documentEndCommands(): Commands.IPrinterCommand[];
  /** Get a new document metadata tracking object. */
  getNewTranspileState(media: IPrinterLabelMediaOptions): TranspiledDocumentState;

  /** Parse a message object received from the printer. */
  parseMessage(
    msg: TMessageType,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<TMessageType>;

  /** Get expanded commands for a given command, if applicable. */
  expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];
  /** Determine if a given command must appear outside of a form. */
  isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean;

  /** Transpile a single command, tracking its effects to a document. */
  transpileCommand(
    cmd: Commands.IPrinterCommand,
    docMetadata: TranspiledDocumentState
  ): TMessageType | TranspileDocumentError;

  /** Combine separate commands into one series of commands. */
  combineCommands(...commands: TMessageType[]): TMessageType;
}

/** Interface of document state effects carried between individual commands. */
export interface TranspiledDocumentState {
  horizontalOffset: number;
  verticalOffset: number;
  lineSpacingDots: number;

  margin: {
    leftChars: number;
    rightChars: number;
  }
  printWidth: number;

  characterSize: Coordinate;

  commandEffectFlags: Commands.CommandEffectFlags;
}

/** A method for transpiling a given command to its native command. */
export type TranspileCommandDelegate<TOutput extends MessageArrayLike> = (
  cmd: Commands.IPrinterCommand,
  docState: TranspiledDocumentState,
  commandSet: CommandSet<TOutput>
) => TOutput;

/** A manifest for a custom extended printer command. */
export interface IPrinterExtendedCommandMapping<TOutput extends MessageArrayLike> {
  extendedTypeSymbol: symbol,
  delegate: TranspileCommandDelegate<TOutput>,
}
