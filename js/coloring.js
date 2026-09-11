import { PICTURES, pictureIndex } from './pictures.js';
import { loadProgress, isUnlocked, markCompleted } from './progress.js';
import { initMusicToggle, playSuccessChime } from './audio.js';

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
document.title = `${picture.title} - Let Us Doodle`;

const stage = document.getElementById('stage');
const canvasWrap = document.querySelector('.canvas-wrap');
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
let strokeRegionMaskCanvas = null; // clips the current brush stroke to the enclosed region it started in
let pendingSingleTouch = null; // holds a touch briefly in case a 2nd finger joins it as a pinch
const undoStack = [];

const SCRATCH = 300; // generous padding around the largest possible brush stamp
const SCRATCH_C = SCRATCH / 2;
const scratchCanvas = document.createElement('canvas');
scratchCanvas.width = SCRATCH;
scratchCanvas.height = SCRATCH;
const scratchCtx = scratchCanvas.getContext('2d');

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
// Two fingers on the picture always pan/zoom it (never the whole page); one finger always
// uses the current tool. This tracks every active touch so we can tell the two apart.
const activePointers = new Map(); // pointerId -> {x, y}
let panStart = null; // {midX, midY, panX, panY}
let pinchStartDist = null;
let pinchStartZoom = null;

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

// Traces every pixel reachable from (startX, startY) without crossing blockedMask -
// the same "enclosed region" both the fill tool and the brush's spill-proofing use.
function computeConnectedRegion(startX, startY) {
  const idxPx = startY * SIZE + startX;
  if (!blockedMask || blockedMask[idxPx]) return null;

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

  return visited;
}

function regionToMaskCanvas(visited) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    imgData.data[i * 4 + 3] = visited[i] ? 255 : 0;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function floodFill(startX, startY, colorHex) {
  const visited = computeConnectedRegion(startX, startY);
  if (!visited) return;

  const [r, g, b] = hexToRgb(colorHex);
  const imageData = paintCtx.getImageData(0, 0, SIZE, SIZE);
  const data = imageData.data;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!visited[i]) continue;
    const p = i * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = 255;
  }
  paintCtx.putImageData(imageData, 0, 0);
}

// Draws one brush stamp on a small scratch canvas (so it keeps its natural anti-aliased
// edges), then - if the current stroke is clipped to an enclosed region - erases whatever
// falls outside that region before compositing onto the real paint layer. This is what
// stops a stroke from spilling across a line into a neighbouring area.
function stampBrush(x, y) {
  const r = (brushSize * currentBrush.sizeMul) / 2;

  scratchCtx.clearRect(0, 0, SCRATCH, SCRATCH);
  scratchCtx.globalAlpha = currentBrush.alpha;
  if (currentBrush.texture === 'grain') {
    scratchCtx.globalAlpha = currentBrush.alpha * (0.75 + Math.random() * 0.25);
  }
  scratchCtx.fillStyle = currentColor;
  scratchCtx.beginPath();
  scratchCtx.arc(SCRATCH_C, SCRATCH_C, r, 0, Math.PI * 2);
  scratchCtx.fill();

  if (currentBrush.texture === 'sparkle' && Math.random() < 0.5) {
    scratchCtx.globalAlpha = 0.9;
    scratchCtx.fillStyle = '#ffffff';
    const sx = SCRATCH_C + (Math.random() - 0.5) * r * 1.4;
    const sy = SCRATCH_C + (Math.random() - 0.5) * r * 1.4;
    scratchCtx.beginPath();
    scratchCtx.arc(sx, sy, Math.max(1.5, r * 0.12), 0, Math.PI * 2);
    scratchCtx.fill();
  }
  scratchCtx.globalAlpha = 1;

  if (strokeRegionMaskCanvas) {
    scratchCtx.globalCompositeOperation = 'destination-in';
    scratchCtx.drawImage(
      strokeRegionMaskCanvas,
      x - SCRATCH_C, y - SCRATCH_C, SCRATCH, SCRATCH,
      0, 0, SCRATCH, SCRATCH
    );
    scratchCtx.globalCompositeOperation = 'source-over';
  }

  paintCtx.drawImage(scratchCanvas, x - SCRATCH_C, y - SCRATCH_C);
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

function applyTransform() {
  canvasWrap.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
}

function clampPan() {
  const maxX = (canvasWrap.clientWidth * (zoomLevel - 1)) / 2;
  const maxY = (canvasWrap.clientHeight * (zoomLevel - 1)) / 2;
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
}

function setZoom(z) {
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  clampPan();
  applyTransform();
  document.getElementById('zoomLevelLabel').textContent = Math.round(zoomLevel * 100) + '%';
}

function beginPinch() {
  const pts = Array.from(activePointers.values());
  if (pts.length < 2) return;
  pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  pinchStartZoom = zoomLevel;
  panStart = {
    midX: (pts[0].x + pts[1].x) / 2,
    midY: (pts[0].y + pts[1].y) / 2,
    panX,
    panY,
  };
}

function updatePinch() {
  const pts = Array.from(activePointers.values());
  if (pts.length < 2 || !panStart) return;
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  if (pinchStartDist) zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom * (dist / pinchStartDist)));
  const midX = (pts[0].x + pts[1].x) / 2;
  const midY = (pts[0].y + pts[1].y) / 2;
  panX = panStart.panX + (midX - panStart.midX);
  panY = panStart.panY + (midY - panStart.midY);
  clampPan();
  applyTransform();
  document.getElementById('zoomLevelLabel').textContent = Math.round(zoomLevel * 100) + '%';
}

