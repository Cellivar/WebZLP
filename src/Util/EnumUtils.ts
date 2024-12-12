
/** Determine if an enum has a given flag. */
export function hasFlag(val: number, flag: number) {
  // TODO: Figure out type safety in the face of TS's weird enum type support.
  return (val & flag) === flag;
}

export function exhaustiveMatchGuard(_: never): never {
  throw new Error('Invalid case received!' + _);
}
