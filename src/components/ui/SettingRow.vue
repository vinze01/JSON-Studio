<script setup lang="ts">
/**
 * One settings row: label (with optional helper text) on the left, its
 * control right-aligned on the other side of the grid.
 */
interface Props {
  /** DOM id of the control this row's label points at. */
  settingId: string;
  label: string;
  description?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-2 items-center gap-2">
    <dt class="pr-2">
      <label class="font-medium" :for="settingId">{{ label }}</label>
      <p v-if="description" class="mt-0.5 text-[11px] leading-snug text-fg-faint">{{ description }}</p>
    </dt>
    <dd class="flex justify-end">
      <slot />
    </dd>
  </div>
</template>
