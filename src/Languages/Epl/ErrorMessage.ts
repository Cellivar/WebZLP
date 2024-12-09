import * as Cmds from "../../Commands/index.js"

export function getErrorMessage(
  msg: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _?: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: true,
    messages: [],
    remainder: msg,
  }
  const errorMsg: Cmds.IErrorMessage = {
    messageType: 'ErrorMessage'
  }

  const {sliced, remainder } = Cmds.sliceToCRLF(msg);
  result.remainder = remainder;
  const eplError = getErrorFromCode(Number(sliced.slice(0, 2)), errorMsg);
  if (eplError === EplErrorCode.PaperOrRibbonEmpty) {
    // This error may include additional data.
    // If `US` error reporting is enabled it will include Pnnn, where nnn is
    // the number of labels waiting to print.
    if (msg.at(2) === 'P') {
      // 07P123
      errorMsg.UnprintedLabels = Number(msg.slice(3, 6));
      // If `UT` alternate error reporting is enabled it also adds Lyyyyy,
      // where the yyyyy is the number of unprinted raster lines.
      if (msg.at(6) === 'L') {
        // 07P123L12345
        errorMsg.UnprintedRasterLines = Number(msg.slice(7, 12));
      }
    }
  }
  result.messages.push(errorMsg);
  return result;
}

function getErrorFromCode(errCode: number, errMsg: Cmds.IErrorMessage): EplErrorCode {
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
