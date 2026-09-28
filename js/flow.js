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

export const REWARD_KEYS = Object.freeze([
  'introLead', 'introPromise', 'introHot', 'introTail',
  'readyMain', 'readyHot', 'readyPlay',
  'boxTitle', 'boxHint', 'boxOpen',
  'rewardTitle', 'rewardPlaces', 'rewardCollect', 'rewardFriends', 'rewardChatTitle', 'rewardChatNote', 'rewardChatLock', 'rewardChat', 'rewardScore',
]);

export function pickFlow(theme) {
  return theme?.flow === 'reward' ? 'reward' : 'classic';
}

export function introPlan({ seen, reducedMotion }) {
  return seen || reducedMotion ? INTRO_STEPS.slice(-1) : [...INTRO_STEPS];
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
