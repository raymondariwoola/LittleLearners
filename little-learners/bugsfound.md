# Little Learners Codebase Audit: Potential Bugs

Date: 2026-05-25  
Scope reviewed: all files under `little-learners/` (HTML, CSS, JS, shared runtime, service worker, data files)

Notes:
- Items below are static-audit findings and should be validated in-browser.
- Severity reflects likely user impact on a child-facing learning app.

## High Severity

1. [DONE] Service worker can return an invalid response (`null`) on cache miss while offline.
   - Files: `sw.js:143-153`
   - Why this is risky: `staleWhileRevalidate()` catches network errors with `null`, then returns `cached || network || fetch(req)`. If no cache exists, `network` is still a truthy Promise that resolves to `null`, which is not a valid `Response`.
   - Child impact: first-time offline access to uncached assets can fail unpredictably.
   - Suggested fix: ensure `staleWhileRevalidate()` always resolves to a `Response` (or throws), never `null`.
   - Fix applied: rewrote `staleWhileRevalidate()` so cached requests return immediately with a swallowed background refresh, and uncached requests await the network promise (without the `.catch(() => null)`) so any failure propagates instead of yielding a `null` response.

2. [DONE] Story stickers do not align with sticker-book IDs, so Story progress can appear broken.
   - Files: `js/game-story.js:142-143`, `js/game-story.js:205`, `js/sticker-book.js:23`
   - Why this is risky: story stickers are saved as randomized IDs like `<scene>-i<index>`, while the sticker book expects fixed IDs `scene-1` ... `scene-5`.
   - Child impact: child can complete story scenes but still see locked Story stickers.
   - Suggested fix: store canonical sticker IDs for story completion (fixed roster), and keep randomized IDs only for analytics/history if needed.
   - Fix applied: `buildScenes()` now stamps each scene with the canonical `scene-N` id (1–based) while preserving the randomized id internally as `traceId` for debugging. Completed scenes therefore save the same ids the sticker book renders.

3. [DONE] Story totals can drift far beyond expected values.
   - Files: `js/game-story.js:205`, `js/hub.js:117-123`, `js/parent.js:11-14`
   - Why this is risky: Story can keep adding unique sticker IDs each run, but hub/parent totals assume `story: 5`.
   - Child/parent impact: progress text can become confusing (for example values exceeding total intent).
   - Suggested fix: decide one model: either fixed 5-story milestones or truly unbounded story collectibles; update all total calculations accordingly.
   - Fix applied: capped `buildScenes()` at `STORY_SLOTS = 5` and aligned ids to `scene-1..scene-5`, so completed story stickers can never exceed the 5 totals reported by the hub and parent dashboards.

## Medium Severity

4. [DONE] Age badge click listeners can stack over time.
   - Files: `js/hub.js:150-158`, `js/hub.js:175-178`
   - Why this is risky: `renderAgeBadge()` attaches a new click handler every time it is called (including after age changes) without removing previous listeners.
   - Child impact: duplicate parent-gate prompts or repeated modal behavior after multiple age changes.
   - Suggested fix: replace with `onclick = ...`, or remove existing listener before re-binding.
   - Fix applied: `renderAgeBadge()` now assigns the click handler via `el.onclick = ...`, which is a single-slot property, so repeated renders cannot stack handlers.

5. [DONE] Empty onboarding name can cause onboarding to reappear every visit.
   - Files: `js/hub.js:18-21`, `js/hub.js:60-64`
   - Why this is risky: onboarding completion allows blank name, but onboarding requirement checks `!p.name`.
   - Child impact: repeated onboarding loop if parent leaves name empty intentionally.
   - Suggested fix: either require non-empty name before save or treat onboarding as complete with a dedicated `onboarded` flag.
   - Fix applied: the Save handler now requires a non-empty trimmed name, focuses the input, sets `aria-invalid`, and shows a friendly toast instead of silently saving an empty profile. The handler is no longer single-use so retries are possible.

6. [DONE] Progress totals are stale in multiple places versus current data sizes.
   - Files: `js/hub.js:117-123`, `js/parent.js:11-14`, `js/data/colors.js`, `js/data/food.js`, `js/data/phonics.js`
   - Why this is risky: totals still use old values (`colors: 12`, `food: 12`, `phonics: 10`) while datasets are much larger.
   - Parent impact: inaccurate percentages and trust erosion in progress reporting.
   - Suggested fix: derive totals from data arrays dynamically instead of hardcoding.
   - Fix applied: `stickerTargetFor()` in `hub.js` and the `TOTAL` table in `parent.js` now read their counts from `PP.Letters`, `PP.Numbers`, `PP.Colors`, etc., falling back to the previous hard-coded values only if a data module hasn't loaded on that page.

