# Quickstart / Validation Guide

Proves the feature end-to-end. Assumes implementation exists per [plan.md](./plan.md).

## Prerequisites

- Chromium-based browser, desktop, MV3.
- This repository checked out locally (any path).
- Node + npm (for the unit tests of `src/core/` only). No build step for the extension.

## Load the extension

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the repo root (where `manifest.json` lives).
3. Pin the extension; open its popup.

## Run the pure-core unit tests

```bash
npm install
npm test
```

Expected: green for `client-hints`, `dnr-rules`, `url-filter`, `porting`, `schema`.

## Scenario 1 — headers-only override (FR-004, SC-003)

1. Options page → **New profile** → pick preset **"Windows Chrome"** → set **Spoof depth: Headers only** → Save.
2. Popup → enable, select the profile.
3. Visit `https://httpbin.org/user-agent` (or any UA echo). **Expect**: reported UA = the Windows Chrome preset.
4. Open DevTools console on that page → `navigator.userAgent`. **Expect (headers depth)**: the **real** Chrome UA (proves headers-only does not touch page JS).
5. Load a page with subresources; in the Network tab inspect an image/script/xhr request's `User-Agent`. **Expect**: fake on all types incl. the top-level document.

## Scenario 2 — full spoof (FR-005/006, SC-002, SC-005)

1. Edit the profile → **Spoof depth: Full** → Save. (Or make a new "iPhone Safari" full profile.)
2. Reload the echo page. **Expect**: server UA = fake.
3. Console → `navigator.userAgent` and `navigator.userAgentData.getHighEntropyValues(["platform","platformVersion"])`. **Expect**: both report values consistent with the fake UA.
4. Consistency check: on a page that logs request headers, confirm `sec-ch-ua*` match the fake UA family; for the **iPhone Safari** (non-Chromium) profile, confirm **no** Chromium `sec-ch-ua` brand is sent (SC-005).
5. Race check (FR-006): visit a page whose inline `<script>` at top of `<head>` writes `navigator.userAgent` into the DOM. **Expect**: the fake value, proving the override installed before page scripts.

## Scenario 3 — manage + import/export (FR-010/011, SC-004)

1. Create 3 profiles (mix of depths, one with include/exclude URL filters).
2. Options → **Export** → a JSON file downloads (see [contracts/export-format.md](./contracts/export-format.md)).
3. Delete all 3 profiles.
4. **Import** the file. **Expect**: all 3 return field-for-field.
5. Import a hand-edited file with `formatVersion: 99`. **Expect**: rejected with a clear error, existing profiles unchanged.
6. Import a file with a profile missing `userAgent`. **Expect**: whole import rejected atomically.

## Scenario 4 — toggling & persistence (FR-003/012/016, SC-001)

1. Toggle the master switch off in the popup → a **newly loaded** echo page shows the real UA.
2. Toggle-off with an open tab (FR-016): with a `full` profile active, load the echo page, then toggle the master switch off **without reloading**. **Expect**: the already-open tab still reports the fake `navigator.userAgent` (an injected override can't be retracted live); reload → real UA. This is expected, not a bug.
3. Restart the browser → the extension remembers `enabled` + `activeProfileId`; the active profile is re-applied.
4. Fresh-install timing (SC-001): from load-unpacked to first successful override < 60 s (manual stopwatch) following Scenario 1 steps.

## Scenario 5 — accessibility (FR-015, SC-006)

1. Open the popup. Using **only the keyboard** (Tab/Shift+Tab/Enter/Space/arrows), reach and actuate every control: master toggle, profile switch/radio list, New, Manage. **Expect**: all reachable, focus always visibly indicated.
2. Open the options page. Tab through the profile list and the full edit form. **Expect**: every input and button has an accessible name/label (verify with the browser's accessibility inspector), and focus order is logical.

## Scenario 6 — incognito (FR-014, SC-007)

1. At `chrome://extensions`, **do not** enable the extension in incognito yet. Open an incognito window, load the echo page with a profile active. **Expect**: the **real** UA (extension inactive in incognito).
2. Enable "Allow in incognito" for the extension. Reopen an incognito window, load the echo page. **Expect**: the active profile's fake UA applies identically to a normal window (spanning state — same profiles/selection).

## Pass criteria

All six scenarios pass and `vitest run` is green. Note the known limitation: Web Workers still see the real UA under `full` depth (documented; needs the deferred `chrome.debugger` tier).
