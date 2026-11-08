<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { JsonTreeNode, JsonValue } from '@/types';
import { childTreeNodes, createRootNode, retainExpanded } from '@/utils/json/tree';
import { countNodes } from '@/utils/json/tree';
import { stringifyJson, innerSnippetJson } from '@/utils/json/format';
import { useToastStore } from '@/stores/toast';
import { usePreferencesStore } from '@/stores/preferences';
import TreeRow from './TreeRow.vue';

const ROW_H = 22;
const OVERSCAN_ROWS = 8;

/* NOTE: ROW_H must stay in sync with the `h-[22px]` row height owned by
   TreeRow.vue - virtualized windowing assumes every row is exactly this tall. */

interface Props {
  data: JsonValue | null;
  matchPointers: ReadonlySet<string>;
  activePointer: string | null;
}

const props = defineProps<Props>();

const toast = useToastStore();
const preferences = usePreferencesStore();

/* ------------------------------- expansion ------------------------------- */

const expanded = shallowRef<ReadonlySet<string>>(new Set(['']));
const childrenCache = new Map<string, JsonTreeNode[]>();

watch(
  () => props.data,
  (data) => {
    const previous = expanded.value;
    childrenCache.clear();
    if (data === null) {
      expanded.value = new Set<string>();
      viewportTop.value = 0;
      if (viewport.value) viewport.value.scrollTop = 0;
      return;
    }
    const retained = retainExpanded(data, previous, childrenCache);
    if (retained.size >= 2) {
      // Same structure re-parsed (Format / Minify / Validate on identical
      // content): keep every expansion and the scroll position.
      expanded.value = retained;
    } else {
      // A different document arrived: collapse to the root row.
      expanded.value = new Set(['']);
      viewportTop.value = 0;
      if (viewport.value) viewport.value.scrollTop = 0;
    }
  },
);

function toggle(pointers: string[], force?: boolean): void {
  const next = new Set(expanded.value);
  for (const pointer of pointers) {
    const shouldExpand = force ?? !next.has(pointer);
    if (shouldExpand) next.add(pointer);
    else next.delete(pointer);
  }
  expanded.value = next;
}

/** Expands every ancestor of `pointer` so the match becomes visible. */
function expandAncestors(pointer: string): void {
  const next = new Set(expanded.value);
  let index = 0;
  while (index < pointer.length) {
    const slash = pointer.indexOf('/', index + 1);
    const prefix = slash === -1 ? pointer : pointer.slice(0, slash);
    next.add(prefix);
    if (slash === -1) break;
    index = slash;
  }
  expanded.value = next;
}

/* ------------------------------ flat list -------------------------------- */

const flatNodes = computed<JsonTreeNode[]>(() => {
  if (props.data === null) return [];
  const root = createRootNode(props.data);
  const out: JsonTreeNode[] = [];
  const stack: JsonTreeNode[] = [root];
  const openSet = expanded.value;
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.push(node);
    if (node.hasChildren && openSet.has(node.pointer)) {
      const children = childTreeNodes(node, childrenCache);
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]!);
      }
    }
  }
  return out;
});

/* ----------------------------- virtualization ---------------------------- */

const viewport = ref<HTMLElement | null>(null);
const viewportTop = ref(0);
const viewportHeight = ref(0);
let resizeObserver: ResizeObserver | null = null;

// The viewport mounts only when a document exists (v-if above), so sizing
// must be attached via a template-ref watcher. Crashing this watcher leaves
// viewportHeight at 0 and the virtual window renders too few rows - the
// "keys are missing below" bug.
watch(
  viewport,
  (element) => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (!element) {
      viewportHeight.value = 0;
      return;
    }
    viewportHeight.value = element.clientHeight;
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(element);
  },
  { immediate: true },
);

onBeforeUnmount(() => resizeObserver?.disconnect());

const totalHeight = computed(() => Math.max(flatNodes.value.length, 1) * ROW_H);

// Expansion/collapse changes the total height (and the browser may clamp
// scrollTop as a result). Re-sync the window bookkeeping so the slice always
// matches the real scroll position - without this, stale `viewportTop` can
// make the rendered window show blank space or hide rows.
watch(
  [flatNodes, viewportHeight],
  () => {
    if (!viewport.value) return;
    viewportTop.value = viewport.value.scrollTop;
  },
  { flush: 'post' },
);

