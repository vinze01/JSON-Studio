# Chrome Web Store Featured Badge — Readiness Report

**Extension:** JSON Studio · **Audited:** v1.0.1 (commit `82cb868`); fixes landed as commit `0a4af78`; shipping as v1.0.2
**Date:** November 17, 2026
**Scope:** Audit, targeted fixes, and regression tests against Google's published Featured-badge quality standards. No new features, no new permissions, no version bump, no store submission.

> **What the Featured badge is.** Per [Google's badge guidance](https://support.google.com/chrome_webstore/answer/1050673), the **Featured** badge is awarded by the Chrome Web Store review team to extensions that adhere to CWS **technical best practices**, provide an **intuitive and delightful user experience**, and use the **latest Chrome extension platform APIs** (Manifest V3). It is a curated editorial decision, not an automated checklist — passing every item below therefore **does not guarantee** the badge.

## Primary references

- [Tips for using the Chrome Web Store / badges](https://support.google.com/chrome_webstore/answer/1050673)
- [Chrome Web Store best practices](https://developer.chrome.com/docs/webstore/best-practices) (compliance, MV3, privacy, UX, security, performance, listing quality)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies) (mandatory)
- [Quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines) (mandatory, linked from best practices)

Classification keys used below: **Passed** (verified compliant), **Fixed** (found deficient, corrected in this audit), **Low/Medium/High/Critical** (open risk), **Manual** (cannot be verified from the repository — dashboard or review-team decision).

---

## 1. Store compliance (policy-mandatory items)

| # | Requirement | Finding | Class |
|---|---|---|---|
| 1.1 | **Manifest V3 required** | `manifest_version: 3`; MV3 service worker (`background.ts`, event-driven, no persistent page); no deprecated MV2 APIs (`webRequest`, persistent background, etc.). Grep-verified. | **Passed** (policy) |
| 1.2 | **Minimal, justified permissions** | Exactly `storage`, `activeTab`, `scripting` — the narrowest set that supports the features. Zero host permissions, no content scripts. | **Passed** (policy) |
| 1.3 | **Permission use matches justification** | `storage` → preferences only (`chrome.storage.local`, never `sync`). `activeTab`+`scripting` → only on the explicit **Inspect Page** click/command (`background.ts` queries the active tab, refuses restricted schemes, injects one self-contained function). No proactive tab reads anywhere. | **Passed** (policy) |
| 1.4 | **No remote code** | Grep across `src/`: zero `fetch(`, `XMLHttpRequest`, `WebSocket`, dynamic `import()`, `eval(`, `new Function`, remote `<script>`. All JS is bundled locally by WXT. | **Passed** (policy) |
| 1.5 | **Single purpose** | One coherent purpose: local JSON analysis/formatting. Page inspection serves the same purpose (bringing JSON into the tool), is strictly user-initiated, and matches the declared description. | **Passed** (policy) |
| 1.6 | **CSP compliance** | MV3 default CSP; no inline event handlers, no remote resources, no `unsafe-eval` requests. | **Passed** (policy) |
| 1.7 | **Honest metadata** | Name/description match actual functionality (formatter, viewer, validator, integrity checker, page inspection). The description names the duplicate-detection feature and fits the store's 132-character manifest limit (the v1.0.1 build's 152-char description was rejected on upload — shortened to 130). `wxt.config.ts` had drifted from the shipped manifest — now aligned, plus `homepage_url` and `action.default_icon` added. | **Fixed** → **Passed** |
| 1.8 | **No misleading claims** | "100% local" claim verified: no network code exists in the bundle (1.4); session payloads never leave the browser. | **Passed** (policy) |

**Permission-minimization analysis (per audit requirement).** Each of the three permissions was evaluated for elimination:

- `storage` — required for preference persistence (a shipped, documented feature). Cannot be dropped without removing functionality.
- `activeTab` + `scripting` — required for user-initiated page inspection. The grant is momentary, per-tab, and per-click; there is no narrower API that reads rendered page text. Removing them would remove a shipped feature (rejected — features must be preserved).
- `downloads` is deliberately **not** requested: file export uses a blob + in-page anchor download, avoiding the permission entirely. Correct trade-off, unchanged.

**Conclusion: no permission changes.** The set is already minimal; nothing to remove without breaking shipped features, nothing to add.

---

## 2. Security findings

| # | Area | Finding | Class |
|---|---|---|---|
| 2.1 | XSS / unsafe HTML | Zero occurrences of `v-html`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` across `src/`. All JSON content renders through Vue text interpolation (`{{ }}`) — hostile JSON strings cannot inject markup. | **Passed** |
| 2.2 | URL handling | Tree rows linkify only strings matching `/^https?:\/\//` (≤ 2048 chars), rendered as normal anchors with `rel="noopener noreferrer"`, `target="_blank"`; `javascript:`/`data:` URLs can never become links. | **Passed** |
| 2.3 | Prototype pollution | `coercePreferences()` validates every stored value against fixed allow-lists using own-property checks; unknown/inherited keys fall back to defaults. Session payloads validated the same way (`coercePending`). | **Passed** |
| 2.4 | Malicious JSON payloads | Parser produces plain JS values consumed by pure functions; deepest-structure and node-count guards protect the tree; huge documents keep the scan guard. Fuzz-style unit tests cover duplicate keys, huge integers, scientific notation, deeply nested input. | **Passed** |
| 2.5 | Page inspection workflow | The injected `pageExtractor` is fully self-contained (no closures/imports — chrome.scripting serializes only the function source). Restricted schemes (`chrome:`, `chromewebstore:`, `edge:`, …) are refused before injection. Payload goes to `chrome.storage.session` with a 30 s TTL, single-consumption, 20 MB cap — matching PRIVACY.md's claims exactly. | **Passed** |
| 2.6 | Clipboard | `copyText` uses the async Clipboard API with a guarded `execCommand` fallback; failures surface as user-visible toasts, never silent data loss. | **Passed** |
| 2.7 | File import | Import is opt-in per file, capped at 25 MB, read as UTF-8 text, then validated by the same parse pipeline as pasted text — no `FileReader` on untrusted `Blob` types beyond text, no auto-execution. | **Passed** |
| 2.8 | Sensitive data in logs | No `console.*` calls in shipped sources; errors render in the UI instead of being logged. | **Passed** |
| 2.9 | Production dependency vulnerabilities | `npm audit --omit=dev`: **0 vulnerabilities**. | **Passed** |
| 2.10 | Dev-only dependency advisories | `npm audit` flags advisories in devDependencies only: vitest (moderate), wxt→adm-zip/web-ext-run chain (high), esbuild dev-server on Windows (moderate), @vue/test-utils→glob (moderate), happy-dom (critical, test-environment VM escape). None ship in the `.output/chrome-mv3` bundle; exposure is limited to the developer's machine during test/build. Fixes exist but are breaking upgrades (vitest 5, wxt 0.21.5, happy-dom 21) — recommended as a separate, tested maintenance change. | **Low** (open) |

---

## 3. Privacy findings

| # | Area | Finding | Class |
|---|---|---|---|
| 3.1 | Privacy-policy accuracy | PRIVACY.md's three core claims (no collection, no transmission, session-scoped inspect payload) are each verified against code in §1.4, §2.5, §3.2. The policy and implementation agree. | **Passed** |
| 3.2 | Inspect payload lifecycle | `session.ts`: `PAYLOAD_MAX_AGE_MS = 30_000`, consumed once (`takePendingDocument` removes the key), 20 MB byte cap, validated on read. Storage-area is `chrome.storage.session` (memory-only, cleared when the browser closes). | **Passed** |
| 3.3 | Persistence footprint | Only preferences are persisted (`chrome.storage.local`); document text lives in tab memory only. Reloading the extension loses the document — consistent with the privacy stance (see 9.3 for the trade-off note). | **Passed** |
| 3.4 | No analytics/telemetry/tracking | No SDKs, no fonts, no CDNs, no external endpoints anywhere in the bundle (grep-verified). | **Passed** |
| 3.5 | Dashboard privacy declarations | The Developer Dashboard privacy tab (data-usage disclosures, certification) is not stored in the repository. | **Manual** |

---

## 4. UX findings and fixes

All fixes preserve the existing design system (Tailwind tokens, `btn`/`btn-icon` classes, lucide icons); none introduce new visual language.

| # | Finding | Severity (best-practice context) | Action |
|---|---|---|---|
| 4.1 | **Settings dialog not keyboard-dismissable.** `Modal.vue`'s focus watcher lacked `immediate: true`, but `SettingsModal` mounts `Modal` with `open` already `true` — the dialog never grabbed focus, so the overlay-bound Escape handler never received events. Verified in real Chromium: Esc did nothing (both the header gear and the popup's `?settings=1` path). **Pre-existing functional bug**, not speculative. | High | **Fixed** — dialog focuses itself on mount; regression component test added; E2E journey passes. |
| 4.2 | **Popup "Settings" opened a bare workspace.** The popup navigates to `workspace.html?settings=1`, but the workspace ignored the parameter. | High | **Fixed** — workspace opens the Settings dialog when `?settings=1` is present; E2E journey added. |
| 4.3 | **One accidental click on Clear erased the whole document.** Destructive action with no confirmation — a direct best-practices miss ("confirmation for destructive actions"). | High | **Fixed** — arm-then-confirm: first click shows "Confirm clear?" + warning icon for 3 s; second click confirms; blur/timeout disarms. Two component tests. |
| 4.4 | **Closing search dropped keyboard focus on `<body>`.** | Medium | **Fixed** — closing returns focus to the toolbar Search button. |
| 4.5 | **Popup version hardcoded** (`v1.0.0`) while the release was v1.0.1 — drift visible to reviewers. | Low | **Fixed** — version now read from `chrome.runtime.getManifest()`. |
| 4.6 | **Manifest config drift** vs shipped build (description, `homepage_url`, toolbar icon). `action.default_icon` makes the toolbar icon deterministic instead of icon-fallback. | Low | **Fixed** in `wxt.config.ts`. |
| 4.7 | Visual consistency audit (typography scale, spacing, button dimensions, radii, light/dark parity, hover/disabled states): all UI goes through shared `btn`/`btn-icon`/`panel` component classes and theme tokens; light/dark tokens both defined. No divergent one-off styling found that warranted change. | **Passed** |
| 4.8 | Empty/loading/error states: editor placeholder, "Enter valid JSON" tree placeholder, processing indicator in the status bar, error banner with line/column, toast feedback for copy/export/import/repair — all present. | **Passed** |
| 4.9 | Responsiveness: flexible workspace layout with min-height/overflow guards, modal `max-h-[85vh] w-[min(92vw,420px)]` + internal scroll, toolbar labels collapse to icons on narrow widths (`hidden md:inline`), status bar truncates. Long-string wrap is user-configurable. | **Passed** |

---

## 5. Accessibility findings and fixes

| # | Item | Finding | Class |
|---|---|---|---|
| 5.1 | Keyboard operability | Full keyboard support: toolbar, editor (textarea), tree arrow navigation, search Enter/Shift-Enter/Escape, settings selects. Fixed in this audit: leaf-row Enter copies value, plain `c` copies JSON Pointer (previously mouse-only row actions), Modal Escape (4.1). | **Fixed → Passed** |
| 5.2 | Focus visibility | Global `:focus-visible` outline (2 px accent, offset 1) plus per-control focus styles. | **Passed** |
| 5.3 | Modal focus trap | Tab/Shift+Tab now wrap inside the dialog (WCAG 2.4.3 focus order) instead of escaping behind the overlay. | **Fixed → Passed** |
| 5.4 | Radio group semantics | `SegmentedControl` was a `role="radiogroup"` whose radios ignored the arrow-key contract (every option a tab stop; no arrow navigation; double `update:modelValue` emission on each change). Now: roving tabindex, ArrowLeft/Right move selection+focus, single emission. | **Fixed → Passed** |
| 5.5 | Labels & ARIA | Icon-only buttons carry `title` + `aria-label`; dialogs are `role="dialog"` + `aria-modal` + labelled; settings rows pair `<label for>` with control ids; tree uses `role="tree"/"treeitem"` with selection state; toasts are `aria-live="polite"` with `role="status"`. | **Passed** |
| 5.6 | Color contrast | Text uses fg/fg-muted/fg-faint tokens on surface tokens, both themes; body text is 13 px high-contrast. Full WCAG AA verification against final rasterized colors is outside static-repo scope. | **Manual** (spot-check Passed) |
| 5.7 | Reduced motion | `@media (prefers-reduced-motion: reduce)` block present in `main.css`. | **Passed** |
| 5.8 | Modifier-key safety | Tree `c` shortcut is plain-key only (Ctrl/Cmd/Alt guarded) — native copy is never hijacked. | **Passed** |

---

## 6. Performance findings

Measured, not asserted — the shipped Vitest performance tests (machine-relative functional budgets) enforce:

| Document | Operations | Budget (enforced) |
|---|---|---|
| ~100 KB | parse + scan + tree + search | < 500 ms |
| ~1 MB | parse + scan | < 2000 ms |
| ~5 MB | parse only | < 5000 ms |

- Design-level performance protections verified by reading: `shallowRef` for large parse results (no deep reactivity over multi-MB trees), virtualized tree windowing at a fixed 22 px row pitch (E2E-pinned geometry), scan skip above 20 MB chars, mirror-overlay skip above 1.5 MB, debounced commits (350 ms) and debounced search (250 ms), CodeMirror behind compartments (no remount on theme/wrap toggles).
- No new performance claims are made beyond these measured budgets; no regression was introduced by this audit (test suite timing unchanged within noise).

| Class |
|---|
| **Passed** |

---

## 7. Lifecycle & reliability

| # | Scenario | Finding | Class |
|---|---|---|---|
| 7.1 | bfcache / `unload` | No `unload`/`beforeunload` handlers anywhere; no bfcache-hostile patterns. Session staging uses `storage.session`, unaffected by bfcache. | **Passed** (explicit best-practice item) |
| 7.2 | Install → first launch → workspace | Popup context detection degrades gracefully outside an extension context (unit-tested); workspace loads preferences before first paint (no theme flash). | **Passed** |
| 7.3 | Inspect → reload timing | Stale payloads (>30 s) are dropped on read, so an old capture can never leak into a fresh workspace; re-focusing a loaded tab never drops a new capture (regression guarded since 0.5.2). | **Passed** |
| 7.4 | Update/reload data expectations | Document is intentionally ephemeral; preferences survive updates via `chrome.storage.local`. Behavior is documented in README/PRIVACY. | **Passed** |
| 7.5 | Restricted-page UX | Popup disables Inspect with an explanatory message for browser UI / Store pages; background re-verifies (defense in depth). | **Passed** |
| 7.6 | Race conditions | Background messaging is request/response per click; popup state machine has explicit `inspecting`/`unavailable`/`error` states; store commit debounce is the single async boundary. No reproducible race found. | **Passed** |

---

## 8. Verification results (this audit)

| Check | Command | Result |
|---|---|---|
| Type checking | `npm run typecheck` (vue-tsc) | ✅ 0 errors |
| Linting | `npm run lint` (eslint, `--max-warnings 0`) | ✅ 0 errors, 0 warnings |
| Unit + component tests | `npm run test` (Vitest) | ✅ **204/204 passed** (19 files: 152 unit incl. 3 performance, 52 component) |
| Production build | `npm run build` (wxt) | ✅ succeeded, 731.57 kB total; built manifest verified (`action.default_icon`, `homepage_url` present; no invalid `author` object) |
| End-to-end tests | `npm run test:e2e` (Playwright, real Chromium + built extension) | ✅ **7/7 passed** |
| Production dependency audit | `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Dev dependency audit | `npm audit` | ⚠️ advisories in devDependencies only (§2.10) — not shipped |
| Network/exec greps | `fetch\|XHR\|WebSocket\|eval\|new Function\|v-html\|innerHTML\|import(` | ✅ zero hits in `src/` |

No checks were skipped. Playwright ran against a fresh production build; all journeys, including the new `?settings=1` dialog journey, passed in real Chromium.

### Tests added by this audit (10)

- `tree-view.test.ts` — leaf **Enter** copies value (toast spy); plain **c** copies pointer, Ctrl+C never hijacked (+2)
- `components.test.ts` — Modal Tab/Shift+Tab focus trap; Modal focuses itself when mounted open (the 4.1 regression); Toolbar clear arm-then-confirm; clear disarm on blur; SegmentedControl roving-tabindex + ArrowRight/Left (+5)
- `popup.test.ts` — version from `getManifest`, not hardcoded (+1)
- `workspace.spec.ts` (E2E) — `?settings=1` opens Settings, Esc closes, workspace remains (+1)
- (One lint cleanup: unused variable removed — no behavior change.)

---

## 9. Store listing recommendations

**Differentiators to lead with** (all true and demonstrated): privacy-first local processing, Integrity Report (duplicate keys, duplicate array elements, precision-risk numbers), lossless formatting, auto-repair, interactive tree/code viewers, TypeScript type generation.

| # | Listing element | Status | Class |
|---|---|---|---|
| 9.1 | Category | **Developer Tools** is the right primary category for this audience and search surface. | **Manual** (dashboard selection) |
| 9.2 | Screenshots (1280×800 / 640×400) | No screenshot assets exist in the repository. Recommended set: (1) workspace with a formatted document + Integrity Report visible; (2) duplicate-key finding with pointers; (3) tree view with search match reveal; (4) auto-repair before/after; (5) dark theme; (6) popup with Inspect Page. Google's best practices call for well-lit, captioned screenshots that show real UI — the badge review weighs these. | **Manual** |
| 9.3 | Promotional tiles (440×280 small, 920×680 marquee) | No tile assets in the repository. Keep them typographic and product-focused; the existing design tokens (dark surface, accent green) reproduce well. | **Manual** |
| 9.4 | Detailed description | Previous listing copy existed in git history (`STORE_LISTING.md`, removed in the v1.0.1 release). Current sources: extension description (manifest) + README Features section. Recommendation: keep the manifest description as the short pitch; expand the dashboard "Detailed description" from the README's Integrity Report/Lossless/Auto-Repair sections, without adding features that don't exist. | **Manual** |
| 9.5 | Privacy policy URL | PRIVACY.md is complete and accurate; host it at a stable public URL (e.g., the GitHub page) and link it in the dashboard. | **Manual** |
| 9.6 | Support contact | `homepage_url` → GitHub repository (issues tracker serves as support). Ensure the dashboard support fields match. | **Manual** |
| 9.7 | Permission justifications | Dashboard justifications should mirror PRIVACY.md §2 verbatim (verified accurate in §1.3). | **Manual** |
| 9.8 | Item quality signals (reviews, completeness) | Never fabricate reviews/ratings/awards/badge graphics. Nothing fabricated here; editorial review decides the rest. | **Manual** |

**Deliberately not changed:** the document-persistence suggestion (remembering the last document across reloads) was considered and **rejected** — it conflicts with the privacy-first "nothing about your JSON is persisted" guarantee that anchors the listing and the privacy policy. Noted as a trade-off, not an improvement.

---

## 10. Outstanding items (ordered by severity)

**Open code-level risks**

1. **Low** — Dev-only dependency advisories (§2.10). Plan a dedicated maintenance change upgrading vitest 5 / wxt 0.21.5 / happy-dom 21 with the full suite re-run; do not bundle with feature work.
2. **Low** — WCAG AA contrast on final rasterized colors should be spot-checked with a contrast tool in both themes once screenshots are produced (source tokens look sound; this closes §5.6).
3. **Low** — Popup `?settings=1` is passed via `chrome.tabs.create` from the popup; if the workspace tab is already open, the popup reuses/opens a tab and the query is honored on load — behavior verified by E2E. No action required; recorded for completeness.

**Manual, dashboard-side (required for submission, not code)**

4. Produce store screenshots (9.2) and promotional tiles (9.3).
5. Select **Developer Tools** category (9.1) and fill permission justifications (9.7).
6. Host PRIVACY.md at a public URL and complete the privacy tab + certification (3.5, 9.5).
7. Verify support fields against `homepage_url` (9.6).

---

## 11. Final readiness assessment

**Assessment: Nearly ready — minor improvements remaining (all non-code or low-severity).**

Evidence-based rationale:

- **Policy-mandatory items (§1):** every one verified Passed from source — MV3, minimal permissions with matching usage, no remote code, single purpose, honest metadata. No open policy risk was found.
- **Security & privacy (§2–3):** all code-level checks passed, including the page-inspection workflow the privacy claims depend on; production dependency audit is clean.
- **UX & accessibility (§4–5):** the audit found and fixed three real, reproducible UX defects (non-dismissable Settings dialog, dead `?settings=1` shortcut, unconfirmed Clear) plus four accessibility gaps (focus trap, roving-tabindex radio group, search focus return, tree keyboard copy). All are regression-tested, including one real-browser E2E journey.
- **Performance (§6):** measured budgets enforced in the suite; no unmeasured claims.
- **Remaining work is not code:** store assets, dashboard fields, category, and certification (§10.4–7) — none of it can be evidenced from the repository, so it is classified Manual rather than assumed compliant.
- **Known non-blockers:** dev-toolchain dependency advisories (do not ship) and a manual contrast spot-check.

Per Google's own framing, the Featured badge is a review-team judgment over and above compliance; this report makes no guarantee of the award. What it does establish is that the extension now satisfies every published policy and best-practice item that can be verified from the codebase, with the remaining verification items explicitly listed as manual.
