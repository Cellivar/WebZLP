import { Printer } from '../Printers/Printer';

/** Map of custom event names and their corresponding events. */
interface WebZlpEventMap {
    onConnectPrinter: CustomEvent<Printer>;
    onDisconnectPrinter: CustomEvent<Printer>;
}

declare global {
    interface Document {
        //adds definition to Document, but you can do the same with HTMLElement
        addEventListener<K extends keyof WebZlpEventMap>(
            type: K,
            listener: (this: Document, ev: WebZlpEventMap[K]) => void
        ): void;
    }
}

export {}; //keep that to TS compliler.
