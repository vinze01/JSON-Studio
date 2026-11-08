# Architecture — JSON Studio

This document explains how JSON Studio is built, the reasoning behind its key decisions, and the invariants that keep it private and fast.

---

## 1. Stack

| Layer | Technology | Role |
|---|---|---|
| Extension framework | WXT (MV3 target) | Entrypoints, HMR dev server, manifest generation |
| UI | Vue 3 (`<script setup>`) | Popup + workspace, Pinia stores |
| Language | TypeScript (strict, no implicit `any`) | Total codebase |
| Styling | Tailwind CSS v4 | Design tokens via CSS custom properties (light/dark themes) |
| Code editor | CodeMirror 6 | `Code` view with highlighting + error-line decoration |
| State | Pinia | `document`, `preferences`, `toast` stores |
| Tests | Vitest + @vue/test-utils + happy-dom | 187 tests (19 files) + 6 Playwright E2E |

---

## 2. Entrypoints

```
src/entrypoints/
├── background.ts    MV3 service worker (defineBackground)
├── popup/           Toolbar popup — status summary + actions
└── workspace/       Full-page app (workspace.html) — the real product
```

### Background service worker

Responsibilities (kept deliberately small):

1. **`js:inspect` message handler** — verifies `sender.id === chrome.runtime.id`, then:
   1. Finds the active tab; rejects restricted URLs (`chrome://`, web store, `edge://`, `about:`, …) via `isRestrictedUrl`.
   2. Injects `pageExtractor` with `chrome.scripting.executeScript` (only possible because the user just clicked — `activeTab`). The func must be fully self-contained: `executeScript` serializes only the function source, so module-scope bindings vanish in the page (0.5.1 fix).
   3. Hygiene-filters the captured text (`looksLikeJsonText`, 20 MB `exceedsPendingLimit`).
   4. Stages the payload and opens a DEDICATED workspace tab with `?source=tab` (0.5.2: captures never refocus an open workspace — the staged payload is only read on load, and refocusing would bury an active session).
2. **`open-workspace` command** — focuses an existing workspace tab or creates one.

### Popup

Reads current-tab context (restricted page / likely JSON page), offers Inspect + Open Workspace. No document content is ever rendered in the popup.

### Workspace

Coordinator `App.vue` wires: `EditorPane` (input), `Toolbar`, `SearchPanel`, `ErrorBanner` (error + Integrity Report), `TreeView`/`CodeView`/`RawView`, `SettingsModal`, `StatusBar`, `ToastHost`.

---

## 3. Data flow: the pending-document handoff

The core cross-context problem — "get page JSON from popup/worker into the workspace tab" — is solved entirely locally:

```
User clicks "Inspect page"
        │  (chrome.scripting + activeTab — granted by the click itself)
        ▼
pageExtractor() runs in the page ──► { text, contentType, title }
        │  looksLikeJsonText + 20 MB guard
        │  (self-containment invariant: executeScript({ func }) serializes
        │   ONLY the function source — any reference to a module-scope
        │   binding becomes an in-page ReferenceError that Chromium reports
        │   as a result-less injection, never as a rejection. Enforced by
        │   the source-serialization regression test.)
        ▼
chrome.storage.session['json-studio:pending-document']
        { text, capturedAt, source }           ← in-memory, browser-local, TTL 30 s
        ▼
Workspace opens with ?source=tab
        │  takePendingDocument() on mount
        ▼
payload validated (age ≤ 30 s, shape-coerced) ──► loaded into document store
        └─ key deleted immediately — single-use
```

Invariant: **no URL pollution, no history leakage, no channel left open, payload consumed once or dropped.**

---

## 4. The JSON engine (`src/utils/json/`)

