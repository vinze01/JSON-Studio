import { describe, expect, it } from 'vitest';
import { errorHighlightRange } from '@/utils/json/error-highlight';
import type { JsonDiagnostic } from '@/types';

function diag(offset: number, message: string): JsonDiagnostic {
  return { offset, message, line: 1, column: offset + 1 };
}

describe('errorHighlightRange', () => {
  it('highlights the key and the gap for missing-colon errors', () => {
    const text = '{"language" "Galician"}';
    const range = errorHighlightRange(text, diag(11, "Expected ':' after the property name."));
    expect(range).not.toBeNull();
    // Should cover `"language" ` — the key plus the missing-colon gap.
    expect(text.slice(range!.start, range!.end)).toBe('"language" ');
  });

  it('handles multiline input for the colon case', () => {
    const text = '{\n  "language" "Galician"\n}';
    // Scanner reports the position just past the key's closing quote.
    const range = errorHighlightRange(text, diag(14, "Expected ':' after the property name."));
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe('"language" ');
  });

  it('falls back to a token window for other errors', () => {
    const text = '{"items": [1, 2,], "name": "x"}';
    const range = errorHighlightRange(text, diag(17, "Trailing comma before ']' (JSON5 allows, RFC 8259 forbids)."));
    expect(range).not.toBeNull();
    expect(range!.start).toBeLessThanOrEqual(17);
    expect(range!.end).toBeGreaterThan(17);
    // The window never floods the document.
    expect(range!.end - range!.start).toBeLessThanOrEqual(130);
  });

  it('highlights an empty-document failure as null', () => {
    expect(errorHighlightRange('', diag(0, 'Unexpected end of input'))).toBeNull();
  });

  it('clamps offsets that fall outside the text', () => {
    const text = '{"a": 1';
    const range = errorHighlightRange(text, diag(999, "Unclosed container '{' opened here."));
    expect(range).not.toBeNull();
    expect(range!.start).toBeLessThan(text.length);
    expect(range!.end).toBeLessThanOrEqual(text.length);
  });

  it('returns at least one character even when the offset sits on whitespace', () => {
    const text = '{"a" : 1 ,}';
    const range = errorHighlightRange(text, diag(10, 'Unexpected token.'));
    expect(range).not.toBeNull();
    expect(range!.end).toBeGreaterThan(range!.start);
  });
});
