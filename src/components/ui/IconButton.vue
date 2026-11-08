<script setup lang="ts">
interface Props {
  title: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), { disabled: false });

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <button
    type="button"
    class="btn-icon"
    :title="title"
    :aria-label="title"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
