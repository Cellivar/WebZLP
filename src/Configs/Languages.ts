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

/** Types that can be used for comm channels to printers. */
export type MessageArrayLike = string | Uint8Array
export type MessageArrayLikeType = "string" | "Uint8Array"
export interface MessageArrayLikeMap {
  "string": string;
  "Uint8Array": Uint8Array;
}
