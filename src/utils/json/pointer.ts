/**
 * JSON Pointer (RFC 6901) helpers.
 *
 * Pointers are used throughout the app as stable node identifiers, keys use
 * `~0`/`~1` escaping so identifiers stay unambiguous even when property names
 * contain `/` or `~`.
 */
import type { JsonValue } from '@/types';

export function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function unescapePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Builds a pointer string from already-decoded path segments. */
export function buildPointer(segments: ReadonlyArray<string | number>): string {
  if (segments.length === 0) return '';
  return `/${segments.map((segment) => escapePointerToken(String(segment))).join('/')}`;
}

/** Appends a single segment to an existing encoded pointer. */
export function appendPointerSegment(parent: string, segment: string | number): string {
  const token = escapePointerToken(String(segment));
  return parent === '' ? `/${token}` : `${parent}/${token}`;
}

/** Decodes a pointer back into its raw path segments. */
export function decodePointer(pointer: string): string[] {
  if (pointer === '' || pointer === '/') return [];
  return pointer
    .slice(1)
    .split('/')
    .map((token) => unescapePointerToken(token));
}

/** Resolves a pointer against a parsed JSON value. */
export function resolvePointer(data: JsonValue, pointer: string): JsonValue | undefined {
  const segments = decodePointer(pointer);
  let current: JsonValue = data;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      const record = current as { [key: string]: JsonValue };
      if (!Object.prototype.hasOwnProperty.call(record, segment)) return undefined;
      current = record[segment];
    } else {
      return undefined;
    }
  }
  return current;
}
