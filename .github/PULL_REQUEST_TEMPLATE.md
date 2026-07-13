<!-- Thanks for contributing! Keep the diff focused; one logical change per PR. -->

## What & why

<!-- What does this change and why? Link any related issue: Closes #123 -->

## Type

- [ ] Bug fix
- [ ] New feature / enhancement
- [ ] Translation (`_locales/…`)
- [ ] Preset (`src/core/presets.js`)
- [ ] Docs
- [ ] Refactor / chore

## Checklist

- [ ] `npm test` passes
- [ ] New/changed **core logic** (`src/core/`) has a unit test
- [ ] No `chrome.*` calls added to `src/core/` (kept in the shells)
- [ ] User-facing strings go through `_locales` (no hardcoded English in core)
- [ ] For a translation: keys, `placeholders`, and `$tokens$` preserved
- [ ] Verified relevant browser behavior by hand (say what you checked)

## Manual verification

<!-- For browser-only behavior (DNR, document_start race, incognito, badge),
     which quickstart scenario(s) did you run and what did you observe? -->
