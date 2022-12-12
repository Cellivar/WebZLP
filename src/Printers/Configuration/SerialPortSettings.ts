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
