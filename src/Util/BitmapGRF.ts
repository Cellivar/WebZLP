import { exhaustiveMatchGuard } from './EnumUtils.js';
import type { Percent } from './NumericRange.js';
import { WebZlpError } from './WebZlpError.js';

/** Padding information for a trimmed image. */
export interface ImageBoundingBox {
  /** The total original width of the image, including padding. */
  width: number;
  /** The total original height of the image, including padding. */
  height: number;

  /** The number of pixels between the top of the box and the actual image. */
  paddingTop: number;
  /** The number of pixels between the right side of the box and the actual image. */
  paddingRight: number;
  /** The number of pixels between the bottom of the box and the actual image. */
  paddingBottom: number;
  /** The number of pixels between the left side of the box and the actual image. */
  paddingLeft: number;
}

/** Settings for converting an image to a GRF. */
export interface ImageConversionOptions {
  /** The threshold brightness below which to consider a pixel black. Defaults to 70. */
  grayThreshold?: Percent;
  /** Whether to trim whitespace around the image to reduce file size. Trimmed pixels will become padding in the bounding box. */
  trimWhitespace?: boolean;
  /** The dithering method to use when converting image to monochrome. */
  ditheringMethod?: DitheringMethod;
}

/** List of available dithering methods for converting images to black/white. */
export enum DitheringMethod {
  /** No dithering, cutoff with  used. */
  none
}

/** Represents a GRF bitmap file. */
export class BitmapGRF {
  private _bitmap: Uint8Array;

  private _width: number;
  /** Gets the actual width of the image file, not including any padding. */
  public get width() {
    return this._width;
  }

  private _height: number;
  /** Gets the actual height of the image file, not inlcuding any padding. */
  public get height() {
    return this._height;
  }

  private _bytesPerRow: number;
  /** Gets the number of bytes per row (width) of the image file. */
  public get bytesPerRow() {
    return this._bytesPerRow;
  }
  /** Gets the total number of uncompressed bytes of the image file. Usually used in printer commands. */
  public get bytesUncompressed() {
    return this._bitmap.length;
  }

  private _boundingBox: ImageBoundingBox;
  /** Gets the bounding box information for this image, for proper alignment of trimmed images. */
  public get boundingBox() {
    return this._boundingBox;
  }

  constructor(
    bitmapGRF: Uint8Array,
    imageWidth: number,
    imageHeight: number,
    bytesPerRow: number,
    boundingBox: ImageBoundingBox
  ) {
    this._bitmap = bitmapGRF;
    this._width = imageWidth;
    this._height = imageHeight;
    this._bytesPerRow = bytesPerRow;
    this._boundingBox = Object.freeze(boundingBox);
  }

  /** Create a copy of this bitmap. */
  public copy(): BitmapGRF {
    return new BitmapGRF(
      this._bitmap.slice(0),
      this._width,
      this._height,
      this._bytesPerRow,
      this.boundingBox
    )
  }

  /** Get a raw binary representation of this GRF. This is raw binary with no compression, compatible with EPL and ZPL.
   *
   * The image may need to be offset according to the bounding box padding. Use the bytesPerRow for data length calculations.
   *
   * Example use:
   * ```
   * const grf = new BitmapGRF();
   * const zplCmd = `^GFC,${grf.bytesUncompressed},${grf.bytesUncompressed},${grf.bytesPerRow},${grf.toBinaryGRF()}`;
   *
   * const eplCmd = `GW${grf.boundingBox.paddingLeft},${grf.boundingBox.paddingTop},${grf.bytesPerRow},${grf.height},${grf.toBitmapGRF}`;
   * ```
   */
  public toBinaryGRF(): Uint8Array {
    // Previous conversions have gotten the data into the right format. Send as-is.
    return this._bitmap;
  }

  /** Gets an ImageData representation of this GRF. Can be used to draw into Canvas elements. */
  public toImageData() {
    const buffer = new Uint8ClampedArray(this._bitmap.length * 4 * 8);
    for (let i = 0, n = this._bitmap.length; i < n; i++) {
      // High bit to low bit (left to right) in the bitmap byte.
      for (let offset = 7; offset >= 0; offset--) {
        const outOffset = (i * 8 * 4) + ((7 - offset) * 4);
        const pixel = ((this._bitmap[i] >> offset) & 1) === 1 ? 255 : 0;
        buffer[outOffset + 0] = pixel;
        buffer[outOffset + 1] = pixel;
        buffer[outOffset + 2] = pixel;
        buffer[outOffset + 3] = 255; // Always opaque alpha.
      }
    }

    return new ImageData(buffer, this.width, this.height);
  }

