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
  // SettingsModal mounts Modal with open already true, so the change
  // callback alone never fires - the dialog must grab focus on mount too,
  // otherwise Esc (bound on the overlay) never reaches it.
  { immediate: true },
);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key === 'Tab') trapFocus(event);
}

/**
 * Keeps keyboard focus inside the dialog: Tab / Shift+Tab wrap within the
 * dialog's focusable elements instead of escaping into the page behind the
 * overlay (WCAG 2.4.3 focus order; the trap is inert for non-dialog targets).
 */
function trapFocus(event: KeyboardEvent): void {
  const dialog = dialogElement.value;
  if (!dialog || !dialog.contains(event.target as Node)) return;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    ),
  );
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  const inList = focusable.includes(active as HTMLElement);
  if (event.shiftKey) {
    // Wrap backwards from the first stop; park on the last from elsewhere.
    if (active === first || !inList) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !inList) {
    event.preventDefault();
    first.focus();
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
