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

// Games reuse the single music on/off preference as one master "sound" switch -
// muting silences ambient music, game sound effects, and speech together.
export function isSoundOn() {
  return isMusicOn();
}

// A quick, satisfying "pop" for popping a balloon.
export function playPop() {
  if (!isSoundOn()) return;
  ensureContext();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(650 + Math.random() * 200, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.12);
  gain.gain.setValueAtTime(0.5, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + 0.16);
}

// A single bright "snap" for a piece landing in the right place.
export function playSnap() {
  if (!isSoundOn()) return;
  ensureContext();
  pluckNote(880, ctx.currentTime, 0.55, 0.35);
}

// A soft, gentle nudge for a wrong tap - deliberately NOT a buzzer, never punishing.
export function playTryAgain() {
  if (!isSoundOn()) return;
  ensureContext();
  const t0 = ctx.currentTime;
  pluckNote(392, t0, 0.22, 0.3);
  pluckNote(330, t0 + 0.16, 0.2, 0.32);
}

let cachedVoice = null;
let voicesReady = false;
function pickVoice() {
  if (!window.speechSynthesis) return null;
  if (voicesReady) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  voicesReady = true;
  cachedVoice =
    voices.find((v) => /^en/i.test(v.lang) && /female|child|samantha|victoria|zira/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0];
  return cachedVoice;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voicesReady = false;
    pickVoice();
  };
}

// Speaks a short prompt/praise aloud for kids who can't read yet. Silently does nothing
// if sound is muted or the browser has no speech support - games stay playable either way.
export function speak(text) {
  if (!isSoundOn() || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // don't let prompts stack up over each other
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.15;
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch {
    // Speech synthesis blocked or unsupported - games still work visually.
  }
}
