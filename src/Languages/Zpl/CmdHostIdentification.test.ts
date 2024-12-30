import { expect, describe, it } from 'vitest';
import { AsciiCodeStrings } from '../../Util/ASCII.js';
import { CmdHostIdentification, parseCmdHostIdentification } from './CmdHostIdentification.js';

describe('parseCmdHostIdentification', () => {
  const cmd = new CmdHostIdentification();

  it('ZD410 Standard', () => {
    const msg = `${AsciiCodeStrings.STX}ZD410-200dpi,V84.20.18Z,8,8192KB${AsciiCodeStrings.ETX}\r\n`;
    expect(parseCmdHostIdentification(msg, cmd)).toMatchInlineSnapshot(`
      {
        "messageIncomplete": false,
        "messageMatchedExpectedCommand": true,
        "messages": [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "firmware": "V84.20.18Z",
            },
            "printerMedia": {},
          },
        ],
        "remainder": "",
      }
    `);
  });

  it('LP2844-Z Standard', () => {
    const msg = `${AsciiCodeStrings.STX}LP2844-Z,V45.11.7Z   ,8,8192KB${AsciiCodeStrings.ETX}\r\n`;
    expect(parseCmdHostIdentification(msg, cmd)).toMatchInlineSnapshot(`
      {
        "messageIncomplete": false,
        "messageMatchedExpectedCommand": true,
        "messages": [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "firmware": "V45.11.7Z",
            },
            "printerMedia": {},
          },
        ],
        "remainder": "",
      }
    `);
  });

  it('ZP505 Standard', () => {
    const msg = `${AsciiCodeStrings.STX}ZP 500 (ZPL)-200dpi,ZSP-002281B,8,2104KB${AsciiCodeStrings.ETX}\r\n`;
    expect(parseCmdHostIdentification(msg, cmd)).toMatchInlineSnapshot(`
      {
        "messageIncomplete": false,
        "messageMatchedExpectedCommand": true,
        "messages": [
          {
            "messageType": "SettingUpdateMessage",
            "printerHardware": {
              "firmware": "ZSP-002281B",
            },
            "printerMedia": {},
          },
        ],
        "remainder": "",
      }
    `);
  });
});
