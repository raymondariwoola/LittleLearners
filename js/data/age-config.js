/* PP.AgeConfig — single source of truth for age-based content scaling.
 *
 * To adjust difficulty for an age tier, edit one entry here.  No other files
 * need to change — games read ctx.ageItems(array, catId) which calls through
 * to PP.AgeConfig.filter().
 *
 * Design rules:
 *  - Data arrays are ordered easiest-first so a slice from index 0 always
 *    gives the most age-appropriate subset.
 *  - `subsets` maps catId → { ageMode: count | null }.  null = show all.
 *  - `hidden` lists categories to omit from the hub grid per age mode.
 *  - `modes`  lists which game tabs are available per age mode.
 *  - `roundCounts` caps the number of practice/quiz rounds per age mode.
 */
(function () {
  window.PP = window.PP || {};

  PP.AgeConfig = {

    // ── How many items to show from the start of each data array ──────────
    // null means show all. Items in data files are ordered simplest-first so
    // slicing from the front always picks the most age-appropriate subset.
    subsets: {
      letters:   { toddler: 10, preschool: 16, kindergarten: 26, reader: 26 },
      numbers:   { toddler: 5,  preschool: 10, kindergarten: 20, reader: 20 },
      colors:    { toddler: 6,  preschool: 8,  kindergarten: 12, reader: 12 },
      animals:   { toddler: 8,  preschool: 12, kindergarten: 15, reader: 15 },
      shapes:    { toddler: 4,  preschool: 6,  kindergarten: 10, reader: 10 },
      bodyparts: { toddler: 6,  preschool: 10, kindergarten: 14, reader: 14 },
      family:    { toddler: 4,  preschool: 7,  kindergarten: 9,  reader: 9  },
      food:      { toddler: 5,  preschool: 8,  kindergarten: 12, reader: 12 },
      counting:  { toddler: 5,  preschool: 10, kindergarten: 20, reader: 20 },
      phonics:   { toddler: 0,  preschool: 4,  kindergarten: 8,  reader: 10 },
      story:     { toddler: null, preschool: null, kindergarten: null, reader: null },
      memory:    { toddler: null, preschool: null, kindergarten: null, reader: null },
    },

    // ── Categories completely hidden from the hub grid ─────────────────────
    hidden: {
      toddler:      ['phonics', 'story'],
      preschool:    ['phonics'],
      kindergarten: [],
      reader:       [],
    },

    // ── Game mode tabs available per age ──────────────────────────────────
    // Toddler/Preschool get Discover + Practice. Quiz is introduced once the
    // child is ready for explicit challenge (Kindergarten+).
    modes: {
      toddler:      ['discover', 'practice'],
      preschool:    ['discover', 'practice'],
      kindergarten: ['discover', 'practice', 'quiz'],
      reader:       ['discover', 'practice', 'quiz'],
    },

    // ── Practice/Quiz round counts per age ────────────────────────────────
    // Shorter sessions for younger kids so they stay engaged.
    roundCounts: {
      toddler:      { practice: 4, quiz: 5  },
      preschool:    { practice: 5, quiz: 6  },
      kindergarten: { practice: 6, quiz: 8  },
      reader:       { practice: 6, quiz: 10 },
    },

    // ──────────────────────────────────────────────────────────────────────
    // Convenience helpers (all pure — read-only from the config above)
    // ──────────────────────────────────────────────────────────────────────

    /** Return the age-appropriate slice of `items` for category `catId`. */
    filter(items, catId, ageMode) {
      if (!Array.isArray(items)) return items;
      const cfg = this.subsets[catId];
      if (!cfg) return items;
      const n = cfg[ageMode];
      if (n === null || n === undefined) return items;
      if (n === 0) return [];
      return items.slice(0, n);
    },

    /** True when the category should appear in the hub grid. */
    isCategoryVisible(catId, ageMode) {
      const list = this.hidden[ageMode] || [];
      return !list.includes(catId);
    },

    /** Game tabs to render for the given age mode. */
    availableModes(ageMode) {
      return this.modes[ageMode] || ['discover', 'practice', 'quiz'];
    },

    /** Number of rounds for a given mode type and age. */
    rounds(ageMode, type) {
      return ((this.roundCounts[ageMode] || {})[type]) || (type === 'quiz' ? 8 : 5);
    },
  };
})();
