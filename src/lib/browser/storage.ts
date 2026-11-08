/**
 * Thin, promise-based wrappers around Chrome APIs with graceful fallbacks for
 * non-extension environments (unit tests / plain browser).
 *
 * Never trusts raw data crossing contexts: values read back from storage are
 * validated in `preferences.ts` and `session.ts` before use.
 */

export function isExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.runtime.id === 'string'
  );
}

interface StorageLike {
  get(key: string): Promise<Record<string, unknown> | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

function localStorageLike(): StorageLike {
  return {
    async get(key: string) {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return undefined;
      try {
        return { [key]: JSON.parse(raw) as unknown };
      } catch {
        return undefined;
      }
    },
    async set(key: string, value: unknown) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    async remove(key: string) {
      window.localStorage.removeItem(key);
    },
  };
}

function chromeStorageLike(area: 'local' | 'session'): StorageLike {
  return {
    async get(key: string) {
      const result = await chrome.storage[area].get(key);
      return result as Record<string, unknown>;
    },
    async set(key: string, value: unknown) {
      await chrome.storage[area].set({ [key]: value as never });
    },
    async remove(key: string) {
      await chrome.storage[area].remove(key);
    },
  };
}

export function storageArea(area: 'local' | 'session'): StorageLike {
  return isExtensionContext() ? chromeStorageLike(area) : localStorageLike();
}
