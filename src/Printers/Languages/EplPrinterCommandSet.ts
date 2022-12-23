import { WebZlpError } from '../../WebZlpError';
import * as Options from '../Configuration/PrinterOptions';
import { PrinterOptions } from '../Configuration/PrinterOptions';
import { PrinterModelDb } from '../Models/PrinterModelDb';
import { PrinterModel } from '../Models/PrinterModel';
import {
    CommandFormInclusionMode,
    PrinterCommandSet,
    TranspilationFormMetadata,
    TranspileCommandDelegate
} from './PrinterCommandSet';
import * as Commands from '../../Documents/Commands';
import { PrinterCommunicationOptions } from '../PrinterCommunicationOptions';

/** Command set for communicating with an EPL II printer. */
export class EplPrinterCommandSet extends PrinterCommandSet {
    private encoder = new TextEncoder();

    get commandLanguage(): Options.PrinterCommandLanguage {
        return Options.PrinterCommandLanguage.epl;
    }

    get formStartCommand(): Uint8Array {
        // Start of any EPL document should include a clear image buffer to prevent
        // previous commands from affecting the document.
        return this.encodeCommand('\r\nN');
    }

    get formEndCommand(): Uint8Array {
        // There's no formal command for the end of an EPL doc, but just in case
        // add a newline.
        return this.encodeCommand('');
    }

    protected nonFormCommands: (symbol | Commands.CommandType)[] = [
        Commands.CommandType.AutosenseLabelDimensionsCommand,
        Commands.CommandType.PrintConfigurationCommand,
        Commands.CommandType.QueryConfigurationCommand,
        Commands.CommandType.RawDocumentCommand,
        Commands.CommandType.RebootPrinterCommand
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
        [Commands.CommandType.OffsetCommand, this.modifyOffset.bind(this)],
        [Commands.CommandType.ClearImageBufferCommand, () => this.formStartCommand],
        [Commands.CommandType.CutNowCommand, () => this.encodeCommand('C')],
        // EPL uses an on/off style for form backup, it'll remain off until reenabled.
        [Commands.CommandType.SuppressFeedBackupCommand, () => this.encodeCommand('JB')],
        // Thus EPL needs an explicit command to re-enable.
        [Commands.CommandType.EnableFeedBackupCommand, () => this.encodeCommand('JF')],
        [Commands.CommandType.RebootPrinterCommand, () => this.encodeCommand('^@')],
        [Commands.CommandType.QueryConfigurationCommand, () => this.encodeCommand('UQ')],
        [Commands.CommandType.PrintConfigurationCommand, () => this.encodeCommand('U')],
        [Commands.CommandType.SaveCurrentConfigurationCommand, () => this.noop],
        [Commands.CommandType.SetPrintDirectionCommand, this.setPrintDirectionCommand],
        [Commands.CommandType.SetDarknessCommand, this.setDarknessCommand],
        [Commands.CommandType.SetPrintSpeedCommand, this.setPrintSpeedCommand],
        [Commands.CommandType.AutosenseLabelDimensionsCommand, () => this.encodeCommand('xa')],
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

    public encodeCommand(str: string, withNewline = true): Uint8Array {
        // Every command in EPL ends with a newline.
        return this.encoder.encode(str + (withNewline ? '\r\n' : ''));
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

        // First line determines firmware version and model number. When splitting
        // the string by spaces the last element should always be the version and
        // the rest of the elements are the model number.
        // UKQ1935HLU     V4.29   // Normal LP244
        // UKQ1935HMU  FDX V4.45  // FedEx modified LP2844
        // UKQ1935H U UPS V4.14   // UPS modified LP2844
        const header = lines[0].split(' ').filter((i) => i);
        const firmwareVersion = header.pop();
        const rawModelId = header.join(' ');

        const printerInfo = {
            model: PrinterModelDb.getModel(rawModelId),
            firmware: firmwareVersion,
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

    private setPrintDirectionCommand(
        cmd: Commands.SetPrintDirectionCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const dir = cmd.upsideDown ? 'T' : 'B';
        return cmdSet.encodeCommand(`Z${dir}`);
    }

    private setDarknessCommand(
        cmd: Commands.SetDarknessCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const dark = Math.trunc(cmd.darknessSetting);
        return cmdSet.encodeCommand(`D${dark}`);
    }

    private setPrintSpeedCommand(
        cmd: Commands.SetPrintSpeedCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        // Validation should have happened on setup, printer will just reject
        // invalid speeds.
        // EPL has no separate media slew speed setting.
        return cmdSet.encodeCommand(`S${cmd.speedVal}`);
    }

    private setLabelDimensionsCommand(
        cmd: Commands.SetLabelDimensionsCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const width = Math.trunc(cmd.widthInDots);
        const widthCmd = cmdSet.encodeCommand(`q${width}`);
        if (cmd.setsHeight) {
            const height = Math.trunc(cmd.heightInDots);
            const gap = Math.trunc(cmd.gapLengthInDots);
            const heightCmd = cmdSet.encodeCommand(`Q${height},${gap}`);
            return cmdSet.combineCommands(widthCmd, heightCmd);
        }
        return widthCmd;
    }

    private setLabelHomeCommand(
        cmd: Commands.SetLabelHomeCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const xOffset = Math.trunc(cmd.xOffset);
        const yOffset = Math.trunc(cmd.yOffset);
        return cmdSet.encodeCommand(`R${xOffset},${yOffset}`);
    }

    private printCommand(
        cmd: Commands.PrintCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const total = Math.trunc(cmd.count);
        const dup = Math.trunc(cmd.additionalDuplicateOfEach);
        return cmdSet.encodeCommand(`P${total},${dup}`);
    }

    private addImageCommand(
        cmd: Commands.AddImageCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        if (cmd?.bitmap == null) {
            return cmdSet.noop;
        }

        // EPL only supports raw binary, get that.
        const bitmap = cmd.bitmap;
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
        const rawCmd = cmdSet.encodeCommand(parameters.join(',') + ',', false);
        return cmdSet.combineCommands(
            rawCmd,
            cmdSet.combineCommands(buffer, cmdSet.encodeCommand(''))
        );
    }

    private addLineCommand(
        cmd: Commands.AddLineCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const length = Math.trunc(cmd.lengthInDots) || 0;
        const height = Math.trunc(cmd.heightInDots) || 0;
        let drawMode = 'LO';
        switch (cmd.color) {
            case Commands.DrawColor.black:
                drawMode = 'LO';
                break;
            case Commands.DrawColor.white:
                drawMode = 'LW';
                break;
        }

        return cmdSet.encodeCommand(
            `${drawMode}${outDoc.horizontalOffset},${outDoc.verticalOffset},${length},${height}`
        );
    }

    private addBoxCommand(
        cmd: Commands.AddBoxCommand,
        outDoc: TranspilationFormMetadata,
        cmdSet: EplPrinterCommandSet
    ): Uint8Array {
        const length = Math.trunc(cmd.lengthInDots) || 0;
        const height = Math.trunc(cmd.heightInDots) || 0;
        const thickness = Math.trunc(cmd.thickness) || 0;

        return cmdSet.encodeCommand(
            `X${outDoc.horizontalOffset},${outDoc.verticalOffset},${thickness},${length},${height}`
        );
    }
}
