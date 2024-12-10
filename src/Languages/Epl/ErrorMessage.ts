import * as Cmds from "../../Commands/index.js"

const errorCodeMap: Map<number, Cmds.ErrorState[]> = new Map<number, Cmds.ErrorState[]>([
  [0, []],
  [1, [Cmds.ErrorState.CommandSyntaxError]],
  [2, [Cmds.ErrorState.ObjectExceededLabelBorder]],
  [3, [Cmds.ErrorState.BarCodeDataLengthError]],
  [4, [Cmds.ErrorState.InsufficientMemoryToStoreData]],
  [5, [Cmds.ErrorState.MemoryConfigurationError]],
  [6, [Cmds.ErrorState.RS232InterfaceError]],
  // EPL can't tell the difference, return both.
  [7, [Cmds.ErrorState.MediaEmptyError, Cmds.ErrorState.RibbonEmptyError]],
  [8, [Cmds.ErrorState.DuplicateNameFormGraphicOrSoftFont]],
  [9, [Cmds.ErrorState.NameNotFoundFormGraphicOrSoftFont]],
  [10, [Cmds.ErrorState.NotInDataEntryMode]],
  [11, [Cmds.ErrorState.PrintheadUp]],
  [12, [Cmds.ErrorState.PrinterPaused, Cmds.ErrorState.LabelWaitingToBeTaken]],
  [13, [Cmds.ErrorState.PrintheadTooHot]],
  [14, [Cmds.ErrorState.MotorTooHot]],
  [15, [Cmds.ErrorState.BatteryLowWarning40Percent]],
  [16, [Cmds.ErrorState.BatteryLowLimit20Percent]],
  
  [50, [Cmds.ErrorState.PrinterBusyProcessingPrintJob]],

  [80, [Cmds.ErrorState.UnknownError]],
  [81, [Cmds.ErrorState.CutterJammedOrNotInstalled]],
  [82, [Cmds.ErrorState.AutoSenseOrSensorFailure]],
  [83, [Cmds.ErrorState.IllegalInterruptOccurred]],
  [84, [Cmds.ErrorState.ExcessiveMediaFeeding, Cmds.ErrorState.BlackMarkNotFound, Cmds.ErrorState.PaperFeedError]],

  [93, [Cmds.ErrorState.PDF417CodedDataTooLargeToFit]],
]);

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

  const {sliced, remainder } = Cmds.sliceToCRLF(msg);
  result.remainder = remainder;
  const errorMsg: Cmds.IErrorMessage = {
    messageType: 'ErrorMessage',
    errors: getErrorFromCode(Number(sliced.slice(0, 2)))
  }

  // This error may include additional data.
  // If `US` error reporting is enabled it will include Pnnn, where nnn is
  // the number of labels waiting to print.
  if (msg.at(2) === 'P') {
    // 07P123
    errorMsg.unprintedLabels = Number(msg.slice(3, 6));
    // If `UT` alternate error reporting is enabled it also adds Lyyyyy,
    // where the yyyyy is the number of unprinted raster lines.
    if (msg.at(6) === 'L') {
      // 07P123L12345
      errorMsg.unprintedRasterLines = Number(msg.slice(7, 12));
    }

  }
  result.messages.push(errorMsg);
  return result;
}

function getErrorFromCode(errCode: number): Cmds.ErrorStateSet {
  return new Cmds.ErrorStateSet(errorCodeMap.get(errCode) ?? [Cmds.ErrorState.UnknownError]);
}
