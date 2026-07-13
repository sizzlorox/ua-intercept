---
description: "Task list for User-Agent Switcher (ua-intercept)"
---

# Tasks: User-Agent Switcher (ua-intercept)

**Input**: Design documents from `/specs/001-ua-switcher/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Targeted unit tests for the pure `src/core/` layer ARE included — the plan and quickstart explicitly specify Vitest for the logic that can go subtly wrong (client-hint derivation, DNR rule building, URL matching, import validation). Browser-integrated paths (DNR application, MAIN-world race) are validated via quickstart.md, not automated tests.

**Organization**: Grouped by user story. US1 and US2 are both P1; US1 is the shippable MVP (headers-only override) and US2 adds the full-spoof depth.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3
- Paths are repo-root-relative (extension loads unpacked from repo root).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, manifest, test harness. No build step (plain ES modules).

- [X] T001 Create directory structure per plan.md: `src/{background,core,injected,ui,shared}/`, `tests/unit/`, `icons/`
- [X] T002 Create `manifest.json` (MV3): `manifest_version:3`, background service worker `src/background/service-worker.js` (`type: module`), `permissions: ["declarativeNetRequest","declarativeNetRequestWithHostAccess","scripting","storage"]`, `host_permissions: ["<all_urls>"]`, `action` popup `src/ui/popup.html`, `options_page` `src/ui/options.html`, `incognito: "spanning"` (FR-014). **Do NOT list `override.js` in `web_accessible_resources`** — `scripting.registerContentScripts` injects it directly; a WAR entry is unnecessary and lets any page fetch/detect the spoofer (C19)
- [X] T003 [P] Initialize `package.json` with Vitest as the only devDependency; add `"test": "vitest run"` script
- [X] T004 [P] Create `tests/setup/chrome-mock.js` — minimal stub of `chrome.storage.local`, `chrome.declarativeNetRequest`, `chrome.scripting` for unit tests; wire into `vitest.config.js`
- [X] T005 [P] Add placeholder 16/48/128px `icons/` and reference them in `manifest.json`

**Checkpoint**: `npm install && npm test` runs (0 tests); extension loads unpacked with an empty popup.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared core + storage + background reconcile loop every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Implement `src/core/schema.js` — `Profile`, `AppState`, `ExportBundle` shapes + `validateProfile(p)` / `validateState(s)` per data-model.md (non-empty name/userAgent, `spoofDepth ∈ {headers,full}`)
- [X] T007 [P] Implement `src/core/presets.js` — read-only preset table (Windows Chrome, macOS Chrome, macOS Safari, iPhone Safari, iPad Safari, Android Chrome, Linux Firefox, Googlebot) with `{id,label,userAgent,platform,mobile,engine,uaData}` per data-model.md; chromium presets carry `uaData:{brands,fullVersionList,platformVersion}`, webkit/gecko `uaData:null`
- [X] T008 [P] Implement `src/shared/storage.js` — async `getProfiles()/setProfiles()`, `getState()/setState()` over `chrome.storage.local`, plus an `onChange(cb)` subscription; seed defaults (`{enabled:false, activeProfileId:null}`) on first read
- [X] T009 Implement `src/background/service-worker.js` reconcile skeleton — on `runtime.onInstalled`, `runtime.onStartup`, and every `storage.onChanged`, read `(state, profiles)` and call a single `applyState(state, profiles)` that is a pure function of its inputs (self-healing after SW suspension). Body stubbed to no-op until US1/US2 fill `applyState`.
- [X] T010 [P] [Unit] `tests/unit/schema.test.js` — valid/invalid profiles and states accepted/rejected

**Checkpoint**: Storage round-trips profiles/state; background wakes and calls `applyState` on every change (no-op).

---

## Phase 3: User Story 1 - Switch UA with a preset (Priority: P1) 🎯 MVP

**Goal**: Pick a preset, enable it, and the server sees the chosen User-Agent on all request types incl. the top-level document.

**Independent Test**: Create a profile from a preset, enable it, load `httpbin.org/user-agent` → reported UA equals the preset; toggle off → real UA. Inspect a subresource request → also fake.

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement `src/core/url-filter.js` — `urlFilterFrom(profile)` mapping `includeUrls`/`excludeUrls` to DNR condition fields (`regexFilter`/`requestDomains`/excluded*); empty filters = match all
- [X] T012 [US1] Implement `src/core/dnr-rules.js` `buildRules(profile)` — Rule A `modifyHeaders` setting `user-agent`; **`resourceTypes` MUST include `main_frame`** plus sub_frame/script/stylesheet/image/font/xmlhttprequest/media/websocket/ping/other (per contracts/dnr-and-injection.md). Headers-depth path emits only the UA header line. Returns `[]` when profile is null/disabled. (depends on T011)
- [X] T013 [US1] Fill `applyState` in `src/background/service-worker.js` — resolve active profile, call `buildRules`, and reconcile via `chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: existing, addRules})`; clear all rules when disabled/no active profile (depends on T009, T012)
- [X] T014 [P] [US1] Build `src/ui/popup.html` + `src/ui/popup.js` — **Popup variant C** per contracts/ui.md: master on/off, active-profile card, "▸ switch profile" radio list, and the `✓ header / ✓ navigator.ua` spoof badges; writes `state` to storage only (background reacts)
- [X] T015 [US1] Build `src/ui/options.html` + `src/ui/options.js` — **master-detail** per contracts/ui.md: left profile list (active `●/○`) + right edit form with fields **name, UA, platform, mobile, Include URLs, Exclude URLs** (FR-009); "New from preset" picker whose entries are the T007 presets **plus a synthetic "Custom…" entry** (FR-008) that starts an empty editable profile; Save/Delete; writes `profiles` to storage (depends on T007, T008)
- [X] T016 [P] [US1] `tests/unit/dnr-rules.test.js` — asserts `main_frame` is in `resourceTypes`, UA header value correct, `[]` when disabled
- [X] T017 [P] [US1] `tests/unit/url-filter.test.js` — include-only, exclude-only, both, and empty (match-all) cases

**Checkpoint**: MVP — headers-only UA override works end-to-end and is togglable. Stop and validate against Scenario 1 in quickstart.md.

---

## Phase 4: User Story 2 - Choose spoof depth per profile (Priority: P1)

**Goal**: A per-profile `spoofDepth` toggle; `full` adds consistent `sec-ch-ua*` headers AND rewrites in-page `navigator.userAgent`/`userAgentData`, winning the document_start race.

**Independent Test**: With a `full` profile, echo page shows fake UA on both the HTTP header and `navigator.userAgent`; for a Safari (non-Chromium) profile no Chromium `sec-ch-ua` is sent. Switch to `headers` → `navigator.userAgent` reverts to real.

### Implementation for User Story 2

- [ ] T018 [US2] **SPIKE (do first)**: prove the Server-Timing side-channel beats the document_start race — DNR appends `Server-Timing: uaint;desc="<encoded config>"` on main_frame responses; a throwaway MAIN-world script reads it synchronously from `performance.getEntriesByType("navigation")[0].serverTiming` before any page script. Confirm on a page with an inline `<script>` in `<head>`. Record findings; abort-to-headers-only fallback if unwinnable. (per research.md)
- [X] T019 [P] [US2] Implement `src/core/client-hints.js` — `deriveClientHints(profile)` returns BOTH shapes from `profile.uaData`: (a) header shape `{secChUa, secChUaMobile, secChUaPlatform}` for chromium (webkit/gecko → `remove` directives), and (b) `injectConfig` `{userAgent, platform, mobile, brands, fullVersionList, platformVersion}` for the MAIN-world `navigator.userAgentData` rebuild. Custom UA w/o `uaData` → best-effort parse from the UA string. Closes the C22 producer gap (per FR-005/SC-005)
- [X] T020 [US2] Extend `src/core/dnr-rules.js` — when `spoofDepth==="full"`, add CH header lines from `deriveClientHints` (set for chromium, remove for non-chromium) to Rule A, and add Rule B (Server-Timing config channel, id:2, main_frame/sub_frame only). Headers-depth still emits Rule A UA-only. (depends on T019, T012)
- [X] T021 [US2] Implement `src/injected/override.js` (MAIN world) — read config synchronously via the Server-Timing entry; redefine `navigator.userAgent`, `navigator.platform`, and reconstruct `navigator.userAgentData` (`brands`, `mobile`, `platform`, `toJSON()`, `getHighEntropyValues()→Promise`) per contracts. No-op if config absent (depends on T018)
- [X] T022 [US2] Extend `applyState` — when active profile is `full`, `chrome.scripting.registerContentScripts` the MAIN-world override (`document_start`, `allFrames`, `matchOriginAsFallback`, `persistAcrossSessions`); unregister it (and drop Rule B) for `headers`/disabled. Reconcile registered scripts on startup. (depends on T013, T020, T021)
- [X] T023 [US2] Add the **Spoof depth** control (`headers` / `full`) to the profile editor in `src/ui/options.js`; default `full`; surface the "workers not covered" note for `full` (depends on T015)
- [X] T024 [P] [US2] `tests/unit/client-hints.test.js` — chromium UA → correct `sec-ch-ua*` set; Safari/Firefox UA → remove directives, no Chromium brand
- [X] T025 [P] [US2] Extend `tests/unit/dnr-rules.test.js` — `full` adds CH lines + Rule B; non-chromium uses `remove`; `headers` unchanged

**Checkpoint**: Both depths work; full spoof is server+JS consistent. Validate Scenario 2 in quickstart.md.

---

## Phase 5: User Story 3 - Manage, import & export profiles (Priority: P2)

**Goal**: Full profile management (rename/duplicate/reorder/delete) plus versioned JSON export and validated import.

**Independent Test**: Create profiles, export, delete all, import → identical restore. Import `formatVersion:99` or a profile missing `userAgent` → rejected atomically, nothing changed.

### Implementation for User Story 3

- [X] T026 [P] [US3] Implement `src/core/porting.js` — `exportBundle(profiles)→{formatVersion:1,exportedAt,profiles}` and `parseBundle(jsonText)→{ok,profiles?,error?}` with the validation contract in contracts/export-format.md (version check, atomic reject, **preserve `id`; reassign only on collision**). **Serialize the full profile incl. `uaData`** so full-spoof `navigator.userAgentData` survives round-trip (C2); on import, if `uaData` is absent but `presetId` matches a known preset, re-derive it from the preset (per FR-005/SC-004/SC-005)
- [X] T027 [US3] Extend `src/ui/options.js` — rename, duplicate, drag/reorder (`order` field), delete-with-confirm; deleting the active profile clears `activeProfileId` per data-model invariant (depends on T015)
- [X] T028 [US3] Add Export button (serialize + trigger download via Blob/`URL.createObjectURL`) and Import button (file input → `parseBundle` → append valid profiles; show error on reject) to `src/ui/options.js` (depends on T026)
- [X] T029 [P] [US3] `tests/unit/porting.test.js` — round-trip export→parse preserves `id` (SC-004 field-for-field); reject wrong version; reject on any invalid profile (atomic); id reassigned only on collision with an existing profile

**Checkpoint**: Full management + import/export. Validate Scenario 3 in quickstart.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Real 16/48/128px icons replacing placeholders in `icons/`
- [X] T031 [P] Consistent error/empty states in popup + options (no profiles yet, invalid UA on save, import failure toast)
- [X] T031a [P] Accessibility pass (FR-015/SC-006) — popup + options fully keyboard-operable (Tab/Enter/Space/arrows), all inputs/buttons labeled (ARIA where needed), visible focus ring; verify by tabbing through both surfaces
- [ ] T031b Verify incognito behavior (FR-014/SC-007) — enable extension in incognito, confirm active profile applies; confirm real UA when not enabled in incognito
- [X] T032 [P] `README.md` — load-unpacked instructions, spoof-depth explanation, known limitation (workers)
- [ ] T033 Run full quickstart.md validation (Scenarios 1–6, incl. a11y + incognito) and confirm `vitest run` green
- [X] T034 [P] Manifest hardening pass — minimal permissions justified, no `web_accessible_resources` entry for `override.js` (see C19), no unused APIs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup. **Blocks all user stories.**
- **US1 (Phase 3)**: after Foundational. The MVP.
- **US2 (Phase 4)**: after Foundational; extends US1's `dnr-rules.js` and `applyState` — practically sequenced after US1 (shared files T012/T013).
- **US3 (Phase 5)**: after Foundational; extends US1's options UI (T015). Independent of US2 — can run parallel to US2 by a second dev.
- **Polish (Phase 6)**: after the stories you intend to ship.

### Within a story

- SPIKE (T018) before the rest of US2.
- `url-filter` (T011) before `dnr-rules` (T012); `dnr-rules`/`buildRules` before `applyState` wiring.
- `client-hints` (T019) before its `dnr-rules` extension (T020).

### Parallel Opportunities

- Setup: T003/T004/T005 in parallel.
- Foundational: T006/T007/T008 in parallel (different files); T010 after T006.
- US1: T011 then {T012, T014} ; unit tests T016/T017 parallel with UI T014.
- US2 vs US3: different developers can run Phase 4 and Phase 5 concurrently after Foundational (only collision is options.js — coordinate T023 vs T027/T028).
- All `tests/unit/*` marked [P] run in parallel.

---

## Parallel Example: Foundational

```bash
Task: "Implement src/core/schema.js"      # T006
Task: "Implement src/core/presets.js"     # T007
Task: "Implement src/shared/storage.js"   # T008
```

## Parallel Example: User Story 1

```bash
Task: "Implement src/core/url-filter.js"           # T011 (do first)
# then:
Task: "Build src/ui/popup.html + popup.js"         # T014
Task: "tests/unit/dnr-rules.test.js"               # T016
Task: "tests/unit/url-filter.test.js"              # T017
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate Scenario 1**. Headers-only UA switching is already a shippable extension.

### Incremental Delivery

- Foundation → **US1 (MVP: headers override)** → demo → **US2 (full spoof + depth toggle)** → demo → **US3 (management + import/export)** → demo. Each adds value without breaking the last.

### Suggested MVP scope

**Phases 1–3 (through US1).** A working, togglable, preset-driven header-level UA switcher — the core promise. US2 (JS-level consistency) and US3 (management/portability) layer on top.

---

## Notes

- The single hardest task is **T018 (document_start race spike)** — de-risk it before building the rest of US2.
- [P] = different files, no incomplete-dependency. US2 and US3 both edit `options.js` — sequence those tasks.
- Commit per task or logical group. Verify each unit test file before wiring its module into the background.
