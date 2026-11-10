# Changelog — JSON Studio

All notable changes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project has not yet had its first store release, so versions below are pre-release milestones.

---

## [0.6.1] — 2026-11-09 — Duplicate array elements in the Integrity Report

### Added
1. **Integrity Report: duplicate array elements** (user proposal — their sample document contained three byte-identical records in the root array that no integrity check flagged). The flagship report detected only duplicate *keys within one object*; repeated *array items* — the signature of a failed dedup, a retry loop, or double-joined data — went unflagged. The scanner now also records a per-element content signature during the RFC 8259 array walk:
   - `elementSignature()` hashes the element's exact token stream with **whitespace outside strings skipped** (whitespace inside strings is significant, so `{"a b": 1}` and `{"ab": 1}` still differ); escape-spelling differences intentionally do not collide, matching the verbatim-token stance. Two independent 32-bit FNV-1a lanes keep collisions negligible while map keys stay fixed-size strings even for multi-MB documents — no value materialization, still a single pass.
   - Findings render as `{ pointer, occurrences }` per group (RFC 6901 pointer to the **first** occurrence, plus how many times it repeats), surfaced in `ErrorBanner.vue` as a *"Duplicate array elements"* card ("every copy is kept, unlike duplicate keys — but identical items usually mean a failed dedup … compare the sources before trusting the counts") and folded into the integrity summary line ("1 duplicate key, 2 duplicate entries, …").
   - Same caps and guards as duplicate keys: findings capped at `MAX_DUPLICATE_FINDINGS` (20), nested arrays report full pointer paths, documents over ~20 MB keep the scan guard.

### Tests
- **196 Vitest tests (19 files) + 6 Playwright E2E tests**, all passing. New: 8 scanner tests (identical objects w/ first-occurrence pointer, whitespace-insensitive collapse, duplicate scalars, string-whitespace false-positive guard, nested pointer paths, keys+elements co-reporting, the 20-finding cap, unique-arrays silent) + 1 `ErrorBanner` component test (duplicate-element card + occurrence text).

---

## [0.6.0] — 2026-11-08 — In-editor error highlighting + real Auto-Repair

### Added
1. **In-editor error highlighting** (user proposal). When the JSON is invalid, the offending text — the key that is missing its colon, the trailing comma, the stray token, the unclosed bracket — is now **marked in place in the editor pane**:
   - The scanner's diagnostics (`validate.ts`) already carry byte offsets; a new pure mapper `error-highlight.ts` turns each `JsonDiagnostic` into the exact text slice to mark. For `Expected ':' after the property name` it walks back to the key's opening quote and highlights the key **plus the gap where the colon belongs** (`"language" ` in the reported sample); every other failure falls back to a bounded token window (previous token start → next token end).
   - Rendering uses a **text-mapped mirror overlay** in `EditorPane.vue`: a transparent-text `<pre>` mirror sits behind the textarea with identical typography (`font-mono text-xs leading-5`, same padding, `whitespace-pre-wrap break-words`, `[scrollbar-gutter:stable]`), scroll-synced, so the highlighted slice stays glued to the real characters. The mirror only mounts while the document is invalid (and skips rendering above 1.5 MB), so valid-document editing pays nothing.
   - Clicking **Validate** now also *reveals* the error: the caret jumps to the highlighted slice and the failing line is scrolled to mid-view (`revealError()`). Live typing re-highlights automatically ~350 ms after each commit (commit debounce drives the same diagnostics); the failure banner keeps its line/column report.
