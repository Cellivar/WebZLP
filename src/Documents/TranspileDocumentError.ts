import { WebZlpError } from "../WebZlpError.js";

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
