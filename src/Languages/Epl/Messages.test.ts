import { expect, describe, it } from 'vitest';
import { handleMessage } from './Messages.js';
import { AsciiCodeNumbers, AsciiCodeStrings, EncodeAscii } from '../../Util/ASCII.js';

describe('handleMessage', () => {
  it('ACK as status message', () => {
    const result = handleMessage(
      new Uint8Array([AsciiCodeNumbers.ACK, AsciiCodeNumbers.CR, AsciiCodeNumbers.LF])
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
    const result = handleMessage(
      new Uint8Array([AsciiCodeNumbers.DLE, AsciiCodeNumbers.CR, AsciiCodeNumbers.LF])
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
    const result = handleMessage(
      EncodeAscii(`${AsciiCodeStrings.NAK}01\r\n`)
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "CommandSyntaxError": true,
          "messageType": "ErrorMessage",
        },
      ]
    `);
  });

  it('NAK with busy error', () => {
    // Code 50 - Syntax error.
    const result = handleMessage(
      EncodeAscii(`${AsciiCodeStrings.NAK}50\r\n`)
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "PrinterBusyProcessingPrintJob": true,
          "messageType": "ErrorMessage",
        },
      ]
    `);
  })

  it('Extracts unprinted labels', () => {
    const result = handleMessage(
      `${AsciiCodeStrings.NAK}07P001\r\n`
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "PaperEmptyError": true,
          "RibbonEmptyError": true,
          "UnprintedLabels": 1,
          "messageType": "ErrorMessage",
        },
      ]
    `);
  });

  it('Extracts unprinted labels and lines', () => {
    const result = handleMessage(
      `${AsciiCodeStrings.NAK}07P696L91234\r\n`
    );
    expect(result.messages).toMatchInlineSnapshot(`
      [
        {
          "PaperEmptyError": true,
          "RibbonEmptyError": true,
          "UnprintedLabels": 696,
          "UnprintedRasterLines": 91234,
          "messageType": "ErrorMessage",
        },
      ]
    `);
  });
});
