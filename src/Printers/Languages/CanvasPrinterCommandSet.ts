import { CommandType } from '../../Documents/Commands.js';
import * as Options from '../Configuration/PrinterOptions.js';
import { PrinterOptions } from '../Configuration/PrinterOptions.js';
import { PrinterModelDb } from '../Models/PrinterModelDb.js';
import { PrinterModel } from '../Models/PrinterModel.js';
import {
    CommandFormInclusionMode,
    PrinterCommandSet,
    TranspilationFormMetadata,
    TranspileCommandDelegate
} from './PrinterCommandSet.js';
import * as Commands from '../../Documents/Commands.js';
import { PrinterCommunicationOptions } from '../PrinterCommunicationOptions.js';

export class CanvasPrinterCommandSet extends PrinterCommandSet {
    protected get formStartCommand(): Uint8Array {
        return this.encodeCommand();
    }

    protected get formEndCommand(): Uint8Array {
        return this.encodeCommand();
    }

    get commandLanguage(): Options.PrinterCommandLanguage {
        return Options.PrinterCommandLanguage.none;
    }

    // Canvas specific bits.
    private _canvas: HTMLCanvasElement;
    get canvasImageData(): ImageData {
        const width = this._canvas.width;
        const height = this._canvas.height;
        return this._canvas.getContext('2d').getImageData(0, 0, width, height);
    }

    protected transpileCommandMap = new Map<symbol | CommandType, TranspileCommandDelegate>([
    ]);

    protected nonFormCommands: (symbol | CommandType)[];

    constructor(
        private printerOptions: PrinterOptions,
        customCommands: Array<{
            commandType: symbol;
            applicableLanguages: Options.PrinterCommandLanguage;
            transpileDelegate: TranspileCommandDelegate;
            commandInclusionMode: CommandFormInclusionMode;
        }> = []
    ) {
        super();

        for (const newCmd of customCommands) {
            if ((newCmd.applicableLanguages & this.commandLanguage) !== this.commandLanguage) {
                // Command declared to not be applicable to this command set, skip it.
                continue;
            }

            this.transpileCommandMap.set(newCmd.commandType, newCmd.transpileDelegate);
            if (newCmd.commandInclusionMode !== CommandFormInclusionMode.sharedForm) {
                this.nonFormCommands.push(newCmd.commandType);
            }
        }
    }

    public encodeCommand(): Uint8Array {
        // Actual command output is not relevant for this printer.
        return this.noop;
    }

    parseConfigurationResponse(): PrinterOptions {
        return this.printerOptions;
    }
}
