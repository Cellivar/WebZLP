import * as Commands from '../Documents/index.js';
import type { IPrinterLabelMediaOptions } from '../Printers/Configuration/PrinterOptions.js';
import * as Messages from './Messages.js';
import type { PrinterCommandLanguage } from "./index.js";

export abstract class PrinterCommandSet<TMessageType extends Messages.MessageArrayLike> implements Commands.CommandSet<Messages.MessageArrayLike> {
  public abstract encodeCommand<TOut extends Messages.MessageArrayLike>(cmd?: TMessageType, withNewline?: boolean): TOut;

  /** List of commands which must not appear within a form, according to this language's rules */
  protected abstract nonFormCommands: Array<symbol | Commands.CommandType>;

  public abstract get noop(): TMessageType;
  public abstract get documentStartCommands(): Commands.IPrinterCommand[];
  public abstract get documentEndCommands(): Commands.IPrinterCommand[];
  private cmdLanguage: PrinterCommandLanguage;
  get commandLanguage() {
    return this.cmdLanguage;
  }

  public abstract getNewTranspileState(media: IPrinterLabelMediaOptions): Commands.TranspiledDocumentState;

  protected extendedCommandMap = new Map<symbol, Commands.TranspileCommandDelegate<TMessageType>>;

  protected constructor(
    implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<TMessageType>> = []
  ) {
    this.cmdLanguage = implementedLanguage;
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  public abstract debugDisplayCommands(...commands: Messages.MessageArrayLike[]): string;

  public abstract combineCommands(...commands: Messages.MessageArrayLike[]): Messages.MessageArrayLike;

  public abstract expandCommand(cmd: Commands.IPrinterCommand): Commands.IPrinterCommand[];

  public abstract isCommandNonFormCommand(cmd: Commands.IPrinterCommand): boolean;

  public abstract parseMessage(
    msg: string,
    sentCommand?: Commands.IPrinterCommand
  ): Messages.IMessageHandlerResult<string>;

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

/** Class for storing in-progress document generation information */
export class TranspiledDocumentState {
  horizontalOffset = 0;
  verticalOffset = 0;
  lineSpacingDots = 5;

  commandEffectFlags = Commands.PrinterCommandEffectFlags.none;

  rawCmdBuffer: Array<Uint8Array> = [];

  /** Add a raw command to the internal buffer. */
  addRawCommand(array: Uint8Array) {
    if (array && array.length > 0) {
      this.rawCmdBuffer.push(array);
    }
  }

  /**
   * Gets a single buffer of the internal command set.
   */
  get combinedBuffer(): Uint8Array {
    const bufferLen = this.rawCmdBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
    return this.rawCmdBuffer.reduce(
      (accumulator, arr) => {
        accumulator.buffer.set(arr, accumulator.offset);
        return { ...accumulator, offset: arr.byteLength + accumulator.offset };
      },
      { buffer: new Uint8Array(bufferLen), offset: 0 }
    ).buffer;
  }
}
