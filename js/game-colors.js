import { initMusicToggle, playSuccessChime, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const COLORS = [
  { name: 'Red', hex: '#ff3b30' },
  { name: 'Yellow', hex: '#ffcc00' },
  { name: 'Green', hex: '#34c759' },
  { name: 'Blue', hex: '#007aff' },
  { name: 'Purple', hex: '#af52de' },
  { name: 'Pink', hex: '#ff6b81' },
];

const promptText = document.getElementById('promptText');
const grid = document.getElementById('colorGrid');

let correctColor = null;
let roundsWon = 0;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound() {
  const picked = shuffle(COLORS).slice(0, 4);
  correctColor = picked[Math.floor(Math.random() * picked.length)];
  promptText.textContent = `Where's the ${correctColor.name} one?`;
  speak(`Can you find the ${correctColor.name.toLowerCase()} one?`);

  grid.innerHTML = '';
  picked.forEach((c) => {
    const el = document.createElement('button');
    el.className = 'color-blob';
    el.style.background = c.hex;
    el.setAttribute('aria-label', c.name);
    el.addEventListener('click', () => onColorTap(el, c));
    grid.appendChild(el);
  });
}

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

function onColorTap(el, c) {
  if (c.name === correctColor.name) {
    playSuccessChime();
    speak('Yes! Great job!');
    roundsWon++;
    if (roundsWon % 3 === 0) addStar('colors');
    launchConfetti();
    setTimeout(buildRound, 1700);
  } else {
    el.classList.add('wobble');
    setTimeout(() => el.classList.remove('wobble'), 400);
  }
}

buildRound();
