<script setup lang="ts">
import type { ToolbarOption } from '@/types';

interface Props {
  options: readonly ToolbarOption[];
  label: string;
}

const props = defineProps<Props>();
const modelValue = defineModel<string>({ required: true });

function onSelect(option: ToolbarOption): void {
  if (modelValue.value === option.value) return;
  // defineModel emits 'update:modelValue' on assignment.
  modelValue.value = option.value;
}

/**
 * ARIA radio-group pattern with roving tabindex: the checked radio is the
 * only tab stop (tabindex 0), Arrow keys move selection and focus across the
 * group - without this, screen readers announce radios that ignore the
 * arrow-key contract.
 */
function onGroupKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const index = props.options.findIndex((option) => option.value === modelValue.value);
  if (index === -1) return;
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const next = props.options[(index + step + props.options.length) % props.options.length]!;
  event.preventDefault();
  modelValue.value = next.value;
  const group = event.currentTarget as HTMLElement;
  group.querySelector<HTMLButtonElement>(`button[data-value="${CSS.escape(next.value)}"]`)?.focus();
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="inline-flex items-center rounded-md border border-border bg-surface-inset p-0.5"
    @keydown="onGroupKeydown"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :data-value="option.value"
      class="flex h-6 items-center gap-1.5 rounded px-2 text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      :class="
        modelValue === option.value
          ? 'bg-surface text-accent font-semibold shadow-xs ring-1 ring-border/80 dark:bg-surface-raised dark:text-accent-strong'
          : 'text-fg-muted hover:text-fg hover:bg-surface/50'
      "
      :aria-checked="modelValue === option.value"
      :tabindex="modelValue === option.value ? 0 : -1"
      :data-active="modelValue === option.value ? '' : undefined"
      :title="option.label"
      @click="onSelect(option)"
    >
      <component
        :is="option.icon"
        class="size-3.5"
        :class="modelValue === option.value ? 'text-accent dark:text-accent-strong' : 'text-fg-faint'"
        aria-hidden="true"
      />
      <span class="hidden sm:inline">{{ option.label }}</span>
    </button>
  </div>
</template>
