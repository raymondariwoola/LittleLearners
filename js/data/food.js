/* Food roster grouped loosely so quiz could ask "find a fruit" later. */
window.PP = window.PP || {};
window.PP.Food = [
  // Fruit
  { id: 'apple',      label: 'Apple',      emoji: '🍎', group: 'fruit' },
  { id: 'banana',     label: 'Banana',     emoji: '🍌', group: 'fruit' },
  { id: 'grapes',     label: 'Grapes',     emoji: '🍇', group: 'fruit' },
  { id: 'strawberry', label: 'Strawberry', emoji: '🍓', group: 'fruit' },
  { id: 'orange',     label: 'Orange',     emoji: '🍊', group: 'fruit' },
  { id: 'watermelon', label: 'Watermelon', emoji: '🍉', group: 'fruit' },
  { id: 'pineapple',  label: 'Pineapple',  emoji: '🍍', group: 'fruit' },
  { id: 'pear',       label: 'Pear',       emoji: '🍐', group: 'fruit' },
  { id: 'peach',      label: 'Peach',      emoji: '🍑', group: 'fruit' },
  { id: 'blueberry',  label: 'Blueberries', emoji: '🫐', group: 'fruit' },
  { id: 'lemon',      label: 'Lemon',      emoji: '🍋', group: 'fruit' },
  { id: 'cherry',     label: 'Cherries',   emoji: '🍒', group: 'fruit' },
  // Veggies
  { id: 'carrot',     label: 'Carrot',     emoji: '🥕', group: 'veggie' },
  { id: 'broccoli',   label: 'Broccoli',   emoji: '🥦', group: 'veggie' },
  { id: 'corn',       label: 'Corn',       emoji: '🌽', group: 'veggie' },
  { id: 'tomato',     label: 'Tomato',     emoji: '🍅', group: 'veggie' },
  { id: 'potato',     label: 'Potato',     emoji: '🥔', group: 'veggie' },
  { id: 'cucumber',   label: 'Cucumber',   emoji: '🥒', group: 'veggie' },
  { id: 'avocado',    label: 'Avocado',    emoji: '🥑', group: 'veggie' },
  { id: 'pepper',     label: 'Pepper',     emoji: '🫑', group: 'veggie' },
  { id: 'mushroom',   label: 'Mushroom',   emoji: '🍄', group: 'veggie' },
  // Grains / staples
  { id: 'bread',      label: 'Bread',      emoji: '🍞', group: 'grain' },
  { id: 'rice',       label: 'Rice',       emoji: '🍚', group: 'grain' },
  { id: 'noodles',    label: 'Noodles',    emoji: '🍜', group: 'grain' },
  { id: 'pancake',    label: 'Pancakes',   emoji: '🥞', group: 'grain' },
  // Dairy
  { id: 'cheese',     label: 'Cheese',     emoji: '🧀', group: 'dairy' },
  { id: 'milk',       label: 'Milk',       emoji: '🥛', group: 'dairy' },
  { id: 'butter',     label: 'Butter',     emoji: '🧈', group: 'dairy' },
  { id: 'yogurt',     label: 'Yogurt',     emoji: '🍦', group: 'dairy' },
  // Protein
  { id: 'egg',        label: 'Egg',        emoji: '🥚', group: 'protein' },
  { id: 'chicken',    label: 'Chicken',    emoji: '🍗', group: 'protein' },
  { id: 'fish',       label: 'Fish',       emoji: '🐟', group: 'protein' },
  { id: 'meat',       label: 'Meat',       emoji: '🥩', group: 'protein' },
  // Meals & treats
  { id: 'pizza',      label: 'Pizza',      emoji: '🍕', group: 'meal' },
  { id: 'burger',     label: 'Burger',     emoji: '🍔', group: 'meal' },
  { id: 'sandwich',   label: 'Sandwich',   emoji: '🥪', group: 'meal' },
  { id: 'taco',       label: 'Taco',       emoji: '🌮', group: 'meal' },
  { id: 'soup',       label: 'Soup',       emoji: '🍲', group: 'meal' },
  { id: 'cookie',     label: 'Cookie',     emoji: '🍪', group: 'treat' },
  { id: 'cake',       label: 'Cake',       emoji: '🍰', group: 'treat' },
  { id: 'donut',      label: 'Donut',      emoji: '🍩', group: 'treat' },
  { id: 'icecream',   label: 'Ice cream',  emoji: '🍨', group: 'treat' },
  { id: 'candy',      label: 'Candy',      emoji: '🍬', group: 'treat' },
  // Drinks
  { id: 'juice',      label: 'Juice',      emoji: '🧃', group: 'drink' },
  { id: 'water',      label: 'Water',      emoji: '💧', group: 'drink' },
];
