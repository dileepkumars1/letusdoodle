import { initMusicToggle, playSuccessChime } from './audio.js';

const SIZE = 800; // internal working resolution for all canvases
const STORAGE_KEY = 'kidscolor_creations';
const MAX_SAVED = 8;

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

const SHAPES = [
  { type: 'circle', label: '⚪ Circle' },
  { type: 'oval', label: '🥚 Oval' },
  { type: 'square', label: '⬛ Square' },
  { type: 'triangle', label: '🔺 Triangle' },
  { type: 'star', label: '⭐ Star' },
  { type: 'heart', label: '❤️ Heart' },
];

const params = new URLSearchParams(location.search);
let creationId = params.get('id');

const stage = document.getElementById('stage');
const paintCanvas = document.getElementById('paintCanvas');
const shapesCanvas = document.getElementById('shapesCanvas');
const selectionCanvas = document.getElementById('selectionCanvas');
const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });
const shapesCtx = shapesCanvas.getContext('2d', { willReadFrequently: true });
const selCtx = selectionCanvas.getContext('2d');

[paintCanvas, shapesCanvas, selectionCanvas].forEach((c) => {
  c.width = SIZE;
  c.height = SIZE;
});

let shapes = []; // {id, type, x, y, w, h} - x,y is the shape's center
let nextShapeId = 1;
let selectedId = null;
let armedShapeType = null; // shape type waiting to be dropped on the next tap
let blockedMask = null; // Uint8Array, 1 = shape outline pixel (fill boundary)

let currentColor = PALETTE[0];
let currentTool = 'brush'; // 'brush' | 'fill' | 'shapes'
let currentBrush = BRUSHES[0];
let brushSize = 22;
let drawing = false;
let lastPt = null;
let dragMode = null; // 'move' | 'resize' | null
let dragStart = null;
const undoStack = [];

function pushUndo() {
  undoStack.push({
    shapes: shapes.map((s) => ({ ...s })),
    paint: paintCtx.getImageData(0, 0, SIZE, SIZE),
  });
  if (undoStack.length > 20) undoStack.shift();
  document.getElementById('undoBtn').disabled = false;
}

function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  shapes = prev.shapes;
  selectedId = null;
  paintCtx.putImageData(prev.paint, 0, 0);
  renderShapes();
  refreshToolbarUI();
  document.getElementById('undoBtn').disabled = undoStack.length === 0;
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// --- Shape geometry -------------------------------------------------------

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outerR, innerR) {
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function heartPath(ctx, cx, cy, w, h) {
  ctx.moveTo(cx, cy + h * 0.32);
  ctx.bezierCurveTo(cx - w / 2, cy - h * 0.18, cx - w / 2, cy - h * 0.68, cx, cy - h * 0.32);
  ctx.bezierCurveTo(cx + w / 2, cy - h * 0.68, cx + w / 2, cy - h * 0.18, cx, cy + h * 0.32);
  ctx.closePath();
}

function traceShape(ctx, shape) {
  const { type, x, y, w, h } = shape;
  ctx.beginPath();
  switch (type) {
    case 'circle':
    case 'oval':
      ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'square':
      roundRectPath(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.08);
      break;
    case 'triangle':
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.closePath();
      break;
    case 'star':
      starPath(ctx, x, y, Math.min(w, h) / 2, Math.min(w, h) * 0.19);
      break;
    case 'heart':
      heartPath(ctx, x, y, w, h);
      break;
    default:
      break;
  }
}

function renderShapes() {
  shapesCtx.clearRect(0, 0, SIZE, SIZE);
  shapesCtx.strokeStyle = '#2d2d2d';
  shapesCtx.lineWidth = 7;
  shapesCtx.lineJoin = 'round';
  shapesCtx.lineCap = 'round';
  for (const s of shapes) {
    traceShape(shapesCtx, s);
    shapesCtx.stroke();
  }
  recomputeMask();
  renderSelection();
}

function recomputeMask() {
  const data = shapesCtx.getImageData(0, 0, SIZE, SIZE).data;
  blockedMask = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    blockedMask[i] = data[i * 4 + 3] > 100 ? 1 : 0;
  }
}

