import type { JsonNodeType, JsonTreeNode, JsonValue } from '@/types';
import { appendPointerSegment } from './pointer';

/** Type name of a JSON value for coloring and status display. */
export function nodeTypeOf(value: JsonValue): JsonNodeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  return type as JsonNodeType;
}

export function containerSummary(value: JsonValue): string | null {
  if (Array.isArray(value)) {
    return value.length === 1 ? '1 item' : `${value.length} items`;
  }
  if (value !== null && typeof value === 'object') {
    const count = Object.keys(value as { [key: string]: JsonValue }).length;
    return count === 1 ? '1 key' : `${count} keys`;
  }
  return null;
}

export function hasChildren(value: JsonValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as { [key: string]: JsonValue }).length > 0;
  }
  return false;
}

export function createTreeNode(
  value: JsonValue,
  label: string,
  isIndex: boolean,
  pointer: string,
  depth: number,
): JsonTreeNode {
  return {
    pointer,
    label,
    isIndex,
    type: nodeTypeOf(value),
    value,
    summary: containerSummary(value),
    depth,
    hasChildren: hasChildren(value),
  };
}

export function createRootNode(data: JsonValue): JsonTreeNode {
  return createTreeNode(data, 'root', false, '', 0);
}

/**
 * The subset of `expanded` whose pointers still exist in `data`.
 *
 * Format/Minify/Validate re-parse the same document, so all pointers survive
 * and expansion + scroll position carry over; a genuinely new document keeps
 * almost nothing and collapses back to the root row. The walk is capped like
 * the expand-all guard so gigantic documents can't freeze the tab.
 */
export function retainExpanded(
  data: JsonValue,
  expanded: ReadonlySet<string>,
  cache: Map<string, JsonTreeNode[]>,
  limit = 50_001,
): Set<string> {
  const retained = new Set<string>();
  const stack: JsonTreeNode[] = [createRootNode(data)];
  let visited = 0;
  while (stack.length > 0 && visited < limit) {
    const node = stack.pop()!;
    visited++;
    if (expanded.has(node.pointer)) retained.add(node.pointer);
    if (node.hasChildren) {
      for (const child of childTreeNodes(node, cache)) {
        stack.push(child);
      }
    }
  }
  return retained;
}

/**
 * Child nodes of a container. Results are cached per document tree via the
 * provided cache so that virtualized re-renders remain cheap.
 */
export function childTreeNodes(
  parent: JsonTreeNode,
  cache: Map<string, JsonTreeNode[]> | null,
): JsonTreeNode[] {
  const cached = cache?.get(parent.pointer);
  if (cached) return cached;
  const children: JsonTreeNode[] = [];
  if (Array.isArray(parent.value)) {
    for (let i = 0; i < parent.value.length; i++) {
      children.push(
        createTreeNode(
          parent.value[i]!,
          String(i),
          true,
          appendPointerSegment(parent.pointer, i),
          parent.depth + 1,
        ),
      );
    }
  } else if (parent.value !== null && typeof parent.value === 'object') {
    const record = parent.value as { [key: string]: JsonValue };
    for (const key of Object.keys(record)) {
      children.push(
        createTreeNode(record[key]!, key, false, appendPointerSegment(parent.pointer, key), parent.depth + 1),
      );
    }
  }
  if (cache) cache.set(parent.pointer, children);
  return children;
}

/** Counts nodes iteratively, stopping once `cap` is reached. */
export function countNodes(data: JsonValue, cap = 50_000): number {
  let count = 0;
  const stack: JsonValue[] = [data];
  while (stack.length > 0) {
    const value = stack.pop()!;
    count++;
    if (count >= cap) return cap;
    if (Array.isArray(value)) {
      for (const child of value) stack.push(child);
    } else if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value as { [key: string]: JsonValue })) {
        stack.push(child);
      }
    }
  }
  return count;
}
