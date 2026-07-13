# Feature Specification: User-Agent Switcher (ua-intercept)

**Feature Branch**: `001-ua-switcher`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Chrome extension like ModHeader that can change the User-Agent, importable, exportable, and easily managed, with a selectable level of spoofing and an intuitive UI."

## Overview

A Chrome (MV3) extension that overrides the browser's User-Agent for outgoing requests using named, reusable **profiles**. Unlike a generic header editor, it is single-purpose (UA + matching Client Hints) and lets the user choose **how deep** the spoof goes per profile. Profiles are managed in an intuitive UI, and the whole set is exportable/importable as a JSON file.

## Clarifications

### Session 2026-07-13

- Q: Should the UA override work in Incognito windows? → A: Yes, spanning — same profiles/active selection apply in incognito once the user enables the extension in incognito; manifest `incognito: "spanning"`.
- Q: Is a basic accessibility baseline a v1 requirement for the popup/options UI? → A: Yes — all controls keyboard-operable, all inputs/buttons labeled, visible focus.
- Q: When the master toggle is switched off (or a profile switched to headers-only), what happens to already-open full-spoof tabs? → A: New page loads only; already-open tabs keep the spoofed `navigator` until reloaded (no forced reload, no `tabs` permission).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch UA with a preset (Priority: P1)

A user opens the extension popup, picks a profile whose UA is a preset (e.g. "iPhone Safari", "Windows Chrome", "Googlebot"), toggles it on, and reloads a page. The site now sees the chosen User-Agent.

**Why this priority**: This is the entire point of the product. Delivers value alone — a one-profile MVP is already useful.

**Independent Test**: Create a profile from a preset, enable it, load a UA-echo page (e.g. httpbin.org/user-agent), confirm the server-reported UA matches the preset.

**Acceptance Scenarios**:

1. **Given** a profile set to a preset UA and enabled, **When** any page loads, **Then** the request's `User-Agent` header equals the preset value.
2. **Given** the profile is toggled off, **When** a page loads, **Then** the request uses Chrome's real User-Agent.
3. **Given** two profiles exist, **When** the user enables one, **Then** only that profile's UA is applied (single active profile at a time).

---

### User Story 2 - Choose spoof depth per profile (Priority: P1)

Each profile has a **spoof depth** setting. "Headers only" changes just the wire headers (fast, invisible to page JS). "Full spoof" also makes in-page JavaScript (`navigator.userAgent`, `navigator.userAgentData`) report the fake UA, and sets the `sec-ch-ua*` Client Hint headers to stay consistent with the fake UA.

**Why this priority**: The differentiator the user explicitly asked for ("choose the level of spoofing"). Headers-only leaves page JS reading the real UA (split-brain, detectable); full spoof closes that gap.

**Independent Test**: With a full-spoof profile enabled, on a UA-echo page confirm both the server header AND `navigator.userAgent` in the page console report the fake UA. Switch the profile to headers-only, confirm the server header is fake but `navigator.userAgent` is real.

**Acceptance Scenarios**:

1. **Given** a profile set to "headers only", **When** a page loads, **Then** the `User-Agent` header is fake and `navigator.userAgent` in the page is the real Chrome value.
2. **Given** a profile set to "full spoof", **When** a page loads, **Then** the `User-Agent` header, the `sec-ch-ua*` headers, AND `navigator.userAgent`/`navigator.userAgentData` all report values consistent with the fake UA.
3. **Given** a full-spoof profile, **When** a page's own script reads `navigator.userAgent` at the very start of page load, **Then** it reads the fake value (the override installs before page scripts run).

---

### User Story 3 - Manage, import, and export profiles (Priority: P2)

A user creates, renames, edits, duplicates, reorders, and deletes profiles in an options page. They export all profiles to a downloadable JSON file, and later import that file (on another machine or after reinstall) to restore them.

**Why this priority**: "Importable, exportable, easily managed" was an explicit requirement. Not needed for the raw MVP but is core to the product promise.

**Independent Test**: Create several profiles, export to JSON, delete them all, import the file, confirm every profile returns identical.

