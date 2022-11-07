import { NumericRange } from '../NumericRange';
import { PrintSpeed } from '../Printers/Configuration/PrinterOptions';

export interface IDocument {
    /** Gets the series of commands this document contains. */
    get commands(): IPrinterCommand[];

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;
}

export class Document implements IDocument {
    private _commands: IPrinterCommand[];
    get commands() {
        return this._commands;
    }

    constructor(commandList: IPrinterCommand[]) {
        this._commands = commandList;
    }

    /** Display the commands that will be performed in a human-readable format. */
    public showCommands(): string {
        let result = '';
        this._commands.forEach((c) => (result += `${c.name} - ${c.toDisplay()}\n`));
        return result;
    }
}

export interface IDocumentBuilder {
    /** Clear the commands in this document and reset it to the starting blank. */
    clear(): IDocumentBuilder;

    /** Return the list of commands that will be performed in human-readable format. */
    showCommands(): string;

    /** Return the final built document */
    finalize(): IDocument;
}

/** A command that can be sent to a printer. */
export interface IPrinterCommand {
    /** Get the name of this command. */
    get name(): string;

    /** Get the human-readable output of this command. */
    toDisplay(): string;
}

/** A command to clear the image buffer. */
export class ClearImageBufferCommand implements IPrinterCommand {
    get name(): string {
        return 'Clear image buffer';
    }
    toDisplay(): string {
        return this.name;
    }
}

/** A command to have the printer send its configuration back over serial. */
export class QueryConfigurationCommand implements IPrinterCommand {
    get name(): string {
        return 'Query for printer config';
    }
    toDisplay(): string {
        return this.name;
    }
}

/** A command to have the printer print its configuration labels. */
export class PrintConfigurationCommand implements IPrinterCommand {
    get name(): string {
        return "Print printer's config onto labels";
    }
    toDisplay(): string {
        return this.name;
    }
}

/** A command to set the darkness the printer prints at. */
export class SetDarknessCommand implements IPrinterCommand {
    get name(): string {
        return 'Set darkness';
    }
    toDisplay(): string {
        return `Set darkness to ${this.darknessPercent}%`;
    }

    constructor(darknessPercent: NumericRange<0, 100>) {
        this.darknessPercent = darknessPercent;
    }

    /** The darkness percentage to set to. Exact value is determiend by printer capabilities. */
    darknessPercent: NumericRange<0, 100>;
}

/** A command to set the direction a label prints, either upside down or not. */
export class SetPrintDirectionCommand implements IPrinterCommand {
    get name(): string {
        return 'Set print direction';
    }
    toDisplay(): string {
        return `Print labels ${this.upsideDown ? 'upside-down' : 'right-side up'}`;
    }

    constructor(upsideDown: boolean) {
        this.upsideDown = upsideDown;
    }

    /** Whether to print labels upside-down. */
    upsideDown: boolean;
}

/** A command to set the print speed a printer prints at. Support varies per printer. */
export class SetPrintSpeedCommand implements IPrinterCommand {
    get name(): string {
        return 'Set print speed';
    }
    toDisplay(): string {
        return `Set print speed to ${PrintSpeed[this.speed]} (inches per second).`;
    }

    constructor(speed: PrintSpeed) {
        this.speed = speed;
    }

    speed: PrintSpeed;
}

/** A command to set the label dimensions of this label. */
export class SetLabelDimensionsCommand implements IPrinterCommand {
    get name(): string {
        return 'Set label dimensions';
    }
    toDisplay(): string {
        let str = `Set label size to ${this.widthInDots} wide`;
        if (this.heightInDots) {
            str += ` x ${this.heightInDots} high`;
        }
        if (this.gapLengthInDots) {
            str += ` with a gap length of ${this.gapLengthInDots}`;
        }
        str += ' (in dots).';
        return str;
    }

    constructor(widthInDots: number, heightInDots?: number, gapLengthInDots?: number) {
        this.widthInDots = widthInDots;
        this.heightInDots = heightInDots;
        this.gapLengthInDots = gapLengthInDots;
    }

    widthInDots: number;
    heightInDots?: number;
    gapLengthInDots?: number;
}
