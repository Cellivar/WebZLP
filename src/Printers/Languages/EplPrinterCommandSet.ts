import { WebZlpError } from '../../WebZlpError';
import * as Options from '../Configuration/PrinterOptions';
import { PrinterOptions } from '../Configuration/PrinterOptions';
import { PrinterModelDb } from '../Models/PrinterModelDb';
import { PrinterModel } from '../Models/PrinterModel';
import {
    DocumentValidationError,
    PrinterCommandSet,
    TranspilationDocumentMetadata
} from './PrinterCommandSet';
import * as Commands from '../../Documents/Commands';
import { match, P } from 'ts-pattern';
import { PrinterCommunicationOptions } from '../Communication/PrinterCommunication';
import { BitmapGRF } from '../../Documents/BitmapGRF';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends PrinterCommandSet {
    private encoder = new TextEncoder();

    get commandLanugage(): Options.PrinterCommandLanguage {
        return Options.PrinterCommandLanguage.epl;
    }

    get documentStartCommand(): Uint8Array {
        // Start of any EPL document should include a clear image buffer to prevent
        // previous commands from affecting the document.
        return this.encodeCommand('\r\nN\r\n');
    }

    get documentEndCommand(): Uint8Array {
        // There's no formal command for the end of an EPL doc, but just in case
        // add a newline.
        return this.encodeCommand('');
    }

    encodeCommand(str: string, withNewline = true): Uint8Array {
        // Every command in EPL ends with a newline.
        return this.encoder.encode(str + (withNewline ? '\r\n' : ''));
    }

    transpileCommand(
        cmd: Commands.IPrinterCommand,
        outDoc: TranspilationDocumentMetadata
    ): Uint8Array {
        return match<Commands.IPrinterCommand, Uint8Array>(cmd)
            .with(P.instanceOf(Commands.NewLabelCommand), () => this.startNewDocument())
            .with(P.instanceOf(Commands.Offset), (cmd) => this.modifyOffset(cmd, outDoc))
            .with(P.instanceOf(Commands.ClearImageBufferCommand), () => {
                // Clearing the buffer should absolutely always be on its own
                // line, so enforce that here.
                return this.encodeCommand('\r\nN');
            })
            .with(P.instanceOf(Commands.CutNowCommand), () => this.encodeCommand('C'))
            .with(P.instanceOf(Commands.SuppressFeedBackupCommand), () => this.encodeCommand('JB'))
            .with(P.instanceOf(Commands.EnableFeedBackupCommand), () => this.encodeCommand('JF'))
            .with(P.instanceOf(Commands.RebootPrinterCommand), () => this.encodeCommand('^@'))
            .with(P.instanceOf(Commands.QueryConfigurationCommand), () => this.encodeCommand('UQ'))
            .with(P.instanceOf(Commands.PrintConfigurationCommand), () => this.encodeCommand('U'))
            .with(P.instanceOf(Commands.SetPrintDirectionCommand), (cmd) => {
                const dir = cmd.upsideDown ? 'T' : 'B';
                return this.encodeCommand(`Z${dir}`);
            })
            .with(P.instanceOf(Commands.SetDarknessCommand), (cmd) =>
                this.encodeCommand(`D${cmd.darknessSetting}`)
            )
            .with(P.instanceOf(Commands.SetPrintSpeedCommand), (cmd) => {
                // Validation should have happened on setup, printer will just reject
                // invalid speeds.
                // EPL has no separate media slew speed setting.
                return this.encodeCommand(`S${cmd.speedVal}`);
            })
            .with(P.instanceOf(Commands.AutosenseLabelDimensionsCommand), () =>
                this.encodeCommand('xa')
            )
            .with(P.instanceOf(Commands.SetLabelDimensionsCommand), (cmd) => {
                const width = this.encodeCommand(`q${cmd.widthInDots}`);
                if (cmd.setsHeight) {
                    const height = this.encodeCommand(
                        `Q${cmd.heightInDots},${cmd.gapLengthInDots}`
                    );
                    return this.combineCommands(width, height);
                }
                return width;
            })
            .with(P.instanceOf(Commands.AddImageCommand), (cmd) => {
                return this.imageBufferToCmd(cmd.bitmap, outDoc);
            })
            .with(P.instanceOf(Commands.AddLineCommand), (cmd) => {
                return this.lineToCmd(cmd.heightInDots, cmd.lengthInDots, cmd.color, outDoc);
            })
            .with(P.instanceOf(Commands.AddBoxCommand), (cmd) => {
                return this.boxToCmd(cmd.heightInDots, cmd.lengthInDots, cmd.thickness, outDoc);
            })
            .with(P.instanceOf(Commands.PrintCommand), (cmd) => {
                const total = cmd.count;
                const dup = cmd.additionalDuplicateOfEach;
                return this.encodeCommand(`P${total},${dup}`);
            })
            .otherwise((cmd) => {
                throw new DocumentValidationError(`Unknown EPL command ${cmd.name}.`);
            });
    }

    parseConfigurationResponse(
        rawText: string,
        commOpts: PrinterCommunicationOptions
    ): PrinterOptions {
        // Raw text from the printer contains \r\n, normalize to \n.
        const lines = rawText
            .replaceAll('\r', '')
            .split('\n')
            .filter((i) => i);

        if (lines.length <= 0) {
            // No config provided, can't make a valid config out of it.
            return PrinterOptions.invalid();
        }

        // We make a lot of assumptions about the format of the config output.
        // Unfortunately EPL-only printers tended to have a LOT of variance on
        // what they actually put into the config. Firmware versions, especially
        // shipper-customzied versions, can and do omit information.
        // This method attempts to get what we can out of it.

        // See the docs folder for more information on this format.

        // First line determines firmware version, mostly consistent. Looks like
        // UKQ1935HLU     V4.29   // Normal LP244
        // UKQ1935HMU  FDX V4.45  // FedEx modified LP2844
        const header = lines[0].split(' ').filter((i) => i);
        let rawModelId = header[0];
        if (header.length === 3) {
            // Append FDX to model number for FedEx printer detect.
            rawModelId = header[0] + header[1];
        }

        const printerInfo = {
            model: PrinterModelDb.getModel(rawModelId),
            firmware: header[header.length - 1],
            serial: 'no_serial_nm',
            serialPort: undefined,
            speed: undefined,
            doubleBuffering: undefined,
            headDistanceIn: undefined,
            printerDistanceIn: undefined,
            hardwareOptions: []
        };

        const labelInfo = {
            labelWidthDots: undefined,
            labelGapDots: undefined,
            labelHeightDots: undefined,
            density: undefined,
            xRef: undefined,
            yRef: undefined,
            orientation: undefined
        };

        // All the rest of these follow some kind of standard pattern for
        // each value which we can pick up with regex. The cases here are
        // built out of observed configuration dumps.
        for (let i = 1; i < lines.length; i++) {
            const str = lines[i];
            switch (true) {
                case /^S\/N.*/.test(str):
                    // S/N: 42A000000000       # Serial number
                    printerInfo.serial = str.substring(5).trim();
                    break;
                case /^Serial\sport/.test(str):
                    // Serial port:96,N,8,1    # Serial port config
                    printerInfo.serialPort = str.substring(12).trim();
                    break;
                case /^q\d+\sQ/.test(str): {
                    // q600 Q208,25            # Form width (q) and length (Q), with label gap
                    const settingsForm = str.trim().split(' ');
                    const length = settingsForm[1].split(',');
                    // Label width includes 4 dots of padding
                    labelInfo.labelWidthDots = parseInt(settingsForm[0].substring(1)) - 4;
                    labelInfo.labelGapDots = parseInt(length[1].trim());
                    labelInfo.labelHeightDots = parseInt(length[0].substring(1));
                    break;
                }
                case /^S\d\sD\d\d\sR/.test(str): {
                    // S4 D08 R112,000 ZB UN   # Config settings 2
                    const settings2 = str.trim().split(' ');
                    const ref = settings2[2].split(',');
                    printerInfo.speed = parseInt(settings2[0].substring(1));
                    labelInfo.density = parseInt(settings2[1].substring(1));
                    labelInfo.xRef = parseInt(ref[0].substring(1));
                    labelInfo.yRef = parseInt(ref[1]);
                    labelInfo.orientation = settings2[3].substring(1);
                    break;
                }
                case /^I\d,.,\d\d\d\sr[YN]/.test(str): {
                    // I8,A,001 rY JF WY       # Config settings 1
                    const settings1 = str.split(' ');
                    printerInfo.doubleBuffering = settings1[1][1] === 'Y';
                    break;
                }
                case /^HEAD\s\s\s\susage\s=/.test(str): {
                    // HEAD    usage =     249,392"    # Odometer of the head
                    const headsplit = str.substring(15).split(' ');
                    printerInfo.headDistanceIn = headsplit[headsplit.length - 1];
                    break;
                }
                case /^PRINTER\susage\s=/.test(str): {
                    // PRINTER usage =     249,392"    # Odometer of the printer
                    const printsplit = str.substring(15).split(' ');
                    printerInfo.printerDistanceIn = printsplit[printsplit.length - 1];
                    break;
                }
                case /^Option:/.test(str):
                    // Option:D,Ff         # Config settings 4
                    printerInfo.hardwareOptions = str.substring(7).split(',');
                    break;
                case /^Line\sMode/.test(str):
                    // Line mode           # Printer is in EPL1 mode
                    throw new WebZlpError(
                        'Printer is in EPL1 mode, this library does not support EPL1. Reset printer.'
                    );
                //
                // Everything else isn't parsed into something interesting.
                // We explicitly parse and handle them to better identify things we don't
                // parse, so we can log that information.
                //
                case /^Page\sMode/.test(str):
                // Page mode           # Printer is in EPL2 mode
                // No-op, this is the mode we want in WebZLP
                case /^oE.,/.test(str):
                // oEv,w,x,y,z             # Config settings 5
                // Line mode font substitution settings, ignored in WebZLP
                case /^\d\d\s\d\d\s\d\d\s$/.test(str):
                // 06 10 14                # Config setting 6
                // Not useful information, ignored in WebZLP
                case /^Emem:/.test(str):
                // Emem:031K,0037K avl     # Soft font storage
                // Emem used: 0            # Soft font storage
                case /^Gmem:/.test(str):
                // Gmem:000K,0037K avl     # Graphics storage
                // Gmem used: 0            # Graphics storage
                case /^Fmem:/.test(str):
                // Fmem:000.0K,060.9K avl  # Form storage
                // Fmem used: 0 (bytes)    # Form storage
                case /^Available:/.test(str):
                // Available: 130559       # Total memory for Forms, Fonts, or Graphics
                case /^Cover:/.test(str):
                // Cover: T=118, C=129     # (T)reshold and (C)urrent Head Up (open) sensor.
                case /^Image buffer size:/.test(str):
                    // Image buffer size:0245K # Image buffer size in use
                    break;
                default:
                    console.log(
                        "WebZPL observed a config line from your printer that was not handled. We'd love it if you could report this bug! Send '" +
                            str +
                            "' to https://github.com/Cellivar/WebZLP/issues"
                    );
                    break;
            }
        }

        // For any of the called-out sections above see the docs for WebZLP.

        if (printerInfo.model == PrinterModel.unknown) {
            // Break the rule of not directly logging errors for this ask.
            console.error(
                `An EPL printer was detected, but WebZLP doesn't know what model it is to communicate with it. Consider submitting an issue to the project at https://github.com/Cellivar/WebZLP/issues to have your printer added so the library can work with it. The information to attach is:`,
                '\nmodel:',
                rawModelId,
                '\nfirmware:',
                printerInfo.firmware,
                '\nconfigLine',
                lines[0],
                '\nAnd include any other details you have about your printer. Thank you!'
            );
            return PrinterOptions.invalid();
        }

        // Marshall it into a real data structure as best we can.
        // TODO: Better way to do this?
        const expectedModel = PrinterModelDb.getModelInfo(printerInfo.model);
        const options = new PrinterOptions(printerInfo.serial, expectedModel, printerInfo.firmware);

        const rawDarkness = Math.ceil(labelInfo.density * (100 / expectedModel.maxDarkness));
        options.darknessPercent = Math.max(
            0,
            Math.min(rawDarkness, 100)
        ) as Options.DarknessPercent;

        options.speed = new Options.PrintSpeedSettings(
            options.model.fromRawSpeed(printerInfo.speed)
        );

        const labelRoundingStep = commOpts.labelDimensionRoundingStep ?? 0;
        if (labelRoundingStep > 0) {
            // Label size should be rounded to the step value by round-tripping the value to an inch
            // then rounding, then back to dots.
            const roundedWidth = this.roundToNearestStep(
                labelInfo.labelWidthDots / options.model.dpi,
                labelRoundingStep
            );
            options.labelWidthDots = roundedWidth * options.model.dpi;
            const roundedHeight = this.roundToNearestStep(
                labelInfo.labelHeightDots / options.model.dpi,
                labelRoundingStep
            );
            options.labelHeightDots = roundedHeight * options.model.dpi;
        } else {
            // No rounding
            options.labelWidthDots = labelInfo.labelWidthDots;
            options.labelHeightDots = labelInfo.labelHeightDots;
        }

        // No rounding applied to other offsets, those tend to be stable.
        options.labelGapDots = labelInfo.labelGapDots;

        options.labelPrintOriginOffsetDots = { left: labelInfo.xRef, top: labelInfo.yRef };

        options.printOrientation =
            labelInfo.orientation === 'T'
                ? Options.PrintOrientation.inverted
                : Options.PrintOrientation.normal;

        // Hardware options are listed as various flags.
        // Presence of d or D indicates direct thermal printing, absence indicates transfer.
        if (printerInfo.hardwareOptions.some((o) => o === 'd' || o === 'D')) {
            options.thermalPrintMode = Options.ThermalPrintMode.direct;
        } else {
            options.thermalPrintMode = Options.ThermalPrintMode.transfer;
        }

        // EPL spreads print mode across multiple settings that are mutually exclusive.
        if (printerInfo.hardwareOptions.some((o) => o === 'C')) {
            options.mediaPrintMode = Options.MediaPrintMode.cutter;
        }
        if (printerInfo.hardwareOptions.some((o) => o === 'Cp')) {
            options.mediaPrintMode = Options.MediaPrintMode.cutterWaitForCommand;
        }
        if (printerInfo.hardwareOptions.some((o) => o === 'P')) {
            options.mediaPrintMode = Options.MediaPrintMode.peel;
        }
        if (printerInfo.hardwareOptions.some((o) => o === 'L')) {
            options.mediaPrintMode = Options.MediaPrintMode.peelWithButtonTap;
        }

        // TODO: more hardware options:
        // - Form feed button mode (Ff, Fr, Fi)
        // - Figure out what reverse gap sensor mode S means
        // - Figure out how to encode C{num} for cut-after-label-count

        // TODO other options:
        // Autosense settings?
        // Character set?
        // Error handling?
        // Continuous media?
        // Black mark printing?

        return options;
    }

    private imageBufferToCmd(bitmap: BitmapGRF, outDoc: TranspilationDocumentMetadata) {
        if (bitmap == null) {
            return this.noop;
        }

        // EPL only supports raw binary, get that.
        const buffer = bitmap.toBinaryGRF();

        // Add the text command prefix to the buffer data
        const parameters = [
            'GW' + Math.trunc(outDoc.horizontalOffset + bitmap.boundingBox.paddingLeft),
            Math.trunc(outDoc.verticalOffset + bitmap.boundingBox.paddingTop),
            bitmap.bytesPerRow,
            bitmap.height
        ];
        // Bump the offset according to the image being added.
        outDoc.verticalOffset += bitmap.boundingBox.height;
        const rawCmd = this.encodeCommand(parameters.join(',') + ',', false);
        return this.combineCommands(rawCmd, this.combineCommands(buffer, this.encodeCommand('')));
    }

    private lineToCmd(
        height: number,
        length: number,
        color: Commands.DrawColor,
        outDoc: TranspilationDocumentMetadata
    ) {
        length = Math.trunc(length) || 0;
        height = Math.trunc(height) || 0;
        let drawMode = 'LO';
        switch (color) {
            case Commands.DrawColor.black:
                drawMode = 'LO';
                break;
            case Commands.DrawColor.white:
                drawMode = 'LW';
                break;
        }

        return this.encodeCommand(
            [drawMode + outDoc.horizontalOffset, outDoc.verticalOffset, length, height].join(',')
        );
    }

    private boxToCmd(
        height: number,
        length: number,
        thickness: number,
        outDoc: TranspilationDocumentMetadata
    ) {
        length = Math.trunc(length) || 0;
        height = Math.trunc(height) || 0;
        thickness = Math.trunc(thickness) || 0;

        return this.encodeCommand(
            ['X' + outDoc.horizontalOffset, outDoc.verticalOffset, thickness, length, height].join(
                ','
            )
        );
    }
}
