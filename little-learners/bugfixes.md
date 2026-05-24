# Bug Fixes Log

## 2026-05-25

### 1. Letters (Discover) — letters invisible on tiles
**Symptom:** On the Discover screen for Letters, the uppercase letters and lowercase sub-labels blended into the cream tile background, making them unreadable (especially in the default night theme).

**Cause:** `.ll-tile--letter` used a cream gradient (`#fff7e0 → #ffe2b5`) but its text inherited `color: var(--pp-ink)`. In the night theme `--pp-ink` resolves to `#fff5dc` (cream), so cream text sat on a cream background. The `.ll-tile__sub` (lowercase letter) similarly inherited `--pp-ink-soft`, which is light lavender in night theme.

**Fix:** In [styles/categories.css](little-learners/styles/categories.css), forced dark ink on letter tiles regardless of theme:
- `.ll-tile--letter { color: #2a1437; }`
- `.ll-tile--letter .ll-tile__sub { color: #5a4170; }`

---

### 2. Numbers (Discover) — numerals invisible on tiles
**Symptom:** Same issue as #1 — the digits on the Numbers Discover grid blended into the mint/blue tile background.

**Cause:** Identical root cause. `.ll-tile--num` defines a light mint/blue gradient but inherited the theme-driven text colour, which is cream in night mode.

**Fix:** Same edit in [styles/categories.css](little-learners/styles/categories.css):
- `.ll-tile--num { color: #2a1437; }`
- `.ll-tile--num .ll-tile__sub { color: #5a4170; }`

---

### 3a. Colors — palette not exhaustive enough
**Symptom:** Only 12 colours were offered; common toddler colours like light blue, navy, lime, magenta, peach, beige, gold, silver, maroon, indigo and dark green were missing.

**Fix:** Expanded [js/data/colors.js](little-learners/js/data/colors.js) from 12 to 23 colours, each with a real-world example and emoji. Updated [styles/categories.css](little-learners/styles/categories.css) `.ll-color-wheel` to a 6-column grid on desktop (4 on mobile) so the larger palette fits cleanly.

---

### 3b. Colors — tap feedback too brief and too subtle
**Symptom:** Tapping a colour produced only a faint, momentary shadow across the screen (45% opacity, `mix-blend-mode: multiply`, ~420 ms). A toddler couldn't perceive the colour, defeating the learning goal.

**Cause:** `flashTint()` in [js/game-colors.js](little-learners/js/game-colors.js) created a low-opacity multiply overlay that decayed almost immediately.

**Fix:**
- Rewrote `flashTint()` to fully fill the screen with the colour (opacity 1, no blend mode) and overlay the colour's **name** + **emoji** big and centred.
- The overlay stays visible for at least 1.4 s and is dismissed once the spoken description finishes, so the child both *sees* and *hears* the colour together.
- Added contrast-aware text colour: a luminance check switches the label to dark ink on light backgrounds (white, beige, yellow, silver, etc.) so the name remains readable.
- Updated `.ll-tint-flash` styles in [styles/categories.css](little-learners/styles/categories.css) to support the new label/emoji layout and pop-in animation.

---

### 4. Updates only appear after a hard refresh (service worker caching)
**Symptom:** After deploying changes, a normal refresh (or first visit in a tab) still showed the old UI. Only Cmd+Shift+R (hard refresh) revealed the new code.

**Cause:** The service worker in [sw.js](little-learners/sw.js) used a **cache-first** strategy for every same-origin GET. Once a file was precached, the SW always returned the cached copy and never went to the network — so HTML/CSS/JS updates were invisible until a hard refresh bypassed the SW. Bumping `CACHE_VERSION` alone wouldn't help returning users either, because the *currently controlling* (old) SW kept serving the old assets until the page was reloaded, and the SW file itself could be HTTP-cached.

**Fix:**
1. Bumped `CACHE_VERSION` to `v1.1.0` so old caches get purged on activate.
2. Split the fetch strategy in [sw.js](little-learners/sw.js):
   - **Navigations (HTML):** network-first with cache fallback, so page loads always reflect the latest deploy when online.
   - **Other same-origin assets (CSS / JS / data):** stale-while-revalidate — instant from cache but updated in the background, so one normal refresh is enough to pick up code changes.
   - Google Fonts: unchanged network-first.