  /** Gets a bitmap GRF that has its colors inverted.
   *
   * EPL uses 1 as white. ZPL uses 1 as black. Use this to convert between them.
   */
  public toInvertedGRF(): BitmapGRF {
    const buffer = new Uint8Array(this._bitmap.length);
    for (let i = 0, n = this._bitmap.length; i < n; i++) {
      buffer[i] = ~this._bitmap[i];
    }

    return new BitmapGRF(
      buffer,
      this.width,
      this.height,
      this.bytesPerRow,
      structuredClone(this.boundingBox)
    );
  }

  /** Get a compressed representation of this GRF. This is not compatible with EPL.
   * This is also referred to as the "Alternate Compression Scheme" or "Zebra Compression".
   *
   * The image may need to be offset according to the bounding box.
   *
   * Example use:
   * ```
   * const grf = new BitmapGRF();
   * const cmd = `^GFA,${grf.bytesUncompressed},${grf.bytesUncompressed},${grf.bytesPerRow},${grf.toZebraCompressedGrf()}`;
   * ```
   */
  public toZebraCompressedGRF(): string {
    // Method (c) 2022 metafloor
    // https://github.com/metafloor/zpl-image/blob/491f4d6887294d71dcfa859957d43b3be28ce1e5/zpl-image.js

    // The Zebra ACS compression scheme is a form of run-length encoding. Sequential runs of values
    // are replaced with a marker for the length of the run. This is referred to in the documentation
    // alternatively as "Zebra Compression" and "Alternative Compression Scheme".
    // ZACS uses this encoding table:
    //
    // G   H   I   J   K   L   M   N   O   P   Q   R   S   T   U   V   W   X   Y
    // 1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19
    //
    // g   h   i   j   k   l   m   n   o   p   q   r   s   t   u   v   w   x   y   z
    // 20  40  60  80 100 120 140 160 180 200 220 240 260 280 300 320 340 360 380 400
    //
    const buf = this._bitmap;

    let hex = '';
    for (let i = 0, l = buf.length; i < l; i++) {
      hex += BitmapGRF.hexmap[buf[i]];
    }
    const re = /([0-9a-fA-F])\1{2,}/g;
    let acs = '';
    let match = re.exec(hex);
    let offset = 0;
    while (match) {
      acs += hex.substring(offset, match.index);
      let l = match[0].length;
      while (l >= 400) {
        acs += 'z';
        l -= 400;
      }
      if (l >= 20) {
        acs += '_ghijklmnopqrstuvwxy'[(l / 20) | 0];
        l = l % 20;
      }
      if (l) {
        acs += '_GHIJKLMNOPQRSTUVWXY'[l];
      }
      acs += match[1];
      offset = re.lastIndex;
      match = re.exec(hex);
    }
    acs += hex.substr(offset);
    return acs;
  }

  /**
   * Rotate the image, returning a new image.
   * @param angle The angle to rotate the image.
   */
  public rotate(angle: 0 | 180): BitmapGRF {
    switch (angle) {
      default:
        exhaustiveMatchGuard(angle);
        break;
      case 0:
        return this.copy();
      case 180:
        {
          const buf = Array(this._bitmap.length);
          for (let i = 0; i < this._bitmap.length; i++) {
            buf[this._bitmap.length - 1 - i] = BitmapGRF.revByte(this._bitmap[i]);
          }

          return new BitmapGRF(
            new Uint8Array(buf),
            this._width,
            this._height,
            this._bytesPerRow,
            this.boundingBox);
        }
    }
  }


  private static revByte(byte: number) {
    let x = byte;
    x = ((x >> 1) & 0x55555555) | ((x & 0x55555555) << 1);
    x = ((x >> 2) & 0x33333333) | ((x & 0x33333333) << 2);
    x = ((x >> 4) & 0x0F0F0F0F) | ((x & 0x0F0F0F0F) << 4);
    // stop after first 8 bits
    //x = ((x >> 8) & 0x00FF00FF) | ((x & 0x00FF00FF) << 8);
    //x = (x >>> 16) | (x << 16);

    return x >>> 0;
  }

  // TODO: ASCII-compressed formats are only supported on newer firmwares.
  // Implement feature detection into the transpiler operation to choose the most
  // appropriate compression format such as LZ77/DEFLATE compression for Z64.
  // public toAsciiB64(): string { }
  // public toAsciiZ64(): string { }

