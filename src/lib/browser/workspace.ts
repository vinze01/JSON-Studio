/**
 * Workspace-tab routing for the extension.
 *
 * Two distinct flows reach the workspace:
 *  - The `open-workspace` keyboard shortcut may REUSE an existing tab (it has
 *    nothing new to hand over).
 *  - A page capture ("Inspect JSON on this page") ALWAYS opens a dedicated
 *    tab. The staged payload is only read on workspace load, so refocusing a
 *    loaded tab would silently drop the capture and bury the analysis the
 *    tab already shows (0.5.2 regression).
 *
 * The chrome APIs are injected so the routing logic stays unit-testable;
 * `createWorkspaceEnv()` returns the real bindings or null outside a tab
 * manager context (tests, plain pages) where opening is a no-op.
 */
import type { WorkspaceEnv } from '@/types';

/** Builds the env used at runtime; null in non-extension contexts. */
export function createWorkspaceEnv(): WorkspaceEnv | null {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.runtime?.getURL !== 'function' ||
    typeof chrome.tabs?.create !== 'function'
  ) {
    return null;
  }
  return {
    runtime: { getURL: (path: string) => chrome.runtime.getURL(path) },
    tabs: {
      create: (props) => chrome.tabs.create(props),
      query: (info) => chrome.tabs.query(info),
      update: (id, props) => chrome.tabs.update(id, props),
    },
    windows: typeof chrome.windows?.update === 'function'
      ? { update: (id, props) => chrome.windows.update(id, props) }
      : null,
  };
}

const WORKSPACE_PATH = '/workspace.html';

function workspaceUrl(env: WorkspaceEnv, query: string): string {
  return `${env.runtime.getURL(WORKSPACE_PATH)}${query}`;
}

/**
 * Opens (or reuses) the workspace tab.
 * @param env routing bindings, or null to no-op
 * @param query URL query appended to the workspace path
 * @param reuseExisting true for flows that may refocus an open workspace
 */
export async function openWorkspace(
  env: WorkspaceEnv | null,
  query = '',
  reuseExisting = true,
): Promise<void> {
  if (!env) return;
  const url = workspaceUrl(env, query);
  if (reuseExisting) {
    const pattern = `${env.runtime.getURL(WORKSPACE_PATH)}*`;
    const existing = (await env.tabs.query({ url: pattern }))[0];
    if (existing?.id !== undefined) {
      await env.tabs.update(existing.id, { active: true });
      if (existing.windowId !== undefined && env.windows) {
        await env.windows.update(existing.windowId, { focused: true });
      }
      return;
    }
  }
  await env.tabs.create({ url });
}
