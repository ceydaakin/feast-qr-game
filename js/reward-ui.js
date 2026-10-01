// DOM side of the reward flow (logic in flow.js, durations/texts in reward-config.js).

import { createSequencer, createBoxState } from './flow.js';
import { REWARD_CONFIG } from './reward-config.js';

const SPARKS = 14; // particles in the box's light burst
const HAPTIC_OPEN = [15, 30, 25, 30, 40, 30, 90]; // builds up with the shake, big thump on the burst

// Two interleaved Archimedean spiral arms (ink + feast red) in a 200×200 box.
// Built once as an SVG string: crisp at any size, one GPU layer to rotate.
const SPIRAL_TURNS = 8;
function spiralSvg() {
  const arm = (phase) => {
    const end = SPIRAL_TURNS * Math.PI * 2;
    const pts = [];
    for (let a = 0; a <= end; a += 0.12) {
      const r = (a / end) * 100;
      pts.push(`${(100 + r * Math.cos(a + phase)).toFixed(2)},${(100 + r * Math.sin(a + phase)).toFixed(2)}`);
    }
    return `M${pts.join('L')}`;
  };
  const w = (100 / SPIRAL_TURNS / 2) * 0.46; // each arm fills ~half the gap to the next
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round">`
    + `<path d="${arm(0)}" stroke="#3a1d10" stroke-width="${w.toFixed(2)}"/>`
    + `<path d="${arm(Math.PI)}" stroke="#ff3131" stroke-width="${w.toFixed(2)}"/></svg>`;
}

function ensureSpiral(root) {
  const host = root.querySelector('.intro-vortex-spin');
  if (host && !host.childElementCount) host.innerHTML = spiralSvg();
}

// Background of the BAŞLA screen: the questions feast answers, as faint
// speech bubbles drifting around the edges. Positions live in reward.css.
function ensureBubbles(root, lines) {
  const host = root.querySelector('.ready-bubbles');
  if (!host || host.childElementCount || !Array.isArray(lines)) return;
  host.append(...lines.map((text) => {
    const el = document.createElement('span');
    el.className = 'ready-bubble';
    el.textContent = text;
    return el;
  }));
}

export function playIntro({ root, steps, onStep = () => {}, bubbles = [] }) {
  ensureSpiral(root);
  ensureBubbles(root, bubbles);
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
  // Keyboard: Enter / Space / Escape skip too, then BAŞLA gets focus.
  const onKey = (e) => {
    if (!root.classList.contains('is-active') || seq.current() === 'ready') return;
    if (!['Enter', ' ', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    seq.skip();
    root.querySelector('[data-frame="ready"] button')?.focus();
  };
  document.addEventListener('keydown', onKey);
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

// The download page only shows the score now; avatars / restaurant cards are
// still filled if a layout includes those elements again.
export function renderReward({ avatarsEl = null, placesEl = null, scoreEl, scoreText }) {
  avatarsEl?.replaceChildren(...REWARD_CONFIG.avatars.map((a) => {
    const el = document.createElement('span');
    el.style.background = a.bg;
    el.textContent = a.emoji;
    return el;
  }));
  placesEl?.replaceChildren(...REWARD_CONFIG.restaurants.map(placeCard));
  scoreEl.textContent = scoreText;
}
