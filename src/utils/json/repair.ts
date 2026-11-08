/**
 * Smart JSON repair utility.
 */
import type { RepairResult } from '@/types';
import { parseJson } from './parse';

export function repairJson(raw: string): RepairResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, repairedText: raw, repairsApplied: [] };
  }

  const alreadyValid = parseJson(trimmed);
  if (alreadyValid.ok) {
    return { ok: true, repairedText: trimmed, repairsApplied: ['Already valid JSON'] };
  }

  const repairsApplied: string[] = [];
  let s = trimmed;

  if (/\/\/.*|\/\*[\s\S]*?\*\//.test(s)) {
    s = stripCommentsPreservingStrings(s);
    repairsApplied.push('Removed comments');
  }

  const pythonLiteralPattern = /\b(True|False|None|undefined|NaN)\b/g;
  if (pythonLiteralPattern.test(s)) {
    s = replaceLiteralsPreservingStrings(s);
    repairsApplied.push('Normalized Python/JS literals');
  }

  s = fixQuotesAndKeys(s, repairsApplied);

  const trailingCommaPattern = /,\s*([}\]])/g;
  if (trailingCommaPattern.test(s)) {
    s = s.replace(trailingCommaPattern, '$1');
    repairsApplied.push('Removed trailing commas');
  }

  let check = parseJson(s);
  if (check.ok) {
    return { ok: true, repairedText: s, repairsApplied };
  }

  s = fixMissingCommas(s);
  check = parseJson(s);
  if (check.ok) {
    repairsApplied.push('Added missing commas');
    return { ok: true, repairedText: s, repairsApplied };
  }
  // The newline heuristic can half-fix a document it cannot fully repair
  // (e.g. turning a missing colon into a stray comma). Revert to the original
  // text before the structural scan, which handles all separator gaps.
  const separators = insertSeparators(s);
  check = parseJson(separators.text);
  if (check.ok && (separators.colons > 0 || separators.commas > 0)) {
    if (separators.colons > 0) {
      repairsApplied.push('Inserted missing colons after property names');
    }
    if (separators.commas > 0) {
      repairsApplied.push('Added missing commas');
    }
    return { ok: true, repairedText: separators.text, repairsApplied };
  }

  return { ok: false, repairedText: s, repairsApplied };
}

/**
 * Structural separator repair: walks the document strictly following RFC 8259
 * with a container frame stack and inserts the separators that clearly belong
 * — a missing colon between an object key and its value, or a missing comma
 * between two members/elements ("key" "value" instead of "key": "value").
 *
 * The scan is intentionally conservative: whenever the intent is ambiguous
 * (e.g. `{"a" "b": 1}`) or the document cannot be repaired by separator
 * insertion alone, the original text is returned unchanged so the rest of the
 * repair pipeline (and the error highlight) keeps working with it.
 */
