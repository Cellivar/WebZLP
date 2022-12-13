import * as Options from '../Configuration/PrinterOptions';
import {
    PrinterCommandSet,
    DocumentValidationError,
    TranspilationDocumentMetadata
} from './PrinterCommandSet';
import * as Commands from '../../Documents/Commands';
import { match, P } from 'ts-pattern';
import { AutodetectedPrinter } from '../Models/PrinterModel';
import { PrinterCommunicationOptions } from '../Communication/PrinterCommunication';
import { PrinterModelDb } from '../Models/PrinterModelDb';

export class ZplPrinterCommandSet extends PrinterCommandSet {
    private encoder = new TextEncoder();

    get commandLanugage(): Options.PrinterCommandLanguage {
        return Options.PrinterCommandLanguage.zpl;
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

    transpileCommand(
        cmd: Commands.IPrinterCommand,
        outDoc: TranspilationDocumentMetadata
    ): Uint8Array {
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
                // HH returns serial, HZA gets everything but the serial in XML.
                this.encodeCommand('^HZA\r\n^HH')
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

    parseConfigurationResponse(
        rawText: string,
        commOpts: PrinterCommunicationOptions
    ): Options.PrinterOptions {
        if (rawText.length <= 0) {
            return Options.PrinterOptions.invalid();
        }

        // The two commands run were ^HH to get the raw two-column config label, and ^HZA to get the
        // full XML configuration block. Unfortunately ZPL doesn't seem to put the serial number in
        // the XML so we must pull it from the first line of the raw two-column config.

        // Fascinatingly, it doesn't matter what order the two commands appear in. The XML will be
        // presented first and the raw label afterwards.
        const pivotText = '</ZEBRA-ELTRON-PERSONALITY>\r\n';
        const pivot = rawText.lastIndexOf(pivotText) + pivotText.length;
        if (pivot == pivotText.length - 1) {
            return Options.PrinterOptions.invalid();
        }

        const rawConfig = rawText.substring(pivot);
        // First line of the raw config should be the serial, which should be alphanumeric.
        const serial = rawConfig.match(/[A-Z0-9]+/i)[0];
        console.log('SERIAL', serial);

        // ZPL configuration is just XML, parse it into an object and then into config.

        // For reasons I do not understand printers will tend to send _one_ invalid XML line
        // and it looks like
        // ` ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>`
        // This is supposed to look like
        // `<RFID-TYPE ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>`
        // I don't have the appropriate equipment to determine where the XML tag prefix is being
        // lost. Do a basic find + replace to replace an instance of the exact text with a fixed
        // version instead.
        // TODO: Deeper investigation with more printers?
        const xmlStart = rawText.indexOf("<?xml version='1.0'?>");
        const rawXml = rawText
            .substring(xmlStart, pivot)
            .replace(
                "\n ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>",
                "<RFID-TYPE ENUM='NONE, AUTO DETECT, TAG-IT, ICODE, PICO, ISO15693, EPC, UID'>"
            );

        // The rest is straightforward: parse it as an XML document and pull out
        // the data. The format is standardized and semi-self-documenting.
        const parser = new DOMParser();
        const xmldoc = parser.parseFromString(rawXml, 'application/xml');
        const errorNode = xmldoc.querySelector('parsererror');
        console.log(xmldoc);
        if (errorNode) {
            // TODO: Log? Throw?
            console.log('lol failed');
            return Options.PrinterOptions.invalid();
        }

        return this.docToOptions(xmldoc, serial, commOpts);
    }

    private docToOptions(
        doc: Document,
        serial: string,
        commOpts: PrinterCommunicationOptions
    ): Options.PrinterOptions {
        // ZPL includes enough information in the document to autodetect the printer's capabilities.
        const model = PrinterModelDb.getModel(this.getXmlText(doc, 'MODEL'));
        // ZPL rounds, multiplying by 25 gets us to 'inches' in their book.
        // 8 DPM == 200 DPI, for example.
        const dpi = parseInt(this.getXmlText(doc, 'DOTS-PER-MM')) * 25;
        // Max darkness is an attribute on the element
        const maxDarkness = parseInt(
            doc.getElementsByTagName('MEDIA-DARKNESS')[0].getAttribute('MAX').valueOf()
        );

        // Speed table is specially constructed with a few rules.
        // Each table should have at least an auto, min, and max value. We assume we can use the whole
        // number speeds between the min and max values. If the min and max values are the same though
        // that indicates a mobile printer.
        const printSpeedElement = doc.getElementsByTagName('PRINT-RATE')[0];
        const slewSpeedElement = doc.getElementsByTagName('SLEW-RATE')[0];
        // Highest minimum wins
        const printMin = parseInt(printSpeedElement.getAttribute('MIN').valueOf());
        const slewMin = parseInt(slewSpeedElement.getAttribute('MIN').valueOf());
        const speedMin = printMin >= slewMin ? printMin : slewMin;
        const printMax = parseInt(printSpeedElement.getAttribute('MAX').valueOf());
        const slewMax = parseInt(slewSpeedElement.getAttribute('MAX').valueOf());
        const speedMax = printMax <= slewMax ? printMax : slewMax;

        const modelInfo = new AutodetectedPrinter(
            Options.PrinterCommandLanguage.zpl,
            dpi,
            model,
            this.getSpeedTable(speedMin, speedMax),
            maxDarkness
        );

        const options = new Options.PrinterOptions(
            serial,
            modelInfo,
            this.getXmlText(doc, 'FIRMWARE-VERSION')
        );

        const currentDarkness = parseInt(this.getXmlCurrent(doc, 'MEDIA-DARKNESS'));
        const rawDarkness = Math.ceil(currentDarkness * (100 / maxDarkness));
        options.darknessPercent = Math.max(0, Math.min(rawDarkness, 99)) as Options.DarknessPercent;

        options.speed = new Options.PrintSpeedSettings(
            parseInt(this.getXmlText(doc, 'PRINT-RATE')),
            parseInt(this.getXmlText(doc, 'SLEW-RATE'))
        );

        // Always in dots
        const labelWidth = parseInt(this.getXmlCurrent(doc, 'PRINT-WIDTH'));
        const labelLength = parseInt(this.getXmlText(doc, 'LABEL-LENGTH'));
        const labelRoundingStep = commOpts.labelDimensionRoundingStep ?? 0;
        if (labelRoundingStep > 0) {
            // Label size should be rounded to the step value by round-tripping the value to an inch
            // then rounding, then back to dots.
            const roundedWidth = this.roundToNearestStep(
                labelWidth / options.model.dpi,
                labelRoundingStep
            );
            options.labelWidthDots = roundedWidth * options.model.dpi;
            const roundedHeight = this.roundToNearestStep(
                labelLength / options.model.dpi,
                labelRoundingStep
            );
            options.labelHeightDots = roundedHeight * options.model.dpi;
        } else {
            // No rounding
            options.labelWidthDots = labelWidth;
            options.labelHeightDots = labelLength;
        }

        options.printOrientation =
            this.getXmlText(doc, 'LABEL-REVERSE') === 'Y'
                ? Options.PrintOrientation.inverted
                : Options.PrintOrientation.normal;

        options.thermalPrintMode =
            this.getXmlCurrent(doc, 'MEDIA-TYPE') === 'DIRECT-THERMAL'
                ? Options.ThermalPrintMode.direct
                : Options.ThermalPrintMode.transfer;

        options.mediaPrintMode = this.parsePrintMode(this.getXmlCurrent(doc, 'PRINT-MODE'));

        options.mediaPrintMode =
            this.getXmlCurrent(doc, 'PRE-PEEL') === 'Y'
                ? Options.MediaPrintMode.peelWithPrepeel
                : options.mediaPrintMode;

        // TODO: more hardware options:
        // - Figure out how to encode C{num} for cut-after-label-count

        // TODO other options:
        // Autosense settings?
        // Character set?
        // Error handling?
        // Continuous media?
        // Black mark printing?
        // Media feed on powerup settings?
        // Prepeel rewind?

        return options;
    }

    private range(start: number, stop: number, step = 1) {
        return Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);
    }

    private getXmlText(doc: Document, tag: string) {
        return doc.getElementsByTagName(tag)[0].textContent;
    }

    private getXmlCurrent(doc: Document, tag: string) {
        return doc.getElementsByTagName(tag)[0].getElementsByTagName('CURRENT')[0].textContent;
    }

    private parsePrintMode(str: string) {
        switch (str) {
            case 'REWIND':
                return Options.MediaPrintMode.rewind;
            case 'PEEL OFF':
                return Options.MediaPrintMode.peel;
            case 'CUTTER':
                return Options.MediaPrintMode.cutter;
            default:
            case 'TEAR OFF':
                return Options.MediaPrintMode.tearoff;
        }
    }

    private getSpeedTable(min: number, max: number) {
        const table = new Map<Options.PrintSpeed, number>([
            [Options.PrintSpeed.auto, 0],
            [Options.PrintSpeed.ipsPrinterMin, min],
            [Options.PrintSpeed.ipsPrinterMax, max]
        ]);
        this.range(min, max).forEach((s) =>
            table.set(Options.PrintSpeedSettings.getSpeedFromWholeNumber(s), s)
        );
        return table;
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