2. **Auto-Repair JSON now fixes missing colons** (user proposal, the second half of their report: `"language" "Galician"` → *"Could not auto-repair this JSON"*). Root cause: the repair pipeline (quotes/keys → comments → literals → trailing commas → newline-comma heuristic) had **no pass for missing separators on the same line**. Fix: a new **structure-aware separator scan** (`insertSeparators()`) walks the document with a container frame stack strictly following RFC 8259 and inserts the separator that clearly belongs:
   - Inside objects: a token sitting where a value belongs (`{"language" "Galician"}`) gets `": "` (a bare `:` when whitespace already separates key and value); inside arrays: two values back-to-back get a `,` (`[1, "a" "b"]` → `[1, "a", "b"]`) — the colon pass never fires inside arrays and the comma pass never fires between key and value, so each pass is unambiguous.
   - Conservative by design: the scan bails out unchanged on anything the insertion model cannot fix unambiguously (`{"a" "b": 1}`, value without a key, second root value…) rather than guessing and corrupting the input; those cases keep the error banner + highlight.
   - Each pass stays *guarded by a parse check*: nothing is returned as "repaired" unless the result actually parses. Final repair degree: quotes, keys, comments, Python literals, trailing commas, missing commas (both newline and same-line via the scan), missing colons.

### Fixed
- **The editor text disappeared when an invalid document was committed** (user report: paste a ~20 KB document with a missing colon → text vanished from the editor pane). Root cause: a **CSS paint-order violation** in the highlight-overlay stack. The mirror `<pre>` is absolutely positioned and carried an opaque `bg-surface` fill, while the textarea was static — positioned elements paint *above* static siblings regardless of DOM order, so the moment the mirror mounted (error diagnostics arrive ~350 ms after the commit) it covered the entire textarea and the document text became invisible. Fix: the textarea is now `relative` (paints after/above the mirror) and the mirror carries no background fill; a component regression test pins both layering classes.
- Repair toast copy validation: the scan reports both `'Inserted missing colons after property names'` and `'Added missing commas'` when it applies both, so "Repaired JSON:" names every change.

### Tests
- **187 Vitest tests (19 files) + 6 Playwright E2E tests**, all passing. New:
  - 5 `repairJson` tests (missing colon mid-document, first member, values-as-numbers, later array members, array comma vs colon distinction — no false colon inside arrays)
  - 6 `errorHighlightRange` tests (colon case with gap, multiline clamp, token-window fallback, empty input, out-of-range offsets, whitespace fallback)
  - 4 `EditorPane` tests (mirror mounts only with an error + marks the key+gap; no mirror for valid docs or above the 1.5 MB cap; commit debounce; `revealError()` selects the slice)
  - 1 large-sample repair regression: a ~20 KB, 101-entry document array with a single `"language" "Galician"`-style missing colon past offset 15 000 is scanned (`Expected ':'` at the deep offset) and repaired end-to-end (`repair-large-sample.test.ts`)
  - 1 Playwright E2E: paste `{"name": "A", "language" "Galician"}`, banner names `Expected ':'`, Validate marks `"language"` in the editor (regression test tying both features together in the real build).
- Verified end-to-end on the failing sample: the scanner diagnostic at offset 22258 (`"language" "Galician"`) is now highlighted on Validate and **Auto-Repair JSON succeeds**, producing valid JSON.

### Docs
- README badge/counts, TESTING (table 19/187 + 6 E2E, repair & error-highlight sections, EditorPane component coverage incl. paint-order guard, manual QA items), ARCHITECTURE (engine module table, editor-highlight rendering note with paint-order invariant, §10 counts).

---

## [0.5.2] — 2026-11-08 — Page captures always open a dedicated workspace tab

