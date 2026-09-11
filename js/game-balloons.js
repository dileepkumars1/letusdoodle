import { initMusicToggle, playPop, playSuccessChime, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const BALLOON_COLORS = [
  { name: 'red', hex: '#ff3b30' },
  { name: 'yellow', hex: '#ffcc00' },
  { name: 'green', hex: '#34c759' },
  { name: 'blue', hex: '#007aff' },
  { name: 'purple', hex: '#af52de' },
  { name: 'pink', hex: '#ff6b81' },
];

const field = document.getElementById('balloonField');
const promptText = document.getElementById('promptText');

let currentPromptColor = null;
let promptTimer = null;
let correctStreak = 0;

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function newPrompt() {
  currentPromptColor = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
  promptText.textContent = `Pop a ${capitalize(currentPromptColor.name)} balloon!`;
  speak(`Can you pop a ${currentPromptColor.name} balloon?`);
}

function schedulePrompt(delay) {
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => {
    newPrompt();
    schedulePrompt(13000);
  }, delay);
}

function spawnBalloon() {
  if (field.querySelectorAll('.balloon').length >= 9) return;
  const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
  const el = document.createElement('div');
  el.className = 'balloon';
  const leftPct = 6 + Math.random() * 82;
  const duration = 6 + Math.random() * 3.5;
  const travel = field.clientHeight + 160;
  el.style.left = leftPct + '%';
  el.style.setProperty('--travel', travel + 'px');
  el.style.animationDuration = duration + 's';
  el.innerHTML = `<div class="balloon-body" style="background:${color.hex}"></div><div class="balloon-string"></div>`;
  el.addEventListener('animationend', (evt) => {
    if (evt.animationName === 'floatUp') el.remove();
  });
  el.addEventListener('pointerdown', () => popBalloon(el, color));
  field.appendChild(el);
}

function spawnParticles(el, hex) {
  const rect = el.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const cx = rect.left - fieldRect.left + rect.width / 2;
  const cy = rect.top - fieldRect.top + rect.height / 2;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('span');
    p.className = 'pop-particle';
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.background = hex;
    const angle = (Math.PI * 2 * i) / 10;
    const dist = 30 + Math.random() * 20;
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    field.appendChild(p);
    setTimeout(() => p.remove(), 550);
  }
}

function popBalloon(el, color) {
  if (el.classList.contains('popping')) return;
  el.classList.add('popping');
  playPop();
  spawnParticles(el, color.hex);
  setTimeout(() => el.remove(), 220);

  if (currentPromptColor && color.name === currentPromptColor.name) {
    correctStreak++;
    playSuccessChime();
    speak('Yay! Great job!');
    if (correctStreak % 3 === 0) addStar('balloons');
    schedulePrompt(1800);
  }
}

setInterval(spawnBalloon, 1300);
for (let i = 0; i < 3; i++) setTimeout(spawnBalloon, i * 400);
schedulePrompt(4000);
