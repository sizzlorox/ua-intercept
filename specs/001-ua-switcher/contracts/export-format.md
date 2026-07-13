# Contract: Import/Export JSON format

The single user-facing data contract (files users create/consume).

## Export file

MIME `application/json`, downloaded as `ua-intercept-profiles-<date>.json`.

```json
{
  "formatVersion": 1,
  "exportedAt": "2026-07-13T12:00:00.000Z",
  "profiles": [
    {
      "id": "b1f2...uuid",
      "name": "iPhone Safari",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "spoofDepth": "full",
      "presetId": "iphone-safari",
      "platform": "iPhone",
      "mobile": true,
      "uaData": null,
      "includeUrls": [],
      "excludeUrls": [],
      "color": "#2ea9af",
      "order": 0
    }
  ]
}
```

The exported profile object carries **every stored Profile field, including `uaData`** (`null` for non-chromium like this Safari profile; `{brands, fullVersionList, platformVersion}` for chromium presets/custom). `uaData` drives the `full`-depth `navigator.userAgentData` rebuild, so it MUST round-trip. On import, if a profile has no `uaData` but its `presetId` matches a known preset, re-derive `uaData` from that preset; otherwise leave it null (best-effort). This keeps export→wipe→import consistent for full-spoof profiles (SC-004/SC-005).

## Import validation contract

| Check | On failure |
|---|---|
| Top-level is an object with `formatVersion` (number) | reject: "Unrecognized file" |
| `formatVersion <= 1` | reject: "File is from a newer version" |
| `profiles` is an array | reject: "No profiles found" |
| each profile: `name`, `userAgent` non-empty strings; `spoofDepth ∈ {headers,full}` | reject: "Profile N is invalid: <reason>" |
| any profile invalid | **atomic** — import nothing |

On success: append validated profiles, **preserving each profile's `id`**; reassign a fresh `id` **only** when it would collide with an existing profile's `id`. Existing profiles untouched. Return count imported. (Preserving id keeps export→wipe→import a field-for-field round-trip per SC-004; reassignment only guards the merge-into-non-empty case.)

`core/porting.js` exposes: `exportBundle(profiles) -> object` and `parseBundle(jsonText) -> { ok, profiles?, error? }`.
