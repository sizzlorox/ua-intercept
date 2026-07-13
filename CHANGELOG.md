# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/sizzlorox/ua-intercept/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/sizzlorox/ua-intercept/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sizzlorox/ua-intercept/releases/tag/v0.1.0
