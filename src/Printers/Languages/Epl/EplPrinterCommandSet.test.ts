import { expect, describe, it } from 'vitest';
import {
  AddImageCommand,
  EplPrinterCommandSet,
  TranspiledDocumentState
} from '../../index.js';
import { BitmapGRF } from '../../Documents/BitmapGRF.js';

// Class pulled from jest-mock-canvas which I can't seem to actually import.
class ImageData {
  _width = 0;
  _height = 0;
  _data: Uint8ClampedArray;
  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  get data() {
    return this._data;
  }

  get colorSpace() {
    return 'srgb' as PredefinedColorSpace;
  }

  constructor(arr: number | Uint8ClampedArray, w: number, h?: number) {
    if (arguments.length === 2) {
      if (arr instanceof Uint8ClampedArray) {
        if (arr.length === 0)
          throw new RangeError('Source length must be a positive multiple of 4.');
        if (arr.length % 4 !== 0)
          throw new RangeError('Source length must be a positive multiple of 4.');
        if (!Number.isFinite(w)) throw new RangeError('The width is zero or not a number.');
        if (w === 0) throw new RangeError('The width is zero or not a number.');
        this._width = w;
        this._height = arr.length / 4 / w;
        this._data = arr;
      } else {
        const width = arr;
        const height = w;
        if (!Number.isFinite(height)) throw new RangeError('The height is zero or not a number.');
        if (height === 0) throw new RangeError('The height is zero or not a number.');
        if (!Number.isFinite(width)) throw new RangeError('The width is zero or not a number.');
        if (width === 0) throw new RangeError('The width is zero or not a number.');
        this._width = width;
        this._height = height;
        this._data = new Uint8ClampedArray(width * height * 4);
      }
    } else if (arguments.length === 3 && h !== undefined) {
      if (!(arr instanceof Uint8ClampedArray))
        throw new TypeError('First argument must be a Uint8ClampedArray when using 3 arguments.');
      if (arr.length === 0) throw new RangeError('Source length must be a positive multiple of 4.');
      if (arr.length % 4 !== 0)
        throw new RangeError('Source length must be a positive multiple of 4.');
      if (!Number.isFinite(h)) throw new RangeError('The height is zero or not a number.');
      if (h === 0) throw new RangeError('The height is zero or not a number.');
      if (!Number.isFinite(w)) throw new RangeError('The width is zero or not a number.');
      if (w === 0) throw new RangeError('The width is zero or not a number.');
      if (arr.length !== w * h * 4)
        throw new RangeError("Source doesn'n contain the exact number of pixels needed.");
      this._width = w;
      this._height = h;
      this._data = arr;
    } else {
      throw new TypeError('Wrong number of arguments provided.');
    }
  }
}

function getImageDataInput(width: number, height: number, fill: number, alpha?: number) {
  const arr = new Uint8ClampedArray(width * height * 4);
  if (alpha !== undefined && alpha != fill) {
    for (let i = 0; i < arr.length; i += 4) {
      arr[i + 0] = fill;
      arr[i + 1] = fill;
      arr[i + 2] = fill;
      arr[i + 3] = alpha;
    }
  } else {
    arr.fill(fill);
  }
  return arr;
}

const cmdSet = new EplPrinterCommandSet();

describe('EPL Image Conversion', () => {
  it('Should convert blank images to valid command', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 0), 8, 1);
    const bitmap = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: false });
    const cmd = new AddImageCommand(bitmap, {});
    const doc = new TranspiledDocumentState();
    const resultCmd = cmdSet['addImageCommand'](cmd, doc);

    const expectedCmd = Uint8Array.from([
      ...new TextEncoder().encode('GW0,0,1,1,'),
      255,
      ...new TextEncoder().encode('\r\n')
    ]);

    expect(resultCmd).toEqual(expectedCmd);
  });

  it('Should apply offsets in command', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 0), 8, 1);
    const bitmap = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: false });
    const cmd = new AddImageCommand(bitmap, {});
    const appliedOffset = 10;
    const doc = new TranspiledDocumentState();
    doc.horizontalOffset = appliedOffset;
    doc.verticalOffset = appliedOffset * 2;
    const resultCmd = cmdSet['addImageCommand'](cmd, doc);

    const expectedCmd = Uint8Array.from([
      ...new TextEncoder().encode(`GW${appliedOffset},${appliedOffset * 2},1,1,`),
      255,
      ...new TextEncoder().encode('\r\n')
    ]);

    expect(resultCmd).toEqual(expectedCmd);
  });
});
