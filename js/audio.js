// All sound is synthesized with the Web Audio API - no audio files to host or license.
const STORAGE_KEY = 'kidscolor_music';
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 D5 E5 G5 A5 C6, no dissonant intervals

let ctx = null;
let masterGain = null;
let musicOn = false;
let noteTimer = null;
let resumeListenerAdded = false;

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.07;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function pluckNote(freq, time, peak, duration) {
  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  noteGain.gain.setValueAtTime(0, time);
  noteGain.gain.linearRampToValueAtTime(peak, time + 0.05);
  noteGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(noteGain);
  noteGain.connect(masterGain);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function scheduleNextAmbientNote() {
  if (!musicOn) return;
  const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
  pluckNote(freq, ctx.currentTime, 0.5, 1.7);
  noteTimer = setTimeout(scheduleNextAmbientNote, 900 + Math.random() * 900);
}

function startAmbientLoop() {
  ensureContext();
  clearTimeout(noteTimer);
  if (ctx.state === 'running') {
    scheduleNextAmbientNote();
  } else if (!resumeListenerAdded) {
    // Autoplay is blocked until a real tap/click happens on this page - resume then.
    resumeListenerAdded = true;
    const resumeOnGesture = () => {
      ensureContext();
      if (musicOn) scheduleNextAmbientNote();
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };
    window.addEventListener('pointerdown', resumeOnGesture, { once: true });
    window.addEventListener('keydown', resumeOnGesture, { once: true });
  }
}

function stopAmbientLoop() {
  clearTimeout(noteTimer);
}

export function isMusicOn() {
  return localStorage.getItem(STORAGE_KEY) === 'on';
}

export function setMusicOn(on) {
  musicOn = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage unavailable - the toggle just won't be remembered across pages.
  }
  if (on) {
    startAmbientLoop();
  } else {
    stopAmbientLoop();
  }
}

// Wires a button element up as the music on/off toggle and starts music if it was left on.
export function initMusicToggle(buttonEl) {
  musicOn = isMusicOn();
  updateButtonLabel(buttonEl, musicOn);
  if (musicOn) startAmbientLoop();

  buttonEl.addEventListener('click', () => {
    setMusicOn(!musicOn);
    updateButtonLabel(buttonEl, musicOn);
  });
}

function updateButtonLabel(el, on) {
  el.textContent = on ? '🔊' : '🔈';
  el.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
}

// A short, bright, ascending chime for finishing a picture.
export function playSuccessChime() {
  ensureContext();
  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => pluckNote(freq, t0 + i * 0.12, 0.6, 0.9));
}
