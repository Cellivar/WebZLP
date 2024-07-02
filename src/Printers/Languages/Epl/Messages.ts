import { AsciiCodeNumbers, hex } from "../../../ASCII.js";
import { MessageParsingError, type IMessageHandlerResult } from "../../Messages.js";
import * as Cmds from "../../../Documents/Commands.js"
import { getErrorMessage } from "./ErrorMessage.js";
import { parseConfiguration } from "./ConfigParser.js";

export type MessageHandlerDelegate = (
  msg: Uint8Array,
  sentCommand: Cmds.IPrinterCommand
) => IMessageHandlerResult<Uint8Array>;

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
  const idx = msg.indexOf(AsciiCodeNumbers.LF);
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

export function handleMessage(
  msg: Uint8Array,
  sentCommand?: Cmds.IPrinterCommand
): IMessageHandlerResult<Uint8Array> {
  const result: IMessageHandlerResult<Uint8Array> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  if (msg === undefined || msg.length === 0) { return result; }

  // EPL is fast and loose with what it considers to be a response.
  // There isn't even a clear table of what possible responses are, instead we
  // get to play a scavenger hunt throughout the codebase to find them.

  // Some pieces are consistent, such as how EPL implements an automatic status
  // report for each printed label. Different modes can send different statuses
  // back depending on what exactly happened.

  // Some responses are only supported by mobile printers.

  // Analyzing the first byte of the message can tell us more about it.
  const firstByte = msg.at(0);
  if (firstByte === undefined) { return result; }

  switch (true) {
    case (firstByte === AsciiCodeNumbers.ACK):
      // Sent when error reporting enabled and printer finishes doing something.
      result.messages.push({
        messageType: 'StatusMessage'
        // No news is good news.
        // This can also be sent when a label is taken, but because we can't know
        // for certain we omit that detail here.
      });
      // TODO: Does the ack include a CR LF?
      result.remainder = msg.slice(1);
      break;

    case (firstByte === AsciiCodeNumbers.DEL):
      // Sent when alternate error reporting is enabled w/peeler taken sensor.
      result.messages.push({
        messageType: 'StatusMessage',
        LabelWasTaken: true,
      });
      // TODO: Does the ack include a CR LF?
      result.remainder = msg.slice(1);
      break;

    case (firstByte === AsciiCodeNumbers.NAK): {
      // Sent when there's an error. After removing the first value the rest
      // is the same as the error query command.
      const errorResult = getErrorMessage(msg.slice(1));
      result.messages.push(...errorResult.messages);
      result.remainder = errorResult.remainder;
      break;
    }

    default: {
      // Everything else needs to be fully interpreted as an  ASCII message.
      // Command responses may be fixed or variable length, usually with an
      // indicator of how many to expect.
      if (sentCommand === undefined) {
        throw new MessageParsingError(
          `Received a command reply message without 'sentCommand' being provided, can't handle this message.`,
          msg
        );
      }

      const messageHandlerMap = new Map<symbol | Cmds.CommandType, MessageHandlerDelegate>([
        ['GetError', getErrorMessage],
        ['QueryConfiguration', parseConfiguration],
      ]);
      
      // Since we know this is a command response and we have a command to check
      // we can kick this out to a lookup function. That function will need to
      // do the slicing for us as we don't know how long the message might be.
      const cmdRef = sentCommand.type === 'CustomCommand'
        ? (sentCommand as Cmds.IPrinterExtendedCommand).typeExtended
        : sentCommand.type;
      const handler = messageHandlerMap.get(cmdRef);
      if (handler === undefined) {
        throw new MessageParsingError(
          `Command '${sentCommand.name}' has no message handler and should not have been awaited for message ${hex(firstByte)}. This is a bug in the library.`,
          msg
        )
      }

      const handled = handler(msg, sentCommand);
      result.messages.push(...handled.messages);
      result.remainder = handled.remainder;
      result.messageIncomplete = handled.messageIncomplete;
      result.messageMatchedExpectedCommand = handled.messageMatchedExpectedCommand;
      break;
    }
  }

  return result;
}
