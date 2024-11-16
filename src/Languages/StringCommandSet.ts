import * as Commands from "../Documents/index.js";
import { PrinterCommandSet } from "../Printers/index.js";
import type { PrinterCommandLanguage } from "./index.js";

export abstract class StringCommandSet extends PrinterCommandSet<string> {

  private readonly _noop = "";
  public get noop() {
    return this._noop;
  }

  protected constructor(
    implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<string>> = []
  ) {
    super(implementedLanguage, extendedCommands);
  }

  public combineCommands(...commands: string[]) {
    return commands.join();
  }
}
