import type { MessageArrayLike, PrinterCommandLanguage } from "../Languages/index.js";
import { CommandReorderBehavior, type CommandEffectFlags, type IPrinterCommand } from "./Commands.js";

/** A prepared document, ready to be compiled and sent. */
export interface IDocument {
  /** Gets the series of commands this document contains. */
  commands: ReadonlyArray<IPrinterCommand>;
}

/** Stream of commands, optionally ended by an awaited command. */
export class Transaction{
  constructor(
    public readonly commands: MessageArrayLike,
    public readonly awaitedCommand: IPrinterCommand | undefined,
  ) {}
}

/** Compiled document of commands ready to be sent to a printer which supports the PCL. */
export class CompiledDocument {
  constructor(
    public readonly language: PrinterCommandLanguage,
    public readonly effects: CommandEffectFlags,
    public readonly transactions: Transaction[]
  ) {}
}

/** A basic document builder, containing internal state to construct a document. */
export abstract class DocumentBuilder<TBuilder extends DocumentBuilder<TBuilder>> {
  private _commands: IPrinterCommand[] = [];

  /** The reordering behavior for commands that should not be present within a document. */
  abstract get commandReorderBehavior(): CommandReorderBehavior;

  /** Clear the commands in this document and reset it to the starting blank. */
  clear(): TBuilder {
    this._commands = [];
    return this as unknown as TBuilder;
  }

  /** Return the list of commands that will be performed in human-readable format. */
  showCommands(): string {
    return this._commands.map((c) => c.toDisplay()).join('\n');
  }

  /** Return the final built document. */
  finalize(): IDocument {
    return { commands: this._commands }
  }

  protected andThen(...command: IPrinterCommand[]): TBuilder {
    this._commands.push(...command);
    return this as unknown as TBuilder;
  }
}
