import fs from 'fs';
import { expect, describe, it } from 'vitest';

describe('Files exist', () => {
  it('Files exist', () => {
    expect(ZD410_XML()).not.toBeUndefined();
  })
});

const tfPath = "./src/Languages/Zpl/test_files";

function getFile(filename: string) {
  return fs.readFileSync(`${tfPath}/${filename}`, { encoding: 'utf-8' });
}
function getSnap(filename: string) {
  return `./test_files/${filename}.ts.snap`;
}

export const ZD410_XML = () => getFile("ZD410.xml");
export const ZD410_FULL = getSnap("ZD410_FULL");
export const ZD410_TXT = () => getFile("ZD410.txt");
export const ZD410_CONF = getSnap("ZD410_CONF");
export const ZD410_CONF_REMAINDER = getSnap("ZD410_CONF_REMAINDER");

export const ZD411_XML = () => getFile("ZD411.xml");
export const ZD411_FULL = getSnap("ZD411_FULL");
export const ZD411_TXT = () => getFile("ZD411.txt");
export const ZD411_CONF = getSnap("ZD411_CONF");

export const ZP505_XML = () => getFile("ZP505.xml");
export const ZP505_FULL = getSnap("ZP505_FULL");
export const ZP505_TXT = () => getFile("ZP505.txt");
export const ZP505_CONF = getSnap("ZP505_CONF");

export const R2844_Z_XML = () => getFile("R2844_Z.xml");
export const R2844_Z_FULL = getSnap("R2844_Z_FULL");
export const R2844_Z_TXT = () => getFile("R2844_Z.txt");
export const R2844_Z_CONF = getSnap("R2844_Z_CONF");

export const LP2844_Z_XML = () => getFile("LP2844_Z.xml");
export const LP2844_Z_FULL = getSnap("LP2844_Z_FULL");
export const LP2844_Z_TXT = () => getFile("LP2844_Z.txt");
export const LP2844_Z_CONF = getSnap("LP2844_Z_CONF");

export const TLP2844_Z_XML = () => getFile("TLP2844_Z.xml");
export const TLP2844_Z_FULL = getSnap("TLP2844_Z_FULL");
export const TLP2844_Z_TXT = () => getFile("TLP2844_Z.txt");
export const TLP2844_Z_CONF = getSnap("TLP2844_Z_CONF");

export const LP2824PLUS_XML = () => getFile("LP2824PLUS.xml");
export const LP2824PLUS_FULL = getSnap("LP2824PLUS_FULL");
export const LP2824PLUS_TXT = () => getFile("LP2824PLUS.txt");
export const LP2824PLUS_CONF = getSnap("LP2824PLUS_CONF");
