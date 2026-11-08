import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDocumentStore } from '@/stores/document';
import { usePreferencesStore } from '@/stores/preferences';

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
});

describe('document store', () => {
  it('starts empty and reports empty stats', () => {
    const store = useDocumentStore();
    expect(store.isEmpty).toBe(true);
    expect(store.isValid).toBe(false);
    expect(store.stats.rootType).toBe('empty');
  });

  it('parses, formats and validates valid input', () => {
    const store = useDocumentStore();
    store.setDocument('{"b":1,"a":[2,3]}', undefined);
    expect(store.isValid).toBe(true);
    expect(store.stats.rootType).toBe('object');
    expect(store.stats.items).toBe(2);
    expect(store.data).toEqual({ b: 1, a: [2, 3] });

    const formatted = store.format(4);
    expect(formatted.ok).toBe(true);
    expect(store.inputText).toContain('"a":');
    expect(store.isValid).toBe(true);

    const min = store.minify();
    expect(min.ok).toBe(true);
    expect(store.inputText).toBe('{"b":1,"a":[2,3]}');
  });

  it('never silently repairs invalid input', () => {
    const store = useDocumentStore();
    store.setDocument('{"a":1,}', undefined);
    expect(store.isValid).toBe(false);
    expect(store.error?.message).toMatch(/trailing comma/i);
    const outcome = store.format();
    expect(outcome.ok).toBe(false);
    expect(store.inputText).toBe('{"a":1,}');
  });

  it('uses scanner diagnostics with accurate positions', () => {
    const store = useDocumentStore();
    store.setDocument('{\n  "a": 1,\n  "b": ,\n}', undefined);
    expect(store.error?.line).toBe(2);
    expect(store.error?.column).toBe(7);
  });

  it('clear() resets to an empty editor state', () => {
    const store = useDocumentStore();
    store.setDocument('[1]', undefined);
    store.clear();
    expect(store.isEmpty).toBe(true);
    expect(store.isValid).toBe(false);
    expect(store.source.origin).toBe('editor');
  });

  it('formats losslessly by default: 19-digit numbers survive unchanged', () => {
    const store = useDocumentStore();
    const source = '{\n  "snowflakeId": 1234567890123456789\n}';
    store.setDocument(source, undefined);
    const min = store.minify();
    expect(min.ok).toBe(true);
    expect(min.ok && store.inputText.startsWith('{"snowflakeId":1234567890123456789}')).toBe(true);
    // IEEE-754 would round this value to …768; the verbatim reprint must not.
    expect(store.inputText).toContain('1234567890123456789');
    expect(store.inputText).not.toContain('1234567890123456768');
    const formatted = store.format();
    expect(formatted.ok).toBe(true);
    expect(store.inputText).toContain('1234567890123456789');
  });

  it('minify() reports errors without touching the document', () => {    const store = useDocumentStore();
    store.setDocument('nope', undefined);
    const outcome = store.minify();
    expect(outcome.ok).toBe(false);
    expect(store.inputText).toBe('nope');
  });
});

describe('preferences store', () => {
  it('loads defaults, updates and persists to storage', async () => {
    const prefs = usePreferencesStore();
    await prefs.load();
    expect(prefs.theme).toBe('system');
    expect(prefs.defaultView).toBe('tree');

    await prefs.update({ theme: 'dark', indent: 4, wrap: false, defaultView: 'code' });
    expect(prefs.theme).toBe('dark');
    expect(prefs.wrap).toBe(false);

    const raw = window.localStorage.getItem('json-studio:preferences');
    expect(JSON.parse(raw ?? '{}')).toEqual({
      theme: 'dark',
      indent: 4,
      wrap: false,
      defaultView: 'code',
      losslessNumbers: true,
    });

    await prefs.reset();
    expect(prefs.theme).toBe('system');
    expect(prefs.indent).toBe(2);
  });
});
