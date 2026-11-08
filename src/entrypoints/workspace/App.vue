<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { FileJson } from 'lucide-vue-next';
import AppHeader from '@/components/layout/AppHeader.vue';
import StatusBar from '@/components/layout/StatusBar.vue';
import Toolbar from '@/components/workspace/Toolbar.vue';
import SearchPanel from '@/components/workspace/SearchPanel.vue';
import SettingsModal from '@/components/workspace/SettingsModal.vue';
import ErrorBanner from '@/components/workspace/ErrorBanner.vue';
import EditorPane from '@/components/workspace/EditorPane.vue';
import TreeView from '@/components/viewers/TreeView.vue';
import CodeView from '@/components/viewers/CodeView.vue';
import RawView from '@/components/viewers/RawView.vue';
import ToastHost from '@/components/ui/ToastHost.vue';
import { useDocumentStore } from '@/stores/document';
import { usePreferencesStore } from '@/stores/preferences';
import { useToastStore } from '@/stores/toast';
import { applyTheme } from '@/lib/utils';
import { downloadText, readFileText, timestampedFilename } from '@/lib/browser/files';
import { searchJson } from '@/utils/json/search';
import { stringifyJson } from '@/utils/json/format';
import { reprintJson } from '@/utils/json/reprint';
import { jsonToTypeScript } from '@/utils/json/typegen';
import type { SearchMatch, SourceInfo } from '@/types';

const documentStore = useDocumentStore();
const preferences = usePreferencesStore();
const toast = useToastStore();

/* -------------------------------- theming -------------------------------- */

const effectiveTheme = ref<'light' | 'dark'>('light');

function resolveTheme(): void {
  effectiveTheme.value = applyTheme(preferences.theme);
}

watch(
  () => preferences.theme,
  () => resolveTheme(),
);

const darkMedia =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

darkMedia?.addEventListener('change', () => {
  if (preferences.theme === 'system') resolveTheme();
});

function toggleTheme(): void {
  void preferences.update({ theme: effectiveTheme.value === 'dark' ? 'light' : 'dark' });
}

/* ------------------------------- document -------------------------------- */

const settingsOpen = ref(false);
const searchOpen = ref(false);
const dragActive = ref(false);
const treeRef = ref<InstanceType<typeof TreeView> | null>(null);
const editorRef = ref<InstanceType<typeof EditorPane> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

/** Formatted text for the code/raw views; falls back to raw input when invalid. */
const contentText = computed(() => {
  if (documentStore.parseResult?.ok === true) return formatOutput(false);
  return documentStore.inputText;
});

const status = computed<'valid' | 'invalid' | 'empty'>(() => {
  if (documentStore.isEmpty) return 'empty';
  return documentStore.isValid ? 'valid' : 'invalid';
});

const rootTypeLabel = computed(() => {
  const root = documentStore.stats.rootType;
  return root === 'empty' || root === 'invalid' ? 'none' : root;
});

const sourceLabel = computed(() => {
  const source: SourceInfo = documentStore.source;
  if (source.origin === 'tab' && source.pageUrl) {
    return `Page: ${source.pageUrl.replace(/^https?:\/\//, '')}`;
  }
  if (source.origin === 'file') return 'Imported file';
  return undefined;
});

/* ------------------------------- actions --------------------------------- */

function onEditorCommit(): void {
  documentStore.refresh();
}

function onFormat(): void {
  const result = documentStore.format();
  if (result.ok) toast.success('Formatted');
  else toast.error('Cannot format - the JSON is invalid');
}

function onMinify(): void {
  const result = documentStore.minify();
  if (result.ok) toast.success('Minified');
  else toast.error('Cannot minify - the JSON is invalid');
}

function onRepair(): void {
  const outcome = documentStore.repair();
  if (outcome.ok) {
    const summary = outcome.repairsApplied.join(', ') || 'Repaired';
    toast.success(`Repaired JSON: ${summary}`);
  } else {
    toast.error('Could not auto-repair this JSON. Check the syntax error details.');
  }
}

function onCopyTypeScript(): void {
  if (documentStore.data === null) {
    toast.error('Cannot generate TypeScript - the JSON is invalid');
    return;
  }
  const ts = jsonToTypeScript(documentStore.data, 'Root', preferences.indent);
  void toast.copyWithToast(ts, 'TypeScript interfaces copied');
}

function onValidate(): void {
  documentStore.refresh();
  if (documentStore.isValid) {
    toast.success('Valid JSON');
    return;
  }
  toast.error(documentStore.error?.message ?? 'Invalid JSON');
  // Jump the caret to the offending slice and scroll it into view.
  nextTick(() => editorRef.value?.revealError());
}

function onCopyRaw(): void {
  void toast.copyWithToast(documentStore.inputText, 'Document copied');
}

