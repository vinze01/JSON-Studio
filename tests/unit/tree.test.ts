import { describe, expect, it } from 'vitest';
import {
  childTreeNodes,
  containerSummary,
  countNodes,
  createRootNode,
  hasChildren,
  nodeTypeOf,
  retainExpanded,
} from '@/utils/json/tree';
import type { JsonValue } from '@/types';

describe('tree model helpers', () => {
  it('classifies node types', () => {
    expect(nodeTypeOf({})).toBe('object');
    expect(nodeTypeOf([])).toBe('array');
    expect(nodeTypeOf('x')).toBe('string');
    expect(nodeTypeOf(1)).toBe('number');
    expect(nodeTypeOf(false)).toBe('boolean');
    expect(nodeTypeOf(null)).toBe('null');
  });

  it('summarizes containers and detects children', () => {
    expect(containerSummary({ a: 1, b: 2 })).toBe('2 keys');
    expect(containerSummary({ a: 1 })).toBe('1 key');
    expect(containerSummary([1, 2, 3])).toBe('3 items');
    expect(containerSummary([])).toBe('0 items');
    expect(containerSummary('s')).toBeNull();
    expect(hasChildren({})).toBe(false);
    expect(hasChildren([null])).toBe(true);
  });

  it('creates child nodes with correct pointers, labels and depth', () => {
    const root = createRootNode({ items: ['a', 'b'] } as JsonValue);
    const [items] = childTreeNodes(root, new Map());
    expect(items?.pointer).toBe('/items');
    expect(items?.depth).toBe(1);
    const children = childTreeNodes(items!, new Map());
    expect(children.map((node) => [node.pointer, node.label, node.isIndex])).toEqual([
      ['/items/0', '0', true],
      ['/items/1', '1', true],
    ]);
  });

  it('caches children per pointer', () => {
    const cache = new Map();
    const root = createRootNode({ a: 1 });
    const first = childTreeNodes(root, cache);
    const second = childTreeNodes(root, cache);
    expect(first).toBe(second);
  });

  it('counts nodes iteratively with a cap', () => {
    const nested: JsonValue = { a: [1, { b: [2, 3] }] };
    expect(countNodes(nested)).toBe(7);
    expect(countNodes(nested, 2)).toBe(2);
    expect(countNodes('root', 10)).toBe(1);
  });

  it('retains expanded pointers that still exist after a re-parse', () => {
    const cache = new Map();
    const doc: JsonValue = { address: { city: 'SF' }, roles: ['dev'] };
    const retained = retainExpanded(doc, new Set(['', '/address', '/roles', '/ghost']), cache);
    expect(retained).toEqual(new Set(['', '/address', '/roles']));
  });

  it('drops everything when the document structure changed', () => {
    const cache = new Map();
    const retained = retainExpanded(
      { other: 1 } as JsonValue,
      new Set(['', '/address', '/address/city']),
      cache,
    );
    expect(retained).toEqual(new Set(['']));
  });
});
