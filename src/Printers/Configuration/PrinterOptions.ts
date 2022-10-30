import { PrinterModel as PrinterModel } from '../Models/PrinterModel';
import { NumericRange } from '../../NumericRange';

// [flags] I miss C#.
/** Command languages a printer could support. One printer may support multiple. */
export enum PrinterCommandLanguage {
    /** Error condition indicating autodetect failed. */
    none = 0,
    /** Printer can be set to EPL mode. */
    epl = 1 << 0,
    /** Printer can be set to ZPL mode. */
    zpl = 1 << 2,
    /** Printer can be set to CPCL mode. */
    cpcl = 1 << 3,

    /** Printer is capable of switching between EPL and ZPL. */
    zplEmulateEpl = epl | zpl,
    /** Printer is CPCL native and can emulate EPL and ZPL. */
    cpclEmulateBoth = cpcl | epl | zpl
}

/** The serial port settings for a printer */
export class SerialPortSettings {
    /** Port baud rate. Default s9600. */
    public speed: SerialPortSpeed;
    /** Port parity. Default none. */
    public parity: SerialPortParity;
    /** Data bit count. Default eight. */
    public dataBits: SerialPortDataBits;
    /** Stop bit count. Default one. */
    public stopBits: SerialPortStopBits;
    /** Handshake mode. Default XON/XOFF. ZPL only. */
    public handshake?: SerialPortHandshake;
    /** Error protocol. Default none. ZPL only. */
    public errorProtocol?: SerialPortZebraProtocol;
    /** Multi-drop serial network ID, between 000 and 999. Default 000. ZPL only. */
    public networkId?: number;
}

/** Baud rate of the serial port. Not all printers support all speeds. */
export enum SerialPortSpeed {
    /** Not commonly supported. */
    s110 = 110,
    /** ZPL only */
    s300 = 300,
    /** ZPL only */
    s600 = 600,
    s1200 = 1200,
    s2400 = 2400,
    s4800 = 4800,
    s9600 = 9600,
    s14400 = 14400,
    s19200 = 19200,
    s28800 = 28800,
    s38400 = 38400,
    /** Not all printers */
    s57600 = 57600,
    /** Not all printers */
    s115200 = 115200
}

/** Parity of the serial port */
export enum SerialPortParity {
    none,
    odd,
    even
}

/** Number of serial data bits */
export enum SerialPortDataBits {
    seven = 7,
    eight = 8
}

/** Number of serial stop bits */
export enum SerialPortStopBits {
    one = 1,
    two = 2
}

/** Serial protocol flow control mode. ZPL only. */
export enum SerialPortHandshake {
    /** Software flow control */
    xon_xoff, //eslint-disable-line
    /** Hardware flow control */
    dtr_dsr, //eslint-disable-line
    /** Hardware pacing control */
    rts_cts, //eslint-disable-line
    /** Auto-detect flow control based on first flow control detected. G-series printers only */
    dtr_dsr_and_xon_xoff //eslint-disable-line
}

/** Error checking protocol. You probably want this to always be none. ZPL only. */
export enum SerialPortZebraProtocol {
    /** No error checking handshake. Default. */
    none,
    /** Send ACK/NAK packets back to host. */
    ack_nak, //eslint-disable-line
    /** ack_nak with sequencing. Requires DSR/DTR. */
    zebra
}

/** Configured print speeds for a printer. */
export class PrintSpeedSettings {
    /** Speed during printing media. */
    mediaSpeed: PrintSpeed;
    /** Speed during feeding a blank label. ZPL only, same as media speed for EPL. */
    slewSpeed: PrintSpeed;
}

/** Printer speed values in inches per second. */
export enum PrintSpeed {
    /** Mobile printers can't be configured otherwise. */
    auto = 0,
    ips1,
    /** EPL-only. Not often supported */
    ips1_5, // eslint-disable-line
    ips2,
    /** EPL-only. Not often supported */
    ips2_5, // eslint-disable-line
    ips3,
    /** EPL-only. Not often supported */
    ips3_5, // eslint-disable-line
    ips4,
    ips5,
    ips6,
    ips7,
    ips8,
    ips9,
    ips10,
    ips11,
    ips12,
    /** Not often supported */
    ips13,
    /** Not often supported */
    ips14
}

/** Printer options related to the label media being printed */
export interface IPrinterLabelMediaOptions {
    /** How dark to print. 0 is blank, 99 is max darkness */
    darknessPercent: NumericRange<0, 100>;

    /** The label media thermal print mode. */
    thermalPrintMode: ThermalPrintMode;

