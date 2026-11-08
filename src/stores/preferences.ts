import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Preferences, ThemeOption, ViewMode } from '@/types';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from '@/lib/browser/preferences';

export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref<ThemeOption>(DEFAULT_PREFERENCES.theme);
  const indent = ref<2 | 4>(DEFAULT_PREFERENCES.indent);
  const wrap = ref<boolean>(DEFAULT_PREFERENCES.wrap);
  const defaultView = ref<ViewMode>(DEFAULT_PREFERENCES.defaultView);
  const losslessNumbers = ref<boolean>(DEFAULT_PREFERENCES.losslessNumbers);
  const loaded = ref(false);

  async function load(): Promise<void> {
    const stored = await loadPreferences();
    theme.value = stored.theme;
    indent.value = stored.indent;
    wrap.value = stored.wrap;
    defaultView.value = stored.defaultView;
    losslessNumbers.value = stored.losslessNumbers;
    loaded.value = true;
  }

  async function update(patch: Partial<Preferences>): Promise<void> {
    if (patch.theme !== undefined) theme.value = patch.theme;
    if (patch.indent !== undefined) indent.value = patch.indent;
    if (patch.wrap !== undefined) wrap.value = patch.wrap;
    if (patch.defaultView !== undefined) defaultView.value = patch.defaultView;
    if (patch.losslessNumbers !== undefined) losslessNumbers.value = patch.losslessNumbers;
    await savePreferences({
      theme: theme.value,
      indent: indent.value,
      wrap: wrap.value,
      defaultView: defaultView.value,
      losslessNumbers: losslessNumbers.value,
    });
  }

  async function reset(): Promise<void> {
    await update({ ...DEFAULT_PREFERENCES });
  }

  return { theme, indent, wrap, defaultView, losslessNumbers, loaded, load, update, reset };
});
