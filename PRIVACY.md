# Privacy Policy — UA Intercept

**Effective date:** 2026-07-13

UA Intercept is a browser extension that overrides your User-Agent. This policy explains exactly what it does and does not do with your data. In short: **it collects nothing and sends none of your data anywhere.**

## Data we collect

**None.** UA Intercept does not collect, log, sell, share, or transmit any personal or usage data. There are no analytics, no telemetry, no advertising, no trackers, no accounts, and no third-party SDKs.

## Data stored on your device

Your **profiles** (names, User-Agent strings, spoof-depth settings, URL filters, colors) and your **settings** (which profile is active, whether the update check is enabled) are stored **locally** on your device using the browser's extension storage (`storage.local`). This data:

- never leaves your device,
- is not synced to us or any server,
- can be removed at any time by deleting profiles or uninstalling the extension.

Export/import is entirely manual: an export writes a JSON file that **you** save, and an import reads a file **you** choose. Nothing is uploaded.

## Network requests

UA Intercept makes **one** kind of network request, and only if you turn it on:

- **Update check (off by default).** If you enable "Check GitHub for updates," the extension asks GitHub's public Releases API (`https://api.github.com/repos/sizzlorox/ua-intercept/releases/latest`) at most once a day for the latest published version number. The extension **sends none of your data** in this request — no profiles, no identifiers, no browsing information. Like any HTTPS request, it necessarily reveals your IP address and your browser's standard request headers to GitHub; that exchange is governed by [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement). Turn the setting off (its default) and no request is ever made.

UA Intercept does **not** send your chosen User-Agent, your profiles, or the sites you visit anywhere. Overriding the User-Agent changes the header your browser sends to the websites **you** visit — the extension is not a party to those requests and receives nothing back.

## Permissions

- **Host access (`<all_urls>`)** and **`declarativeNetRequestWithHostAccess`** — required to rewrite the `User-Agent` (and matching Client-Hint) request headers on the sites you browse. Used only to modify those headers; the extension does not read page content or your browsing history.
- **`scripting`** — injects the in-page `navigator` override for "full" spoof profiles.
- **`storage`** — stores your profiles and settings locally (see above).

## Children

UA Intercept is a developer tool and is not directed at children. It collects no data from anyone.

## Changes

If this policy changes, the updated version will be committed to this repository with a new effective date.

## Contact

Questions or concerns: open an issue at <https://github.com/sizzlorox/ua-intercept/issues>. For security matters, see [SECURITY.md](./SECURITY.md).
