<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BadgeCheck, CircleAlert, ExternalLink, FileJson, Info, Radar } from 'lucide-vue-next';
import { usePreferencesStore } from '@/stores/preferences';
import { applyTheme } from '@/lib/utils';
import { isRestrictedUrl } from '@/lib/page-inspection';

const preferences = usePreferencesStore();

type PopupState = 'unknown' | 'restricted' | 'inspecting' | 'captured' | 'unavailable' | 'error';

interface TabContext {
  status: PopupState;
  detail: string;
}

const context = ref<TabContext>({ status: 'unknown', detail: '' });
const workspaceBusy = ref(false);

const statusIcon = computed(() => {
  switch (context.value.status) {
    case 'captured':
      return BadgeCheck;
    case 'restricted':
      return CircleAlert;
    default:
      return Info;
  }
});

const iconClass = computed(() => (context.value.status === 'captured' ? 'text-success' : 'text-fg-faint'));

const inspectDisabled = computed(
  () =>
    context.value.status === 'restricted' ||
    context.value.status === 'inspecting' ||
    context.value.status === 'captured',
);

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
void isExtension;

async function surfaceContext(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || isRestrictedUrl(tab.url)) {
      context.value = {
        status: 'restricted',
        detail:
          'Browser UI pages and the Chrome Web Store cannot be inspected. Open a normal website, a text/plain page, or a .json response.',
      };
      return;
    }
    context.value = {
      status: 'unknown',
      detail: `Ready to inspect: ${truncateUrl(tab.url)}`,
    };
  } catch {
    context.value = {
      status: 'unknown',
      detail: 'Open a website tab to enable page inspection.',
    };
  }
}

function truncateUrl(url: string | undefined): string {
  if (!url) return 'current page';
  return url.replace(/^https?:\/\//, '').slice(0, 60) || 'current page';
}

async function onInspect(): Promise<void> {
  context.value = { status: 'inspecting', detail: 'Inspecting the current page…' };
  try {
    const result = (await chrome.runtime.sendMessage({ type: 'js:inspect' })) as {
      status: PopupState;
      detail?: string;
    };
    if (result.status === 'captured') {
      context.value = {
        status: 'captured',
        detail: 'Document captured - opening the JSON Studio workspace…',
      };
    } else {
      context.value = {
        status: result.status === 'restricted' ? 'restricted' : 'unavailable',
        detail: result.detail ?? 'No JSON was found on this page.',
      };
    }
  } catch (error) {
    context.value = {
      status: 'error',
      detail: error instanceof Error ? error.message : 'Inspection failed unexpectedly.',
    };
  }
}

function onOpenWorkspace(): void {
  workspaceBusy.value = true;
  void chrome.tabs
    .create({ url: chrome.runtime.getURL('/workspace.html') })
    .then(() => window.close())
    .catch(() => {
      workspaceBusy.value = false;
    });
}

function onOpenSettings(): void {
  onOpenWorkspaceQuery('?settings=1');
}

function onOpenWorkspaceQuery(query: string): void {
  workspaceBusy.value = true;
  void chrome.tabs
    .create({ url: `${chrome.runtime.getURL('/workspace.html')}${query}` })
    .then(() => window.close())
    .catch(() => {
      workspaceBusy.value = false;
    });
}

onMounted(async () => {
  applyTheme(preferences.theme);
  if (preferences.theme === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme(preferences.theme);
    });
  }
  await surfaceContext();
});
</script>

<template>
  <div class="w-[360px] bg-bg text-fg" data-testid="popup-root">
    <header class="flex items-center gap-2 border-b border-border bg-surface px-3 py-3">
      <span class="flex size-6 items-center justify-center rounded-md bg-[#171922] font-mono text-[11px] font-bold text-[#e2e8f0]">
        {{ '{ }' }}
      </span>
      <h1 class="text-sm font-semibold">JSON Studio</h1>
      <span class="ml-auto text-[11px] text-fg-faint">v1.0.0</span>
    </header>

    <main class="space-y-3 px-3 py-3">
      <ul class="space-y-1.5">
        <li>
          <button type="button" class="btn-primary btn h-9 w-full justify-center text-xs" :disabled="workspaceBusy" data-testid="open-workspace" @click="onOpenWorkspace">
            <FileJson class="size-4" aria-hidden="true" />Open JSON workspace
          </button>
        </li>
        <li>
          <button
            type="button"
            class="btn h-9 w-full justify-center text-xs"
            :disabled="inspectDisabled || workspaceBusy"
            data-testid="inspect-page"
            @click="onInspect"
          >
            <Radar class="size-4" aria-hidden="true" />
            {{ context.status === 'captured' ? 'Captured' : 'Inspect JSON on this page' }}
          </button>
        </li>
      </ul>

      <div class="rounded-md border border-border bg-surface px-3 py-2.5 text-xs">
        <p class="flex items-start gap-2 text-fg-muted" data-testid="popup-status">
          <component :is="statusIcon" class="mt-0.5 size-4 shrink-0" :class="iconClass" aria-hidden="true" />
          <span class="break-words">{{ context.detail }}</span>
        </p>
      </div>

      <div class="flex items-center justify-between border-t border-border pt-2.5">
        <span class="text-[11px] text-fg-faint">Processed 100% locally</span>
        <button type="button" class="text-[11px] text-accent hover:underline" @click="onOpenSettings">
          <ExternalLink class="mr-1 inline size-3" aria-hidden="true" />Settings
        </button>
      </div>
    </main>
  </div>
</template>
