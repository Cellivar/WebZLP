import { WebZlpError, type CommandSet, type IPrinterCommand } from "../index.js";
import type { IDeviceInformation } from "web-device-mux";

export type PrinterMessage
  = ISettingUpdateMessage
  | IStatusMessage
  | IErrorMessage

export type MessageType = 'SettingUpdateMessage' | 'StatusMessage' | 'ErrorMessage'

export type MessageArrayLike = string | Uint8Array
export type MessageArrayLikeType = "string" | "Uint8Array"
export interface MessageArrayLikeMap {
  "string": string;
  "Uint8Array": Uint8Array;
}

export interface MessageTransformer<TMessage extends MessageArrayLike> {
  transformerType: MessageArrayLikeType;
  combineMessages(...messages: TMessage[]): TMessage;

  messageToString(message: TMessage): string;
  messageToUint8Array(message: TMessage): Uint8Array;
}

export class RawMessageTransformer implements MessageTransformer<Uint8Array> {
  transformerType: MessageArrayLikeType = "Uint8Array";

  combineMessages(...messages: Uint8Array[]): Uint8Array {
    const bufferLen = messages.reduce((sum, arr) => sum + arr.byteLength, 0);
    return messages.reduce(
      (accumulator, arr) => {
        accumulator.buffer.set(arr, accumulator.offset);
        return { ...accumulator, offset: arr.byteLength + accumulator.offset };
      },
      { buffer: new Uint8Array(bufferLen), offset: 0 }
    ).buffer;
  }

  messageToString(message: Uint8Array): string {
    return new TextDecoder().decode(message);
  }

  messageToUint8Array(message: Uint8Array): Uint8Array {
    return message;
  }
}

export class StringMessageTransformer implements MessageTransformer<string> {
  private encoder = new TextEncoder();

  transformerType: MessageArrayLikeType = "string";
  combineMessages(...messages: string[]): string {
    return messages.join();
  }
  messageToString(message: string): string {
    return message;
  }
  messageToUint8Array(message: string): Uint8Array {
    return this.encoder.encode(message);
  }
}

export function asUint8Array(commands: MessageArrayLike): Uint8Array {
  if (typeof commands === "string") {
    return new TextEncoder().encode(commands);
  } else if (commands instanceof Uint8Array) {
    return commands;
  } else {
    throw new Error("Unknown message type not implemented!");
  }
}

export function asString(commands: MessageArrayLike): string {
  if (typeof commands === "string") {
    return commands;
  } else if (commands instanceof Uint8Array) {
    return new TextDecoder().decode(commands);
  } else {
    throw new Error("Unknown message type not implemented!");
  }
}

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
  input: TInput,
  commandSet: CommandSet<MessageArrayLike>,
  awaitedCommand?: AwaitedCommand
): Promise<{ remainderData: TInput; messages: PrinterMessage[]; }> {
  let msg = input;
  if (msg.length === 0) { return { messages: [], remainderData: msg}; }
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

  return { remainderData: msg, messages }
}
