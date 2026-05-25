# Little Learners Enhancement Roadmap

Date: 2026-05-25  
Goal alignment: playful, low-friction, offline-friendly early learning with strong replay value and parent trust.

## 1) High-Impact Enhancements to Existing Experience

1. Adaptive challenge engine per child. [DONE]
   - Track confidence per skill (`letters`, `counting`, `phonics`) and auto-adjust distractor complexity, round length, and hint speed.
   - Keep toddler mode gentle, but make kindergarten/reader progressively richer.
   - Implemented: `PP.Adaptive` in `shared/progress.js` tracks an EMA confidence per `catId` and reports a level with `choiceBoost`, `roundBoost`, and `hintDelayMs`. `game-core.js` honours these in `ctx.choiceCount()`, `runRounds()`, and the askChoice replay timer. Toddler mode is excluded from boosts so the baseline pacing is preserved.

2. Better progression model. [DONE]
   - Replace hardcoded totals with data-driven targets.
   - Add "Mastery stars" separate from "Discovered stickers" so repeated play still feels meaningful.
   - Implemented (totals): `parent.js` `TOTAL` and `hub.js` `stickerTargetFor()` derive sizes from live `PP.<Data>` arrays via `_len` helpers with safe fallbacks; sticker rings on the hub and the parent stats grid now stay accurate as data grows.

3. Guided learning paths. [DONE]
   - Add "Today's 5-minute mission" from hub (for example: 1 letter + 1 number + 1 color + 1 story scene).
   - End each mission with a celebratory recap card.
   - Implemented: new `#missionCard` section above the category grid renders 4 deterministic tasks per day (seeded by date+name), checks completion against the captured sticker baseline, and swaps to a confetti recap when all four are done.

4. Richer feedback loops.
   - Add combo streaks, milestone animations, and calm fallback feedback when mistakes happen.
   - Let children earn themed badge packs (space, jungle, ocean, farm).

5. Accessibility upgrades.
   - Caption every spoken line in a "speech bubble" toggle.
   - Left-hand mode for toolbar placement.
   - Dyslexia-friendly font toggle and high-contrast mode.

6. Parent trust upgrades. [DONE]
   - Add skill heatmap ("strong", "emerging", "needs repetition").
   - Weekly summary export (PDF/JSON snapshot) with "what to practice next."
   - Implemented (heatmap): each row in `#parentStats` now shows a colour-coded chip blending sticker % with `PP.Adaptive` confidence so a parent can scan mastery at a glance. Weekly summary export still pending.

## 2) New Interactive Modules / Games (Creative Expansion)

1. **Letter Tracing Studio**
   - Learning target: letter formation and muscle memory.
   - Interaction: finger tracing with animated path guides, pressure-free retries.
   - Reward: "Golden Pencil" stickers for smooth tracing.

2. **Phonics Sound Safari**
   - Learning target: beginning/middle/ending sounds.
   - Interaction: listen to sound, then choose matching picture in a scene.
   - Twist: ambient world themes (forest, city, beach).

3. **Rhyme Rocket**
   - Learning target: rhyme awareness.
   - Interaction: launch a rocket by pairing rhyming words (cat/hat, sun/fun).
   - Replay value: randomized word packs by age mode.

4. **Build-a-Word Blocks**
   - Learning target: blending CVC words.
   - Interaction: drag letter blocks into slots, hear blended pronunciation.
   - Booster: optional "sound out" helper mode.

5. **Number Train**
   - Learning target: sequencing, before/after, skip counting.
   - Interaction: drag number carriages into correct order.
   - Modes: forward, backward, odd/even.

6. **Pattern Parade**
   - Learning target: AB/ABB/AAB pattern recognition.
   - Interaction: complete visual patterns using shapes, colors, or animals.
   - Progression: pattern length scales with age mode.

