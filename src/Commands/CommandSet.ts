import * as Conf from '../Configs/index.js';
import * as Commands from './Commands.js';
import { TranspileDocumentError, type TranspiledDocumentState } from "./TranspileCommand.js";
import { MessageParsingError, RawMessageTransformer, StringMessageTransformer, type IMessageHandlerResult, type MessageTransformer } from './Messages.js';
import type { PrinterConfig } from './PrinterConfig.js';

/** How a command should be wrapped into a form, if at all */
export enum CommandFormInclusionMode {
  /** Command can appear in a shared form with other commands. */
  sharedForm = 0,
  /** Command should not be wrapped in a form at all. */
  noForm
}

/** Describes a command set for a printer. */
export interface CommandSet<TMsgType extends Conf.MessageArrayLike> {

  /** Parse a message object received from the printer. */
  parseMessage<TReceived extends Conf.MessageArrayLike>(
    msg: TReceived,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<TReceived>;

  /** Gets the command language this command set implements */
  get commandLanguage(): Conf.PrinterCommandLanguage;

  /** Gets the prefix to start a new document. */
  get documentStartPrefix(): TMsgType;
  /** Gets the suffix to end a document. */
  get documentEndSuffix(): TMsgType;

  /** Get expanded commands for a given command, if applicable. */
  expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];
  /** Determine if a given command must appear outside of a form. */
  isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean;
  /** Combine separate commands into one. */
  combineCommands(...commands: TMsgType[]): TMsgType;

  /** Expand a printer config to a language-specific config. */
  getConfig(config: PrinterConfig): PrinterConfig;

  /** Transpile a single command, tracking its effects to a document. */
  transpileCommand(
    cmd: Commands.IPrinterCommand,
    docMetadata: TranspiledDocumentState
  ): TMsgType | TranspileDocumentError;
}

/** A method for transpiling a given command to its native command. */
export type TranspileCommandDelegate<
  TCmd extends Commands.IPrinterCommand,
  TMsgType extends Conf.MessageArrayLike
> = (
  cmd: TCmd,
  docState: TranspiledDocumentState,
  commandSet: CommandSet<TMsgType>
) => TMsgType | TranspileDocumentError;

/** A method for expanding one command into multiple other commands. */
export type CommandExpandDelegate<TCmd extends Commands.IPrinterCommand> = (
  cmd?: TCmd
) => Commands.IPrinterCommand[];

/** A method for handling a response message to a command. */
export type MessageHandlerDelegate<TMsgType> = (
  msg: TMsgType,
  sentCommand: Commands.IPrinterCommand
) => IMessageHandlerResult<TMsgType>;

/** A manifest for a printer command's behavior. */
export interface IPrinterCommandMapping<TMsgType extends Conf.MessageArrayLike> {
  /** The printer command being mapped. */
  commandType: Commands.CommandAnyType,
  /** Method to transpile this command to its native command. */
  transpile?: TranspileCommandDelegate<Commands.IPrinterCommand, TMsgType>,
  /** Method to replace a command with multiple other commands. */
  expand?: CommandExpandDelegate<Commands.IPrinterCommand>,
  /** Method to handle a message from the device in response to this command. */
  readMessage?: MessageHandlerDelegate<TMsgType>,
  /** Compatibility of this command with being included in a form. Defaults to true. */
  formInclusionMode?: CommandFormInclusionMode,
}

export abstract class PrinterCommandSet<TMsgType extends Conf.MessageArrayLike> implements CommandSet<TMsgType> {
  private cmdLanguage: Conf.PrinterCommandLanguage;
  get commandLanguage() {
    return this.cmdLanguage;
  }

  protected abstract get noop(): TMsgType;

  protected messageTransformer: MessageTransformer<TMsgType>;

  protected commandMap = new Map<Commands.CommandAnyType, IPrinterCommandMapping<TMsgType>>;

