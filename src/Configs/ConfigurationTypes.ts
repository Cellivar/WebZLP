import * as Util from '../Util/index.js';

/** The darkness of the printer setting, higher being printing darker. */
export type DarknessPercent = Util.Percent;

/** Coordinates on a 2D plane. */
export interface Coordinate {
  /** Offset from the left side of the plane, incrementing to the right. --> */
  left: number;
  /** Offset from the top side of the plane, incrementing down. */
  top: number;
}

/** The orientation of a media as it comes out of the printer. */
export enum PrintOrientation {
  /** Right-side up when the printer faces the user. */
  normal,
  /** Upside-down when the printer faces the user. */
  inverted
}

/** Printer speed values in inches per second (IPS). */
export enum PrintSpeed {
  unknown = -1,
  /** Mobile printers can't be configured otherwise. */
  ipsAuto = 0,
  /** The lowest speed a given printer supports. */
  ipsPrinterMin,
  ips1,
  /** EPL-only. Not often supported */
  ips1_5,
  ips2,
  /** EPL-only. Not often supported */
  ips2_5,
  ips3,
  /** EPL-only. Not often supported */
  ips3_5,
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
  ips14,
  /** The highest speed a given printer supports. */
  ipsPrinterMax = 1000
}

/** The thermal media print mode */
export enum ThermalPrintMode {
  /** Direct thermal with no ribbon. Printer must support this mode. */
  direct,
  /** Thermal transfer, using a ribbon. Printer must support this mode. */
  transfer
}

/** Describes the way the medias are marked for the printer to detect separate medias. */
export enum MediaMediaGapDetectionMode {
  /** Media is one continuous media with no gaps. Used with cutters usually. */
  continuous,
  /** Media is opaque with gaps between medias that can be sensed by the printer. */
  webSensing,
  /** Media has black marks indicating media spacing. */
  markSensing,
  /** Autodetect during calibration. G-series printers only. */
  autoDuringCalibration,
  /** KR403 printer only. */
  continuousVariableLength
}

/** Printing behavior  */
export enum MediaPrintMode {
  /** Media advances so web is over tear bar, to be torn manually. */
  tearOff,
  /** Media advances over Media Taken sensor. Printing pauses until media is removed. */
  peel,
  /** Peel mode, but each media is fed to pre-peel a small portion. Helps some media types. ZPL only.*/
  peelWithPrePeel,
  /** Peel mode, but printer waits for button tap between medias. */
  peelWithButtonTap,
  /** Media advances until web is over cutter. */
  cutter,
  /** Cutter, but cut operation waits for separate command. ZPL only. */
  cutterWaitForCommand,
  /** Media and liner are rewound on an external device. No backfeed motion. ZPL only. */
  rewind,
  /** Media advances far enough for applicator device to grab. Printers with applicator ports only. */
  applicator,
  /** Removes backfeed between RFID medias, improving throughput. RFID printers only. */
  rfid,
  /** Media is moved into a presentation position. ZPL only.*/
  kiosk
}

/** Percentage to backfeed after taking/cutting label, vs before printing the next. */
export type BackfeedAfterTaken
  = 'Disabled'
  | '0'
  | '10'
  | '20'
  | '30'
  | '40'
  | '50'
  | '60'
  | '70'
  | '80'
  | '90'
  | '100';

