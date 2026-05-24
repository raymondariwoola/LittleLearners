# 🦉 Little Learners — Final AI Agent Build Prompt

## Project Overview

Build a **fully self-contained, multi-page web application** (HTML + CSS + JS, no servers, no build steps) called **Little Learners** — a beautifully gamified, deeply interactive learning suite for very young children (ages 2–5) covering the building blocks of early learning: **Letters, Numbers, Colors, Animals, Shapes, Body Parts, Family, Food, Counting, and Phonics**. The app must feel magical, warm, and genuinely educational. It should work perfectly offline after one download.

It is the second app in the **Professor Hoot Learning Suite** (the first being *Clock Quest*). The mascot, visual identity, voice system, and progress storage must be **architected for reuse** across future suite apps.

> 🎯 **Non-negotiable design promise:** A two-year-old should be able to use this app **without an adult**, without ever hitting a dead end, error message, or "wrong" feedback that feels punishing.

---

## Target Audience

- **Primary user:** Arianna, ~2 years old — pre-reader, just starting to recognise letters, numbers, and the world around her. Loves bright colors, animals, repetition.
- **Secondary user:** Toby, 7 years old — will dip in and out, especially on harder difficulties.
- **Context:** Parent-supervised tablet (primary), phone, or desktop play at home. Often used during quiet time, bedtime wind-down, or short bursts.

**Critical design assumption:** the primary user **cannot read**. Every instruction, prompt, button, and feedback must be delivered through **voice + icon + colour + animation simultaneously**. Text exists for the parent and older siblings — never as the only signal.

---

## The Suite Vision (Important Context)

This app is **app #2** in what will become **Hoot Academy** — a growing universe of educational apps for children aged 2–10, all hosted by the same character. Build accordingly:

- **Shared mascot:** Professor Hoot the owl — same SVG construction, same emotional states, same graduation cap across all apps.
- **Shared design tokens:** Reuse the warm palette so the apps feel like family.
- **Shared voice character:** Same Professor Hoot voice persona — warm, encouraging, never condescending.
- **Shared progress namespace:** All localStorage keys live under `pp_learners_*` (Professor Hoot Learners). A shared profile (name, age, avatar) is read by every suite app, so the child only ever introduces themselves once.
- **Future-proof:** All shared code lives in `shared/` under a `PP` namespace (`PP.Mascot`, `PP.Voice`, `PP.Progress`). A future *Suite Launcher* page can list installed apps and show overall progress.

---

## The Mascot — Professor Hoot (Suite-wide Character)

Use the **same owl mascot** as Clock Quest — same SVG construction, same emotional states (`happy`, `sad`, `excited`), same graduation cap. Extract him into a standalone file `shared/mascot.js` that exports a consistent API:

```js
Mascot.build()             // returns SVG element
Mascot.setMood(el, mood)   // 'happy' | 'sad' | 'excited' | 'thinking' | 'celebrating' | 'singing' | 'waving' | 'curious' | 'sleepy'
Mascot.speak(el, on)       // toggles speaking animation (lip-sync illusion)
Mascot.wave(el)            // one-shot wave
```

**New mood states to add for this app:**

- `mascot--thinking` — eyes look up, slight head tilt
- `mascot--celebrating` — wings flap, sparkles burst around him
- `mascot--singing` — beak opens and closes, music notes float out
- `mascot--waving` — one wing raised, used for greetings
- `mascot--curious` — head tilts slightly, one eye larger
- `mascot--sleepy` — eyes half closed (for idle states)

Hoot appears:
- **On the hub screen** — front and centre, idly bobbing, saying *"Hi! What do you want to learn today?"*
- **In every category screen** — in a corner, reacting in real time to the child's actions.
- **Speaking** — when Hoot is talking, the mascot pulses with the `.speaking` class.
- **Idle** — after 10 seconds of no interaction, Hoot gently wiggles or gives an encouraging nudge.

The mascot must feel like the **same character across all suite apps** — same proportions, colours, personality, voice. When Arianna eventually plays Clock Quest in a few years, she should recognise her friend.

---

## Core Design Principles

### Aesthetic Direction — "Storybook Daytime"

Where Clock Quest used a magical midnight palette, Little Learners is **bright, warm daytime** — like a sunlit nursery wall. Think *Sandra Boynton meets Pixar's Up* meets *Sago Mini*:

- **Palette:** soft sky blues, sunshine yellows, grass greens, peachy pinks, lavender, cream — high saturation but soft (no neon). Layer over the Clock Quest midnight base with:
  - 🌅 Sunrise coral `#ff8c66`
  - 🍋 Lemon yellow `#ffd966`
  - 🌿 Soft mint `#7fdca8`
  - 💜 Lavender `#c9a3ff`
  - 🌸 Bubblegum pink `#ff9bc7`
  - 🤍 Warm cream `#fff5dc` for surfaces
- **Fonts:** `Fredoka` (700) for headings and letter tiles, `Baloo 2` (500/700) for body — extra-large sizes. Letter tiles in Alphabet mode: jumbo Fredoka 700.
- **Shapes:** rounded everything, no sharp corners ever. Buttons are pill or blob shaped. Cards 24–32px radius.
- **Texture:** subtle paper grain or watercolour wash behind elements (CSS noise or SVG filter).
- **Motion:** every element breathes, bobs, wiggles, or pulses gently. Nothing static. Use `cubic-bezier(0.34, 1.56, 0.64, 1)` — that satisfying overshoot — liberally.
- **Backgrounds:** each category gets its own themed background (Animals → grassy field with floating leaves; Numbers → floating bubbles; Colors → paint-splash motif; Alphabet → constellation letters; etc.).
- **Everything bounces.** Tap a card → it pops. Drag a thing → it springs back. Idle → things bob gently.
- **Particle effects everywhere:** confetti on correct answers, sparkles on tap, hearts on favourites, stars on streaks.

### Visual Quality Bar

This must match or exceed Khan Academy Kids / Endless Alphabet / Sago Mini / Toca Boca polish:

- Massive tap targets (minimum **96×96px**, prefer 120px+; bump to 120px minimum in Toddler mode)
- Drop shadows, soft glows, layered depth
- SVG illustrations for every concept (drawn in code where simple; use inline OpenMoji/Twemoji SVGs for complex animals, food, etc.)
- Smooth keyframe animations everywhere
- Celebratory particle effects (confetti, sparkles, stars, hearts) on correct answers
- Responsive: 360px phone portrait → tablet → desktop, all first-class
- Subtle parallax / floating animation in backgrounds to make scenes feel alive

---

## Suite Architecture (CRITICAL)

```
little-learners/
├── index.html              # Main hub — category picker
├── styles/
│   ├── shared.css          # Suite-wide variables, mascot, buttons, modals
│   └── learners.css        # App-specific styles
├── shared/                 # Reusable across ALL suite apps
│   ├── mascot.js           # Professor Hoot SVG + moods (ported from Clock Quest)
│   ├── voice.js            # TTS wrapper (ported from Clock Quest, enhanced)
│   ├── audio.js            # Web Audio sound effects (ported + extended)
│   ├── confetti.js         # Particle bursts (ported from Clock Quest)
│   ├── progress.js         # localStorage wrapper, suite-aware namespacing
│   ├── ui.js               # Modal, button, toast helpers
│   └── theme.js            # CSS variable theme switcher
├── js/
│   ├── hub.js              # Category picker logic
│   ├── game-letters.js
│   ├── game-numbers.js
│   ├── game-colors.js
│   ├── game-animals.js
│   ├── game-shapes.js
│   ├── game-bodyparts.js
│   ├── game-family.js
│   ├── game-food.js
│   ├── game-counting.js
│   └── game-phonics.js
├── pages/
│   ├── letters.html
│   ├── numbers.html
│   ├── colors.html
│   ├── animals.html
│   ├── shapes.html
│   ├── bodyparts.html
│   ├── family.html
│   ├── food.html
│   ├── counting.html
│   └── phonics.html
└── assets/
    ├── sounds/animals/     # Parent supplies (cow.mp3, dog.mp3, etc.)
    ├── sounds/sfx/         # Optional extra SFX
    └── images/             # Any assets if needed (SVG preferred inline)
```

**Suite progress namespacing — shared `progress.js` API:**
```js
Progress.app('learners').get('stars.letters')  // → number
Progress.app('learners').set('stars.letters', 5)
Progress.app('learners').profile()             // → { name, age, avatar }
```

Profile and settings persist under `pp_profile_*` (not app-scoped), so future apps share the same child identity automatically.

