import { WebZplError } from '../../WebZplError';
import { PrinterCommandLanguage } from '../Configuration/PrinterOptions';
import { PrinterOptions } from '../Configuration/PrinterOptions';
import { detectModel } from '../Models/PrinterModel';
import { IPrinterCommandSet } from './IPrinterCommandSet';

/**
 * Command set for communicating with an EPL II printer.
 */
export class EplPrinterCommandSet implements IPrinterCommandSet {
    private rawCmdBuffer: Array<Uint8Array> = [];

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

    addCmd(...parameters: string[]): IPrinterCommandSet {
        this.addRawCmd(new TextEncoder().encode(parameters.join(',') + '\n'));
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

    parseConfigurationResponse(rawText: string): PrinterOptions {
        // Raw text from the printer contains \r\n, normalize to \n.
        const lines = rawText
            .replaceAll('\r', '')
            .split('\n')
            .filter((i) => i);

        // From here we make a lot of assumptions about the format of the output.
        // Unfortunately EPL-only printers tended to have a LOT of variance on
        // what they actually put into the output. Firmware versions, especially
        // shipper-customzied versions, could omit information.
        // This method attempts to get what we can out of it.

        // Here's a complete example from a real printer. For more examples see
        // the docs folder.

        // UKQ1935HLU     V4.29
        // S/N: 42A000000042
        // Serial port:96,N,8,1
        // Image buffer size:0245K
        // Fmem:000.0K,060.9K avl
        // Gmem:000K,0037K avl
        // Emem:031K,0037K avl
        // I8,A,001 rN JF WN
        // S3 D09 R008,000 ZT UN
        // q816 Q1218,25
        // Option:d,Ff
        // oEv,w,x,y,z
        // 04 08 14

        // We parse that thusly:

        // First line determines firmware version, mostly consistent. Looks like
        // UKQ1935HLU     V4.29   // Normal legit LP244
        // UKQ1935HMU  FDX V4.45  // FedEx modified LP2844
        const header = lines[0].split(' ').filter((i) => i);
        let rawModelId = header[0];
        if (header.length === 3) {
            // Append FDX to model number for FedEx printer detect.
            rawModelId = header[0] + header[1];
        }

        const printerInfo = {
            model: detectModel(rawModelId),
            firmware: header[header.length - 1],
            serial: 'no_serial_nm',
            serialPort: undefined,
            speed: undefined,
            doubleBuffering: undefined,
            headDistanceIn: undefined,
            printerDistanceIn: undefined,
            hwOption: undefined
        };

        const labelInfo = {
            labelWidthDots: undefined,
            labelGapDots: undefined,
            labelHeightDots: undefined,
            density: undefined,
            xRef: undefined,
            yRef: undefined
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
                    labelInfo.labelWidthDots = parseInt(settingsForm[0].substring(1));
                    labelInfo.labelGapDots = parseInt(length[1].trim());
                    // Height is more reliable when subtracting the gap. It's still not perfect..
                    labelInfo.labelHeightDots =
                        parseInt(length[0].substring(1)) - labelInfo.labelGapDots;
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
                case /^\d\d\s\d\d\s\d\d\s$/.test(str):
                // 06 10 14                # AutoSense settings, see below
                case /^oE.,/.test(str):
                // oEv,w,x,y,z             # Config settings 4, see below
                case /^Option:/.test(str):
                    // Option:D,Ff         # Config settings 3, see below
                    printerInfo.hwOption = str.substring(7).split(',');
                    break;
                case /^Emem:/.test(str):
                // Emem:031K,0037K avl     # Soft font storage
                case /^Gmem:/.test(str):
                // Gmem:000K,0037K avl     # Graphics storage
                case /^Fmem:/.test(str):
                // Fmem:000.0K,060.9K avl  # Form storage
                case /^Emem used:/.test(str):
                // Emem used: 0            # Soft font storage
                case /^Gmem used:/.test(str):
                // Gmem used: 0            # Graphics storage
                case /^Fmem used:/.test(str):
                // Fmem used: 0 (bytes)    # Form storage
                case /^Available:/.test(str):
                // Available: 130559       # Total memory for Forms, Fonts, or Graphics
                case /^Cover:/.test(str):
                // Cover: T=118, C=129     # (T)reshold and (C)urrent Head Up (open) sensor.
                case /^Image buffer size:/.test(str):
                // Image buffer size:0245K # Image buffer size in use
                case /^Line\sMode/.test(str):
                    // Line mode           # Printer is in EPL1 mode
                    throw new WebZplError(
                        'Printer is in EPL1 mode, this library does not support EPL1. Reset printer.'
                    );
                case /^Page\sMode/.test(str):
                    // Page mode           # Printer is in page mode
                    break;
                default:
                    console.log(
                        "WebZPL observed a config line that was not handled. We'd love it if you could report this bug! Send '" +
                            str +
                            "' to https://github.com/Cellivar/WebZLP/issues"
                    );
                    break;
            }
        }

        // Marshall it into a real data structure as best we can.
        const options = new PrinterOptions({
            serialNumber: printerInfo.serial,
            model: printerInfo.model,
            firmware: printerInfo.firmware,
            // TODO: dynamic from printer model library
            language: PrinterCommandLanguage.epl
        });

        return options;
    }
}
