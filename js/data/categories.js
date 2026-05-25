/* Single source of truth for the hub category grid.
 * Adding a new category = add one entry here + create pages/<id>.html.
 */
window.PP = window.PP || {};
window.PP.Categories = [
  { id: 'letters',   label: 'Letters',     icon: '🔤', page: 'pages/letters.html',   tagline: 'A is for apple' },
  { id: 'numbers',   label: 'Numbers',     icon: '🔢', page: 'pages/numbers.html',   tagline: 'One, two, three!' },
  { id: 'colors',    label: 'Colors',      icon: '🎨', page: 'pages/colors.html',    tagline: 'Bright and bold' },
  { id: 'animals',   label: 'Animals',     icon: '🐾', page: 'pages/animals.html',   tagline: 'Listen and learn' },
  { id: 'shapes',    label: 'Shapes',      icon: '🔷', page: 'pages/shapes.html',    tagline: 'Round and square' },
  { id: 'bodyparts', label: 'Body Parts',  icon: '👋', page: 'pages/bodyparts.html', tagline: 'Where is your nose?' },
  { id: 'family',    label: 'Family',      icon: '👨‍👩‍👧', page: 'pages/family.html', tagline: 'People you love' },
  { id: 'food',      label: 'Food',        icon: '🍎', page: 'pages/food.html',      tagline: 'Yummy!' },
  { id: 'counting',  label: 'Counting',    icon: '🔟', page: 'pages/counting.html',  tagline: 'How many?' },
  { id: 'phonics',   label: 'Phonics',     icon: '📖', page: 'pages/phonics.html',   tagline: 'C-A-T... cat!' },
  { id: 'story',     label: 'Story Mode',  icon: '⭐', page: 'pages/story.html',     tagline: 'Hoot needs your help' },
  { id: 'memory',    label: 'Memory Meadow', icon: '🧠', page: 'pages/memory.html',  tagline: 'Match the pairs' },
];

window.PP.AgeModes = [
  { id: 'toddler',     label: 'Toddler',      caption: 'Ages 2–3',  icon: '🧸' },
  { id: 'preschool',   label: 'Preschool',    caption: 'Ages 3–4',  icon: '⭐' },
  { id: 'kindergarten',label: 'Kindergarten', caption: 'Ages 4–5',  icon: '🍏' },
  { id: 'reader',      label: 'Early Reader', caption: 'Ages 5+',   icon: '🚀' },
];
