import type { PrinterCommandLanguage } from "../Printers/Languages/index.js";
import * as Commands from './Commands.js';
import type { Coordinate, IMessageHandlerResult, IPrinterLabelMediaOptions } from "../Printers/index.js";
import type { TranspileDocumentError } from "./TranspileDocumentError.js";

/** How a command should be wrapped into a form, if at all */
export enum CommandFormInclusionMode {
  /** Command can appear in a shared form with other commands. */
  sharedForm = 0,
  /** Command should not be wrapped in a form at all. */
  noForm
}

export interface CommandSet<TOutput> {
  /** Encode a raw string command into a raw command according to the command language rules. */
  encodeCommand(str?: string, withNewline?: boolean): TOutput;

  /** Gets the command language this command set implements */
  get commandLanguage(): PrinterCommandLanguage;
  /** Get an empty command to do nothing at all. */
  get noop(): TOutput;
  /** Gets the commands to start a new document. */
  get documentStartCommands(): Commands.IPrinterCommand[];
  /** Gets the commands to end a document. */
  get documentEndCommands(): Commands.IPrinterCommand[];
  /** Get a new document metadata tracking object. */
  getNewTranspileState(media: IPrinterLabelMediaOptions): TranspiledDocumentState;

  /** Parse a message object received from the printer. */
  parseMessage(
    msg: TOutput,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<TOutput>;

  /** Get expanded commands for a given command, if applicable. */
  expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];
  /** Determine if a given command must appear outside of a form. */
  isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean;

  /** Transpile a single command, tracking its effects to a document. */
  transpileCommand(
    cmd: Commands.IPrinterCommand,
    docMetadata: TranspiledDocumentState
  ): TOutput | TranspileDocumentError;

  /** Combine separate commands into one series of commands. */
  combineCommands(...commands: TOutput[]): TOutput;
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
export type TranspileCommandDelegate<TOutput> = (
  cmd: Commands.IPrinterCommand,
  docState: TranspiledDocumentState,
  commandSet: CommandSet<TOutput>
) => TOutput;

/** A manifest for a custom extended printer command. */
export interface IPrinterExtendedCommandMapping<TOutput> {
  extendedTypeSymbol: symbol,
  delegate: TranspileCommandDelegate<TOutput>,
}
