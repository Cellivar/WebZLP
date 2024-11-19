import * as Commands from '../Documents/index.js';
import * as Messages from './index.js';

export abstract class PrinterCommandSet<TCmdType extends Messages.MessageArrayLike> implements Commands.CommandSet<TCmdType> {
  private cmdLanguage: Messages.PrinterCommandLanguage;
  get commandLanguage() {
    return this.cmdLanguage;
  }

  protected abstract get noop(): TCmdType;

  protected messageTransformer: Messages.MessageTransformer<TCmdType>;

  /** List of commands which must not appear within a form, according to this language's rules */
  protected abstract nonFormCommands: Array<symbol | Commands.CommandType>;

  protected extendedCommandMap = new Map<symbol, Commands.TranspileCommandDelegate<TCmdType>>;

  protected constructor(
    implementedLanguage: Messages.PrinterCommandLanguage,
    transformer: Messages.MessageTransformer<TCmdType>,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<TCmdType>> = []
  ) {
    this.cmdLanguage = implementedLanguage;
    this.messageTransformer = transformer;
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  abstract parseMessage<TReceived extends Messages.MessageArrayLike>(msg: TReceived, sentCommand?: Commands.IPrinterCommand): Messages.IMessageHandlerResult<TReceived>;
  abstract get documentStartCommands(): Commands.IPrinterCommand[];
  abstract get documentEndCommands(): Commands.IPrinterCommand[];
  abstract transpileCommand(cmd: Commands.IPrinterCommand, docMetadata: Commands.TranspiledDocumentState): TCmdType | Commands.TranspileDocumentError;

  public isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean {
    return this.nonFormCommands.includes(
      cmd.type === 'CustomCommand'
        ? (cmd as Commands.IPrinterExtendedCommand).typeExtended
        : cmd.type
    );
  }

  public expandCommand(_: Commands.IPrinterCommand): Commands.IPrinterCommand[] {
    // To be overridden in languages that need to.
    return [];
  }

  public combineCommands(...commands: TCmdType[]) {
    return this.messageTransformer.combineMessages(...commands);
  }

  /** Apply an offset command to a document. */
  protected applyOffset(
    cmd: Commands.OffsetCommand,
    outDoc: Commands.TranspiledDocumentState
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
      throw new Commands.TranspileDocumentError(
        `Command '${cmd.constructor.name}' did not have a value for typeExtended. If you're trying to implement a custom command check the documentation.`
      )
    }

    const cmdHandler = this.extendedCommandMap.get(lookup);

    if (cmdHandler === undefined) {
      throw new Commands.TranspileDocumentError(
        `Unknown command '${cmd.constructor.name}' was not found in the command map for ${this.commandLanguage} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
      );
    }
    return cmdHandler;
  }
}
