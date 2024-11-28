import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import type { IDeviceInformation } from "web-device-mux";
import type { CommandType, IPrinterCommand, IPrinterExtendedCommand } from "./Commands.js";
import type { CommandSet } from './CommandSet.js';

export type PrinterMessage
  = ISettingUpdateMessage
  | IStatusMessage
  | IErrorMessage

export type MessageType = 'SettingUpdateMessage' | 'StatusMessage' | 'ErrorMessage'

export type MessageHandlerDelegate<TMessage> = (
  msg: TMessage,
  sentCommand: IPrinterCommand
) => IMessageHandlerResult<TMessage>;

export interface MessageTransformer<TMessage extends Conf.MessageArrayLike> {
  transformerType: Conf.MessageArrayLikeType;
  combineMessages(...messages: TMessage[]): TMessage;

  messageToString(message: TMessage): string;
  messageToUint8Array(message: TMessage): Uint8Array;
}

export class RawMessageTransformer implements MessageTransformer<Uint8Array> {
  transformerType: Conf.MessageArrayLikeType = "Uint8Array";

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
    return Util.DecodeAscii(message);
  }

  messageToUint8Array(message: Uint8Array): Uint8Array {
    return message;
  }
}

export class StringMessageTransformer implements MessageTransformer<string> {
  private encoder = new TextEncoder();

  transformerType: Conf.MessageArrayLikeType = "string";
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

export function asUint8Array(commands: Conf.MessageArrayLike): Uint8Array {
  if (typeof commands === "string") {
    return new TextEncoder().encode(commands);
  } else if (commands instanceof Uint8Array) {
    return commands;
  } else {
    throw new Error("Unknown message type not implemented!");
  }
}

export function asString(commands: Conf.MessageArrayLike): string {
  if (typeof commands === "string") {
    return commands;
  } else if (commands instanceof Uint8Array) {
    return Util.DecodeAscii(commands);
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
  messageType: 'SettingUpdateMessage';

  printerHardware: Conf.IPrinterHardwareUpdate;
  printerMedia: Conf.IPrinterMediaUpdate;

  printerDistanceIn?: number;
  headDistanceIn?: number;
}

/** A status message sent by the printer. */
export interface IStatusMessage {
  messageType: 'StatusMessage'

  labelWasTaken?: boolean;

  rfid?: IStatusMessageRfid;
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

/** RFID-specific status message results. */
export interface IStatusMessageRfid {
  encodeSuccessful?: boolean;
  voidedCount?: number;
}

/** The output of a function for parsing a message. */
export interface IMessageHandlerResult<TInput> {
  messageIncomplete: boolean,
  messageMatchedExpectedCommand: boolean,
  messages: PrinterMessage[],
  remainder: TInput
}

/** An error indicating a problem parsing a received message. */
export class MessageParsingError extends Util.WebZlpError {
  public readonly receivedMessage: Conf.MessageArrayLike;
  constructor(message: string, receivedMessage: Conf.MessageArrayLike) {
    super(message);
    this.receivedMessage = receivedMessage;
  }
}

export function getMessageHandler<TMessageType extends Conf.MessageArrayLike>(
  handlerMap: Map<symbol | CommandType, MessageHandlerDelegate<TMessageType>>,
  message: TMessageType,
  sentCommand?: IPrinterCommand
): IMessageHandlerResult<TMessageType> {
  if (sentCommand === undefined) {
    throw new MessageParsingError(
      `Received a command reply message without 'sentCommand' being provided, can't handle this message.`,
      message
    );
  }

  // Since we know this is a command response and we have a command to check
  // we can kick this out to a lookup function. That function will need to
  // do the slicing for us as we don't know how long the message might be.
  const cmdRef = sentCommand.type === 'CustomCommand'
    ? (sentCommand as IPrinterExtendedCommand).typeExtended
    : sentCommand.type;
  const handler = handlerMap.get(cmdRef);
  if (handler === undefined) {
    throw new MessageParsingError(
      `Command '${sentCommand.name}' has no message handler and should not have been awaited for this message. This is a bug in the library.`,
      message
    )
  }

  return handler(message, sentCommand);
}

export function deviceInfoToOptionsUpdate(deviceInfo: IDeviceInformation): ISettingUpdateMessage {
  return {
    messageType: 'SettingUpdateMessage',
    printerHardware: {
      serialNumber: deviceInfo.serialNumber,
      model: deviceInfo.productName,
      manufacturer: deviceInfo.manufacturerName
    },
    printerMedia: {}
  }
}

export async function parseRaw<TInput extends Conf.MessageArrayLike>(
  input: TInput,
  commandSet: CommandSet<Conf.MessageArrayLike>,
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

/**
 * Slice an array from the start to the first LF character, returning both pieces.
 *
 * If no LF character is found sliced will have a length of 0.
 *
 * CR characters are not removed if present!
 */
export function sliceToNewline(msg: Uint8Array): {
  sliced: Uint8Array,
  remainder: Uint8Array,
} {
  const idx = msg.indexOf(Util.AsciiCodeNumbers.LF);
  if (idx === -1) {
    return {
      sliced: new Uint8Array(),
      remainder: msg
    }
  }

  return {
    sliced: msg.slice(0, idx + 1),
    remainder: msg.slice(idx + 1),
  };
}

/** Slice a string from the start to the first CRLF or LF, returning both pieces. */
export function sliceToCRLF(msg: string): {
  sliced: string,
  remainder: string,
} {
  const cr = msg.indexOf('\r\n');
  if (cr !== -1) {
    return {
      sliced: msg.substring(0, cr),
      remainder: msg.substring(cr + 2)
    }
  }

  const lf = msg.indexOf('\n');
  if (lf !== -1) {
    return {
      sliced: msg.substring(0, lf),
      remainder: msg.substring(lf + 1)
    }
  }

  return {
    sliced: "",
    remainder: msg
  }
}
