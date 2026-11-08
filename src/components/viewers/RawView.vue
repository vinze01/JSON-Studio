<script setup lang="ts">
interface Props {
  text: string;
  wrap: boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="h-full min-h-0 overflow-auto bg-surface p-3">
    <pre
      data-testid="raw-view"
      class="font-mono text-xs"
      :class="wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
      >{{ text }}</pre
    >
  </div>
</template>
