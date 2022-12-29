import * as Options from '../Configuration/PrinterOptions.js';
import {
    PrinterCommandSet,
    TranspilationFormMetadata,
    TranspileCommandDelegate,
    CommandFormInclusionMode
} from './PrinterCommandSet.js';
import * as Commands from '../../Documents/Commands.js';
import { AutodetectedPrinter, PrinterModel } from '../Models/PrinterModel.js';
import { PrinterModelDb } from '../Models/PrinterModelDb.js';
import { PrinterCommunicationOptions } from '../PrinterCommunicationOptions.js';

export class ZplPrinterCommandSet extends PrinterCommandSet {
    private encoder = new TextEncoder();

    get commandLanguage(): Options.PrinterCommandLanguage {
        return Options.PrinterCommandLanguage.zpl;
    }

    get formStartCommand(): Uint8Array {
        // All ZPL documents start with the start-of-document command.
        return this.encodeCommand('\n^XA\n');
    }

    get formEndCommand(): Uint8Array {
        // All ZPL documents end with the end-of-document command.
        return this.encodeCommand('\n^XZ\n');
    }

    encodeCommand(str = '', withNewline = true): Uint8Array {
        // TODO: ZPL supports omitting the newline, figure out a clever way to
        // handle situations where newlines are optional to reduce line noise.
        return this.encoder.encode(str + (withNewline ? '\n' : ''));
    }

    protected nonFormCommands: (symbol | Commands.CommandType)[] = [
        Commands.CommandType.AutosenseLabelDimensionsCommand,
        Commands.CommandType.PrintConfigurationCommand,
        Commands.CommandType.RawDocumentCommand,
        Commands.CommandType.RebootPrinterCommand,
        Commands.CommandType.SetDarknessCommand
    ];

    protected transpileCommandMap = new Map<
        symbol | Commands.CommandType,
        TranspileCommandDelegate
    >([
        // Ghost commands which shouldn't make it this far.
        [Commands.CommandType.NewLabelCommand, this.unprocessedCommand],
        [Commands.CommandType.CommandCustomSpecificCommand, this.unprocessedCommand],
        [Commands.CommandType.CommandLanguageSpecificCommand, this.unprocessedCommand],
        // Actually valid commands to parse
        [Commands.CommandType.OffsetCommand, this.modifyOffset],
        // Clear image buffer isn't a relevant command on ZPL printers.
        // Closest equivalent is the ~JP (pause and cancel) or ~JA (cancel all) but both
        // affect in-progress printing operations which is unlikely to be desired operation.
        // Translate as a no-op.
        [Commands.CommandType.ClearImageBufferCommand, () => this.noop],
        // ZPL doens't have an OOTB cut command except for one printer.
        // Cutter behavior should be managed by the ^MM command instead.
        [Commands.CommandType.CutNowCommand, () => this.noop],
        // ZPL needs this for every form printed.
        [Commands.CommandType.SuppressFeedBackupCommand, () => this.encodeCommand('^XB')],
        // ZPL doesn't have an enable, it just expects XB for every label
        // that should not back up.
        [Commands.CommandType.EnableFeedBackupCommand, () => this.noop],
        [Commands.CommandType.RebootPrinterCommand, () => this.encodeCommand('~JR')],
        // HH returns serial as raw text, HZA gets everything but the serial in XML.
        [Commands.CommandType.QueryConfigurationCommand, () => this.encodeCommand('^HZA\r\n^HH')],
        [Commands.CommandType.PrintConfigurationCommand, () => this.encodeCommand('~WC')],
        [Commands.CommandType.SaveCurrentConfigurationCommand, () => this.encodeCommand('^JUS')],
        [Commands.CommandType.SetPrintDirectionCommand, this.setPrintDirectionCommand],
        [Commands.CommandType.SetDarknessCommand, this.setDarknessCommand],
        [Commands.CommandType.SetPrintSpeedCommand, this.setPrintSpeedCommand],
        [Commands.CommandType.AutosenseLabelDimensionsCommand, () => this.encodeCommand('~JC')],
        [Commands.CommandType.SetLabelDimensionsCommand, this.setLabelDimensionsCommand],
        [Commands.CommandType.SetLabelHomeCommand, this.setLabelHomeCommand],
        [Commands.CommandType.AddImageCommand, this.addImageCommand],
        [Commands.CommandType.AddLineCommand, this.addLineCommand],
        [Commands.CommandType.AddBoxCommand, this.addBoxCommand],
        [Commands.CommandType.PrintCommand, this.printCommand]
    ]);

