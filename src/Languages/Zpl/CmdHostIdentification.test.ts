import { expect, describe, it } from 'vitest';
import { AsciiCodeStrings } from '../../Util/ASCII.js';
import { CmdHostIdentification, parseCmdHostIdentification } from './CmdHostIdentification.js';

describe('parseCmdHostIdentification', () => {
  it('Parses a valid message', () => {
    const msg = `${AsciiCodeStrings.STX}LP2844-Z,V45.11.7Z   ,8,8192KB${AsciiCodeStrings.ETX}\r\n`;
    expect(parseCmdHostIdentification(msg, new CmdHostIdentification())).toEqual({
      messageIncomplete: false,
      messageMatchedExpectedCommand: true,
      messages: [{
        messageType: 'SettingUpdateMessage',
        printerHardware: {
          firmware: "V45.11.7Z"
        },
        printerMedia: {}
      }],
      remainder: "",
    });
  });
});
