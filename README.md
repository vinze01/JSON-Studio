# <img src="public/icon/128.png" alt="JSON Studio icon" width="32" height="32" style="vertical-align:middle"> JSON Studio

> A modern, privacy-first JSON formatter, viewer, validator, and developer utility — built as a Chrome Extension.

![Build Passing](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-196%20passing-brightgreen)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

**All processing is local. No external APIs. No analytics. No data leaves your browser.**

---

## Table of Contents

- [Features](#features)
- [Why Another JSON Extension?](#why-another-json-extension)
- [Screenshots](#screenshots)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation (Dev Setup)](#installation-dev-setup)
- [NPM Scripts](#npm-scripts)
- [Loading the Extension in Chrome](#loading-the-extension-in-chrome)
- [Usage Guide](#usage-guide)
- [Testing](#testing)
- [Architecture Overview](#architecture-overview)
- [Privacy & Permissions](#privacy--permissions)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🖊️ Formatting & Editing
- **Formatter** — Beautify JSON with 2 or 4-space indentation (configurable)
- **Minifier** — Compact JSON to a single line for transmission or storage
- **Syntax Validator** — Detailed error reporting with exact line and column positions

### 🛡️ Integrity Report (flagship)
Catching problems every other formatter silently hides:
- **Duplicate property names** — valid JSON, but data is silently lost on re-serialization; every duplicate shown with its RFC 6901 JSON Pointer
- **Duplicate array elements** — identical items repeated across an array (the signature of a failed dedup, a retry loop, or double-joined data) detected with a whitespace-insensitive content signature; each group shown with the pointer to its first occurrence and occurrence count
- **Precision-risk numbers** — numbers over 15 significant digits (large generated / Snowflake-style IDs) flagged before IEEE-754 rounding shifts them
- **Summary line above every document** — one glance tells you whether it is safe to round-trip this JSON

### 🔒 Lossless formatting (the Integrity Report's enforcement arm)
- Formatting, minifying, copying, and exporting **reprint your numbers verbatim** — a 19-digit Snowflake ID goes in and comes out byte-identical
- Preserves number spellings (`1e2`, `1.50`), string escape spellings, and object key order — the three things `JSON.parse` + `JSON.stringify` silently rewrite
- Toggleable in Settings ("Lossless numbers", on by default)

### 🔍 Validation & Error Detection
Smart error detection catches common mistakes beyond standard JSON parsing:
- Trailing commas
- Missing commas between values
- Unclosed brackets / braces
- Bad or invalid escape sequences
- Duplicate keys
- **In-editor error highlighting (0.6.0)** — Validate jumps to the offending text and marks it in place: the key that lacks its colon, the trailing comma, the stray token. Live editing re-highlights ~350 ms after each keystroke.

### 🩹 Auto-Repair JSON (0.6.0)
- Fixes the mistakes above automatically: quotes, comments, Python literals, trailing commas, missing commas — **and missing colons** (`{"language" "Galician"}` → `{"language": "Galician"}`), via a structure-aware scanner
- Toast tells you exactly what was repaired; documents the scanner cannot fix unambiguously stay untouched so the error highlight can point at them
- Same privacy guarantee: all repairs run in the workspace tab, no data leaves the browser

### 🌳 Interactive Tree Viewer
- Virtualized rendering (22 px row height with overscan) — handles large documents without lag
- **Keyboard navigation** — Arrow keys, Home/End, Enter/Space to toggle nodes
- Copy individual **node values** or their **JSON Pointer paths** (RFC 6901)
- **Expand / Collapse all** with a 50 000-node safety guard to prevent freezing

### 📄 Code Viewer (CodeMirror 6)
- Full JSON syntax highlighting
- Line numbers
- Light / dark theme support
- Word wrap toggle

### 🔎 Search
- Search across both **keys and values**
- Case-sensitive option
- Match count display
- Navigate previous / next match
- Auto-reveals matching node in the tree

### 📋 Copy Utilities
- Copy raw, formatted, or minified JSON
- Copy individual node values
- Copy subtrees as JSON (**inner JSON** — contents without the outer braces — and **outer JSON**)
- Copy JSON Pointer paths

### 📂 File Import & Export
- Import `.json` files via button or **drag-and-drop** — validates on import
- Export formatted or minified JSON files (lossless when enabled)

### 🌐 Page Inspection
- Inspect the current browser tab's JSON content directly from the popup (user-initiated only)
- Reads body text from JSON/text pages and `<pre>` blocks from HTML pages
- **Unwraps JSONP payloads** (`callback({...})`) automatically
- Respects restricted URLs (see [Known Limitations](#known-limitations))

### 🎨 Themes & Preferences
- **Themes:** Light, Dark, System — persisted across sessions
- **Preferences:** Indentation size, word wrap, default view mode
- Settings modal with individual controls and a reset-to-defaults option

### 📊 Status Bar
Real-time document info: validity, root type, item count, depth, and size in KB.

---

## Why Another JSON Extension?

There are dozens of JSON formatters on the Chrome Web Store — and their reviews tell two recurring stories: **broken trust** and **commodity sameness**.

### What we deliberately do NOT do

The most popular JSON Formatter (2M users) dropped to **1.5★ / 2.1K ratings** after users reported *"donation hijacking"* and *"tracking implemented without consent"* — with Malwarebytes flagging it as `PUP.Optional.Hijacker`.^[1]^[2] JSON Studio was designed from day one as the structural opposite:

| Red flag in typical formatters | How JSON Studio behaves instead |
|---|---|
| Content scripts that **auto-rewrite every JSON page** on the web | **No content scripts at all.** Page inspection is 100% user-initiated: you click **Inspect Page**, `activeTab` grants one-tab access, and the payload lives for 30 seconds in session storage. Nothing rewrites your pages. |
| Donation pop-ups, "paywall" interstitials, hijacked new tabs | **Zero monetization hooks.** No donation prompts, no "nag" UI, no modified tabs, no affiliate anything. The codebase literally contains no redirect or promotional logic. |
| Third-party analytics / tracking SDKs | **Zero network calls.** A full-source audit confirms no `fetch`, no `XMLHttpRequest`, no WebSockets, no `eval`, no remote code loading. See [PRIVACY.md](PRIVACY.md) for the reproduced audit greps. |
| Broad permissions (`<all_urls>`, `host_permissions`, `tabs`, `webRequest`) | Only `storage` + `activeTab` + `scripting`. No host permissions — Chrome explicitly asks you to grant access per tab, per click. |
| Closed source | **Open source** — verify every claim yourself. [^1] |

[^1]: User reports on the Chrome Web Store listing for `bcjindcccaagfpapjjmafapmmgkkhgoa`, June 2026.
[^2]: Statement is included verbatim from public user reviews; this project makes no accusation beyond what users published.

### The differentiator: Integrity Report

Every other formatter does the same three things: parse, highlight, pretty-print. None of them tell you **what is quietly broken about your JSON**. JSON Studio's flagship feature is the **Integrity Report** — scanning for problems that `JSON.parse` and every pretty-printer silently swallow:

- **Duplicate property names** — valid per RFC 8259, but re-serialization keeps only the *last* value. If you round-trip JSON through any other formatter, you may be silently discarding data. JSON Studio shows every duplicate with its RFC 6901 JSON Pointer.
- **Duplicate array elements** — identical items repeated across an array (a failed dedup, a retry loop, double-joined data). Unlike duplicate keys these are *not* silently discarded — the copies live on in every tool — so they usually mean the counts you are about to trust are inflated. Detected via a whitespace-insensitive content signature of each element; each reported group names the pointer to the first occurrence and how many times it repeats.
- **Precision-risk numbers** — integers over 15 significant digits (e.g., generated IDs, Snowflake/Twitter IDs) are parsed as IEEE-754 doubles and can shift by ±1 or worse when formatted, minified, or copy-pasted through a JS layer. This is a classic source of "why is this ID wrong" bugs.
- **Nesting depth** — reported in the status bar, guarded at the tree viewer.

And it backs the warning with action: the **lossless reprinter** (`utils/json/reprint.ts`) reprints numbers verbatim — verified in a real browser by an end-to-end test. Where other extensions bolt on a BigInt reimplementation (e.g. JSON Beautifier and Editor), JSON Studio guarantees the round trip is byte-exact by not re-interpreting the source at all.

A summary line appears above every document: *"Integrity report — 1 duplicate key, 3 precision-risk numbers"* or *"No structural risks found in this document"*. Data you were about to trust gets flagged, before it bites.

### What else is different

- **A workspace, not a rewrite** — full-page app with tree / code / raw views, search, copy utilities, import/export. Most competitors are a single collapsible tree.
- **Modern error reporting** — a hand-written RFC 8259 scanner that actually explains *what* is wrong and *where* (line + column + byte offset), because modern V8 no longer includes positions in parse errors.
- **Performance as a test** - parse/scan benchmarks at 100 KB, 1 MB, and 5 MB are part of the 196-test suite, so "fast on large documents" is enforced, not claimed.
- **Virtualized tree** — only visible rows render; 50 000-node expand guard.
- **Clickable URLs** — HTTP(S) string values in the tree open in a new tab (`rel="noopener noreferrer"`).

---

## Screenshots

> 📸 **Screenshots will be added before Chrome Web Store submission.**

| Workspace | Tree Viewer | Settings |
|-----------|-------------|----------|
| _coming soon_ | _coming soon_ | _coming soon_ |

---

## Technology Stack

| Category | Technology | Version |
|---|---|---|
| Extension Framework | [WXT](https://wxt.dev/) | latest |
| UI Framework | Vue 3 | 3.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Code Editor | CodeMirror 6 | 6.x |
| State Management | Pinia | 2.x |
| Icons | Lucide Icons | latest |
| Unit / Component Tests | Vitest | latest |
| End-to-End Tests | Playwright | latest |
| Manifest | Chrome MV3 | — |

---

## Prerequisites

- **Node.js** ≥ 18.x (LTS recommended)
- **npm** ≥ 9.x
- **Google Chrome** (stable or dev channel)

---

## Installation (Dev Setup)

```bash
# 1. Clone the repository
git clone https://github.com/vinze01/JSON-Studio.git
cd JSON-Studio

# 2. Install dependencies
npm install

# 3. Start the development build with hot-reload
npm run dev
```

The dev build output is written to `.output/chrome-mv3/`.

---

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start WXT in watch mode with HMR |
| `npm run build` | Production build |
| `npm run zip` | Production build + create a store-ready `.zip` |
| `npm run test` | Run all Vitest unit and component tests |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint — check for code issues |
| `npm run format` | Prettier — auto-format source files |
| `npm run test:e2e` | Playwright end-to-end tests (requires Chrome) |

---

## Loading the Extension in Chrome

After running `npm run dev` or `npm run build`, load the unpacked extension:

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder: `<project-root>/.output/chrome-mv3/`
5. The JSON Studio icon will appear in your Chrome toolbar

> **Tip:** Pin the extension for quick access via the puzzle-piece Extensions menu.

To reload after a code change (dev mode does this automatically via HMR for most changes):
- Click the ↻ refresh icon on the extension card at `chrome://extensions`

---

## Usage Guide

### Opening the Workspace

Click the **JSON Studio** icon in the Chrome toolbar to open the popup, then click **Open Workspace**. The workspace opens as a full browser tab.

### Formatting JSON

1. Paste or type JSON into the editor pane.
2. Click **Format** (or use the toolbar button).
3. The JSON is indented using your configured indentation preference (2 or 4 spaces).

### Minifying JSON

1. Load JSON into the editor.
2. Click **Minify** to compact it to a single line.

### Validating JSON

Validation happens automatically as you type. Any error is shown in the **Error Banner** above the editor with the line and column number and a human-readable description of the problem.

### Using the Tree Viewer

1. Load valid JSON.
2. Select the **Tree** view tab.
3. Navigate with arrow keys; press **Enter** or **Space** to expand/collapse nodes.
4. Right-click (or use the copy icon) on any node to copy its value or its JSON Pointer path.
5. Use **Expand All** / **Collapse All** in the toolbar.

### Searching

1. Open the **Search** panel (magnifying glass icon or keyboard shortcut).
2. Type your search term — results highlight in the tree.
3. Use ▲ / ▼ arrows to navigate between matches; the tree auto-scrolls and reveals the active match.
4. Toggle **Case Sensitive** as needed.

### Inspecting a Page

1. Navigate to any page that returns JSON (e.g., an API endpoint or a `.json` file).
2. Click the JSON Studio toolbar icon.
3. Click **Inspect Page** in the popup.
4. The workspace opens with the page's JSON pre-loaded.

### Importing a File

Drag a `.json` file onto the editor pane, or click **Import** and select the file. The content is validated automatically on import.

### Exporting a File

Click **Export** → choose **Formatted** or **Minified** to download the current JSON as a `.json` file.

### Changing Themes & Preferences

Click the **Settings** (⚙) icon to open the Settings modal:
- Choose **Light**, **Dark**, or **System** theme
- Set indentation to **2** or **4** spaces
- Toggle **Word Wrap**
- Set the **Default View Mode** (Editor / Tree / Code / Raw)
- Use **Reset to Defaults** to restore factory settings

All preferences are persisted via Chrome Storage and survive browser restarts.

---

## Testing

### Unit & Component Tests (Vitest)

```bash
npm run test
```

- **196 tests** across **19 test files** - all passing
- Covers JSON parsing, formatting, validation (incl. the error-highlight range mapper), repair/typegen, tree building, search, pointer generation, stats, page-inspection helpers, browser storage APIs, and UI components. Plus **6 Playwright E2E tests** (real Chromium).

### Type Checking

```bash
npm run typecheck
```

TypeScript reports zero errors across the full codebase.

### Linting

```bash
npm run lint
```

ESLint reports zero warnings or errors.

### End-to-End Tests (Playwright)

```bash
npm run test:e2e
```

> ⚠️ Playwright E2E tests require a real Chrome browser and are not run in CI without a browser environment.

---

## Architecture Overview

```
src/
├── entrypoints/
│   ├── background.ts          # MV3 service worker — handles inspect-page command, opens workspace
│   ├── popup/App.vue          # Extension popup (360 px wide)
│   └── workspace/App.vue      # Full-page workspace — main UI coordinator
├── components/
│   ├── layout/                # AppHeader, StatusBar
│   ├── ui/                    # AppButton, IconButton, Modal, SegmentedControl, ToastHost
│   ├── viewers/               # TreeView (virtualized), TreeRow, CodeView (CodeMirror 6), RawView
│   └── workspace/             # EditorPane, ErrorBanner, SearchPanel, SettingsModal, Toolbar
├── stores/
│   ├── document.ts            # Pinia store — all JSON document state
│   ├── preferences.ts         # Pinia store — user preferences
│   └── toast.ts               # Pinia store — toast notifications
├── lib/
│   ├── browser/
│   │   ├── files.ts           # Copy to clipboard, download files
│   │   ├── preferences.ts     # Chrome Storage adapter
│   │   ├── session.ts         # Tab-scoped JSON staging via sessionStorage
│   │   ├── workspace.ts       # Workspace-tab routing (captures always open a new tab)
│   │   └── storage.ts         # Generic Chrome Storage helpers
│   ├── page-inspection.ts     # Injected pageExtractor, isRestrictedUrl, looksLikeJsonText
│   └── utils.ts               # debounce, applyTheme
├── utils/json/
│   ├── format.ts              # JSON formatter
│   ├── parse.ts               # JSON parser wrapper
│   ├── pointer.ts             # RFC 6901 JSON Pointer generation
│   ├── repair.ts              # Auto-Repair (quotes, comments, literals, commas/colons)
│   ├── error-highlight.ts     # Error → editor highlight-range mapping
│   ├── reprint.ts             # Lossless token-verbatim reprinter
│   ├── search.ts              # Key/value search across the tree
│   ├── stats.ts               # Document stats (type, count, depth, size)
│   ├── tree.ts                # Flat tree node builder
│   └── validate.ts            # Hand-written scanner — advanced error detection
└── types/index.ts             # All shared TypeScript types
```

The **background service worker** stages captured page JSON in session storage, then opens the workspace tab. The workspace reads the staged JSON on load, so no long-lived message channels are needed.

---

## Privacy & Permissions

JSON Studio requests the minimum permissions necessary — and nothing more:

| Permission | Purpose |
|---|---|
| `storage` | Persist theme and preference settings |
| `activeTab` | Access the current tab when the user explicitly clicks Inspect Page |
| `scripting` | Inject the page extractor script into the active tab (user-initiated only) |

**No data ever leaves your machine.** There are no external API calls, no analytics, no telemetry, and no cloud sync. JSON processing — parsing, formatting, validation, tree building — happens entirely in the browser.

- 📄 **[PRIVACY.md](PRIVACY.md)** — full privacy policy, the reproduced source audit, and the Chrome Web Store submission checklist.
- 🏗️ **[ARCHITECTURE.md](ARCHITECTURE.md)** — deep dive into how the extension is built and why.
- 📋 **[CHANGELOG.md](CHANGELOG.md)** — release history.

---

## Known Limitations

| Limitation | Detail |
|---|---|
| **Raw HTTP response bodies** | Chrome's extension APIs do not expose raw HTTP response bodies. Page inspection reads the rendered DOM (body text or `<pre>` blocks) instead. |
| **Restricted pages** | `chrome://` URLs, the Chrome Web Store, and other privileged pages cannot be inspected by any extension. |
| **Inline editing** | Editing JSON inline in the tree view is planned for v1.1. |
| **E2E smoke tests pass in Chromium** | The Playwright suite loads the built extension in headless Chromium and passes (6 tests), but deeper flows (live page inspection, CodeMirror editing, file I/O) are not automated — see the manual checklist. |
| **Very large documents** | The tree viewer's 50 000-node guard prevents expanding extremely large documents all at once. Incremental expansion still works. |

---

## Troubleshooting

### Extension not appearing after `Load unpacked`

- Ensure you selected `.output/chrome-mv3/` (not the project root).
- Check `chrome://extensions` for any error messages on the JSON Studio card.
- Try clicking the ↻ reload icon on the extension card.

### "Cannot read page" error when inspecting

- The page may be a restricted URL (`chrome://`, Chrome Web Store, etc.).
- The page content may not be in the document body — some SPAs render JSON only in network responses, which cannot be intercepted by extensions.

### Theme not saving between sessions

- Ensure the extension has the `storage` permission granted. Visit `chrome://extensions` → JSON Studio → Details → Permissions.

### Tree view is slow or frozen on a large document

- Use **Collapse All** to collapse the tree, then expand only the nodes you need.
- The 50 000-node guard on **Expand All** is intentional — work with subtrees instead.

### Vitest tests fail to run

- Ensure Node.js ≥ 18 is installed: `node --version`
- Run `npm install` to ensure all dev dependencies are present.
- Run `npm run typecheck` first to surface any type errors that could cause test failures.

### Playwright E2E tests fail

- A Chrome binary must be available. Run `npx playwright install chromium` if needed.
- E2E tests launch a real browser — ensure no other Chrome instance is locking the profile.

---

## Roadmap

### v1.1 — Editing & Sharing
- [ ] Inline JSON editing directly in the tree view
- [ ] Diff viewer — compare two JSON documents
- [ ] JSON Schema validation support
- [ ] Keyboard shortcut cheatsheet overlay

### v1.2 — Conversion & Transformation
- [ ] JSON ↔ YAML conversion
- [ ] JSON ↔ CSV conversion (for arrays of objects)
- [ ] JSONPath query support
- [ ] jq-style filter / transform

### v2.0 — Collaboration & Advanced Features
- [ ] Shareable links (local encoding, no server)
- [ ] Saved snippets / history (local storage)
- [ ] Multi-tab workspace support
- [ ] Advanced search with JSONPath or jq expressions

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Install dependencies** and start dev mode:
   ```bash
   npm install && npm run dev
   ```

3. **Make your changes** and add or update tests.

4. **Verify everything passes:**
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```

5. **Format your code:**
   ```bash
   npm run format
   ```

6. **Open a Pull Request** with a clear description of what changed and why.

### Code Style

- TypeScript strict mode is enabled — no `any` without justification
- Vue 3 Composition API (`<script setup>`) throughout
- Tailwind CSS for all styling — avoid inline styles
- All new utilities must have Vitest unit tests

---

## License

MIT © JSON Studio Contributors

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```