function onCopyFormatted(): void {
  if (documentStore.parseResult?.ok !== true) {
    toast.error('Cannot copy - the JSON is invalid');
    return;
  }
  void toast.copyWithToast(formatOutput(false), 'Formatted JSON copied');
}

function onCopyMinified(): void {
  if (documentStore.parseResult?.ok !== true) {
    toast.error('Cannot copy - the JSON is invalid');
    return;
  }
  void toast.copyWithToast(formatOutput(true), 'Minified JSON copied');
}

/**
 * Serializes the current document for copy/export. Honours the lossless
 * preference: the source text is reprinted verbatim instead of round-tripping
 * through parsed doubles that may not preserve large numbers or key order.
 */
function formatOutput(minified: boolean): string {
  const indent: 0 | 2 | 4 = minified ? 0 : preferences.indent;
  if (preferences.losslessNumbers) {
    const result = reprintJson(documentStore.inputText, indent);
    if (result.ok) return result.text;
  }
  const parse = documentStore.parseResult;
  if (parse?.ok === true) return stringifyJson(parse.data, indent);
  return documentStore.inputText;
}
function onToggleSearch(): void {
  if (searchOpen.value) {
    closeSearch();
  } else {
    searchOpen.value = true;
  }
}

/* -------------------------------- search ---------------------------------- */

const matches = ref<SearchMatch[]>([]);
const matchesTruncated = ref(false);
const activeMatchIndex = ref(-1);
const searchCase = ref(false);
const searchKeys = ref(true);
const searchValues = ref(true);
const searchQuery = ref('');

const matchPointers = computed(() => new Set(matches.value.map((match) => match.pointer)));
const activePointer = computed(() => matches.value[activeMatchIndex.value]?.pointer ?? null);

function runSearch(query: string): void {
  const data = documentStore.data;
  if (query === '' || data === null) {
    matches.value = [];
    matchesTruncated.value = false;
    activeMatchIndex.value = -1;
    return;
  }
  const outcome = searchJson(data, {
    query,
    caseSensitive: searchCase.value,
    matchKeys: searchKeys.value,
    matchValues: searchValues.value,
  });
  matches.value = outcome.matches;
  matchesTruncated.value = outcome.truncated;
  activeMatchIndex.value = outcome.matches.length > 0 ? 0 : -1;
  if (outcome.matches.length === 0) {
    toast.info('No matching keys or values');
  } else {
    if (documentStore.viewMode !== 'tree') documentStore.setViewMode('tree');
    treeRef.value?.revealPointer(outcome.matches[0]!.pointer);
  }
}

watch(searchQuery, (query) => runSearch(query));
watch([searchCase, searchKeys, searchValues], () => runSearch(searchQuery.value));

function onNextMatch(): void {
  if (matches.value.length === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value + 1) % matches.value.length;
  revealActiveMatch();
}

function onPreviousMatch(): void {
  if (matches.value.length === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value - 1 + matches.value.length) % matches.value.length;
  revealActiveMatch();
}

function revealActiveMatch(): void {
  const match = matches.value[activeMatchIndex.value];
  if (match) treeRef.value?.revealPointer(match.pointer);
}

function closeSearch(): void {
  searchOpen.value = false;
  searchQuery.value = '';
  matches.value = [];
  activeMatchIndex.value = -1;
}

/* ---------------------------- import / export ----------------------------- */

async function importFiles(files: File[]): Promise<void> {
  const file = files[0];
  if (!file) return;
  const outcome = await readFileText(file);
  if (!outcome.ok) {
    toast.error(outcome.message);
    return;
  }
  documentStore.setDocument(outcome.text, { origin: 'file' });
  if (documentStore.isValid) toast.success(`Imported ${file.name}`);
  else toast.error(`Imported ${file.name}, but the content is invalid JSON`);
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  void importFiles(files);
}

function onDrop(event: DragEvent): void {
  dragActive.value = false;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length > 0) void importFiles(files);
}

function onDragOver(): void {
  if (!dragActive.value) dragActive.value = true;
}

let dragLeaveTimer: number | undefined;

function onDragLeave(): void {
  // child dragleave events bubble; only hide if no new dragover follows soon
  window.clearTimeout(dragLeaveTimer);
  dragLeaveTimer = window.setTimeout(() => {
    dragActive.value = false;
  }, 80);
}

function exportDocument(minified: boolean): void {
  if (!documentStore.isValid || !documentStore.data) {
    toast.error('Cannot export - the JSON is invalid');
    return;
  }
  downloadText(timestampedFilename('json-studio', minified), formatOutput(minified));
  toast.success(minified ? 'Minified file exported' : 'Formatted file exported');
}

function onClear(): void {
  documentStore.clear();
  toast.info('Document cleared');
}