### Fixed
- **Inspecting a page while a JSON Studio workspace was already open buried the capture** (user report: inspecting a fresh file redirected to the previous session's tab and the newly captured JSON was never shown, then silently expired with the 30 s staged-payload TTL). Root cause: the capture path reused `openWorkspace()`, which *refocused* the existing workspace tab (`tabs.update`, no reload) — and the staged payload is only read on workspace load.
- Fix (applies the user-requested behavior): **"Inspect JSON on this page" now always opens a NEW workspace tab.** Existing workspace tabs are never touched — one capture = one analysis session. The routing was extracted to `src/lib/browser/workspace.ts` with an injected tab/window API so the invariant is unit-tested: captures (`reuseExisting: false`) create a tab even when a workspace is open, while the keyboard-shortcut flow keeps refocusing/reusing.

### Tests
- **170 Vitest tests (17 files) + 5 Playwright E2E tests**, all passing. New: 4 workspace-routing tests (capture-always-new-tab, reuse-refocus, reuse-creates-when-empty, no-op outside extension context).

### Docs
- README badge/counts, TESTING browser-API row, ARCHITECTURE data-flow note.

---

## [0.5.1] — 2026-11-08 — Fixed "the extraction returned nothing" on .json URLs

### Fixed
- **Inspect on `application/json` URLs failed with "This page could not be inspected (the extraction returned nothing)"** (reported on `microsoftedge.github.io/Demos/json-dummy-data/512KB.json`). Root cause — a minifier/binary-separation bug, not a page issue:
  1. `pageExtractor()` referenced a **module-scope constant** (`MAX_EXTRACT_BYTES`). `chrome.scripting.executeScript({ func })` serializes **only the function's source**, so after bundling/minification the running function lived in one module and its constant in another — in the page world the binding simply does not exist.
  2. The injected extractor therefore threw `ReferenceError` at its first size check. Crucially, Chromium does **not** reject the promise for in-page exceptions: it resolves with a results entry that carries no `result`, and the background read `outcome = null` → our *"extraction returned nothing"* branch. Verified by injecting the exact shipped function into the real 512 KB page: pre-fix `results: 1, no result entry`; post-fix `kind: 'json-doc'`, **512,684 bytes, parses cleanly (1,584 items)**.
  3. The fix declares the cap (20 MB) **inside** `pageExtractor()`, making the injected function fully self-contained again — and a new regression test evaluates the serialized function source through `new Function` in the test environment, so any future module hoisting/lint-introduced leak fails CI immediately (`ReferenceError` proving the fix).
- The now-rare *"extraction returned nothing"* detail was also made actionable (retry guidance + paste fallback).

### Tests
- **166 Vitest tests (17 files) + 5 Playwright E2E tests**, all passing. New: injected-source self-containment guard in `page-inspection.test.ts`.

### Docs
- README badge/counts, TESTING coverage map (page-inspection row + self-containment test), ARCHITECTURE unit totals.

---

## [0.5.0] — 2026-11-08 — Page-inspection hardening, expansion preservation, expand-all

### Fixed
- **Page inspection missed JSON embedded in article pages** (reported on SitePoint's test-data page, symptom: *"No JSON found on this page (content type: unknown)"*). Three structural gaps closed:
  1. The extractor only scanned `<pre>` blocks for known-`text/html` pages — pages with an **unknown or unusual content type** never reached the container scan. Every non-`json` content type now falls through to the block scan, then to a strict body-text check.
  2. A standalone `<code>` block (not wrapped in `<pre>`) is now also considered, so docs pages that use only `<code>` tags still work.
  3. Among the page's blocks, one that **actually parses as JSON wins** over one that merely looks like JSON — tutorial pages embed JS template snippets (`[{{repeat(5, 7)}}, …]`) before the real examples, which the old loose head-check would capture as garbage.
  The body-text fallback for unknown-type pages now requires a **pure** JSON/JSONP document, so prose-mixed bodies are never captured as broken text. Verified live against the article markup: the 4-row Mockaroo sample is captured exactly (and the JS-template decoy block is skipped).
- **Format / Minify / Validate collapsed the tree** — every re-parse reset the tree to the root row. The TreeView now retains the set of expanded pointers that still exist in the re-parsed document (`retainExpanded()`, capped at 50 000 nodes like the expand-all guard): identical content keeps every expansion and the scroll position; a genuinely different document collapses as before.
- Misleading *"content type: unknown"* message when the injection itself returns nothing is now a distinct error detail.

### Added
- **Expand all / Collapse all buttons in the toolbar (tree mode)** — one click expands every array/object level instead of toggling each item. Reuses the existing `expandAll`/`collapseAll` engine with its 50 000-node guard ("too large" toast expands the first two levels).

### Tests
- **165 Vitest tests (17 files) + 5 Playwright E2E tests**, all passing. New coverage: extractor container scans/preference-over-lookalike ordering, `retainExpanded` semantics, TreeView expansion preservation + document-switch collapse, and a real-browser test of expand-all → format-preservation → collapse-all.

### Docs
- README badge/counts, TESTING coverage map (incl. the corrected 30 s session-TTL claim), ARCHITECTURE test totals.

---

## [0.4.0] — 2026-11-07 — Refactor, normalization, and the missing-tree-rows fix

### Fixed
- **Tree view: "expanded but children not showing"** — root cause found and fixed. Two compounding defects made the virtualized window lie about the real DOM:
  1. `viewportHeight` was measured in `onMounted`, but the tree viewport mounts only *after* a document exists (`v-if`). The measurement never ran, the `ResizeObserver` was never attached, and the visible-window height stayed 0 — documents over 1 000 nodes rendered only the 16-row overscan band with the bottom of the viewport blank ("some keys are missing"). Sizing now attaches through a template-ref watcher.
  2. `TreeRow`'s root had `h-full`, which beat the caller's `h-[22px]` in the cascade and made real rows 20 px tall while `ROW_H = 22` was used for all window math — cumulative drift when slicing. The row component now owns exactly `h-[22px]`, and a guard keeps the slice ≥ 30 rows if sizing ever fails.
  - Verified in the browser: a 1 000-item document renders a 46-row window (30 visible + overscan) with no blank bands, reaches the last row, and every row measures exactly 22.00 px.
- New real-browser E2E regression test: builds a >1 000-node document, expands it, asserts row pitch, scrolls to the bottom and asserts the final row is visible.

### Refactored
- **Single type source**: every shared type/interface now lives in `src/types/index.ts` — `ParseResult`, `FormattingResult`, `RepairResult`, `FormatOutcome`, `SearchOptions`, `ToastKind`/`ToastItem`, `FileReadResult`, `PendingDocument`, `ExtractOutcome`, `InspectResult`, `ToolbarOption` were consolidated out of their defining modules (all consume sites import from `@/types`). Components keep only local prop interfaces. Dead `ResolvedTheme` store type removed.
- **Deduplication**: new `SettingRow.vue` UI component replaces five repeated settings grid rows; the copy-to-clipboard-with-toast choreography (repeated 5× across workspace/tree) is now one `toast.copyWithToast()` action.
- Guarded ESLint/TS after every change; full suite re-verified.

### Tests
- **157 Vitest tests (17 files) + 4 Playwright E2E tests**, all passing; test-count tables corrected in TESTING/README (the TreeView component file from 0.3.0 had not been reflected there).

### Docs
- README badge and test counts updated; ARCHITECTURE gains the type-single-source convention and the virtualization invariants.

---

## [0.3.0] — 2026-11-06 — Lossless release (features adapted from JSON Beautifier and Editor)

Reference studied: [JSON Beautifier and Editor](https://chromewebstore.google.com/detail/json-beautifier-and-edito/lpopeocbeepakdnipejhlpcmifheolpl) (4.8★, 30K users). Feature notes for this release:

### Added
- **Lossless formatting** (adapted from its "BigInt/BigFloat support" — implemented structurally, not with a bignum library): mode (default on) formats/minifies/copies/exports by **reprinting the validated source text verbatim**. A 19-digit Snowflake ID survives format/minify round trips byte-identical; number spellings (`1e2`, `1.50`), string escape spellings, and object key order (including integer-like keys, which `JSON.stringify` silently reorders) are all preserved. Toggleable in Settings ("Lossless numbers").
- **Clickable URLs in the tree view**: HTTP(S) string values render as external links (`target="_blank"`, `rel="noopener noreferrer"`, click does not toggle the tree).
- **Copy inner JSON**: container rows gain an "inner" copy — the node's contents without the outer braces/brackets, dedented — alongside the existing outer/copy-value (merge helper, per the "Copy Inner JSON / Copy Outer JSON" pattern).
- **JSONP-aware page inspection** (adapted from its "Supports both JSON & JSONP formats"): `callback({...})` wrappers with optional trailing semicolons and dotted names are unwrapped in the service worker; plain JSON passes through untouched.
- 30 new tests → **151 Vitest tests + 3 Playwright E2E tests**, all passing, including a real-browser E2E asserting a 19-digit number survives the Format button unchanged.

### Docs
- README, ARCHITECTURE, TESTING updated: lossless reprinter section, inner/outer copy, JSONP inspection, clickable URLs, refreshed test tables.

---

## [0.2.0] — 2026-11-06 — Integrity Report release

### Added
- **Integrity Report** (flagship feature): the scanner now surfaces structural risks that `JSON.parse` and other formatters silently swallow:
  - **Duplicate property names** — every duplicate reported with its RFC 6901 JSON Pointer and occurrence count, with an explanation that the last value silently wins on re-serialization.
  - **Precision-risk numbers** — figures over 15 significant digits flagged as potential IEEE-754 rounding hazards (large generated/Snowflake-style IDs).
  - A one-line **summary above every valid document**: *"Integrity report — N duplicate keys, M precision-risk numbers"* or *"No structural risks found in this document"*.
- Component tests for the integrity report render + summary wording (suite grows 121 → **124 tests**).
- **Real-browser E2E**: Playwright Chromium installed; new smoke suite (`tests/e2e/workspace.spec.ts`) loads the built extension into headless Chromium and passes 2 tests — workspace load/paste/tree render and Integrity Report duplicate-key flagging. This closes the "never verified in a real browser" gap.
- Documentation suite: `PRIVACY.md` (full data-collection statement + reproducible source audit), `ARCHITECTURE.md` (design deep-dive), and this changelog.

### Changed
- README: added "Why Another JSON Extension?" — documents the trust pitfalls observed in the popular JSON Formatter (1.5★; user-reported donation hijacking / undisclosed tracking, `PUP.Optional.Hijacker` per Malwarebytes) and the structural answers built into JSON Studio: no content scripts, user-initiated-only page inspection, no monetization or analytics machinery, minimal permissions.
- README fixes: corrected icon path (`public/icon/128.png`), test-count badge updated to 124.

### Security & privacy
- Reproduced the full source audit: **0** instances of `fetch`/XHR/WebSocket/analytics/`eval`/`innerHTML`; manifest declares only `storage`, `activeTab`, `scripting` — no host permissions, no content scripts, no `web_accessible_resources`.

---

## [0.1.0] — Initial build

### Added
- **Core**: WXT + Vue 3 + TypeScript (strict) extension targeting Chrome MV3.
- **Views**: virtualized tree viewer (22 px rows, keyboard navigation), CodeMirror 6 code view with highlighting and error-line decoration, raw text view, staged editor pane.
- **JSON engine** (`src/utils/json/`): hand-written RFC 8259 scanner (`validate.ts`) with positions for trailing commas, missing commas, unclosed brackets, bad escapes, unterminated strings; `format.ts`, `parse.ts` (offset→line/col), `pointer.ts` (RFC 6901), `search.ts` (keys+values, 500-match cap), `stats.ts`, `tree.ts`.
- **Operations**: format (2/4-space), minify, validate, copy (raw/formatted/minified/node value/node path), file import (button + drag-and-drop) and export.
- **Page inspection**: user-initiated only via `chrome.scripting` + `activeTab`; restricted-URL denylist; payload staged in `chrome.storage.session` (`json-studio:pending-document`), single-use, 30-sec TTL, 20 MB cap; workspace consumes with `?source=tab`.
- **Preferences**: light/dark/system themes, indent size, word wrap, default view; persisted locally.
- **Chrome commands**: open workspace, inspect page (keyboard shortcuts).
- **Quality**: 121 tests passing (unit + component + performance benchmarks at 100 KB/1 MB/5 MB), ESLint clean, `vue-tsc` clean, `wxt build` producing `.output/chrome-mv3/`.
- **Tooling**: Vitest, Playwright config (E2E stub), ESLint + Prettier, icon generation script (`scripts/generate-icons.mjs`).

### Known gaps (tracked in README)
- Playwright E2E suite not yet executed against a live Chromium instance (browser binary not installed during development).
- Screenshots and store listing assets pending.
