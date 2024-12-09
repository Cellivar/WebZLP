import { expect, describe, it } from 'vitest';
import * as Cmds from "../../Commands/index.js"
import { getErrorMessage } from './ErrorMessage.js';

function getResult(
  msg: Cmds.IErrorMessage,
  messageIncomplete = false,
  messageMatchedExpectedCommand = true,
  remainder = ""): Cmds.IMessageHandlerResult<string> {
  return {
    messageIncomplete,
    messageMatchedExpectedCommand,
    remainder,
    messages: [msg]
  }
}

describe('getErrorMessage', () => {
  it('Handles no error', () => {
    const msg = '00\r\n';
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      NoError: true
    }));
  });

  it('Handles error 01', () => {
    const msg = '01\r\n';
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      CommandSyntaxError: true,
    }));
  })

  it('Handles error 10', () => {
    const msg = '10\r\n';
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      NotInDataEntryMode: true,
    }));
  })

  it('Handles error 07 with no unprinted label number', () => {
    const msg = '07\r\n';
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      PaperEmptyError: true,
      RibbonEmptyError: true
    }));
  });

  it('Handles error 07 with unprinted labels', () => {
    const msg = '07P123\r\n';
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      PaperEmptyError: true,
      RibbonEmptyError: true,
      UnprintedLabels: 123,
    }));
  });

  it('Handles error 07 with unprinted labels and lines', () => {
    const msg = '07P123L54321\r\n';
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      PaperEmptyError: true,
      RibbonEmptyError: true,
      UnprintedLabels: 123,
      UnprintedRasterLines: 54321
    }));
  });

  it('Returns remainder past error message', () => {
    const msg = "00\r\n05\r\n";
    expect(getErrorMessage(msg)).toEqual(getResult({
      messageType: 'ErrorMessage',
      NoError: true
    },
  false, true, "05\r\n"));
  })
});
