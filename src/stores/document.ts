import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { FormatOutcome, JsonValue, ParseResult, ScanResult, SourceInfo, ViewMode } from '@/types';
import { parseJson } from '@/utils/json/parse';
import { scanJson } from '@/utils/json/validate';
import { computeStats } from '@/utils/json/stats';
import { formatJson, minifyJson } from '@/utils/json/format';
import { reprintJson } from '@/utils/json/reprint';
import { repairJson } from '@/utils/json/repair';
import { takePendingDocument } from '@/lib/browser/session';
import { usePreferencesStore } from './preferences';

/** Above this size the diagnostic scan is skipped (JSON.parse still runs). */
const SCAN_CHAR_LIMIT = 20 * 1024 * 1024;

export const useDocumentStore = defineStore('jsonDocument', () => {
  const preferences = usePreferencesStore();

  const inputText = ref('');
  const source = shallowRef<SourceInfo>({ origin: 'editor' });
  const parseResult = shallowRef<ParseResult | null>(null);
  const scanResult = shallowRef<ScanResult | null>(null);
  const viewMode = ref<ViewMode>('tree');
  const processing = ref(false);

  const data = computed<JsonValue | null>(() =>
    parseResult.value?.ok === true ? parseResult.value.data : null,
  );

  const isValid = computed<boolean>(() => parseResult.value?.ok === true);
  const isEmpty = computed<boolean>(() => inputText.value.trim() === '');
  const stats = computed(() =>
    computeStats(inputText.value, isValid.value, data.value, scanResult.value),
  );
  const error = computed(() => {
    if (parseResult.value?.ok === true) return null;
    // Prefer the scanner's diagnostics: they always carry accurate positions,
    // whereas JSON.parse message positions vary across engines.
    const scanError = scanResult.value?.error ?? null;
    if (scanError) return scanError;
    return parseResult.value?.ok === false ? parseResult.value.error : null;
  });

  function refresh(): void {
    parseResult.value = parseJson(inputText.value);
    scanResult.value =
      inputText.value.length > SCAN_CHAR_LIMIT ? null : scanJson(inputText.value);
  }

  function setDocument(text: string, nextSource: SourceInfo | undefined): void {
    inputText.value = text;
    if (nextSource) source.value = nextSource;
    refresh();
  }

  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode;
  }

  function format(indentOverride?: 2 | 4): FormatOutcome {
    const indent = indentOverride ?? preferences.indent;
    const result = preferences.losslessNumbers
      ? reprintJson(inputText.value, indent)
      : formatJson(inputText.value, indent);
    if (!result.ok) {
      return { ok: false, detail: result.message };
    }
    inputText.value = result.text;
    source.value = { ...source.value, origin: source.value.origin };
    refresh();
    return { ok: true, text: result.text };
  }

  function minify(): FormatOutcome {
    const result = preferences.losslessNumbers
      ? reprintJson(inputText.value, 0)
      : minifyJson(inputText.value);
    if (!result.ok) {
      return { ok: false, detail: result.message };
    }
    inputText.value = result.text;
    refresh();
    return { ok: true, text: result.text };
  }

  function clear(): void {
    setDocument('', { origin: 'editor' });
  }

  function repair(): { ok: boolean; repairsApplied: string[] } {
    const outcome = repairJson(inputText.value);
    if (!outcome.ok) {
      return { ok: false, repairsApplied: [] };
    }
    inputText.value = outcome.repairedText;
    refresh();
    return { ok: true, repairsApplied: outcome.repairsApplied };
  }

  /**
   * Loads a document captured from a browser tab (staged in session storage
   * by the background service worker). Returns true when a payload existed.
   */
  async function loadPendingFromTab(): Promise<boolean> {
    const pending = await takePendingDocument();
    if (!pending) return false;
    setDocument(pending.text, {
      origin: 'tab',
      pageUrl: pending.source.pageUrl,
    });
    return true;
  }

  return {
    inputText,
    source,
    parseResult,
    scanResult,
    viewMode,
    processing,
    data,
    isValid,
    isEmpty,
    stats,
    error,
    refresh,
    setDocument,
    setViewMode,
    format,
    minify,
    repair,
    clear,
    loadPendingFromTab,
  };
});
