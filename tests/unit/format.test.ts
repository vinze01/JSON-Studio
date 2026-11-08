import { describe, expect, it } from 'vitest';
import {
  formatJson,
  innerSnippetJson,
  minifyJson,
  stringifyJson,
} from '@/utils/json/format';

const SOURCE = '{ "a": 1, "b": [true, null, "x\\\\n"], "c": { "d": -2.5e3 } }';

describe('formatJson', () => {
  it('formats with 2-space indentation', () => {
    const result = formatJson(SOURCE, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe('{\n  "a": 1,\n  "b": [\n    true,\n    null,\n    "x\\\\n"\n  ],\n  "c": {\n    "d": -2500\n  }\n}');
    }
  });

  it('formats with 4-space indentation', () => {
    const result = formatJson('[1]', 4);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe('[\n    1\n]');
  });

  it('preserves key order, types and array ordering', () => {
    const result = formatJson('{"z":1,"a":{"q":[1,"s",false,null]}}', 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(JSON.parse(result.text)).toEqual(JSON.parse('{"z":1,"a":{"q":[1,"s",false,null]}}'));
  });

  it('does not modify the input on disk', () => {
    const original = SOURCE;
    void formatJson(original, 2);
    expect(original).toBe(SOURCE);
  });

  it('surfaces parse errors without inventing corrections', () => {
    const result = formatJson('{"a":}', 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.line).toBeTypeOf('number');
    }
  });
});

describe('minifyJson', () => {
  it('removes insignificant whitespace', () => {
    const result = minifyJson('{ "a" : 1 , "b" : [ 2 , 3 ] }');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe('{"a":1,"b":[2,3]}');
  });

  it('returns errors for invalid input', () => {
    expect(minifyJson('nope').ok).toBe(false);
  });
});

describe('stringifyJson', () => {
  it('minifies with indent 0', () => {
    expect(stringifyJson({ a: 1 }, 0)).toBe('{"a":1}');
  });

  it('escapes control characters and unicode safely', () => {
    expect(stringifyJson({ s: 'a"b\\c\né😀' }, 0)).toBe('{"s":"a\\"b\\\\c\\né😀"}');
  });

  it('round-trips a document containing a large power of two', () => {
    // 2^53 is representable exactly as a double, so it survives the round trip.
    const parsed = JSON.parse('{"big":9007199254740992}') as { big: number };
    expect(stringifyJson(parsed, 2)).toBe('{\n  "big": 9007199254740992\n}');
  });
});

describe('innerSnippetJson', () => {
  it('copies object members without the outer braces, dedented one level', () => {
    expect(innerSnippetJson({ a: 1, b: [true] }, 2)).toBe('"a": 1,\n"b": [\n  true\n]');
  });

  it('copies array items without the outer brackets', () => {
    expect(innerSnippetJson([1, 2], 2)).toBe('1,\n2');
  });

  it('returns empty text for empty containers and the value itself for primitives', () => {
    expect(innerSnippetJson({}, 2)).toBe('');
    expect(innerSnippetJson([], 4)).toBe('');
    expect(innerSnippetJson('hello', 2)).toBe('"hello"');
    expect(innerSnippetJson(42, 2)).toBe('42');
    expect(innerSnippetJson(null, 2)).toBe('null');
  });
});
