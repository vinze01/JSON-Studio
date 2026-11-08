import { describe, expect, it } from 'vitest';
import { scanJson } from '@/utils/json/validate';

describe('scanJson happy paths', () => {
  const cases = [
    '{}',
    '[]',
    '""',
    '42',
    '-1.5e+10',
    'true',
    'null',
    '{"a:1":"x"}',
    '{"a": {"b": [1, 2, {"c": null}]}}',
    '"\\u0041\\u00e9\\n\\\\ \\""',
    '  \n {"a" : 1 } \n ',
  ];

  for (const [index, source] of cases.entries()) {
    it(`accepts case ${index}: ${source.slice(0, 30)}`, () => {
      const result = scanJson(source);
      expect(result.ok, JSON.stringify(result.error)).toBe(true);
      expect(result.error).toBeNull();
    });
  }

  it('reports nesting depth', () => {
    const result = scanJson('{"a":[1,{"b":[2]}]}');
    expect(result.ok).toBe(true);
    expect(result.info.maxDepth).toBe(4);
  });

  it('collects duplicate key findings with pointer paths', () => {
    const result = scanJson('{"a/b":1,"a/b":2,"c":3,"a/b":4}');
    expect(result.ok).toBe(true);
    expect(result.info.duplicateKeys).toEqual([{ pointer: '/a~1b', occurrences: 2 }]);
    expect(result.info.duplicateKeys).toHaveLength(1);
  });
});

describe('scanJson diagnostics', () => {
  interface Case {
    name: string;
    text: string;
    message: RegExp;
    line?: number;
    column?: number;
  }

  const cases: Case[] = [
    { name: 'empty', text: '', message: /empty/i, line: 0, column: 0 },
    { name: 'trailing comma object', text: '{"a":1,}', message: /trailing comma/i, line: 0, column: 7 },
    { name: 'trailing comma array', text: '[1,]', message: /trailing comma/i, line: 0, column: 3 },
    { name: 'missing comma between properties', text: '{"a":1 "b":2}', message: /expected ',' or '}'/i, line: 0 },
    { name: 'missing comma between items', text: '[1 2]', message: /expected ',' or ']'/i, line: 0 },
    { name: 'unclosed array', text: '[1,2', message: /end of input/i },
    { name: 'unclosed object', text: '{"a":', message: /end of input/i },
    { name: 'unclosed string', text: '"abc', message: /never closed/i },
    { name: 'unquoted key', text: '{a:1}', message: /property name in double quotes/i, line: 0, column: 1 },
    { name: 'single-quoted key', text: "{'a':1}", message: /property name in double quotes/i },
    { name: 'invalid escape', text: '"a\\xb"', message: /invalid escape/i },
    { name: 'bad unicode escape', text: '"\\u00zz"', message: /hexadecimal/i },
    { name: 'unexpected token after value', text: '42 42', message: /after the json document/i },
    { name: 'bare word', text: 'note', message: /unexpected token/i },
    { name: 'leading zero', text: '01', message: /leading zeros/i },
    { name: 'bad exponent', text: '1e', message: /exponent/i },
    { name: 'dot-start number', text: '.5', message: /unexpected character/i },
  ];

  for (const testCase of cases) {
    it(`explains: ${testCase.name}`, () => {
      const result = scanJson(testCase.text);
      expect(result.ok).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toMatch(testCase.message);
      if (testCase.line !== undefined) expect(result.error?.line).toBe(testCase.line);
      if (testCase.column !== undefined) expect(result.error?.column).toBe(testCase.column);
    });
  }

  it('explains multiline errors at the right position', () => {
    const result = scanJson('{\n  "a": 1,\n  "b": ,\n}');
    expect(result.ok).toBe(false);
    expect(result.error?.line).toBe(2);
    expect(result.error?.column).toBe(7);
  });
});

describe('scanJson info signals', () => {
  it('counts numbers that exceed double precision', () => {
    const result = scanJson('[12345678901234567890, 1.1234567890123456789, 42]');
    expect(result.ok).toBe(true);
    expect(result.info.precisionNotes).toBe(2);
  });

  it('guards against excessive nesting', () => {
    const deep = '['.repeat(2500) + ']'.repeat(2500);
    const result = scanJson(deep);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/nesting depth/i);
  });
});
