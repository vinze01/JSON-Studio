/**
 * Maps a syntax error to the exact text slice that should be highlighted in
 * the editor. Kept pure so it is unit-testable independent of the editor.
 */
import type { JsonDiagnostic } from '@/types';

export interface HighlightRange {
  start: number;
  end: number;
}

/** Hard cap so a malformed region can never flood the editor with highlight. */
const MAX_RANGE = 64;

/**
 * Computes the inclusive-exclusive text range to highlight for a diagnostic.
 *
 * - "Expected ':' after the property name" highlights the whole key plus the
 *   gap up to the reported offset — the reader sees the key that lacks its
 *   colon.
 * - Every other failure (trailing comma, unclosed string, stray token, bad
 *   bracket …) falls back to a token window: the previous token's start
 *   through the next token's end, bounded to keep the highlight readable.
 * Returns null when a range cannot be established.
 */
export function errorHighlightRange(
  text: string,
  diagnostic: Pick<JsonDiagnostic, 'offset' | 'message'>,
): HighlightRange | null {
  if (text.length === 0) return null;
  const offset = clamp(diagnostic.offset, 0, text.length);

  if (diagnostic.message.startsWith("Expected ':'")) {
    return colonErrorRange(text, offset);
  }
  return tokenWindow(text, offset);
}

function colonErrorRange(text: string, offset: number): HighlightRange | null {
  // Walk back across the whitespace between the key and the failure point;
  // the last non-space character should be the key's closing quote.
  let back = Math.min(offset - 1, text.length - 1);
  while (back >= 0 && /\s/.test(text[back])) back--;
  if (back < 0 || text[back] !== '"') return tokenWindow(text, offset);

  // Find the opening quote of that key (unescaped-quote heuristic).
  let start = back - 1;
  while (start >= 0) {
    if (text[start] === '"' && text[start - 1] !== '\\') break;
    start--;
  }
  if (start < 0) start = Math.max(0, back - 32);
  // Extend the end to the position where the colon belongs (past the gap),
  // so the highlight covers the key and the gap but not the value.
  let end = offset;
  while (end < text.length && /\s/.test(text[end])) end++;
  if (end <= start) end = Math.min(start + 1, text.length);
  const range: HighlightRange = { start, end: Math.min(end, text.length) };
  if (range.end - range.start > MAX_RANGE * 4) range.end = range.start + MAX_RANGE * 4;
  return range;
}

/** Generic fallback: from the previous token's start to the next token's end. */
function tokenWindow(text: string, offset: number): HighlightRange | null {
  // Start: back up over whitespace to the last significant character, then to
  // the beginning of that token (bounded).
  let back = Math.min(offset - 1, text.length - 1);
  while (back >= 0 && /\s/.test(text[back])) back--;
  if (back < 0) {
    // Nothing before the failure - highlight from offset forward.
    const end = tokenEnd(text, offset);
    return { start: Math.min(offset, text.length - 1), end };
  }
  const tokenChars = new Set(['"', '}', ']', ',', ':']);
  let start = back;
  let walked = 0;
  while (start > 0 && walked < MAX_RANGE && !/\s/.test(text[start - 1])) {
    if (tokenChars.has(text[start - 1])) {
      break;
    }
    start--;
    walked++;
  }
  const end = tokenEnd(text, Math.max(offset, back + 1));
  return { start, end };
}

/** Extends to the end of the token at/after `from`, capped by MAX_RANGE. */
function tokenEnd(text: string, from: number): number {
  let end = Math.min(from, text.length);
  if (end < text.length && /\s/.test(text[end])) {
    // Land on the next token even when the offset itself sits on whitespace.
    while (end < text.length && /\s/.test(text[end])) end++;
  }
  let walked = 0;
  while (end < text.length && walked < MAX_RANGE && !/\s/.test(text[end])) {
    const ch = text[end];
    if (walked > 0 && (ch === '{' || ch === '[' || ch === '}' || ch === ']' || ch === ',' || ch === ':')) break;
    end++;
    walked++;
  }
  // Always include at least the failing character.
  return Math.max(end, Math.min(from + 1, text.length));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
