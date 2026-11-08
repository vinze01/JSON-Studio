import { describe, expect, it } from 'vitest';
import {
  appendPointerSegment,
  buildPointer,
  decodePointer,
  escapePointerToken,
  resolvePointer,
  unescapePointerToken,
} from '@/utils/json/pointer';
import type { JsonValue } from '@/types';

describe('pointer encoding', () => {
  it('escapes ~ and / per RFC 6901', () => {
    expect(escapePointerToken('a/b')).toBe('a~1b');
    expect(escapePointerToken('a~b')).toBe('a~0b');
    expect(unescapePointerToken('a~1b')).toBe('a/b');
    expect(unescapePointerToken('a~0b')).toBe('a~b');
  });

  it('builds and decodes pointers round-trip', () => {
    const pointer = buildPointer(['users', 0, 'na/me~', 3]);
    expect(pointer).toBe('/users/0/na~1me~0/3');
    expect(decodePointer(pointer)).toEqual(['users', '0', 'na/me~', '3']);
  });

  it('builds the empty root pointer', () => {
    expect(buildPointer([])).toBe('');
    expect(decodePointer('')).toEqual([]);
    expect(decodePointer('/')).toEqual([]);
  });

  it('appends segments to parents', () => {
    expect(appendPointerSegment('', 'x')).toBe('/x');
    expect(appendPointerSegment('/a', 2)).toBe('/a/2');
  });
});

describe('resolvePointer', () => {
  const data: JsonValue = {
    users: [
      { name: 'a', tags: [] },
      { name: 'b', secret: { key: 'v/alue' } },
    ],
    empty: {},
  };

  it('resolves object keys and array indices', () => {
    expect(resolvePointer(data, '/users/1/name')).toBe('b');
    expect(resolvePointer(data, '/users/0')).toEqual({ name: 'a', tags: [] });
  });

  it('resolves keys containing escaped characters', () => {
    expect(resolvePointer(data, '/users/1/secret/key')).toBe('v/alue');
  });

  it('returns undefined for missing paths', () => {
    expect(resolvePointer(data, '/users/5')).toBeUndefined();
    expect(resolvePointer(data, '/nope')).toBeUndefined();
    expect(resolvePointer(data, '/users/0/name/x')).toBeUndefined();
  });

  it('resolves the root document', () => {
    expect(resolvePointer(data, '')).toBe(data);
    expect(resolvePointer('scalar', '')).toBe('scalar');
  });
});
