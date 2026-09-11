// Local (per-browser) progress storage. No account/backend involved.
import { PICTURES } from './pictures.js';

const KEY = 'kidscolor_progress_v1';

function defaultState() {
  return { unlockedIndex: 0, pictures: {} };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (typeof parsed.unlockedIndex !== 'number' || typeof parsed.pictures !== 'object') {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveProgress(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private browsing etc.) - progress just won't persist.
  }
}

export function isUnlocked(state, id) {
  const idx = PICTURES.findIndex((p) => p.id === id);
  return idx > -1 && idx <= state.unlockedIndex;
}

export function isCompleted(state, id) {
  return !!state.pictures[id]?.completed;
}

export function markCompleted(state, id, thumbnailDataURL) {
  const idx = PICTURES.findIndex((p) => p.id === id);
  state.pictures[id] = { completed: true, thumbnailDataURL, updatedAt: Date.now() };
  if (idx > -1 && idx + 1 > state.unlockedIndex) {
    state.unlockedIndex = Math.min(idx + 1, PICTURES.length - 1);
  }
  saveProgress(state);
  return state;
}

export function resetProgress() {
  saveProgress(defaultState());
}
