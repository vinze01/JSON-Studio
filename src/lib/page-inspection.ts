/**
 * Page inspection via the `chrome.scripting` API with `activeTab` permissions.
 *
 * Inspection is strictly user-initiated: the user clicks "Inspect this page"
 * in the popup (or presses the command), which grants activeTab for that tab
 * only. Content scripts are NOT declared in the manifest, so the extension
 * never runs code on pages the user did not explicitly request.
 *
 * Raw HTTP response bodies are NOT accessible to content scripts; we instead
 * read what the browser rendered. For JSON documents Chrome renders the body
 * text (possibly inside a built-in viewer's shadow DOM), for text/plain pages
 * the body text is used, and for HTML pages only text in <pre> elements is
 * considered (a common server-rendering pattern).
 */
import type { ExtractOutcome } from '@/types';

const JSON_PEEK_LIMIT = 200_000;

/** Injected function: must be fully self-contained (no closures/imports). */
export function pageExtractor(): ExtractOutcome {
  // Declared INSIDE the injected function on purpose: chrome.scripting
  // serializes only the function source, so module-scope constants would be
  // ReferenceErrors in the page (the 0.5.1 "extraction returned nothing" bug).
  const MAX_EXTRACT_BYTES = 20 * 1024 * 1024;
  const contentType = document.contentType ?? '';
  const title = (document.title || undefined) as string | undefined;

  const shadowText = (root: ShadowRoot | Element): string | null => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let node = walker.nextNode();
    let collected = 0;
    while (node) {
      const value = node.nodeValue ?? '';
      if (value.trim()) {
        parts.push(value);
        collected += value.length;
        if (collected > 1024 * 1024) break;
      }
      node = walker.nextNode();
    }
    const joined = parts.join('');
    return joined.trim() ? joined : null;
  };

  const deepBodyText = (): string | null => {
    const direct = document.body?.innerText?.trim();
    if (direct) return direct;
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT);
    let element = walker.nextNode() as Element | null;
    while (element) {
      const shadow = (element as HTMLElement).shadowRoot as ShadowRoot | null;
      if (shadow) {
        const text = shadowText(shadow);
        if (text) return text;
      }
      element = walker.nextNode() as Element | null;
    }
    return null;
  };

  const preBlocks = (): string[] => {
    const blocks: string[] = [];
    for (const pre of Array.from(document.querySelectorAll('pre'))) {
      const text = (pre.textContent ?? '').trim();
      if (text) blocks.push(text);
      if (blocks.length >= 5) break;
    }
    return blocks;
  };

  /** Standalone <code> blocks not already covered by a <pre> parent. */
  const codeBlocks = (): string[] => {
    const blocks: string[] = [];
    for (const code of Array.from(document.querySelectorAll('code'))) {
      if (code.closest('pre')) continue;
      const text = (code.textContent ?? '').trim();
      if (text) blocks.push(text);
      if (blocks.length >= 10) break;
    }
    return blocks;
  };

  const looksJson = (text: string): boolean => {
    const head = text.trimStart().slice(0, 64);
    if (head.startsWith('{') || head.startsWith('[') || head.startsWith('"') ||
      /^-?\d/.test(head) || head.startsWith('true') || head.startsWith('false') || head.startsWith('null')) {
      return true;
    }
    // JSONP: an identifier namespace calling with a document (worker unwraps it).
    return /^[$\w.$]+\s*\(/i.test(head);
  };

  if (contentType.includes('json')) {
    const text = deepBodyText();
    if (text && text.length <= MAX_EXTRACT_BYTES && looksJson(text)) {
      return { kind: 'json-doc', text, contentType, title };
    }
    return { kind: 'none', text: '', contentType, title };
  }

  /** True when body text is a pure JSON document (or a JSONP wrapper). */
  const pureJson = (text: string): boolean => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return /^[$\w.$]+\s*\(/i.test(text.trimStart().slice(0, 64));
    }
  };

  // HTML and every other declared type: scan <pre> and <code> blocks for
  // embedded JSON — a very common docs/tutorial/server-rendering pattern.
  // Prefer blocks that parse as JSON outright: tutorial pages often embed
  // template snippets that merely *look* like JSON but do not parse.
  const blocks = [...preBlocks(), ...codeBlocks()];
  const valid = blocks.find((block) => {
    if (block.length > MAX_EXTRACT_BYTES) return false;
    try {
      JSON.parse(block);
      return true;
    } catch {
      return false;
    }
  });
  if (valid) return { kind: 'pre-block', text: valid, contentType, title };
  for (const block of blocks) {
    if (block.length <= MAX_EXTRACT_BYTES && looksJson(block)) {
      return { kind: 'pre-block', text: block, contentType, title };
    }
  }

  // text/plain and pages without a declared type: fall back to the rendered
  // body text, but only when it is a pure JSON/JSONP document — otherwise a
  // bare page whose first text nodes *start* like JSON would be captured
  // with unrelated content glued to it.
  if (contentType === 'text/plain' || contentType === '') {
    const text = deepBodyText();
    if (text && text.length <= MAX_EXTRACT_BYTES && pureJson(text)) {
      return { kind: 'text-doc', text, contentType, title };
    }
  }

  return { kind: 'none', text: '', contentType, title };
}

const RESTRICTED_SCHEMES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
  'view-source:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
];

export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export function looksLikeJsonText(text: string): boolean {
  const head = text.trimStart().slice(0, JSON_PEEK_LIMIT);
  return /^[\s]*[{"[\d\-tfn]/i.test(head);
}

/**
 * JSOP-style payload unwrapping: `callback({...})` (and `callback([...])`)
 * with an optional trailing semicolon - the jQuery/fetch-JSONP convention.
 *
 * The wrapper name may contain letters, digits, `_`, `$`, and `.` (dotted
 * namespaces are common). Unwrapping happens in the service worker after the
 * page text is captured, so documents served as JSONP still open losslessly.
 */
export function unwrapJsonp(input: string): { text: string; jsonp: boolean } {
  const trimmed = input.trim();
  const statement = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed;
  const open = statement.indexOf('(');
  // A wrapper needs `name(`...`)` with a non-empty name, and a `)` at the end.
  if (open < 1 || !statement.endsWith(')')) return { text: input, jsonp: false };
  const name = statement.slice(0, open).trim();
  if (!/^[$\w.$]+$/u.test(name)) return { text: input, jsonp: false };
  const core = statement.slice(open + 1, -1);
  const unwrapped = core.trim();
  // JSONP payloads conventionally carry exactly one object or array.
  if (
    unwrapped.length === 0 ||
    (unwrapped[0] !== '{' && unwrapped[0] !== '[') ||
    !looksLikeJsonText(unwrapped)
  ) {
    return { text: input, jsonp: false };
  }
  return { text: unwrapped, jsonp: true };
}

