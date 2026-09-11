import { PICTURES } from './pictures.js';
import { loadProgress, isUnlocked, isCompleted } from './progress.js';

const state = loadProgress();
const grid = document.getElementById('grid');

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