---

## Age-Based Difficulty Levels

The parent picks the child's **Age Mode** on first launch via a one-time illustrated prompt — three big illustrated buttons. Override per-category at any time. Setting is persistent.

| Age Mode | Icon | Behaviour |
|---|---|---|
| 👶 **Toddler** (2–3) | Big Bear | 2 answer choices, super slow voice, all visuals labelled with icons, Hoot narrates everything, **no penalties ever** |
| 🧒 **Preschool** (3–4) | Yellow Star | 3 answer choices, normal pace, simple rounds, gentle encouragement |
| 🎒 **Kindergarten** (4–5) | Green Apple | 4 answer choices, faster pace, mini-challenges, stars/score |
| 🚀 **Early Reader** (5+) | Rocket | 4–6 choices, spelling/phonics blends, timed bonus rounds (optional) |

---

## The "No-Fail" Philosophy (Critical for Toddler & Preschool Modes)

For ages 2–4, the app must **never** make the child feel they got something wrong:

- **1st wrong tap** → cheerful *"Oops, try again!"* + the correct answer glows invitingly.
- **2nd wrong tap** on the same prompt → the correct answer **gently wiggles and sparkles** as a visual hint.
- **3rd wrong tap** → Hoot just announces the answer himself and moves on: *"This one is C! Let's try another."* It counts as correct.
- **No timers.** No countdowns. No "you lose" screens. No deducted points.
- Every play session ends with a **certificate of fun** showing what they explored (e.g. *"You played with 8 letters today!"*).
- **Toddler mode rule:** there is no such thing as "wrong". Every tap is met with positive feedback — wrong taps gently redirect (*"That's the cat! Can you find the dog?"*). Stars are always awarded; minimum 1.

In **Kindergarten / Early Reader** modes, gentle wrong-answer feedback is permitted (soft "bwonk" sound, try again), but never harsh or demoralising.

---

## Categories (Each is a Self-Contained Mini-Game)

Each category is its own page/file, sharing all suite components. All categories share the **same lesson rhythm**:

1. **Discover** mode — free-play exploration: tap things, hear them, no goals or prompts.
2. **Practice** mode — gentle multiple choice or matching with soft feedback.
3. **Quiz** mode — 5–10 round assessment earning stickers.

The child picks the mode from a sub-menu inside the category. Rounds are **5–8 questions max for under-4s** — toddler attention spans are measured in seconds.

---

### 🔤 Letters (A–Z)

- **Discover:** Tap any letter on a big alphabet grid → letter zooms forward, Hoot speaks the letter name (*"A!"*) then the phonetic sound (*"ah!"*) then an example word shown as an illustration (*"Apple! 🍎"*). Tap again to hear again. **Pure discovery, no wrong answers.**
- **Practice:** *"Find the letter B!"* — 2–4 letter tiles, child taps one. Correct = celebration; wrong = gentle no-fail flow above.
- **Quiz:** Mixed — find-the-letter, what-letter-makes-the-sound, match-uppercase-to-lowercase. Letter tracing (optional): big dotted letter, child drags finger along SVG path.
- **ABC Song mode:** Tap to start; letters light up in sequence as the ABC song plays.

Every letter **must**: be spoken in letter name AND phonetic sound; have an associated example word and illustration; award a sticker on first mastery.

---

### 🔢 Numbers (0–20)

- **Discover:** Number grid. Tap → Hoot says number + that many cute objects animate in with a *"boing!"* for each. Hoot counts along: *"One... two... three!"*
- **Dot-tap counting:** Dots appear; child taps each one — Hoot counts along, last number stressed: *"THREE!"*
- **Practice:** *"Find the number 7!"* — 2–4 numerals.
- **Quiz:** *"How many apples?"* → tap the correct number. Simple addition (5+): visual 2 + 1 = ?, single-digit sums ≤ 10.

Range: 1–10 for Toddler/Preschool; 1–20 for Kindergarten+; addition for Early Reader.

---

### 🎨 Colors

