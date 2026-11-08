import type { FormattingResult, JsonValue } from '@/types';
import { parseJson } from './parse';

/**
 * Serializes a parsed JSON value.
 *
 * Uses JSON.stringify exclusively - no reimplementation of escaping - which
 * preserves data types and produces standards-compliant output. `indent === 0`
 * minifies.
 */
export function stringifyJson(value: JsonValue, indent: 0 | 2 | 4): string {
  return JSON.stringify(value, null, indent === 0 ? undefined : indent);
}

export function formatJson(text: string, indent: 2 | 4): FormattingResult {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    const { message, offset, line, column } = parsed.error;
    return { ok: false, message, offset, line, column };
  }
  return { ok: true, text: stringifyJson(parsed.data, indent) };
}

export function minifyJson(text: string): FormattingResult {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    const { message, offset, line, column } = parsed.error;
    return { ok: false, message, offset, line, column };
  }
  return { ok: true, text: stringifyJson(parsed.data, 0) };
}

/**
 * Serializes the *contents* of a container without its outermost pairs of
 * braces/brackets ("inner JSON"): copying an object's members or an array's
 * items so they can be pasted inside another document. Primitives
 * round-trip to themselves.
 */
export function innerSnippetJson(value: JsonValue, indent: 2 | 4): string | null {
  if (typeof value !== 'object' || value === null) {
    return stringifyJson(value, indent);
  }
  const text = stringifyJson(value, indent);
  const lines = text.split('\n');
  if (lines.length < 3) return ''; // "[]" / "{}" have no contents
  // Drop the opening and closing wrapper lines, then remove one indent level.
  const body = lines.slice(1, -1);
  const pad = ' '.repeat(indent);
  if (body.every((line) => line === '' || line.startsWith(pad))) {
    return body.map((line) => line.slice(indent)).join('\n');
  }
  return body.join('\n');
}
