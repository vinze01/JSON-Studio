<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue';
import SettingRow from '@/components/ui/SettingRow.vue';
import { RotateCcw } from 'lucide-vue-next';
import { usePreferencesStore } from '@/stores/preferences';
import { useToastStore } from '@/stores/toast';
import type { ThemeOption, ViewMode } from '@/types';

const preferences = usePreferencesStore();
const toast = useToastStore();

defineEmits<{ close: [] }>();

const themeOptions: Array<{ value: ThemeOption; label: string }> = [
  { value: 'system', label: 'Follow system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: 'tree', label: 'Tree' },
  { value: 'code', label: 'Code' },
  { value: 'raw', label: 'Raw' },
];

function onSelectTheme(event: Event): void {
  void preferences.update({ theme: (event.target as HTMLSelectElement).value as ThemeOption });
}

function onSelectIndent(event: Event): void {
  void preferences.update({ indent: (event.target as HTMLSelectElement).value === '4' ? 4 : 2 });
}

function onToggleWrap(event: Event): void {
  void preferences.update({ wrap: (event.target as HTMLInputElement).checked });
}

function onToggleLossless(event: Event): void {
  void preferences.update({ losslessNumbers: (event.target as HTMLInputElement).checked });
}

function onSelectDefaultView(event: Event): void {
  void preferences.update({ defaultView: (event.target as HTMLSelectElement).value as ViewMode });
}

async function onReset(): Promise<void> {
  await preferences.reset();
  toast.info('Preferences reset to defaults');
}
</script>

<template>
  <Modal :open="true" title="Settings" @close="$emit('close')">
    <dl class="space-y-4 text-xs">
      <SettingRow setting-id="setting-theme" label="Theme">
        <select id="setting-theme" class="input" :value="preferences.theme" @change="onSelectTheme">
          <option v-for="option in themeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </SettingRow>

      <SettingRow setting-id="setting-indent" label="Indentation">
        <select id="setting-indent" class="input" :value="String(preferences.indent)" @change="onSelectIndent">
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
        </select>
      </SettingRow>

      <SettingRow
        setting-id="setting-wrap"
        label="Wrap long lines"
        description="Applies to the Code and Raw views."
      >
        <input id="setting-wrap" type="checkbox" class="size-4 accent-[var(--app-accent)]" :checked="preferences.wrap" @change="onToggleWrap" />
      </SettingRow>

      <SettingRow
        setting-id="setting-lossless"
        label="Lossless numbers"
        description="Keep long IDs, key order and number spellings exact on format/copy/export."
      >
        <input id="setting-lossless" type="checkbox" class="size-4 accent-[var(--app-accent)]" :checked="preferences.losslessNumbers" @change="onToggleLossless" />
      </SettingRow>

      <SettingRow setting-id="setting-view" label="Default view">
        <select id="setting-view" class="input" :value="preferences.defaultView" @change="onSelectDefaultView">
          <option v-for="option in viewOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </SettingRow>
    </dl>

    <div class="mt-5 flex justify-end border-t border-border pt-3">
      <button type="button" class="btn" @click="onReset">
        <RotateCcw class="size-3.5" aria-hidden="true" />Reset preferences
      </button>
    </div>
  </Modal>
</template>
