import { expect, describe, it } from 'vitest';
import { AsciiCodeNumbers } from './ASCII.js';
import { sliceToCRLF, sliceToNewline } from './StringUtils.js';

describe('sliceToNewline', () => {
  it('Finds a newline', () => {
    const msg = new Uint8Array([
      AsciiCodeNumbers.STX,
      AsciiCodeNumbers.LF,
      AsciiCodeNumbers.ETX
    ]);
    expect(sliceToNewline(msg)).toMatchInlineSnapshot(`
      {
        "remainder": Uint8Array [
          3,
        ],
        "sliced": Uint8Array [
          2,
          10,
        ],
      }
    `);
  });
  it('Handles no newlines gracefully', () => {
    expect(sliceToNewline(new Uint8Array())).toMatchInlineSnapshot(`
      {
        "remainder": Uint8Array [],
        "sliced": Uint8Array [],
      }
    `);
    expect(sliceToNewline(undefined!)).toMatchInlineSnapshot(`
      {
        "remainder": Uint8Array [],
        "sliced": Uint8Array [],
      }
    `);
  });
});

describe('sliceToCRLF', () => {
  it('Finds a newline', () => {
    expect(sliceToCRLF("hello\r\ngoodbye")).toMatchInlineSnapshot(`
      {
        "remainder": "goodbye",
        "sliced": "hello",
      }
    `);
    expect(sliceToCRLF("hello\ngoodbye")).toMatchInlineSnapshot(`
      {
        "remainder": "goodbye",
        "sliced": "hello",
      }
    `);
  });
  it('Handles no newlines', () => {
    expect(sliceToCRLF("hello")).toMatchInlineSnapshot(`
      {
        "remainder": "hello",
        "sliced": "",
      }
    `);
    expect(sliceToCRLF("")).toMatchInlineSnapshot(`
      {
        "remainder": "",
        "sliced": "",
      }
    `);
    expect(sliceToCRLF(undefined!)).toMatchInlineSnapshot(`
      {
        "remainder": "",
        "sliced": "",
      }
    `);
  });
});
