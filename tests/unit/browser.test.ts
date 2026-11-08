import { beforeEach, describe, expect, it } from 'vitest';
import { savePendingDocument, takePendingDocument, SESSION_KEY } from '@/lib/browser/session';
import { copyText, readFileText, timestampedFilename } from '@/lib/browser/files';
import { openWorkspace } from '@/lib/browser/workspace';
import type { WorkspaceEnv } from '@/types';

beforeEach(() => {
  window.localStorage.clear();
});

describe('pending document (session fallback via localStorage)', () => {
  it('round-trips a payload destructively', async () => {
    expect(await savePendingDocument('{"a":1}', { pageUrl: 'https://x.test' })).toBe(true);
    const pending = await takePendingDocument();
    expect(pending?.text).toBe('{"a":1}');
    expect(pending?.source.pageUrl).toBe('https://x.test');
    // second read is empty (consumed)
    expect(await takePendingDocument()).toBeNull();
  });

  it('drops stale payloads', async () => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        text: '{"old":true}',
        capturedAt: Date.now() - 60_000,
        source: {},
      }),
    );
    expect(await takePendingDocument()).toBeNull();
  });

  it('rejects oversized payloads', async () => {
    const big = 'x'.repeat(20 * 1024 * 1024 + 1);
    expect(await savePendingDocument(big, {})).toBe(false);
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('workspace tab routing', () => {
  /** Minimal fake env that records every routing call. */
  function makeEnv(existing: Array<{ id?: number; windowId?: number }> = []) {
    const calls: { created: string[]; activated: number[]; focused: number[] } = {
      created: [],
      activated: [],
      focused: [],
    };
    const env: WorkspaceEnv = {
      runtime: { getURL: (p: string) => `chrome-extension://json-studio${p}` },
      tabs: {
        create: (props: { url: string }) => {
          calls.created.push(props.url);
        },
        query: () => Promise.resolve(existing),
        update: (id: number) => {
          calls.activated.push(id);
        },
      },
      windows: {
        update: (id: number) => {
          calls.focused.push(id);
        },
      },
    };
    return { env, calls };
  }

  it('a capture ALWAYS opens a new tab, even when a workspace is already open', async () => {
    const { env, calls } = makeEnv([{ id: 7, windowId: 3 }]);
    await openWorkspace(env, '?source=tab', false);
    expect(calls.created).toStrictEqual(['chrome-extension://json-studio/workspace.html?source=tab']);
    expect(calls.activated).toStrictEqual([]);
    expect(calls.focused).toStrictEqual([]);
  });

  it('reusable flows refocus the existing workspace tab instead of creating one', async () => {
    const { env, calls } = makeEnv([{ id: 7, windowId: 3 }]);
    await openWorkspace(env);
    expect(calls.created).toStrictEqual([]);
    expect(calls.activated).toStrictEqual([7]);
    expect(calls.focused).toStrictEqual([3]);
  });

  it('reusable flows create a tab when none exists', async () => {
    const { env, calls } = makeEnv([]);
    await openWorkspace(env, '');
    expect(calls.created).toStrictEqual(['chrome-extension://json-studio/workspace.html']);
    expect(calls.activated).toStrictEqual([]);
  });

  it('no-ops when no tab manager is available (non-extension context)', async () => {
    await expect(openWorkspace(null, '?source=tab', false)).resolves.toBeUndefined();
  });
});

describe('readFileText', () => {
  it('reads valid text files', async () => {
    const file = new File(['{"a": 1}'], 'data.json', { type: 'application/json' });
    const outcome = await readFileText(file);
    expect(outcome).toEqual({ ok: true, text: '{"a": 1}' });
  });

  it('strips UTF-8 BOM', async () => {
    const file = new File(['﻿{"a":1}'], 'bom.json', { type: 'application/json' });
    const outcome = await readFileText(file);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.text.startsWith('﻿')).toBe(false);
  });

  it('rejects empty files', async () => {
    const file = new File([''], 'empty.json', { type: 'application/json' });
    const outcome = await readFileText(file);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('empty');
  });

  it('rejects oversized files without reading them', async () => {
    const file = new File(['x'.repeat(10)], 'big.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: 26 * 1024 * 1024 });
    const outcome = await readFileText(file);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('too-large');
  });
});

describe('timestampedFilename', () => {
  it('produces predictable names with optional .min suffix', () => {
    const name = timestampedFilename('json-studio', false);
    expect(name).toMatch(/^json-studio-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    expect(timestampedFilename('json-studio', true)).toMatch(/\.min\.json$/);
  });
});

describe('copyText', () => {
  it('returns false when no clipboard strategies are available', async () => {
    // happy-dom exposes navigator.clipboard? Neutralize to test the fallback path.
    const original = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => undefined,
    });
    const result = await copyText('x');
    expect(typeof result).toBe('boolean');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: original,
    });
  });
});
