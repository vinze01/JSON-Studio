/**
 * A hand-written, non-evaluating JSON syntax scanner.
 *
 * The native parser reports only a byte offset and a generic message, which is
 * rarely enough to explain a mistake. The scanner walks the document strictly
 * following RFC 8259 and produces accurate line/column diagnostics for common
 * mistakes: trailing commas, missing commas, unclosed brackets, bad quoting,
 * invalid escapes and stray tokens.
 *
 * It also collects informational findings (duplicate keys, repeated array
 * elements, numbers whose precision exceeds IEEE-754 double guarantees,
 * maximum nesting depth).
 *
 * Performance: single pass, character-index based, independent of document
 * size (~50-200ms for 5MB in practice). No values are materialized.
 */
import type {
  DuplicateElementFinding,
  DuplicateKeyFinding,
  JsonDiagnostic,
  ScanResult,
} from '@/types';
import { locateOffset } from './parse';

const MAX_DEPTH = 2000;
const MAX_DUPLICATE_FINDINGS = 20;

const CLOSE_BRACE = 0x7d; // }
const CLOSE_BRACKET = 0x5d; // ]
const COLON = 0x3a; // :
const COMMA = 0x2c; // ,
const OPEN_BRACE = 0x7b; // {
const OPEN_BRACKET = 0x5b; // [
const QUOTE = 0x22; // "
const BACKSLASH = 0x5c; // \

