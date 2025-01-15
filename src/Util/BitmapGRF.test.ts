import { expect, describe, it } from 'vitest';

import {
  BitmapGRF,
  DitheringMethod,
  type ImageConversionOptions
} from './BitmapGRF.js';

import * as testImage1 from "./test_files/test_imgdata.json" with { type: 'json' }

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


  /**
   * Creates an `ImageData` object from a given `Uint8ClampedArray` and the size of the image it contains.
   *
   * @param array A `Uint8ClampedArray` containing the underlying pixel representation of the image.
   * @param width An `unsigned` `long` representing the width of the image.
   * @param height An `unsigned` `long` representing the height of the image. This value is optional: the height will be inferred from the array's size and the given width.
   */
  constructor(array: Uint8ClampedArray, width: number, height?: number)

  /**
   * Creates an `ImageData` object of a black rectangle with the given width and height.
   *
   * @param width An `unsigned` `long` representing the width of the image.
   * @param height An `unsigned` `long` representing the height of the image.
   */
  constructor(width: number, height: number)
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
        throw new RangeError("Source doesn't contain the exact number of pixels needed.");
      this._width = w;
      this._height = h;
      this._data = arr;
    } else {
      throw new TypeError('Wrong number of arguments provided.');
    }
  }
}

global.ImageData = ImageData;