- **Discover:** Color wheel of 12 blobs. Tap one → blob splashes outward, soft full-screen tint flashes, color is spoken. *"Red! Like an apple. And a fire truck. And a heart. ❤️"*
- **Practice:** *"Tap all the red things!"* — scene with multiple objects, child taps correct ones. Each correct tap = sparkle + *"Yes!"*
- **Color Match:** Two halves of an object, different colours; drag matching halves together.
- **Color Mixing** (5+): Two paint blobs combine when dragged together → reveals new colour. Yellow + Blue = Green! Pure delight.
- **Rainbow Builder** (4+): Drag colour arcs into order to build a rainbow → it animates and sparkles with a C-major chord.

---

### 🐾 Animals (with sounds — parent supplies)

**Animal roster (15 starter pack):** cow, dog, cat, duck, lion, elephant, horse, sheep, pig, frog, owl, bee, rooster, monkey, wolf.

Define the roster in **one config file** (`js/data/animals.js`) — adding a new animal = one entry. Each entry: name, emoji/SVG ref, sound filename, verbal sound (*"The cow says moooo"*), and an example sentence.

- **Discover (Zoo):** Tap animal → plays real sound from `assets/sounds/animals/<name>.mp3` + Hoot says the name and a fun fact. Every animal SVG has an idle wiggle and a tap-reaction.
- **Who Said That?** (3+): Hoot plays a sound, child picks the animal from 2–4 choices.
- **Where Do I Live?** (4+): Animals scattered around screen; child drags each to its habitat (farm, ocean, forest, jungle).
- **Baby Animals** (4+): Match the baby to its parent (calf → cow, foal → horse, etc.).
- **Animal Parade** (free play): Tap animals to add them to a parade across the screen, each making its sound.

**Graceful missing-audio handling:** if a sound file 404s, still show the animal and have Hoot say the name + verbal sound. Never crash.

---

### 🔷 Shapes

Shapes: circle, square, triangle, rectangle, oval, star, heart, diamond, hexagon, crescent.

- **Discover:** Tap → shape spins, grows, and Hoot says the name and a fact (*"Triangle! It has three sides. Like a pizza slice! 🍕"*).
- **Practice:** *"Find the heart!"* — pick from 2–4.
- **Shape Sorter** (3+): Drag shapes into matching holes — the classic toy mechanic.
- **Build a Picture** (4+): Drag shapes onto a canvas to build a house, a face, a sun. Free play.

---

### 👋 Body Parts

A big friendly cartoon child (SVG, multiple skin-tone options parent can select). Tap any body part → Hoot names it + the part wiggles.

- *"Where is your nose?"* → child taps the nose on the figure.
- Include: head, eyes, ears, nose, mouth, neck, shoulders, arms, hands, fingers, tummy, legs, feet, toes.

---

### 👨‍👩‍👧 Family

Mom, Dad, Sister, Brother, Baby, Grandma, Grandpa, Uncle, Aunt — cartoon characters. Hoot names each on tap.

**Photo upload (gold-tier personalisation):** parent can attach the actual family member's name and photo (stored as base64 in IndexedDB for blobs). The child then taps *their* actual grandma's face and hears her name. This is the most-loved feature in this category.

---

### 🍎 Food

Fruits, vegetables, and common foods. Tap → Hoot names it + *"Yummy!"* + reacts with joy.

- *"Find the apple!"* practice rounds.
- *"Is this healthy?"* mini-game (Kindergarten+): Hoot asks if a food is a fruit, veggie, or treat.

---

### 🔟 Counting

- Bubbles float up; child taps each one — Hoot counts along.
- *"How many?"* puzzles with visual groups of objects.
- Counting songs via TTS (one-two-three-four-FIVE, once I caught a fish alive).

---

### 📖 Phonics

- Letter sounds + blending: *"C-A-T... CAT!"*
- Drag letters into slots to build simple 3-letter words.
- Show picture → child taps letters in order to spell it.
- Early Reader mode: consonant blends (sh, ch, th).

---

## Story Mode ⭐ (High-Delight, Build After Core Categories)

A linked narrative adventure where Professor Hoot needs the child's help across categories — the most-loved mode. Short (5–8 min), perfect for one sitting.

> *"Oh no! All the letters fell out of my book! Can you help me put them back?"*

→ Child taps letters in sequence → next scene:

> *"Now I need to feed the animals. Can you find the cow?"*

→ Find-the-animal mini-game → next scene:

> *"Let's paint a rainbow to brighten up my playground!"*

→ Color mixing mini-game → final scene:

> *"You did it! You're amazing!"*

