// DOM side of the reward flow (logic in flow.js, durations/texts in reward-config.js).

import { createSequencer, createBoxState } from './flow.js';
import { REWARD_CONFIG } from './reward-config.js';

const SPARKS = 14; // particles in the box's light burst
const HAPTIC_OPEN = [15, 30, 25, 30, 40, 30, 90]; // builds up with the shake, big thump on the burst

export function playIntro({ root, steps, onStep = () => {} }) {
  const seq = createSequencer({
    steps,
    onStep: (id) => {
      // CSS reads the step's duration so animations stay in sync with the config.
      const ms = steps.find((s) => s.id === id)?.ms || 0;
      root.style.setProperty('--step-ms', `${ms}ms`);
      root.dataset.step = id;
      onStep(id);
    },
  });
  // Tap anywhere (except the BAŞLA button) skips to the ready screen.
  root.addEventListener('click', (e) => {
    if (!e.target.closest('button')) seq.skip();
  });
  seq.start();
  return seq;
}

// Particles are built once; each spark flies out at its own angle (--a).
function ensureSparks(root) {
  const host = root.querySelector('.box-sparks');
  if (!host || host.childElementCount) return;
  host.append(...Array.from({ length: SPARKS }, (_, i) => {
    const el = document.createElement('span');
    el.className = 'box-spark';
    el.style.setProperty('--a', `${(360 / SPARKS) * i + (i % 2) * 9}deg`);
    el.style.setProperty('--d', `${70 + (i % 3) * 30}px`);
    return el;
  }));
}

export function openBoxScreen({ root, button, onOpened, openMs = REWARD_CONFIG.boxOpenMs }) {
  const box = createBoxState();
  ensureSparks(root);
  root.style.setProperty('--open-ms', `${openMs}ms`);
  root.classList.remove('is-opening', 'is-open');
  // onclick (not addEventListener): each round gets a fresh box state instead
  // of stacking one more listener per game.
  button.onclick = () => {
    if (!box.tap()) return;
    root.classList.add('is-opening');
    if (navigator.vibrate) navigator.vibrate(HAPTIC_OPEN);
    setTimeout(() => {
      if (!box.opened()) return;
      root.classList.add('is-open');
      onOpened();
    }, openMs);
  };
}

function placeCard(place) {
  const card = document.createElement('li');
  card.className = 'place-card';
  const logo = document.createElement(place.img ? 'img' : 'span');
  logo.className = 'place-logo';
  if (place.img) {
    logo.src = place.img;
    logo.alt = '';
  } else {
    logo.textContent = place.monogram;
    logo.style.background = place.bg;
  }
  const name = document.createElement('b');
  name.textContent = place.name;
  card.append(logo, name);
  return card;
}

export function renderReward({ avatarsEl, placesEl, scoreEl, scoreText }) {
  avatarsEl.replaceChildren(...REWARD_CONFIG.avatars.map((a) => {
    const el = document.createElement('span');
    el.style.background = a.bg;
    el.textContent = a.emoji;
    return el;
  }));
  placesEl.replaceChildren(...REWARD_CONFIG.restaurants.map(placeCard));
  scoreEl.textContent = scoreText;
}