    /** Mode the printer uses to detect separate labels when printing. */
    labelGapDetectMode: LabelMediaGapDetectionMode;
    /**
     * The gap / mark length between labels. Mandatory for markSensing black line mode.
     * Media with webSensing gaps can use AutoSense to get this value.
     */
    labelGapInches?: number;
    /**
     * Offset of the gap / mark from
     * */
    labelGapMarkOffsetInches: number;

    /** The width of the label media, in inches. */
    labelWidthInches: number;
    /** The height of the label media, in inches. */
    labelHeightInches: number;

    /** The offset of the printable area, from the top-left corner. */
    labelPrintOriginOffsetInches: Coordinate;

    labelCutPositionOffset: number;
}

/** Coordinates on a 2D plane. */
export interface Coordinate {
    /** Offset from the left side of the plane, incrementing to the right. --> */
    left: number;
    /** Offset from the top side of the plane, incrementing down. */
    top: number;
}

/** The thermal media print mode */
export enum ThermalPrintMode {
    /** Direct thermal with no ribbon. */
    direct,
    /** Thermal transfer, using a ribbon. Printer must support this mode. */
    transfer
}

/** Describes the way the labels are marked for the printer to detect separate labels. */
export enum LabelMediaGapDetectionMode {
    /** Media is one continous label with no gaps. Used with cutters usually. */
    continuous,
    /** Media is opaque with gaps betwen labels that can be sensed by the printer. */
    webSensing,
    /** Media has black marks indicating label spacing. */
    markSensing,
    /** Autodetect during calibration. G-series printers only. */
    autoDurinCalibration,
    /** KR403 printer only. */
    continuousVariableLength
}

/** Firmware information about the printer that can't be modified. */
export interface IPrinterFactoryInformation {
    /** The raw serial number of the printer. */
    get serialNumber(): string;
    /** The model of the printer. */
    get model(): PrinterModel;
    /** The firmware version information for the printer. */
    get firmware(): string;
    /** The command languages the printer supports. */
    get langauge(): PrinterCommandLanguage;
}

/** Customizable options for printer configuration. Avoid changing often. */
export interface IPrinterOptions {
    /** Label print speed settings */
    printSpeed: PrintSpeedSettings;
}

/** Configured options for a label printer */
export class PrinterOptions implements IPrinterFactoryInformation, IPrinterOptions {
    // Read-only printer config info
    private _serialNum: string;
    get serialNumber(): string {
        return this._serialNum;
    }
    private _model: PrinterModel;
    get model(): PrinterModel {
        return this._model;
    }

    private _firmware: string;
    get firmware(): string {
        return this._firmware;
    }

    private _language: PrinterCommandLanguage;
    get langauge(): PrinterCommandLanguage {
        return this._language;
    }

    printSpeed: PrintSpeedSettings;

    // EPL-only properties

    // Properties that get written to internal storage, thus should not be rewritten a lot
    labelMediaOptions: IPrinterLabelMediaOptions;
    private _hardwareOptions: string;

    // Communication
    private _enableErrorReporting: boolean;
    private _enableAltErrorReporting: boolean;
    private _serialPortSettings: SerialPortSettings;

    // Label alignment
    private _enableTopOfFormBackup: boolean;
    private _referencePoint: number;

    // Font stuff
    private _asianCharacterSpacing: number;
    private _characterSet: number;

    constructor({
        serialNumber,
        model,
        firmware,
        language
    }: {
        serialNumber: string;
        model: PrinterModel;
        firmware: string;
        language: PrinterCommandLanguage;
    }) {
        this._serialNum = serialNumber;
        this._model = model;
        this._firmware = firmware;
        this._language = language;
    }

    // Properties that get written to temp storage and don't matter
}

/** Printing behavior  */
export enum PrintMode {
    /** Label advances so web is over tear bar, to be torn manually. */
    tearoff,
    /** Label advances over Label Taken sensor. Printing pauses until label is removed. */
    peel,
    /** Peel mode, but each label is fed to prepeel a small portion. Helps some media types. ZPL only.*/
    peelWithPrepeel,
    /** Peel mode, but printer waits for button tap between labels. */
    peelWithButtonTap,
    /** Label advances until web is over cutter. */
    cutter,
    /** Cutter, but cut operation waits for separate command. ZPL only. */
    cutterWaitForCommand,
    /** Label and liner are rewound on an external device. No backfeed motion. ZPL only. */
    rewind,
    /** Label advances far enough for applicator device to grab. Printers with applicator ports only. */
    applicator,
    /** Removes backfeed between RFID labels, improving throughput. RFID printers only. */
    rfid,
    /** Label is moved into a presentation position. ZPL only.*/
    kiosk
}
