import { describe, expect, it } from 'vitest';
import { searchJson } from '@/utils/json/search';
import type { JsonValue } from '@/types';

const data: JsonValue = {
  users: [
    { name: 'Alice Anderson', age: 30, tags: ['admin', 'beta tester'] },
    { name: 'bob', age: 41, active: false },
  ],
  'config/maxRetries': 5,
  meta: null,
};

describe('searchJson', () => {
  it('finds keys case-insensitively by default, in document order', () => {
    const { matches } = searchJson(data, { query: 'NAME' });
    expect(matches.map((match) => match.pointer)).toEqual([
      '/users/0/name',
      '/users/1/name',
    ]);
    expect(matches.every((match) => match.kind === 'key')).toBe(true);
  });

  it('finds string values case-insensitively', () => {
    const { matches } = searchJson(data, { query: 'alice anderson' });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.pointer).toBe('/users/0/name');
    expect(matches[0]?.kind).toBe('value');
  });

  it('can restrict to keys only', () => {
    const { matches } = searchJson(data, { query: 'alice', matchValues: false });
    expect(matches).toHaveLength(0);
  });

  it('can restrict to values only', () => {
    const { matches } = searchJson(data, { query: 'name', matchKeys: false });
    expect(matches).toHaveLength(0);
  });

  it('matches numbers and booleans by their text form', () => {
    expect(searchJson(data, { query: '30' }).matches.map((m) => m.pointer)).toEqual(['/users/0/age']);
    expect(searchJson(data, { query: 'true' }).matches.map((m) => m.pointer)).toEqual([]);
    expect(searchJson(data, { query: 'false' }).matches.map((m) => m.pointer)).toEqual(['/users/1/active']);
    expect(searchJson(data, { query: 'null' }).matches.map((m) => m.pointer)).toEqual(['/meta']);
  });

  it('honors case-sensitive mode', () => {
    expect(searchJson(data, { query: 'alice', caseSensitive: true }).matches).toHaveLength(0);
    expect(searchJson(data, { query: 'Alice', caseSensitive: true }).matches).toHaveLength(1);
  });

  it('escapes special characters in pointers', () => {
    const { matches } = searchJson(data, { query: 'maxretries' });
    expect(matches[0]?.pointer).toBe('/config~1maxRetries');
  });

  it('returns no matches for empty queries', () => {
    expect(searchJson(data, { query: '' }).matches).toEqual([]);
    expect(searchJson(data, { query: '*' }).matches).toEqual([]);
  });

  it('truncates at the limit and reports it', () => {
    const { matches, truncated } = searchJson(data, { query: 'e', limit: 2 });
    expect(matches).toHaveLength(2);
    expect(truncated).toBe(true);
  });
});
