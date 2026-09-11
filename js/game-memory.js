import { PICTURES } from './pictures.js';
import { initMusicToggle, playSuccessChime, playSnap, playTryAgain, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const PAIR_IDS = ['cat', 'dog', 'fish', 'butterfly', 'rocket', 'ice-cream'];
const pairSource = PAIR_IDS.map((id) => PICTURES.find((p) => p.id === id)).filter(Boolean);

const grid = document.getElementById('memoryGrid');
const playAgainBtn = document.getElementById('playAgainBtn');

let flippedCards = [];
let lockBoard = false;
let matchedCount = 0;
let totalCards = 0;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound() {
  grid.innerHTML = '';
  flippedCards = [];
  lockBoard = false;
  matchedCount = 0;
  playAgainBtn.hidden = true;

  const deck = shuffle([...pairSource, ...pairSource]);
  totalCards = deck.length;

  deck.forEach((pic) => {
    const el = document.createElement('div');
    el.className = 'memory-card';
    el.innerHTML = `
      <div class="memory-card-inner">
        <div class="memory-card-face memory-card-front">🎨</div>
        <div class="memory-card-face memory-card-back"><img src="${pic.svg}" alt="${pic.title}" /></div>
      </div>`;
    el.addEventListener('click', () => onCardTap(el, pic));
    grid.appendChild(el);
  });
}

function onCardTap(el, pic) {
  if (lockBoard) return;
  if (el.classList.contains('flipped') || el.classList.contains('matched')) return;

  el.classList.add('flipped');
  flippedCards.push({ el, pic });
  speak(pic.title);

  if (flippedCards.length < 2) return;

  lockBoard = true;
  const [a, b] = flippedCards;
  if (a.pic.id === b.pic.id) {
    setTimeout(() => {
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      playSnap();
      matchedCount += 2;
      flippedCards = [];
      lockBoard = false;
      if (matchedCount === totalCards) onRoundComplete();
    }, 350);
  } else {
    playTryAgain();
    setTimeout(() => {
      a.el.classList.remove('flipped');
      b.el.classList.remove('flipped');
      flippedCards = [];
      lockBoard = false;
    }, 900);
  }
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

function onRoundComplete() {
  playSuccessChime();
  speak('You found them all! Great job!');
  launchConfetti();
  addStar('memory');
  playAgainBtn.hidden = false;
}

playAgainBtn.addEventListener('click', buildRound);

buildRound();
