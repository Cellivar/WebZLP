import { test, expect, describe } from 'vitest';
import { clampToRange } from './NumericRange.js';

describe("clampToRange tests", () => {
  test('high number is clamped down', () => {
    expect(clampToRange(5, 0, 2)).toBe(2);
  });

  test('low number is clamped up', () => {
    expect(clampToRange(-1, 0, 5)).toBe(0);
  });

  test('in-range number is not modified', () => {
    expect(clampToRange(3, 0, 5)).toBe(3);
  });
});
