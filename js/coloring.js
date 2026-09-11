import { PICTURES, pictureIndex } from './pictures.js';
import { loadProgress, isUnlocked, markCompleted } from './progress.js';

const SIZE = 800; // internal working resolution for all canvases

const PALETTE = [
  '#ff3b30', '#ff9500', '#ffcc00', '#a3e635', '#34c759',
  '#00c7be', '#32ade6', '#007aff', '#5856d6', '#af52de',
  '#ff2d92', '#ff6b81', '#8d6e63', '#000000', '#5c5c5c',
  '#a8a8a8', '#ffffff', '#7b4b2a',
];

const BRUSHES = [
  { id: 'crayon', label: '🖍️ Crayon', alpha: 0.88, sizeMul: 1, texture: 'grain' },
  { id: 'marker', label: '🖊️ Marker', alpha: 1, sizeMul: 0.85, texture: 'solid' },
  { id: 'chunky', label: '🖌️ Chunky', alpha: 1, sizeMul: 1.9, texture: 'solid' },
  { id: 'glitter', label: '✨ Glitter', alpha: 0.9, sizeMul: 1, texture: 'sparkle' },
];

const params = new URLSearchParams(location.search);
const pictureId = params.get('id');
const idx = pictureIndex(pictureId);
const picture = PICTURES[idx];
const state = loadProgress();

if (!picture || !isUnlocked(state, pictureId)) {
  location.href = 'index.html';
}

document.getElementById('picTitle').textContent = picture.title;

const stage = document.getElementById('stage');
const paintCanvas = document.getElementById('paintCanvas');
const outlineCanvas = document.getElementById('outlineCanvas');
const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
const outlineCtx = outlineCanvas.getContext('2d');

paintCanvas.width = SIZE;
paintCanvas.height = SIZE;
outlineCanvas.width = SIZE;
outlineCanvas.height = SIZE;

let blockedMask = null; // Uint8Array, 1 = outline pixel (fill boundary)
let currentColor = PALETTE[0];
let currentTool = 'brush'; // 'brush' | 'fill'
let currentBrush = BRUSHES[0];
let brushSize = 22;
let drawing = false;
let lastPt = null;
const undoStack = [];

function pushUndo() {
  undoStack.push(paintCtx.getImageData(0, 0, SIZE, SIZE));
  if (undoStack.length > 20) undoStack.shift();
  document.getElementById('undoBtn').disabled = false;
}

function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  paintCtx.putImageData(prev, 0, 0);
  document.getElementById('undoBtn').disabled = undoStack.length === 0;
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function loadPictureMaskAndOutline() {
  const svgText = await fetch(picture.svg).then((r) => r.text());
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  outlineCtx.clearRect(0, 0, SIZE, SIZE);
  outlineCtx.drawImage(img, 0, 0, SIZE, SIZE);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = SIZE;
  maskCanvas.height = SIZE;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  maskCtx.drawImage(img, 0, 0, SIZE, SIZE);
  const data = maskCtx.getImageData(0, 0, SIZE, SIZE).data;

  blockedMask = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const alpha = data[i * 4 + 3];
    blockedMask[i] = alpha > 100 ? 1 : 0;
  }

  URL.revokeObjectURL(url);
}

function floodFill(startX, startY, colorHex) {
  const idxPx = startY * SIZE + startX;
  if (!blockedMask || blockedMask[idxPx]) return;

  const [r, g, b] = hexToRgb(colorHex);
  const imageData = paintCtx.getImageData(0, 0, SIZE, SIZE);
  const data = imageData.data;
  const visited = new Uint8Array(SIZE * SIZE);
  const stack = [[startX, startY]];

  while (stack.length) {
    const [x, y] = stack.pop();
    if (visited[y * SIZE + x] || blockedMask[y * SIZE + x]) continue;

    let xl = x;
    while (xl > 0 && !blockedMask[y * SIZE + (xl - 1)] && !visited[y * SIZE + (xl - 1)]) xl--;
    let xr = x;
    while (xr < SIZE - 1 && !blockedMask[y * SIZE + (xr + 1)] && !visited[y * SIZE + (xr + 1)]) xr++;

    for (let i = xl; i <= xr; i++) {
      const px = y * SIZE + i;
      if (visited[px] || blockedMask[px]) continue;
      visited[px] = 1;
      const p = px * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }

    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= SIZE) continue;
      let i = xl;
      while (i <= xr) {
        const px = ny * SIZE + i;
        if (!blockedMask[px] && !visited[px]) {
          stack.push([i, ny]);
          while (i <= xr && !blockedMask[ny * SIZE + i] && !visited[ny * SIZE + i]) i++;
        } else {
          i++;
        }
      }
    }
  }

  paintCtx.putImageData(imageData, 0, 0);
}

