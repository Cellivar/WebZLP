export class LineBreakTransformer {
    #container = '';

    transform(chunk, controller) {
        this.#container += chunk;
        const lines = this.#container.split('\n');
        this.#container = lines.pop();
        lines.forEach((line) => controller.enqueue(line));
    }

    flush(controller) {
        controller.enqueue(this.#container);
    }
}
