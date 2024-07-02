import { WebZlpError } from "../index.js";
import type { IDeviceInformation } from "web-device-mux";

export type PrinterMessage
  = ISettingUpdateMessage
  | IStatusMessage
  | IErrorMessage

export type MessageType = 'SettingUpdateMessage' | 'StatusMessage' | 'ErrorMessage'

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
