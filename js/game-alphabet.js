import { initMusicToggle, playSnap, playSuccessChime, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const LETTERS = [
  ['A', 'Apple'], ['B', 'Ball'], ['C', 'Cat'], ['D', 'Dog'], ['E', 'Elephant'],
  ['F', 'Fish'], ['G', 'Grapes'], ['H', 'Hat'], ['I', 'Ice Cream'], ['J', 'Juice'],
  ['K', 'Kite'], ['L', 'Lion'], ['M', 'Moon'], ['N', 'Nest'], ['O', 'Orange'],
  ['P', 'Pig'], ['Q', 'Queen'], ['R', 'Rainbow'], ['S', 'Sun'], ['T', 'Tiger'],
  ['U', 'Umbrella'], ['V', 'Van'], ['W', 'Watermelon'], ['X', 'Xylophone'],
  ['Y', 'Yoyo'], ['Z', 'Zebra'],
];
const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#32ade6', '#007aff', '#af52de', '#ff6b81'];

const grid = document.getElementById('letterGrid');
const tapped = new Set();

LETTERS.forEach(([letter, word], i) => {
  const btn = document.createElement('button');
  btn.className = 'letter-tile';
  btn.style.background = COLORS[i % COLORS.length];
  btn.textContent = letter;
  btn.addEventListener('click', () => onLetterTap(btn, letter, word));
  grid.appendChild(btn);
});

function launchConfetti() {
  const layer = document.getElementById('confetti');
  layer.innerHTML = '';
  const colors = ['#ff3b30', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff6b81'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
    layer.appendChild(p);
  }
  layer.classList.add('active');
  setTimeout(() => layer.classList.remove('active'), 2600);
}

function onLetterTap(btn, letter, word) {
  btn.classList.remove('bounce');
  void btn.offsetWidth; // restart the animation even if tapped again quickly
  btn.classList.add('bounce');
  playSnap();
  speak(`${letter}... ${word}`);

  tapped.add(letter);
  if (tapped.size % 6 === 0) addStar('alphabet');
  if (tapped.size === LETTERS.length) {
    setTimeout(() => {
      playSuccessChime();
      speak('Wow, you found every letter! Amazing!');
      launchConfetti();
    }, 400);
  }
}
