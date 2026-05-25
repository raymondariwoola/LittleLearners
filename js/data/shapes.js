/* Shapes — drawn as inline SVG so they can spin/scale beautifully. */
window.PP = window.PP || {};
window.PP.Shapes = [
  { id: 'circle',    label: 'Circle',    fact: 'It is perfectly round.', svg: `<circle cx="60" cy="60" r="48"/>` },
  { id: 'square',    label: 'Square',    fact: 'It has four equal sides.', svg: `<rect x="14" y="14" width="92" height="92" rx="6"/>` },
  { id: 'triangle',  label: 'Triangle',  fact: 'It has three sides, like a pizza slice!', svg: `<polygon points="60,10 110,108 10,108"/>` },
  { id: 'rectangle', label: 'Rectangle', fact: 'It has two long sides and two short sides.', svg: `<rect x="6" y="28" width="108" height="64" rx="6"/>` },
  { id: 'oval',      label: 'Oval',      fact: 'It is like a stretched circle.', svg: `<ellipse cx="60" cy="60" rx="54" ry="36"/>` },
  { id: 'star',      label: 'Star',      fact: 'It twinkles in the sky.', svg: `<polygon points="60,8 73,46 114,46 80,69 92,108 60,84 28,108 40,69 6,46 47,46"/>` },
  { id: 'heart',     label: 'Heart',     fact: 'It means love!', svg: `<path d="M60 104 C20 78, 6 50, 28 32 C42 22, 56 32, 60 44 C64 32, 78 22, 92 32 C114 50, 100 78, 60 104 Z"/>` },
  { id: 'diamond',   label: 'Diamond',   fact: 'A square turned on its corner.', svg: `<polygon points="60,8 112,60 60,112 8,60"/>` },
  { id: 'hexagon',   label: 'Hexagon',   fact: 'It has six sides, like a honeycomb!', svg: `<polygon points="60,8 108,34 108,86 60,112 12,86 12,34"/>` },
  { id: 'crescent',  label: 'Crescent',  fact: 'A little slice of the moon.', svg: `<path d="M84 18 A48 48 0 1 0 84 102 A36 36 0 1 1 84 18 Z"/>` },
];