function insertSeparators(
  input: string,
): { text: string; colons: number; commas: number } {
  let out = '';
  let colons = 0;
  let commas = 0;
  let i = 0;
  let topDone = false;

  interface Frame {
    kind: 'obj' | 'arr';
    /** obj: key | colon | value | sep; arr: value | after */
    state: 'key' | 'colon' | 'value' | 'sep' | 'after';
  }
  const frames: Frame[] = [];
  const unrepairable = (): { text: string; colons: 0; commas: 0 } => ({
    text: input,
    colons: 0,
    commas: 0,
  });

  while (i < input.length) {
    if (/\s/.test(input[i])) {
      out += input[i];
      i++;
      continue;
    }
    const c = input[i];
    const frame = frames[frames.length - 1];

    // Closing brackets.
    if (c === '}') {
      if (
        !frame ||
        frame.kind !== 'obj' ||
        frame.state === 'value' ||
        frame.state === 'colon'
      ) {
        return unrepairable();
      }
      frames.pop();
      advanceParent(frames);
      out += c;
      i++;
      if (frames.length === 0) topDone = true;
      continue;
    }
    if (c === ']') {
      if (
        !frame ||
        frame.kind !== 'arr' ||
        (frame.state !== 'after' && frame.state !== 'value')
      ) {
        return unrepairable();
      }
      frames.pop();
      advanceParent(frames);
      out += c;
      i++;
      if (frames.length === 0) topDone = true;
      continue;
    }

    if (!frame) {
      // Top level: exactly one value, then end of input.
      if (topDone || !isValueStart(input, i)) return unrepairable();
      if (c === '{') {
        frames.push({ kind: 'obj', state: 'key' });
        out += c;
        i++;
        continue;
      }
      if (c === '[') {
        frames.push({ kind: 'arr', state: 'value' });
        out += c;
        i++;
        continue;
      }
      const end = readScalar(input, i);
      if (!end) return unrepairable();
      out += input.slice(i, end);
      i = end;
      topDone = true;
      continue;
    }

    if (frame.kind === 'obj') {
      switch (frame.state) {
        case 'key': {
          if (c !== '"') return unrepairable();
          const end = readString(input, i);
          if (!end) return unrepairable();
          out += input.slice(i, end);
          i = end;
          frame.state = 'colon';
          continue;
        }
        case 'colon': {
          if (c === ':') {
            out += c;
            i++;
            frame.state = 'value';
            continue;
          }
          // A missing colon: the next token plays the value's role.
          if (!isValueStart(input, i)) return unrepairable();
          // `{"a" "b": 1}` is ambiguous — inserting a colon changes the
          // meaning of "b"; leave such documents to the error highlight.
          if (c === '"' && stringWithColonAfter(input, i)) return unrepairable();
          // Whitespace between key and token was already copied to `out`;
          // only add a space when the key sat flush against the value.
          out += /\s$/.test(out) ? ':' : ': ';
          colons++;
          frame.state = 'value';
          continue;
        }
        case 'value': {
          if (!isValueStart(input, i)) return unrepairable();
          if (c === '{') {
            frames.push({ kind: 'obj', state: 'key' });
            out += c;
            i++;
            continue;
          }
          if (c === '[') {
            frames.push({ kind: 'arr', state: 'value' });
            out += c;
            i++;
            continue;
          }
          const end = c === '"' ? readString(input, i) : readScalar(input, i);
          if (!end) return unrepairable();
          out += input.slice(i, end);
          i = end;
          frame.state = 'sep';
          continue;
        }
        case 'sep': {
          if (c === ',') {
            out += c;
            i++;
            frame.state = 'key';
            continue;
          }
          // A key right after a finished member: the comma is missing.
          if (c === '"' && stringWithColonAfter(input, i)) {
            out += ',';
            commas++;
            // Process the string as the next key on the following loop pass.
            frame.state = 'key';
            continue;
          }
          return unrepairable();
        }
      }
    } else {
      // Array frame.
      if (frame.state === 'value') {
        if (!isValueStart(input, i)) return unrepairable();
        if (c === '{') {
          frames.push({ kind: 'obj', state: 'key' });
          out += c;
          i++;
          continue;
        }
        if (c === '[') {
          frames.push({ kind: 'arr', state: 'value' });
          out += c;
          i++;
          continue;
        }
        const end = c === '"' ? readString(input, i) : readScalar(input, i);
        if (!end) return unrepairable();
        out += input.slice(i, end);
        i = end;
        frame.state = 'after';
        continue;
      }
      // 'after': expecting ',' or ']'.
      if (c === ',') {
        out += c;
        i++;
        frame.state = 'value';
        continue;
      }
      if (isValueStart(input, i)) {
        out += ', ';
        commas++;
        frame.state = 'value';
        continue;
      }
      return unrepairable();
    }
  }
  return { text: out, colons, commas };
}

/** Marks the remaining parent frame as awaiting the next separator. */
function advanceParent(frames: { kind: 'obj' | 'arr'; state: string }[]): void {
  const parent = frames[frames.length - 1];
  if (!parent) return;
  parent.state = parent.kind === 'obj' ? 'sep' : 'after';
}

/** Whether the token at `i` can begin a value. */
function isValueStart(input: string, i: number): boolean {  const c = input[i];
  if (c === '"' || c === '{' || c === '[') return true;
  if (c === '-' || (c >= '0' && c <= '9')) return true;
  return c === 't' || c === 'f' || c === 'n';
}

/** Reads a string token starting at `i`; returns the end index or null. */
function readString(input: string, i: number): number | null {
  if (input[i] !== '"') return null;
  let j = i + 1;
  while (j < input.length) {
    const ch = input[j];
    if (ch === '\\') {
      if (j + 1 >= input.length) return null;
      j += 2;
      continue;
    }
    if (ch === '"') return j + 1;
    if (ch === '\n') return null; // unterminated: not reliably repairable
    j++;
  }
  return null;
}

/** Whether, after the string starting at `i`, the next significant char is ':'. */
function stringWithColonAfter(input: string, i: number): boolean {
  const end = readString(input, i);
  if (!end) return false;
  let look = end;
  while (look < input.length && /\s/.test(input[look])) look++;
  return input[look] === ':';
}

