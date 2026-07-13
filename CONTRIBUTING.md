# Contributing to UA Intercept

Thanks for your interest! This is a small, single-purpose Chrome MV3 extension, and contributions — bug reports, translations, presets, docs, and code — are all welcome.

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Quick start

```bash
git clone https://github.com/sizzlorox/ua-intercept.git
cd ua-intercept
npm install
npm test          # vitest
```

Load it in Chromium: `chrome://extensions` → **Developer mode** → **Load unpacked** → the repo root (or `dist/chrome/` after `npm run build`). Load in Firefox: `npm run start:firefox`, or `about:debugging` → **Load Temporary Add-on** → `dist/firefox/manifest.json`.

There is no transpiler or bundler — plain ES modules. `npm run build` (`scripts/build.mjs`) just copies the source and writes the per-browser `manifest.json` into `dist/chrome/` and `dist/firefox/`. `src/core/` is identical across engines; keep engine differences in the manifest transform + feature guards, not scattered in the code.

## Project layout & the one rule that matters

```text
src/core/         PURE logic — no chrome.* — unit-tested
src/background/    service worker (DNR rules, injection, badge)
src/injected/      MAIN-world navigator override
src/ui/            popup + options
src/shared/        storage + i18n helpers
tests/unit/        vitest specs (mirror src/core/)
_locales/<code>/    i18n catalogs
```

**Put logic in `src/core/` and unit-test it.** Anything that can go subtly wrong — client-hint derivation, DNR rule construction, URL matching, import parsing, badge labels — belongs in a pure module that never imports `chrome`. The `background/`, `ui/`, and `injected/` layers should stay thin shells that wire the core to Chrome APIs. This keeps the tricky parts testable in Node without a browser.

Errors surfaced to users are returned from core as stable **codes** (e.g. `errNameRequired`), and the UI maps them to localized text via `_locales`. Don't hardcode user-facing English in `src/core/`.

## Making a change

1. Fork and branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Add or update the relevant `tests/unit/*.test.js` — new core logic needs a test.
3. Run `npm test` — everything must be green.
4. Match the surrounding style (2-space indent, single quotes, ES modules, no semicolons in JS files that omit them). No linter is enforced; keep diffs minimal and idiomatic.
5. Open a PR using the template. Describe what and why; link any issue.

Browser-only behavior (DNR application, the `document_start` race, incognito) can't be unit-tested — validate it by hand by loading the extension in a real browser and note what you checked in the PR.

## Adding a language

1. Copy `_locales/en/messages.json` to `_locales/<code>/messages.json` (use a [Chrome locale code](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales), e.g. `pt_PT`).
2. Translate every `message` value. **Keep the keys, the `placeholders` blocks, and the `$count$` / `$name$` / `$index$` / `$reason$` tokens exactly.** Don't translate the brand "UA Intercept" or code tokens (`User-Agent`, `navigator.*`, etc.).
3. `npm test` — `i18n-locales.test.js` verifies your file has the same keys and preserved placeholders as English.

## Adding a preset

Edit `src/core/presets.js`. A preset is `{ id, label, userAgent, platform, mobile, engine, uaData }`. For Chromium browsers, fill `uaData` (`brands`, `fullVersionList`, `platformVersion`, `chPlatform`, `architecture`, `bitness`, `model`) so full spoof stays consistent; for Safari/Firefox set `uaData: null`. Add a case to `tests/unit` if you add derivation logic.

## Reporting bugs & requesting features

Use the [issue templates](https://github.com/sizzlorox/ua-intercept/issues/new/choose). For **security** vulnerabilities, do not open a public issue — see [SECURITY.md](./SECURITY.md).

## Scope

UA Intercept is intentionally narrow: **User-Agent + matching Client Hints only.** General header editing, response/cookie/CSP editing, redirects, and cloud sync are out of scope by design. Proposals that broaden the single purpose are unlikely to be merged — but a focused, well-tested improvement to the UA experience is very welcome.
