import { expect, describe, it } from 'vitest';
import * as Msgs from './Messages.js';
import { AsciiCodeNumbers } from '../Util/ASCII.js';

describe('RawMessageTransformer', () => {
  it('combineMessages', () => {
    const t = new Msgs.RawMessageTransformer();
    expect(t.combineMessages(new Uint8Array([AsciiCodeNumbers.CR]), new Uint8Array([AsciiCodeNumbers.LF])))
      .toStrictEqual(new Uint8Array([AsciiCodeNumbers.CR, AsciiCodeNumbers.LF]));
    expect(t.combineMessages(new Uint8Array([]), new Uint8Array([AsciiCodeNumbers.LF])))
      .toStrictEqual(new Uint8Array([AsciiCodeNumbers.LF]));
  });
});

describe('StringMessageTransformer', () => {
  it('combineMessages', () => {
    const t = new Msgs.StringMessageTransformer();
    expect(t.combineMessages('\r', '\n'))
      .toStrictEqual('\r\n');
    expect(t.combineMessages('', '\n'))
      .toStrictEqual('\n');
  })
});

describe('Converters', () => {
  it('Uint8Array to String', () => {
    const expected = "This is my expected message!";
    const arr = Msgs.asUint8Array(expected);
    const result = Msgs.asString(arr);
    expect(result).toStrictEqual(expected);
  });
  it('String to Uint8Array', () => {
    const expected = new Uint8Array([AsciiCodeNumbers.CR, AsciiCodeNumbers.LF]);
    const arr = Msgs.asString(expected);
    const result = Msgs.asUint8Array(arr);
    expect(result).toStrictEqual(expected);
  })
})
