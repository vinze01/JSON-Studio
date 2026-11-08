<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { debounce } from '@/lib/utils';
import { errorHighlightRange } from '@/utils/json/error-highlight';
import type { JsonDiagnostic } from '@/types';

interface Props {
  text: string;
  placeholder?: string;
  /** Current syntax error; when present, the offending text is highlighted. */
  error?: JsonDiagnostic | null;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Paste JSON here, or drop a .json file…',
  error: null,
});

const emit = defineEmits<{
  'update:text': [text: string];
  commit: [];
}>();

const localText = ref(props.text);

watch(
  () => props.text,
  (text) => {
    if (text !== localText.value) localText.value = text;
  },
);

const scheduleCommit = debounce(() => emit('commit'), 350);

function onInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value;
  localText.value = value;
  emit('update:text', value);
  scheduleCommit();
}

/* ------------------------- error highlight overlay ------------------------ */
/* A mirror <pre> with identical typography sits behind the (transparent)
   textarea and renders the offending slice with a background — the standard
   text-mapped overlay trick. It only mounts while the document is invalid,
   so the happy editing path pays nothing. */

const textarea = ref<HTMLTextAreaElement | null>(null);
const mirror = ref<HTMLPreElement | null>(null);

/** Above this size the mirror is skipped (layout cost / memory guard). */
const MIRROR_LIMIT = 1_500_000;
/** leading-5 line pitch declared in Tailwind classes below. */
const LINE_PITCH = 20;

const highlight = computed(() => {
  if (!props.error || localText.value.length > MIRROR_LIMIT) return null;
  return errorHighlightRange(localText.value, props.error);
});

const mirrorParts = computed(() => {
  const range = highlight.value;
  const text = localText.value;
  if (!range || range.end <= range.start) return null;
  return {
    before: text.slice(0, range.start),
    marked: text.slice(range.start, Math.max(range.end, range.start + 1)),
    after: text.slice(Math.max(range.end, range.start + 1)),
  };
});

function onScroll(event: Event): void {
  const source = event.target as HTMLTextAreaElement;
  if (mirror.value) {
    mirror.value.scrollTop = source.scrollTop;
    mirror.value.scrollLeft = source.scrollLeft;
  }
}

/** Jumps the caret to the error and scrolls the failing line to mid-view. */
function revealError(): void {
  const source = textarea.value;
  if (!source) return;
  const range = highlight.value;
  const start = errorStart();
  source.focus();
  source.setSelectionRange(start, Math.max(range?.end ?? start, start + 1));
  const lineIndex = countNewlines(localText.value, start);
  const half = Math.max(source.clientHeight, 0) / 2;
  const target = Math.max(0, lineIndex * LINE_PITCH - half + LINE_PITCH);
  source.scrollTop = target;
  if (mirror.value) {
    mirror.value.scrollTop = target;
    mirror.value.scrollLeft = source.scrollLeft;
  }
}

function errorStart(): number {
  const range = highlight.value;
  if (range) {
    return Math.min(range.start, localText.value.length);
  }
  return Math.min(props.error?.offset ?? 0, localText.value.length);
}

function countNewlines(text: string, until: number): number {
  let count = 0;
  for (let i = 0; i < until && i < text.length; i++) {
    if (text[i] === '\n') count++;
  }
  return count;
}

defineExpose({ revealError });
</script>

<template>
  <!-- Layering invariant: the mirror is absolutely positioned inside this
       relative wrapper, and the textarea must stay `relative` so it paints
       after (above) the mirror — positioned elements paint above static
       siblings. Without it the mirror's box swallowed the editor text. -->
  <div class="relative flex h-full min-h-0 flex-col">
    <pre
      v-if="mirrorParts"
      ref="mirror"
      aria-hidden="true"
      data-testid="error-highlight"
      class="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words bg-transparent p-3 font-mono text-xs leading-5 text-transparent [scrollbar-gutter:stable]"
    ><span class="contents">{{ mirrorParts.before }}</span><span class="error-hl">{{ mirrorParts.marked }}</span><span class="contents">{{ mirrorParts.after }}</span></pre>
    <textarea
      ref="textarea"
      class="relative min-h-0 w-full flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 text-fg caret-fg outline-none placeholder:text-fg-faint [scrollbar-gutter:stable]"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      aria-label="JSON input editor"
      data-testid="json-input"
      :placeholder="placeholder"
      :value="localText"
      @input="onInput"
      @scroll="onScroll"
    />
  </div>
</template>

<style scoped>
.error-hl {
  background: color-mix(in srgb, var(--app-danger) 30%, transparent);
  border-radius: 2px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-danger) 45%, transparent);
}
</style>
