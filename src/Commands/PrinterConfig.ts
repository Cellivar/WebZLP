import * as Conf from '../Configs/index.js';
import type { ISettingUpdateMessage } from './Messages.js';

/** Configured options for a label printer */
export class PrinterConfig extends Conf.BasePrinterConfig {
  public constructor() {
    super();
  }

  /** Update these options with newly transmitted settings. */
  public update(msg: ISettingUpdateMessage) {
    const h = msg.printerHardware;
    this._model                      = h?.model              ?? this._model;
    this._manufacturer               = h?.manufacturer       ?? this._manufacturer;
    this._serial                     = h?.serialNumber       ?? this._serial;
    this._dpi                        = h?.dpi                ?? this._dpi;
    this._speedTable                 = h?.speedTable         ?? this._speedTable;
    this._maxMediaDarkness           = h?.maxMediaDarkness   ?? this._maxMediaDarkness;
    this._firmware                   = h?.firmware           ?? this._firmware;
    this._maxMediaLengthDots         = h?.maxMediaLengthDots ?? this._maxMediaLengthDots;
    this._maxMediaWidthDots          = h?.maxMediaWidthDots  ?? this._maxMediaWidthDots;

    const m = msg.printerMedia;
    this._speed                      = m?.speed                      ?? this._speed;
    this._darkness                   = m?.darknessPercent            ?? this._darkness;
    this._thermalPrintMode           = m?.thermalPrintMode           ?? this._thermalPrintMode;
    this._mediaPrintMode             = m?.mediaPrintMode             ?? this._mediaPrintMode;
    this._printOrientation           = m?.printOrientation           ?? this._printOrientation;
    this._mediaGapDetectMode         = m?.mediaGapDetectMode         ?? this._mediaGapDetectMode;
    this._mediaPrintOriginOffsetDots = m?.mediaPrintOriginOffsetDots ?? this._mediaPrintOriginOffsetDots;
    this._mediaGapDots               = m?.mediaGapDots               ?? this._mediaGapDots;
    this._mediaLineOffsetDots        = m?.mediaLineOffsetDots        ?? this._mediaLineOffsetDots;
    this._mediaWidthDots             = m?.mediaWidthDots             ?? this._mediaWidthDots;
    this._mediaLengthDots            = m?.mediaLengthDots            ?? this._mediaLengthDots;

    const s = msg.printerSettings;
    this._backfeedAfterTaken = s?.backfeedAfterTaken ?? this._backfeedAfterTaken;
    this._feedButtonMode     = s?.feedButtonMode     ?? this._feedButtonMode;
  }

  public toUpdate(): ISettingUpdateMessage {
    return {
      messageType: 'SettingUpdateMessage',

      printerHardware: this,
      printerMedia:    this,
      printerSettings: this,
    }
  }
}
