import * as Commands from "../Documents/index.js";
import * as Messages from './index.js';

export abstract class StringCommandSet extends Messages.PrinterCommandSet<string> {

  private readonly _noop = "";
  protected get noop() {
    return this._noop;
  }

  protected constructor(
    implementedLanguage: Messages.PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(implementedLanguage, new Messages.StringMessageTransformer(), extendedCommands);
  }
}