function renderSelection() {
  selCtx.clearRect(0, 0, SIZE, SIZE);
  const s = shapes.find((sh) => sh.id === selectedId);
  if (!s) return;
  const x0 = s.x - s.w / 2;
  const y0 = s.y - s.h / 2;
  selCtx.strokeStyle = '#32ade6';
  selCtx.setLineDash([10, 8]);
  selCtx.lineWidth = 3;
  selCtx.strokeRect(x0, y0, s.w, s.h);
  selCtx.setLineDash([]);

  const hx = x0 + s.w;
  const hy = y0 + s.h;
  selCtx.fillStyle = '#32ade6';
  selCtx.beginPath();
  selCtx.arc(hx, hy, 18, 0, Math.PI * 2);
  selCtx.fill();
  selCtx.fillStyle = '#fff';
  selCtx.font = 'bold 22px sans-serif';
  selCtx.textAlign = 'center';
  selCtx.textBaseline = 'middle';
  selCtx.fillText('↘', hx, hy + 1);
}

function hitTestHandle(x, y) {
  const s = shapes.find((sh) => sh.id === selectedId);
  if (!s) return false;
  const hx = s.x + s.w / 2;
  const hy = s.y + s.h / 2;
  return Math.hypot(x - hx, y - hy) < 24;
}

function hitTestShape(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (x >= s.x - s.w / 2 && x <= s.x + s.w / 2 && y >= s.y - s.h / 2 && y <= s.y + s.h / 2) {
      return s;
    }
  }
  return null;
}

// --- Fill / brush (same engine as the picture pages, but against the shapes mask) ---

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

// --- Pointer interaction ---------------------------------------------------

function onPointerDown(evt) {
  evt.preventDefault();
  try {
    paintCanvas.setPointerCapture(evt.pointerId);
  } catch {
    // Some environments (or synthetic events) don't have an active pointer to capture; safe to ignore.
  }
  const [x, y] = toCanvasCoords(evt);

  if (currentTool === 'shapes') {
    if (armedShapeType) {
      pushUndo();
      const shape = { id: nextShapeId++, type: armedShapeType, x, y, w: 110, h: 110 };
      shapes.push(shape);
      selectedId = shape.id;
      armedShapeType = null;
      document.querySelectorAll('#shapePalette .brush-btn').forEach((b) => b.classList.remove('selected'));
      renderShapes();
      refreshToolbarUI();
      return;
    }
    if (hitTestHandle(x, y)) {
      pushUndo();
      const s = shapes.find((sh) => sh.id === selectedId);
      dragMode = 'resize';
      dragStart = { topLeftX: s.x - s.w / 2, topLeftY: s.y - s.h / 2 };
      return;
    }
    const hit = hitTestShape(x, y);
    if (hit) {
      pushUndo();
      selectedId = hit.id;
      dragMode = 'move';
      dragStart = { x, y, shapeX: hit.x, shapeY: hit.y };
      renderShapes();
      refreshToolbarUI();
    } else {
      selectedId = null;
      dragMode = null;
      renderShapes();
      refreshToolbarUI();
    }
    return;
  }

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
  if (currentTool === 'shapes' && dragMode) {
    evt.preventDefault();
    const [x, y] = toCanvasCoords(evt);
    const s = shapes.find((sh) => sh.id === selectedId);
    if (!s) return;
    if (dragMode === 'move') {
      s.x = dragStart.shapeX + (x - dragStart.x);
      s.y = dragStart.shapeY + (y - dragStart.y);
    } else if (dragMode === 'resize') {
      const w = Math.max(30, Math.min(700, x - dragStart.topLeftX));
      const h = Math.max(30, Math.min(700, y - dragStart.topLeftY));
      s.w = w;
      s.h = h;
      s.x = dragStart.topLeftX + w / 2;
      s.y = dragStart.topLeftY + h / 2;
    }
    renderShapes();
    return;
  }
  if (!drawing || currentTool !== 'brush') return;
  evt.preventDefault();
  const [x, y] = toCanvasCoords(evt);
  brushLine(lastPt[0], lastPt[1], x, y);
  lastPt = [x, y];
}

function onPointerUp() {
  drawing = false;
  lastPt = null;
  dragMode = null;
  dragStart = null;
}

paintCanvas.addEventListener('pointerdown', onPointerDown);
paintCanvas.addEventListener('pointermove', onPointerMove);
paintCanvas.addEventListener('pointerup', onPointerUp);
paintCanvas.addEventListener('pointercancel', onPointerUp);
paintCanvas.addEventListener('pointerleave', onPointerUp);