**Acceptance Scenarios**:

1. **Given** one or more profiles, **When** the user clicks Export, **Then** a JSON file downloads containing all profiles and a format version.
2. **Given** a valid exported JSON file, **When** the user imports it, **Then** the profiles are added/restored and appear in the list.
3. **Given** an invalid or wrong-version JSON file, **When** the user imports it, **Then** the extension rejects it with a clear error and changes nothing.
4. **Given** an existing profile, **When** the user edits its UA string or fields, **Then** the change persists across browser restarts.

---

### Edge Cases

- **Main-frame miss**: the top-level document request must be affected, not just subresources.
- **Client Hints mismatch**: full spoof must set `sec-ch-ua*` consistently; otherwise the server sees a fake UA with real client hints (detectable). Fake UA that is non-Chromium (e.g. Safari) should suppress/blank the Chromium-specific hints.
- **document_start race**: a page's own inline script may read `navigator` before the JS override installs; full spoof must win this race.
- **Custom / malformed UA string**: the user may type any UA; empty string is invalid and rejected.
- **Import of another tool's file** (e.g. ModHeader): out of scope for v1 — rejected as unknown format.
- **Workers & non-document contexts**: JS override covers documents only, not Web Workers (named limitation, see Assumptions).
- **No profile active**: extension is effectively a no-op; real UA is used.
- **Toggle off with open tabs**: new requests immediately use the real UA, but already-loaded pages keep their spoofed `navigator` until reloaded (an injected in-page override cannot be retracted live). This is expected, not a bug.
- **Incognito not enabled**: if the user has not allowed the extension in incognito, incognito windows use the real UA regardless of the active profile.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create, edit, rename, duplicate, reorder, and delete named UA profiles.
- **FR-002**: Each profile MUST hold a User-Agent string, a human name, and a spoof-depth setting (`headers` | `full`).
- **FR-003**: System MUST let the user enable/disable UA overriding, with at most one profile active at a time.
- **FR-004**: When a profile is active, System MUST set the `User-Agent` request header to the profile value for **all** request types including the top-level document (`main_frame`) and subresources.
- **FR-005**: For `full` spoof depth, System MUST also set the `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform` (and, when applicable, full-version-list) Client Hint headers to values consistent with the fake UA, and MUST override `navigator.userAgent`, `navigator.platform`, and `navigator.userAgentData` in the page so in-page JavaScript reports the fake UA.
- **FR-006**: For `full` spoof depth, the in-page override MUST be installed before the page's own scripts run (win the document_start race).
- **FR-007**: For `headers` spoof depth, System MUST NOT modify in-page `navigator` values.
- **FR-008**: System MUST provide a picker of built-in preset UA strings (common browser/OS/device combinations, incl. a bot example) plus a custom free-text option, so users need not hand-type UAs.
- **FR-009**: Users MUST be able to scope a profile with optional include and exclude URL patterns; with none set, the profile applies to all URLs.
- **FR-010**: Users MUST be able to export all profiles to a single downloadable JSON file that includes a format version.
- **FR-011**: Users MUST be able to import a previously exported JSON file, restoring profiles; import MUST validate the format and reject unknown/incompatible files without altering existing data.
- **FR-012**: Profiles and the active-profile selection MUST persist across browser restarts.
- **FR-013**: The popup MUST show current state at a glance (which profile is active, on/off) and allow quick enable/disable and profile switching.
- **FR-014**: The extension MUST support Incognito windows in `spanning` mode — when the user enables it in incognito, the same profiles and active selection apply there; the override MUST NOT run in incognito if the user has not enabled it.
- **FR-015**: The popup and options UI MUST be operable by keyboard alone (all controls reachable and actuatable), MUST label all form inputs and buttons for assistive technology, and MUST show a visible focus indicator.
- **FR-016**: Turning the master switch off, or switching a profile's depth, MUST take effect for all NEW requests/page loads immediately; the extension is NOT required to force-reload already-open tabs, which retain any in-page `navigator` override until the user reloads them.

