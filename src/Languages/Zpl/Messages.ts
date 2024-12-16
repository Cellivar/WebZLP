import * as Conf from '../../Configs/index.js';
import * as Cmds from '../../Commands/index.js';
import { CmdXmlQuery, parseCmdXmlQueryResponse } from "./CmdXmlQuery.js";
import { CmdHostIdentification, parseCmdHostIdentification } from './CmdHostIdentification.js';
import { CmdHostQuery, parseCmdHostQuery } from './CmdHostQuery.js';
import { CmdHostStatus, parseCmdHostStatus } from './CmdHostStatus.js';
import { CmdHostConfig, parseCmdHostConfig } from './CmdHostConfig.js';

const messageHandlerMap = new Map<symbol | Cmds.CommandType, Cmds.MessageHandlerDelegate<string>>([
  [CmdXmlQuery.typeE, parseCmdXmlQueryResponse], // ~HZ command
  [CmdHostIdentification.typeE, parseCmdHostIdentification], // ~HI command
  [CmdHostQuery.typeE, parseCmdHostQuery], // ~HQ command
  [CmdHostStatus.typeE, parseCmdHostStatus], // ~HS command
  [CmdHostConfig.typeE, parseCmdHostConfig], // ^HH command
]);

export function handleMessage<TReceived extends Conf.MessageArrayLike>(
  message: TReceived,
  sentCommand?: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<TReceived> {
  const result: Cmds.IMessageHandlerResult<TReceived> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: message,
  }
  const msg = Cmds.asString(message).trimStart();
  let remainder = msg;
  if (msg === undefined || msg.length === 0) { return result; }

  // Analyzing the first byte of the message can tell us more about it.
  const firstByte = msg.at(0)
  if (firstByte === undefined) { return result; }

  // ZPL shows obvious signs of having been organically grown over time instead
  // of being designed. Understandable for a command language in active use for
  // over 30 years. The earliest manuals I can easily find are from the mid-90s.

  // There are multiple, overlapping, conflicting ways to request information
  // about a printer and, important for us, the format of the response message.
  // This generally means we must know what we asked the printer to properly
  // figure out what the message content is.

  // These are the most interesting commands that reply
  // ~HB - Host Battery      - STX Packet
  // ~HS - Host status       - STX Packet, 3 (!) of them
  // ~HQ - Host query        - STX multiline, subcommand dependent
  // ~HD - Head Diagnostic   - Raw text dump
  // ^HH - Host config label - Raw text dump
  // ~HT - Font links        - Raw text dump
  // ~HU - ZebraNet Alerts   - Raw text dump
  // ~HI - Host Ident        - Raw single line
  // ~HM - Host Memory       - Raw single line
  // ^HV - Host verification - Special field value format
  // ^HW - Host dir list     - don't even ask
  // ^HZ - Host XML print    - XML! It's just XML! Hooray!
  // ~HL - RFID Log          - Special log format

  // However there are also commands that may end up generating unpromted
  // responses from the printer. We need to check for these first!
  // ~RV - RFID Verify Log   - Special format after every RFID encode!

  switch (true) {
    case (/^_[+-],\d_/gim.test(msg)): {
      // ~RV enables a response format after encoding a tag
      // _+,3_       - Successful encode after VOIDing 3 labels
      // _-,2_       - Failed encode after VOIDing 2 labels
      // This will be sent after every print.
      const rfidMsg = handleRfidResult(msg);
      result.messages.push(...rfidMsg.messages)
      remainder = rfidMsg.remainder;
      break;
    }

    default: {
      // Everything else needs to be fully interpreted, and we need to know the
      // command that was sent to trigger the message.
      const handled = Cmds.getMessageHandler(messageHandlerMap, msg, sentCommand);
      result.messages.push(...handled.messages);
      result.messageIncomplete = handled.messageIncomplete;
      result.messageMatchedExpectedCommand = handled.messageMatchedExpectedCommand;
      remainder = handled.remainder;

      break;
    }
  }

  // Put the remainder message back into its native format.
  if (typeof result.remainder === "string") {
    result.remainder = Cmds.asString(remainder) as TReceived;
  } else if (result.remainder instanceof Uint8Array) {
    result.remainder = remainder as TReceived;
  } else {
    throw new Error("Unknown message type not implemented!");
  }
  return result;
}

// TODO: Move into separate handler at some point
function handleRfidResult(msg: string): Cmds.IMessageHandlerResult<string> {
  const msgEnd = msg.indexOf("_", 3); // Closing underscore
  const msgResult = msg.substring(0, msgEnd + 1);

  const update: Cmds.IStatusMessage = {
    messageType: 'StatusMessage',
    rfid: {
      voidedCount: Number(msg.replaceAll(/[^\d]/g, ''))
    }
  }

  if (msgResult.indexOf("+") > 0) {
    update.rfid!.encodeSuccessful = true;
  }
  if (msgResult.indexOf("-") > 0) {
    update.rfid!.encodeSuccessful = false;
  }

  return {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [update],
    remainder: msg.substring(msgEnd),
  };
}
