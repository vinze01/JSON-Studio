<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import IconButton from './IconButton.vue';

interface Props {
  open: boolean;
  title: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const dialogElement = ref<HTMLElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick();
      dialogElement.value?.focus();
    }
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
  }
}

function onClickOutside(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (target && !dialogElement.value?.contains(target)) {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click="onClickOutside"
        @keydown="onKeydown"
      >
        <div
          ref="dialogElement"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          class="panel max-h-[85vh] w-[min(92vw,420px)] overflow-auto p-4 shadow-xl outline-none"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">{{ title }}</h2>
            <IconButton title="Close dialog" @click="emit('close')">
              <X class="size-4" aria-hidden="true" />
            </IconButton>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
