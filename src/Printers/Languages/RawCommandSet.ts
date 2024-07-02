import * as Commands from "../../Documents/index.js";
import type { IMessageHandlerResult } from "../Messages.js";
import type { IPrinterLabelMediaOptions } from "../index.js";
import type { PrinterCommandLanguage } from "./index.js";

export abstract class RawCommandset implements Commands.CommandSet<Uint8Array> {
  /** Encode a raw string command into a Uint8Array according to the command language rules. */
  public abstract encodeCommand(str?: string, withNewline?: boolean): Uint8Array;

  private readonly _noop = new Uint8Array();
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

  protected extendedCommandMap = new Map<symbol, Commands.TranspileCommandDelegate<Uint8Array>>;

  protected constructor(
    implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    this.cmdLanguage = implementedLanguage;
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  public abstract parseMessage(
    msg: Uint8Array,
    sentCommand?: Commands.IPrinterCommand
  ): IMessageHandlerResult<Uint8Array>;

  public abstract expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];

  public abstract transpileCommand(
    cmd: Commands.IPrinterCommand,
    docState: Commands.TranspiledDocumentState
  ): Uint8Array | Commands.TranspileDocumentError;

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

  public combineCommands(...commands: Uint8Array[]) {
    const bufferLen = commands.reduce((sum, arr) => sum + arr.byteLength, 0);
    return commands.reduce(
      (accumulator, arr) => {
        accumulator.buffer.set(arr, accumulator.offset);
        return { ...accumulator, offset: arr.byteLength + accumulator.offset };
      },
      { buffer: new Uint8Array(bufferLen), offset: 0 }
    ).buffer;
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