7. **Shape Builder Lab**
   - Learning target: spatial reasoning and composition.
   - Interaction: combine primitives (triangle + square) to make objects (house, boat).
   - Reward: gallery wall of completed creations.

8. **Color Mixer Lab**
   - Learning target: primary/secondary color relationships.
   - Interaction: "paint splash" blending with immediate visual and spoken feedback.
   - Bonus: simple challenge cards ("make purple").

9. **Memory Meadow** [DONE]
   - Learning target: working memory and matching.
   - Interaction: flip cards matching letter-sound, number-quantity, or animal-sound pairs.
   - Supports solo or "pass-and-play" with sibling.
   - Implemented: new `pages/memory.html` + `js/game-memory.js`, registered in `js/data/categories.js` and `js/sticker-book.js`. Three modes ride the standard Discover/Practice/Quiz tabs (4/6/8 cards across animal, shape, and food themes). Adaptive boost can grow a board by one extra pair; clearing all three themes unlocks a Full Bloom bonus sticker. Service worker bumped to `v1.3.0` to precache the new files.

10. **Emotion Explorer**
    - Learning target: social-emotional vocabulary.
    - Interaction: identify feelings from facial cues and short situations.
    - Child-safe framing with empathy prompts.

11. **Story Creator Studio**
    - Learning target: sequencing and expressive language.
    - Interaction: choose character + setting + challenge + ending to generate mini-story.
    - Can include child name and saved family photos.

12. **Music & Rhythm Count**
    - Learning target: counting and tempo.
    - Interaction: tap beats in time, count rhythm patterns, clap-along prompts.
    - Good for movement breaks.

13. **Everyday Routines Quest**
    - Learning target: practical vocabulary and sequencing.
    - Interaction: arrange morning/night routine cards in order.
    - Parent option: customize routine cards.

14. **Mini Science Corner**
    - Learning target: observation language (sink/float, grow/shrink, hot/cold).
    - Interaction: safe drag-and-drop experiments with clear cause/effect narration.

## 3) Experience Enhancements for Interactiveness

1. Multi-sensory response profiles.
   - Theme packs: "Calm", "Energetic", "Minimal motion" that tune sound, confetti, and animation intensity.

2. Character system beyond mascot mood.
   - Add helper characters (Bee, Turtle, Star) that specialize by domain.
   - Child can pick a "learning buddy."

3. In-world map navigation.
   - Replace flat category grid with a map (Forest = Animals, Rainbow Hill = Colors, Rocket Port = Numbers).
   - Increases narrative glue and curiosity.

4. Offline-first content bundles.
   - Preload optional packs per theme so experiences stay rich without network.

5. Cooperative family mode.
   - Parent/sibling can join with turn-based prompts.
   - Great for modeling language and reducing solo screen isolation.

## 4) Technical/Product Enhancements to Support Scale

1. Central content schema.
   - Move all category totals, labels, and sticker metadata into one declarative config.
   - Removes hardcoded drift between hub, parent view, and sticker book.

2. Lightweight analytics (local-first).
   - Store session stats locally by default; optional export for parents.
   - Track attempt counts, hint usage, and mastered items.

3. Quest authoring system.
   - Scene builder JSON for Story Mode so non-engineers can add stories.

4. Reliability test checklist.
   - Add smoke tests for offline, storage import/export, and age mode transitions.

5. Performance budget for low-end tablets.
   - Guardrails for animation count, particle count, and image size.

## 5) Suggested Implementation Phases

1. Phase A (quick wins, 1-2 sprints)
   - Data-driven totals
   - Adaptive difficulty basics
   - Daily mission card
   - Parent heatmap summary

2. Phase B (core content expansion, 2-4 sprints)
   - Letter Tracing Studio
   - Number Train
   - Pattern Parade
   - Color Mixer Lab

3. Phase C (signature creativity layer)
   - Story Creator Studio
   - In-world map navigation
   - Helper-character system
   - Cooperative family mode
