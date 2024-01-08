import { CompiledDocument, type IDocument } from '../../Documents/Document.js';
import { WebZlpError } from '../../WebZlpError.js';
import { PrinterCommandLanguage, PrinterOptions, type IPrinterLabelMediaOptions } from '../Configuration/PrinterOptions.js';
import * as Commands from '../../Documents/Commands.js';

/** A manifest for a custom extended printer command. */
export interface IPrinterExtendedCommandMapping<TOutput> {
  extendedTypeSymbol: symbol,
  delegate: TranspileCommandDelegate<TOutput>,
}

export type TranspileCommandDelegate<TOutput> = (
  cmd: Commands.IPrinterCommand,
  formDoc: TranspiledDocumentState,
  commandSet: PrinterCommandSet
) => TOutput;

type RawCommandForm = { commands: Array<Commands.IPrinterCommand>; withinForm: boolean };

export abstract class PrinterCommandSet {
  /** Encode a raw string command into a Uint8Array according to the command language rules. */
  public abstract encodeCommand(str?: string, withNewline?: boolean): Uint8Array;

  private readonly _noop = new Uint8Array();
  /** Get an empty command to be used as a no-op. */
  protected get noop() {
    return this._noop;
  }

  /** Gets the command to start a new form. */
  protected abstract get formStartCommand(): Uint8Array;
  /** Gets the command to end a form. */
  protected abstract get formEndCommand(): Uint8Array;
  /** Gets the command language this command set implements */
  abstract get commandLanguage(): PrinterCommandLanguage;

  protected extendedCommandMap = new Map<symbol, TranspileCommandDelegate<Uint8Array>>;

  protected constructor(
    public readonly implementedLanguage: PrinterCommandLanguage,
    extendedCommands: Array<IPrinterExtendedCommandMapping<Uint8Array>> = []
  ) {
    extendedCommands.forEach(c => this.extendedCommandMap.set(c.extendedTypeSymbol, c.delegate));
  }

  /** Transpile a command to its native command equivalent. */
  public abstract transpileCommand(
    cmd: Commands.IPrinterCommand,
    docState: TranspiledDocumentState
  ): Uint8Array | TranspileDocumentError;

  // protected transpileCommand(
  //   command: Commands.IPrinterCommand,
  //   formMetadata: TranspilationFormMetadata
  // ) {
  //   let lookup: symbol | Commands.CommandType;
  //   if (
  //     command.type === Commands.CommandType.CommandCustomSpecificCommand ||
  //     command.type === Commands.CommandType.CommandLanguageSpecificCommand
  //   ) {
  //     lookup = (command as Commands.IPrinterExtendedCommand).typeExtended;
  //   } else {
  //     lookup = command.type;
  //   }

  //   if (!lookup) {
  //     throw new TranspileDocumentError(
  //       `Command '${command.constructor.name}' did not have a valid lookup element. If you're trying to implement a custom command check the documentation for correct formatting.`
  //     );
  //   }

  //   const func = this.transpileCommandMap.get(lookup);
  //   if (func === undefined) {
  //     throw new TranspileDocumentError(
  //       `Unknown command '${command.constructor.name}' was not found in the command map for ${PrinterCommandLanguage[this.commandLanguage]} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
  //     );
  //   }

  //   return func(command, formMetadata, this);
  // }

  protected extendedCommandHandler(
    cmd: Commands.IPrinterCommand,
    docState: TranspiledDocumentState
  ) {
    const lookup = (cmd as Commands.IPrinterExtendedCommand).typeExtended;
    if (!lookup) {
      throw new TranspileDocumentError(
        `Command '${cmd.constructor.name}' did not have a value for typeExtended. If you're trying to implement a custom command check the documentation.`
      )
    }

    const cmdHandler = this.extendedCommandMap.get(lookup);

    if (cmdHandler === undefined) {
      throw new TranspileDocumentError(
        `Unknown command '${cmd.constructor.name}' was not found in the command map for ${this.commandLanguage} command language. If you're trying to implement a custom command check the documentation for correctly adding mappings.`
      );
    }
    return cmdHandler(cmd, docState, this);
  }

  public transpileDoc(doc: IDocument): Readonly<CompiledDocument> {
    const validationErrors: TranspileDocumentError[] = [];
    const { forms, effects } = this.splitCommandsByFormInclusion(
      doc.commands,
      doc.commandReorderBehavior
    );

    const commandsWithMaybeErrors = forms.flatMap((form) => this.transpileForm(form));
    const errs = commandsWithMaybeErrors.filter<TranspileDocumentError>(
      (e): e is TranspileDocumentError => !(e instanceof Uint8Array)
    );
    if (errs.length > 0) {
      throw new TranspileDocumentError(
        'One or more validation errors occurred transpiling the document.',
        validationErrors
      );
    }

    // Combine the separate individual documents into a single command array.
    const buffer = commandsWithMaybeErrors.reduce<Uint8Array>((accumulator, cmd) => {
      if (!(cmd instanceof Uint8Array)) {
        throw new TranspileDocumentError(
          'Document validation error present after checking for one!?!? Error in WebZLP!',
          [cmd]
        );
      }
      return this.combineCommands(accumulator as Uint8Array, cmd);
      // We start with an explicit newline, to avoid possible previous commands partially sent
    }, this.encodeCommand());

    const out = new CompiledDocument(this.commandLanguage, effects, buffer);
    return Object.freeze(out);
  }