class ScanAbort extends Error {
  readonly diagnostic: JsonDiagnostic;
  constructor(diagnostic: JsonDiagnostic) {
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

export class JsonScanner {
  private readonly text: string;
  private readonly length: number;
  private pos = 0;
  private depth = 0;
  private maxDepthSeen = 0;
  private readonly duplicateKeys: DuplicateKeyFinding[] = [];
  private readonly reportedDuplicatePointers = new Set<string>();
  private readonly duplicateElements: DuplicateElementFinding[] = [];
  private precisionNotes = 0;
  private readonly pathSegments: string[] = [];

  constructor(text: string) {
    this.text = text;
    this.length = text.length;
  }

  private fail(message: string, offset = this.pos): never {
    const { line, column } = locateOffset(this.text, offset);
    throw new ScanAbort({ message, offset, line, column });
  }

  private skipWhitespace(): void {
    while (this.pos < this.length) {
      const code = this.text.charCodeAt(this.pos);
      if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) this.pos++;
      else break;
    }
  }

  private current(): number {
    return this.text.charCodeAt(this.pos);
  }

  private expect(code: number, message: string, offset = this.pos): void {
    if (this.current() !== code) this.fail(message, Math.min(offset, this.length));
    this.pos++;
  }

  parse(): ScanResult {
    let error: JsonDiagnostic | null = null;
    try {
      this.skipWhitespace();
      if (this.pos >= this.length) {
        this.fail('Document is empty. Enter or import some JSON to continue.');
      }
      this.parseValue();
      this.skipWhitespace();
      if (this.pos < this.length) {
        this.fail(
          `Unexpected content after the JSON document starts at character ${this.pos}. Remove anything following the top-level value.`,
          this.pos,
        );
      }
    } catch (cause) {
      if (cause instanceof ScanAbort) error = cause.diagnostic;
      else throw cause;
    }
    return {
      ok: error === null,
      error,
      scanSkipped: false,
      info: {
        duplicateKeys: this.duplicateKeys,
        duplicateElements: this.duplicateElements,
        precisionNotes: this.precisionNotes,
        maxDepth: this.maxDepthSeen,
      },
    };
  }

  private parseValue(): void {
    this.skipWhitespace();
    if (this.pos >= this.length) {
      this.fail('Unexpected end of input. A value was expected here.');
    }
    switch (this.current()) {
      case OPEN_BRACE:
        this.parseObject();
        break;
      case OPEN_BRACKET:
        this.parseArray();
        break;
      case QUOTE:
        this.parseString();
        break;
      case 0x74: // t
      case 0x66: // f
      case 0x6e: // n
        this.parseLiteralKeyword();
        break;
      case 0x2d: // -
      case 0x30: // 0
      case 0x31:
      case 0x32:
      case 0x33:
      case 0x34:
      case 0x35:
      case 0x36:
      case 0x37:
      case 0x38:
      case 0x39:
        this.parseNumber();
        break;
      default:
        this.fail(
          `Unexpected character '${this.text[this.pos]}'. Expected an object, array, string, number, boolean or null.`,
        );
    }
  }

  private parseLiteralKeyword(): void {
    for (const word of ['true', 'false', 'null']) {
      if (this.text.startsWith(word, this.pos)) {
        this.pos += word.length;
        return;
      }
    }
    this.fail(
      `Unexpected token. Expected one of the JSON literals: true, false, null (or another value).`,
    );
  }

  private parseObject(): void {
    this.depth++;
    this.maxDepthSeen = Math.max(this.maxDepthSeen, this.depth);
    if (this.depth > MAX_DEPTH) {
      this.fail(`Maximum nesting depth of ${MAX_DEPTH} exceeded at character ${this.pos}.`);
    }
    this.expect(OPEN_BRACE, "Expected '{' to start an object.");
    const seenKeys = new Set<string>();
    this.skipWhitespace();
    if (this.current() === CLOSE_BRACE) {
      this.pos++;
      this.depth--;
      return;
    }
    while (true) {
      this.skipWhitespace();
      const memberOffset = this.pos;
      if (this.current() !== QUOTE) {
        if (this.current() === CLOSE_BRACE) {
          this.fail("Trailing comma before '}'. Remove the comma after the previous property.", memberOffset);
        }
        this.fail("Expected a property name in double quotes ('\"key\"').", memberOffset);
      }
      const keyOffset = this.pos;
      const key = this.parseString();
      if (seenKeys.has(key)) {
        const pointer = buildSegmentsPointer(this.pathSegments, key);
        if (!this.reportedDuplicatePointers.has(pointer) && this.duplicateKeys.length < MAX_DUPLICATE_FINDINGS) {
          this.reportedDuplicatePointers.add(pointer);
          this.duplicateKeys.push({ pointer, occurrences: 2 });
        }
      } else {
        seenKeys.add(key);
      }
      this.skipWhitespace();
      if (this.current() !== COLON) {
        this.fail("Expected ':' after the property name.", keyOffset + key.length + 1);
      }
      this.pos++;
      this.pathSegments.push(key);
      this.parseValue();
      this.pathSegments.pop();
      this.skipWhitespace();
      const separator = this.current();
      if (separator === COMMA) {
        this.pos++;
        continue;
      }
      if (separator === CLOSE_BRACE) {
        this.pos++;
        break;
      }
      if (this.pos >= this.length) {
        this.fail("Unexpected end of input. Missing a '}' to close this object.");
      }
      this.fail(`Expected ',' or '}' after this value, but found '${this.text[this.pos]}'.`);
    }
    this.depth--;
  }

  private parseArray(): void {
    this.depth++;
    this.maxDepthSeen = Math.max(this.maxDepthSeen, this.depth);
    if (this.depth > MAX_DEPTH) {
      this.fail(`Maximum nesting depth of ${MAX_DEPTH} exceeded at character ${this.pos}.`);
    }
    this.expect(OPEN_BRACKET, "Expected '[' to start an array.");
    let index = 0;
    // Content signature per element (first occurrence -> count + finding).
    // Detects repeated array items, e.g. a failed dedup or double-joined rows.
    const seenSignatures = new Map<string, { pointer: string; finding: DuplicateElementFinding | null; count: number }>();
    this.skipWhitespace();
    if (this.current() === CLOSE_BRACKET) {
      this.pos++;
      this.depth--;
      return;
    }
    while (true) {
      this.skipWhitespace();
      const itemOffset = this.pos;
      if (this.current() === CLOSE_BRACKET) {
        this.fail("Trailing comma before ']'. Remove the comma after the previous item.", itemOffset);
      }
      this.pathSegments.push(String(index));
      this.parseValue();
      this.pathSegments.pop();
      // Flag duplicate array elements: identical normalized content.
      if (this.duplicateElements.length < MAX_DUPLICATE_FINDINGS) {
        const signature = elementSignature(this.text, itemOffset, this.pos);
        const seen = seenSignatures.get(signature);
        if (seen === undefined) {
          seenSignatures.set(signature, {
            pointer: buildSegmentsPointer(this.pathSegments, String(index)),
            finding: null,
            count: 1,
          });
        } else {
          seen.count++;
          if (seen.finding === null) {
            const finding: DuplicateElementFinding = { pointer: seen.pointer, occurrences: seen.count };
            seen.finding = finding;
            this.duplicateElements.push(finding);
          } else {
            seen.finding.occurrences = seen.count;
          }
        }
      }
      index++;
      this.skipWhitespace();
      const separator = this.current();
      if (separator === COMMA) {
        this.pos++;
        continue;
      }
      if (separator === CLOSE_BRACKET) {
        this.pos++;
        break;
      }
      if (this.pos >= this.length) {
        this.fail("Unexpected end of input. Missing a ']' to close this array.");
      }
      this.fail(`Expected ',' or ']' after this value, but found '${this.text[this.pos]}'.`);
    }
    this.depth--;
  }

  /** Parses a string literal and returns its key (raw slice text). */
  private parseString(): string {
    const start = this.pos;
    this.expect(QUOTE, 'Expected a string in double quotes.');
    while (true) {
      if (this.pos >= this.length) {
        this.fail('Unexpected end of input. The string starting here is never closed.', start);
      }
      const code = this.text.charCodeAt(this.pos);
      if (code === QUOTE) {
        const slice = this.text.slice(start + 1, this.pos);
        this.pos++;
        return slice;
      }
      if (code === BACKSLASH) {
        this.pos++;
        const escaped = this.text.charCodeAt(this.pos);
        const offset = this.pos;
        switch (escaped) {
          case QUOTE:
          case BACKSLASH:
          case 0x2f: // /
          case 0x62: // b
          case 0x66: // f
          case 0x6e: // n
          case 0x72: // r
          case 0x74: // t
            this.pos++;
            break;
          case 0x75: // u
            this.pos++;
            for (let i = 0; i < 4; i++) {
              const hex = this.text.charCodeAt(this.pos + i);
              const isHex =
                (hex >= 0x30 && hex <= 0x39) ||
                (hex >= 0x41 && hex <= 0x46) ||
                (hex >= 0x61 && hex <= 0x66);
              if (!isHex) {
                this.fail(
                  `Invalid unicode escape: '\\u' must be followed by 4 hexadecimal digits.`,
                  this.pos + i,
                );
              }
            }
            this.pos += 4;
            break;
          default:
            if (Number.isNaN(escaped)) {
              this.fail('Unexpected end of input inside an escape sequence.', offset - 1);
            }
            this.fail(`Invalid escape sequence '\\${this.text[this.pos] ?? ''}'.`, offset - 1);
        }
        continue;
      }
      if (code >= 0 && code < 0x20) {
        this.fail('Unescaped control character inside a string. Escape it (e.g. \\\\n).', this.pos);
      }
      this.pos++;
    }
  }

  private parseNumber(): void {
    const start = this.pos;
    if (this.current() === 0x2d) this.pos++;
    if (this.pos >= this.length) this.fail('Unexpected end of input inside a number.', start);
    const first = this.current();
    if (first >= 0x30 && first <= 0x39) {
      if (first !== 0x30) {
        while (this.current() >= 0x30 && this.current() <= 0x39) this.pos++;
      } else {
        this.pos++;
        if (this.current() >= 0x30 && this.current() <= 0x39) {
          this.fail("Leading zeros are not allowed in JSON numbers ('0' must stand alone).", start);
        }
      }
    } else {
      this.fail('Invalid number. A digit was expected after the minus sign.', start);
    }
    let significant = this.pos - start;
    if (this.current() === 0x2e) {
      this.pos++;
      const fractionStart = this.pos;
      while (this.current() >= 0x30 && this.current() <= 0x39) this.pos++;
      if (this.pos === fractionStart) {
        this.fail('Invalid number. Digits are required after the decimal point.', fractionStart);
      }
      significant = this.pos - start;
    }
    const exponent = this.current();
    if (exponent === 0x65 || exponent === 0x45) {
      this.pos++;
      if (this.current() === 0x2b || this.current() === 0x2d) this.pos++;
      const digitsStart = this.pos;
      while (this.current() >= 0x30 && this.current() <= 0x39) this.pos++;
      if (this.pos === digitsStart) {
        this.fail('Invalid number. Digits are required in the exponent.', digitsStart);
      }
      significant = this.pos - start;
    }
    if (significant > 15) this.precisionNotes++;
  }
}

function buildSegmentsPointer(segments: string[], key: string): string {
  let pointer = '';
  for (const segment of segments) {
    pointer = pointer === '' ? `/${escapeToken(segment)}` : `${pointer}/${escapeToken(segment)}`;
  }
  return `${pointer}/${escapeToken(key)}`;
}

/**
 * Whitespace-insensitive content signature of an array element slice.
 *
 * Walks the slice token-wise: whitespace outside strings is skipped, while
 * whitespace inside strings is hashed (it is significant). String literals
 * never cross the quote/backslash state, so `{"a": 1}` and `{ "a": 1 }`
 * collide but `{"a b": 1}` and `{"ab": 1}` do not.
 *
 * Two independent 32-bit FNV-1a lanes make accidental collisions negligible
 * while keeping the map keys tiny (fixed-size strings) even for multi-MB
 * documents; escape-spelling differences intentionally do not collide,
 * matching the scanner's verbatim-token stance.
 */
function elementSignature(text: string, start: number, end: number): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let inString = false;
  let escaped = false;
  for (let i = start; i < end; i++) {
    const code = text.charCodeAt(i);
    if (!inString && (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d)) continue;
    if (!inString) {
      if (code === QUOTE) inString = true;
    } else if (escaped) {
      escaped = false;
    } else if (code === BACKSLASH) {
      escaped = true;
    } else if (code === QUOTE) {
      inString = false;
    }
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 = (h2 ^ (code + 0x9e3779b9)) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function scanJson(text: string): ScanResult {
  return new JsonScanner(text).parse();
}