/** Class for representing a printer's relationship between speeds and raw values */
export class SpeedTable {
  // Speed is determined by what the printer supports
  // EPL printers have a table that determines their setting and it needs to be hardcoded.
  // ZPL printers follow this pattern:
  // 1       =  25.4 mm/sec.  (1 inch/sec.)
  // A or 2  =  50.8 mm/sec.  (2 inches/sec.)
  // A is the default print and backfeed speed
  // B or 3  =  76.2 mm/sec.  (3 inches/sec.)
  // C or 4  =  101.6 mm/sec. (4 inches/sec.)
  // 5       =  127 mm/sec.   (5 inches/sec.)
  // D or 6  =  152.4 mm/sec. (6 inches/sec.)
  // D is the default media slew speed
  // 7       =  177.8 mm/sec. (7 inches/sec.)
  // E or 8  =  203.2 mm/sec. (8 inches/sec.)
  // 9       =  220.5 mm/sec. (9 inches/sec.)
  // 10      =  245 mm/sec.   (10 inches/sec.)
  // 11      =  269.5 mm/sec. (11 inches/sec.)
  // 12      =  304.8 mm/sec. (12 inches/sec.)
  // 13      =  13 in/sec
  // 14      =  14 in/sec
  // This gets encoded into the speed table.
  // Every speed table should also have entries for ipsPrinterMin, ipsPrinterMax, and auto.
  // These should be duplicate entries of real values in the speed table so that
  // we have sane defaults for commands to default to.
  get table(): ReadonlyMap<PrintSpeed, number> {
    return this.speedTable;
  }
  constructor(
    private readonly speedTable: Map<PrintSpeed, number> = new Map<PrintSpeed, number>()
  ) {}

  // My kingdom for extension methods on enums in a reasonable manner.
  /** Look up a speed enum value from a given whole number */
  public static getSpeedFromWholeNumber(speed: number): PrintSpeed {
    switch (speed) {
      default: return PrintSpeed.unknown;
      case 0:  return PrintSpeed.ipsAuto;
      case 1:  return PrintSpeed.ips1;
      case 2:  return PrintSpeed.ips2;
      case 3:  return PrintSpeed.ips3;
      case 4:  return PrintSpeed.ips4;
      case 5:  return PrintSpeed.ips5;
      case 6:  return PrintSpeed.ips6;
      case 7:  return PrintSpeed.ips7;
      case 8:  return PrintSpeed.ips8;
      case 9:  return PrintSpeed.ips9;
      case 10: return PrintSpeed.ips10;
      case 11: return PrintSpeed.ips11;
      case 12: return PrintSpeed.ips12;
      case 13: return PrintSpeed.ips13;
      case 14: return PrintSpeed.ips14;
    }
  }

  /** Determine if a given speed will work with this model. */
  isValid(speed: PrintSpeed): boolean {
    return this.speedTable.has(speed);
  }

  /** Get a raw value to send to the printer for a speed. */
  toRawSpeed(speed: PrintSpeed): number {
    const val = this.speedTable.get(speed) ?? this.speedTable.get(PrintSpeed.ipsAuto);
    return val ?? 0;
  }

  /** Get a speed value from the raw value sent by the printer. Defaults to minimum if parse fails. */
  fromRawSpeed(rawSpeed?: number): PrintSpeed {
    for (const [key, val] of this.speedTable) {
      if (
        val === rawSpeed &&
        key != PrintSpeed.ipsAuto &&
        key != PrintSpeed.ipsPrinterMax &&
        key != PrintSpeed.ipsPrinterMin
      ) {
        return key;
      }
    }
    return PrintSpeed.ipsAuto;
  }
}

/** Configured print speeds for a printer. */
export class PrintSpeedSettings {
  constructor(printSpeed: PrintSpeed, slewSpeed?: PrintSpeed) {
    this.printSpeed = printSpeed;
    this.slewSpeed = slewSpeed ?? printSpeed;
  }

  /** Speed during printing media. */
  printSpeed: PrintSpeed;
  /** Speed during feeding a blank media. ZPL only, same as media speed for EPL. */
  slewSpeed: PrintSpeed;
}

/** Hardware information about the printer that can't be modified. */
export interface IPrinterHardware {
  /** The DPI of the printer. */
  readonly dpi: number;

  /** The firmware version information for the printer. */
  readonly firmware: string;

  /** The manufacturer of the printer. */
  readonly manufacturer: string;