/** Reads a number or literal token; alone means "not a value start". */
function readScalar(input: string, i: number): number | null {
  const rest = input.slice(i, i + 64);
  const number = rest.match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
  if (number && number[0].length > 0 && /\d/.test(number[0])) {
    return i + number[0].length;
  }
  const literal = rest.match(/^(true|false|null)/);
  if (literal) return i + literal[0].length;
  return null;
}


function stripCommentsPreservingStrings(input: string): string {
  let out = '';
  let inString = false;
  let stringChar = '';
  let i = 0;

  while (i < input.length) {
    const c = input[i];
    const next = input[i + 1];

    if (inString) {
      out += c;
      if (c === '\\') {
        if (next) {
          out += next;
          i += 2;
          continue;
        }
      } else if (c === stringChar) {
        inString = false;
      }
      i++;
    } else {
      if (c === '"' || c === "'") {
        inString = true;
        stringChar = c;
        out += c;
        i++;
      } else if (c === '/' && next === '/') {
        i += 2;
        while (i < input.length && input[i] !== '\n' && input[i] !== '\r') {
          i++;
        }
      } else if (c === '/' && next === '*') {
        i += 2;
        while (i < input.length - 1 && !(input[i] === '*' && input[i + 1] === '/')) {
          i++;
        }
        i += 2;
      } else {
        out += c;
        i++;
      }
    }
  }
  return out;
}

function replaceLiteralsPreservingStrings(input: string): string {
  let out = '';
  let inString = false;
  let stringChar = '';
  let i = 0;

  while (i < input.length) {
    const c = input[i];
    if (inString) {
      out += c;
      if (c === '\\' && input[i + 1]) {
        out += input[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) {
        inString = false;
      }
      i++;
    } else {
      if (c === '"' || c === "'") {
        inString = true;
        stringChar = c;
        out += c;
        i++;
      } else {
        const rest = input.slice(i);
        const match = rest.match(/^[a-zA-Z_]\w*/);
        if (match) {
          const word = match[0];
          if (word === 'True') out += 'true';
          else if (word === 'False') out += 'false';
          else if (word === 'None' || word === 'undefined' || word === 'NaN') out += 'null';
          else out += word;
          i += word.length;
        } else {
          out += c;
          i++;
        }
      }
    }
  }
  return out;
}

function fixQuotesAndKeys(input: string, repairs: string[]): string {
  let out = '';
  let i = 0;
  let singleQuoteConverted = false;
  let unquotedKeyConverted = false;

  while (i < input.length) {
    const c = input[i];

    if (c === '"') {
      out += '"';
      i++;
      while (i < input.length) {
        const sc = input[i];
        out += sc;
        if (sc === '\\' && input[i + 1]) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        if (sc === '"') {
          i++;
          break;
        }
        i++;
      }
    } else if (c === "'") {
      singleQuoteConverted = true;
      out += '"';
      i++;
      while (i < input.length) {
        const sc = input[i];
        if (sc === '\\' && input[i + 1]) {
          const next = input[i + 1];
          if (next === "'") {
            out += "'";
          } else {
            out += '\\' + next;
          }
          i += 2;
          continue;
        }
        if (sc === '"') {
          out += '\\"';
        } else if (sc === "'") {
          out += '"';
          i++;
          break;
        } else {
          out += sc;
        }
        i++;
      }
    } else if (isIdentifierStart(c)) {
      const rest = input.slice(i);
      const match = rest.match(/^[a-zA-Z_$][a-zA-Z0-9_$-]*/);
      if (match) {
        const word = match[0];
        const afterWord = rest.slice(word.length);
        const nextNonWs = afterWord.trimStart()[0];
        if (nextNonWs === ':') {
          out += '"' + word + '"';
          unquotedKeyConverted = true;
          i += word.length;
        } else {
          out += word;
          i += word.length;
        }
      } else {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }

  if (singleQuoteConverted) repairs.push('Converted single quotes to double quotes');
  if (unquotedKeyConverted) repairs.push('Enclosed unquoted object keys in quotes');

  return out;
}

function isIdentifierStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
}

function fixMissingCommas(input: string): string {
  return input.replace(
    /(["\d]|true|false|null|[}\]])(\s*\n\s*)(["{[|a-zA-Z_$])/g,
    (_match, p1, p2, p3) => String(p1) + ',' + String(p2) + String(p3),
  );
}