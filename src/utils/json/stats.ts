import type { DocumentStats, JsonValue, ScanResult } from '@/types';

/** Byte length of a document using UTF-8 encoding. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function rootTypeOf(data: JsonValue | null): DocumentStats['rootType'] {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  const type = typeof data;
  if (type === 'object') return 'object';
  return type as DocumentStats['rootType'];
}

/** Derives summary statistics from the current parse/scan state. */
export function computeStats(
  text: string,
  parseOk: boolean,
  data: JsonValue | null,
  scan: ScanResult | null,
): DocumentStats {
  const empty = text.trim() === '';
  const base: DocumentStats = {
    sizeBytes: byteLength(text),
    rootType: 'invalid',
    items: null,
    depth: 0,
  };
  if (empty) {
    base.rootType = 'empty';
    return base;
  }
  if (!parseOk || data === null) {
    return base;
  }
  base.rootType = rootTypeOf(data);
  if (Array.isArray(data)) base.items = data.length;
  else if (base.rootType === 'object') base.items = Object.keys(data as object).length;
  base.depth = scan?.info.maxDepth ?? 0;
  return base;
}
