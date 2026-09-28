// DOM side of the reward flow (logic in flow.js).

import { createSequencer, createBoxState } from './flow.js';

const BOX_OPEN_MS = 1100; // shake (0.6 s) + lid/burst (0.5 s), matches reward.css

export function playIntro({ root, steps, onStep = () => {} }) {
  const seq = createSequencer({
    steps,
    onStep: (id) => {
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

export function openBoxScreen({ root, button, onOpened, openMs = BOX_OPEN_MS }) {
  const box = createBoxState();
  root.classList.remove('is-opening', 'is-open');
  // onclick (not addEventListener): each round gets a fresh box state instead
  // of stacking one more listener per game.
  button.onclick = () => {
    if (!box.tap()) return;
    root.classList.add('is-opening');
    if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
    setTimeout(() => {
      if (!box.opened()) return;
      root.classList.add('is-open');
      onOpened();
    }, openMs);
  };
}
