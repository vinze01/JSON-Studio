import type { JsonValue, ParseResult } from '@/types';

/** Converts a character offset into a 0-based line/column pair. */
export function locateOffset(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.min(Math.max(offset, 0), text.length);
  let line = 0;
  let lastLineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lastLineStart = i + 1;
    }
  }
  return { line, column: clamped - lastLineStart };
}

/**
 * Parses JSON with the browser's native parser. Never mutates input, never
 * falls back to evaluation. Returns a descriptive error with position when
 * parsing fails.
 */
export function parseJson(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed === '') {
    return {
      ok: false,
      error: { message: 'Document is empty. Enter or import some JSON to continue.', offset: 0, line: 0, column: 0 },
    };
  }
  try {
    const data: JsonValue = JSON.parse(trimmed);
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Invalid JSON';
    const match = /\bposition (\d+)\b/.exec(message);
    // Offsets refer to the trimmed text; compensate for trimmed whitespace.
    const leading = text.length - text.trimStart().length;
    const offset = match ? Number(match[1]) + leading : leading;
    const { line, column } = locateOffset(text, offset);
    return { ok: false, error: { message, offset, line, column } };
  }
}
