type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc['length']]>;

export type NumericRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;

export type Percent = NumericRange<0, 101>;

/** Clamp a number to a given range of values. */
export function clampToRange(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Return a number if it's within an inclusive range, otherwise return the default. */
export function numberInRange(
  str: string,
  min?: number,
  max?: number) {
  if (!/^\d+$/.test(str)) {
    return;
  }
  const val = Number(str);
  if (min !== undefined && val < min) {
    return;
  }
  if (max !== undefined && val > max) {
    return;
  }
  return val;
}

export function repeat<T>(val: T, count: number) {
  return new Array(count).fill(val) as T[];
}
