import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickFlow, INTRO_STEPS, introPlan, createSequencer, createBoxState, REWARD_KEYS,
} from '../js/flow.js';
import { pickTheme } from '../js/themes.js';
import { makeT } from '../js/i18n.js';
import { AVATARS } from '../js/reward-content.js';

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

test('every reward-flow string exists in Turkish and English for İTÜ', () => {
  assert.ok(REWARD_KEYS.length > 0);
  ['tr', 'en'].forEach((locale) => {
    const t = makeT(locale, pickTheme('itu').strings);
    REWARD_KEYS.forEach((key) => {
      const value = t(key);
      assert.notEqual(value, key, `${locale}.${key} missing`);
      assert.ok(Array.isArray(value) ? value.length : String(value).trim(), `${locale}.${key} empty`);
    });
  });
});

test('English reward copy is not silently the Turkish text', () => {
  const tr = makeT('tr', pickTheme('itu').strings);
  const en = makeT('en', pickTheme('itu').strings);
  REWARD_KEYS.forEach((key) => {
    assert.notDeepEqual(en(key), tr(key), `en.${key} falls back to Turkish`);
  });
});

test('reward avatars are placeholders with a background and an emoji', () => {
  assert.ok(AVATARS.length >= 4 && AVATARS.length <= 8);
  AVATARS.forEach((a) => {
    assert.match(a.bg, /^#[0-9a-f]{6}$/i);
    assert.ok(a.emoji.length > 0);
  });
});

test('reward chat preview has short example lines in both languages', () => {
  ['tr', 'en'].forEach((locale) => {
    const chat = makeT(locale, pickTheme('itu').strings)('rewardChat');
    assert.ok(chat.length >= 2 && chat.length <= 4);
    chat.forEach((line) => assert.ok(line.from && line.text.length <= 70, `${locale}: "${line.text}" too long`));
  });
});

// The page cannot know who the visitor's friends are, so the reward copy must
// not state as fact that they are already on feast (fabricated social proof).
test('reward copy makes no factual claim about the viewer\'s friends', () => {
  ['tr', 'en'].forEach((locale) => {
    const text = makeT(locale, pickTheme('itu').strings)('rewardFriends');
    assert.doesNotMatch(text, /zaten|already/i, `${locale}: "${text}"`);
  });
});

// Brief: feast leads the intro; İTÜ students are addressed ("İTÜ'lülere özel"),
// not imitated ("İTÜ'lü gibi").
test('intro copy speaks to ITU students instead of "İTÜ\'lü gibi"', () => {
  const tr = makeT('tr', pickTheme('itu').strings);
  const en = makeT('en', pickTheme('itu').strings);
  assert.match(tr('introLead'), /İTÜ'lülere/);
  assert.match(en('introLead'), /ITU students/);
  ['tr', 'en'].forEach((locale) => {
    const t = makeT(locale, pickTheme('itu').strings);
    REWARD_KEYS.filter((k) => k.startsWith('intro') || k.startsWith('ready')).forEach((key) => {
      assert.doesNotMatch(String(t(key)), /gibi|like an/i, `${locale}.${key}: "${t(key)}"`);
    });
  });
});

test('the big intro word is no longer İTÜ — feast\'s logo takes that frame', () => {
  assert.ok(!REWARD_KEYS.includes('introBrand'));
});
