<script setup lang="ts">
import { computed } from 'vue';
import type { ViewMode } from '@/types';
import { formatBytes } from '@/utils/json/stats';

type Status = 'valid' | 'invalid' | 'empty' | 'scanning';

interface Props {
  status: Status;
  rootTypeLabel: string;
  items: number | null;
  depth: number;
  sizeBytes: number;
  viewMode: ViewMode;
  sourceLabel?: string;
}

const props = defineProps<Props>();

const validity = computed(() =>
  props.status === 'valid'
    ? { text: 'Valid', tone: 'bg-[var(--app-success)]' }
    : props.status === 'invalid'
      ? { text: 'Invalid', tone: 'bg-[var(--app-danger)]' }
      : props.status === 'scanning'
        ? { text: 'Processing', tone: 'bg-[var(--app-warning)]' }
        : { text: 'Empty', tone: 'bg-[var(--app-fg-faint)]' },
);

const itemsLabel = computed(() => {
  if (props.items === null) return null;
  return props.items === 1 ? `1 ${props.rootTypeLabel === 'array' ? 'item' : 'key'}` : `${props.items} ${props.rootTypeLabel === 'array' ? 'items' : 'keys'}`;
});

const modeLabel = computed(
  () =>
    ({ tree: 'Tree view', code: 'Code view', raw: 'Raw view' })[props.viewMode as ViewMode] ?? props.viewMode,
);
</script>

<template>
  <footer class="flex h-7 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-surface px-3 text-[11px] text-fg-muted">
    <span class="flex shrink-0 items-center gap-1.5">
      <span class="inline-block size-2 rounded-full" :class="validity.tone" aria-hidden="true" />
      <span aria-live="polite">{{ validity.text }}</span>
    </span>
    <span v-if="rootTypeLabel !== 'none'" class="shrink-0 truncate" :title="rootTypeLabel">Type: {{ rootTypeLabel }}</span>
    <span v-if="itemsLabel" class="shrink-0">{{ itemsLabel }}</span>
    <span v-if="depth > 0" class="shrink-0">Depth: {{ depth }}</span>
    <span v-if="sizeBytes > 0" class="shrink-0" :title="`${sizeBytes} bytes`">{{ formatBytes(sizeBytes) }}</span>
    <span v-if="sourceLabel" class="shrink-0 truncate" :title="sourceLabel">{{ sourceLabel }}</span>
    <span class="ml-auto hidden shrink-0 sm:inline">{{ modeLabel }}</span>
  </footer>
</template>
