import { PrinterCommandLanguage, PrinterOptions } from '../Configuration/PrinterOptions';
import { PrinterCommandSet, DocumentValidationError } from './PrinterCommandSet';
import * as Commands from '../../Documents/Commands';
import { match, P } from 'ts-pattern';
import { CompiledDocument } from '../../Documents/Document';

export class ZplPrinterCommandSet extends PrinterCommandSet {
    private encoder = new TextEncoder();

    get commandLanugage(): PrinterCommandLanguage {
        return PrinterCommandLanguage.zpl;
    }

    get documentStartCommand(): Uint8Array {
        // All ZPL documents start with the start-of-document command.
        return this.encodeCommand('\n^XA\n');
    }

    get documentEndCommand(): Uint8Array {
        // All ZPL documents end with the end-of-document command.
        return this.encodeCommand('\n^XZ\n');
    }

    encodeCommand(str: string): Uint8Array {
        // TODO: ZPL supports omitting the newline, figure out a clever way to
        // handle situations where newlines are optional to reduce line noise.
        return this.encoder.encode(str + '\n');
    }

    transpileCommand(cmd: Commands.IPrinterCommand, outDoc: CompiledDocument): Uint8Array {
        return match<Commands.IPrinterCommand, Uint8Array>(cmd)
            .with(P.instanceOf(Commands.NewLabelCommand), () => this.startNewDocument())
            .with(P.instanceOf(Commands.Offset), (cmd) => this.modifyOffset(cmd, outDoc))
            .with(P.instanceOf(Commands.ClearImageBufferCommand), () => {
                // Clear image buffer isn't a relevant command on ZPL printers.
                // Closest equivalent is the ~JP (pause and cancel) or ~JA (cancel all) but both
                // affect in-progress printing operations which is unlikely to be desired operation.
                // Translate as a no-op.
                return this.noop;
            })
            .with(P.instanceOf(Commands.CutNowCommand), () => {
                // ZPL doens't have an OOTB cut command except for one printer.
                // Cutter behavior should be managed by the ^MM command instead.
                return this.noop;
            })
            .with(P.instanceOf(Commands.SuppressFeedBackupCommand), () => {
                // ZPL needs this for every form printed.
                return this.encodeCommand('^XB');
            })
            .with(P.instanceOf(Commands.EnableFeedBackupCommand), () => {
                // ZPL doesn't have an enable, it just expects XB for every label
                // that should not back up.
                return this.noop;
            })
            .with(P.instanceOf(Commands.RebootPrinterCommand), () => this.encodeCommand('~JR'))
            .with(P.instanceOf(Commands.QueryConfigurationCommand), () =>
                this.encodeCommand('^HZa')
            )
            .with(P.instanceOf(Commands.PrintConfigurationCommand), () => this.encodeCommand('~WC'))
            .with(P.instanceOf(Commands.SetPrintDirectionCommand), (cmd) => {
                const dir = cmd.upsideDown ? 'I' : 'N';
                return this.encodeCommand(`^PO${dir}`);
            })
            .with(P.instanceOf(Commands.SetDarknessCommand), (cmd) =>
                this.encodeCommand(`~SD${cmd.darknessSetting}`)
            )
            .with(P.instanceOf(Commands.SetPrintSpeedCommand), (cmd) => {
                // ZPL uses separate print, slew, and backfeed speeds. Re-use print for backfeed.
                return this.encodeCommand(
                    `^PR${cmd.speedVal},${cmd.mediaSpeedVal},${cmd.speedVal}`
                );
            })
            .with(P.instanceOf(Commands.AutosenseLabelDimensionsCommand), () =>
                this.encodeCommand('~JC')
            )
            .with(P.instanceOf(Commands.SetLabelDimensionsCommand), (cmd) => {
                const width = this.encodeCommand(`^PW${cmd.widthInDots}`);
                if (cmd.setsHeight) {
                    const height = this.encodeCommand(`^LL${cmd.heightInDots},N`);
                    return this.combineCommands(width, height);
                }
                return width;
            })
            .with(P.instanceOf(Commands.AddLineCommand), (cmd) =>
                this.lineOrBoxToCmd(cmd.heightInDots, cmd.lengthInDots, cmd.color)
            )
            .with(P.instanceOf(Commands.AddBoxCommand), (cmd) =>
                this.lineOrBoxToCmd(
                    cmd.heightInDots,
                    cmd.thickness,
                    Commands.DrawColor.black,
                    cmd.lengthInDots
                )
            )
            .with(P.instanceOf(Commands.PrintCommand), (cmd) => {
                // TODO: Make sure this actually works this way..
                // According to the docs the first parameter is "total" labels,
                // while the third is duplicates.
                const total = cmd.count * (cmd.additionalDuplicateOfEach + 1);
                const dup = cmd.additionalDuplicateOfEach;
                return this.encodeCommand(`^PQ${total},0,${dup},N`);
            })
            .otherwise((cmd) => {
                throw new DocumentValidationError(`Unknown ZPL command '${cmd.name}'.`);
            });
    }

    parseConfigurationResponse(rawText: string): PrinterOptions {
        if (rawText.length <= 0) {
            return PrinterOptions.invalid();
        }

        // ZPL returns xml (!) which makes this far easier to do!
        // .. if it was implemented
        // TODO: ZPL config support.
        return PrinterOptions.invalid();
    }

    private lineOrBoxToCmd(
        height: number,
        thickness: number,
        color: Commands.DrawColor,
        length?: number
    ) {
        height = Math.trunc(height) || 0;
        thickness = Math.trunc(length) || 0;

        // Length of zero is valid, it indicates this is a line not a box.
        length = Math.trunc(length) || 0;
        let drawMode: string;
        switch (color) {
            case Commands.DrawColor.black:
                drawMode = 'B';
                break;
            case Commands.DrawColor.white:
                drawMode = 'W';
                break;
        }

        // TODO: Support rounding?
        return this.encodeCommand([`^GB${length}`, height, thickness, drawMode].join(','));
    }
}
