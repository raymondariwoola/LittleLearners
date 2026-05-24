/* Animals roster.
 * soundUrl is optional; if a real MP3 sits at /assets/animals/<id>.mp3 we'll
 * play it via PP.Audio.playSample(). Otherwise we fall back to the spoken
 * onomatopoeia + a friendly chord.
 */
window.PP = window.PP || {};
window.PP.Animals = [
  { id: 'cow',     label: 'Cow',     emoji: '🐄', sound: 'Moo!',         soundUrl: 'assets/animals/cow.mp3' },
  { id: 'dog',     label: 'Dog',     emoji: '🐶', sound: 'Woof! Woof!',  soundUrl: 'assets/animals/dog.mp3' },
  { id: 'cat',     label: 'Cat',     emoji: '🐱', sound: 'Meow!',        soundUrl: 'assets/animals/cat.mp3' },
  { id: 'sheep',   label: 'Sheep',   emoji: '🐑', sound: 'Baa!',         soundUrl: 'assets/animals/sheep.mp3' },
  { id: 'pig',     label: 'Pig',     emoji: '🐷', sound: 'Oink!',        soundUrl: 'assets/animals/pig.mp3' },
  { id: 'horse',   label: 'Horse',   emoji: '🐴', sound: 'Neigh!',       soundUrl: 'assets/animals/horse.mp3' },
  { id: 'duck',    label: 'Duck',    emoji: '🦆', sound: 'Quack!',       soundUrl: 'assets/animals/duck.mp3' },
  { id: 'chicken', label: 'Chicken', emoji: '🐔', sound: 'Cluck cluck!', soundUrl: 'assets/animals/chicken.mp3' },
  { id: 'lion',    label: 'Lion',    emoji: '🦁', sound: 'Roar!',        soundUrl: 'assets/animals/lion.mp3' },
  { id: 'elephant',label: 'Elephant',emoji: '🐘', sound: 'Trumpet!',     soundUrl: 'assets/animals/elephant.mp3' },
  { id: 'monkey',  label: 'Monkey',  emoji: '🐵', sound: 'Ooh ooh ah!',  soundUrl: 'assets/animals/monkey.mp3' },
  { id: 'frog',    label: 'Frog',    emoji: '🐸', sound: 'Ribbit!',      soundUrl: 'assets/animals/frog.mp3' },
  { id: 'bee',     label: 'Bee',     emoji: '🐝', sound: 'Bzzz!',        soundUrl: 'assets/animals/bee.mp3' },
  { id: 'owl',     label: 'Owl',     emoji: '🦉', sound: 'Hoo hoo!',     soundUrl: 'assets/animals/owl.mp3' },
  { id: 'fish',    label: 'Fish',    emoji: '🐟', sound: 'Blub blub!',   soundUrl: 'assets/animals/fish.mp3' },
];
