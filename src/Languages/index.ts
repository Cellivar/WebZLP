import type { CommandSet } from '../Documents/index.js'
import { hasFlag } from '../EnumUtils.js'
import type { MessageArrayLike } from './Messages.js'

import * as Zpl from './Zpl/index.js'
import * as Epl from './Epl/index.js'

export * from './Epl/index.js'
export * from './Zpl/index.js'
export * from './Cpcl/index.js'
export * from './Dpl/index.js'
export * from './Ipl/index.js'

export * from './Messages.js'

// Extension point for extending the library
export * from './PrinterCommandSet.js'
export * from './RawCommandSet.js'
export * from './StringCommandSet.js'

// [flags] I miss C#.
/** Command languages a printer could support. One printer may support multiple. */
export enum PrinterCommandLanguage {
  /** Error condition indicating autodetect failed. */
  none = 0,
  /** Printer can be set to Eltron Printer Language. */
  epl = 1 << 0,
  /** Printer can be set to Zebra Printer Language. */
  zpl = 1 << 1,
  /** Printer can be set to Comtec Printer Command Language. */
  cpcl = 1 << 2,
  /** Printer can be set to Intermec Printer Language. */
  ipl = 1 << 3,
  /** Printer can be set to Datamax Printer Language. */
  dpl = 1 << 4,

  /** Printer is capable of switching between EPL and ZPL. */
  zplEmulateEpl = epl | zpl,
  /** Printer is CPCL native and can emulate EPL and ZPL. */
  cpclEmulateBoth = cpcl | epl | zpl
}

export function getCommandSetForLanguage(lang: PrinterCommandLanguage): CommandSet<MessageArrayLike> | undefined {
  // In order of preferred communication method
  if (hasFlag(lang, PrinterCommandLanguage.zpl)) {
    return new Zpl.ZplPrinterCommandSet();
  }
  if (hasFlag(lang, PrinterCommandLanguage.epl)) {
    return new Epl.EplPrinterCommandSet();
  }
  return undefined;
}
