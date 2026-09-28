import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFlow, INTRO_STEPS, introPlan, createSequencer, createBoxState } from '../js/flow.js';
import { pickTheme } from '../js/themes.js';

// Manual clock: schedule() queues callbacks, tick() runs the next one.
function fakeClock() {
  const queue = [];
  let id = 0;
  return {
    schedule: (fn, ms) => { queue.push({ id: ++id, fn, ms }); return id; },
    cancel: (handle) => { const i = queue.findIndex((q) => q.id === handle); if (i >= 0) queue.splice(i, 1); },
    tick: () => { const next = queue.shift(); if (next) next.fn(); return next; },
    pending: () => queue.length,
  };
}

test('pickFlow uses the reward flow only for themes that opt in', () => {
  assert.equal(pickFlow(null), 'classic');
  assert.equal(pickFlow({ id: 'x' }), 'classic');
  assert.equal(pickFlow(pickTheme('itu')), 'reward');
});

test('intro ends on a terminal ready step that waits for a click', () => {
  const last = INTRO_STEPS[INTRO_STEPS.length - 1];
  assert.deepEqual(last, { id: 'ready', ms: 0 });
  assert.deepEqual(INTRO_STEPS.map((s) => s.id), ['mystery', 'swirl', 'scribble', 'brand', 'promise', 'ready']);
  INTRO_STEPS.slice(0, -1).forEach((s) => assert.ok(s.ms > 0, `${s.id} needs a duration`));
});

test('introPlan skips straight to ready for returning visitors and reduced motion', () => {
  assert.equal(introPlan({ seen: false, reducedMotion: false }).length, INTRO_STEPS.length);
  assert.deepEqual(introPlan({ seen: true, reducedMotion: false }).map((s) => s.id), ['ready']);
  assert.deepEqual(introPlan({ seen: false, reducedMotion: true }).map((s) => s.id), ['ready']);
});

test('sequencer walks every step in order and stops at the terminal step', () => {
  const clock = fakeClock();
  const seen = [];
  const seq = createSequencer({ steps: INTRO_STEPS, onStep: (id) => seen.push(id), ...clock });
  seq.start();
  while (clock.tick());
  assert.deepEqual(seen, INTRO_STEPS.map((s) => s.id));
  assert.equal(seq.current(), 'ready');
  assert.equal(clock.pending(), 0);
});

test('skip jumps to ready once and cancels pending timers', () => {
  const clock = fakeClock();
  const seen = [];
  const seq = createSequencer({ steps: INTRO_STEPS, onStep: (id) => seen.push(id), ...clock });
  seq.start();
  seq.skip();
  seq.skip();
  assert.deepEqual(seen, ['mystery', 'ready']);
  assert.equal(clock.pending(), 0);
});

test('skip after the intro finished does nothing', () => {
  const clock = fakeClock();
  const seen = [];
  const seq = createSequencer({ steps: introPlan({ seen: true, reducedMotion: false }), onStep: (id) => seen.push(id), ...clock });
  seq.start();
  seq.skip();
  assert.deepEqual(seen, ['ready']);
});

test('box opens exactly once no matter how often it is tapped', () => {
  const box = createBoxState();
  assert.equal(box.state(), 'closed');
  assert.equal(box.tap(), true);
  assert.equal(box.tap(), false);
  assert.equal(box.state(), 'opening');
  assert.equal(box.opened(), true);
  assert.equal(box.opened(), false);
  assert.equal(box.tap(), false);
  assert.equal(box.state(), 'open');
});
