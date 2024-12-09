import * as Conf from '../Configs/index.js';
import * as Commands from './Commands.js';
import { TranspileDocumentError, type TranspiledDocumentState } from "./TranspileCommand.js";
import { RawMessageTransformer, StringMessageTransformer, type IMessageHandlerResult, type MessageTransformer } from './Messages.js';

/** How a command should be wrapped into a form, if at all */
export enum CommandFormInclusionMode {
  /** Command can appear in a shared form with other commands. */
  sharedForm = 0,
  /** Command should not be wrapped in a form at all. */
  noForm
}

/** Describes a command set for a printer. */
export interface CommandSet<TCmdType extends Conf.MessageArrayLike> {

  /** Parse a message object received from the printer. */
  parseMessage<TReceived extends Conf.MessageArrayLike>(
    msg: TReceived,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<TReceived>;

  /** Gets the command language this command set implements */
  get commandLanguage(): Conf.PrinterCommandLanguage;

  /** Gets the prefix to start a new document. */
  get documentStartPrefix(): TCmdType;
  /** Gets the suffix to end a document. */
  get documentEndSuffix(): TCmdType;

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
export type TranspileCommandDelegate<TOutput extends Conf.MessageArrayLike> = (
  cmd: Commands.IPrinterCommand,
  docState: TranspiledDocumentState,
  commandSet: CommandSet<TOutput>
) => TOutput;

/** A manifest for a custom extended printer command. */
export interface IPrinterExtendedCommandMapping<TOutput extends Conf.MessageArrayLike> {
  extendedTypeSymbol: symbol,
  delegate: TranspileCommandDelegate<TOutput>,
}

export abstract class PrinterCommandSet<TCmdType extends Conf.MessageArrayLike> implements CommandSet<TCmdType> {
  private cmdLanguage: Conf.PrinterCommandLanguage;
  get commandLanguage() {
    return this.cmdLanguage;
  }

  protected abstract get noop(): TCmdType;

  protected messageTransformer: MessageTransformer<TCmdType>;

  /** List of commands which must not appear within a form, according to this language's rules */
  protected abstract nonFormCommands: Array<symbol | Commands.CommandType>;

  protected extendedCommandMap = new Map<symbol, TranspileCommandDelegate<TCmdType>>;

  protected constructor(
    implementedLanguage: Conf.PrinterCommandLanguage,
    transformer: MessageTransformer<TCmdType>,
    extendedCommands: Array<IPrinterExtendedCommandMapping<TCmdType>> = []
  ) {
    this.cmdLanguage = implementedLanguage;
    this.messageTransformer = transformer;
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  abstract parseMessage<TReceived extends Conf.MessageArrayLike>(msg: TReceived, sentCommand?: Commands.IPrinterCommand): IMessageHandlerResult<TReceived>;
  abstract get documentStartPrefix(): TCmdType;
  abstract get documentEndSuffix(): TCmdType;
  abstract transpileCommand(cmd: Commands.IPrinterCommand, docMetadata: TranspiledDocumentState): TCmdType | TranspileDocumentError;

  public isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean {
    return this.nonFormCommands.includes(
      cmd.type === 'CustomCommand'
        ? (cmd as Commands.IPrinterExtendedCommand).typeExtended
        : cmd.type
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public expandCommand(_cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[] {
    // To be overridden in languages that need to.
    return [];
  }

  public combineCommands(...commands: TCmdType[]) {
    return this.messageTransformer.combineMessages(...commands);
  }

  /** Apply an offset command to a document. */
  protected applyOffset(
    cmd: Commands.OffsetCommand,
    outDoc: TranspiledDocumentState
  ) {
    const newHoriz = cmd.absolute ? cmd.horizontal : outDoc.horizontalOffset + cmd.horizontal;
    outDoc.horizontalOffset = newHoriz < 0 ? 0 : newHoriz;
    if (cmd.vertical !== undefined) {
      const newVert = cmd.absolute ? cmd.vertical : outDoc.verticalOffset + cmd.vertical;
      outDoc.verticalOffset = newVert < 0 ? 0 : newVert;
    }
    return this.noop;
  }

  protected getExtendedCommand(
    cmd: Commands.IPrinterCommand
  ) {
    const lookup = (cmd as Commands.IPrinterExtendedCommand).typeExtended;
    if (!lookup) {
      throw new TranspileDocumentError(
        `Command '${cmd.constructor.name}' did not have a value for typeExtended. If you're trying to implement a custom command check the documentation.`
      )
    }

    const cmdHandler = this.extendedCommandMap.get(lookup);

    if (cmdHandler === undefined) {
      throw new TranspileDocumentError(
        `Unknown command '${cmd.constructor.name}' was not found in the command map for ${this.commandLanguage} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
      );
    }
    return cmdHandler;
  }
}

export abstract class RawCommandSet extends PrinterCommandSet<Uint8Array> {

  private readonly _noop = new Uint8Array();
  public get noop() {
    return this._noop;
  }

  protected constructor(
    implementedLanguage: Conf.PrinterCommandLanguage,
    extendedCommands: Array<IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    super(implementedLanguage, new RawMessageTransformer(), extendedCommands);
  }
}

export abstract class StringCommandSet extends PrinterCommandSet<string> {

  private readonly _noop = "";
  protected get noop() {
    return this._noop;
  }

  protected constructor(
    implementedLanguage: Conf.PrinterCommandLanguage,
    extendedCommands: Array<IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(implementedLanguage, new StringMessageTransformer(), extendedCommands);
  }
}
