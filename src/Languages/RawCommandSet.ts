import * as Commands from "../Documents/index.js";
import { PrinterCommandSet } from "../Printers/index.js";
import type { PrinterCommandLanguage } from "./index.js";

export abstract class RawCommandSet extends PrinterCommandSet<Uint8Array> {

  private readonly _noop = new Uint8Array();
  public get noop() {
    return this._noop;
  }

  protected constructor(
    implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<Commands.IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    super(implementedLanguage, extendedCommands)
  }

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
}
