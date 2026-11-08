/**
 * Lossless JSON reprinter.
 *
 * JSON.parse/JSON.stringify is lossy in three observable ways:
 *  1. IEEE-754 doubles round: a 19-digit integer typed as `9007199254740993`
 *     comes back as `9007199254740992` after a format/minify round trip.
 *  2. The number *spelling* is lost: `1e2`, `1E2`, and `100` all collapse.
 *  3. Object keys are reordered: JSON.stringify moves integer-like keys
 *     ("2", "42") to the front in ascending order.
 *
 * The reprinter fixes all three by walking the *source text* of an already
 * validated document and reprinting every token verbatim - only whitespace,
 * indentation, and separators change. Strings keep their original escape
 * spellings (`\r`, `\u0041`) exactly as written.
 *
 * This is the enforcement arm of the Integrity Report: not only do we flag
 * precision-risk numbers, we can also guarantee the output never damages them.
 *
 * Input must be valid JSON; invalid documents are rejected with the scanner's
 * diagnostics, never partially reprinted.
 */
import type { FormattingResult } from '@/types';
import { scanJson } from './validate';

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/** Copies a string literal verbatim; returns the index after the closing quote. */
function copyString(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === 0x5c) {
      i += 2; // escape sequences were validated by the scanner
      continue;
    }
    if (code === 0x22) return i + 1;
    i++;
  }
  throw new Error('reprint: unterminated string');
}

/** Copies a number literal verbatim (JSON number grammar, pre-validated). */
function copyNumber(text: string, start: number): number {
  let i = start;
  if (text[i] === '-') i++;
  const digitsStart = i;
  while (i < text.length && text[i]! >= '0' && text[i]! <= '9') i++;
  if (i === digitsStart) throw new Error('reprint: malformed number');
  if (text[i] === '.') {
    i++;
    const fractionStart = i;
    while (i < text.length && text[i]! >= '0' && text[i]! <= '9') i++;
    if (i === fractionStart) throw new Error('reprint: malformed number');
  }
  if (text[i] === 'e' || text[i] === 'E') {
    i++;
    if (text[i] === '+' || text[i] === '-') i++;
    const exponentStart = i;
    while (i < text.length && text[i]! >= '0' && text[i]! <= '9') i++;
    if (i === exponentStart) throw new Error('reprint: malformed number');
  }
  return i;
}

/** Copies a literal keyword (`true`, `false`, `null`) verbatim. */
function copyKeyword(text: string, start: number): number {
  for (const word of ['true', 'false', 'null']) {
    if (text.startsWith(word, start)) return start + word.length;
  }
  throw new Error('reprint: malformed literal');
}

class Reprinter {
  private readonly source: string;
  private out: string = '';
  private pos: number = 0;
  private depth: number = 0;

  constructor(source: string, private readonly indent: 0 | 2 | 4) {
    this.source = source;
  }

  run(): string {
    this.reprintValue();
    return this.out;
  }

  private skipWhitespace(): void {
    const { source } = this;
    while (this.pos < source.length && WHITESPACE.has(source[this.pos] as string)) {
      this.pos++;
    }
  }

  private newline(): void {
    if (this.indent === 0) return;
    this.out += `\n${' '.repeat(this.indent).repeat(this.depth)}`;
  }

  private reprintValue(): void {
    const { source } = this;
    this.skipWhitespace();
    const char: string | undefined = source[this.pos];
    if (char === '{') {
      this.reprintObject();
    } else if (char === '[') {
      this.reprintArray();
    } else if (char === '"') {
      const end = copyString(source, this.pos);
      this.out += source.slice(this.pos, end);
      this.pos = end;
    } else if (char === 't' || char === 'f' || char === 'n') {
      const end = copyKeyword(source, this.pos);
      this.out += source.slice(this.pos, end);
      this.pos = end;
    } else if (char === '-' || (char !== undefined && char >= '0' && char <= '9')) {
      const end = copyNumber(source, this.pos);
      this.out += source.slice(this.pos, end);
      this.pos = end;
    } else {
      throw new Error(`reprint: unexpected token '${char ?? '<end>'}'`);
    }
  }

  private reprintObject(): void {
    const { source } = this;
    this.out += '{';
    this.pos++;
    this.depth++;
    this.skipWhitespace();
    if (source[this.pos] === '}') {
      this.out += '}';
      this.pos++;
      this.depth--;
      return;
    }
    while (true) {
      this.newline();
      this.skipWhitespace();
      if (source[this.pos] !== '"') {
        throw new Error("reprint: expected property name");
      }
      const keyEnd = copyString(source, this.pos);
      this.out += source.slice(this.pos, keyEnd);
      this.pos = keyEnd;
      this.skipWhitespace();
      if (source[this.pos] !== ':') throw new Error("reprint: expected ':'");
      this.pos++;
      this.out += this.indent === 0 ? ':' : ': ';
      this.reprintValue();
      this.skipWhitespace();
      const separator = source[this.pos];
      if (separator === ',') {
        this.out += ',';
        this.pos++;
        continue;
      }
      if (separator === '}') {
        this.pos++;
        this.depth--;
        this.newline();
        this.out += '}';
        return;
      }
      throw new Error("reprint: expected ',' or '}'");
    }
  }

  private reprintArray(): void {
    const { source } = this;
    this.out += '[';
    this.pos++;
    this.depth++;
    this.skipWhitespace();
    if (source[this.pos] === ']') {
      this.out += ']';
      this.pos++;
      this.depth--;
      return;
    }
    while (true) {
      this.newline();
      this.reprintValue();
      this.skipWhitespace();
      const separator = source[this.pos];
      if (separator === ',') {
        this.out += ',';
        this.pos++;
        continue;
      }
      if (separator === ']') {
        this.pos++;
        this.depth--;
        this.newline();
        this.out += ']';
        return;
      }
      throw new Error("reprint: expected ',' or ']'");
    }
  }
}

export function reprintJson(text: string, indent: 0 | 2 | 4): FormattingResult {
  const scan = scanJson(text);
  if (!scan.ok && scan.error !== null) {
    const { message, offset, line, column } = scan.error;
    return { ok: false, message, offset, line, column };
  }
  try {
    return { ok: true, text: new Reprinter(text, indent).run() };
  } catch {
    // Defensive: the scanner validated this text, so reprinting must succeed.
    // If it ever does not, fail closed rather than emit a damaged document.
    return { ok: false, message: 'Could not preserve the document while formatting.', offset: 0, line: 0, column: 0 };
  }
}
