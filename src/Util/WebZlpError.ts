/** Exception thrown from the WebZLP library. */
export class WebZlpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
