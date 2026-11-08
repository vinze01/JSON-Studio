import type { Preferences, ThemeOption, ViewMode } from '@/types';
import { isExtensionContext } from './storage';

export const PREFS_KEY = 'json-studio:preferences';

const THEMES: ThemeOption[] = ['light', 'dark', 'system'];
const VIEWS: ViewMode[] = ['tree', 'code', 'raw'];

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  indent: 2,
  wrap: true,
  defaultView: 'tree',
  losslessNumbers: true,
};

/** Validates a stored value before trusting it. Anything recognisable is kept;
 *  anything else - including values inherited via prototype pollution - falls
 *  back to defaults. */
export function coercePreferences(value: unknown): Preferences {
  if (value === null || typeof value !== 'object') return { ...DEFAULT_PREFERENCES };
  const raw = value as Record<string, unknown>;
  const own = (key: string): boolean => Object.prototype.hasOwnProperty.call(raw, key);
  const theme = own('theme') && THEMES.includes(raw.theme as ThemeOption) ? (raw.theme as ThemeOption) : DEFAULT_PREFERENCES.theme;
  const indent = own('indent') && raw.indent === 4 ? 4 : 2;
  const wrap = own('wrap') && typeof raw.wrap === 'boolean' ? raw.wrap : DEFAULT_PREFERENCES.wrap;
  const defaultView =
    own('defaultView') && VIEWS.includes(raw.defaultView as ViewMode)
      ? (raw.defaultView as ViewMode)
      : DEFAULT_PREFERENCES.defaultView;
  const losslessNumbers =
    own('losslessNumbers') && typeof raw.losslessNumbers === 'boolean'
      ? raw.losslessNumbers
      : DEFAULT_PREFERENCES.losslessNumbers;
  return { theme, indent, wrap, defaultView, losslessNumbers };
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    if (isExtensionContext() && typeof chrome.storage !== 'undefined') {
      const result = await chrome.storage.local.get(PREFS_KEY);
      return coercePreferences(result?.[PREFS_KEY]);
    }
    const raw = window.localStorage.getItem(PREFS_KEY);
    return coercePreferences(raw === null ? undefined : JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  try {
    if (isExtensionContext() && typeof chrome.storage !== 'undefined') {
      await chrome.storage.local.set({ [PREFS_KEY]: prefs });
      return;
    }
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Persistence failures must never break the session.
  }
}
