import { expect, describe, it } from 'vitest';
import { AsciiCodeStrings } from '../../Util/ASCII.js';
import { CmdHostStatus, parseCmdHostStatus } from './CmdHostStatus.js';

describe('parseCmdHostStatus', () => {
  it('Parses a valid message', () => {
    const msg = `${AsciiCodeStrings.STX}014,0,0,0633,000,0,0,0,000,0,0,0${AsciiCodeStrings.ETX}\r\n` +
                `${AsciiCodeStrings.STX}000,0,0,0,0,2,6,0,00000000,1,000${AsciiCodeStrings.ETX}\r\n` +
                `${AsciiCodeStrings.STX}1234,0${AsciiCodeStrings.ETX}\r\n`;
    expect(parseCmdHostStatus(msg, new CmdHostStatus())).toEqual({
      messageIncomplete: false,
      messageMatchedExpectedCommand: true,
      messages: [],
      remainder: "",
    })
  });
});
