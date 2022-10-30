/** Exception thrown from WebZPL. */
export class WebZplError {
    /** The message for this exception */
    readonly message: string;

    constructor(message: string){
        this.message = message;
    }
}