  /**
   * Create a GRF bitmap from a raw RGBA array-like object.
   */
  public static fromRGBA(
    data: Uint8Array | Uint8ClampedArray | Array<number>,
    width: number,
    imageOptions?: ImageConversionOptions
  ): BitmapGRF {
    const {
      grayThreshold = 70,
      trimWhitespace = true,
      ditheringMethod = DitheringMethod.none
    } = imageOptions ?? {};

    width = width | 0;
    if (!width || width < 0) {
      throw new BitmapFormatError('Image width must be provided for RGBA data.');
    }
    if (data.length % 4 !== 0) {
      throw new BitmapFormatError(`Array data is not a multiple of 4, is it RGBA data?`);
    }

    const height = ~~(data.length / width / 4);

    const { monochromeData, imageWidth, imageHeight, boundingBox } = this.toMonochrome(
      data,
      width,
      height,
      { grayThreshold, trimWhitespace, ditheringMethod }
    );

    const { grfData, bytesPerRow } = this.monochromeToGRF(
      monochromeData,
      imageWidth,
      imageHeight
    );

    return new BitmapGRF(grfData, bytesPerRow * 8, imageHeight, bytesPerRow, boundingBox);
  }

  /**
   * Create a GRF bitmap from a canvas ImageData object.
   * @param imageData The canvas ImageData object to convert.
   * @param grayThreshold The cutoff percentage below which values are considered black. Defaults to 75% of white.
   * @param trimWhitespace Trim image to save space, storing trim amounts in the bounding box.
   * @returns The bitmap GRF file.
   */
  public static fromCanvasImageData(
    imageData: ImageData,
    imageOptions?: ImageConversionOptions
  ): BitmapGRF {
    const {
      grayThreshold = 70,
      trimWhitespace = true,
      ditheringMethod = DitheringMethod.none
    } = imageOptions ?? {};
    // This property isn't supported in Firefox, so it isn't supported
    // in the lib types, and I don't feel like dealing with it right now
    // so TODO: fix this eventually
    //
    // Only supports sRGB as RGBA data.
    // if (imageData.colorSpace !== 'srgb') {
    //     throw new TranspileDocumentError(
    //         'Unknown color space for given imageData. Expected srgb but got ' +
    //             imageData.colorSpace
    //     );
    // }
    //
    // Proceed on assuming it's an RGBA bitmap of sRGB data.
    return this.fromRGBA(imageData.data, imageData.width, {
      grayThreshold,
      trimWhitespace,
      ditheringMethod
    });
  }

  /** Use an SVG string as a bitmap image, rendered at the width and height provided. */
  public static async fromSVG(
    svg: string,
    widthInDots: number,
    heightInDots: number,
    imageConversionOptions?: ImageConversionOptions
  ) {
    // Load in the SVG as a disconnected element to query its width and height.
    // Doens't matter that this is a foreign document, it won't be re-used.
    const tempcontainer = new Document().createElement('div');
    tempcontainer.innerHTML = svg;
    const svgElement = tempcontainer.firstChild as SVGSVGElement;
    if (svgElement?.tagName?.toLowerCase() !== "svg") {
      throw new BitmapFormatError(
        `The top-level element of the SVG file must be an <svg> tag, but got '${svgElement?.tagName}' instead.`
      );
    }
    svgElement.setAttribute('width', `${widthInDots}px`);
    svgElement.setAttribute('height', `${heightInDots}px`);
    svg = new XMLSerializer().serializeToString(svgElement);

    // The raw SVG can contain non-ASCII characters, so encode the URI and report as utf-8.
    const datauri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    const img = new Image(widthInDots, heightInDots);
    img.src = datauri;

    // Next render a canvas of the same size and load the SVG as a data URL.
    const ctx = new OffscreenCanvas(widthInDots, heightInDots).getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    await img.decode();
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, widthInDots, heightInDots);

