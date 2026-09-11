import { GAMES, getStars } from './gamesData.js';
import { initMusicToggle } from './audio.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'index.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const grid = document.getElementById('gamesGrid');

GAMES.forEach((game) => {
  const card = document.createElement('a');
  card.className = 'card game-card';
  card.href = game.page;

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-thumb game-thumb';
  imgWrap.textContent = game.icon;

  const stars = getStars(game.id);
  if (stars > 0) {
    const badge = document.createElement('div');
    badge.className = 'check-badge star-badge';
    badge.textContent = `⭐${stars}`;
    imgWrap.appendChild(badge);
  }

  const label = document.createElement('div');
  label.className = 'card-label';
  label.textContent = game.title;

  const tagline = document.createElement('div');
  tagline.className = 'card-theme';
  tagline.textContent = game.tagline;

  card.appendChild(imgWrap);
  card.appendChild(label);
  card.appendChild(tagline);
  grid.appendChild(card);
});
