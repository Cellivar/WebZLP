import * as Conf from '../Configs/index.js';
import type { ISettingUpdateMessage } from './Messages.js';

/** Configured options for a label printer */
export class PrinterConfig extends Conf.BasePrinterConfig {
  public constructor() {
    super();
  }

  /** Update these options with newly transmitted settings. */
  public update(msg: ISettingUpdateMessage) {
    this._model                      = msg.printerHardware?.model              ?? this._model;
    this._manufacturer               = msg.printerHardware?.manufacturer       ?? this._manufacturer;
    this._serial                     = msg.printerHardware?.serialNumber       ?? this._serial;
    this._dpi                        = msg.printerHardware?.dpi                ?? this._dpi;
    this._speedTable                 = msg.printerHardware?.speedTable         ?? this._speedTable;
    this._maxMediaDarkness           = msg.printerHardware?.maxMediaDarkness   ?? this._maxMediaDarkness;
    this._firmware                   = msg.printerHardware?.firmware           ?? this._firmware;
    this._maxMediaLengthDots         = msg.printerHardware?.maxMediaLengthDots ?? this._maxMediaLengthDots;
    this._maxMediaWidthDots          = msg.printerHardware?.maxMediaWidthDots  ?? this._maxMediaWidthDots;

    this._speed                      = msg.printerMedia?.speed                      ?? this._speed;
    this._darkness                   = msg.printerMedia?.darknessPercent            ?? this._darkness;
    this._thermalPrintMode           = msg.printerMedia?.thermalPrintMode           ?? this._thermalPrintMode;
    this._mediaPrintMode             = msg.printerMedia?.mediaPrintMode             ?? this._mediaPrintMode;
    this._printOrientation           = msg.printerMedia?.printOrientation           ?? this._printOrientation;
    this._mediaGapDetectMode         = msg.printerMedia?.mediaGapDetectMode         ?? this._mediaGapDetectMode;
    this._mediaPrintOriginOffsetDots = msg.printerMedia?.mediaPrintOriginOffsetDots ?? this._mediaPrintOriginOffsetDots;
    this._mediaGapDots               = msg.printerMedia?.mediaGapDots               ?? this._mediaGapDots;
    this._mediaLineOffsetDots        = msg.printerMedia?.mediaLineOffsetDots        ?? this._mediaLineOffsetDots;
    this._mediaWidthDots             = msg.printerMedia?.mediaWidthDots             ?? this._mediaWidthDots;
    this._mediaLengthDots            = msg.printerMedia?.mediaLengthDots            ?? this._mediaLengthDots;

    this._backfeedAfterTaken = msg.printerSettings?.backfeedAfterTaken ?? this._backfeedAfterTaken;
  }
}
