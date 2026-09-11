import { PICTURES } from './pictures.js';
import { loadProgress, isUnlocked, isCompleted } from './progress.js';
import { initMusicToggle } from './audio.js';

const state = loadProgress();
const grid = document.getElementById('grid');

initMusicToggle(document.getElementById('musicBtn'));

const doneCount = PICTURES.filter((p) => isCompleted(state, p.id)).length;
document.getElementById('progressText').textContent = `${doneCount} of ${PICTURES.length} colored`;
document.getElementById('progressBar').style.width = `${(doneCount / PICTURES.length) * 100}%`;

if (new URLSearchParams(location.search).get('finished') === '1') {
  document.getElementById('banner').classList.add('show');
  document.getElementById('banner').textContent = "🎉 You colored every picture! Amazing job! 🎉";
}

PICTURES.forEach((pic) => {
  const unlocked = isUnlocked(state, pic.id);
  const completed = isCompleted(state, pic.id);
  const thumb = state.pictures[pic.id]?.thumbnailDataURL;

  const card = document.createElement(unlocked ? 'a' : 'div');
  card.className = 'card' + (unlocked ? '' : ' locked') + (completed ? ' completed' : '');
  if (unlocked) card.href = `color.html?id=${encodeURIComponent(pic.id)}`;

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-thumb';

  if (thumb) {
    const img = document.createElement('img');
    img.src = thumb;
    img.alt = pic.title;
    imgWrap.appendChild(img);
  } else {
    const img = document.createElement('img');
    img.src = pic.svg;
    img.alt = pic.title;
    img.className = 'outline-preview';
    imgWrap.appendChild(img);
  }

  if (!unlocked) {
    const lock = document.createElement('div');
    lock.className = 'lock-badge';
    lock.textContent = '🔒';
    imgWrap.appendChild(lock);
  } else if (completed) {
    const check = document.createElement('div');
    check.className = 'check-badge';
    check.textContent = '✓';
    imgWrap.appendChild(check);
  }

  const label = document.createElement('div');
  label.className = 'card-label';
  label.textContent = pic.title;

  const themeTag = document.createElement('div');
  themeTag.className = 'card-theme';
  themeTag.textContent = pic.theme;

  card.appendChild(imgWrap);
  card.appendChild(label);
  card.appendChild(themeTag);
  grid.appendChild(card);
});

const CREATIONS_KEY = 'kidscolor_creations';

function loadCreations() {
  try {
    return JSON.parse(localStorage.getItem(CREATIONS_KEY)) || [];
  } catch {
    return [];
  }
}

function renderCreations() {
  const list = loadCreations();
  const section = document.getElementById('creationsSection');
  const strip = document.getElementById('creationsStrip');
  strip.innerHTML = '';
  if (!list.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  list.forEach((creation) => {
    const card = document.createElement('a');
    card.className = 'creation-card';
    card.href = `create.html?id=${encodeURIComponent(creation.id)}`;

    const img = document.createElement('img');
    img.src = creation.thumbnailDataURL;
    img.alt = 'My creation';
    card.appendChild(img);

    const del = document.createElement('button');
    del.className = 'creation-delete';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete this creation');
    del.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const updated = loadCreations().filter((c) => c.id !== creation.id);
      localStorage.setItem(CREATIONS_KEY, JSON.stringify(updated));
      renderCreations();
    });
    card.appendChild(del);

    strip.appendChild(card);
  });
}

renderCreations();
