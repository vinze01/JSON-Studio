<script setup lang="ts">
interface Props {
  variant?: 'default' | 'primary' | 'danger-quiet';
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  disabled: false,
  title: undefined,
  ariaLabel: undefined,
  ariaPressed: undefined,
});

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    type="button"
    class="btn"
    :class="[
      variant === 'primary' ? 'btn-primary' : '',
      variant === 'danger-quiet' ? 'btn-danger-quiet' : '',
    ]"
    :title="title"
    :aria-label="ariaLabel"
    :aria-pressed="ariaPressed"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
