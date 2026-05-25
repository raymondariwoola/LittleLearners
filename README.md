# Little Learners — Hoot Academy

A progressive web app for toddlers and early learners (ages 2–6). Hoot the owl guides children through interactive lessons in letters, numbers, colours, animals, shapes, and more — fully offline-capable, with age-adaptive content and a three-tier voice system that always sounds like Hoot.

---

## Features

- **12 learning categories** — Letters, Numbers, Colors, Animals, Shapes, Body Parts, Family, Food, Counting, Phonics, Story Mode, Memory Meadow
- **Four age modes** — Toddler (2–3), Preschool (3–4), Kindergarten (4–5), Early Reader (5+); each tier shows age-appropriate item counts, round lengths, and game modes
- **Three game modes per category** — Discover (free exploration), Practice (guided rounds), Quiz (challenge; unlocked at Kindergarten+)
- **Offline-first PWA** — service worker pre-caches the full app shell; works with no network after first load
- **3-tier voice system** — pre-baked `.webm` phrase clips → in-browser Piper neural TTS → Web Speech API fallback
- **Day / night themes**, confetti, sticker book, daily mission, and auto-pause after 20 minutes

---

## Running locally

No build step required. Serve the repo root over HTTP (a `file://` origin blocks the service worker and audio playback).

```bash
# VS Code Live Server — open index.html and click "Go Live"
# or any static server, e.g.:
npx serve .
python3 -m http.server 5500
```

Open `http://localhost:5500` (or whichever port you chose).

**First run** — the onboarding screen asks for a name and age mode, then stores the profile in `localStorage`. Clear `localStorage` (DevTools → Application → Local Storage → Clear All) to reset.

**Service worker updates** — after changing any cached asset, bump `CACHE_VERSION` in [sw.js](sw.js), then hard-reload the browser (`Cmd+Shift+R`) or unregister the old SW in DevTools → Application → Service Workers.

---

## Project structure

```
├── index.html              Hub (landing page)
├── favicon.svg
├── sw.js                   Service worker (cache-first, stale-while-revalidate)
│
├── pages/                  One HTML file per category + utility pages
│   ├── letters.html
│   ├── numbers.html
│   ├── animals.html
│   ├── ... (12 game pages)
│   ├── settings.html
│   ├── stickers.html
│   ├── parent.html
│   └── story.html
│
├── js/
│   ├── data/
│   │   ├── age-config.js   ← single source of truth for age-based scaling
│   │   ├── categories.js   ← hub grid + age mode definitions
│   │   ├── letters.js
│   │   ├── numbers.js
│   │   ├── animals.js
│   │   └── ... (one file per data set)
│   ├── game-core.js        Shared game engine (tabs, choices, results, ctx object)
│   ├── game-letters.js
│   ├── game-animals.js
│   ├── ... (one file per category)
│   ├── hub.js              Landing page logic
│   ├── parent.js
│   ├── settings.js
│   └── sticker-book.js
│
├── shared/
│   ├── namespace.js        Creates the global `PP` namespace
│   ├── voice.js            PP.Voice — unified speak/spell/cancel API
│   ├── voice-pack.js       Tier 1 — pre-baked .webm phrase clips
│   ├── voice-neural.js     Tier 2 — Piper neural TTS (vits-web, ~20 MB, offline)
│   ├── audio.js            PP.Audio — SFX (pling, ding, fanfare, wrong…)
│   ├── mascot.js           PP.Mascot — Hoot SVG, moods, eye tracking
│   ├── progress.js         PP.Progress — localStorage wrapper
│   ├── theme.js            PP.Theme — day/night toggle
│   ├── ui.js               PP.UI — modal, toast, parent gate
│   ├── confetti.js
│   └── auto-pause.js       20-minute idle overlay
│
├── styles/
│   ├── shared.css          Design tokens, buttons, modals, typography
│   ├── learners.css        Hub + game layouts
│   ├── categories.css      Category-specific overrides
│   └── book.css            Sticker book
│
└── tools/
    ├── bake-voice.mjs      Node script — generate the Hoot voice pack
    └── voice-phrases.json  Phrase catalog for the voice baker
```

