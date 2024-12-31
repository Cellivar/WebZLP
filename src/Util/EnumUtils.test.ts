import { expect, describe, it } from 'vitest';
import { exhaustiveMatchGuard, hasFlag } from './EnumUtils.js';

describe('hasFlag', () => {
  enum testEnum {
    zero = 0,
    one,
  }
  it('Has the flag', () => {
    expect(hasFlag(testEnum.one, testEnum.one)).toBe(true);
  });
  it('Does not have flag', () => {
    expect(hasFlag(testEnum.one, 5)).toBe(false);
  });
});

describe('exhaustiveMatchGuard', () => {
  it('Only allows never', () => {
    expect(() => {exhaustiveMatchGuard(false as never); }).toThrow();
  })
})