### Key Entities

- **Profile**: A named UA override. Attributes: id, name, userAgent (string), spoofDepth (`headers` | `full`), includeUrls (patterns), excludeUrls (patterns), color/label (optional, for UI), order. Optionally caches derived Client Hint values for `full` depth.
- **Preset**: A built-in, read-only UA template the user can base a profile on (name + userAgent + implied platform/mobile metadata).
- **App State**: Global on/off flag and the id of the currently active profile.
- **Export Bundle**: A versioned container `{ formatVersion, profiles[] }` used for import/export.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from a fresh install to a working UA override (pick preset, enable, see it applied) in under 60 seconds, measured manually (stopwatch) per quickstart Scenario 4.
- **SC-002**: With a `full` profile active, an independent UA-echo/fingerprint page reports the fake UA on **both** the HTTP header and `navigator.userAgent` in 100% of the top-level page loads tested (measured on fresh page loads after the profile is active).
- **SC-003**: With a `headers` profile active, the HTTP `User-Agent` is fake on 100% of request types tested (main_frame + at least 3 subresource types).
- **SC-004**: Export → wipe → import reproduces every profile field-for-field with zero data loss.
- **SC-005**: For a `full` non-Chromium (e.g. Safari) profile, the server receives no contradictory Chromium `sec-ch-ua` values (consistency check passes).
- **SC-006**: Both the popup and options UI can be fully operated using only the keyboard (Tab/Shift+Tab/Enter/Space/arrows), every input and button has an accessible label, and focus is always visibly indicated.
- **SC-007**: With the extension enabled in incognito, a `full`/`headers` profile applies to incognito windows identically to normal windows; with it not enabled in incognito, incognito requests use the real UA.

## Assumptions

- **Target**: Chromium-based browsers on desktop with Manifest V3. Firefox and mobile are out of scope for v1.
- **Incognito**: manifest `incognito: "spanning"` (shared state across normal/incognito). Chrome still requires the user to opt the extension into incognito; the extension does not (and cannot) force this.
- **Single active profile** at a time (not stacked/simultaneous like ModHeader's multi-profile). Simpler, matches "switch my UA" intent.
- **Storage**: Profiles are stored in `chrome.storage.local` (not `sync`) to avoid the 8 KB-per-item sync limit; cross-device transfer is via manual export/import, not cloud sync.
- **Spoof depth tiers shipped in v1**: `headers` and `full`. A third tier using `chrome.debugger`/CDP (`Emulation.setUserAgentOverride`) would additionally cover Web Workers and be maximally consistent, but is **deliberately deferred**: it shows a persistent "started debugging this browser" infobar on every tab and conflicts with DevTools, which contradicts the "intuitive UI" goal. Documented here as a surfaced decision, not a silent omission.
- **JS override covers document contexts only**, not Web Workers or `SharedWorker`/`ServiceWorker` scripts, nor `about:blank`/`srcdoc`/`data:` child frames (which have no network response to carry the config channel). A known limitation of the non-debugger approach.
- **Full spoof is detectable, not stealthy.** The MAIN-world config is delivered via a page-readable `Server-Timing` response header, and the `navigator.*` overrides are JS accessors distinguishable from native. This defeats casual UA sniffing but not a determined fingerprinter; a fully-consistent, undetectable override would require the deferred `chrome.debugger`/CDP tier.
- **Out of scope for v1** (present in ModHeader, not requested here): response-header editing, cookie/Set-Cookie editing, CSP editing, URL redirects, a hosted REST API, enterprise managed-storage preload, cloud backup/sync, and shareable profile URLs.
- **ModHeader import IS supported**: the import flow accepts ModHeader exports (profile object, array, or `{ profile }` wrapper) and extracts the enabled `User-Agent` header into a `headers`-depth profile (carrying title, color, and domain-resolvable URL filters). Only the UA is imported — ModHeader's other header types are ignored.
- **Permissions**: The extension requires host access (`<all_urls>` or equivalent) because header modification for subresources requires host permission for the request initiator. This is inherent to the feature.
