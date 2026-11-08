<script setup lang="ts">
import { CircleCheck, CircleX, Info, X } from 'lucide-vue-next';
import { useToastStore } from '@/stores/toast';

const store = useToastStore();

const icons = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
} as const;

const tones = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent',
} as const;
</script>

<template>
  <div aria-live="polite" aria-atomic="false" class="pointer-events-none fixed bottom-3 left-1/2 z-[60] -translate-x-1/2">
    <TransitionGroup
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        role="status"
        class="pointer-events-auto mt-2 flex max-w-[70vw] items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs shadow-lg"
      >
        <component :is="icons[toast.kind]" class="size-4 shrink-0" :class="tones[toast.kind]" aria-hidden="true" />
        <span class="min-w-0 break-words">{{ toast.message }}</span>
        <button type="button" class="btn-icon size-5" aria-label="Dismiss notification" @click="store.dismiss(toast.id)">
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
