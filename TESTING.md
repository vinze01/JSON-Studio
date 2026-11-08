# Testing — JSON Studio

This document describes the testing strategy, how to run the tests, what is covered, and known limitations.

---

## Test Stack

| Tool | Purpose |
|---|---|
| [Vitest](https://vitest.dev/) v3 | Unit and component tests |
| [@vue/test-utils](https://test-utils.vuejs.org/) | Vue component mounting |
| [happy-dom](https://github.com/capricorn86/happy-dom) | Lightweight DOM environment |
| [Playwright](https://playwright.dev/) | End-to-end browser tests |

---

## Running Tests

```bash
# Run all unit and component tests (once)
npm run test

# Watch mode — re-runs on file changes
npm run test:watch

# Type checking (vue-tsc)
npm run typecheck

# ESLint
npm run lint

# End-to-end tests (requires Playwright browsers installed)
npm run test:e2e

# Install Playwright browsers (first time only)
npx playwright install chromium
```

---

## Test Results (Current)

| Category | Files | Tests | Status |
|---|---|---|---|
| Unit — JSON utilities (format, parse, validate, pointer, search, tree, stats, reprinter, repair/typegen, error-highlight) | 11 | 112 | ✅ Passing |
| Unit — Performance benchmarks | 1 | 3 | ✅ Passing |
| Unit — Browser storage APIs (incl. workspace tab routing) | 1 | 13 | ✅ Passing |
| Unit — Preferences persistence | 1 | 4 | ✅ Passing |
| Unit — Page inspection (incl. JSONP unwrap, embedded-JSON containers, source self-containment) | 1 | 12 | ✅ Passing |
| Component — Stores | 1 | 8 | ✅ Passing |
| Component — Popup | 1 | 4 | ✅ Passing |
| Component — TreeView (incl. expansion preservation) | 1 | 8 | ✅ Passing |
| Component — UI components (incl. EditorPane error highlight) | 1 | 23 | ✅ Passing |
| **Vitest total** | **19** | **187** | ✅ **All passing** |
| End-to-End (Playwright, real Chromium) | 1 | 6 | ✅ Passing |

---

## Unit Tests (`tests/unit/`)

### `format.test.ts` — JSON Formatting
Covers `formatJson()`, `minifyJson()`, `stringifyJson()` and `innerSnippetJson()`:
- Formats valid JSON with 2-space and 4-space indentation
- Minifies JSON to a single line
- Preserves data types (string, number, boolean, null)
- Handles nested objects and arrays
- Handles root arrays and root primitives
- Returns error for invalid JSON without silent coercion
- Handles Unicode and escaped characters
- `innerSnippetJson()` — copies container *contents* without the outer braces/brackets (dedented one level); primitives round-trip to themselves

### `parse.test.ts` — JSON Parsing
Covers `parseJson()` and `locateOffset()`:
- Successful parse returns `{ ok: true, data }`
- Failed parse returns `{ ok: false, error }` with message
- Empty string returns empty error state
- `locateOffset()` correctly maps byte offsets to line/column positions

### `validate.test.ts` — JSON Validation Scanner (33 tests)
Covers `scanJson()` — the hand-written RFC 8259 scanner:

**Valid inputs:**
- Empty object and array
- Nested structures
- Root primitives
- All JSON value types

**Error detection:**
- Trailing commas (object and array)
- Missing commas between values
- Unclosed braces and brackets
- Invalid escape sequences in strings
- Unterminated strings
- Unexpected tokens
- Invalid numeric literals
- Maximum depth exceeded (2000 levels)

**Informational findings:**
- Duplicate keys — reports pointer and occurrence count
- Numbers exceeding IEEE-754 precision (> `Number.MAX_SAFE_INTEGER`)
- Maximum depth tracking

**Edge cases:**
- Empty input
- Whitespace-only input
- Multiple root values (invalid)
- Very large documents (scan skipped above 20 MB, `JSON.parse` still runs)

### `pointer.test.ts` — JSON Pointer (RFC 6901)
Covers `buildPointer()`, `decodePointer()`, `resolvePointer()`, `appendPointerSegment()`, `escapePointerToken()`, `unescapePointerToken()`:
- Encodes `~` and `/` per RFC 6901 (`~0`, `~1`)
- Round-trip encode/decode
- Root pointer (empty string)
- Object key and array index resolution
- Keys containing escaped characters
- Returns `undefined` for missing paths
- Resolves root document

### `search.test.ts` — JSON Search
Covers `searchJson()`:
- Finds matching keys and values
- Case-insensitive by default
- Case-sensitive option
- Matches in nested structures
- Returns JSON Pointer paths for all matches
- Empty query returns no matches
- Truncates at 500 matches
- `matchKeys` and `matchValues` flags work independently

### `tree.test.ts` — Tree Node Building
Covers `createRootNode()`, `childTreeNodes()`, `countNodes()`, `retainExpanded()`:
- Root node for object, array, primitive
- Children contain correct pointer, label, type, summary, hasChildren
- Array children have `isIndex: true` and correct index labels
- `countNodes()` counts accurately and respects the limit argument
- `hasChildren` is false for primitive values
- `retainExpanded()` keeps only pointers that still exist after a re-parse (Format/Minify/Validate keep the expansion; a structure change collapses back to root)

### `stats.test.ts` — Document Statistics
Covers `computeStats()`:
- Empty input returns `{ rootType: 'empty', items: null, depth: 0, sizeBytes: 0 }`
- Invalid JSON returns `{ rootType: 'invalid' }`
- Object returns key count
- Array returns item count
- Depth comes from scan result

### `performance.test.ts` — Performance Benchmarks (3 tests)
Tests against realistic document sizes:
- **100 KB** — parse + scan must complete in < 500 ms
- **1 MB** — parse + scan must complete in < 2000 ms
- **5 MB** — parse only (scan skipped) must complete in < 5000 ms

These are benchmarks, not strict requirements — actual performance depends on hardware.

### `reprint.test.ts` — Lossless Reprinter (12 tests)
Covers `reprintJson()` — the token-verbatim formatter that fixes `JSON.parse`/`JSON.stringify` round-trip loss:
- Preserves 19-digit integers exactly (IEEE-754 would round them)
- Preserves number spellings (`1e2`, `1.50`, `1.23E4` stay verbatim)
- Preserves object key order, including integer-like keys that `JSON.stringify` reorders
- Preserves string escape spellings (`\u0041`, `\r` verbatim)
- Produces output byte-identical to `JSON.stringify` for plain documents (minify and pretty)
- Empty containers, root primitives, 4-space indent, deeply nested (200 levels) documents
- Rejects invalid documents with scanner diagnostics, never emits partial output

### `repair-typegen.test.ts` — Auto-Repair JSON + TypeScript Types (11 tests)
Covers `repairJson()` and `jsonToTypeScript()`:

**Repair pipeline (order matters — each pass is guarded by a parse check):**
- Already-valid JSON returns unchanged
- Converts single-quoted keys and values to double quotes
- Encloses unquoted object keys in quotes
- Normalizes Python/JS literals (`True`/`False`/`None`/`undefined`/`NaN`)
- Strips `//` and `/* */` comments (string-aware)
- Removes trailing commas
- Adds missing commas between newline-separated members
- **Structural separator scan** (0.6.0): inserts missing colons between object keys and values (`{"language" "Galician"}` → `{"language": "Galician"}`) and missing commas between members/elements — frame-tracked, so it never fires inside arrays, refuses ambiguous shapes (`{"a" "b": 1}`), and inserts a bare `:` when whitespace already separates key from value

**Type generation:**
- `jsonToTypeScript()` emits nested interfaces and arrays

### `repair-large-sample.test.ts` — Large-Document Repair Regression (1 test)
Reproduces the user's reported failure at realistic scale (~20 KB, 101-entry document array, the
single `"language" "Galician"` missing colon past offset 15 000):
- The validation scanner reports `Expected ':' after the property name.` at the deep offset
- `repairJson()` succeeds with `Inserted missing colons after property names` and all 101 entries parse clean

### `error-highlight.test.ts` — Error Range Mapping (6 tests)
Covers `errorHighlightRange()` — maps a `JsonDiagnostic` to the exact editor text slice to highlight:
- Missing-colon errors highlight the key plus the gap up to the failure point (`"language" `), locating the key's opening quote via an unescaped-quote walk
- Every other failure falls back to a bounded token window (previous token start → next token end)
- Empty input returns null
- Out-of-range offsets are clamped
- The range always covers at least one character even over whitespace

### `page-inspection.test.ts` — Page Inspection Helpers (12 tests)

- **Self-containment guard**: `pageExtractor()` is evaluated from its serialized source (as `chrome.scripting` does) and must run standalone — any module-scope leak becomes a ReferenceError and would be silently swallowed by the mediation (regression test for the 0.5.1 dce-hoisting bug)
- `pageExtractor()` container scans: finds JSON inside `<pre>` (and standalone `<code>`) blocks on pages with an unknown or non-JSON content type; prefers blocks that parse as JSON over snippets that merely look like JSON (tutorial template code); falls back to the rendered body text only when it is a pure JSON/JSONP document
- `unwrapJsonp()` unwraps `callback({...})` / `callback([...])` with optional trailing semicolon, dotted namespaces, and nested parentheses inside the payload
- Leaves plain JSON untouched; rejects non-identifier wrappers, `while(1);` prefixes, empty calls, and non-JSON cores (no false positives from `(` inside strings)
- `looksLikeJsonText()` accepts JSON heads and rejects prose; `isRestrictedUrl()` blocks privileged pages

### `browser.test.ts` — Browser Storage APIs (13 tests)
Covers `savePendingDocument()`, `takePendingDocument()` (session storage), `loadPreferences()` / `savePreferences()` (Chrome Storage mock), and `openWorkspace()` (workspace-tab routing):
- Save and retrieve staged tab documents
- Staged document is consumed on first read (not reusable)
- Stale payloads (> 30 seconds old) are discarded
- Payloads over 20 MB are rejected
- Default preferences are returned when storage is empty
- Partial preference updates are merged with defaults
- A capture **always opens a new workspace tab**, even when a workspace tab is already open (0.5.2 invariant: captures use `reuseExisting: false`)
- Reusable flows refocus the existing workspace tab (and its window) instead of creating one
- Reusable flows create a tab when none exists
- Routing no-ops when no tab manager is available (non-extension context)

### `preferences.test.ts` — Preferences Persistence
Covers preference round-trips with Chrome Storage:
- Saves and loads all preference fields
- Handles missing/partial stored data with defaults

---

## Component Tests (`tests/component/`)

### `components.test.ts` — UI Components (23 tests)
Tests individual Vue components in isolation:
- `AppButton` renders with correct text, emits click, is disabled when prop is set
- `IconButton` renders and responds to click
- `SegmentedControl` renders options, emits selection change
- `ToastHost` shows success, error, and info toasts
- `Modal` renders title and content, emits close on backdrop click and Escape key
- **`IntegrityPanel (ErrorBanner)`** — renders the Integrity Report header with an accurate summary line ("1 duplicate key, 3 precision-risk numbers"), lists duplicate keys with decoded JSON Pointer labels, stays quiet on clean documents ("No structural risks found"), and describes syntax errors with 1-based line/column
- **`EditorPane` (0.6.0)** — mounts the error-highlight mirror only when an error diagnostic is present (marked slice covers the key plus the missing-colon gap); renders no highlight for valid documents or over the 1.5 MB mirror cap; **paint-order regression guard** — the textarea stays `relative` so it paints above the absolutely-positioned mirror (without it, the mirror's box swallowed the editor text as soon as a highlight appeared); commits edits on the 350 ms debounce; `revealError()` selects the offending slice in the textarea and focuses it
- **`TreeRow` additions** — emits `copy-inner` from the inner-copy button (container rows only); renders HTTP(S) string values as `rel="noopener noreferrer"` external links (`tree-url-link`); non-URL strings and numbers are never linkified
- `StatusBar` reflects validity, root type, and size

### `popup.test.ts` — Extension Popup (4 tests)
Mounts `popup/App.vue` with Chrome API mocks:
- Renders popup with correct buttons
- Shows status message based on current tab context
- "Open workspace" button is functional
- Restricted pages show appropriate message

### `stores.test.ts` — Pinia Stores (7 tests)
Tests `documentStore` and `preferencesStore` in isolation:
- Format action updates input text and refreshes parse state
- Minify action updates input text
- Clear action resets document and source
- `isValid` and `isEmpty` computed properties update correctly
- `error` prefers scanner diagnostic over parse error
- Format/minify are **lossless by default**: a 19-digit number passes through unchanged instead of being rounded
- Preferences update and persist (including `losslessNumbers`)

### `tree-view.test.ts` — TreeView Component (8 tests)
Mounts `TreeView` with realistic JSON data:
- Renders tree rows for visible nodes
- Expand/collapse toggling works
- Keyboard navigation (ArrowDown, ArrowRight) works
- `revealPointer()` scrolls to and selects the matching node
- Virtualization renders only visible rows (not all nodes)
- Large document triggers limited expand-all with toast
- Expansion survives a re-parse of the same structure (fresh object graph, e.g. after Format/Minify/Validate)
- A different document collapses the tree back to the root row

---

## End-to-End Tests (`tests/e2e/` — Playwright)

> **Prerequisites:** `npm run build`, then `npx playwright install chromium`.

The E2E suite loads the **real built extension** (`.output/chrome-mv3`) into a persistent Chromium profile via `--load-extension`, resolves the extension ID from its service worker, and opens `chrome-extension://<id>/workspace.html`:

- **Loads the workspace and renders a valid document** — pastes JSON into the editor, asserts top-level keys render in the tree viewport, and that the Integrity Report appears with "No structural risks found".
- **Integrity report flags duplicate keys with pointers** — feeds `{"id":1,"id":2}` and asserts the report states "1 duplicate key".
- **Lossless format preserves a 19-digit number exactly** — clicks Format on `{"snowflakeId": 1234567890123456789}` and asserts the editor keeps every digit verbatim.
- **Virtualized tree renders a correct row slice for a 1 000-item document** — expands a >1 000-node document, asserts every rendered row is exactly the 22 px virtualization pitch, scrolls to the bottom and asserts the final row is visible/`trailer` rendered. Regression test for the "missing keys" bug fixed in 0.4.0.
- **Expand-all reveals array items and Format preserves tree expansion** — pastes a 4-object array, asserts one `expand-all` click shows every nested key (5 → 17 rows), that Format does **not** collapse the tree (the 0.5.0 expansion-preservation behavior), and that `collapse-all` returns to the root-only row.
- **Validate highlights the offending key in an invalid document** — pastes `{"name": "A", "language" "Galician"}`, asserts the failure banner names `Expected ':'`, then clicks Validate and asserts the editor mirrors the highlighted `"language"` slice (0.6.0).

```bash
npm run build
npx playwright test
```

**Status: passing (6 tests).** Verified on Windows with Playwright Chromium (headless, `channel: 'chromium'`).

**Known limitation:** the suite is a smoke test, not full coverage — page inspection (`chrome.scripting`), CodeMirror interactions, and file import/export are not yet automated end-to-end; those are covered by the manual QA checklist below.

---

## Manual QA Checklist

Before submitting to the Chrome Web Store, verify these items manually:

### Installation
- [ ] Extension loads without errors from `.output/chrome-mv3/`
- [ ] Icons appear correctly at all sizes (16, 32, 48, 128 px)
- [ ] Popup opens from toolbar icon

### JSON Operations
- [ ] Paste valid JSON → renders in tree view
- [ ] Format button formats with current indent preference
- [ ] Minify button minifies to single line
- [ ] Validate shows success toast for valid JSON
- [ ] Validate shows error message with line/column for invalid JSON
- [ ] Validate (and 350 ms after typing) marks the offending text in the editor with an error highlight
- [ ] Auto-Repair JSON fixes missing colons/commas and reports what it repaired
- [ ] Clear button resets everything

### Tree View
- [ ] Objects and arrays are collapsible
- [ ] Keyboard navigation (arrow keys, home/end, enter/space) works
- [ ] Copy value button copies individual values
- [ ] Copy path button copies JSON Pointer
- [ ] Expand all / collapse all works
- [ ] Large document shows "expanded first 2 levels" toast

### Code and Raw Views
- [ ] Switch between Tree / Code / Raw with toolbar
- [ ] CodeMirror shows syntax highlighting
- [ ] Word wrap toggle works in Code and Raw views
- [ ] Dark/light theme applies to CodeMirror correctly

### Search
- [ ] Search finds keys and values
- [ ] Match count displays correctly
- [ ] Next/Previous navigation works
- [ ] Matching nodes are highlighted in tree view
- [ ] Close button clears search state

### File Operations
- [ ] Import .json file via button
- [ ] Import .json file via drag-and-drop
- [ ] Invalid file shows error toast
- [ ] Export formatted JSON downloads file
- [ ] Export minified JSON downloads file

### Themes and Settings
- [ ] Light / Dark / System theme switching works
- [ ] Theme persists after popup close
- [ ] Indentation preference applies on format
- [ ] Default view preference applies on new document load
- [ ] Reset preferences restores defaults

### Page Inspection
- [ ] Inspect JSON on a page with JSON content (e.g., a REST API URL) captures and loads it
- [ ] Restricted page (chrome://settings) shows appropriate message
- [ ] Non-JSON page shows "No JSON found" message

### Edge Cases
- [ ] Empty input shows empty state
- [ ] Deeply nested JSON (100+ levels) renders without crashing
- [ ] Very long string values don't break layout
- [ ] Root array JSON works correctly
- [ ] Root primitive JSON (e.g., `"hello"` or `42`) works correctly
- [ ] Duplicate keys shown as a warning in ErrorBanner

---

## Known Testing Limitations

1. **E2E smoke coverage** — Playwright now runs against a real Chromium with the built extension and passes (workspace load + Integrity Report flows). Broader flows — page inspection via `chrome.scripting`, CodeMirror editing, file import/export — remain on the manual QA checklist.

2. **Chrome API mocking** — Browser API tests mock `chrome.storage` and `localStorage`. Real Chrome Storage behavior (quota limits, sync storage) is not tested.

3. **Restricted permissions** — Some Chrome APIs (`chrome.scripting.executeScript`) cannot be realistically tested in a unit/component environment.

4. **Performance tests** — The performance thresholds (100 KB < 500 ms, 1 MB < 2000 ms, 5 MB < 5000 ms) are based on typical hardware. Actual numbers vary by machine.

5. **CodeMirror E2E** — The CodeMirror editor is not covered by unit tests. Visual correctness requires manual verification.

6. **Clipboard API** — Copy operations use the Clipboard API which requires a secure context. These are tested with mocks but not verified in a real browser.

