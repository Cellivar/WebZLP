import { IPrinterCommand, CompiledDocument } from '../../Documents/Commands';
import { PrinterCommunicationOptions } from '../Communication/PrinterCommunication';
import { PrinterCommandLanguage, PrinterOptions } from '../Configuration/PrinterOptions';
import { DocumentValidationError, PrinterCommandSet } from './PrinterCommandSet';
import * as Commands from '../../Documents/Commands';
import { match, P } from 'ts-pattern';

export class CpclPrinterCommandSet extends PrinterCommandSet {
    private encoder = new TextEncoder();

    get commandLanugage(): PrinterCommandLanguage {
        return PrinterCommandLanguage.cpcl;
    }

    get documentStartCommand(): Uint8Array {
        // All CPCL documents (or 'sessions' in CPCL terminology) start with
        // an ! followed by the type of document it is, unless it's an escape command
        // in which case it should not rely on the automatic document start command.
        return this.encodeCommand('!');
    }

    get documentEndCommand(): Uint8Array {
        // All CPCL sessions end with PRINT or END, so are controlled by the
        // label builder and not here. Instead just append the line terminator.
        return this.encodeCommand('');
    }

    encodeCommand(str: string, withNewline = true): Uint8Array {
        // Lines in CPCL end with CR/LF pairs.
        return this.encoder.encode(str + (withNewline ? '\r\n' : ''));
    }

    transpileCommand(cmd: IPrinterCommand, outDoc: CompiledDocument): Uint8Array {
        return match<Commands.IPrinterCommand, Uint8Array>(cmd)
            .with(P.instanceOf(Commands.NewLabelCommand), () => {
                // CPCL is fun! The information about how many things we're printing
                // needs to come in the front of the document, not the end, so we must
                // cache that information and restore it from later locations.
            })
            .with(P.instanceOf(Commands.QueryConfigurationCommand), () => this.encodeCommand('\eI'))
            .with(P.instanceOf(Commands.PrintConfigurationCommand), () => this.encodeCommand('\eV'))
            .otherwise((cmd) => {
                throw new DocumentValidationError(`Unknown CPCL command '${cmd.name}'.`);
            });
    }

    parseConfigurationResponse(
        rawText: string,
        commOpts: PrinterCommunicationOptions
    ): PrinterOptions {
        if (rawText.length <= 0) {
            return PrinterOptions.invalid();
        }

        // CPCL's two-key config dump is what we would parse here
        // ...if we supported CPCL.
        return PrinterOptions.invalid();
    }
}
