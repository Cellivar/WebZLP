import * as Util from '../Util/index.js';
import * as Conf from '../Configs/index.js';
import type { IDeviceInformation } from "web-device-mux";
import type { IPrinterCommand } from "./Commands.js";
import type { CommandSet } from './CommandSet.js';
import type { PrinterConfig } from './PrinterConfig.js';

export type PrinterMessage
  = ISettingUpdateMessage
  | IStatusMessage
  | IErrorMessage

export type MessageType = 'SettingUpdateMessage' | 'StatusMessage' | 'ErrorMessage'

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
    return asString(message);
  }

  messageToUint8Array(message: Uint8Array): Uint8Array {
    return message;
  }
}

export class StringMessageTransformer implements MessageTransformer<string> {
  transformerType: Conf.MessageArrayLikeType = "string";

  combineMessages(...messages: string[]): string {
    return messages.join('');
  }
  messageToString(message: string): string {
    return message;
  }
  messageToUint8Array(message: string): Uint8Array {
    return asUint8Array(message);
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

export function asTargetMessageType<TMessage extends Conf.MessageArrayLike>(
  msg: Conf.MessageArrayLike,
  targetType: TMessage,
): TMessage {
  if (typeof targetType === "string") {
    return asString(msg) as TMessage;
  } else if (targetType instanceof Uint8Array) {
    return asUint8Array(msg) as TMessage;
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

  printerHardware?: Conf.UpdateFor<Conf.IPrinterHardware>;
  printerMedia   ?: Conf.UpdateFor<Conf.IPrinterMedia>;
  printerSettings?: Conf.UpdateFor<Conf.IPrinterSettings>;
}

/** A status message sent by the printer. */
export interface IStatusMessage {
  messageType: 'StatusMessage'

  labelWasTaken?: boolean;

  rfid?: IStatusMessageRfid;
}

export enum ErrorState {
  NoError      = "NoError",
  UnknownError = "UnknownError",

  // User-generated errors
  CommandSyntaxError                 = "CommandSyntaxError",
  ObjectExceededLabelBorder          = "ObjectExceededLabelBorder",
  BarCodeDataLengthError             = "BarCodeDataLengthError",
  InsufficientMemoryToStoreData      = "InsufficientMemoryToStoreData",
  DuplicateNameFormGraphicOrSoftFont = "DuplicateNameFormGraphicOrSoftFont",
  NameNotFoundFormGraphicOrSoftFont  = "NameNotFoundFormGraphicOrSoftFont",
  NotInDataEntryMode                 = "NotInDataEntryMode",
  PDF417CodedDataTooLargeToFit       = "PDF417CodedDataTooLargeToFit",
  ReceiveBufferFull                  = "ReceiveBufferFull",
  PresenterNotRunning                = "PresenterNotRunning",

  // Physical problems with the device
  MemoryConfigurationError = "MemoryConfigurationError",
  RS232InterfaceError      = "RS232InterfaceError",
  CorruptRamConfigLost     = "CorruptRamConfigLost",
  InvalidFirmwareConfig    = "InvalidFirmwareConfig",
  PrintheadThermistorOpen  = "PrintheadThermistorOpen",
  PrintheadDetectionError  = "PrintheadDetectionError",
  BadPrintheadElement      = "BadPrintheadElement",
  IllegalInterruptOccurred = "IllegalInterruptOccurred",

  // Errors that need user action to resolve
  PrintheadUp = "PrintheadUp",

  MediaEmptyError  = "MediaEmptyError",
  MediaNearEnd     = "MediaNearEnd",
  RibbonEmptyError = "RibbonEmptyError",

  PrintheadTooHot  = "PrintheadTooHot",
  PrintheadTooCold = "PrintheadTooCold",
  MotorTooHot      = "MotorTooHot",
  MotorTooCold     = "MotorTooCold",
  //MotorJuuuuuuuustRight

  BatteryLowWarning40Percent = "BatteryLowWarning40Percent",
  BatteryLowLimit20Percent   = "BatteryLowLimit20Percent",

  CutterJammedOrNotInstalled = "CutterJammedOrNotInstalled",
  PressFeedButtonToRecover   = "PressFeedButtonToRecover",
  PaperFeedError             = "PaperFeedError",
  PaperJamDuringRetract      = "PaperJamDuringRetract",

  PrintheadNeedsCleaning  = "PrintheadNeedsCleaning",
  PrintheadNeedsReplacing = "PrintheadNeedsReplacing",

  // Media calibration errors
  MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding = "MediaErrorOrBlacklineNotDetectedOrExcessiveMediaFeeding",

  BlackMarkNotFound        = "BlackMarkNotFound",
  BlackMarkCalirateError   = "BlackMarkCalirateError",
  AutoSenseOrSensorFailure = "AutoSenseOrSensorFailure",
  ExcessiveMediaFeeding    = "ExcessiveMediaFeeding",
  RetractFunctionTimeout   = "RetractFunctionTimeout",
  NeedToCalibrateMedia     = "NeedToCalibrateMedia",

  // Statuses
  PrinterBusyProcessingPrintJob = "PrinterBusyProcessingPrintJob",
  PrinterPaused                 = "PrinterPaused",
  PartialFormatInProgress       = "PartialFormatInProgress",
  CommDiagnosticModeActive      = "CommDiagnosticModeActive",
  LabelWaitingToBeTaken         = "LabelWaitingToBeTaken",

}
export type ErrorStates = keyof typeof ErrorState;
export class ErrorStateSet extends Set<ErrorState> {}

/** An error message sent by the printer. */
export interface IErrorMessage {
  messageType: 'ErrorMessage',

  errors: ErrorStateSet;

  unprintedRasterLines?: number;
  unprintedLabels?: number;
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

export type CommandSetMessageHandlerDelegate<TMsgType extends Conf.MessageArrayLike> =
  <TReceived extends Conf.MessageArrayLike>(
    cmdSet: CommandSet<TMsgType>,
    message: TReceived,
    config: PrinterConfig,
    sentCommand?: IPrinterCommand
  ) => IMessageHandlerResult<TReceived>;

/** An error indicating a problem parsing a received message. */
export class MessageParsingError extends Util.WebZlpError {
  public readonly receivedMessage: Conf.MessageArrayLike;
  constructor(message: string, receivedMessage: Conf.MessageArrayLike) {
    super(message);
    this.receivedMessage = receivedMessage;
  }
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
  config: PrinterConfig,
  awaitedCommands: AwaitedCommand[]
): Promise<{ remainderMsg: TInput; remainderCommands: AwaitedCommand[], messages: PrinterMessage[]; }> {
  let remainderMsg = input;
  if (remainderMsg.length === 0) { return { messages: [], remainderCommands: awaitedCommands, remainderMsg}; }
  let incomplete = false;
  const messages: PrinterMessage[] = [];

  let remainderCommands = awaitedCommands.slice();

  do {
    if (remainderCommands.length === 0) {
      // No candidate commands, treat as raw!
      const parseResult = commandSet.handleMessage(remainderMsg, config);
      remainderMsg = parseResult.remainder;
      incomplete = parseResult.messageIncomplete;
      parseResult.messages.forEach(m => messages.push(m));

    } else {
      remainderCommands = remainderCommands.filter(c => {
        if (incomplete) {
          // Something else indicated it's incomplete, keep this candidate too.
          return true;
        }

        const parseResult = commandSet.handleMessage(remainderMsg, config, c.cmd);
        if (parseResult.messageMatchedExpectedCommand) {
          // The command found its response! Mark it accordingly.
          if (parseResult.messageIncomplete) {
            // But the command expects a longer response. Bail IMMEDIATELY.
            incomplete = true;
            return true;
          }

          // Otherwise it's safe to remove that message chunk and remove the candidate.
          remainderMsg = parseResult.remainder;
          parseResult.messages.forEach(m => messages.push(m));

          if (c?.resolve === undefined) {
            console.error('Resolve callback was undefined for awaited command, this may cause a deadlock! This is a bug in the library.');
          } else {
            c.resolve(true);
          }
          return false;
        }
      });
    }
  } while (incomplete === false && remainderMsg.length > 0 && remainderCommands.length > 0)

  return { remainderMsg, remainderCommands, messages }
}
