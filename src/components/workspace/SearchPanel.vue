<script setup lang="ts">
import { ChevronDown, ChevronUp, CaseSensitive, X, Search as SearchIcon, KeySquare, Type } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import IconButton from '@/components/ui/IconButton.vue';
import { debounce } from '@/lib/utils';

interface Props {
  resultCount: number;
  truncated: boolean;
  activeIndex: number;
  caseSensitive: boolean;
  matchKeys: boolean;
  matchValues: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  'update:query': [query: string];
  'toggle-case': [];
  'toggle-keys': [];
  'toggle-values': [];
  next: [];
  previous: [];
  close: [];
}>();

const query = ref('');

const pushQuery = debounce((value: string) => emit('update:query', value), 250);

watch(query, (value) => pushQuery(value));

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (event.shiftKey) emit('previous');
    else emit('next');
  } else if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
}
</script>

<template>
  <form
    class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2"
    role="search"
    aria-label="Search in JSON"
    @keydown="onKeydown"
    @submit.prevent
  >
    <div class="relative min-w-[160px] flex-1 sm:max-w-sm">
      <SearchIcon class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
      <input
        v-model="query"
        type="search"
        class="input pl-7 pr-16"
        placeholder="Search keys and values…"
        aria-label="Search keys and values"
      />
      <span class="absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-fg-faint" aria-live="polite">
        {{ resultCount === 0 ? '0/0' : `${activeIndex + 1}/${resultCount}` }}{{ truncated ? '+' : '' }}
      </span>
    </div>

    <button
      type="button"
      class="btn h-6 px-2"
      :aria-pressed="caseSensitive"
      :title="caseSensitive ? 'Case sensitive: on' : 'Case sensitive: off'"
      @click="emit('toggle-case')"
    >
      <CaseSensitive class="size-3.5" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="btn h-6 px-2"
      :aria-pressed="matchKeys"
      :title="matchKeys ? 'Search in keys: on' : 'Search in keys: off'"
      @click="emit('toggle-keys')"
    >
      <KeySquare class="size-3.5" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="btn h-6 px-2"
      :aria-pressed="matchValues"
      :title="matchValues ? 'Search in values: on' : 'Search in values: off'"
      @click="emit('toggle-values')"
    >
      <Type class="size-3.5" aria-hidden="true" />
    </button>

    <div class="flex items-center gap-0.5">
      <IconButton title="Previous match" :disabled="resultCount === 0" @click="emit('previous')">
        <ChevronUp class="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton title="Next match" :disabled="resultCount === 0" @click="emit('next')">
        <ChevronDown class="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton title="Close search" @click="emit('close')">
        <X class="size-4" aria-hidden="true" />
      </IconButton>
    </div>

    <p v-if="truncated" class="w-full text-[11px] text-fg-faint">
      Showing the first {{ resultCount }} matches. Refine the query for more specific results.
    </p>
  </form>
</template>