    // Pass it through to the usual pipeline.
    return this.fromCanvasImageData(data, imageConversionOptions);
  }

  /** Convert a Base64 encoded PNG to a BitmapGRF. */
  public static async fromBase64PNG(
    png: string,
    imageConversionOptions?: ImageConversionOptions,
  ): Promise<BitmapGRF> {
    // Use an Image object as a parser for the PNG data
    const img = new Image();
    img.src = png;
    await img.decode();

    // And render it to an offscreen canvas to get its image data.
    const ctx = new OffscreenCanvas(img.width, img.height)
      .getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, img.width, img.height);

    return this.fromCanvasImageData(data, imageConversionOptions);
  }

  /** Converts monochrome data to GRF format. */
  private static monochromeToGRF(monochromeData: Uint8Array, width: number, height: number) {
    // Method (c) 2022 metafloor
    // https://github.com/metafloor/zpl-image/blob/491f4d6887294d71dcfa859957d43b3be28ce1e5/zpl-image.js

    const bytesPerRow = ~~((width + 7) / 8);
    const paddingToAdd = (8 - (width % 8)) % 8;
    const buffer = new Uint8Array(bytesPerRow * height);
    let idx = 0; // index into buf
    let byte = 0; // current byte of image data, default to white.
    let bitx = 0; // bit index
    for (let i = 0, n = monochromeData.length; i < n; i++) {
      byte |= monochromeData[i] << (7 - (bitx++ & 7));

      if (bitx == width || !(bitx & 7)) {
        if (bitx == width) {
          bitx = 0;
          byte |= (1 << paddingToAdd) - 1;
        }
        buffer[idx++] = byte;
        byte = 0;
      }
    }

    return { grfData: buffer, bytesPerRow };
  }

  /**
   * Converts an RGBA array to monochrome, 1-bit-per-byte.
   * This supports trimming the image to save space, and will remove whitespace
   * to an internal bounding box. The results of this padding are stored as the
   * bounding box information for the bitmap.
   */
  private static toMonochrome(
    rgba: Uint8Array | Uint8ClampedArray | Array<number>,
    width: number,
    height: number,
    { grayThreshold, trimWhitespace, ditheringMethod }: ImageConversionOptions
  ) {
    // Method (c) 2022 metafloor
    // https://github.com/metafloor/zpl-image/blob/491f4d6887294d71dcfa859957d43b3be28ce1e5/zpl-image.js

    // Convert black from percent to 0..255 value
    const threshold = (255 * (grayThreshold ?? 70)) / 100;

    // This is where we'd do some dithering, if we implemented anything other than none.
    if (ditheringMethod !== undefined && ditheringMethod !== DitheringMethod.none) {
      throw new WebZlpError(
        `Dithering method ${DitheringMethod[ditheringMethod]} is not supported.`
      );
    }

    let minx: number, maxx: number, miny: number, maxy: number;
    if (trimWhitespace !== true) {
      minx = miny = 0;
      maxx = width - 1;
      maxy = height - 1;
    } else {
      // Run through the image and determine bounding box
      maxx = maxy = 0;
      minx = width;
      miny = height;
      let x = 0,
        y = 0;
      for (let i = 0, n = width * height * 4; i < n; i += 4) {
        // Alpha blend with white.
        const gray = this.colorToGrayscale(
          rgba[i + 0],
          rgba[i + 1],
          rgba[i + 2],
          rgba[i + 3]
        );

        if (gray <= threshold) {
          if (minx > x) minx = x;
          if (miny > y) miny = y;
          if (maxx < x) maxx = x;
          if (maxy < y) maxy = y;
        }
        if (++x == width) {
          x = 0;
          y++;
        }
      }
    }

    let contentWidth: number;
    let contentHeight: number;
    let buffer: Uint8Array;
    if (minx > maxx || miny > maxy) {
      // Image is blank, return one white pixel in the top left.
      contentWidth = contentHeight = 1;
      minx = miny = 0;
      buffer = new Uint8Array([1]);
    } else {
      // One more time through the data, this time we create the cropped image.
      contentWidth = maxx - minx + 1;
      contentHeight = maxy - miny + 1;
      buffer = new Uint8Array(contentWidth * contentHeight);
      let idx = 0;
      for (let y = miny; y <= maxy; y++) {
        let i = (y * width + minx) * 4;
        for (let x = minx; x <= maxx; x++) {
          // Alpha blend with white.
          const gray = this.colorToGrayscale(
            rgba[i + 0],
            rgba[i + 1],
            rgba[i + 2],
            rgba[i + 3]
          );

          buffer[idx++] = gray >= threshold ? 1 : 0;
          i += 4;
        }
      }
    }

    return {
      monochromeData: buffer,
      imageWidth: contentWidth,
      imageHeight: contentHeight,
      boundingBox: {
        width: width,
        height: height,
        paddingLeft: minx,
        paddingTop: miny,
        paddingRight: width - (this.roundUpToByte(contentWidth) + minx),
        paddingBottom: height - (contentHeight + miny)
      }
    };
  }

  private static roundUpToByte(value: number) {
    return Math.ceil(value / 8) * 8;
  }

  private static colorToGrayscale(
    r: number,
    g: number,
    b: number,
    a: number,
    backgroundGray?: number
  ): number {
    backgroundGray = backgroundGray ?? 255.0;
    const alpha = a / 255.0;
    // Values from the Color FAQ: https://poynton.ca/notes/colour_and_gamma/ColorFAQ.html
    const red = Math.pow(r / 255.0, 2.2) * 0.2126;
    const blu = Math.pow(g / 255.0, 2.2) * 0.7152;
    const grn = Math.pow(b / 255.0, 2.2) * 0.0722;
    const gray = Math.pow(red + blu + grn, 0.454545) * 255;
    return ((1 - alpha) * backgroundGray) + (alpha * gray);
  }

  /** Lookup table for binary to hex values. */
  private static hexmap = (() => {
    const arr = Array(256);
    for (let i = 0; i < 16; i++) {
      arr[i] = '0' + i.toString(16);
    }
    for (let i = 16; i < 256; i++) {
      arr[i] = i.toString(16);
    }
    return arr;
  })();
}

/** Error indicating an issue with the provided image. */
export class BitmapFormatError extends WebZlpError {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