/* --------------------------------- mount ---------------------------------- */

onMounted(async () => {
  resolveTheme();
  documentStore.setViewMode(preferences.defaultView);
  const wantsTabPayload = new URLSearchParams(window.location.search).get('source') === 'tab';
  if (wantsTabPayload) {
    const loaded = await documentStore.loadPendingFromTab();
    if (loaded) {
      toast.success('Loaded JSON captured from the page');
    } else {
      toast.info('No captured document found. Open this workspace directly to paste JSON.');
    }
  }
});
</script>

<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-bg"
    data-testid="workspace-root"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <AppHeader
      :theme="preferences.theme"
      :status="status"
      :source-label="sourceLabel"
      @toggle-theme="toggleTheme"
      @open-settings="settingsOpen = true"
    />

    <Toolbar
      v-model:view-mode="documentStore.viewMode"
      :is-empty="documentStore.isEmpty"
      :is-valid="documentStore.isValid"
      :search-open="searchOpen"
      @format="onFormat"
      @minify="onMinify"
      @repair="onRepair"
      @validate="onValidate"
      @expand-all="treeRef?.expandAll()"
      @collapse-all="treeRef?.collapseAll()"
      @copy-raw="onCopyRaw"
      @copy-formatted="onCopyFormatted"
      @copy-minified="onCopyMinified"
      @copy-ts="onCopyTypeScript"
      @import="fileInput?.click()"
      @export-formatted="exportDocument(false)"
      @export-minified="exportDocument(true)"
      @clear="onClear"
      @toggle-search="onToggleSearch"
    />

    <SearchPanel
      v-if="searchOpen"
      :result-count="matches.length"
      :truncated="matchesTruncated"
      :active-index="activeMatchIndex"
      :case-sensitive="searchCase"
      :match-keys="searchKeys"
      :match-values="searchValues"
      @update:query="searchQuery = $event"
      @toggle-case="searchCase = !searchCase"
      @toggle-keys="searchKeys = !searchKeys"
      @toggle-values="searchValues = !searchValues"
      @next="onNextMatch"
      @previous="onPreviousMatch"
      @close="closeSearch"
    />

    <main class="flex min-h-0 flex-1 flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
      <section aria-label="JSON input" class="flex h-[45vh] min-w-0 flex-1 flex-col bg-surface lg:h-auto">
        <EditorPane
          ref="editorRef"
          :text="documentStore.inputText"
          :error="documentStore.error"
          placeholder="Paste JSON here, or drop a .json file…"
          @update:text="documentStore.inputText = $event"
          @commit="onEditorCommit"
        />
      </section>

      <section
        aria-label="Formatted output"
        class="relative flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[1.2]"
      >
        <ErrorBanner
          v-if="!documentStore.isEmpty && (documentStore.error !== null || documentStore.scanResult !== null)"
          :error="documentStore.error"
          :scan="documentStore.error === null ? documentStore.scanResult : null"
          @repair="onRepair"
        />
        <div v-if="documentStore.isEmpty" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-fg-faint">
          <FileJson class="size-10 opacity-60" aria-hidden="true" />
          <p class="max-w-xs text-xs leading-relaxed">
            Paste JSON, drop a .json file, or inspect a page from the extension popup.
          </p>
        </div>
        <div v-else class="min-h-0 flex-1 overflow-hidden">
          <div v-show="documentStore.viewMode === 'tree'" class="h-full">
            <TreeView
              ref="treeRef"
              :data="documentStore.data"
              :match-pointers="matchPointers"
              :active-pointer="activePointer"
            />
          </div>
          <div v-show="documentStore.viewMode === 'code'" class="h-full">
            <CodeView
              :text="contentText"
              :error="documentStore.error"
              :wrap="preferences.wrap"
              :dark="effectiveTheme === 'dark'"
            />
          </div>
          <div v-show="documentStore.viewMode === 'raw'" class="h-full">
            <RawView :text="contentText" :wrap="preferences.wrap" />
          </div>
        </div>
      </section>
    </main>

    <StatusBar
      :status="status"
      :root-type-label="rootTypeLabel"
      :items="documentStore.stats.items"
      :depth="documentStore.stats.depth"
      :size-bytes="documentStore.stats.sizeBytes"
      :view-mode="documentStore.viewMode"
      :source-label="sourceLabel"
    />

    <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />
    <ToastHost />

    <Teleport to="body">
      <div
        v-if="dragActive"
        class="pointer-events-none fixed inset-2 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent-soft/80"
        role="status"
        aria-label="Drop a file to import"
      >
        <p class="text-xs font-medium text-accent-strong">Drop a .json file to import</p>
      </div>
    </Teleport>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json,.txt"
      class="hidden"
      data-testid="file-input"
      @change="onFileChange"
    />
  </div>
</template>
