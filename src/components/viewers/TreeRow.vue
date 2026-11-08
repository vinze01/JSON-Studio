<script setup lang="ts">
import { Braces, Brackets, ChevronRight, Copy, Hash, Link, Minus, Parentheses, SquareArrowOutUpRight, ToggleLeft } from 'lucide-vue-next';
import { computed } from 'vue';
import type { JsonTreeNode } from '@/types';

interface Props {
  node: JsonTreeNode;
  expanded: boolean;
  matched: boolean;
  active: boolean;
  /** Pixel indent per depth level. */
  indentStep?: number;
}

const props = withDefaults(defineProps<Props>(), { indentStep: 14 });

const emit = defineEmits<{
  toggle: [];
  select: [];
  'copy-value': [];
  'copy-path': [];
  'copy-inner': [];
}>();

/** Strings that look like a bare HTTP(S) URL render as clickable links. */
const urlHref = computed((): string | null => {
  if (props.node.type !== 'string') return null;
  const raw = props.node.value;
  if (typeof raw !== 'string') return null;
  // Avoid rendering very long strings as links; a URL of >2048 chars is unusual.
  if (raw.length === 0 || raw.length > 2048) return null;
  return /^https?:\/\/[^\s]+$/.test(raw) ? raw : null;
});

const indent = computed(() => 6 + props.node.depth * props.indentStep);

const typeIcon = computed(() => {
  switch (props.node.type) {
    case 'object':
      return Braces;
    case 'array':
      return Brackets;
    case 'number':
      return Hash;
    case 'boolean':
      return ToggleLeft;
    case 'null':
      return Minus;
    default:
      return null;
  }
});

const valueClass = computed(() => {
  switch (props.node.type) {
    case 'string':
      return 'text-type-string';
    case 'number':
      return 'text-type-number';
    case 'boolean':
      return 'text-type-boolean';
    case 'null':
      return 'text-type-null';
    default:
      return 'text-fg-muted';
  }
});

const valueText = computed((): string => {
  const { type, value } = props.node;
  switch (type) {
    case 'string':
      return JSON.stringify(value as string);
    case 'number':
      return String(value as number);
    case 'boolean':
      return (value as boolean) ? 'true' : 'false';
    case 'null':
      return 'null';
    case 'object':
      return '{ … }';
    case 'array':
      return '[ … ]';
    default:
      return '';
  }
});

const ariaLabel = computed(() => {
  const kind =
    props.node.type === 'object'
      ? 'object'
      : props.node.type === 'array'
        ? 'array'
        : `${props.node.type} value`;
  return `${props.node.label || 'root'}: ${kind}${props.node.summary ? `, ${props.node.summary}` : ''}`;
});
</script>

<template>
  <div
    :id="`tree-node-${encodeURIComponent(node.pointer)}`"
    role="treeitem"
    :aria-expanded="node.hasChildren ? expanded : undefined"
    :aria-selected="active"
    :aria-level="node.depth + 1"
    :aria-label="ariaLabel"
    class="group relative flex h-[22px] cursor-default select-none items-center gap-1 pr-2 text-xs leading-none"
    :class="active ? 'bg-surface-inset ring-1 ring-inset ring-accent/50 font-medium' : matched ? 'bg-accent-soft' : 'hover:bg-surface-inset/70'"
    :style="{ paddingLeft: `${indent}px` }"
    @click="node.hasChildren ? emit('toggle') : emit('select')"
    @dblclick="emit('select')"
  >
    <!-- Visual indentation guide line for nested levels -->
    <span
      v-if="node.depth > 0"
      class="pointer-events-none absolute top-0 bottom-0 w-px bg-border/40"
      :style="{ left: `${indent - 10}px` }"
      aria-hidden="true"
    />
    <span class="flex h-4 w-4 shrink-0 items-center justify-center">
      <button
        v-if="node.hasChildren"
        type="button"
        class="flex h-4 w-4 items-center justify-center rounded text-fg-muted transition-transform duration-150 hover:text-fg"
        :class="expanded ? 'rotate-90' : ''"
        :aria-label="expanded ? `Collapse ${node.label || 'root'}` : `Expand ${node.label || 'root'}`"
        :tabindex="-1"
        @click.stop="emit('toggle')"
      >
        <ChevronRight class="size-3" aria-hidden="true" />
      </button>
    </span>

    <component
      :is="typeIcon"
      v-if="typeIcon && node.hasChildren"
      class="size-3 shrink-0 text-fg-faint"
      aria-hidden="true"
    />

    <span
      v-if="node.isIndex"
      class="max-w-[35%] shrink-0 truncate font-mono tabular-nums text-type-index"
      :title="`index ${node.label}`"
      >[{{ node.label }}]</span
    >
    <span
      v-else-if="node.label !== 'root'"
      class="max-w-[35%] shrink-0 truncate font-mono text-type-key"
      :title="node.label"
      >{{ node.label }}</span
    >
    <span v-if="node.label !== 'root'" class="shrink-0 font-mono text-fg-faint">:</span>

    <span v-if="!node.hasChildren" class="min-w-0 flex-1">
      <a
        v-if="urlHref"
        data-testid="tree-url-link"
        :href="urlHref"
        class="inline-flex max-w-full items-center gap-1 break-all font-mono no-underline hover:underline"
        :class="valueClass"
        :title="`${urlHref} (opens in a new tab)`"
        target="_blank"
        rel="noopener noreferrer"
        :tabindex="-1"
        @click.stop
      >
        {{ valueText }}
        <SquareArrowOutUpRight class="size-3 shrink-0" aria-hidden="true" />
      </a>
      <span v-else class="block break-all font-mono" :class="valueClass" :title="valueText">{{ valueText }}</span>
    </span>
    <span v-else class="min-w-0 flex-1">
      <span class="block text-fg-faint">{{ node.summary }}</span>
    </span>

    <span
      class="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <button
        type="button"
        class="flex size-5 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg"
        :aria-label="`Copy JSON Pointer path of ${node.label || 'root'}`"
        :tabindex="-1"
        @click.stop="emit('copy-path')"
      >
        <Link class="size-3" aria-hidden="true" />
      </button>
      <button
        v-if="node.hasChildren"
        type="button"
        class="flex size-5 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg"
        :aria-label="`Copy inner JSON of ${node.label || 'root'} without the outer braces`"
        :tabindex="-1"
        @click.stop="emit('copy-inner')"
      >
        <Parentheses class="size-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex size-5 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg"
        :aria-label="node.hasChildren ? `Copy outer JSON of ${node.label || 'root'} subtree` : `Copy value of ${node.label || 'root'}`"
        :tabindex="-1"
        @click.stop="emit('copy-value')"
      >
        <Copy class="size-3" aria-hidden="true" />
      </button>
    </span>
  </div>
</template>