7. [DONE] Animal sample audio paths are likely incorrect for page-relative loading.
   - Files: `js/data/animals.js:2-22`, `shared/audio.js:134-137`
   - Why this is risky: comments describe `/assets/...` absolute paths, but actual values are `assets/...` (relative). On `/pages/*.html`, this resolves to `/pages/assets/...`.
   - Child impact: custom MP3s may silently never play, always falling back to speech.
   - Suggested fix: normalize sample URLs to absolute (`/assets/...`) or resolve relative to app root.
   - Fix applied: `PP.Audio.playSample()` now resolves relative URLs against an `appRoot()` (stripping a trailing `pages/`), so `assets/animals/cow.mp3` loads from the app root regardless of which page is open. The animals data comment was updated to reflect the new contract.

8. [DONE] Auto-pause "Go home" path can bypass intended parent unlock on hub.
   - Files: `shared/auto-pause.js:83-87`, `shared/auto-pause.js:93`
   - Why this is risky: when already on home (not `/pages/`), "Go home" only closes modal and leaves `shown=true` without resetting timer.
   - Child impact: continued play after limit without parent-gated extension.
   - Suggested fix: on home, either keep modal active until parent action or immediately re-show unless reset is confirmed.
   - Fix applied: when already on the hub, the "Go home" action now requires the parent gate before closing the modal and resetting the timer (mirroring the "more time" action). From category pages it still navigates home as before.

9. [DONE] `force` option is passed to voice calls but not implemented in voice engine.
   - Files: `js/game-counting.js:67`, `js/game-phonics.js:117`, `js/game-story.js:329`, `shared/voice.js:120-140`
   - Why this is risky: callers appear to expect forced immediate speech behavior, but `speak()` does not read `force`.
   - Child impact: occasional overlapping/queued speech behavior may not match intended UX.
   - Suggested fix: either implement `force` semantics in `PP.Voice.speak()` or remove the option from call sites and use existing `interrupt` controls explicitly.
   - Fix applied: `PP.Voice.speak()` now treats `force: true` as an explicit "interrupt and speak now" alias, so the existing call sites in counting, phonics, and story modes get the intended behavior without changes.

## Low Severity / Compatibility Risks

10. [DONE] Family file picker may fail on stricter mobile Safari flows.
    - Files: `js/game-family.js:149-161`
    - Why this is risky: file input is created and clicked without being attached to DOM.
    - Suggested fix: temporarily append input to DOM before `.click()`, then remove.
    - Fix applied: `pickFile()` now appends the hidden input to `document.body` before calling `.click()` and removes it in the `change` handler, matching the pattern Safari expects.

11. [DONE] Object URLs are not revoked on photo delete (only on unload or replacement).
    - Files: `js/game-family.js:58-67`, `js/game-family.js:130-134`
    - Why this is risky: minor memory leak over long sessions with repeated add/remove cycles.
    - Suggested fix: revoke and delete the corresponding `_objectUrls` entry when photo is removed.
    - Fix applied: the delete handler now revokes the cached object URL and removes the `_objectUrls` map entry for that role before clearing the visual state.

12. [DONE] `color-mix()` is used without fallback declarations.
    - Files: `styles/book.css:208-209`, `styles/book.css:238`, `styles/book.css:329`, `styles/book.css:353`, `styles/book.css:355`, `styles/book.css:378`, `styles/book.css:395`, `styles/book.css:398`
    - Why this is risky: some older browsers/devices may ignore these styles.
    - Suggested fix: add fallback `border/background` values before `color-mix(...)` declarations.
    - Fix applied: each of the listed rules now declares a solid-color fallback immediately before the `color-mix()` declaration so browsers without `color-mix` support fall back to the solid color instead of dropping the property entirely.

## Follow-up Recommendation

Run a short verification sweep after fixes:
- Offline/cold-cache behavior (`sw.js`)
- Story completion and sticker-book correctness
- Parent dashboard percentage accuracy
- Age badge interaction after repeated mode changes
- Auto-pause gate behavior from both hub and category pages
