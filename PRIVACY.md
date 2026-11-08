# Privacy — JSON Studio

**Last updated: November 2026**

This document is the complete privacy statement for JSON Studio, plus the auditable evidence for it. The short version:

> **JSON Studio collects no data. It transmits no data. It has no backend, no analytics, no telemetry, and no monetization machinery of any kind.**

---

## 1. What data is collected

**Nothing. Specifically:**

| Category | Collected? |
|---|---|
| Personally identifiable information | ❌ Never |
| The JSON you paste, open, import, or inspect | ❌ Never leaves your machine |
| Browsing history / page content / URLs | ❌ Never read, never stored |
| Usage analytics, telemetry, crash reporting | ❌ No SDKs exist in the build |
| Cookies or ad identifiers | ❌ None |
| Location / IP / device fingerprinting | ❌ None |

**How your JSON is handled:**

- Documents you paste or import exist only in the memory of the workspace tab you opened.
- When you click **Inspect Page**, a one-time injection reads the current tab's text, and the payload is staged in `chrome.storage.session` under `json-studio:pending-document` — **session-scoped, 30-second time-to-live, consumed once, then deleted**. It never touches disk and never leaves the browser.
- Preferences (theme, indent size, default view) are stored locally via `chrome.storage.local`. They are the *only* thing persisted, and they contain only UI settings — never document content.

---

## 2. Permissions, and why each one exists

JSON Studio requests exactly **three** permissions and **zero host permissions**:

| Permission | Why it is needed | Why it is safe |
|---|---|---|
| `storage` | Persist theme and view preferences locally | Local-only storage; no `sync` usage |
| `activeTab` | Read the current tab only after you click Inspect Page | Access is temporary and per-click, granted by Chrome to whatever tab is focused |
| `scripting` | Inject the one-time page extractor on your click | No content scripts are declared; injection happens only on a user gesture |

What is deliberately **absent**:

- ❌ **No `host_permissions` / `<all_urls>`** — the extension cannot read pages it was not explicitly granted.
- ❌ **No content scripts** — nothing auto-runs on any website you visit. Popular formatters rewrite JSON pages automatically; JSON Studio never touches a page unless you click.
- ❌ **No `tabs`, `webRequest`, `cookies`, `downloads` (beyond optional in-page downloads), `identity`, or `nativeMessaging`.**
- ❌ **No `web_accessible_resources`** — other sites cannot probe the extension.

Key navigation shortcuts (`open workspace`, `inspect page`) are declared as `commands` only — they trigger the same user-initiated flow.

---

## 3. Auditable evidence: the full source audit

You do not have to trust this document. The claims above are mechanically verifiable against the source in `src/`:

| Audit grep | Result |
|---|---|
| `fetch\|XMLHttpRequest\|WebSocket\|axios\|gtag\|analytics\|sentry\|beacon` | **0 matches in `src/`** |
| `eval\|new Function\|innerHTML\|document.write\|script.src` | **0 matches** |
| `content_scripts\|host_permissions\|<all_urls>\|web_accessible_resources` | **0 matches** |
| Remote-host URLs outside the restricted-scheme denylist | **0 matches** |

The built manifest in `.output/chrome-mv3/manifest.json` declares exactly three permissions and no host permissions.

There is one string containing `https://` in `src/lib/page-inspection.ts` — the Chrome Web Store URL in the *denylist* of pages the extension refuses to inspect. It is a string constant that is never fetched.

**Dependency graph note:** all shipped libraries (WXT, Vue 3, CodeMirror 6, Pinia, Lucide) are bundled into the extension package; no runtime network fetch of code occurs, and the build does not reference any external CDN.

---

## 4. Red flags this project deliberately avoids

The well-known JSON Formatter (`bcjindcccaagfpapjjmafapmmgkkhgoa`, 2M users) dropped to 1.5★ after users reported *donation hijacking* and undisclosed tracking, and antivirus products tagged it as `PUP.Optional.Hijacker`. ¹ JSON Studio treats those reports as a design specification of what to never do:

| Red-flag pattern | JSON Studio's structural answer |
|---|---|
| Auto-rewriting pages via content scripts on every JSON URL | No content scripts declared. Page capture is user-initiated only. |
| Undisclosed analytics/tracking SDKs | No network-capable code exists in the bundle at all. |
| Donation / nag prompts, hijacked navigation | No promotional UI, no redirects, no new-tab hijacks, no monetization code paths. |
| Broad host access justified as "convenience" | `activeTab`-only access, granted per click. |
| Closed source opacity | Open source — the audit table above is reproducible by anyone. |

¹ Verbatim user reports from the Chrome Web Store listing, June 2026. This project states only what users publicly reported and makes no independent legal accusation.

---

## 5. Chrome Web Store submission checklist

- [x] Single purpose: JSON viewing/formatting/validation.
- [x] Permission justification drafted for `storage`, `activeTab`, `scripting`.
- [x] No remote code (MV3 service worker + bundled assets only).
- [x] No user-data collection of any category in the store's data-usage disclosure.
- [x] Data cannot be sold, transferred, or used for unrelated purposes — no data access exists.
- [x] Privacy policy: this document (host a public URL of it on the repo/homepage when publishing).
- [x] No Restricted Keyword / misleading claims in the store listing.
- [ ] Item compliance review: store assets, description, and screenshots (pending manual review, see TESTING.md).

---

## 6. If this ever changes

It won't without a major published release note: any PR that adds a network API, telemetry, monetization, or content scripts is rejected by policy stated in [CONTRIBUTING rules in README](README.md#contributing). If a future version ever wanted any capability on this list, the permission gate and this document give you the chance to uninstall before updating.
