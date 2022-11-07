/** Exception thrown from WebZPL. */
export class WebZplError {
    private _message: string;
    /** The message for this exception */
    get message() {
        return this._message;
    }

    constructor(message: string) {
        this._message = message;
    }
}
