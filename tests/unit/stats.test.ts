import { describe, expect, it } from 'vitest';
import { computeStats, formatBytes } from '@/utils/json/stats';
import { scanJson } from '@/utils/json/validate';

describe('formatBytes', () => {
  it('formats human readable sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('computeStats', () => {
  it('reports empty documents', () => {
    const stats = computeStats('   ', false, null, null);
    expect(stats.rootType).toBe('empty');
    expect(stats.sizeBytes).toBe(3);
  });

  it('reports invalid documents', () => {
    expect(computeStats('{oops', false, null, null).rootType).toBe('invalid');
  });

  it('reports arrays with item counts and depth', () => {
    const scan = scanJson('[1,[2,[3]]]');
    const stats = computeStats('[1,[2,[3]]]', true, JSON.parse('[1,[2,[3]]]'), scan);
    expect(stats.rootType).toBe('array');
    expect(stats.items).toBe(2);
    expect(stats.depth).toBe(3);
  });

  it('reports object key counts', () => {
    const scan = scanJson('{"a":1,"b":2}');
    const stats = computeStats('{"a":1,"b":2}', true, JSON.parse('{"a":1,"b":2}'), scan);
    expect(stats.rootType).toBe('object');
    expect(stats.items).toBe(2);
  });
});