const windowRange = computed(() => {
  const count = flatNodes.value.length;
  // If total document has under 1000 nodes, render all without slicing for maximum responsiveness and zero boundary glitching
  if (count <= 1000) {
    return { first: 0, last: count };
  }
  const first = Math.max(0, Math.floor(viewportTop.value / ROW_H) - OVERSCAN_ROWS);
  // Degraded-guard: if sizing ever fails, render at least 30 rows instead of
  // only the overscan band.
  const visible = Math.max(30, Math.ceil(viewportHeight.value / ROW_H) + OVERSCAN_ROWS * 2);
  const last = Math.min(count, first + visible);
  return { first, last };
});

const visibleNodes = computed(() => flatNodes.value.slice(windowRange.value.first, windowRange.value.last));
const windowOffset = computed(() => windowRange.value.first * ROW_H);

function onScroll(): void {
  if (viewport.value) viewportTop.value = viewport.value.scrollTop;
}

/* ------------------------------ interaction ------------------------------ */

const selectedIndex = ref(0);
const lastRevealedPointer = shallowRef<string | null>(null);

function scrollToIndex(index: number, center = false): void {
  const element = viewport.value;
  if (!element) return;
  const top = index * ROW_H;
  const bottom = top + ROW_H;
  if (center) {
    element.scrollTop = Math.max(0, top - element.clientHeight / 2);
    return;
  }
  if (top < element.scrollTop) {
    element.scrollTop = top;
  } else if (bottom > element.scrollTop + element.clientHeight) {
    element.scrollTop = bottom - element.clientHeight;
  }
}

watch(flatNodes, (nodes) => {
  if (selectedIndex.value >= nodes.length) {
    selectedIndex.value = Math.max(0, nodes.length - 1);
  }
});

watch(
  () => props.activePointer,
  (pointer) => {
    if (pointer === null || pointer === lastRevealedPointer.value) return;
    lastRevealedPointer.value = pointer;
    expandAncestors(pointer);
    // Wait one tick for watchers above to recompute the flat list.
    Promise.resolve().then(() => {
      const index = flatNodes.value.findIndex((node) => node.pointer === pointer);
      if (index >= 0) {
        selectedIndex.value = index;
        scrollToIndex(index, true);
      }
    });
  },
);

function onKeydown(event: KeyboardEvent): void {
  const count = flatNodes.value.length;
  if (count === 0) return;
  const node = flatNodes.value[selectedIndex.value];
  switch (event.key) {
    case 'ArrowDown':
      if (selectedIndex.value < count - 1) {
        selectedIndex.value++;
        scrollToIndex(selectedIndex.value);
      }
      event.preventDefault();
      break;
    case 'ArrowUp':
      if (selectedIndex.value > 0) {
        selectedIndex.value--;
        scrollToIndex(selectedIndex.value);
      }
      event.preventDefault();
      break;
    case 'ArrowRight':
      if (node?.hasChildren) {
        if (expanded.value.has(node.pointer)) {
          selectedIndex.value++;
          scrollToIndex(selectedIndex.value);
        } else {
          toggle([node.pointer], true);
        }
      }
      event.preventDefault();
      break;
    case 'ArrowLeft':
      if (node && expanded.value.has(node.pointer) && node.hasChildren) {
        toggle([node.pointer], false);
      } else if (node && node.depth > 0) {
        // Jump to parent.
        for (let i = selectedIndex.value - 1; i >= 0; i--) {
          const candidate = flatNodes.value[i];
          if (candidate && candidate.depth < node.depth) {
            selectedIndex.value = i;
            scrollToIndex(i);
            break;
          }
        }
      }
      event.preventDefault();
      break;
    case 'Home':
      selectedIndex.value = 0;
      scrollToIndex(0);
      event.preventDefault();
      break;
    case 'End':
      selectedIndex.value = count - 1;
      scrollToIndex(count - 1);
      event.preventDefault();
      break;
    case 'Enter':
    case ' ':
      if (node?.hasChildren) {
        toggle([node.pointer]);
      }
      event.preventDefault();
      break;
    default:
      break;
  }
}

/* ---------------------------- copy & bulk ops ---------------------------- */

