import * as Util from '../../Util/index.js';
import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { getErrorMessage } from "./ErrorMessage.js";

export function handleMessage<TReceived extends Conf.MessageArrayLike>(
  cmdSet: Cmds.CommandSet<string>,
  message: TReceived,
  _config: Cmds.PrinterConfig,
  sentCommand?: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<TReceived> {
  const result: Cmds.IMessageHandlerResult<TReceived> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: message,
  }
  const msg = Cmds.asTargetMessageLikeType<string>(message, 'string');
  let remainder = msg;
  if (msg === undefined || msg.length === 0) { return result; }

  // EPL is fast and loose with what it considers to be a response.
  // There isn't even a clear table of what possible responses are, instead we
  // get to play a scavenger hunt throughout the codebase to find them.

  // Some pieces are consistent, such as how EPL implements an automatic status
  // report for each printed label. Different modes can send different statuses
  // back depending on what exactly happened.

  // Some responses are only supported by mobile printers.

  // Analyzing the first byte of the message can tell us more about it.
  const firstByte = msg.at(0)
  if (firstByte === undefined) { return result; }

  switch (true) {
    // TODO: Does this error reporting mode even work over USB? Maybe only serial?
    case (firstByte === Util.AsciiCodeStrings.ACK):
      // Different depending on error reporting mode:
      // Normal mode: either finished printing, or label taken when sensor enabled.
      // Alternate mode: last line of label has been rasterized
      // We can't know at the moment here which one we received.
      result.messages.push({
        messageType: 'StatusMessage'
        // No news is good news.
        // This can also be sent when a label is taken, but because we can't know
        // for certain we omit that detail here.
      });
      // TODO: Does the ack include a CR LF?
      remainder = msg.slice(3);
      break;

    case (firstByte === Util.AsciiCodeStrings.DLE):
      // Sent when alternate error reporting is enabled w/peeler taken sensor.
      result.messages.push({
        messageType: 'StatusMessage',
        labelWasTaken: true,
      });
      // TODO: Does the ack include a CR LF?
      remainder = msg.slice(3);
      break;

    case (firstByte === Util.AsciiCodeStrings.NAK): {
      // Sent when there's an error. After removing the first value the rest
      // is the same as the error query command.
      const errorResult = getErrorMessage(msg.slice(1));
      result.messages.push(...errorResult.messages);
      remainder = errorResult.remainder;
      break;
    }

    default: {
      // Everything else needs to be fully interpreted as an ASCII message.
      // Command responses may be fixed or variable length, usually with an
      // indicator of how many to expect.
      const handled = cmdSet.callMessageHandler(msg, sentCommand);
      result.messages.push(...handled.messages);
      result.messageIncomplete = handled.messageIncomplete;
      result.messageMatchedExpectedCommand = handled.messageMatchedExpectedCommand;
      remainder = handled.remainder;

      break;
    }
  }

  // Put the remainder message back into its native format.
  result.remainder = Cmds.asTargetMessageType(remainder, message);
  return result;
}