// --- Toolbar ----------------------------------------------------------------

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
      document.querySelectorAll('#brushStyles .brush-btn').forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
      setTool('brush');
    });
    wrap.appendChild(btn);
  });
}

function buildShapePalette() {
  const wrap = document.getElementById('shapePalette');
  SHAPES.forEach((sh) => {
    const btn = document.createElement('button');
    btn.className = 'brush-btn';
    btn.textContent = sh.label;
    btn.addEventListener('click', () => {
      armedShapeType = sh.type;
      setTool('shapes');
      document.querySelectorAll('#shapePalette .brush-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    wrap.appendChild(btn);
  });
}

function refreshToolbarUI() {
  document.getElementById('toolBrush').classList.toggle('selected', currentTool === 'brush');
  document.getElementById('toolFill').classList.toggle('selected', currentTool === 'fill');
  document.getElementById('toolShapes').classList.toggle('selected', currentTool === 'shapes');
  document.getElementById('brushStyles').hidden = currentTool !== 'brush';
  document.getElementById('sizeRow').hidden = currentTool !== 'brush';
  document.getElementById('shapePalette').hidden = currentTool !== 'shapes';
  document.getElementById('deleteShapeBtn').hidden = !(currentTool === 'shapes' && selectedId);
  stage.classList.toggle('cursor-fill', currentTool === 'fill');
}

function setTool(tool) {
  currentTool = tool;
  if (tool !== 'shapes') {
    armedShapeType = null;
    selectedId = null;
    renderShapes();
  }
  refreshToolbarUI();
}

document.getElementById('toolBrush').addEventListener('click', () => setTool('brush'));
document.getElementById('toolFill').addEventListener('click', () => setTool('fill'));
document.getElementById('toolShapes').addEventListener('click', () => setTool('shapes'));

document.getElementById('deleteShapeBtn').addEventListener('click', () => {
  if (!selectedId) return;
  pushUndo();
  shapes = shapes.filter((s) => s.id !== selectedId);
  selectedId = null;
  renderShapes();
  refreshToolbarUI();
});

const sizeSlider = document.getElementById('brushSize');
sizeSlider.addEventListener('input', () => {
  brushSize = Number(sizeSlider.value);
});

document.getElementById('undoBtn').addEventListener('click', undo);

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'index.html';
});

document.getElementById('clearBtn').addEventListener('click', () => {
  pushUndo();
  shapes = [];
  selectedId = null;
  armedShapeType = null;
  paintCtx.clearRect(0, 0, SIZE, SIZE);
  renderShapes();
  refreshToolbarUI();
});

// --- Save / load --------------------------------------------------------------

function loadCreationsList() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCreationsList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable or full - the picture still exists on screen, it just won't be saved.
  }
}

function makeThumbnail() {
  const tmp = document.createElement('canvas');
  tmp.width = 220;
  tmp.height = 220;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 220, 220);
  tctx.drawImage(paintCanvas, 0, 0, 220, 220);
  tctx.drawImage(shapesCanvas, 0, 0, 220, 220);
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

document.getElementById('saveBtn').addEventListener('click', () => {
  const list = loadCreationsList();
  const entry = {
    id: creationId || 'c' + Date.now(),
    thumbnailDataURL: makeThumbnail(),
    shapes,
    paintDataURL: paintCanvas.toDataURL('image/png'),
    updatedAt: Date.now(),
  };
  const existingIdx = list.findIndex((c) => c.id === entry.id);
  if (existingIdx > -1) list[existingIdx] = entry;
  else list.unshift(entry);
  while (list.length > MAX_SAVED) list.pop();
  saveCreationsList(list);
  creationId = entry.id;
  launchConfetti();
  playSuccessChime();
});

function loadExistingCreation() {
  if (!creationId) return;
  const entry = loadCreationsList().find((c) => c.id === creationId);
  if (!entry) {
    creationId = null;
    return;
  }
  shapes = entry.shapes.map((s) => ({ ...s }));
  nextShapeId = shapes.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  renderShapes();
  if (entry.paintDataURL) {
    const img = new Image();
    img.onload = () => paintCtx.drawImage(img, 0, 0, SIZE, SIZE);
    img.src = entry.paintDataURL;
  }
}

buildPalette();
buildBrushStyles();
buildShapePalette();
setTool('brush');
initMusicToggle(document.getElementById('musicBtn'));
loadExistingCreation();
renderShapes();
