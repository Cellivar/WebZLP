import { expect, describe, it } from 'vitest';
import * as Cmds from '../../Commands/index.js';
import { handleMessage } from './Messages.js';
import { AsciiCodeNumbers, AsciiCodeStrings, EncodeAscii } from '../../Util/ASCII.js';
import { EplPrinterCommandSet } from './EplPrinterCommandSet.js';

describe('handleMessage', () => {
  const cmdSet = new EplPrinterCommandSet();
  const cfg = new Cmds.PrinterConfig();
  it('ACK as status message', () => {
    const result = handleMessage(
      cmdSet,
      new Uint8Array([AsciiCodeNumbers.ACK, AsciiCodeNumbers.CR, AsciiCodeNumbers.LF]),
      cfg
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "messageType": "StatusMessage",
        },
      ]
    `);
  });

  it('DLE as status message', () => {
    const result = handleMessage(cmdSet,
      new Uint8Array([AsciiCodeNumbers.DLE, AsciiCodeNumbers.CR, AsciiCodeNumbers.LF]),
      cfg
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "labelWasTaken": true,
          "messageType": "StatusMessage",
        },
      ]
    `);
  });

  it('NAK as status message', () => {
    // Code 01 - Syntax error.
    const result = handleMessage(cmdSet,
      EncodeAscii(`${AsciiCodeStrings.NAK}01\r\n`),
      cfg
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "errors": Set {
            "CommandSyntaxError",
          },
          "messageType": "ErrorMessage",
        },
      ]
    `);
  });

  it('NAK with busy error', () => {
    // Code 50 - Syntax error.
    const result = handleMessage(cmdSet,
      EncodeAscii(`${AsciiCodeStrings.NAK}50\r\n`),
      cfg
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "errors": Set {
            "PrinterBusyProcessingPrintJob",
          },
          "messageType": "ErrorMessage",
        },
      ]
    `);
  })

  it('Extracts unprinted labels', () => {
    const result = handleMessage(cmdSet,
      `${AsciiCodeStrings.NAK}07P001\r\n`,
      cfg
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "errors": Set {
            "MediaEmptyError",
            "RibbonEmptyError",
          },
          "messageType": "ErrorMessage",
          "unprintedLabels": 1,
        },
      ]
    `);
  });

  it('Extracts unprinted labels and lines', () => {
    const result = handleMessage(cmdSet,
      `${AsciiCodeStrings.NAK}07P696L91234\r\n`,
      cfg
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "errors": Set {
            "MediaEmptyError",
            "RibbonEmptyError",
          },
          "messageType": "ErrorMessage",
          "unprintedLabels": 696,
          "unprintedRasterLines": 91234,
        },
      ]
    `);
  });
});
