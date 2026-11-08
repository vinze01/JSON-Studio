/**
 * Clipboard + file helpers. Clipboard failures surface as a boolean so the
 * caller can show proper feedback instead of a silent no-op.
 */
import type { FileReadResult } from '@/types';

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Maximum file size accepted on import, in bytes (~25 MB). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Reads a user-selected file as UTF-8 text with basic safeguards. */
export async function readFileText(file: File): Promise<FileReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: 'too-large',
      message: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Import supports files up to 25 MB.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: 'empty', message: 'The selected file is empty.' };
  }
  try {
    const text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) return { ok: true, text: text.slice(1) };
    return { ok: true, text };
  } catch {
    return {
      ok: false,
      reason: 'read-error',
      message: 'The file could not be read. It may be locked or in a binary format.',
    };
  }
}

/** Triggers a client-side download; nothing is uploaded anywhere. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function timestampedFilename(base: string, isMinified: boolean): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${base}-${stamp}${isMinified ? '.min' : ''}.json`;
}
