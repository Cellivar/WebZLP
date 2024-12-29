import { expect, describe, it } from 'vitest';
import { AsciiCodeStrings } from '../../Util/ASCII.js';
import { CmdHostStatus, parseCmdHostStatus } from './CmdHostStatus.js';
import { ErrorStateSet, type IErrorMessage } from '../../Commands/Messages.js';

describe('parseCmdHostStatus', () => {
  const msg = `${AsciiCodeStrings.STX}014,0,0,0633,000,0,0,0,000,0,0,0${AsciiCodeStrings.ETX}\r\n` +
              `${AsciiCodeStrings.STX}000,0,0,0,0,2,6,0,00000000,1,000${AsciiCodeStrings.ETX}\r\n` +
              `${AsciiCodeStrings.STX}1234,0${AsciiCodeStrings.ETX}\r\n`;
  it('Parses a valid message', () => {
    expect(parseCmdHostStatus(msg, new CmdHostStatus())).toEqual({
      messageIncomplete: false,
      messageMatchedExpectedCommand: true,
      messages: [
        {
          messageType: "SettingUpdateMessage"
        },
        {
          messageType: "StatusMessage"
        },
        {
          messageType: "ErrorMessage",
          errors: new ErrorStateSet()
        } as IErrorMessage
      ],
      remainder: "",
    })
  });

  it('Handles noisy messages', () => {
    expect(parseCmdHostStatus(`hello\r\n${msg}`, new CmdHostStatus()).remainder)
      .toBe("hello\r\n");
    expect(parseCmdHostStatus(`${msg}hello\r\n`, new CmdHostStatus()).remainder)
      .toBe("hello\r\n");
    expect(parseCmdHostStatus(`hello\r\n`, new CmdHostStatus()).remainder)
      .toBe("hello\r\n");
    expect(parseCmdHostStatus(`${AsciiCodeStrings.STX}014,0`, new CmdHostStatus()).remainder)
      .toBe(`${AsciiCodeStrings.STX}014,0`);
  });
});
