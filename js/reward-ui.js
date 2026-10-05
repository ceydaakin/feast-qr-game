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

// ---------- "feast nedir?" explainer ----------
const span = (text, className = '') => {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = text;
  return el;
};

// Copy, reels and chat are filled once; the scenes are CSS on data-step.
function fillExplainer(root, t) {
  if (root.dataset.filled) return;
  root.dataset.filled = '1';
  // Hook: one word per beat (hard cuts, --i drives the delay).
  root.querySelector('.ex-hook').append(...t('exHook').split(' ').map((w, i) => {
    const el = span(w);
    el.style.setProperty('--i', i);
    return el;
  }));
  root.querySelector('.ex-words').append(...t('exSlogan').map((w) => span(w)));
  root.querySelector('.ex-reel-track').append(...REWARD_CONFIG.reels.map((r) => {
    const reel = document.createElement('div');
    reel.className = 'ex-reel';
    const img = document.createElement('img');
    img.src = r.img;
    img.alt = '';
    const info = document.createElement('div');
    info.className = 'ex-reel-info';
    info.append(span(r.name, 'ex-reel-name'), span(`₺${r.price}`, 'ex-reel-price'), span(t('exSeeMap'), 'ex-reel-btn'));
    const side = document.createElement('div');
    side.className = 'ex-reel-side';
    side.append(span('♥', 'ex-like'), span('💬'), span('➤'));
    reel.append(img, info, side);
    return reel;
  }));
  const chat = t('exChat');
  root.querySelectorAll('.ex-msg:not(.ex-share)').forEach((el, i) => { el.textContent = chat[i] ?? ''; });
}

// Re-trigger a one-shot CSS animation (camera punch, white flash) on every cut.
function restart(el, className) {
  el.classList.remove(className);
  void el.offsetWidth; // reflow so the animation starts again
  el.classList.add(className);
}

// Plays the scenes from EXPLAINER_STEPS, then calls onDone once. No skipping:
// it runs its 8 s like a video.
export function playExplainer({ root, steps, t, onDone }) {
  fillExplainer(root, t);
  const bars = [...root.querySelectorAll('.ex-progress i')];
  const cam = root.querySelector('.ex-cam');
  const flash = root.querySelector('.ex-flash');
  const seq = createSequencer({
    steps,
    onStep: (id) => {
      if (id === 'done') {
        onDone();
        return;
      }
      const i = steps.findIndex((s) => s.id === id);
      root.style.setProperty('--step-ms', `${steps[i].ms}ms`);
      root.dataset.step = id;
      restart(cam, 'is-cut');
      restart(flash, 'is-cut');
      bars.forEach((bar, j) => {
        bar.classList.toggle('is-done', j < i);
        bar.classList.toggle('is-on', j === i);
      });
    },
  });
  seq.start();
  return seq;
}
