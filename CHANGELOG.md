# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-07-20

### Fixed

- **Silent no-op failures.** Several ways to end up with an active profile that spoofed nothing, with no error anywhere:
  - Turning the master switch on with no profile selected (or one left dangling by a delete/re-import) reconciled to "nothing active" and did nothing. It now adopts the first profile.
  - Saving a profile that produces no rules — every token blank or disabled — is now rejected instead of saving a profile that can never take effect.
  - Scoping a profile to `localhost` or a bare IP made the URL filter fail closed, disabling the profile everywhere. Both are now recognized hosts.
- **The toolbar badge no longer reports success unconditionally.** Applying DNR rules and registering the injection both swallow their own errors, so a completely failed reconcile still lit a normal badge. A failed or no-op reconcile now shows a red badge and a `⚠` tooltip.
- **`setState` no longer clobbers unrelated state** — selecting a profile from the popup, or deleting the active profile from the options page, silently reset `checkUpdates` to off.

### Changed

- New manually-created profiles default to **full** spoof depth, matching the schema default and the preset picker. The old `headers` default left `navigator.userAgent` reporting the real value, which reads as the extension being broken.
- `npm run package` refuses to build from a dirty working tree (`ALLOW_DIRTY=1` overrides). v0.1.2 shipped bytes that were not reproducible from its tag.

## [0.1.2] - 2026-07-13

### Added

- **User-Agent tokens**: a profile now holds a list of toggleable UA tokens, each **append** (add to your real User-Agent) or **replace**. The sent User-Agent is your real UA plus the enabled append tokens (or a replace value). Editor gets a token list (checkbox + mode + value + remove + add).

### Fixed

- **ModHeader import** now aggregates each ModHeader profile into **one** UA Intercept profile, its UA rows becoming the token list (enabled state + append/replace mode preserved) — instead of exploding every row into its own profile. Import format bumped to v2 (v1 exports still import).

[0.1.3]: https://github.com/sizzlorox/ua-intercept/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/sizzlorox/ua-intercept/compare/v0.1.1...v0.1.2

## [0.1.1] - 2026-07-13

### Fixed

- **ModHeader import** now brings in **every** `User-Agent` row — enabled *and* disabled — as its own profile (ModHeader users often keep several UA strings and toggle between them). Previously only the first enabled one was imported.
- **ModHeader URL filters** (regex) are now unescaped so the host is extracted (e.g. `https?://(.*\.)?facebook\.com/.*` → `facebook.com`) instead of being silently dropped.

### Changed

- **ModHeader-style UA list**: each profile is a row with an activate checkbox, click-to-edit name, and inline remove; a `+ New` sits at the list bottom, and the popup gains an inline remove on each row. (Removed the up/down reorder arrows.)

## [0.1.0] - 2026-07-13

### Added

- User-Agent override via named, reusable **profiles** (one active at a time).
- **Per-profile spoof depth**: `headers` (wire only) and `full` (wire + `navigator.userAgent`/`platform`/`userAgentData` + consistent `sec-ch-ua*`), using a `Server-Timing` config channel injected at `document_start`.
- Built-in **preset picker** (Windows/macOS/Android Chrome, macOS/iOS/iPadOS Safari, Linux Firefox, Googlebot) plus custom UAs.
- **Import / export** of profiles as versioned JSON, plus best-effort import of **ModHeader** exports (profile object, array, or `{ profile }` wrapper).
- Per-profile **include/exclude URL filters** (domain-scoped), failing closed when unresolvable.
- **Incognito** support (`spanning`) and a **toolbar badge** + tooltip while a profile is active.
- Accessible popup and options UI (keyboard-operable, labeled controls, visible focus).
- **20-language** localization (incl. Traditional Chinese and RTL) covering the full UI and error messages.
- **Optional update check** (off by default): asks GitHub's public Releases API once a day and shows a dismissible banner when a newer version exists; no user data sent.
- **Cross-browser**: runs on Chromium (Chrome/Edge/Brave/Opera/Vivaldi/Arc) and Firefox 128+ from one codebase; `npm run build` emits `dist/chrome/` and `dist/firefox/` (Firefox gets `browser_specific_settings`, an event-page module background, and `options_ui`). `navigator.userAgentData` is only spoofed on engines that natively expose it.
- Pure, unit-tested `src/core/` layer with 130+ Vitest tests.

### Known limitations

- Full spoof does not cover Web Workers and is detectable (page-readable config channel; JS-accessor overrides). See the README.

[Unreleased]: https://github.com/sizzlorox/ua-intercept/compare/v0.1.2...HEAD
[0.1.1]: https://github.com/sizzlorox/ua-intercept/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sizzlorox/ua-intercept/releases/tag/v0.1.0
