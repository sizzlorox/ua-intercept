# Implementation Plan: User-Agent Switcher (ua-intercept)

**Branch**: `001-ua-switcher` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ua-switcher/spec.md`

## Summary

A single-purpose Chrome MV3 extension that overrides the User-Agent per named **profile**, with a user-selectable **spoof depth**: `headers` (declarativeNetRequest sets `User-Agent` + `sec-ch-ua*`) or `full` (adds a MAIN-world content script that rewrites `navigator.userAgent`/`userAgentData`, winning the `document_start` race). Profiles are managed in a popup + options UI, seeded from a preset picker, persisted in `chrome.storage.local`, and exportable/importable as a versioned JSON file. No build step required; plain ES modules.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules); HTML/CSS for UI. No transpiler.

**Primary Dependencies**: Chrome Extension APIs only — `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`, `scripting` (`registerContentScripts`, MAIN world), `storage`. No runtime npm dependencies (the MV3 CSP/remote-code policy forbids them, and nothing here justifies one).

**Storage**: `chrome.storage.local` (10 MB; avoids sync's 8 KB/item cap). Import/export via downloaded JSON file.

**Testing**: Vitest + a thin `chrome.*` mock for unit-testable pure modules (UA→client-hints derivation, DNR-rule builder, import validator, URL-filter matcher). Manual/quickstart for the browser-integrated paths (DNR application, MAIN-world race).

**Target Platform**: Chromium desktop, Manifest V3.

**Project Type**: Browser extension (single project, no backend).

**Performance Goals**: UA override applies from the first request after enabling a profile; profile switch reflected in < 200 ms. Not throughput-bound.

**Constraints**: MV3 remote-code ban (all logic bundled, no `eval`); DNR `modifyHeaders` is an "unsafe" dynamic rule (5,000 cap — irrelevant, we use a handful); host permissions required for subresource header edits; MAIN-world `document_start` race is the hardest constraint.

**Scale/Scope**: Personal tool — tens of profiles, one active at a time.

## Guiding Principles

These self-imposed guardrails govern the design: single-purpose (UA only), no runtime dependencies, and a pure-core / side-effect-shell split so the tricky logic is unit-testable without a browser. No complexity exceptions are tracked.

## Project Structure

### Documentation (this feature)

```text
specs/001-ua-switcher/
├── plan.md              # This file
├── research.md          # technical research & decisions
├── data-model.md        # entities & shapes
├── quickstart.md        # validation guide
├── contracts/           # export schema, DNR rule shape, message API
└── tasks.md             # dependency-ordered task breakdown
```

### Source Code (repository root)

```text
manifest.json                 # MV3 manifest: permissions, background SW, options/popup
src/
├── background/
│   └── service-worker.js     # orchestrates: reads state, builds+applies DNR rules,
│                             #   registers/unregisters MAIN-world script, Server-Timing rule
├── core/                     # PURE, browser-free, unit-tested
│   ├── presets.js            # built-in preset UA table (+ implied platform/mobile/hints)
│   ├── client-hints.js       # deriveClientHints(profile) -> {header: sec-ch-ua*, injectConfig: navigator.userAgentData fields}
│   ├── dnr-rules.js          # buildRules(profile) -> chrome.declarativeNetRequest rule[]
│   ├── url-filter.js         # include/exclude pattern -> DNR condition fields
│   ├── schema.js             # Profile/AppState/ExportBundle shapes + validators
│   └── porting.js            # export(profiles) / import(json) with format-version check
├── injected/
│   └── override.js           # MAIN-world: redefine navigator.userAgent/userAgentData;
│                             #   reads config synchronously via Server-Timing channel
├── ui/
│   ├── popup.html / popup.js # quick on/off + active-profile switch + status
│   └── options.html / options.js # CRUD, reorder, preset picker, import/export buttons
└── shared/
    └── storage.js            # thin async wrappers over chrome.storage.local + change events
tests/
├── setup/
│   └── chrome-mock.js        # minimal chrome.* stub for unit tests
└── unit/                     # vitest specs for everything under src/core/
vitest.config.js              # wires the chrome-mock setup file
package.json                  # vitest devDependency + "test" script (no build step)
```

**Structure Decision**: Single-project browser extension. The key discipline is the **`src/core/` pure layer**: every piece of logic that can go subtly wrong (client-hint derivation, DNR rule construction, URL matching, import validation) lives here with no `chrome.*` calls, so it is unit-tested in Node/Vitest. `background/`, `injected/`, `ui/` are thin side-effect shells that wire the pure core to Chrome APIs.

## Complexity Tracking

No guardrail violations to justify. Intentionally empty.