    constructor(
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
        const rawModel = this.getXmlText(doc, 'MODEL');
        let model: PrinterModel | string = PrinterModelDb.getModel(rawModel);
        if (model == PrinterModel.unknown) {
            // If the database doesn't have this one listed just use the raw name.
            model = rawModel;
        }
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

    private getFieldOffsetCommand(
        formMetadata: TranspilationFormMetadata,
        additionalHorizontal = 0,
        additionalVertical = 0
    ) {
        const xOffset = Math.trunc(formMetadata.horizontalOffset + additionalHorizontal);
        const yOffset = Math.trunc(formMetadata.verticalOffset + additionalVertical);
        return `^FO${xOffset},${yOffset}`;
    }

    private addImageCommand(
        cmd: Commands.AddImageCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        if (cmd?.bitmap == null) {
            return cmdSet.noop;
        }

        // ZPL inverts colors. 1 means black, 0 means white. I don't know why.
        const bitmap = cmd.bitmap.toInvertedGRF();

        // ZPL supports compressed binary on pretty much all firmwares, default to that.
        // TODO: ASCII-compressed formats are only supported on newer firmwares.
        // Implement feature detection into the transpiler operation to choose the most
        // appropriate compression format such as LZ77/DEFLATE compression for Z64.
        const buffer = bitmap.toZebraCompressedGRF();

        // Because the image may be trimmed add an offset command to position to the image data.
        const fieldStart = cmdSet.getFieldOffsetCommand(
            outDoc,
            bitmap.boundingBox.paddingLeft,
            bitmap.boundingBox.paddingTop
        );

        const byteLen = bitmap.bytesUncompressed;
        const graphicCmd = `^GFA,${byteLen},${byteLen},${bitmap.bytesPerRow},${buffer}`;

        const fieldEnd = '^FS';

        // Finally, bump the document offset according to the image height.
        outDoc.verticalOffset += bitmap.boundingBox.height;

        return cmdSet.encodeCommand(fieldStart + graphicCmd + fieldEnd);
    }

    private setPrintDirectionCommand(
        cmd: Commands.SetPrintDirectionCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        const dir = cmd.upsideDown ? 'I' : 'N';
        return cmdSet.encodeCommand(`^PO${dir}`);
    }

    private setDarknessCommand(
        cmd: Commands.SetDarknessCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        const dark = Math.trunc(cmd.darknessSetting);
        return cmdSet.encodeCommand(`~SD${dark}`);
    }

    private setPrintSpeedCommand(
        cmd: Commands.SetPrintSpeedCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        // ZPL uses separate print, slew, and backfeed speeds. Re-use print for backfeed.
        return cmdSet.encodeCommand(`^PR${cmd.speedVal},${cmd.mediaSpeedVal},${cmd.speedVal}`);
    }

    private setLabelDimensionsCommand(
        cmd: Commands.SetLabelDimensionsCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        const width = Math.trunc(cmd.widthInDots);
        const widthCmd = cmdSet.encodeCommand(`^PW${width}`);
        if (cmd.setsHeight) {
            const height = Math.trunc(cmd.heightInDots);
            const heightCmd = cmdSet.encodeCommand(`^LL${height},N`);
            return cmdSet.combineCommands(widthCmd, heightCmd);
        }
        return widthCmd;
    }

    private setLabelHomeCommand(
        cmd: Commands.SetLabelHomeCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        const xOffset = Math.trunc(cmd.xOffset);
        const yOffset = Math.trunc(cmd.yOffset);
        return cmdSet.encodeCommand(`^LH${xOffset},${yOffset}`);
    }

    private printCommand(
        cmd: Commands.PrintCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        // TODO: Make sure this actually works this way..
        // According to the docs the first parameter is "total" labels,
        // while the third is duplicates.
        const total = Math.trunc(cmd.count * (cmd.additionalDuplicateOfEach + 1));
        const dup = Math.trunc(cmd.additionalDuplicateOfEach);
        return cmdSet.encodeCommand(`^PQ${total},0,${dup},N`);
    }

    private addLineCommand(
        cmd: Commands.AddLineCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        return cmdSet.lineOrBoxToCmd(
            cmdSet,
            outDoc,
            cmd.heightInDots,
            cmd.lengthInDots,
            cmd.color,
            // A line is just a box filled in!
            Math.min(cmd.heightInDots, cmd.lengthInDots)
        );
    }

    private addBoxCommand(
        cmd: Commands.AddBoxCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: ZplPrinterCommandSet
    ): Uint8Array {
        return cmdSet.lineOrBoxToCmd(
            cmdSet,
            outDoc,
            cmd.heightInDots,
            cmd.lengthInDots,
            Commands.DrawColor.black,
            cmd.thickness
        );
    }

    private lineOrBoxToCmd(
        cmdSet: ZplPrinterCommandSet,
        outDoc: TranspilationFormMetadata,
        height: number,
        length: number,
        color: Commands.DrawColor,
        thickness?: number
    ): Uint8Array {
        height = Math.trunc(height) || 0;
        thickness = Math.trunc(thickness) || 1;
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
        const fieldStart = cmdSet.getFieldOffsetCommand(outDoc);

        // TODO: Support rounding?
        return cmdSet.encodeCommand(
            [fieldStart, `^GB${length}`, height, thickness, drawMode, '^FS'].join(',')
        );
    }
}