| Module | Notes |
|---|---|
| `parse.ts` | `JSON.parse` + `locateOffset`; compensates offsets when the engine trims leading whitespace |
| `validate.ts` | **Hand-written RFC 8259 scanner** — see §5 |
| `reprint.ts` | **Lossless reprinter** — token-verbatim format/minify that preserves numbers, spellings, escapes and key order (see §5a) |
| `repair.ts` | **Auto-Repair** — guarded passes (quotes/keys, comments, literals, trailing commas, newline commas) plus a structure-aware separator scan that inserts missing colons (`"key" "value"` → `"key": "value"`) and missing commas; ambiguous or unfixable shapes are left untouched for the highlight to point at |
| `error-highlight.ts` | Maps the scanner's `JsonDiagnostic` to the editor text slice to mark (missing-colon: key + gap; anything else: bounded token window) |
| `format.ts` | Pretty-print / minify on a parsed value (round-trip safe); `innerSnippetJson` for content-without-wrapper copies |
| `tree.ts` | Builds flat rows for the virtualized viewer (`pointer`, `label`, `type`, `depth`, `hasChildren`, …) |
| `pointer.ts` | RFC 6901 encode/decode/resolve (`~0`, `~1`) |
| `search.ts` | Key/value search producing JSON Pointer paths; truncated at 500 matches |
| `stats.ts` | root type, item count, depth, byte size — feeds the status bar |

### 5. Why a hand-written scanner?

Modern V8 `JSON.parse` errors no longer include reliable positions, and engines only report the *first* syntax problem. The scanner (`validate.ts`) walks the raw text and reports:

- Trailing commas, missing commas, unclosed brackets, bad escapes, unterminated strings, invalid literals — each with **byte offset → line/column** mapping.
- **Integrity findings** (data-class issues, not syntax): duplicate property names (reported per object with `occurrences`), numbers exceeding 15 significant digits (`precisionNotes`), and maximum nesting depth.
- Guard: documents over ~20 MB skip the scan and fall back to `JSON.parse` (`scanSkipped`), enforced by the 187-test suite's performance benchmarks at 100 KB / 1 MB / 5 MB.


The scanner never evaluates code and never uses `eval`/`new Function` — nothing in the repo does.

### 5a. The lossless reprinter (`reprint.ts`)

`JSON.parse`/`JSON.stringify` round trips are lossy in three ways: doubles round (`9007199254740993` → `…992`), number spellings collapse (`1e2`, `1.50`), and `stringify` **reorders integer-like keys**. The reprinter reprints the validated *source text* verbatim — strings, numbers, keywords are copied byte-for-byte; only whitespace/indentation/colons change. With **lossless mode on** (default, toggleable via the `losslessNumbers` preference), format, minify, copy-formatted/minified, the code view, and export all go through it; the tree viewer still parses values for display (counted by the Integrity Report for precision risk).

---

## 6. Rendering strategy

- **Tree view is virtualized**: rows render inside a scroll viewport at a fixed 22 px pitch; only the visible window (+ overscan) mounts when a document exceeds 1 000 flattened nodes. Two invariants keep the slice honest (both were the cause of the 0.4.0 "missing keys" bug):
  1. **Row pitch must be exact** — the row height (`h-[22px]`, owned by `TreeRow.vue`) and the `ROW_H` constant (`TreeView.vue`) must stay in sync; any drift corrupts `first * ROW_H` offset math.
  2. **Sizing must survive late mounting** — the viewport ref only exists after a document loads, so height/`ResizeObserver` attachment lives in a template-ref watcher, never in `onMounted`.
  Additionally, a `flush: 'post'` watch re-syncs `viewportTop` whenever the flat list changes (collapse/expand can clamp `scrollTop`), and the window degrades to ≥ 30 rows if a measurement ever fails.
- `TreeRow` is a leaf component; `TreeView` manages keyboard navigation (roving focus), expand/collapse, and `revealPointer()` scroll-into-view.
- **Expand-all guard**: `countNodes(limit: 50_000)` — beyond the limit, expansion stops at 50 000 nodes with a toast. This prevents a single deep/huge document from freezing the tab.
- **Code view**: CodeMirror 6 is *lazily relevant* only when the user picks the Code tab; error diagnostics highlight the failing line. Compartments swap theme/wrap settings without re-creating the editor.
- **Editing pane error highlight (0.6.0)**: `EditorPane.vue` overlays a transparent-text `<pre>` mirror behind the textarea — identical typography (`font-mono text-xs leading-5`, `p-3`), `whitespace-pre-wrap break-words`, and `[scrollbar-gutter:stable]` on both layers keep the glyphs aligned; the marked span styles the exact slice from `errorHighlightRange()`. The mirror only mounts while the document is invalid and skips rendering above 1.5 MB. **Paint-order invariant**: the mirror is `absolute` and the textarea must stay `relative` (positioned beats static in CSS paint order) or the mirror's box paints over the editor and the document text vanishes as soon as a highlight mounts — guarded by a component regression test. `LINE_PITCH = 20` (leading-5) is the scroll-math invariant shared with the class strings — change both together. `revealError()` (exposed; called on Validate) selects the offending slice and scrolls its line to mid-view.

