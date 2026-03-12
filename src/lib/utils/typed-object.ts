/**
 * Type-safe Object.entries() that preserves key types.
 *
 * Only use on objects where you control all keys (module-level consts, enums).
 * Not safe for objects that may have extra properties at runtime.
 */
export function typedEntries<T extends Record<string, unknown>>(
  obj: T
): [keyof T, T[keyof T]][] {
  // eslint-disable-next-line @typescript/no-unsafe-type-assertion - this is safe because we control the keys
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}
