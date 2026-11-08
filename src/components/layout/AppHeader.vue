<script setup lang="ts">
import { Moon, Sun, Settings, CircleAlert, CircleCheck, CircleMinus } from 'lucide-vue-next';
import { computed } from 'vue';
import IconButton from '@/components/ui/IconButton.vue';
import type { ThemeOption } from '@/types';

type Status = 'valid' | 'invalid' | 'empty';

interface Props {
  theme: ThemeOption;
  status: Status;
  sourceLabel?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'toggle-theme': []; 'open-settings': [] }>();

const statusIcon = computed(() =>
  props.status === 'valid' ? CircleCheck : props.status === 'invalid' ? CircleAlert : CircleMinus,
);
const statusClass = computed(() =>
  props.status === 'valid'
    ? 'text-success'
    : props.status === 'invalid'
      ? 'text-danger'
      : 'text-fg-faint',
);
const statusText = computed(() =>
  props.status === 'valid' ? 'Valid JSON' : props.status === 'invalid' ? 'Invalid JSON' : 'No document',
);

function currentThemeIcon(theme: ThemeOption) {
  return theme === 'dark' ? Moon : Sun;
}
</script>

<template>
  <header class="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
    <span class="flex h-6 w-6 items-center justify-center rounded-md bg-[#171922] font-mono text-[11px] font-bold leading-none text-[#e2e8f0]">
      {{ '{ }' }}
    </span>
    <h1 class="text-sm font-semibold tracking-tight">JSON Studio</h1>

    <div class="ml-2 hidden items-center gap-1.5 text-xs text-fg-muted sm:flex" :title="sourceLabel ?? statusText">
      <component :is="statusIcon" class="size-3.5" :class="statusClass" aria-hidden="true" />
      <span aria-live="polite">{{ statusText }}</span>
    </div>

    <div class="ml-auto flex items-center gap-1">
      <IconButton
        title="Switch between light and dark theme"
        @click="emit('toggle-theme')"
      >
        <component :is="currentThemeIcon(theme)" class="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton title="Open settings" @click="emit('open-settings')">
        <Settings class="size-4" aria-hidden="true" />
      </IconButton>
    </div>
  </header>
</template>