  protected constructor(
    transformer        : MessageTransformer<TMsgType>,
    implementedLanguage: Conf.PrinterCommandLanguage,
    basicCommands      : Record<Commands.CommandType, IPrinterCommandMapping<TMsgType>>,
    extendedCommands   : IPrinterCommandMapping<TMsgType>[] = []
  ) {
    this.cmdLanguage = implementedLanguage;
    this.messageTransformer = transformer;
    for (const cmdType of Commands.basicCommandTypes) {
      this.commandMap.set(cmdType, basicCommands[cmdType]);
    }
    // Support overriding behaviors
    extendedCommands.forEach(c => this.commandMap.set(c.commandType, c));
  }

  abstract parseMessage<TReceived extends Conf.MessageArrayLike>(msg: TReceived, sentCommand?: Commands.IPrinterCommand): IMessageHandlerResult<TReceived>;
  abstract get documentStartPrefix(): TMsgType;
  abstract get documentEndSuffix(): TMsgType;

  public transpileCommand(
    cmd: Commands.IPrinterCommand,
    docMetadata: TranspiledDocumentState
  ): TMsgType | TranspileDocumentError{
    const mappedCmd = this.getMappedCmd(cmd);
    if (mappedCmd === undefined) {
      return new TranspileDocumentError(`Command could not be mapped, is the command mapping correcT?`);
    }
    const handler = mappedCmd.transpile ?? (() => this.noop);
    return handler(cmd, docMetadata, this);
  }

  protected getMappedCmd(cmd: Commands.IPrinterCommand) {
    return this.commandMap.get(Commands.getCommandAnyType(cmd));
  }

  public isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean {
    return this.getMappedCmd(cmd)?.formInclusionMode === CommandFormInclusionMode.noForm;
  }

  public expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[] {
    return (this.getMappedCmd(cmd)?.expand ?? (() => []))(cmd);
  }

  public combineCommands(...commands: TMsgType[]) {
    return this.messageTransformer.combineMessages(...commands);
  }

  public getConfig(config: PrinterConfig): PrinterConfig {
    return config;
  }

  public callMessageHandler(
    message: TMsgType,
    sentCommand?: Commands.IPrinterCommand
  ) {
    if (sentCommand === undefined) {
      throw new MessageParsingError(
        `Received a command reply message without 'sentCommand' being provided, can't handle this message.`,
        message
      );
    }

    const handler = this.getMappedCmd(sentCommand)?.readMessage;
    if (handler === undefined) {
      throw new MessageParsingError(
        `Command '${sentCommand.name}' has no message handler and should not have been awaited for this message. This is a bug in the library.`,
        message
      )
    }

    return handler(message, sentCommand);
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

    const handler = this.getMappedCmd(cmd)?.transpile;

    if (handler === undefined) {
      throw new TranspileDocumentError(
        `Unknown command '${cmd.constructor.name}' was not found in the command map for ${this.commandLanguage} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
      );
    }
    return handler;
  }
}

export abstract class RawCommandSet extends PrinterCommandSet<Uint8Array> {

  protected static readonly _noop = new Uint8Array();
  public get noop() {
    return RawCommandSet._noop;
  }

  protected constructor(
    implementedLanguage: Conf.PrinterCommandLanguage,
    basicCommands      : Record<Commands.CommandType,  IPrinterCommandMapping<Uint8Array>>,
    extendedCommands   : IPrinterCommandMapping<Uint8Array>[] = []
  ) {
    super(
      new RawMessageTransformer(),
      implementedLanguage,
      basicCommands,
      extendedCommands
    );
  }
}

export abstract class StringCommandSet extends PrinterCommandSet<string> {

  protected static readonly _noop = "";
  public get noop() {
    return StringCommandSet._noop;
  }

  protected constructor(
    implementedLanguage: Conf.PrinterCommandLanguage,
    basicCommands      : Record<Commands.CommandType,  IPrinterCommandMapping<string>>,
    extendedCommands   : IPrinterCommandMapping<string>[] = []
  ) {
    super(
      new StringMessageTransformer(),
      implementedLanguage,
      basicCommands,
      extendedCommands
    );
  }
}