→ Ends with a **"You Did It!" certificate** and a special bonus sticker.

**Story Mode rules:**
- Always in Toddler/Preschool no-fail mode regardless of age setting.
- New story unlocks after completing each category's Discover mode at least once.
- Story scenes can be replayed; Hoot delivers slightly different commentary on repeats.

---

## Voice System (Critical for Pre-readers)

Reuse and extend `Voice` from Clock Quest. This is **P0** — a silent toddler app is broken.

- **Auto-pick best voice on device** (scoring: Premium > Enhanced > Neural > Standard). Show a Premium voice tip in Settings if only Basic is available.
- **Prosody chunking** (split on sentence boundaries, pitch jitter, rising intonation on questions).
- **Speaker rate:** 0.85× for Toddler mode, 1.0× otherwise.
- **Always speak the instruction.** Every question must be voiced. **Auto-replay after 8 seconds** if no answer is given.
- **Name personalisation:** *"Great job, Arianna!"*
- **Hold-to-hear** on every answer button (long-press to hear what it is before tapping).
- **Mascot lip-sync:** `.speaking` class pulses the mascot while voice is active.
- **Toddler-tier praise:** softer, slower, more melodic — *"Goooood job!"*

**New voice methods to add:**
```js
Voice.spell(word)  // "C... A... T... CAT!" with dramatic pauses
Voice.count(n)     // "one, two, three, FOUR!" — last stressed
Voice.cheer()      // randomised exclamation ("Wow!", "Amazing!", "Yes!")
```

---

## Sound Design

**Reuse from Clock Quest:** correct chime, wrong bwonk, sparkle, fanfare, hover tick.

**New SFX to add (Web Audio API):**
- Soft **xylophone "pling"** on any tap (Discover mode)
- **"Boing" pop** — object appears during counting
- **Sparkle** — colour-mixing reveals
- **Rainbow chord** — C major triad with reverb sustain for rainbow builds
- **"Swish"** — screen transitions
- **"Ding"** — counter increments
- Magical **unlock sound** — sticker earned

**Real audio (parent-supplied MP3s):** load lazily on first use of Animals category. Volume normalised to ~0.8. Each sound preceded by 100ms silence. Graceful TTS fallback if file missing.

---

## Screens / Views

### 1. Hub (index.html)

