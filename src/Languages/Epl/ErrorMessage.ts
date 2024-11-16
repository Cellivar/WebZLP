import { DecodeAscii } from "../../ASCII.js";
import * as Cmds from "../../Documents/Commands.js"
import type { IErrorMessage, IMessageHandlerResult } from "../../Printers/index.js";

export function getErrorMessage(
  msg: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _?: Cmds.IPrinterCommand
): IMessageHandlerResult<Uint8Array> {
  const result: IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  const errorMsg: IErrorMessage = {
    messageType: 'ErrorMessage'
  }
  let remainderSlice = 3;

  const errorCode = Number(DecodeAscii(msg.slice(0, 2)));
  const eplError = getErrorFromCode(errorCode, errorMsg);
  if (eplError === EplErrorCode.PaperOrRibbonEmpty) {
    // This error may include additional data.
    // If `US` error reporting is enabled it will include Pnnn, where nnn is
    // the number of labels waiting to print.
    if (msg.at(3) === 0x50 /* P */) {
      errorMsg.UnprintedLabels = Number(DecodeAscii(msg.slice(4, 7)));
      remainderSlice = 7;
      // If `UT` alternate error reporting is enabled it also adds Lyyyyy,
      // where the yyyyy is the number of unprinted raster lines.
      if (msg.at(7) === 0x4C /* L */) {
        errorMsg.UnprintedRasterLines = Number(DecodeAscii(msg.slice(8, 13)));
        remainderSlice = 13;
      }
    }
  }
  result.messages.push(errorMsg);
  result.remainder = msg.slice(0, remainderSlice);
  return result;
}

function getErrorFromCode(errCode: number, errMsg: IErrorMessage): EplErrorCode {
  // TODO: Better way to do this.
  switch (errCode) {
    case EplErrorCode.NoError:
      return EplErrorCode.NoError;
    case EplErrorCode.SyntaxError:
      errMsg.CommandSyntaxError = true;
      return EplErrorCode.SyntaxError;
    case EplErrorCode.ObjectExceededLabelBorder:
      errMsg.ObjectExceededLabelBorder = true;
      return EplErrorCode.ObjectExceededLabelBorder;
    case EplErrorCode.BarCodeDataLengthError:
      errMsg.BarCodeDataLengthError = true;
      return EplErrorCode.BarCodeDataLengthError;
    case EplErrorCode.InsufficientMemoryToStoreData:
      errMsg.InsufficientMemoryToStoreData = true;
      return EplErrorCode.InsufficientMemoryToStoreData;
    case EplErrorCode.RS232InterfaceError:
      errMsg.RS232InterfaceError = true;
      return EplErrorCode.RS232InterfaceError;
    case EplErrorCode.PaperOrRibbonEmpty:
      errMsg.PaperEmptyError = true;
      errMsg.RibbonEmptyError = true;
      return EplErrorCode.PaperOrRibbonEmpty;
    case EplErrorCode.DuplicateNameFormGraphicOrSoftFont:
      errMsg.DuplicateNameFormGraphicOrSoftFont = true;
      return EplErrorCode.DuplicateNameFormGraphicOrSoftFont;
    case EplErrorCode.NameNotFoundFormGraphicOrSoftFont:
      errMsg.NameNotFoundFormGraphicOrSoftFont = true;
      return EplErrorCode.NameNotFoundFormGraphicOrSoftFont;
    case EplErrorCode.NotInDataEntryMode:
      errMsg.NotInDataEntryMode = true;
      return EplErrorCode.NotInDataEntryMode;
    case EplErrorCode.PrintheadUp:
      errMsg.PrintheadUp = true;
      return EplErrorCode.PrintheadUp;
    case EplErrorCode.PauseModeOrPausedInPeelMode:
      errMsg.PrinterPaused = true;
      return EplErrorCode.PauseModeOrPausedInPeelMode;
    case EplErrorCode.PrintHeadTooHot:
      errMsg.PrintHeadTooHot = true;
      return EplErrorCode.PrintHeadTooHot;
    case EplErrorCode.MotorTooHot:
      errMsg.MotorTooHot = true;
      return EplErrorCode.MotorTooHot;
    case EplErrorCode.BatteryLowWarning40Percent:
      errMsg.BatteryLowWarning40Percent = true;
      return EplErrorCode.BatteryLowWarning40Percent;
    case EplErrorCode.BatteryLowLimit20Percent:
      errMsg.BatteryLowLimit20Percent = true;
      return EplErrorCode.BatteryLowLimit20Percent;
    case EplErrorCode.PrinterBusyProcessingPrintJob:
      errMsg.PrinterBusyProcessingPrintJob = true;
      return EplErrorCode.PrinterBusyProcessingPrintJob;
    case EplErrorCode.CutterJammedOrNotInstalled:
      errMsg.CutterJammedOrNotInstalled = true;
      return EplErrorCode.CutterJammedOrNotInstalled;
    case EplErrorCode.AutoSenseOrSensorFailure:
      errMsg.AutoSenseOrSensorFailure = true;
      return EplErrorCode.AutoSenseOrSensorFailure;
    case EplErrorCode.MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding:
      errMsg.MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding = true;
      return EplErrorCode.MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding;
    case EplErrorCode.MemoryConfigurationError:
      errMsg.MemoryConfigurationError = true;
      return EplErrorCode.MemoryConfigurationError;
    case EplErrorCode.PDF417CodedDataTooLargeToFit:
      errMsg.PDF417CodedDataTooLargeToFit = true;
      return EplErrorCode.PDF417CodedDataTooLargeToFit;
    case EplErrorCode.IllegalInterruptOccurred:
    case EplErrorCode.UndefinedError:
    default:
      errMsg.UnknownError = true;
      return EplErrorCode.UndefinedError;
  }
}

export enum EplErrorCode {
  NoError                                                 = 0,
  SyntaxError                                             = 1,
  ObjectExceededLabelBorder                               = 2,
  BarCodeDataLengthError                                  = 3,
  InsufficientMemoryToStoreData                           = 4,
  MemoryConfigurationError                                = 5,
  RS232InterfaceError                                     = 6,
  PaperOrRibbonEmpty                                      = 7,
  DuplicateNameFormGraphicOrSoftFont                      = 8,
  NameNotFoundFormGraphicOrSoftFont                       = 9,
  NotInDataEntryMode                                      = 10,
  PrintheadUp                                             = 11,
  PauseModeOrPausedInPeelMode                             = 12,
  PrintHeadTooHot                                         = 13,
  MotorTooHot                                             = 14,
  BatteryLowWarning40Percent                              = 15,
  BatteryLowLimit20Percent                                = 16,
  PrinterBusyProcessingPrintJob                           = 50,
  // These can require a reset command or feed button push
  UndefinedError                                          = 80,
  CutterJammedOrNotInstalled                              = 81,
  AutoSenseOrSensorFailure                                = 82,
  IllegalInterruptOccurred                                = 83,
  MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding = 84,
  PDF417CodedDataTooLargeToFit                            = 93
}