3. Added a `message` handler so the page can tell a waiting SW to `skipWaiting`.
4. Updated registration in [index.html](little-learners/index.html):
   - Registered with `{ updateViaCache: 'none' }` so the browser revalidates `sw.js` on every load.
   - Calls `registration.update()` on load and posts `SKIP_WAITING` to any installed-but-waiting worker.
   - Listens for `controllerchange` and reloads the page once when a new SW takes over, so users transparently land on the latest version.

**One-time cleanup for existing users:** the first load after this change still runs under the *old* SW. The new SW will install, activate (skipWaiting), claim clients, and the `controllerchange` listener will auto-reload the page once — after that, normal refreshes show updates immediately.

---

### 5. Food (Discover) — text blends with tile background + roster too small
**Symptom:** Food labels (Apple, Banana, …) were barely readable against the cream tile and only 12 items existed.

**Cause:** `.ll-tile--food` and `.ll-tile--animal` had no explicit text colour, so their `.ll-tile__sub` labels picked up `--pp-ink-soft` (light lavender in night theme) on a cream background.

**Fix:**
- In [styles/categories.css](little-learners/styles/categories.css): set `.ll-tile--animal, .ll-tile--food, .ll-tile--word { color: #2a1437; }` and pinned `.ll-tile__sub` inside those variants to `#3d2452` with `font-weight: 700` for stronger contrast.
- In [js/data/food.js](little-learners/js/data/food.js): expanded the food roster from 12 → 43 items across **fruit**, **veggie**, **grain**, **dairy**, **protein**, **meal**, **treat**, and **drink** groups (orange, watermelon, pineapple, peach, blueberries, lemon, cherries, tomato, potato, cucumber, avocado, pepper, mushroom, rice, noodles, pancakes, butter, yogurt, chicken, fish, meat, burger, sandwich, taco, soup, cookie, cake, donut, ice cream, candy, juice, water).

---

### 6. Phonics (Discover) — word text invisible
**Symptom:** Words on the Phonics Discover tiles (CAT, DOG, SUN, …) blended into the light lavender/pink background, especially in night theme.

**Cause:** `.ll-tile--word` had no explicit text colour, so the big word text inherited `--pp-ink` (cream in night theme).

**Fix:**
- Same CSS rule in [styles/categories.css](little-learners/styles/categories.css) (`.ll-tile--word { color: #2a1437; }` plus dark-purple `.ll-tile__sub`).
- Bonus: expanded the phonics word list in [js/data/phonics.js](little-learners/js/data/phonics.js) from 10 → 22 CVC words (DAD, BAT, COW, FOX, OWL, BEE, CAR, BAG, PEN, KEY, EGG, PIE) so Practice/Quiz rounds feel less repetitive.

---

### 7. Story mode — same script every play
**Symptom:** Story mode ran the exact same 5 scenes (lost hat → 3 acorns → yellow sun → owl → crescent moon) in the exact same order with the exact same narration on every play. No replay value.

**Cause:** [js/game-story.js](little-learners/js/game-story.js) defined `SCENES` as a hard-coded constant array with one fixed target per scene and one narration string each.

**Fix:** Rewrote scene assembly as **randomized generators** in [js/game-story.js](little-learners/js/game-story.js):
- Each scene *type* (`sceneLetter`, `sceneColor`, `sceneAnimal`, `sceneShape`, `sceneCount`) now picks a random target from its data file and a random narration variant from a pool of 4 lines.
- `sceneCount` randomises both the item (acorns, apples, stars, flowers, ladybugs, bees, cookies, balloons, strawberries, fish, butterflies, leaves) and the target count (2–5).
- `buildScenes()` includes one of every available type for breadth, adds 1–2 random extras for surprise, shuffles the order, and caps at 6 scenes.
- A fresh `buildScenes()` is called on Play-Again so the same session can be replayed with a brand-new story.
- Sticker ids are stamped with a per-play index so re-running the same scene type still earns a sticker rather than silently de-duping.

Result: tens of thousands of unique narrative permutations across the five scene types, with name-aware narration variants when the child profile has a name.

---

### Service worker bump
`CACHE_VERSION` bumped from `v1.1.0` → `v1.2.0` in [sw.js](little-learners/sw.js) so the new SW activates and clears the old cache on the next visit.
