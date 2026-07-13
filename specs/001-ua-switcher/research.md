# Phase 0 Research: UA Override in Chrome MV3

All open technical questions are resolved below. Sources cited inline.

## The core fact: a UA lives on three independent surfaces

| Surface | Who reads it | How to change it (MV3, no debugger) |
|---|---|---|
| HTTP `User-Agent` request header | the server | `declarativeNetRequest` `modifyHeaders` (set) |
| `sec-ch-ua*` Client-Hint headers | the server | DNR `modifyHeaders` on those headers |
| `navigator.userAgent` / `navigator.userAgentData` | in-page JS | MAIN-world content script redefining the props |
| (all three + workers, at once) | server + JS + workers | `chrome.debugger` → CDP `Emulation.setUserAgentOverride` — **deferred** |

A DNR-only tool is **split-brain**: server sees fake, page JS sees real. That is why spoof depth is a user setting, not an accident. (MDN Navigator.userAgent; HeaderSnap; crbug 40794461.)

---

### Decision: DNR (dynamic rules) for the header layer

- **Rationale**: `modifyHeaders` on `user-agent` works for main frame + subresources; dynamic rules persist across restarts and updates; no external code needed (MV3-policy-safe). `user-agent` is explicitly on Chrome's allowed-append header list.
- **Constraint that bites (FR-004)**: DNR condition **MUST enumerate `resourceTypes` including `main_frame`**. If `resourceTypes` is omitted, the rule matches all types *except* `main_frame` — silently skipping the top-level navigation, the request that matters most.
- **Constraint (host perms)**: `modifyHeaders` requires host permission for the request URL; for subresources, **also** for the initiator. → manifest needs `<all_urls>` host access. Use `declarativeNetRequestWithHostAccess` (no scary warning) + `declarativeNetRequest`.
- **Rule budget**: `modifyHeaders` is an "unsafe" dynamic rule (cap 5,000). We use ~1 rule for the UA/CH set + optionally 1 Server-Timing rule. Non-issue.
- **Alternatives rejected**: `webRequest` blocking (in MV3 the `webRequestBlocking` permission is available only to policy/force-installed extensions — unavailable to a normal Web Store extension); static rulesets (can't hold user-defined runtime values).
- Source: developer.chrome.com declarativeNetRequest reference; ray-lothian/UserAgent-Switcher (reference MV3 impl).

### Decision: derive and set `sec-ch-ua*` to match the fake UA (full depth)

- **Rationale (SC-005, FR-005)**: Overriding only the `User-Agent` header does **not** touch the `sec-ch-ua*` Client Hints. By default (`kUACHOverrideBlank` is *off*), Chrome keeps sending the **real** low-entropy hints — so the server sees a fake UA next to real `sec-ch-ua` brand/version, which is trivially detectable. (Under the non-default `kUACHOverrideBlank` flag the hints are blanked instead — still inconsistent.) Either way, for a *consistent* spoof we must set `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform` (and remove high-entropy `sec-ch-ua-full-version-list`) to values derived from the fake UA. A non-Chromium fake UA (Safari/Firefox) must **remove** the Chromium hints entirely.
- **Low-entropy hints sent by default**: `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`. High-entropy ones require server `Accept-CH`; safe to remove.
- Source: developer.chrome.com UA Client Hints; Chromium `user_agent_utils.cc` (`kUACHOverrideBlank`, default-off); crbug 40270800.

### Decision: MAIN-world content script via `chrome.scripting.registerContentScripts` (full depth)

- **Rationale (FR-005/006)**: `navigator.userAgent` is redefined with a getter; `navigator.userAgentData` must be *reconstructed* (it's an object whose `getHighEntropyValues()` returns a Promise). Registered at `document_start`, `world: "MAIN"`, `allFrames: true`, `matchOriginAsFallback: true` (covers about:blank/srcdoc frames), `persistAcrossSessions: true`.
- **Hardest risk — the `document_start` race**: a page's own inline script can read `navigator` before the override installs, because getting the profile config via async `chrome.runtime.sendMessage` loses the race. **Chosen fix (ray-lothian's technique): a Server-Timing side-channel** — a DNR rule injects `Server-Timing: uaint;desc="<encoded profile>"` on the response; the MAIN-world script reads it back **synchronously** from `performance.getEntriesByType("navigation")` before redefining `navigator`. No async round-trip, race won.
  - This is a **spike-first task** in tasks.md, not a "wire it up" line.
- **Alternatives rejected**: async message passing (loses race); ISOLATED world (can't touch page's real `navigator`); `chrome.debugger` (infobar — deferred, see below).
- Source: developer.chrome.com scripting.registerContentScripts; ray-lothian override.js + Server-Timing channel.

### Decision: defer `chrome.debugger` / CDP tier

- **Rationale**: `Emulation.setUserAgentOverride` with `userAgentMetadata` fixes header + hints + JS + workers in one consistent call (how Puppeteer/Playwright do it). But it shows a persistent yellow **"started debugging this browser" infobar** on every tab, conflicts with DevTools (one CDP client per target), and raises a scary install warning — contradicting the "intuitive UI" goal.
- **Decision**: not in v1. Recorded in spec Assumptions as a surfaced deferral with the tradeoff. Revisit only if worker coverage becomes a hard requirement.
- Source: CDP Emulation domain; the debugger infobar is suppressible only via a launch flag (`--silent-debugger-extension-api`) or enterprise force-install policy.

### Decision: `chrome.storage.local`, not `sync`

- **Rationale (FR-012)**: `sync` caps at 8 KB/item, 100 KB total, 512 items, rate-limited writes — a multi-header/multi-profile set blows the per-item cap. `local` is 10 MB. Cross-device transfer is manual export/import, not cloud sync (explicitly out of scope).
- Source: developer.chrome.com storage API quotas.

### Decision: own compact versioned export format (not ModHeader-compatible)

- **Rationale (FR-010/011)**: Scope is UA-only; cloning ModHeader's `version:2` profile shape (headers/respHeaders/cookieHeaders/cspHeaders/filters…) would drag in fields we don't support. Use `{ formatVersion: 1, exportedAt, profiles: [...] }`. Import validates `formatVersion` and rejects unknown/incompatible files without mutating existing data. Best-effort ModHeader import deferred (their filter-item key shapes are also unverified — moot for us).
- Source: modheader.com/docs/advanced/api (what we chose *not* to mirror).

### Decision: intuitive UX = preset picker + custom fallback

- **Rationale (FR-008)**: The single thing that makes this friendlier than a raw header editor is a curated list of common browser/OS/device UAs (Windows Chrome, macOS Safari, iPhone Safari, Android Chrome, Googlebot, …) with implied platform/mobile/hint metadata, plus a "Custom…" free-text option. Presets are read-only templates; selecting one seeds a new editable profile.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---|---|
| Header modification API | DNR dynamic `modifyHeaders`, `resourceTypes` incl. `main_frame` |
| Client-hint consistency | derive `sec-ch-ua*` from fake UA; remove Chromium hints for non-Chromium UA |
| In-page navigator override | MAIN-world `registerContentScripts` at `document_start` |
| document_start race | Server-Timing response-header side-channel (synchronous read) |
| Full worker coverage | out of scope v1 (would need `chrome.debugger`, deferred) |
| Storage | `chrome.storage.local` |
| Export format | own `{formatVersion, profiles}` JSON; validated import |
| Build tooling | none — plain ES modules; Vitest for pure core only |
