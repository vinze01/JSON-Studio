import type { ExtractOutcome, InspectResult } from '@/types';
import {
  createWorkspaceEnv,
  openWorkspace,
} from '@/lib/browser/workspace';
import {
  isRestrictedUrl,
  looksLikeJsonText,
  pageExtractor,
  unwrapJsonp,
} from '@/lib/page-inspection';
import { exceedsPendingLimit, savePendingDocument } from '@/lib/browser/session';

/** Runs the extractor in the active tab and stores the payload for the workspace. */
async function inspectActiveTab(): Promise<InspectResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    return {
      status: 'restricted',
      detail: 'This page type (browser UI or Store) cannot be inspected.',
    };
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageExtractor,
    });
    const outcome = (result?.result ?? null) as ExtractOutcome | null;
    if (!outcome) {
      return {
        status: 'error',
        detail: 'This page could not be inspected (its scripts stopped before returning data). Try again — if it persists, copy the JSON and paste it, or check the page in DevTools.',
      };
    }
    if (outcome.kind === 'none' || outcome.text.trim() === '') {
      return {
        status: 'nothing-found',
        detail: `No JSON found on this page (content type: ${outcome.contentType || 'unknown'}).`,
      };
    }
    // JSONP pages are captured with their wrapper (`callback({...})`) intact;
    // unwrap here so the workspace receives the document itself.
    const unwrapped = unwrapJsonp(outcome.text);
    const staged = unwrapped.jsonp ? unwrapped.text : outcome.text;
    if (!looksLikeJsonText(staged)) {
      return {
        status: 'nothing-found',
        detail: 'The page was captured but does not look like a JSON document.',
      };
    }
    if (exceedsPendingLimit(staged)) {
      return {
        status: 'too-large',
        detail: 'This document is larger than 20 MB and cannot be captured from a tab.',
      };
    }
    const stored = await savePendingDocument(staged, {
      pageUrl: tab.url,
      title: outcome.title,
    });
    if (!stored) {
      return { status: 'error', detail: 'Could not stage the captured document.' };
    }
    return {
      status: 'captured',
      bytes: outcome.text.length,
      contentType: outcome.contentType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'error', detail: message };
  }
}

interface IncomingMessage {
  type?: unknown;
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== undefined && sender.id !== chrome.runtime.id) return false;
    const parsed = message as IncomingMessage;
    if (parsed?.type !== 'js:inspect') return false;
    inspectActiveTab()
      .then((result: InspectResult) => {
        if (result.status === 'captured') {
          // Captures always open a DEDICATED workspace tab: refocusing an
          // already-loaded one would never pick up the staged payload and
          // would bury the analysis the tab currently shows.
          void openWorkspace(createWorkspaceEnv(), '?source=tab', false);
        }
        sendResponse(result);
      })
      .catch(() => {
        sendResponse({ status: 'error', detail: 'Inspection failed unexpectedly.' } satisfies InspectResult);
      });
    return true; // keep the message channel open for the async response
  });

  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open-workspace') {
      // The shortcut has no new document to hand over - reuse first.
      await openWorkspace(createWorkspaceEnv());
    }
  });
});

