import { EplPrinterCommandSet, PrinterCommandLanguage } from '../../../src';
import { CompiledDocument } from '../../../src/Documents/Document';

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

  constructor(arr, w, h) {
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
    } else if (arguments.length === 3) {
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
  if (alpha != null && alpha != fill) {
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

describe('ConversationRgbaToMonochrome', () => {
  it('Converts white to 1', () => {
    const result = cmdSet['rgbaToMonochrome'](255, 255, 255, 255, 255, 200);
    const expected = 1;

    expect(result).toBe(expected);
  });
  it('Converts black to 0', () => {
    const result = cmdSet['rgbaToMonochrome'](0, 0, 0, 255, 255, 200);
    const expected = 0;

    expect(result).toBe(expected);
  });
  it('Converts transparent black to background white', () => {
    const result = cmdSet['rgbaToMonochrome'](0, 0, 0, 0, 255, 200);
    const expected = 1;

    expect(result).toBe(expected);
  });
  it('Converts transparent white to background white', () => {
    const result = cmdSet['rgbaToMonochrome'](255, 255, 255, 0, 255, 200);
    const expected = 1;

    expect(result).toBe(expected);
  });
  it('Converts transparent black to background black', () => {
    const result = cmdSet['rgbaToMonochrome'](0, 0, 0, 0, 0, 200);
    const expected = 0;

    expect(result).toBe(expected);
  });
  it('Converts transparent white to background black', () => {
    const result = cmdSet['rgbaToMonochrome'](255, 255, 255, 0, 0, 200);
    const expected = 0;

    expect(result).toBe(expected);
  });
});

describe('EplImageConversion', () => {
  it('Should downconvert transparent images correctly', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 0), 8, 1);
    const expected = new Uint8Array([(1 << 8) - 1]);
    const [bitmap, bitmapWidth, bitmapHeight] = cmdSet['imageDataToEplBitmap'](imageData);

    expect(bitmapWidth).toBe(8);
    expect(bitmapHeight).toBe(1);
    expect(bitmap).toEqual(expected);
  });

  it('Should downconvert black images correctly', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 0, 255), 8, 1);
    const expected = new Uint8Array([0]);
    const [bitmap, bitmapWidth, bitmapHeight] = cmdSet['imageDataToEplBitmap'](imageData);

    expect(bitmapWidth).toBe(8);
    expect(bitmapHeight).toBe(1);
    expect(bitmap).toEqual(expected);
  });

  it('Should downconvert white images correctly', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 255), 8, 1);
    const expected = new Uint8Array([(1 << 8) - 1]);
    const [bitmap, bitmapWidth, bitmapHeight] = cmdSet['imageDataToEplBitmap'](imageData);

    expect(bitmapWidth).toBe(8);
    expect(bitmapHeight).toBe(1);
    expect(bitmap).toEqual(expected);
  });

  it('Should pad and downconvert transparent images correctly', () => {
    const imageData = new ImageData(getImageDataInput(5, 1, 0), 5, 1);
    const expected = new Uint8Array([(1 << 8) - 1]);
    const [bitmap, bitmapWidth, bitmapHeight] = cmdSet['imageDataToEplBitmap'](imageData);

    expect(bitmapWidth).toBe(8);
    expect(bitmapHeight).toBe(1);
    expect(bitmap).toEqual(expected);
  });

  it('Should pad and downconvert black images correctly', () => {
    const imgWidth = 4;
    const imageData = new ImageData(getImageDataInput(imgWidth, 1, 0, 255), imgWidth, 1);
    const expected = new Uint8Array([(1 << imgWidth) - 1]);
    const [bitmap, bitmapWidth, bitmapHeight] = cmdSet['imageDataToEplBitmap'](imageData);

    expect(bitmapWidth).toBe(8);
    expect(bitmapHeight).toBe(1);
    expect(bitmap).toEqual(expected);
  });

  it('Should pad and downconvert white images correctly', () => {
    const imgWidth = 4;
    const imageData = new ImageData(getImageDataInput(imgWidth, 1, 255), imgWidth, 1);
    const expected = new Uint8Array([(1 << 8) - 1]);
    const [bitmap, bitmapWidth, bitmapHeight] = cmdSet['imageDataToEplBitmap'](imageData);

    expect(bitmapWidth).toBe(8);
    expect(bitmapHeight).toBe(1);
    expect(bitmap).toEqual(expected);
  });
});

describe('EplImageConversionToFullCommand', () => {
  it('Should convert blank images to valid command', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 0), 8, 1);
    const doc = new CompiledDocument(PrinterCommandLanguage.epl);
    const resultCmd = cmdSet['imageBufferToCmd'](imageData, doc);

    const expectedCmd = Uint8Array.from([
      ...new TextEncoder().encode('GW0,0,1,1,'),
      255,
      ...new TextEncoder().encode('\r\n')
    ]);

    expect(resultCmd).toEqual(expectedCmd);
  });

  it('Should apply offsets in command', () => {
    const imageData = new ImageData(getImageDataInput(8, 1, 0), 8, 1);
    const appliedOffset = 10;
    const doc = new CompiledDocument(PrinterCommandLanguage.epl);
    doc.horizontalOffset = appliedOffset;
    doc.verticalOffset = appliedOffset * 2;
    const resultCmd = cmdSet['imageBufferToCmd'](imageData, doc);

    const expectedCmd = Uint8Array.from([
      ...new TextEncoder().encode(`GW${appliedOffset},${appliedOffset * 2},1,1,`),
      255,
      ...new TextEncoder().encode('\r\n')
    ]);

    expect(resultCmd).toEqual(expectedCmd);
  });

  it('Should return noop for blank imageData', () => {
    const doc = new CompiledDocument(PrinterCommandLanguage.epl);
    const resultCmd = cmdSet['imageBufferToCmd'](null, doc);

    expect(resultCmd).toEqual(new Uint8Array());
  });
});
