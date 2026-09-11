import { PICTURES } from './pictures.js';
import { initMusicToggle, speak } from './audio.js';
import { addStar } from './gamesData.js';

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = 'games.html';
});
initMusicToggle(document.getElementById('musicBtn'));

const ANIMAL_IDS = ['cat', 'dog', 'fish', 'butterfly', 'elephant', 'owl', 'turtle'];
const animals = ANIMAL_IDS.map((id) => PICTURES.find((p) => p.id === id)).filter(Boolean);

const cardImg = document.getElementById('cardImg');
const cardLabel = document.getElementById('cardLabel');

let index = 0;
const seen = new Set();

function announce() {
  speak(`This is a ${animals[index].title}!`);
}

function showCard() {
  const a = animals[index];
  cardImg.src = a.svg;
  cardImg.alt = a.title;
  cardLabel.textContent = a.title;
  announce();
  seen.add(a.id);
  if (seen.size % 3 === 0) addStar('animals');
}

document.getElementById('prevBtn').addEventListener('click', () => {
  index = (index - 1 + animals.length) % animals.length;
  showCard();
});
document.getElementById('nextBtn').addEventListener('click', () => {
  index = (index + 1) % animals.length;
  showCard();
});
document.getElementById('repeatBtn').addEventListener('click', announce);
document.getElementById('flashcard').addEventListener('click', announce);

showCard();
