import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ToastItem, ToastKind } from '@/types';
import { copyText } from '@/lib/browser/files';

let nextId = 1;
const DEFAULT_TIMEOUT = 2500;
const MAX_TOASTS = 4;

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([]);

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }

  function push(kind: ToastKind, message: string, timeoutMs: number = DEFAULT_TIMEOUT): void {
    const id = nextId++;
    toasts.value = [...toasts.value.slice(-(MAX_TOASTS - 1)), { id, kind, message }];
    window.setTimeout(() => dismiss(id), timeoutMs);
  }

  function success(message: string): void {
    push('success', message);
  }

  function error(message: string): void {
    push('error', message);
  }

  function info(message: string): void {
    push('info', message);
  }

  /**
   * Copies text to the clipboard and toasts the outcome. Shared by the
   * workspace toolbar and tree rows so copy feedback stays consistent.
   */
  async function copyWithToast(text: string, successMessage: string): Promise<boolean> {
    const ok = await copyText(text);
    if (ok) success(successMessage);
    else error('Copy failed');
    return ok;
  }

  return { toasts, push, dismiss, success, error, info, copyWithToast };
});
