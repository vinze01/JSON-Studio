JSON Studio — Formatter · Viewer · Validator · Integrity Reporter
================================================================

A modern, privacy-first workspace for JSON. Paste, format, validate, repair, and explore JSON — and get an Integrity Report that catches the problems every other formatter silently swallows.

◆ 100% LOCAL — NO ANALYTICS, NO ADS, NO TRACKING, NO DONATION PROMPTS
◆ OPEN SOURCE — verify every claim yourself: https://github.com/vinze01/JSON-Studio
◆ BUILT FOR LARGE DOCUMENTS — parse and scan benchmarks at 100 KB, 1 MB, and 5 MB are part of the test suite, so "fast" is enforced, not claimed


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE FLAGSHIP: INTEGRITY REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every JSON tool can parse, highlight, and pretty-print. The Integrity Report tells you what is quietly broken about your data — issues that JSON.parse and virtually every pretty-printer accept, then silently destroy on re-serialization:

● DUPLICATE PROPERTY NAMES — valid JSON per RFC 8259, but when any tool re-serializes it, all but the last value are silently discarded. If you round-trip duplicated-key JSON through an ordinary formatter, you may be silently deleting data. JSON Studio shows every duplicate with its exact RFC 6901 JSON Pointer.

● PRECISION-RISK NUMBERS — integers over 15 significant digits (large generated IDs, Snowflake-style IDs, API cursors) are parsed as IEEE-754 doubles and can shift by ±1 or worse the moment a JS-based tool touches them. That's the classic "why is this ID wrong?" bug. JSON Studio flags every at-risk number before it bites.

● INTEGRITY SUMMARY LINE — one glance above every document tells you whether it is safe to round-trip: "Integrity report — 1 duplicate key, 3 precision-risk numbers" or "No structural risks found in this document."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOSSLESS FORMATTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Integrity Report doesn't just warn — it enforces. A custom lossless reprinter reprints your numbers VERBATIM: a 19-digit Snowflake ID goes in and comes out byte-identical. It also preserves the three things that JSON.parse + JSON.stringify silently rewrite:

● number spellings (1e2, 1.50)
● string escape spellings
● object key order

Formatting, minifying, copying, and exporting all honor lossless mode (toggleable in Settings, on by default).


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDATION WITH REAL ERROR REPORTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Modern browser engines no longer include positions in parse errors, and they only report the first problem. JSON Studio uses a hand-written RFC 8259 scanner that reports exactly WHAT is wrong and WHERE — line, column, and byte offset:

● trailing commas
● missing commas between values
● unclosed brackets and braces
● bad or invalid escape sequences
● unterminated strings
● invalid literals
● duplicate keys

IN-EDITOR ERROR HIGHLIGHTING: click Validate (or just stop typing) and the editor highlights the offending text in place — the key that lacks its colon, the trailing comma, the stray token — with a live re-highlight about 350 ms after each keystroke. You see the location in the text itself, not just in a banner.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-REPAIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Broken JSON from the wild — logs, transpilers, LLM output, hand edits? Auto-Repair fixes the common damage automatically, using a structure-aware scanner (not blind regex):

● straight quotes and smart quotes → proper string quotes
● // and /* */ comments → removed
● Python literals (True / False / None) → true / false / null
● trailing commas → removed
● missing commas between values → inserted
● missing colons after property names → inserted (e.g. {"language" "Galician"} → {"language": "Galician"})

A toast tells you exactly what was repaired. Documents too ambiguous to repair safely are left untouched so the error highlight can point at the problem — Auto-Repair never guesses silently.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE WORKSPACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A full-page workspace, not a cramped sidebar — with three coordinated views plus an editor:

🌳 TREE VIEW — virtualized rendering handles huge documents without lag (only visible rows render, 50,000-node expand-all safety guard). Full keyboard navigation: arrows, Home/End, Enter/Space to toggle nodes. Clickable URLs — HTTP(S) string values open in a new tab safely.

