export class LineBreakTransformer implements Transformer<string, string> {
    private container = '';

    transform(chunk: string, controller: TransformStreamDefaultController<string>) {
        this.container += chunk;
        const lines = this.container.split('\n');
        this.container = lines.pop();
        lines.forEach((line) => controller.enqueue(line));
    }

    flush(controller: TransformStreamDefaultController<string>) {
        controller.enqueue(this.container);
    }
}