function onToggle(node: JsonTreeNode, index: number): void {
  selectedIndex.value = index;
  const isExpanding = !expanded.value.has(node.pointer);
  toggle([node.pointer]);

  // When expanding a container near the bottom edge, scroll to reveal its children
  if (isExpanding) {
    Promise.resolve().then(() => {
      // Find where this node is in the updated flat list
      const newIndex = flatNodes.value.findIndex((n) => n.pointer === node.pointer);
      if (newIndex >= 0) {
        scrollToIndex(newIndex);
        // Also check if its immediate first child is out of view, and scroll slightly if needed
        const element = viewport.value;
        if (element) {
          const nodeBottom = (newIndex + 2) * ROW_H;
          if (nodeBottom > element.scrollTop + element.clientHeight) {
            element.scrollTop = Math.min(element.scrollHeight, nodeBottom - element.clientHeight + ROW_H * 2);
          }
        }
      }
    });
  }
}

function copyValue(node: JsonTreeNode): void {
  void toast.copyWithToast(
    stringifyJson(node.value, preferences.indent),
    node.hasChildren ? 'Outer JSON copied' : 'Value copied',
  );
}

/** Copies a container's contents without the outer braces (merge helper). */
function copyInner(node: JsonTreeNode): void {
  const text = innerSnippetJson(node.value, preferences.indent);
  if (text === null) return;
  void toast.copyWithToast(text, 'Inner JSON copied (without the outer braces)');
}

function copyPath(node: JsonTreeNode): void {
  void toast.copyWithToast(node.pointer === '' ? '/' : node.pointer, 'JSON Pointer copied');
}

function revealPointer(pointer: string): void {
  expandAncestors(pointer);
  Promise.resolve().then(() => {
    const index = flatNodes.value.findIndex((node) => node.pointer === pointer);
    if (index >= 0) {
      selectedIndex.value = index;
      scrollToIndex(index, true);
    }
  });
}

function expandAll(): void {
  if (props.data === null) return;
  const nodeCount = countNodes(props.data, 50_001);
  if (nodeCount > 50_000) {
    toast.info('Document is too large to expand entirely; expanded the first two levels.');
    toggle(collectPointersToDepth(props.data, 2));
    return;
  }
  const all = new Set<string>(['']);
  const stack: Array<{ node: JsonTreeNode }> = [{ node: createRootNode(props.data) }];
  while (stack.length > 0) {
    const { node } = stack.pop()!;
    if (!node.hasChildren) continue;
    all.add(node.pointer);
    for (const child of childTreeNodes(node, childrenCache)) {
      stack.push({ node: child });
    }
  }
  expanded.value = all;
}

function collectPointersToDepth(data: JsonValue, maxDepth: number): string[] {
  const pointers: string[] = [''];
  const stack: JsonTreeNode[] = [createRootNode(data)];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.depth >= maxDepth || !node.hasChildren) continue;
    for (const child of childTreeNodes(node, childrenCache)) {
      if (child.hasChildren) pointers.push(child.pointer);
      stack.push(child);
    }
  }
  return pointers;
}

function collapseAll(): void {
  // The root row always renders so users can re-expand from it.
  expanded.value = new Set<string>();
  viewportTop.value = 0;
  if (viewport.value) viewport.value.scrollTop = 0;
}

defineExpose({ expandAll, collapseAll, revealPointer });
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="data !== null"
      ref="viewport"
      data-testid="tree-viewport"
      class="min-h-0 flex-1 overflow-auto focus-visible:outline-accent"
      role="tree"
      aria-label="JSON tree"
      :aria-activedescendant="`tree-node-${encodeURIComponent(flatNodes[selectedIndex]?.pointer ?? '')}`"
      tabindex="0"
      @scroll="onScroll"
      @keydown="onKeydown"
    >
      <div class="relative w-max min-w-full" :style="{ height: `${totalHeight}px` }">
        <div :style="{ transform: `translateY(${windowOffset}px)` }">
          <TreeRow
            v-for="(node, offset) in visibleNodes"
            :key="node.pointer"
            :node="node"
            :expanded="expanded.has(node.pointer)"
            :matched="matchPointers.has(node.pointer)"
            :active="windowRange.first + offset === selectedIndex"
            :indent-step="14"
            @toggle="onToggle(node, windowRange.first + offset)"
            @select="selectedIndex = windowRange.first + offset"
            @copy-value="copyValue(node)"
            @copy-path="copyPath(node)"
            @copy-inner="copyInner(node)"
          />
        </div>
      </div>
    </div>
    <div v-else class="flex flex-1 items-center justify-center p-6 text-center text-xs text-fg-faint">
      <p>Enter valid JSON to explore it as an interactive tree.</p>
    </div>
  </div>
</template>