📄 CODE VIEW — full JSON syntax highlighting with line numbers and light/dark theme support (CodeMirror 6).

📰 RAW VIEW — the untouched document text.

EDITOR — format, minify, and validate with live error detection while you type; the error banner reports the problem with line and column, and the editor marks the exact text. Import by drag-and-drop validates on the way in.

🔎 SEARCH — across both keys and values, with case-sensitive option, match count, previous/next navigation, and auto-reveal of the matching node in the tree.

📋 COPY UTILITIES — copy the document raw, formatted, or minified; copy any node's value; copy a subtree as JSON (inner JSON without the outer braces, or complete); copy a node's RFC 6901 JSON Pointer path.

📂 FILE IMPORT & EXPORT — import .json files (button or drag-and-drop, validated on import) and export formatted or minified files.

📊 STATUS BAR — live document info: validity, root type, item count, nesting depth, and size in KB.

🌐 PAGE INSPECTION — reading a JSON API endpoint or .json file in your browser? Click Inspect Page in the popup and the workspace opens with that page's JSON pre-loaded. It reads body text from JSON/text pages and <pre> blocks from HTML pages, and it unwraps JSONP payloads (callback({...})) automatically.

🎨 THEMES & PREFERENCES — Light / Dark / System (persisted), 2 or 4-space indentation, word wrap, default view mode, and reset-to-defaults.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY, IN FULL — AND VERIFIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JSON Studio collects NOTHING:

✗ No personally identifiable information
✗ Your JSON never leaves your machine — not pasted, opened, imported, or inspected
✗ No browsing history, page content, or URL reading
✗ No analytics, telemetry, or crash reporting SDKs
✗ No cookies or ad identifiers
✗ No donation prompts, "upgrade" paywalls, or new-tab hijacks — no monetization machinery of any kind

The project contains zero network-capable code. The full source is audited with mechanical greps (fetch / XMLHttpRequest / WebSocket / eval / innerHTML / remote code): all report 0 matches in the shipped source. The audit table is reproduced in the repository, and the extension is open source so you can run it yourself.

HOW YOUR DATA IS HANDLED:
● Documents you paste or import exist only in the memory of the workspace tab.
● Inspect Page is 100% user-initiated: the page text is read once per click and staged in session storage with a 30-second time-to-live, consumed once, then deleted. It never touches disk and never leaves the browser.
● Only your UI preferences (theme, indentation, default view) are persisted — stored locally, never synced, and they contain no document content.

PERMISSIONS — Minimum, and nothing more:

● storage — persists your theme and preferences locally.
● activeTab — grants access to the current tab only when you explicitly click Inspect Page. No broad host access.
● scripting — injects the one-time page extractor on your click.

Deliberately ABSENT: no host_permissions, no <all_urls>, no content scripts (nothing rewrites the pages you visit — a structural difference from most JSON extensions), no tabs/webRequest/cookies/identity/native messaging, no web accessible resources, no remote code.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUILT AND TESTED, NOT JUST SHIPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● 187 Vitest unit & component tests across 19 files — covering parsing, formatting, the validator and error-highlight mapping, repair, the lossless reprinter, tree building, search, pointer generation, stats, page inspection, storage, and the UI — plus 6 Playwright end-to-end tests in a real browser.
● Performance benchmarks at 100 KB, 1 MB, and 5 MB are part of the suite.
● Documents over ~20 MB degrade gracefully (scan guard with JSON.parse fallback).
● TypeScript strict mode, eslint clean, Manifest V3.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click the extension icon → Open Workspace.
2. Paste or drag JSON into the editor — validation, the integrity summary, and in-editor error highlights appear automatically.
3. Format / Minify / Repair / Validate from the toolbar; switch between Tree, Code, and Raw views.
4. On any JSON page, open the popup and click Inspect Page to load it here.

Source code, full privacy policy, architecture deep-dive, and release history:
https://github.com/vinze01/JSON-Studio
