// Registry of all games, plus a light, non-gating "stars earned" counter per game.
export const GAMES = [
  { id: 'memory', title: 'Memory Match', icon: '🧠', tagline: 'Find the matching pairs', page: 'game-memory.html' },
  { id: 'balloons', title: 'Pop the Balloons', icon: '🎈', tagline: 'Pop balloons and colours', page: 'game-balloons.html' },
  { id: 'shapes', title: 'Shape Sorter', icon: '⭐', tagline: 'Match shapes to their spot', page: 'game-shapes.html' },
  { id: 'counting', title: 'Counting Garden', icon: '🐞', tagline: 'Count the bugs and flowers', page: 'game-counting.html' },
  { id: 'alphabet', title: 'Alphabet Pop', icon: '🔤', tagline: 'Learn letters A to Z', page: 'game-alphabet.html' },
  { id: 'colors', title: 'Colour Splash', icon: '🎨', tagline: 'Find the colour', page: 'game-colors.html' },
  { id: 'animals', title: 'Animal Flashcards', icon: '🐾', tagline: 'Meet the animals', page: 'game-animals.html' },
];

const STARS_KEY = 'kidscolor_game_stars';

function loadStars() {
  try {
    return JSON.parse(localStorage.getItem(STARS_KEY)) || {};
  } catch {
    return {};
  }
}

export function getStars(gameId) {
  return loadStars()[gameId] || 0;
}

export function addStar(gameId) {
  const all = loadStars();
  all[gameId] = (all[gameId] || 0) + 1;
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable - the star just won't be remembered, gameplay is unaffected.
  }
  return all[gameId];
}
