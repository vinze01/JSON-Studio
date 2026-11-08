/**
 * Key/value search over parsed JSON using an iterative depth-first walk
 * (no recursion limits, no allocation-heavy machinery).
 */
import type { JsonValue, SearchMatch, SearchOptions, SearchOutcome } from '@/types';
import { appendPointerSegment } from './pointer';

const DEFAULT_LIMIT = 2000;
const PREVIEW_MAX = 120;

function previewOf(value: JsonValue): string {
  let preview: string;
  if (typeof value === 'string') {
    preview = value;
  } else if (typeof value === 'number') {
    preview = String(value);
  } else if (typeof value === 'boolean') {
    preview = value ? 'true' : 'false';
  } else if (value === null) {
    preview = 'null';
  } else {
    preview = JSON.stringify(value);
  }
  if (preview.length > PREVIEW_MAX) {
    return `${preview.slice(0, PREVIEW_MAX - 1)}…`;
  }
  return preview;
}

function primitiveToken(value: string | number | boolean | null): string {
  return typeof value === 'string' ? value : String(value);
}

export function searchJson(data: JsonValue, rawOptions: SearchOptions): SearchOutcome {
  const matchKeys = rawOptions.matchKeys !== false;
  const matchValues = rawOptions.matchValues !== false;
  const limit = rawOptions.limit ?? DEFAULT_LIMIT;
  const caseSensitive = rawOptions.caseSensitive === true;
  const query = caseSensitive ? rawOptions.query : rawOptions.query.toLowerCase();

  const matches: SearchMatch[] = [];
  if (rawOptions.query === '' || (!matchKeys && !matchValues)) {
    return { matches, truncated: false };
  }

  const stack: Array<{ value: JsonValue; pointer: string }> = [{ value: data, pointer: '' }];

  while (stack.length > 0) {
    const { value, pointer } = stack.pop()!;

    if (value !== null && typeof value === 'object') {
      const record = value as { [key: string]: JsonValue };
      const keys = Object.keys(record);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i]!;
        stack.push({ value: record[key]!, pointer: appendPointerSegment(pointer, key) });
      }
      if (matchKeys) {
        for (const key of keys) {
          const token = caseSensitive ? key : key.toLowerCase();
          if (token.includes(query)) {
            matches.push({ pointer: appendPointerSegment(pointer, key), kind: 'key', preview: key });
            if (matches.length >= limit) {
              return { matches, truncated: true };
            }
          }
        }
      }
      continue;
    }

    if (matchValues) {
      const token = caseSensitive
        ? primitiveToken(value)
        : primitiveToken(value).toLowerCase();
      if (token.includes(query)) {
        matches.push({ pointer, kind: 'value', preview: previewOf(value) });
        if (matches.length >= limit) {
          return { matches, truncated: true };
        }
      }
    }
  }

  return { matches, truncated: false };
}