function stampBrush(x, y) {
  const r = (brushSize * currentBrush.sizeMul) / 2;
  paintCtx.globalAlpha = currentBrush.alpha;

  if (currentBrush.texture === 'grain') {
    paintCtx.globalAlpha = currentBrush.alpha * (0.75 + Math.random() * 0.25);
  }

  paintCtx.fillStyle = currentColor;
  paintCtx.beginPath();
  paintCtx.arc(x, y, r, 0, Math.PI * 2);
  paintCtx.fill();

  if (currentBrush.texture === 'sparkle' && Math.random() < 0.5) {
    paintCtx.globalAlpha = 0.9;
    paintCtx.fillStyle = '#ffffff';
    const sx = x + (Math.random() - 0.5) * r * 1.4;
    const sy = y + (Math.random() - 0.5) * r * 1.4;
    paintCtx.beginPath();
    paintCtx.arc(sx, sy, Math.max(1.5, r * 0.12), 0, Math.PI * 2);
    paintCtx.fill();
  }

  paintCtx.globalAlpha = 1;
}

function brushLine(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(2, brushSize / 4);
  const steps = Math.max(1, Math.floor(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampBrush(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  }
}

function toCanvasCoords(evt) {
  const rect = paintCanvas.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * SIZE;
  const y = ((evt.clientY - rect.top) / rect.height) * SIZE;
  return [Math.max(0, Math.min(SIZE - 1, Math.round(x))), Math.max(0, Math.min(SIZE - 1, Math.round(y)))];
}

function onPointerDown(evt) {
  evt.preventDefault();
  try {
    paintCanvas.setPointerCapture(evt.pointerId);
  } catch {
    // Some environments (or synthetic events) don't have an active pointer to capture; safe to ignore.
  }
  const [x, y] = toCanvasCoords(evt);
  pushUndo();

  if (currentTool === 'fill') {
    floodFill(x, y, currentColor);
  } else {
    drawing = true;
    lastPt = [x, y];
    stampBrush(x, y);
  }
}

function onPointerMove(evt) {
  if (!drawing || currentTool !== 'brush') return;
  evt.preventDefault();
  const [x, y] = toCanvasCoords(evt);
  brushLine(lastPt[0], lastPt[1], x, y);
  lastPt = [x, y];
}

function onPointerUp() {
  drawing = false;
  lastPt = null;
}

paintCanvas.addEventListener('pointerdown', onPointerDown);
paintCanvas.addEventListener('pointermove', onPointerMove);
paintCanvas.addEventListener('pointerup', onPointerUp);
paintCanvas.addEventListener('pointercancel', onPointerUp);
paintCanvas.addEventListener('pointerleave', onPointerUp);

function buildPalette() {
  const wrap = document.getElementById('palette');
  PALETTE.forEach((hex, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.style.background = hex;
    btn.setAttribute('aria-label', 'Color ' + hex);
    if (i === 0) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      currentColor = hex;
      document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      customColorInput.value = hex;
    });
    wrap.appendChild(btn);
  });
}

const customColorInput = document.getElementById('customColor');
customColorInput.addEventListener('input', () => {
  currentColor = customColorInput.value;
  document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
});

function buildBrushStyles() {
  const wrap = document.getElementById('brushStyles');
  BRUSHES.forEach((b, i) => {
    const btn = document.createElement('button');
    btn.className = 'brush-btn';
    btn.textContent = b.label;
    if (i === 0) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      currentBrush = b;
      currentTool = 'brush';
      document.querySelectorAll('.brush-btn').forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      setTool('brush');
    });
    wrap.appendChild(btn);
  });
}

function setTool(tool) {
  currentTool = tool;
  document.getElementById('toolBrush').classList.toggle('selected', tool === 'brush');
  document.getElementById('toolFill').classList.toggle('selected', tool === 'fill');
  stage.classList.toggle('cursor-fill', tool === 'fill');
}

document.getElementById('toolBrush').addEventListener('click', () => setTool('brush'));
document.getElementById('toolFill').addEventListener('click', () => setTool('fill'));

const sizeSlider = document.getElementById('brushSize');
sizeSlider.addEventListener('input', () => {
  brushSize = Number(sizeSlider.value);
});

document.getElementById('undoBtn').addEventListener('click', undo);

function makeThumbnail() {
  const tmp = document.createElement('canvas');
  tmp.width = 220;
  tmp.height = 220;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 220, 220);
  tctx.drawImage(paintCanvas, 0, 0, 220, 220);
  tctx.drawImage(outlineCanvas, 0, 0, 220, 220);
  return tmp.toDataURL('image/png');
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

document.getElementById('doneBtn').addEventListener('click', () => {
  const thumb = makeThumbnail();
  markCompleted(state, picture.id, thumb);
  launchConfetti();
  const nextPic = PICTURES[idx + 1];
  setTimeout(() => {
    if (nextPic) {
      location.href = `color.html?id=${encodeURIComponent(nextPic.id)}`;
    } else {
      location.href = 'index.html?finished=1';
    }
  }, 1500);
});

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'index.html';
});

document.getElementById('resetBtn').addEventListener('click', () => {
  pushUndo();
  paintCtx.clearRect(0, 0, SIZE, SIZE);
});

buildPalette();
buildBrushStyles();
setTool('brush');
loadPictureMaskAndOutline().catch((err) => {
  console.error(err);
  document.getElementById('picTitle').textContent = 'Could not load picture 😢';
});
