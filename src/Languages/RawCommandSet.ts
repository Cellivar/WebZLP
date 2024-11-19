import * as Commands from "../Documents/index.js";
import * as Messages from './index.js';

export abstract class RawCommandSet extends Messages.PrinterCommandSet<Uint8Array> {

  private readonly _noop = new Uint8Array();
  public get noop() {
    return this._noop;
  }

  protected constructor(
    implementedLanguage: Messages.PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    super(implementedLanguage, new Messages.RawMessageTransformer(), extendedCommands);
  }
}
