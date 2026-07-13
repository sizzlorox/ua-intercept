# Contract: UI layout (chosen)

Two surfaces. Both write only to `chrome.storage.local`; the background reacts (see dnr-and-injection.md §3).

## Popup — variant C (card + spoof badges)

```
┌──────────────────────────────┐
│ 🎭 UA Intercept       ● ON    │   master on/off
│  ┌── iPhone Safari ──────┐    │   active profile = colored card
│  │ full spoof · mobile   │    │
│  │ 🍎 iOS 17             │    │
│  └───────────────────────┘    │
│  ▸ switch profile (3)         │   expands to radio list of profiles
│  ✓ header  ✓ navigator.ua     │   live badges: what is actually spoofed
├──────────────────────────────┤
│  + New     ⚙ Manage           │   New → options w/ preset picker; Manage → options
└──────────────────────────────┘
```

**Badges rule** (the differentiator): `✓ header` always when active; `✓ navigator.ua` only when active profile is `full`. For `headers` depth show `✓ header  · navigator.ua (real)` so the user sees the tradeoff at a glance.

## Options page — master-detail

```
┌────────────────────────────────────────────────────────────┐
│  UA Intercept — Profiles          [Import] [Export] [+ New] │
├──────────────────┬─────────────────────────────────────────┤
│ ⠿ ● iPhone Safari │  EDIT: iPhone Safari                    │
│ ⠿ ○ Win Chrome    │  Name  [ iPhone Safari             ]    │
│ ⠿ ○ Googlebot     │  Preset[ iPhone 15 — Safari      ▾]    │
│  + New from preset│  UA    [ Mozilla/5.0 (iPhone; …   ]    │
│                   │  Depth ◉ Full   ○ Headers only          │
│                   │    Full rewrites navigator.* in-page.   │
│                   │    (Workers not covered.)               │
│                   │  Platform [iPhone]  Mobile [✓]          │
│                   │  Include URLs [ … ]  Exclude URLs [ … ] │
│                   │  [Duplicate] [Delete]        [Save]     │
└──────────────────┴─────────────────────────────────────────┘
```

- `⠿` drag handle → reorders (`order` field). `●/○` = active indicator.
- Selecting a preset seeds Name/UA/Platform/Mobile (all stay editable).
- Delete of the active profile clears `activeProfileId`.

Tasks T014 (popup) and T015/T023/T027/T028 (options) implement this layout.
