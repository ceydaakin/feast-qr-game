// DOM side of the reward flow (logic in flow.js).

import { createSequencer } from './flow.js';

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
