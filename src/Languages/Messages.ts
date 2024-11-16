import { WebZlpError, type CommandSet, type IPrinterCommand } from "../index.js";
import type { IDeviceInformation } from "web-device-mux";

export type PrinterMessage
  = ISettingUpdateMessage
  | IStatusMessage
  | IErrorMessage

export type MessageType = 'SettingUpdateMessage' | 'StatusMessage' | 'ErrorMessage'

export type MessageArrayLike = string | Uint8Array

export type AwaitedCommand = {
  cmd: IPrinterCommand,
  promise: Promise<boolean>,
  resolve?: (value: boolean) => void,
  reject?: (reason?: unknown) => void,
}

/** A printer settings message, describing printer configuration status. */
export interface ISettingUpdateMessage {
  printerDistanceIn?: number;
  headDistanceIn?: number;
  messageType: 'SettingUpdateMessage';

  manufacturerName?: string;
  modelName?: string;
  serialNumber?: string;

  firmware?: string;
}

/** A status message sent by the printer. */
export interface IStatusMessage {
  messageType: 'StatusMessage'

  LabelWasTaken?: boolean;
}

/** An error message sent by the printer. */
export interface IErrorMessage {
  messageType: 'ErrorMessage',

  // Clearly user-generated errors:
  CommandSyntaxError?: boolean;
  ObjectExceededLabelBorder?: boolean;
  BarCodeDataLengthError?: boolean;
  InsufficientMemoryToStoreData?: boolean;
  DuplicateNameFormGraphicOrSoftFont?: boolean;
  NameNotFoundFormGraphicOrSoftFont?: boolean;
  NotInDataEntryMode?: boolean;
  PDF417CodedDataTooLargeToFit?: boolean;

  // Physical problem errors:
  MemoryConfigurationError?: boolean;
  RS232InterfaceError?: boolean;
  PrintHeadTooHot?: boolean;
  MotorTooHot?: boolean;
  BatteryLowWarning40Percent?: boolean;
  BatteryLowLimit20Percent?: boolean;
  CutterJammedOrNotInstalled?: boolean;
  MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding?: boolean;
  AutoSenseOrSensorFailure?: boolean;

  PrintheadUp?: boolean;
  PaperEmptyError?: boolean;
  RibbonEmptyError?: boolean;
  PrinterBusyProcessingPrintJob?: boolean;
  PrinterPaused?: boolean;

  UnprintedLabels?: number;
  UnprintedRasterLines?: number;

  // Catch-all for anything else printers throw.
  UnknownError?: boolean;
}

/** The output of a function for parsing a message. */
export interface IMessageHandlerResult<TInput> {
  messageIncomplete: boolean,
  messageMatchedExpectedCommand: boolean,
  messages: PrinterMessage[],
  remainder: TInput
}

/** An error indicating a problem parsing a received message. */
export class MessageParsingError extends WebZlpError {
  public readonly receivedMessage: Uint8Array;
  constructor(message: string, receivedMessage: Uint8Array) {
    super(message);
    this.receivedMessage = receivedMessage;
  }
}

export function deviceInfoToOptionsUpdate(deviceInfo: IDeviceInformation): ISettingUpdateMessage {
  return {
    messageType: 'SettingUpdateMessage',
    modelName: deviceInfo.productName,
    serialNumber: deviceInfo.serialNumber,
    manufacturerName: deviceInfo.manufacturerName,
  }
}

export async function parseRaw<TInput extends MessageArrayLike>(
  input: TInput[],
  commandSet: CommandSet<TInput>,
  awaitedCommand?: AwaitedCommand
) {
  let msg = commandSet.combineCommands(...input);
  if (msg.length === 0) { return { messages: [], remainderData: []}; }
  let incomplete = false;
  const messages: PrinterMessage[] = [];

  do {
    const parseResult = commandSet.parseMessage(msg, awaitedCommand?.cmd);

    msg = parseResult.remainder;
    incomplete = parseResult.messageIncomplete;

    if (parseResult.messageMatchedExpectedCommand) {
      if (awaitedCommand?.resolve === undefined) {
        console.error('Resolve callback was undefined for awaited command, this may cause a deadlock! This is a bug in the library.');
      } else {
        awaitedCommand.resolve(true);
      }
    }

    parseResult.messages.forEach(m => messages.push(m));
  } while (incomplete === false && msg.length > 0)

  const remainderData = msg.length === 0 ? [] : [msg];
  return { remainderData, messages }
}
