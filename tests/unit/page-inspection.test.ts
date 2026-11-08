import { beforeEach, describe, expect, it } from 'vitest';
import {
  isRestrictedUrl,
  looksLikeJsonText,
  pageExtractor,
  unwrapJsonp,
} from '@/lib/page-inspection';

describe('pageExtractor — injected source integrity', () => {
  it('runs standalone: every identifier it uses exists in the page (no module-scope leaks)', () => {
    // chrome.scripting serializes only the function source. Any reference to
    // a module-scope binding becomes a ReferenceError in the page and is
    // silently swallowed by the mediation layer (0.5.1 bug). Evaluating the
    // serialized source through `new Function` proves the function body only
    // uses page globals: imported/local helpers would be undefined here.
    const source = pageExtractor.toString();
    const run = new Function(`${source}; return pageExtractor();`);
    const outcome = run() as { kind: string; contentType: string };
    expect(outcome).toBeTruthy();
    expect(typeof outcome.kind).toBe('string');
    expect(typeof outcome.contentType).toBe('string');
  });
});

describe('pageExtractor — embedded JSON containers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = '';
  });

  /** Forces `document.contentType`, which happy-dom may not emulate per fetch. */
  function withContentType(value: string): void {
    Object.defineProperty(document, 'contentType', { value, configurable: true });
  }

  it('finds JSON in pre blocks on pages with an unknown content type', () => {
    withContentType('');
    document.body.innerHTML = '<pre>{"id": 1, "name": "Ada"}</pre><p>other prose</p>';
    const outcome = pageExtractor();
    expect(outcome.kind).toBe('pre-block');
    expect(outcome.contentType).toBe('');
    expect(JSON.parse(outcome.text)).toStrictEqual({ id: 1, name: 'Ada' });
  });

  it('prefers a block that parses as JSON over one that merely looks like it', () => {
    withContentType('text/html');
    // First block is a JS template snippet (looks like JSON head '[', no parse).
    document.body.innerHTML =
      "<pre>[{{repeat(5, 7)}}, { id: '{{objectId()}}' }]</pre>" +
      '<pre>[{"id": 1}, {"id": 2}]</pre>';
    const outcome = pageExtractor();
    expect(outcome.kind).toBe('pre-block');
    expect(JSON.parse(outcome.text)).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  it('falls back to standalone code blocks not wrapped in pre', () => {
    withContentType('application/octet-stream');
    document.body.innerHTML =
      '<article><code>{"ok": true, "count": 2}</code> in the docs above.</article>';
    const outcome = pageExtractor();
    expect(outcome.kind).toBe('pre-block');
    expect(JSON.parse(outcome.text)).toStrictEqual({ ok: true, count: 2 });
  });

  it('still reads a rendered JSON body on unknown-type pages before container scans', () => {
    withContentType('');
    document.body.innerHTML = '<span>[1, 2, 3]</span>';
    const outcome = pageExtractor();
    expect(outcome.kind).toBe('text-doc');
    expect(JSON.parse(outcome.text)).toStrictEqual([1, 2, 3]);
  });
});

describe('unwrapJsonp', () => {
  it('unwraps a JSONP callback parameter', () => {
    const result = unwrapJsonp('loadData({"a": 1});');
    expect(result).toStrictEqual({ text: '{"a": 1}', jsonp: true });
  });

  it('unwraps arrays and dotted namespace names', () => {
    expect(unwrapJsonp('$.handler([1,2])')).toStrictEqual({ text: '[1,2]', jsonp: true });
    expect(unwrapJsonp('cb ({ "x": true })')).toStrictEqual({ text: '{ "x": true }', jsonp: true });
  });

  it('leaves plain JSON untouched', () => {
    expect(unwrapJsonp('{"a":1}')).toStrictEqual({ text: '{"a":1}', jsonp: false });
    expect(unwrapJsonp('[1,2,3]')).toStrictEqual({ text: '[1,2,3]', jsonp: false });
  });

  it('rejects non-identifier wrapper names and non-JSON cores', () => {
    // A '(' inside a string of plain JSON must not trick the unwrapper.
    expect(unwrapJsonp('{"url":"http://x/(y)"}').jsonp).toBe(false);
    expect(unwrapJsonp('while(1);"data"').jsonp).toBe(false);
    expect(unwrapJsonp('cb()').jsonp).toBe(false);
    expect(unwrapJsonp('cb(not,json)').jsonp).toBe(false);
    expect(unwrapJsonp('').jsonp).toBe(false);
  });

  it('handles nested parentheses inside the JSON payload', () => {
    const result = unwrapJsonp('cb({"s":"f(a)","n":[1,{"t":"(x)"}]});');
    expect(result).toStrictEqual({ text: '{"s":"f(a)","n":[1,{"t":"(x)"}]}', jsonp: true });
  });
});

describe('looksLikeJsonText', () => {
  it('accepts JSON and rejects plain words', () => {
    expect(looksLikeJsonText('  {"a":1}')).toBe(true);
    expect(looksLikeJsonText('hello world')).toBe(false);
    expect(looksLikeJsonText('')).toBe(false);
  });
});

describe('isRestrictedUrl', () => {
  it('blocks privileged pages and accepts normal web pages', () => {
    expect(isRestrictedUrl('chrome://settings')).toBe(true);
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
    expect(isRestrictedUrl(undefined)).toBe(true);
    expect(isRestrictedUrl('https://example.com/data.json')).toBe(false);
  });
});