---

## Age-adaptive content system

All content scaling lives in **[js/data/age-config.js](js/data/age-config.js)**. To adjust difficulty for any tier, edit one number — no other files change.

```js
PP.AgeConfig = {
  subsets: {
    // How many items to show from the front of each data array.
    // Data files are ordered simplest-first so slice(0, n) is always correct.
    letters: { toddler: 10, preschool: 16, kindergarten: 26, reader: 26 },
    animals: { toddler:  8, preschool: 12, kindergarten: 15, reader: 15 },
    // ...
  },
  hidden: {
    // Categories hidden from the hub grid at each age tier.
    toddler:   ['phonics', 'story'],
    preschool: ['phonics'],
    // ...
  },
  modes: {
    // Game tabs available per tier (Quiz unlocks at Kindergarten).
    toddler:      ['discover', 'practice'],
    kindergarten: ['discover', 'practice', 'quiz'],
    // ...
  },
  roundCounts: {
    // Shorter sessions for younger children.
    toddler:      { practice: 4, quiz: 5  },
    kindergarten: { practice: 6, quiz: 8  },
    // ...
  },
};
```

Games access this through the shared `ctx` object (provided by `game-core.js`):

```js
ctx.ageItems(LETTERS, 'letters')   // age-filtered slice of a data array
ctx.ageRounds('practice')          // correct round count for current age mode
ctx.choiceCount()                  // 2 / 3 / 4 choices depending on age
```

### Adding a new category

1. Add a data file `js/data/<id>.js` (ordered simplest-first).
2. Add an entry to `PP.Categories` in `js/data/categories.js`.
3. Add subset/hidden/modes entries to `js/data/age-config.js`.
4. Create `pages/<id>.html` (copy an existing page as a template).
5. Write `js/game-<id>.js` using `ctx.ageItems()` and `ctx.ageRounds()`.
6. Add both new files to the `PRECACHE` list in `sw.js` and bump `CACHE_VERSION`.

---

## Voice system

| Tier | Module | Source | Offline? |
|---|---|---|---|
| 1 — Pre-baked clips | `voice-pack.js` | `.webm/opus` files generated by `bake-voice.mjs` | Yes (service worker) |
| 2 — Neural TTS | `voice-neural.js` | Piper via `@diffusionstudio/vits-web` (~20 MB WASM model) | Yes after first download (stored in OPFS) |
| 3 — Web Speech | `voice.js` | Browser `SpeechSynthesis` | Device-dependent |

`PP.Voice.speak(text)` tries Tier 1 first. On a cache miss it falls through to Tier 2, then Tier 3. All three tiers share a single cancel-on-navigation contract — navigating away from any page stops audio immediately.

### Baking a new voice pack (macOS)

```bash
# Requires: say (built-in), ffmpeg (brew install ffmpeg)
node tools/bake-voice.mjs                        # bake new/missing phrases only
node tools/bake-voice.mjs --force                # re-bake everything
node tools/bake-voice.mjs --voice "Ava (Premium)"
```

---

## Settings & parental controls

- **Settings panel** — voice tier selection, Piper voice catalog, SFX toggle, theme toggle, accessible from the toolbar.
- **Parent zone** — locked behind a simple arithmetic gate; contains progress reset, data export, and age mode management.
- **Age mode** — can be changed at any time from the hub toolbar age badge (also gated). The hub grid, sticker ring targets, and game content update immediately without a page refresh.

---

## Browser support

Modern evergreen browsers (Chrome 90+, Safari 16+, Firefox 115+). The Piper neural tier requires `SharedArrayBuffer`, which needs a cross-origin isolated context — not available on `file://` origins or servers that don't send the required `COOP`/`COEP` headers. On such environments the app falls back gracefully to Tier 3 (Web Speech).
