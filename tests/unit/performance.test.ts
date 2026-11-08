/**
 * Representative performance tests using synthetic documents of ~100 KB,
 * ~1 MB and ~5 MB. These are functional budgets on this machine, not
 * guarantees for all hardware - see TESTING.md for documented limitations.
 */
import { describe, expect, it } from 'vitest';
import { parseJson } from '@/utils/json/parse';
import { scanJson } from '@/utils/json/validate';
import { createRootNode, childTreeNodes, countNodes } from '@/utils/json/tree';
import { searchJson } from '@/utils/json/search';
import type { JsonValue } from '@/types';

function buildSyntheticDocument(targetBytes: number): { text: string; data: JsonValue } {
  const lorem =
    'Nunc placerat mi id nisi interdum mollis. Praesent pharetra, libero ut semper varius. поиск ♥ 😎'; // varied content incl. unicode
  const posts: Array<{ id: number; title: string; body: string; tags: string[] }> = [];
  let bytes = 0;
  let id = 0;
  while (bytes < targetBytes) {
    const entry = {
      id,
      title: `Post number ${id} about ordinary technical topics`,
      body: lorem.repeat(2),
      tags: id % 3 === 0 ? ['alpha', 'beta'] : ['gamma'],
    };
    posts.push(entry);
    bytes += JSON.stringify(entry).length + 1;
    id++;
  }
  const data: JsonValue = { posts, meta: { generated: true, count: posts.length } };
  const text = JSON.stringify(data, null, 2);
  return { text, data };
}

const SIZES: Array<{ label: string; target: number; ms: number }> = [
  { label: '100KB', target: 100 * 1024, ms: 500 },
  { label: '1MB', target: 1024 * 1024, ms: 1200 },
  { label: '5MB', target: 5 * 1024 * 1024, ms: 3000 },
];

describe.each(SIZES)('performance profile: $label', ({ target, ms }) => {
  const kbLabel = `${Math.round(target / 1024)}KB`;

  it(`processes a synthetic ${kbLabel} document within ${ms}ms combined`, () => {
    const { text, data } = buildSyntheticDocument(target);

    const parseStart = performance.now();
    const parsed = parseJson(text);
    const parseMs = performance.now() - parseStart;
    expect(parsed.ok).toBe(true);

    const data0 = parsed.ok ? parsed.data : null;
    expect(data0).not.toBeNull();

    const scanStart = performance.now();
    const scan = scanJson(text);
    const scanMs = performance.now() - scanStart;
    expect(scan.ok).toBe(true);

    const countStart = performance.now();
    const nodeCount = countNodes(data, Number.MAX_SAFE_INTEGER);
    const countMs = performance.now() - countStart;
    expect(nodeCount).toBeGreaterThan(1000);

    const searchStart = performance.now();
    const search = searchJson(data, { query: 'ordinary' });
    const searchMs = performance.now() - searchStart;
    expect(search.matches.length).toBeGreaterThan(10);

    // Tree materialization must be pay-as-you-grow: only touched levels load.
    const treeStart = performance.now();
    const root = createRootNode(data);
    const first = childTreeNodes(root, new Map());
    expect(first.length).toBeGreaterThan(0);
    const treeMs = performance.now() - treeStart;

    const combined = parseMs + scanMs + countMs + searchMs + treeMs;
    expect(combined, `${combined.toFixed(0)}ms`).toBeLessThan(ms);

    // Keep rough expectations in the test output for tuning/guarding.
    expect([parseMs, scanMs, countMs, searchMs, treeMs].every((value) => Number.isFinite(value))).toBe(true);
  });
});