- Big title "Little Learners" with bobbing Professor Hoot centre-stage.
- Greeting: *"Hi {name}! What do you want to learn today?"*
- **10 category cards** — large, colourful, illustrated tiles with icon + label + small sticker-progress ring. Cards pulse gently; on tap, Hoot speaks the category name.
- Bottom strip: age-mode badge, ⚙️ settings cog, 🏆 Sticker Book, parent button (gated by simple math puzzle — *"Tap the 7"* between 3 numbers — so toddlers can't open it).
- *"Continue last activity"* button if applicable.
- **Day/Night theme:** auto-switches to a softer, warmer palette after 6pm — perfect for bedtime wind-down.

### 2. Category Page (e.g. pages/animals.html)

- Top bar: big back arrow, category icon + name, mode picker (Discover / Practice / Quiz).
- Main activity area.
- Hoot in corner, reacting in real time.
- Voice + Sound mute toggles top-right.

### 3. Results / Mini-Celebration

- After every Practice or Quiz round: stars fly in, Hoot cheers, confetti bursts, *"Play again"* / *"Pick another"* / *"Home"*.
- Toddler mode: **always 3 stars**, no failure state ever.

### 4. Sticker Book (🏆)

Opens like a real book with a soft page-flip sound. Each earned sticker is pasted to a page; empty slots show ghosted outlines of what could go there — encouraging exploration.

- One sticker per letter mastered, number, colour, animal, shape, food item, etc.
- **Secret bonus stickers** for: playing 3 days in a row, completing a whole category, building a rainbow, animal parade with 5+ animals, finishing Story Mode.
- Tap any sticker to hear what it is.

### 5. Settings (suite-wide modal, `shared/ui.js`)

- Child's name + age mode selector.
- Voice picker + speed slider.
- Voice quality badge (Premium/Enhanced/etc.) with install tip if Basic.
- Sound effects toggle + volume.
- Background music toggle (gentle ambient loop, off by default).
- Parent dashboard link (math-gated).
- Reset progress (with confirm).

### 6. Parent Dashboard (math-gated)

- Stars per category.
- Time spent per category.
- Suggestions (*"Arianna loves Colors! Try Shapes next."*).
- Export/import progress (JSON download/upload).
- Link to Clock Quest if installed (for older siblings).
- Total play time this week.

---

## Interactive Magic (Use Liberally)

These are the moments that make a toddler shriek with joy:

- **Letter pop-in:** when a letter is named, the corresponding object image bursts in with a bounce.
- **Animal jiggle:** every animal SVG has an idle wiggle and a tap-reaction.
- **Color wash:** when a colour is named, a soft full-screen tint flashes briefly.
- **Counter bubbles:** numbers count up with bouncing bubbles.
- **Hoot eye-tracking:** Hoot's eyes follow the cursor/finger on Discover screens (subtle parallax).
- **Drag-and-drop:** for matching/phonics — items snap with satisfying haptic-style animation.
- **Auto-pause:** after 20 minutes a gentle *"Time for a break!"* overlay appears (parent dismisses).
- **Shake-to-reset:** device shake clears current answer — fun Easter egg, behind a toggle.

---

## Accessibility & Toddler Safety

- All interactions work with **a single finger tap** — no double-tap, no drag required for core gameplay (drag is bonus only).
- **No reading required** anywhere in the primary flow.
- High contrast everywhere — text on warm cream, never grey-on-grey.
- Colour is **never the only signal** — always paired with shape, sound, or icon.
- **Huge touch targets** — minimum 96px, 120px in Toddler mode.
- **Parent gate** for settings, reset, dashboard (simple "Tap the X" puzzle).
- No external links, no ads, no in-app purchases.
- **No flashing > 3Hz** — protect against photosensitive seizures.
- Respect `prefers-reduced-motion` for parents who want calmer animations.
- All buttons have `aria-label` for screen readers.

---

## Technical Requirements

- **Multi-file vanilla HTML/CSS/JS** — no build step, no framework.
- External libraries allowed where they materially improve quality:

| Library | Use | Why |
|---|---|---|
| Howler.js | Animal sound playback | Handles iOS Safari audio unlock + cross-format fallback |
| GSAP (free tier) | Complex animation timelines | Smoother than CSS for sequenced moves |
| Lottie (optional) | Hand-crafted celebration animations | Free files from LottieFiles |

- Google Fonts via `<link>` is fine. All SVGs inline or in JS strings.
- `localStorage` for all progress. `IndexedDB` for photo blobs (Family category only).
- Must work **offline** after first load — service worker recommended for asset caching.
- Fully responsive: 360px phone portrait → 1440px desktop. Tablet portrait is the **primary test device**.
- Pages link via standard `<a href>`. All shared components imported via `<script src="shared/...">`.
- **Performance:** must run smoothly on a 5-year-old budget Android tablet. Lazy-load category assets; never preload all animal sounds on the hub.

---

## Animal Sound File Convention

Lowercase, singular, hyphen-separated. MP3, < 200KB each, < 3 seconds long.

```
assets/sounds/animals/cow.mp3
assets/sounds/animals/dog.mp3
assets/sounds/animals/cat.mp3
assets/sounds/animals/duck.mp3
assets/sounds/animals/lion.mp3
assets/sounds/animals/elephant.mp3
assets/sounds/animals/horse.mp3
assets/sounds/animals/sheep.mp3
assets/sounds/animals/pig.mp3
assets/sounds/animals/frog.mp3
assets/sounds/animals/owl.mp3
assets/sounds/animals/bee.mp3
assets/sounds/animals/rooster.mp3
assets/sounds/animals/monkey.mp3
assets/sounds/animals/wolf.mp3
```

Define the roster in one config file (`js/data/animals.js`). **Adding a new animal = editing exactly one file.**

---

## What Makes This State of the Art (Required Differentiators)

1. **The mascot is a real character.** Hoot remembers the child's name, comments on their preferences (*"You really love the dog, don't you?"*), and reacts to long absences (*"I missed you!"*).
2. **Every sound is intentional.** No stock buzzers. Web Audio chimes tuned to consonant intervals. Animal sounds are real recordings.
3. **The TTS sounds human.** Premium voice detection from Clock Quest — auto-detect, prompt to install if missing.
4. **The animations feel like physics.** Every interaction has weight, springiness, and follow-through. Static UI is forbidden.
5. **Discovery > evaluation.** The default mode in every category is exploration, not quiz. The child can play forever without ever being "tested."
6. **The Sticker Book is real.** Stickers persist, the book fills up, it's genuinely satisfying to flip through. This is the meta-reward.
7. **Story Mode ties it all together.** A short narrative thread that makes the app feel like a place with a story, not a menu of exercises.
8. **Adaptive difficulty.** If a child gets the same prompt wrong twice in Toddler/Preschool mode, subsequent prompts narrow to easier ones. If they crush 5 in a row, gently introduce harder ones.
9. **It works offline.** No "please connect to the internet" — ever.
10. **It feels like a place, not an app.** The hub is a playroom you visit, not a menu you navigate.

---

## Deliverable

A folder `little-learners/` containing all files. Opening `little-learners/index.html` in any modern browser must:

- Show the hub immediately with all 10 categories playable.
- Greet the child by name (or prompt for it on first launch with a delightful illustrated input).
- Allow tapping any category and playing the Discover / Practice / Quiz modes.
- Persist progress and profile via localStorage.
- Speak everything aloud.
- Toddler mode is the default until parent selects otherwise.

---

## Quality Bar

Before considering this done, verify:

### Functional
- [ ] All 10 categories playable in all 3 modes (Discover / Practice / Quiz)
- [ ] Story Mode runs end-to-end and awards a bonus sticker
- [ ] Sticker Book persists and fills correctly; bonus stickers unlock correctly
- [ ] Voice speaks every prompt; auto-replays after 8 seconds if no answer
- [ ] Animal sounds play when files supplied; falls back to TTS when missing
- [ ] No-fail philosophy enforced in Toddler/Preschool modes (verify by tapping wrong 5 times)
- [ ] Parent gate prevents toddlers opening settings (math puzzle works)
- [ ] Profile (name, age) persists across pages and sessions
- [ ] Day/Night theme switches correctly after 6pm
- [ ] Auto-pause fires after 20 minutes

### Polish
- [ ] Every interactive element bounces / pops on tap
- [ ] Mascot reacts in every category screen with correct mood state
- [ ] Mascot pulses (`.speaking` class) when voice is active
- [ ] Confetti / celebration fires on every correct answer
- [ ] No flat / static screens anywhere
- [ ] Backgrounds have subtle motion (floating, parallax, twinkling)
- [ ] All transitions between screens are smooth, never jarring
- [ ] Sticker Book opens like a real book with page-flip sound

### Robustness
- [ ] No console errors on load or during 10 minutes of play
- [ ] Works on iPad Safari, Android Chrome, desktop Chrome, desktop Firefox
- [ ] All tap targets meet 96px minimum (120px in Toddler mode)
- [ ] Layout works at 360×640 portrait, 768×1024 tablet portrait, 1280×800 desktop
- [ ] `prefers-reduced-motion` users get a calmer experience
- [ ] App works fully offline after first load (test with DevTools offline mode)
- [ ] Adding a new animal requires editing exactly one config file

### Suite Continuity
- [ ] Professor Hoot mascot is visually identical to Clock Quest's
- [ ] Voice and audio modules are reused, not reimplemented
- [ ] All localStorage keys are `pp_*` prefixed; profile is `pp_profile_*`
- [ ] Shared code uses `PP.*` namespace throughout
- [ ] Visual design feels like a sibling app to Clock Quest

---

## Final Notes for the Implementing Agent

- **Do not skimp on the SVGs.** Each animal, fruit, body part, etc. needs a recognisable illustration. Use OpenMoji or Twemoji SVGs (CC-BY) if you can't draw them in code — embed inline.
- **Toddler attention spans are seconds.** Rounds are 5–8 questions max for under-4s. Quick celebration after every single correct answer.
- **Voice is the soul of this app.** Treat the Voice integration as P0.
- **Test on a tablet in portrait orientation first.** That's the primary device. Then landscape, then desktop.
- **Make it feel like the same Professor Hoot.** When Arianna eventually plays Clock Quest in a few years, she should recognise her friend.

---

*This app is being built for Arianna, age ~2 — and for the toddler-aged sibling of every family that downloads it. Make it the first app she opens every morning. Make every single tap feel like a tiny gift.*
