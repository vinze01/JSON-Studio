<script setup lang="ts">
import type { ToolbarOption } from '@/types';

interface Props {
  options: readonly ToolbarOption[];
  label: string;
}

defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const modelValue = defineModel<string>({ required: true });

function onSelect(option: ToolbarOption): void {
  if (modelValue.value === option.value) return;
  modelValue.value = option.value;
  emit('update:modelValue', option.value);
}
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex items-center rounded-md border border-border bg-surface-inset p-0.5">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="flex h-6 items-center gap-1.5 rounded px-2 text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      :class="
        modelValue === option.value
          ? 'bg-surface text-accent font-semibold shadow-xs ring-1 ring-border/80 dark:bg-surface-raised dark:text-accent-strong'
          : 'text-fg-muted hover:text-fg hover:bg-surface/50'
      "
      :aria-checked="modelValue === option.value"
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
