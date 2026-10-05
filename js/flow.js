// Reward flow (Osman's sketch): timed intro → "45 sn dayan, ödülü al" → game →
// mystery box → reward screen. Pure logic so it is unit-tested in Node; DOM
// lives in reward-ui.js; durations and texts in reward-config.js.

import { REWARD_CONFIG } from './reward-config.js';

const { timings } = REWARD_CONFIG;

export const INTRO_STEPS = Object.freeze([
  { id: 'mystery', ms: timings.mystery },
  { id: 'swirl', ms: timings.swirl },
  { id: 'scribble', ms: timings.scribble },
  { id: 'brand', ms: timings.brand },
  { id: 'promise', ms: timings.promise },
  { id: 'ready', ms: 0 }, // terminal: waits for the BAŞLA click
]);

// Explainer between the box and the prize page; 'done' is terminal (→ prize).
export const EXPLAINER_STEPS = Object.freeze([
  ...Object.entries(REWARD_CONFIG.explainer).map(([id, ms]) => ({ id, ms })),
  { id: 'done', ms: 0 },
]);

export const REWARD_KEYS = Object.freeze([
  'introLead', 'introPromise', 'introHot', 'introTail',
  'readyMain', 'readyHot', 'readyPlay', 'readyBubbles',
  'boxTitle', 'boxHint', 'boxOpen',
  'exHook', 'exSlogan', 'exMap', 'exReels', 'exSticker', 'exSeeMap', 'exFriends', 'exChat',
  'rewardTitle', 'rewardSub', 'rewardTerms', 'rewardDownload', 'rewardTagline', 'rewardPlaceCampus', 'rewardMore',
  'retryTitle', 'retrySub', 'retryButton', 'retryTip', 'rewardScore',
]);

// The spiral intro plays on every visit (tap skips it). Only visitors who
// asked their device for reduced motion go straight to BAŞLA.
export function introPlan({ reducedMotion }) {
  return reducedMotion ? INTRO_STEPS.slice(-1) : [...INTRO_STEPS];
}

export function createSequencer({ steps, onStep, schedule = setTimeout, cancel = clearTimeout }) {
  let index = -1;
  let timer = null;
  const last = steps.length - 1;
  const go = (i) => {
    index = i;
    timer = null;
    onStep(steps[i].id);
    if (i < last) timer = schedule(() => go(i + 1), steps[i].ms);
  };
  return {
    start: () => go(0),
    skip: () => {
      if (index === last) return;
      if (timer !== null) cancel(timer);
      go(last);
    },
    current: () => (index >= 0 ? steps[index].id : null),
  };
}

export function createBoxState() {
  let state = 'closed';
  return {
    state: () => state,
    tap: () => {
      if (state !== 'closed') return false;
      state = 'opening';
      return true;
    },
    opened: () => {
      if (state !== 'opening') return false;
      state = 'open';
      return true;
    },
  };
}