function toCanvasCoords(evt) {
  const rect = paintCanvas.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * SIZE;
  const y = ((evt.clientY - rect.top) / rect.height) * SIZE;
  return [Math.max(0, Math.min(SIZE - 1, Math.round(x))), Math.max(0, Math.min(SIZE - 1, Math.round(y)))];
}

// Commits a touch that was being held to see if it would turn into a pinch - either the
// hold timed out, it moved enough to clearly be a stroke, or it lifted before either happened.
function commitPendingTouch(pending) {
  clearTimeout(pending.timer);
  if (pendingSingleTouch === pending) pendingSingleTouch = null;
  pushUndo();
  if (currentTool === 'fill') {
    floodFill(pending.x, pending.y, currentColor);
  } else {
    drawing = true;
    lastPt = [pending.x, pending.y];
    const region = computeConnectedRegion(pending.x, pending.y);
    strokeRegionMaskCanvas = region ? regionToMaskCanvas(region) : null;
    stampBrush(pending.x, pending.y);
  }
}

function onPointerDown(evt) {
  evt.preventDefault();
  try {
    paintCanvas.setPointerCapture(evt.pointerId);
  } catch {
    // Some environments (or synthetic events) don't have an active pointer to capture; safe to ignore.
  }

  activePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });

  if (activePointers.size >= 2) {
    // A second finger just landed - hand off to pinch/pan and abandon any in-progress stroke,
    // including one that was only tentatively pending (not yet committed to paint).
    if (pendingSingleTouch) {
      clearTimeout(pendingSingleTouch.timer);
      pendingSingleTouch = null;
    }
    drawing = false;
    lastPt = null;
    strokeRegionMaskCanvas = null;
    beginPinch();
    return;
  }

  const [x, y] = toCanvasCoords(evt);

  if (evt.pointerType !== 'touch') {
    // Mouse/pen can't pinch, so there's nothing to disambiguate - act immediately as before.
    pushUndo();
    if (currentTool === 'fill') {
      floodFill(x, y, currentColor);
    } else {
      drawing = true;
      lastPt = [x, y];
      const region = computeConnectedRegion(x, y);
      strokeRegionMaskCanvas = region ? regionToMaskCanvas(region) : null;
      stampBrush(x, y);
    }
    return;
  }

  // A single finger touched down: hold off very briefly in case a second finger is about to
  // join it as a pinch, so a pinch never leaves a stray dot at its starting point.
  const pending = { pointerId: evt.pointerId, x, y, clientX: evt.clientX, clientY: evt.clientY, timer: null };
  pending.timer = setTimeout(() => commitPendingTouch(pending), 50);
  pendingSingleTouch = pending;
}

function onPointerMove(evt) {
  if (pendingSingleTouch && pendingSingleTouch.pointerId === evt.pointerId && activePointers.size === 1) {
    const moved = Math.hypot(evt.clientX - pendingSingleTouch.clientX, evt.clientY - pendingSingleTouch.clientY);
    if (moved > 4) commitPendingTouch(pendingSingleTouch);
  }

  if (activePointers.has(evt.pointerId)) {
    activePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
  }

  if (activePointers.size >= 2) {
    evt.preventDefault();
    updatePinch();
    return;
  }

  if (!drawing || currentTool !== 'brush') return;
  evt.preventDefault();
  const [x, y] = toCanvasCoords(evt);
  brushLine(lastPt[0], lastPt[1], x, y);
  lastPt = [x, y];
}

function onPointerUp(evt) {
  if (pendingSingleTouch && pendingSingleTouch.pointerId === evt.pointerId) {
    commitPendingTouch(pendingSingleTouch); // lifted before the hold finished - treat as a tap
  }

  activePointers.delete(evt.pointerId);

  if (activePointers.size >= 2) {
    beginPinch(); // keep pinching smoothly with whichever two fingers remain
    return;
  }

  drawing = false;
  lastPt = null;
  strokeRegionMaskCanvas = null;
  pinchStartDist = null;
  panStart = null;
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

// Pinch (or two-finger drag) on the picture always zooms/pans it - see onPointerDown/Move/Up.
// These +/- buttons are the mouse/accessibility-friendly equivalent, always available.
stage.addEventListener('gesturestart', (evt) => evt.preventDefault()); // legacy Safari pinch gesture
document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoomLevel + 0.25));
document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoomLevel - 0.25));

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
  playSuccessChime();
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
initMusicToggle(document.getElementById('musicBtn'));
loadPictureMaskAndOutline().catch((err) => {
  console.error(err);
  document.getElementById('picTitle').textContent = 'Could not load picture 😢';
});
