import type { PrinterCommandLanguage } from "../Languages/index.js";
import * as Commands from './Commands.js';
import type { IMessageHandlerResult, MessageArrayLike } from "../Printers/index.js";
import type { TranspiledDocumentState, TranspileDocumentError } from "./DocumentTranspiler.js";

/** How a command should be wrapped into a form, if at all */
export enum CommandFormInclusionMode {
  /** Command can appear in a shared form with other commands. */
  sharedForm = 0,
  /** Command should not be wrapped in a form at all. */
  noForm
}

/** Describes a command set for a printer. */
export interface CommandSet<TCmdType extends MessageArrayLike> {

  /** Parse a message object received from the printer. */
  parseMessage<TReceived extends MessageArrayLike>(
    msg: TReceived,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<TReceived>;

  /** Gets the command language this command set implements */
  get commandLanguage(): PrinterCommandLanguage;

  /** Gets the commands to start a new document. */
  get documentStartCommands(): Commands.IPrinterCommand[];
  /** Gets the commands to end a document. */
  get documentEndCommands(): Commands.IPrinterCommand[];

  /** Get expanded commands for a given command, if applicable. */
  expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];
  /** Determine if a given command must appear outside of a form. */
  isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean;
  /** Combine separate commands into one. */
  combineCommands(...commands: TCmdType[]): TCmdType;

  /** Transpile a single command, tracking its effects to a document. */
  transpileCommand(
    cmd: Commands.IPrinterCommand,
    docMetadata: TranspiledDocumentState
  ): TCmdType | TranspileDocumentError;
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
