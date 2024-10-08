/** The serial port settings for a printer */
export interface SerialPortSettings {
  /** Port baud rate. Default s9600. */
  speed: SerialPortSpeed;
  /** Port parity. Default none. */
  parity: SerialPortParity;
  /** Data bit count. Default eight. */
  dataBits: SerialPortDataBits;
  /** Stop bit count. Default one. */
  stopBits: SerialPortStopBits;
  /** Handshake mode. Default XON/XOFF. ZPL only. */
  handshake?: SerialPortHandshake;
  /** Error protocol. Default none. ZPL only. */
  errorProtocol?: SerialPortZebraProtocol;
  /** Multi-drop serial network ID, between 000 and 999. Default 000. ZPL only. */
  networkId?: number;
}

/** Baud rate of the serial port. Not all printers support all speeds. */
export enum SerialPortSpeed {
  /** Not commonly supported. */
  s110 = 110,
    /** ZPL only */
  s300 = 300,
    /** ZPL only */
  s600   = 600,
  s1200  = 1200,
  s2400  = 2400,
  s4800  = 4800,
  s9600  = 9600,
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
  xon_xoff,
  /** Hardware flow control */
  dtr_dsr,
  /** Hardware pacing control */
  rts_cts,
  /** Auto-detect flow control based on first flow control detected. G-series printers only */
  dtr_dsr_and_xon_xoff
}

/** Error checking protocol. You probably want this to always be none. ZPL only. */
export enum SerialPortZebraProtocol {
  /** No error checking handshake. Default. */
  none,
  /** Send ACK/NAK packets back to host. */
  ack_nak,
  /** ack_nak with sequencing. Requires DSR/DTR. */
  zebra
}
