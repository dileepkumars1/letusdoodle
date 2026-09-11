import { initMusicToggle, playSuccessChime, playSnap, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const SHAPES = [
  { type: 'circle', label: 'Circle', color: '#ff3b30' },
  { type: 'square', label: 'Square', color: '#ffcc00' },
  { type: 'triangle', label: 'Triangle', color: '#34c759' },
  { type: 'star', label: 'Star', color: '#32ade6' },
  { type: 'heart', label: 'Heart', color: '#af52de' },
];

// A small, self-contained shape-path generator (mirrors the shape set in create.js's
// shape tool conceptually, kept independent here to avoid a fragile cross-page import).
function starPoints(cx, cy, outerR, innerR, points) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
  }
  return pts.join(' ');
}

function shapeSvg(type, fill, stroke) {
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
  const inner = {
    circle: `<circle cx="50" cy="50" r="40" ${common}/>`,
    square: `<rect x="12" y="12" width="76" height="76" rx="10" ${common}/>`,
    triangle: `<polygon points="50,12 88,85 12,85" ${common}/>`,
    star: `<polygon points="${starPoints(50, 50, 40, 17, 5)}" ${common}/>`,
    heart: `<path d="M50 85 C20 60 8 38 8 22 C8 8 20 2 32 2 C42 2 50 10 50 20 C50 10 58 2 68 2 C80 2 92 8 92 22 C92 38 80 60 50 85 Z" ${common}/>`,
  }[type];
  return `<svg viewBox="0 0 100 100">${inner}</svg>`;
}

const stage = document.getElementById('sorterStage');
const board = document.getElementById('sorterBoard');
const playAgainBtn = document.getElementById('playAgainBtn');

let placedCount = 0;
let dragState = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Spreads pieces across a few loose columns (with a little jitter) so they land in the
// tray without piling up on top of each other and becoming hard to grab individually.
function homePosition(index, stageRect) {
  const trayTop = 150;
  const cols = 3;
  const colWidth = stageRect.width / cols;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const jitterX = (Math.random() - 0.5) * 16;
  const jitterY = (Math.random() - 0.5) * 16;
  const left = Math.max(0, Math.min(stageRect.width - 84, col * colWidth + (colWidth - 84) / 2 + jitterX));
  const top = Math.max(trayTop, Math.min(stageRect.height - 84, trayTop + row * 96 + jitterY));
  return { left, top };
}

function buildRound() {
  board.innerHTML = '';
  stage.querySelectorAll('.sorter-piece').forEach((p) => p.remove());
  placedCount = 0;
  playAgainBtn.hidden = true;

  shuffle(SHAPES).forEach((s) => {
    const slot = document.createElement('div');
    slot.className = 'sorter-slot';
    slot.dataset.type = s.type;
    slot.innerHTML = shapeSvg(s.type, 'none', '#c9c2b3');
    board.appendChild(slot);
  });

  requestAnimationFrame(() => {
    const stageRect = stage.getBoundingClientRect();
    shuffle(SHAPES).forEach((s, i) => {
      const piece = document.createElement('div');
      piece.className = 'sorter-piece';
      piece.dataset.type = s.type;
      piece.dataset.homeIndex = String(i);
      piece.innerHTML = shapeSvg(s.type, s.color, '#2d2d2d');
      const home = homePosition(i, stageRect);
      piece.style.left = home.left + 'px';
      piece.style.top = home.top + 'px';
      piece.addEventListener('pointerdown', (evt) => onPieceDown(evt, piece));
      stage.appendChild(piece);
    });
  });
}

function onPieceDown(evt, piece) {
  if (piece.classList.contains('placed')) return;
  evt.preventDefault();
  try {
    piece.setPointerCapture(evt.pointerId);
  } catch {
    // Some environments don't have an active pointer to capture; safe to ignore.
  }

  const pieceRect = piece.getBoundingClientRect();
  dragState = {
    piece,
    offsetX: evt.clientX - pieceRect.left,
    offsetY: evt.clientY - pieceRect.top,
  };
  piece.classList.add('dragging');

  const shapeName = SHAPES.find((s) => s.type === piece.dataset.type)?.label;
  if (shapeName) speak(shapeName);

  function onMove(e) {
    if (!dragState) return;
    const sRect = stage.getBoundingClientRect();
    let left = e.clientX - sRect.left - dragState.offsetX;
    let top = e.clientY - sRect.top - dragState.offsetY;
    left = Math.max(0, Math.min(sRect.width - 84, left));
    top = Math.max(0, Math.min(sRect.height - 84, top));
    dragState.piece.style.left = left + 'px';
    dragState.piece.style.top = top + 'px';
  }
  function onUp() {
    piece.removeEventListener('pointermove', onMove);
    piece.removeEventListener('pointerup', onUp);
    piece.removeEventListener('pointercancel', onUp);
    piece.classList.remove('dragging');
    resolveDrop(piece);
    dragState = null;
  }
  piece.addEventListener('pointermove', onMove);
  piece.addEventListener('pointerup', onUp);
  piece.addEventListener('pointercancel', onUp);
}

function resolveDrop(piece) {
  const pieceRect = piece.getBoundingClientRect();
  const cx = pieceRect.left + pieceRect.width / 2;
  const cy = pieceRect.top + pieceRect.height / 2;

  // Find the single NEAREST slot by center distance (rather than "any slot whose expanded
  // hitbox contains the point") - slots sit close together, so overlapping tolerance zones
  // could otherwise let a piece snap into a neighbouring, wrong-type slot.
  const slots = Array.from(board.querySelectorAll('.sorter-slot'));
  let targetSlot = null;
  let closestDist = Infinity;
  slots.forEach((slot) => {
    const r = slot.getBoundingClientRect();
    const dist = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
    if (dist < closestDist) {
      closestDist = dist;
      targetSlot = slot;
    }
  });
  const SNAP_RADIUS = 55;
  if (closestDist > SNAP_RADIUS) targetSlot = null;

  if (targetSlot && targetSlot.dataset.type === piece.dataset.type && !targetSlot.dataset.filled) {
    const stageRect = stage.getBoundingClientRect();
    const slotRect = targetSlot.getBoundingClientRect();
    piece.style.left = slotRect.left - stageRect.left + 'px';
    piece.style.top = slotRect.top - stageRect.top + 'px';
    piece.classList.add('placed');
    targetSlot.dataset.filled = 'true';
    targetSlot.style.opacity = '0';
    playSnap();
    placedCount++;
    if (placedCount === SHAPES.length) onRoundComplete();
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const home = homePosition(Number(piece.dataset.homeIndex) || 0, stageRect);
  piece.style.left = home.left + 'px';
  piece.style.top = home.top + 'px';
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
  speak('You did it! All the shapes match!');
  launchConfetti();
  addStar('shapes');
  playAgainBtn.hidden = false;
}

playAgainBtn.addEventListener('click', buildRound);

buildRound();
