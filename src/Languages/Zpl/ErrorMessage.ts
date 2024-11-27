import * as Cmds from "../../Commands/index.js"

export function getErrorMessage(
  msg: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _?: Cmds.IPrinterCommand
): Cmds.IMessageHandlerResult<string> {
  const result: Cmds.IMessageHandlerResult<string> = {
    messageIncomplete: false,
    messageMatchedExpectedCommand: false,
    messages: [],
    remainder: msg,
  }
  const errorMsg: Cmds.IErrorMessage = {
    messageType: 'ErrorMessage'
  }

  result.messages.push(errorMsg);
  return result;
}
