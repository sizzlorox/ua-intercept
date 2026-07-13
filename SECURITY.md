# Security Policy

## Supported versions

UA Intercept is pre-1.0. Security fixes land on the latest `main` and the most recent release.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use **GitHub private advisories** — [Security → Report a vulnerability](https://github.com/sizzlorox/ua-intercept/security/advisories/new). This opens a private channel with the maintainers; if you need to arrange encrypted communication, mention it there.

Please include: affected version/commit, a description, reproduction steps or a proof-of-concept, and the impact you observed. We aim to acknowledge within **72 hours** and to provide a remediation timeline after triage. We'll credit reporters who wish to be named once a fix ships.

## Scope

In scope: the extension's own code — DNR rule construction, the MAIN-world injection and its `Server-Timing` config channel, storage handling, import parsing (untrusted JSON), and permission surface.

Out of scope by design (documented, not bugs): a **full spoof is detectable and not stealthy** — the config channel is page-readable and the `navigator.*` overrides are JS accessors. Fingerprinting a full-spoof profile is a known limitation of the non-`chrome.debugger` approach, not a vulnerability. See [Known limitations](./README.md#known-limitations).

## Handling untrusted input

The extension parses user-supplied JSON on import and user-typed User-Agent strings. If you find a way to make import corrupt stored data, escape the intended sandbox, inject into a page, or make the extension send a header the user didn't configure, that's in scope — please report it privately.
