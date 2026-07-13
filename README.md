<div align="center">

# 🎭 UA Intercept

**A single-purpose Chrome (MV3) extension to override your User-Agent — with importable, exportable, managed profiles and a spoof depth you choose.**

[![CI](https://github.com/sizzlorox/ua-intercept/actions/workflows/ci.yml/badge.svg)](https://github.com/sizzlorox/ua-intercept/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34a853.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Tests](https://img.shields.io/badge/tests-vitest-6da55f.svg)](#development)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

Unlike a generic header editor, UA Intercept does one thing well: it changes the User-Agent (and matching Client Hints) via named **profiles**, and lets you pick **how deep** the spoof goes — headers only, or a full override that page JavaScript sees too. It can import your existing **ModHeader** profiles, and the whole UI is localized into 20 languages.

> ⚠️ **Not a stealth tool.** Full spoof defeats casual UA sniffing, not a determined fingerprinter — see [Known limitations](#known-limitations).

## Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Spoof depth](#spoof-depth)
- [Import from ModHeader](#import-from-modheader)
- [Known limitations](#known-limitations)
- [Languages](#languages)
- [Development](#development)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Features

- 🎭 **Profiles** — create, edit, duplicate, reorder, delete named UA profiles; one active at a time.
- 🎚️ **Selectable spoof depth** — `headers` (wire only) or `full` (wire + `navigator.*` + consistent `sec-ch-ua*`).
- 🧰 **Preset picker** — Windows/macOS/Android Chrome, macOS/iOS/iPadOS Safari, Linux Firefox, Googlebot, or a custom UA.
- 🔀 **Import / export** — your own versioned JSON, plus best-effort import of **ModHeader** exports.
- 🎯 **Per-profile URL filters** — scope a profile to (or away from) specific domains.
- 🕶️ **Incognito support** (`spanning`), **toolbar badge** while active, and a keyboard-operable, screen-reader-labeled UI.
- 🌍 **20 languages**, including Traditional Chinese, with RTL support.
- 🔔 **Optional update check** (off by default) — when enabled, asks GitHub's public Releases API once a day and shows a dismissible banner if a newer version exists. No user data is sent.
- 🧪 **No build step, no runtime dependencies** — plain ES modules; a pure, unit-tested core.

## Browsers

Cross-browser by design — one codebase, per-browser packages.

| Browser | Status | Package |
|---|---|---|
| Chrome, Edge, Brave, Opera, Vivaldi, Arc (Chromium) | ✅ Supported | `dist/chrome/` |
| Firefox | ✅ Supported (Firefox 128+) | `dist/firefox/` |
| Safari | ⛔ Not yet (needs Xcode conversion + Apple Developer account) | — |

`src/core/` is identical across engines; only the manifest and a couple of feature guards differ. `npm run build` emits both packages into `dist/`.

## Install (load unpacked)

**Chromium (Chrome/Edge/Brave/Opera/Vivaldi/Arc):**

1. `npm install && npm run build` (or just point at the repo root — the root `manifest.json` is the Chromium one).
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/chrome/` (or the repo root).
3. Pin it; click the icon. (Optional: **Details → Allow in Incognito**.)

**Firefox:**

1. `npm install && npm run build:firefox`
2. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `dist/firefox/manifest.json`.
   Or, for live-reload dev: `npm run start:firefox` (uses `web-ext`).

## Usage

- **Toolbar icon** — while a profile is active, the icon shows a colored badge (the profile's initials in its color, ModHeader-style) and the tooltip names the active profile and depth; the badge clears when you turn it off.
- **Popup** — master on/off, pick the active profile, and see live badges of what's actually being spoofed (`✓ header` / `✓ navigator.ua`).
- **Options** (⚙ Manage) — create/edit/duplicate/reorder/delete profiles, import/export.

## Spoof depth

Each profile has a depth:

- **Headers only** — a `declarativeNetRequest` rule sets **only** the `User-Agent` request header. The **server** sees the fake UA, but the `sec-ch-ua*` Client Hints and page JavaScript (`navigator.userAgent`) still reflect the real browser. Use this when you only need the wire UA changed and want minimal footprint.
- **Full** — sets the `User-Agent` **and** matching `sec-ch-ua*` Client Hints (for Chromium profiles; non-Chromium profiles such as Safari/Firefox **remove** the Chromium hints so the server isn't sent contradictory ones), **and** injects a `document_start` MAIN-world script that rewrites `navigator.userAgent`, `navigator.platform`, `navigator.userAgentData`, `navigator.appVersion`, and `navigator.vendor`, kept consistent via a `Server-Timing` config channel.

Client-Hint handling and `navigator.*` rewriting happen **only** in `full` depth.

## Import from ModHeader

**Import** accepts both UA Intercept's own JSON export and **ModHeader** exports (a profile object, an array of them, or the REST `{ profile }` wrapper). From a ModHeader profile it pulls the enabled `User-Agent` header into a new `headers`-depth profile, carrying over the title, color, and any URL filters that map to a domain. ModHeader profiles without a User-Agent header are skipped; only the UA is imported (its other header types are ignored).

## Known limitations

These are inherent to a non-`chrome.debugger` MV3 extension. Full, undetectable spoofing (including workers) is only possible via the CDP tier, which shows a persistent "started debugging this browser" banner — deliberately deferred.

- **Web Workers** are not covered by full spoof (they don't run the document-context override).
- **The full spoof is detectable.** The config is delivered to the `document_start` MAIN-world script via a `Server-Timing: uaint;...` response header, which is also readable by page JavaScript and cannot be cleared. The `navigator.*` getters are JS accessors, distinguishable from native ones.
- **The `document_start` race** (a page inline script reading `navigator` before the override installs) is mitigated by the synchronous Server-Timing read but is not guaranteed on every page.
- **`about:blank` / `srcdoc` / `data:` child frames** have no network response, so those frames report the real `navigator` even under full spoof.
- **URL filters** are domain-scoped in v1 (path/regex globbing deferred); an include list that resolves to no valid domain fails **closed** (matches nothing).
- Turning the extension off affects **new** requests immediately; already-open tabs keep the spoofed `navigator` until reloaded.

## Languages

The entire UI — including validation and import error messages — is localized via Chrome's `_locales/` i18n and follows the browser's language automatically (RTL layouts included): English, Traditional Chinese (繁體中文), Simplified Chinese, Spanish, French, German, Italian, Portuguese (Brazil), Russian, Japanese, Korean, Arabic (RTL), Hindi, Dutch, Turkish, Polish, Vietnamese, Indonesian, Thai, and Ukrainian.

Adding a language is one file — see [CONTRIBUTING](./CONTRIBUTING.md#adding-a-language).

## Development

```bash
npm install
npm test            # vitest — unit tests for the pure src/core/ layer
npm run validate    # manifest + locale + icon sanity check
npm run build       # emit dist/chrome/ and dist/firefox/
```

No transpiler or bundler — the source is plain ES modules. The only "build" is `scripts/build.mjs`, which copies the source and writes the per-browser `manifest.json` (Chromium as-is; Firefox gets `browser_specific_settings`, an event-page module background, and `options_ui`). Icons are generated by `scripts/gen-icons.mjs`.

## Architecture

`src/core/` is **pure, browser-free, and unit-tested** — client-hint derivation, DNR rule building, URL matching, import validation, badge labels. It returns stable data and error *codes* and never calls `chrome.*`. The `src/background/`, `src/injected/`, and `src/ui/` layers are thin shells wiring that core to Chrome APIs and localizing the codes.

```text
manifest.json          MV3 manifest
_locales/<code>/        i18n message catalogs (20 languages)
icons/                  toolbar/store icons
src/
  core/                 pure logic (unit-tested)
  background/           service worker: reconciles DNR rules + injection + badge
  injected/             MAIN-world navigator override
  ui/                   popup + options page
  shared/               storage + i18n helpers
tests/unit/             vitest specs for src/core/
scripts/                build.mjs, validate.mjs, gen-icons.mjs
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md). Good first issues: add a preset, add/improve a translation, or help validate the `document_start` race on real sites.

## Privacy

No data collection, no tracking, no account. Profiles stay on your device; the only network request is an opt-in, default-off update check to GitHub's public API. See [PRIVACY.md](./PRIVACY.md).

## Security

Found a vulnerability? Please **don't** open a public issue — see [SECURITY.md](./SECURITY.md) for private reporting.

## License

[MIT](./LICENSE) © UA Intercept contributors.
