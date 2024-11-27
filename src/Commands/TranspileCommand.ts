import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import * as Commands from './Commands.js';
import type { PrinterConfig } from './PrinterConfig.js';

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

  commandEffectFlags: Commands.CommandEffectFlags;
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
    commandEffectFlags: new Commands.CommandEffectFlags()
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
