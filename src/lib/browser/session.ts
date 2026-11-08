/**
 * Session-payload passing between the extension popup/background and the
 * workspace tab. Chrome Storage Session is used instead of URL/query params
 * so page URLs are never polluted and content never lands in browser history.
 *
 * Every payload is validated on read; stale payloads are dropped.
 */
import type { PendingDocument } from '@/types';
import { storageArea } from './storage';

export const SESSION_KEY = 'json-studio:pending-document';

const MAX_PENDING_BYTES = 20 * 1024 * 1024;
const PAYLOAD_MAX_AGE_MS = 30_000;

function coercePending(value: unknown): PendingDocument | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Partial<Record<keyof PendingDocument, unknown>>;
  if (typeof raw.text !== 'string' || raw.text.length === 0) return null;
  if (typeof raw.capturedAt !== 'number') return null;
  if (Date.now() - raw.capturedAt > PAYLOAD_MAX_AGE_MS) return null;
  const rawSource = raw.source;
  let source: PendingDocument['source'] = {};
  if (rawSource !== null && typeof rawSource === 'object') {
    source = {
      pageUrl:
        typeof (rawSource as { pageUrl?: unknown }).pageUrl === 'string'
          ? ((rawSource as { pageUrl: string }).pageUrl)
          : undefined,
      title:
        typeof (rawSource as { title?: unknown }).title === 'string'
          ? ((rawSource as { title: string }).title)
          : undefined,
    };
  }
  return { text: raw.text, capturedAt: raw.capturedAt, source };
}

/** True when the document exceeds the session transport limit. */
export function exceedsPendingLimit(text: string): boolean {
  return new TextEncoder().encode(text).length > MAX_PENDING_BYTES;
}

/** Stores a document for the next-opened workspace tab. */
export async function savePendingDocument(
  text: string,
  source: PendingDocument['source'],
): Promise<boolean> {
  if (exceedsPendingLimit(text)) return false;
  try {
    const payload: PendingDocument = { text, capturedAt: Date.now(), source };
    await storageArea('session').set(SESSION_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

/** Reads and clears the pending document, if any. */
export async function takePendingDocument(): Promise<PendingDocument | null> {
  try {
    const area = storageArea('session');
    const result = await area.get(SESSION_KEY);
    const pending = coercePending(result?.[SESSION_KEY]);
    await area.remove(SESSION_KEY);
    return pending;
  } catch {
    return null;
  }
}
