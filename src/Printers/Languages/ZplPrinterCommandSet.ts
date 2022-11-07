import { WebZplError } from '../../WebZplError';
import { PrinterCommandLanguage } from '../Configuration/PrinterOptions';
import { PrinterOptions } from '../Configuration/PrinterOptions';
import { getModel } from '../Models/PrinterModel';
import { IPrinterCommandSet, DocumentValidationError } from './IPrinterCommandSet';
import * as Commands from '../../Documents/Commands';

export class ZplPrinterCommandSet implements IPrinterCommandSet {
    private rawCmdBuffer: Array<Uint8Array> = [];
    private encoder = new TextEncoder();

    get commandBufferRaw(): Uint8Array {
        const bufferLen = this.rawCmdBuffer.reduce((sum, arr) => sum + arr.byteLength, 0);
        const buffer = new Uint8Array(bufferLen);
        this.rawCmdBuffer.reduce((offset, arr) => {
            buffer.set(arr, offset);
            return arr.byteLength + offset;
        }, 0);

        return buffer;
    }

    get commandBufferString(): string {
        return new TextDecoder('ascii').decode(this.commandBufferRaw);
    }

    loadDoc(doc: any): IPrinterCommandSet {
        // Parse through the commands, translating them to their EPL command equivalents
        const validationErrors = [];
        doc.commands.forEach((c) => {
            try {
                this.addRawCmd(this.transpileCommand(c));
            } catch (e) {
                if (e instanceof DocumentValidationError) {
                    validationErrors.push(e);
                } else {
                    throw e;
                }
            }
        });
        if (validationErrors.length > 0) {
            throw new DocumentValidationError('One or more validation errors', validationErrors);
        }
        return this;
    }

    addCmd(...parameters: string[]): IPrinterCommandSet {
        this.addRawCmd(this.encodeCommand(parameters.join(',') + '\n'));
        return this;
    }

    addRawCmd(array: Uint8Array): IPrinterCommandSet {
        this.rawCmdBuffer.push(array);
        return this;
    }

    clearCommandBuffer(): IPrinterCommandSet {
        this.rawCmdBuffer = [];
        return this;
    }

    encodeCommand(str: string): Uint8Array {
        return this.encoder.encode(str + '\n');
    }

    transpileCommand(cmd: Commands.IPrinterCommand): Uint8Array {
        throw new Error('Method not implemented.');
    }

    parseConfigurationResponse(rawText: string): PrinterOptions {
        throw new Error('Method not implemented.');
    }
}
