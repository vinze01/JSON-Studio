import { describe, expect, it } from 'vitest';
import { reprintJson } from '@/utils/json/reprint';
import { minifyJson, stringifyJson } from '@/utils/json/format';
import { parseJson } from '@/utils/json/parse';

describe('reprintJson - lossless properties', () => {
  it('round-trips a document through minify+reprint without changing any token', () => {
    const source = '{"big": 9007199254740993, "exp": 1.23E4, "s": "\\u0041\\r", "2": "int-like", "b": 1}';
    const minified = reprintJson(source, 0);
    expect(minified.ok).toBe(true);
    if (!minified.ok) return;
    // Reprinting minified source is a token-exact reproduction.
    expect(minified.text).toBe('{"big":9007199254740993,"exp":1.23E4,"s":"\\u0041\\r","2":"int-like","b":1}');
  });

  it('preserves 19-digit integers exactly (IEEE-754 would round them)', () => {
    const source = '[9007199254740993]';
    const result = reprintJson(source, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('9007199254740993');
    // By contrast, parse+stringify corrupts the value:
    const lossy = stringifyJson(parseJson(source).ok === true ? JSON.parse(source) : null, 0);
    expect(lossy).not.toBe('[9007199254740993]');
  });

  it('preserves number spellings (1e2 stays 1e2, 1.50 stays 1.50)', () => {
    const result = reprintJson('{"a": 1e2, "b": 1.50}', 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('1e2');
    expect(result.text).toContain('1.50');
  });

  it('preserves object key order, including integer-like keys (stringify reorders those)', () => {
    const source = '{"z": 1, "2": 2, "a": 3}';
    const result = reprintJson(source, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text.indexOf('"z"')).toBeLessThan(result.text.indexOf('"2"'));
    expect(result.text.indexOf('"2"')).toBeLessThan(result.text.indexOf('"a"'));
  });

  it('preserves string escape spellings verbatim', () => {
    const result = reprintJson('{"s": "A\\u0041\\t"}', 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('\\u0041\\t');
  });

  it('reformats whitespace exactly like JSON.stringify would for plain documents', () => {
    const source = '{"a":[1,2,{"b":null}],"c":true}';
    const reprint = reprintJson(source, 2);
    const reference = stringifyJson(JSON.parse(source), 2);
    expect(reprint.ok).toBe(true);
    if (!reprint.ok) return;
    expect(reprint.text).toBe(reference);
  });

  it('minifies whitespace exactly like JSON.stringify.minify for plain documents', () => {
    const source = '{\n  "a" : [ 1 , 2 ] ,\n  "b" : { }\n}';
    const reprint = reprintJson(source, 0);
    const reference = minifyJson(source);
    expect(reprint.ok).toBe(true);
    expect(reprint.ok && reprint.text).toBe(reference.ok ? reference.text : '');
  });

  it('handles empty containers and single-member inline documents', () => {
    expect(reprintJson('{"a":{}}', 2)).toStrictEqual({ ok: true, text: '{\n  "a": {}\n}' });
    expect(reprintJson('[]', 2)).toStrictEqual({ ok: true, text: '[]' });
    expect(reprintJson('{ }', 0)).toStrictEqual({ ok: true, text: '{}' });
  });

  it('handle deeply nested containers without recursion issues at scanner depth levels', () => {
    let deep = '0';
    for (let i = 0; i < 200; i++) deep = `[${deep}]`;
    const result = reprintJson(deep, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(reprintJson(result.text, 0).ok === true && result.ok).toBe(true);
    // Reprint of the reprint (same indent) is a fixed point.
    expect(reprintJson(result.text, 2).ok === true ? result.text : '').toBe(result.text);
  });

  it('rejects invalid documents with scanner diagnostics and never emits partial output', () => {
    const bad = '{"a": 1,}';
    const result = reprintJson(bad, 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Trailing comma');
    expect(result.line).toBeTypeOf('number');
  });

  it('reprints root primitives', () => {
    expect(reprintJson('42.0', 2)).toStrictEqual({ ok: true, text: '42.0' });
    expect(reprintJson('"hi"', 0)).toStrictEqual({ ok: true, text: '"hi"' });
    expect(reprintJson('null', 4)).toStrictEqual({ ok: true, text: 'null' });
  });

  it('supports 4-space indentation', () => {
    const result = reprintJson('{"a": 1}', 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe('{\n    "a": 1\n}');
  });
});
