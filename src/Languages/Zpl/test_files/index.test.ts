import fs from 'fs';
import { expect, describe, it } from 'vitest';

describe('Files exist', () => {
  it('Files exist', () => {
    expect(ZD410_XML()).not.toBeUndefined();
  })
})

export const ZD410_XML = () => {
  return fs.readFileSync('./src/Languages/Zpl/test_files/ZD410.xml', { encoding: 'utf-8'});
}
export const ZD410_FULL_SNAPSHOT = "./test_files/ZD410.ts.snap";

export const ZD410_TXT = () => {
  return fs.readFileSync('./src/Languages/Zpl/test_files/ZD410.txt', { encoding: 'utf-8'});
}
export const ZD410_CONF_REMAINDER = "./test_files/ZD410_CONF_REMAINDER.ts.snap";