  /** The model name of the printer. */
  readonly model: string;

  /** The maximum print width, in dots. */
  readonly maxMediaWidthDots: number;

  /** The maximum print length, in dots. */
  readonly maxMediaLengthDots: number;

  /** The maximum value for the darkness setting. */
  readonly maxMediaDarkness: number;

  /** The raw serial number of the printer. */
  readonly serialNumber: string;

  /** The speed table of supported speeds. */
  readonly speedTable: SpeedTable;
}

export interface IPrinterHardwareUpdate {
  dpi?: number;
  firmware?: string;
  manufacturer?: string;
  model?: string;
  maxMediaWidthDots?: number;
  maxMediaLengthDots?: number;
  maxMediaDarkness?: number,
  serialNumber?: string;
  speedTable?: SpeedTable;
}

/** Settings for printer behavior */
export interface IPrinterSettings {
  /** What percentage of backfeed happens after cutting/taking label, vs before printing. */
  readonly backfeedAfterTaken: BackfeedAfterTaken;
}

export interface IPrinterSettingsUpdate {
  backfeedAfterTaken?: BackfeedAfterTaken;
}

/** Printer options related to the media media being printed */
export interface IPrinterMedia {
  /** How dark to print. 0 is blank, 99 is max darkness */
  darknessPercent: DarknessPercent;
  /** Mode the printer uses to detect separate medias when printing. */
  mediaGapDetectMode: MediaMediaGapDetectionMode;
  /**
   * The gap / mark length between medias. Mandatory for markSensing black line mode.
   * Media with webSensing gaps can use AutoSense to get this value.
   */
  get mediaGapInches(): number;
  /** Media web gap in dots */
  mediaGapDots: number;
  /** The offset in inches from the normal location of the media gap or black line. Can be negative. */
  get mediaLineOffsetInches(): number;
  /** The offset in dots from the normal location of the media gap or black line. Can be negative. */
  mediaLineOffsetDots: number;
  /** The length of the media media, in inches. */
  get mediaLengthInches(): number;
  /** The length of the media media, in dots. */
  mediaLengthDots: number;
  /** The width of the media media, in inches. */
  get mediaWidthInches(): number;
  /** The width of the media media, in dots. */
  mediaWidthDots: number;

  /** The offset of the printable area, from the top-left corner. */
  mediaPrintOriginOffsetDots: Coordinate;

  /**
   * Value to use for rounding read-from-config media sizes.
   *
   * When reading the config from a printer the media width and length may be
   * variable. When you set the media width to 4 inches it's translated into
   * dots, and then the printer adds a calculated offset to that. This offset
   * is unique per printer (so far as I have observed) and introduces noise.
   * This value rounds the returned value to the nearest fraction of an inch.
   *
   * For example, with a rounding step of 0.25 (the default) if the printer
   * returns a width 4.113 it will be rounded to 4.0
   */
  mediaDimensionRoundingStep: number;

  /** Media print speed settings */
  speed: PrintSpeedSettings;

  /** The media thermal print mode. */
  thermalPrintMode: ThermalPrintMode;

  /** The behavior of media after form printing. */
  mediaPrintMode: MediaPrintMode;

  /** Whether the media prints right-side-up or upside-down. */
  printOrientation: PrintOrientation;
}

export interface IPrinterMediaUpdate {
  darknessPercent?: DarknessPercent;
  mediaGapDetectMode?: MediaMediaGapDetectionMode;
  mediaGapDots?: number;
  mediaLineOffsetDots?: number;
  mediaLengthDots?: number;
  mediaWidthDots?: number;
  mediaPrintOriginOffsetDots?: Coordinate;
  mediaDimensionRoundingStep?: number;
  thermalPrintMode?: ThermalPrintMode;
  mediaPrintMode?: MediaPrintMode;
  printOrientation?: PrintOrientation;

  speed?: PrintSpeedSettings;
}
