import { CompiledDocument, type IDocument } from '../../Documents/Document.js';
import * as Commands from '../../Documents/Commands.js';

type RawCommandForm = { commands: Array<Commands.IPrinterCommand>; withinForm: boolean };

export abstract class PrinterCommandSet {
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
      effects |= command.effectFlags;
      if (
        this.isCommandNonFormCommand(command) &&
        reorderBehavior === Commands.CommandReorderBehavior.afterAllForms
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

  /** Strip a string of invalid characters for a command. */
  // protected cleanString(str: string) {
  //   return str
  //     .replace(/\\/gi, '\\\\')
  //     .replace(/"/gi, '\\"')
  //     .replace(/[\r\n]+/gi, ' ');
  // }
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
