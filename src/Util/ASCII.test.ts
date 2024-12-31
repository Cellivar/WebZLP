import { expect, describe, it } from 'vitest';
import { asciiToDisplay, DecodeAscii, EncodeAscii, hex } from './ASCII.js';

describe('asciiToDisplay', () => {
  it('Encodes ascii as human legible output', () => {
    expect(asciiToDisplay(2, 69, 69, 3, 13, 10))
      .toMatchInlineSnapshot(`"0x02[STX], 0x45[E], 0x45[E], 0x03[ETX], 0x0d[CR], 0x0a[LF]"`);
  });

  it('Hex displays value as hex value', () => {
    expect(hex(155)).toMatchInlineSnapshot(`"0x9b"`);
  });
});

describe('Encode and Decode', () => {
  it('Encodes ASCII', () => {
    expect(EncodeAscii("hello\r\n")).toMatchInlineSnapshot(`
      Uint8Array [
        104,
        101,
        108,
        108,
        111,
        13,
        10,
      ]
    `);
  });

  it('Complains about non-ASCII', () => {
    expect(() => {EncodeAscii("🐁")}).toThrow();
  });

  it('Decodes ASCII', () => {
    expect(DecodeAscii(new Uint8Array([2, 69, 69, 3, 13, 10])))
      .toMatchInlineSnapshot(`
      "EE
      "
    `);
  });
});
