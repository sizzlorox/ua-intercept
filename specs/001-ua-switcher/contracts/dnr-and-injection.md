# Contract: DNR rules, MAIN-world injection, internal messaging

Internal (extension-to-Chrome and background-to-UI) contracts. Not user-facing.

## 1. DNR dynamic rule builder — `core/dnr-rules.js`

`buildRules(profile) -> chrome.declarativeNetRequest.Rule[]`

Rule A (always, when a profile is active) — set UA + client hints:

```js
{
  id: 1,
  priority: 1,
  action: {
    type: "modifyHeaders",
    requestHeaders: [
      { header: "user-agent", operation: "set", value: profile.userAgent },
      // full depth + chromium engine: set; non-chromium: remove; headers depth: omit CH lines
      { header: "sec-ch-ua",          operation: "set", value: hints.secChUa },
      { header: "sec-ch-ua-mobile",   operation: "set", value: hints.secChUaMobile },   // "?1"/"?0"
      { header: "sec-ch-ua-platform", operation: "set", value: hints.secChUaPlatform }, // '"Windows"'
      { header: "sec-ch-ua-full-version-list", operation: "remove" }
    ]
  },
  condition: {
    // MUST list main_frame explicitly — omitting resourceTypes drops the top-level document
    resourceTypes: ["main_frame","sub_frame","script","stylesheet","image","font",
      "xmlhttprequest","media","websocket","ping","other"],
    ...urlFilterFrom(profile)   // requestDomains / regexFilter from include/exclude
  }
}
```

Rule B (only when `spoofDepth === "full"`) — Server-Timing config channel for the race:

```js
{
  id: 2, priority: 1,
  action: { type: "modifyHeaders", responseHeaders: [
    { header: "server-timing", operation: "append",
      value: `uaint;desc="${encodeURIComponent(JSON.stringify(injectConfig))}"` }
  ]},
  condition: { resourceTypes: ["main_frame","sub_frame"], ...urlFilterFrom(profile) }
}
```

**Guarantees**: `headers` depth emits only Rule A (UA line, no navigator touch). Non-chromium engine → CH lines become `remove`, not `set`. Disabled/no active profile → `buildRules` returns `[]` and the background clears all dynamic rules.

## 2. MAIN-world injection — `src/injected/override.js`

- Registered via `chrome.scripting.registerContentScripts([{ id:"ua-override", world:"MAIN", runAt:"document_start", allFrames:true, matchOriginAsFallback:true, persistAcrossSessions:true, matches:["<all_urls>"], js:["src/injected/override.js"] }])` only while a `full` profile is active; unregistered otherwise.
- Reads config **synchronously** from `performance.getEntriesByType("navigation")[0].serverTiming` → entry named `uaint` → `decodeURIComponent(entry.description)` → JSON. If absent, no-op (fail open to real UA).
- Redefines on the page: `navigator.userAgent` (getter), `navigator.platform` (getter), `navigator.userAgentData` (getter returning a reconstructed object with `brands`, `mobile`, `platform`, `toJSON()`, and `getHighEntropyValues(hints) -> Promise`).

**Config channel payload** (`injectConfig`): `{ userAgent, platform, mobile, brands, fullVersionList, platformVersion }`.

## 3. Background ⇄ UI messaging — `chrome.runtime` / storage events

UI never touches DNR/scripting directly. It mutates storage; the background reacts.

| Trigger (from UI) | Background action |
|---|---|
| write `profiles` | if active profile changed, rebuild DNR + re-register injection |
| write `state` (`enabled`/`activeProfileId`) | apply/clear DNR + injection per new state |

Optional direct messages for immediate feedback: `{type:"getStatus"} -> {enabled, activeProfileId, applied}`.

**Invariant**: DNR rules and the registered content script are a pure function of `(state, profiles)`. On service-worker startup the background **reconciles** actual DNR/registered-scripts against storage (self-healing after SW suspension).
