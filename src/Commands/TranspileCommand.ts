import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import type { PrinterConfig } from './PrinterConfig.js';
import type { OffsetCommand } from './BasicCommands.js';
import { CommandEffectFlags } from './Commands.js';

/** Interface of document state effects carried between individual commands. */
export interface TranspiledDocumentState {
  horizontalOffset: number;
  verticalOffset: number;
  lineSpacingDots: number;

  /** The read-only config at the start of the transpile operation */
  initialConfig: PrinterConfig;

  margin: {
    leftChars: number;
    rightChars: number;
  }
  printWidth: number;

  characterSize: Conf.Coordinate;

  commandEffectFlags: CommandEffectFlags;
}

  /** Apply an offset command to a document. */
  export function applyOffsetToDocState(
    cmd: OffsetCommand,
    outDoc: TranspiledDocumentState
  ) {
    const newHoriz = cmd.absolute ? cmd.horizontal : outDoc.horizontalOffset + cmd.horizontal;
    outDoc.horizontalOffset = newHoriz < 0 ? 0 : newHoriz;
    if (cmd.vertical !== undefined) {
      const newVert = cmd.absolute ? cmd.vertical : outDoc.verticalOffset + cmd.vertical;
      outDoc.verticalOffset = newVert < 0 ? 0 : newVert;
    }
  }

export function getNewTranspileState(config: PrinterConfig): TranspiledDocumentState {
  return {
    initialConfig: config,
    characterSize: {
      left: -1,
      top: -1
    },
    horizontalOffset: config.mediaPrintOriginOffsetDots.left,
    verticalOffset: config.mediaPrintOriginOffsetDots.top,
    lineSpacingDots: 1,
    printWidth: config.mediaWidthDots,
    margin: {
      leftChars: 0,
      rightChars: 0
    },
    commandEffectFlags: new CommandEffectFlags()
  }
}

/** Represents an error when validating a document against a printer's capabilities. */
export class TranspileDocumentError extends Util.WebZlpError {
  private _innerErrors: TranspileDocumentError[] = [];
  get innerErrors() {
    return this._innerErrors;
  }

  constructor(message: string, innerErrors?: TranspileDocumentError[]) {
    super(message);
    this._innerErrors = innerErrors ?? [];
  }
}
