import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickFlow, INTRO_STEPS, introPlan, createSequencer, createBoxState, REWARD_KEYS,
} from '../js/flow.js';
import { pickTheme } from '../js/themes.js';
import { makeT } from '../js/i18n.js';
import { REWARD_CONFIG } from '../js/reward-config.js';
import {
  pickCampus, turkishPluralDative, turkishLocative, themeStringsWithReward,
} from '../js/campus.js';

const { avatars: AVATARS } = REWARD_CONFIG;
// t() exactly as main.js builds it for ?src=itu (optionally with &campus=…).
const rewardT = (locale, campus = null) => makeT(locale, themeStringsWithReward(pickTheme('itu'), campus));

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
    const t = rewardT(locale);
    REWARD_KEYS.forEach((key) => {
      const value = t(key);
      assert.notEqual(value, key, `${locale}.${key} missing`);
      assert.ok(Array.isArray(value) ? value.length : String(value).trim(), `${locale}.${key} empty`);
    });
  });
});

test('English reward copy is not silently the Turkish text', () => {
  const tr = rewardT('tr');
  const en = rewardT('en');
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

// The page cannot know who the visitor's friends are, so the reward copy must
// not state as fact that they are already on feast (fabricated social proof).
test('reward copy makes no factual claim about the viewer\'s friends', () => {
  ['tr', 'en'].forEach((locale) => {
    const text = rewardT(locale)('rewardFriends');
    assert.doesNotMatch(text, /zaten|already/i, `${locale}: "${text}"`);
  });
});

// Brief: feast leads the intro; İTÜ students are addressed ("İTÜ'lülere özel"),
// not imitated ("İTÜ'lü gibi").
test('intro copy speaks to ITU students instead of "İTÜ\'lü gibi"', () => {
  const tr = rewardT('tr');
  const en = rewardT('en');
  assert.match(tr('introLead'), /İTÜ'lülere/);
  assert.match(en('introLead'), /ITU students/);
  ['tr', 'en'].forEach((locale) => {
    const t = rewardT(locale);
    REWARD_KEYS.filter((k) => k.startsWith('intro') || k.startsWith('ready')).forEach((key) => {
      assert.doesNotMatch(String(t(key)), /gibi|like an/i, `${locale}.${key}: "${t(key)}"`);
    });
  });
});

test('the big intro word is no longer İTÜ — feast\'s logo takes that frame', () => {
  assert.ok(!REWARD_KEYS.includes('introBrand'));
});

// ---------- single config (the brief: every duration and text in one file) ----------

test('intro durations come from the config, in the brief\'s order', () => {
  const { timings } = REWARD_CONFIG;
  assert.deepEqual(INTRO_STEPS.slice(0, -1).map((s) => s.ms), [
    timings.mystery, timings.swirl, timings.scribble, timings.brand, timings.promise,
  ]);
  assert.deepEqual(timings, { mystery: 2000, swirl: 1500, scribble: 800, brand: 1500, promise: 2500 });
});

test('losing the round is a config choice: give the box anyway or retry', () => {
  assert.ok(['box', 'retry'].includes(REWARD_CONFIG.onLose));
});

test('restaurant cards have a name and either an image or a monogram', () => {
  const { restaurants } = REWARD_CONFIG;
  assert.ok(restaurants.length >= 3 && restaurants.length <= 5);
  assert.equal(restaurants[0].name, 'Mustachio');
  restaurants.forEach((r) => assert.ok(r.name && (r.img || r.monogram), JSON.stringify(r)));
});

// ---------- campus from ?campus= ----------

test('pickCampus keeps a clean campus name and rejects junk', () => {
  assert.equal(pickCampus(null), null);
  assert.equal(pickCampus(''), null);
  assert.equal(pickCampus('  ODTÜ '), 'ODTÜ');
  assert.equal(pickCampus('Boğaziçi'), 'Boğaziçi');
  assert.equal(pickCampus('<script>'), null);
  assert.equal(pickCampus('x'.repeat(40)), null);
});

test('Turkish suffixes follow vowel harmony and consonant hardening', () => {
  assert.equal(turkishPluralDative('İTÜ'), 'İTÜ\'lülere');
  assert.equal(turkishPluralDative('ODTÜ'), 'ODTÜ\'lülere');
  assert.equal(turkishPluralDative('Boğaziçi'), 'Boğaziçi\'lilere');
  assert.equal(turkishPluralDative('Yıldız'), 'Yıldız\'lılara');
  assert.equal(turkishPluralDative('Koç'), 'Koç\'lulara');
  assert.equal(turkishLocative('İTÜ'), 'İTÜ\'de');
  assert.equal(turkishLocative('Yıldız'), 'Yıldız\'da');
  assert.equal(turkishLocative('Koç'), 'Koç\'ta');
  assert.equal(turkishLocative('Sabancı'), 'Sabancı\'da');
});

test('campus fills the reward copy; İTÜ/ITU by default', () => {
  assert.equal(rewardT('tr')('introLead'), 'İTÜ\'lülere özel');
  assert.equal(rewardT('en')('introLead'), 'For ITU students');
  assert.equal(rewardT('tr', 'ODTÜ')('introLead'), 'ODTÜ\'lülere özel');
  assert.equal(rewardT('en', 'ODTÜ')('introLead'), 'For ODTÜ students');
  assert.match(rewardT('tr', 'ODTÜ')('rewardTitle'), /^ODTÜ'de, Kadıköy'de, Beşiktaş'ta/);
  assert.match(rewardT('en', 'ODTÜ')('rewardTitle'), /in ODTÜ, Kadıköy and Beşiktaş/);
});

test('promise frame reads "Yeni döneme ÖDÜLLE başla"', () => {
  const t = rewardT('tr');
  assert.equal(`${t('introPromise')} ${t('introHot')} ${t('introTail')}`, 'Yeni döneme ÖDÜLLE başla');
});

test('English ready copy says "survive", matching "45 sn dayan"', () => {
  assert.match(rewardT('en')('readyMain'), /survive/i);
});
