import { it, expect, describe } from 'vitest';
import { clampToRange, numberInRange, repeat } from './NumericRange.js';

describe("clampToRange", () => {
  it('high number is clamped down', () => {
    expect(clampToRange(5, 0, 2)).toBe(2);
  });

  it('low number is clamped up', () => {
    expect(clampToRange(-1, 0, 5)).toBe(0);
  });

  it('in-range number is not modified', () => {
    expect(clampToRange(3, 0, 5)).toBe(3);
  });
});

describe('numberInRange', () => {
  it('Returns numbers in the range', () => {
    expect(numberInRange("1", 0, 2)).toBe(1);
    expect(numberInRange("-1", -5, 5)).toBe(-1);
    expect(numberInRange("0", 0, 0)).toBe(0);
  });
  it('Returns undefined for out of range', () => {
    expect(numberInRange("nope")).toBe(undefined);
    expect(numberInRange("-1", 0)).toBe(undefined);
    expect(numberInRange("0", -2, -1)).toBe(undefined);
    expect(numberInRange("5", 6, 4)).toBe(undefined);
  });
});

describe('repeat', () => {
  it('Repeats', () => {
    expect(repeat("a", 5)).toStrictEqual(["a", "a", "a", "a", "a"]);
  })
})
