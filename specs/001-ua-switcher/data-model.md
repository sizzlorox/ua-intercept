# Phase 1 Data Model

All entities are plain JSON stored in `chrome.storage.local`. No database.

## Profile

A named UA override.

| Field | Type | Rules |
|---|---|---|
| `id` | string | required, unique; generated (`crypto.randomUUID()`) |
| `name` | string | required, non-empty, trimmed |
| `userAgent` | string | required, non-empty (the fake UA string) |
| `spoofDepth` | `"headers"` \| `"full"` | required; default `"full"` |
| `presetId` | string \| null | id of the preset it was seeded from, or null for custom |
| `platform` | string | for `full`: `navigator.platform` value (e.g. `"Win32"`, `"iPhone"`); derived from preset, editable |
| `mobile` | boolean | for `full`/hints: `sec-ch-ua-mobile` (`?1`/`?0`) |
| `uaData` | object \| null | for `full` (chromium only): `{ brands:[{brand,version}], fullVersionList:[{brand,version}], platformVersion }` — seeds both `sec-ch-ua*` and the `navigator.userAgentData` rebuild. Seeded from preset; null for non-chromium (no Client Hints) |
| `includeUrls` | string[] | optional URL match patterns; empty = all URLs |
| `excludeUrls` | string[] | optional URL match patterns; empty = none excluded |
| `color` | string | optional hex, UI label chip |
| `order` | number | sort position in the list |

**Derived (not stored, computed by `core/client-hints.js` for `full`)** — `deriveClientHints(profile)` returns two coherent shapes from the same `uaData`:
- **header shape**: `secChUa`, `secChUaMobile`, `secChUaPlatform` (the `set` values) + the high-entropy headers to `remove`. Non-Chromium → all `sec-ch-ua*` marked for **removal** instead.
- **injectConfig shape** (the MAIN-world payload): `{ userAgent, platform, mobile, brands, fullVersionList, platformVersion }`, driving the `navigator.userAgentData` rebuild. Note the header `sec-ch-ua-full-version-list` is `remove`d on the wire while `fullVersionList` still populates `getHighEntropyValues()` in-page — the wire header and the JS surface are independent by design. For a `full` custom UA with no preset `uaData`, `brands`/`fullVersionList`/`platformVersion` are best-effort parsed from the UA string (may be empty).

**Validation**: `userAgent` and `name` non-empty; `spoofDepth` in enum; `includeUrls`/`excludeUrls` each a valid match pattern or simple glob. Invalid profile is rejected on save/import.

## Preset (built-in, read-only)

A template the user bases a profile on. Shipped in `core/presets.js`.

| Field | Type |
|---|---|
| `id` | string |
| `label` | string (e.g. "iPhone 15 — Safari") |
| `userAgent` | string |
| `platform` | string |
| `mobile` | boolean |
| `engine` | `"chromium"` \| `"webkit"` \| `"gecko"` (drives client-hint derivation) |
| `uaData` | object \| null (chromium presets carry `{brands, fullVersionList, platformVersion}`; null for webkit/gecko) |

Seed set (v1): Windows Chrome, macOS Chrome, macOS Safari, iPhone Safari, Android Chrome, iPad Safari, Linux Firefox, Googlebot. Plus a synthetic "Custom…" choice in the UI (not a Preset record).

## AppState

Global switch + selection. Single object, key `state`.

| Field | Type | Rules |
|---|---|---|
| `enabled` | boolean | master on/off |
| `activeProfileId` | string \| null | the one active profile; null = none |

**Invariant**: at most one active profile (FR-003). `activeProfileId` must reference an existing profile or be null; deleting the active profile sets it null.

## ExportBundle

Shape of the import/export JSON file.

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-07-13T00:00:00.000Z",
  "profiles": [ /* Profile[], without transient/derived fields */ ]
}
```

**Import rules (FR-011)**:
- Reject if `formatVersion` is missing or `> 1` (unknown/incompatible) — change nothing, surface a clear error.
- Validate every profile; if any is invalid, reject the whole file atomically.
- New `id`s may be reassigned on import to avoid collisions with existing profiles (import = add/restore, not overwrite by id).

## Storage keys (chrome.storage.local)

| Key | Value |
|---|---|
| `profiles` | `Profile[]` |
| `state` | `AppState` |

## State transitions

```
disabled ──enable(profileId)──▶ active(profileId)
active(A) ──switch(B)──▶ active(B)        (rebuild DNR + re-register/​unregister MAIN-world script)
active(A) ──disable()──▶ disabled          (remove DNR rules + unregister script)
active(A) ──deleteProfile(A)──▶ disabled   (activeProfileId → null)
```

On every transition the background service worker: (1) recomputes DNR dynamic rules from the active profile (or clears them), (2) if `spoofDepth === "full"`, registers the MAIN-world override script + the Server-Timing DNR rule; else unregisters both.
