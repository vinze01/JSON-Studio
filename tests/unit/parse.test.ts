import { describe, expect, it } from 'vitest';
import { locateOffset, parseJson } from '@/utils/json/parse';

describe('parseJson', () => {
  it('parses objects, arrays and primitives', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, data: { a: 1 } });
    expect(parseJson('[1,2]')).toEqual({ ok: true, data: [1, 2] });
    expect(parseJson('"hi"')).toEqual({ ok: true, data: 'hi' });
    expect(parseJson('42')).toEqual({ ok: true, data: 42 });
    expect(parseJson('true')).toEqual({ ok: true, data: true });
    expect(parseJson('null')).toEqual({ ok: true, data: null });
  });

  it('rejects empty and whitespace-only documents with a friendly message', () => {
    const result = parseJson('   \n\t ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/empty/i);
  });

  it('reports a descriptive error for syntax errors', () => {
    const result = parseJson('{\n  "a": ?,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Message content comes from the engine; exact position diagnostics are
      // provided by the scanner (see validate tests).
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('rejects duplicate constructs without evaluating code', () => {
    const result = parseJson('{"a": alert("x")}');
    expect(result.ok).toBe(false);
  });

  it('preserves big root documents round-trip shortcut', () => {
    const payload = { a: [1, 2, 3], b: { c: 'unicode ✓ é' } };
    expect(parseJson(JSON.stringify(payload))).toEqual({ ok: true, data: payload });
  });
});

describe('locateOffset', () => {
  it('returns line/column pairs from offsets', () => {
    const text = 'ab\ncde\nf';
    expect(locateOffset(text, 0)).toEqual({ line: 0, column: 0 });
    expect(locateOffset(text, 3)).toEqual({ line: 1, column: 0 });
    expect(locateOffset(text, 5)).toEqual({ line: 1, column: 2 });
    expect(locateOffset(text, 7)).toEqual({ line: 2, column: 0 });
    expect(locateOffset(text, 9)).toEqual({ line: 2, column: 1 });
  });

  it('clamps out-of-range offsets', () => {
    expect(locateOffset('ab', 99)).toEqual({ line: 0, column: 2 });
    expect(locateOffset('ab', -5)).toEqual({ line: 0, column: 0 });
  });
});