---

## 7. State (Pinia)

| Store | Owns |
|---|---|
| `document` | Raw text, parse result, scan result, view mode, derived: `isValid`, `isEmpty`, display text |
| `preferences` | Theme, indent size, wrap, default view — persisted to `chrome.storage.local` through `lib/browser/preferences.ts` |
| `toast` | Ephemeral notifications with capping + auto-dismiss |

Components stay presentational; stores own mutations; `utils/json/*` is framework-free (this is what makes the 75 unit tests run in plain Vitest).

---

## 8. Library layer (`src/lib/`)

```
lib/
├── browser/
│   ├── storage.ts        Generic chrome.storage wrapper with promise API + area selection
│   ├── preferences.ts    Type-safe preference save/load/merge with defaults
│   ├── session.ts        Pending-document staging (validated, single-use, 30 s TTL, 20 MB cap)
│   ├── workspace.ts      Workspace-tab routing (captures always open a new tab — 0.5.2)
│   └── files.ts          Clipboard + download helpers
├── page-inspection.ts    pageExtractor, isRestrictedUrl, looksLikeJsonText (pure; injected part must stay self-contained — see §3)
└── utils.ts              debounce, applyTheme
```

Nothing in `lib/` imports Vue or Pinia — the boundary is intentional so browser-facing logic is testable without component mounting.

---

## 9. Security & privacy architecture (summary)

- **No content scripts, no `host_permissions`, no `web_accessible_resources`** in the manifest.
- **No network-capable code**: grep-verified absence of `fetch`/`XMLHttpRequest`/`WebSocket`/analytics SDKs; no remote code loading (MV3 bundled assets only).
- **No `eval`/`new Function`/`innerHTML`** anywhere in `src/`.
- Message handler verifies `sender.id`; commands trigger the same user-initiated paths as clicks.
- Restricted-URL denylist applies before any injection attempt.
- Full statement in [PRIVACY.md](PRIVACY.md).

---

## 10. Testing architecture

- **Unit (144)** — pure JSON engine modules (incl. 12 reprinter tests, 12 repair/separator-scan tests incl. a ~20 KB deep-colon regression, and the error-highlight range mapper), page-inspection helpers (JSONP unwrap, embedded-JSON container scans, injected-source self-containment), workspace-tab routing, and browser-API mocks (storage/session/preferences).
- **Component (43)** — components, stores, popup, TreeView mounting with happy-dom; tree row URL links, inner/outer copy emission, expansion preservation, integrity report rendering, and the EditorPane error-highlight mirror (incl. its paint-order guard) included.
- **Performance (included in unit)** — 100 KB < 500 ms, 1 MB < 2000 ms, 5 MB (parse only) < 5000 ms.
- **E2E (6, passing)** — Playwright Chromium loads the built extension; smoke + integrity + lossless-format + tree-virtualization + expand-all/format-preservation + validate-error-highlight flows verified in a real browser.

Detailed coverage map: [TESTING.md](TESTING.md).

---

## 11. Code conventions

- **Single type source** — every exported type/interface lives in `src/types/index.ts` (JSON model, preferences, scan/parse/format/repair results, search options, toast items, browser-file results, pending-document payload, page-inspection outcomes, toolbar options). All modules import them with `import type { … } from '@/types'`; type-only imports keep runtime dependency graphs clean. Components keep only *local* prop interfaces inline in their `<script setup>` — when a component publishes a type used elsewhere (e.g. `ToolbarOption`), it belongs in `src/types/`.
- **Shared UI patterns are extracted** — `SettingRow.vue` (label + description + right-aligned control) backs every settings row; `toast.copyWithToast()` is the one copy-to-clipboard-with-feedback path, used by the workspace toolbar and every tree row action.
- **Layer boundary**: `utils/json/*` and `lib/*` never import Vue/Pinia; components stay presentational; stores own mutations and may import `lib/`. The one exception echoing upward is `stores/toast.ts` consuming `lib/browser/files.copyText` for its `copyWithToast` action, chosen over a helper under `lib/` so the framework-free guarantee holds.