function getImageDataInput(width: number, height: number, fill: number, alpha?: number) {
  const arr = new Uint8ClampedArray(width * height * 4);
  if (alpha != undefined && alpha != fill) {
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

function getImageDataInputAlternatingDots(width: number, height: number) {
  const arr = new Uint8ClampedArray(width * height * 4);
  let flip = 1;
  for (let i = 0; i < arr.length; i += 4) {
    flip = ~flip;
    const fill = flip * 255;
    arr[i + 0] = fill;
    arr[i + 1] = fill;
    arr[i + 2] = fill;
    arr[i + 3] = 255;
  }

  return arr;
}

function getSnap(filename: string) {
  return `./test_files/${filename}.ts.snap`;
}
function getImageDataFromFileJson() {
  const file = testImage1.default;
  return new ImageData(new Uint8ClampedArray(file.data), file.width);
}

const imageConversionOptions: ImageConversionOptions = {
  ditheringMethod: DitheringMethod.none,
  grayThreshold: 70,
  trimWhitespace: false
};

describe('BitmapGRF', () => {
  describe('RGBA Image Conversion', () => {
    it('Should downconvert transparent images correctly', () => {
      const imageData = new ImageData(getImageDataInput(8, 1, 0), 8, 1);
      const expected = new Uint8Array([(1 << 8) - 1]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(8);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });

    it('Should downconvert black images correctly', () => {
      const imageData = new ImageData(getImageDataInput(8, 1, 0, 255), 8, 1);
      const expected = new Uint8Array([0]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(8);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });

    it('Should downconvert white images correctly', () => {
      const imageData = new ImageData(getImageDataInput(8, 1, 255), 8, 1);
      const expected = new Uint8Array([(1 << 8) - 1]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(8);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });

    it('Should downconvert checkered images correctly', () => {
      const imageData = new ImageData(getImageDataInputAlternatingDots(8, 1), 8, 1);
      const expected = new Uint8Array([85]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(8);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });

    it('Should pad and downconvert transparent images correctly', () => {
      const imageData = new ImageData(getImageDataInput(5, 1, 0), 5, 1);
      const expected = new Uint8Array([(1 << 8) - 1]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(5);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });

    it('Should pad and downconvert black images correctly', () => {
      const imgWidth = 4;
      const imageData = new ImageData(getImageDataInput(imgWidth, 1, 0, 255), imgWidth, 1);
      const expected = new Uint8Array([(1 << imgWidth) - 1]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(4);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });

    it('Should pad and downconvert white images correctly', () => {
      const imgWidth = 4;
      const imageData = new ImageData(getImageDataInput(imgWidth, 1, 255), imgWidth, 1);
      const expected = new Uint8Array([(1 << 8) - 1]);
      const { monochromeData, imageWidth, imageHeight } = BitmapGRF['toMonochrome'](
        imageData.data,
        imageData.width,
        imageData.height,
        imageConversionOptions
      );
      const { grfData, bytesPerRow } = BitmapGRF['monochromeToGRF'](
        monochromeData,
        imageWidth,
        imageHeight
      );

      expect(imageWidth).toBe(4);
      expect(imageHeight).toBe(1);
      expect(bytesPerRow).toBe(1);
      expect(grfData).toEqual(expected);
    });
  });

  describe('RGBA Round Trip', () => {
    it('Should not modify white images round-trip to imageData', () => {
      const imageData = new ImageData(getImageDataInput(8, 1, 255, 255), 8, 1);
      const img = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: false });
      const outImageData = img.toImageData();

      expect(outImageData.data.length).toBe(8 * 4);
      expect(outImageData.height).toBe(1);
      expect(outImageData.width).toBe(8);
      expect(outImageData.data).toEqual(imageData.data);
    });

    it('Should not modify black images round-trip to imageData', () => {
      const imageData = new ImageData(getImageDataInput(8, 1, 0, 255), 8, 1);
      const img = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: false });
      const outImageData = img.toImageData();

      expect(outImageData.data.length).toBe(8 * 4);
      expect(outImageData.height).toBe(1);
      expect(outImageData.width).toBe(8);
      expect(outImageData.data).toEqual(imageData.data);
    });

    it('Should not modify pattern images round-trip to imageData', () => {
      // Alternating black and white pixels.
      const imageWidth = 16;
      const imageHeight = 2;
      const imageData = new ImageData(
        getImageDataInputAlternatingDots(imageWidth, imageHeight),
        imageWidth,
        imageHeight
      );
      const img = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: false });
      const outImageData = img.toImageData();

      expect(outImageData.data.length).toBe(imageWidth * imageHeight * 4);
      expect(outImageData.height).toBe(imageHeight);
      expect(outImageData.width).toBe(imageWidth);
      expect(outImageData.data).toEqual(imageData.data);
    });
  });

  describe('Whitespace Trimming', () => {
    it('Should trim to black pixels', () => {
      // A single black pixel, surrounded by white on all sides, 10 pixels wide.
      const imageData = new ImageData(
        new Uint8ClampedArray([
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        ]), 10, 3);
      const img = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: true });

      // Width will always be a multiple of 8 due to byte padding.
      expect(img.width).toBe(8);
      expect(img.height).toBe(1);
      expect(img.boundingBox.width).toBe(10);
      expect(img.boundingBox.height).toBe(3);
      expect(img.boundingBox.paddingTop).toBe(1);
      expect(img.boundingBox.paddingLeft).toBe(1);
      expect(img.boundingBox.paddingBottom).toBe(1);
      expect(img.boundingBox.paddingRight).toBe(1);
    });

    it('Should trim an all-white image', () => {
      // A completely white image
      const imageData = new ImageData(
        new Uint8ClampedArray([
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
          255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        ]), 10, 3);
      const img = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: true });

      // Width will always be a multiple of 8 due to byte padding.
      expect(img.width).toBe(8);
      expect(img.height).toBe(1);
      expect(img.boundingBox.width).toBe(10);
      expect(img.boundingBox.height).toBe(3);
      expect(img.boundingBox.paddingTop).toBe(0);
      expect(img.boundingBox.paddingLeft).toBe(0);
      expect(img.boundingBox.paddingBottom).toBe(2);
      expect(img.boundingBox.paddingRight).toBe(2);
    });

    it('Should not trim an all-black image', () => {
      const imageWidth = 16;
      const imageHeight = 3;
      const imageData = new ImageData(
        getImageDataInput(imageWidth, imageHeight, 0, 255),
        imageWidth,
        imageHeight
      );
      const img = BitmapGRF.fromCanvasImageData(imageData, { trimWhitespace: true });

      // Width will always be a multiple of 8 due to byte padding.
      expect(img.width).toBe(imageWidth);
      expect(img.height).toBe(imageHeight);
      expect(img.boundingBox.width).toBe(imageWidth);
      expect(img.boundingBox.height).toBe(imageHeight);
      expect(img.boundingBox.paddingTop).toBe(0);
      expect(img.boundingBox.paddingLeft).toBe(0);
      expect(img.boundingBox.paddingBottom).toBe(0);
      expect(img.boundingBox.paddingRight).toBe(0);
    });
  });

  describe('Raw binary output', () => {
    it('should transform an image correctly', () => {
      const imgData = getImageDataFromFileJson();
      const img = BitmapGRF.fromCanvasImageData(imgData);
      expect(img.toBinaryGRF()).toMatchFileSnapshot(getSnap("test_imgdata_binarygrf"));
    });
  });
});