  private transpileForm({
    commands,
    withinForm
  }: RawCommandForm): Array<Uint8Array | TranspileDocumentError> {
    const formMetadata = new TranspiledDocumentState();
    const transpiledCommands = commands.map((cmd) => this.transpileCommand(cmd, formMetadata));
    if (withinForm) {
      transpiledCommands.unshift(this.formStartCommand);
      transpiledCommands.push(this.formEndCommand);
    }

    return transpiledCommands;
  }

  private splitCommandsByFormInclusion(
    commands: ReadonlyArray<Commands.IPrinterCommand>,
    reorderBehavior: Commands.CommandReorderBehavior
  ): { forms: Array<RawCommandForm>; effects: Commands.PrinterCommandEffectFlags } {
    const forms: Array<RawCommandForm> = [];
    const nonForms: Array<RawCommandForm> = [];
    let effects = Commands.PrinterCommandEffectFlags.none;
    for (const command of commands) {
      effects |= command.printerEffectFlags;
      if (
        this.isCommandNonFormCommand(command) &&
        reorderBehavior === Commands.CommandReorderBehavior.nonFormCommandsAfterForms
      ) {
        nonForms.push({ commands: [command], withinForm: false });
        continue;
      }

      if (command.type === 'NewLabelCommand') {
        // Since form bounding is implicit this is our indicator to break
        // between separate forms to be printed separately.
        forms.push({ commands: [], withinForm: true });
        continue;
      }

      // Anything else just gets tossed onto the stack of the current form, if it exists.
      const lastForm = forms.at(-1);
      if (lastForm === undefined) {
        forms.push({ commands: [command], withinForm: true });
      } else {
        lastForm.commands.push(command);
      }
    }

    // TODO: If the day arises we need to configure non-form commands _before_ the form
    // this will need to be made more clever.
    return { forms: forms.concat(nonForms), effects };
  }

  /** List of commands which must not appear within a form, according to this language's rules */
  protected abstract nonFormCommands: Array<symbol | Commands.CommandType>;

  private isCommandNonFormCommand(command: Commands.IPrinterCommand) {
    return this.nonFormCommands.includes(
      command.type === 'CustomCommand'
        ? (command as Commands.IPrinterExtendedCommand).typeExtended
        : command.type
    );
  }

  protected unprocessedCommand(cmd: Commands.IPrinterCommand): Uint8Array {
    throw new TranspileDocumentError(
      `Unhandled meta-command '${cmd.constructor.name}' was not preprocessed. This is a bug in WebZLP, please submit an issue.`
    );
  }

  /**
   * Round a raw value to the nearest step.
   */
  protected roundToNearestStep(value: number, step: number): number {
    const inverse = 1.0 / step;
    return Math.round(value * inverse) / inverse;
  }

  /** Strip a string of invalid characters for a command. */
  protected cleanString(str: string) {
    return str
      .replace(/\\/gi, '\\\\')
      .replace(/"/gi, '\\"')
      .replace(/[\r\n]+/gi, ' ');
  }

  /** Apply an offset command to a document. */
  protected modifyOffset(
    cmd: Commands.OffsetCommand,
    outDoc: TranspiledDocumentState,
    cmdSet: PrinterCommandSet
  ) {
    const newHoriz = cmd.absolute ? cmd.horizontal : outDoc.horizontalOffset + cmd.horizontal;
    outDoc.horizontalOffset = newHoriz < 0 ? 0 : newHoriz;
    if (cmd.vertical) {
      const newVert = cmd.absolute ? cmd.vertical : outDoc.verticalOffset + cmd.vertical;
      outDoc.verticalOffset = newVert < 0 ? 0 : newVert;
    }
    return cmdSet.noop;
  }

  /** Combine two commands into one command array. */
  protected combineCommands(cmd1: Uint8Array, cmd2: Uint8Array) {
    const merged = new Uint8Array(cmd1.length + cmd2.length);
    merged.set(cmd1);
    merged.set(cmd2, cmd1.length);
    return merged;
  }

  /** Parse the response of a configuration inqury in the command set language. */
  abstract parseConfigurationResponse(
    rawText: string,
    mediaOptions: IPrinterLabelMediaOptions
  ): PrinterOptions;
}

export function exhaustiveMatchGuard(_: never): never {
  throw new Error('Invalid case received!' + _);
}

/** How a command should be wrapped into a form, if at all */
export enum CommandFormInclusionMode {
  /** Command can appear in a shared form with other commands. */
  sharedForm = 0,
  /** Command should not be wrapped in a form at all. */
  noForm
}

export class TranspilationFormList {
  private _documents: Array<TranspiledDocumentState> = [new TranspiledDocumentState()];
  public get documents(): ReadonlyArray<TranspiledDocumentState> {
    return this._documents;
  }

  private activeDocumentIdx = 0;
  public get currentDocument() {
    return this._documents[this.activeDocumentIdx];
  }

  public addNewDocument() {
    this._documents.push(new TranspiledDocumentState());
    this.activeDocumentIdx = this._documents.length - 1;
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

/** Represents an error when validating a document against a printer's capabilities. */
export class TranspileDocumentError extends WebZlpError {
  private _innerErrors: TranspileDocumentError[] = [];
  get innerErrors() {
    return this._innerErrors;
  }

  constructor(message: string, innerErrors?: TranspileDocumentError[]) {
    super(message);
    this._innerErrors = innerErrors ?? [];
  }
}
