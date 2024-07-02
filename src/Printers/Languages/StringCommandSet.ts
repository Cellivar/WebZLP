import * as Commands from "../../Documents/index.js";
import type { IMessageHandlerResult } from "../Messages.js";
import type { IPrinterLabelMediaOptions } from "../index.js";
import type { PrinterCommandLanguage } from "./index.js";

export abstract class StringCommandSet implements Commands.CommandSet<string> {
  public abstract encodeCommand(str?: string, withNewline?: boolean): string;

  private readonly _noop = "";
  public get noop() {
    return this._noop;
  }

  public abstract get documentStartCommands(): Commands.IPrinterCommand[];
  public abstract get documentEndCommands(): Commands.IPrinterCommand[];
  private cmdLanguage: PrinterCommandLanguage;
  get commandLanguage() {
    return this.cmdLanguage;
  }

  public abstract getNewTranspileState(media: IPrinterLabelMediaOptions): Commands.TranspiledDocumentState;

  protected extendedCommandMap = new Map<symbol, Commands.TranspileCommandDelegate<string>>;

  protected constructor(
    implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<string>> = []
  ) {
    this.cmdLanguage = implementedLanguage;
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  public abstract parseMessage(
    msg: string,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<string>;

  public abstract expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];

  public abstract transpileCommand(
    cmd: Commands.IPrinterCommand,
    docState: Commands.TranspiledDocumentState
  ): string | Commands.TranspileDocumentError;

  protected extendedCommandHandler(
    cmd: Commands.IPrinterCommand,
    docState: Commands.TranspiledDocumentState
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
    return cmdHandler(cmd, docState, this);
  }

  public abstract isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean;

  public combineCommands(...commands: string[]) {
    return commands.join();
  }

  /** Apply an offset command to a document. */
  protected modifyOffset(
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
}
