import { AsciiCodeNumbers } from "./ASCII.js";

/**
 * Slice an array from the start to the first LF character, returning both pieces.
 *
 * If no LF character is found sliced will have a length of 0.
 *
 * CR characters are not removed if present!
 */
export function sliceToNewline(msg: Uint8Array): {
  sliced: Uint8Array,
  remainder: Uint8Array,
} {
  if (msg === undefined) {
    return {
      sliced: new Uint8Array(),
      remainder: new Uint8Array()
    }
  }
  
  const idx = msg.indexOf(AsciiCodeNumbers.LF);
  if (idx === -1) {
    return {
      sliced: new Uint8Array(),
      remainder: msg
    }
  }

  return {
    sliced: msg.slice(0, idx + 1),
    remainder: msg.slice(idx + 1),
  };
}

/** Slice a string from the start to the first CRLF or LF, returning both pieces. */
export function sliceToCRLF(msg: string): {
  sliced: string,
  remainder: string,
} {
  if (msg === undefined) {
    return {
      sliced: "",
      remainder: ""
    }
  }

  const cr = msg.indexOf('\r\n');
  if (cr !== -1) {
    return {
      sliced: msg.substring(0, cr),
      remainder: msg.substring(cr + 2)
    }
  }

  const lf = msg.indexOf('\n');
  if (lf !== -1) {
    return {
      sliced: msg.substring(0, lf),
      remainder: msg.substring(lf + 1)
    }
  }

  return {
    sliced: "",
    remainder: msg
  }
}
