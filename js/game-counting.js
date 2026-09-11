import { initMusicToggle, playSuccessChime, playSnap, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const ICON_POOL = [
  { id: 'butterfly', svg: 'assets/pictures/butterfly.svg', label: 'butterfly' },
  { id: 'flower', svg: 'assets/pictures/flower.svg', label: 'flower' },
  { id: 'balloon', svg: 'assets/pictures/balloon.svg', label: 'balloon' },
  { id: 'fish', svg: 'assets/pictures/fish.svg', label: 'fish' },
  { id: 'sun-clouds', svg: 'assets/pictures/sun-clouds.svg', label: 'sun' },
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];

const promptText = document.getElementById('promptText');
const garden = document.getElementById('gardenField');

let targetCount = 0;
let foundCount = 0;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound() {
  garden.innerHTML = '';
  foundCount = 0;

  const [targetIcon, distractorIcon] = shuffle(ICON_POOL).slice(0, 2);
  targetCount = 1 + Math.floor(Math.random() * 5);
  const distractorCount = 2 + Math.floor(Math.random() * 3);

  const plural = targetCount > 1 ? 's' : '';
  promptText.textContent = `Find ${targetCount} ${targetIcon.label}${plural}!`;
  speak(`Can you find ${NUMBER_WORDS[targetCount]} ${targetIcon.label}${plural}?`);

  const items = shuffle([
    ...Array(targetCount).fill(null).map(() => ({ icon: targetIcon, isTarget: true })),
    ...Array(distractorCount).fill(null).map(() => ({ icon: distractorIcon, isTarget: false })),
  ]);

  const cols = 3;
  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'garden-item';
    el.innerHTML = `<img src="${item.icon.svg}" alt="${item.icon.label}" />`;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (Math.random() - 0.5) * 14;
    const jitterY = (Math.random() - 0.5) * 14;
    el.style.left = `calc(${((col + 0.5) / cols) * 100}% - 40px + ${jitterX}px)`;
    el.style.top = `${row * 100 + 16 + jitterY}px`;
    el.addEventListener('click', () => onItemTap(el, item));
    garden.appendChild(el);
  });

  const rows = Math.ceil(items.length / cols);
  garden.style.minHeight = rows * 100 + 40 + 'px';
}

function onItemTap(el, item) {
  if (el.classList.contains('found') || el.classList.contains('wobble')) return;

  if (item.isTarget) {
    el.classList.add('found');
    foundCount++;
    playSnap();
    speak(String(foundCount));
    if (foundCount === targetCount) {
      setTimeout(onRoundComplete, 500);
    }
  } else {
    el.classList.add('wobble');
    setTimeout(() => el.classList.remove('wobble'), 400);
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
  speak(`You counted ${targetCount}! Great job!`);
  launchConfetti();
  addStar('counting');
  setTimeout(buildRound, 2200);
}

buildRound();
