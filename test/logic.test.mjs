import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatform,
  storeUrl,
  multiplierFor,
  scoreFor,
  difficultyAt,
  chefStageFor,
  rankFor,
  pickLocale,
  pickItemKind,
  pickLine,
  CUISINES,
  ITEMS,
  STORE,
  GAME,
} from '../js/logic.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 340.0';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

test('detectPlatform recognises iOS, Android and desktop', () => {
  assert.equal(detectPlatform(IPHONE, 5), 'ios');
  assert.equal(detectPlatform(INSTAGRAM_IOS, 5), 'ios');
  assert.equal(detectPlatform(ANDROID, 5), 'android');
  assert.equal(detectPlatform(DESKTOP, 0), 'desktop');
});

test('detectPlatform treats iPadOS (desktop UA + touch) as iOS', () => {
  assert.equal(detectPlatform(IPAD_DESKTOP_UA, 5), 'ios');
  assert.equal(detectPlatform(IPAD_DESKTOP_UA, 0), 'desktop');
});

test('detectPlatform tolerates missing input', () => {
  assert.equal(detectPlatform(undefined, undefined), 'desktop');
});

test('storeUrl returns the App Store link for iOS', () => {
  assert.equal(storeUrl('ios'), `https://apps.apple.com/tr/app/feast/id${STORE.appStoreId}`);
});

test('storeUrl returns a Play Store link with campaign referrer for Android', () => {
  const url = new URL(storeUrl('android', 'qr_game'));
  assert.equal(url.host, 'play.google.com');
  assert.equal(url.searchParams.get('id'), STORE.androidPackage);
  assert.equal(url.searchParams.get('referrer'), 'utm_source=qr_game&utm_medium=game');
});

test('storeUrl returns null on desktop', () => {
  assert.equal(storeUrl('desktop'), null);
});

test('multiplierFor grows every 5 combo and caps at max', () => {
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(4), 1);
  assert.equal(multiplierFor(5), 2);
  assert.equal(multiplierFor(14), 3);
  assert.equal(multiplierFor(999), GAME.maxMultiplier);
});

test('scoreFor multiplies item points by the combo multiplier', () => {
  assert.equal(scoreFor('pepperoni', 0), ITEMS.pepperoni.points);
  assert.equal(scoreFor('pepperoni', 5), ITEMS.pepperoni.points * 2);
  assert.equal(scoreFor('boot', 10), 0);
});

test('difficultyAt ramps from easy to hard and clamps', () => {
  const start = difficultyAt(0);
  const end = difficultyAt(GAME.durationSec);
  const beyond = difficultyAt(GAME.durationSec * 3);
  assert.ok(start.spawnEvery > end.spawnEvery);
  assert.ok(start.fallSpeed < end.fallSpeed);
  assert.ok(start.badChance < end.badChance);
  assert.deepEqual(beyond, end);
  assert.deepEqual(difficultyAt(-5), start);
});

test('chefStageFor advances the pizza as score rises', () => {
  assert.equal(chefStageFor(0), 0);
  assert.equal(chefStageFor(GAME.stageThresholds[0]), 1);
  assert.equal(chefStageFor(GAME.stageThresholds[1]), 2);
  assert.equal(chefStageFor(1e6), 2);
});

test('rankFor returns increasing ranks', () => {
  assert.equal(rankFor(0), 0);
  assert.equal(rankFor(1e6), 3);
  assert.ok(rankFor(300) >= rankFor(100));
});

test('pickLocale is always Turkish unless ?lang=en is requested', () => {
  assert.equal(pickLocale(null), 'tr');
  assert.equal(pickLocale(undefined), 'tr');
  assert.equal(pickLocale('tr'), 'tr');
  assert.equal(pickLocale('de'), 'tr');
  assert.equal(pickLocale('en'), 'en');
  assert.equal(pickLocale('EN'), 'en');
});

test('pickItemKind honours bonus, discover, bad and good bands', () => {
  const diff = { badChance: 0.25, bonusChance: 0.05, discoverChance: 0.1 };
  assert.equal(pickItemKind(diff, () => 0.01), 'mustache');
  assert.equal(pickItemKind(diff, () => 0.1), 'pin');
  assert.equal(ITEMS[pickItemKind(diff, seq([0.2, 0.0]))].type, 'bad');
  assert.equal(ITEMS[pickItemKind(diff, seq([0.9, 0.0]))].type, 'good');
});

test('pin is a discover item worth more than regular toppings', () => {
  assert.equal(ITEMS.pin.type, 'discover');
  assert.ok(ITEMS.pin.points > ITEMS.pepperoni.points);
});

test('difficultyAt includes a steady restaurant-pin chance', () => {
  assert.ok(difficultyAt(0).discoverChance > 0);
  assert.equal(difficultyAt(0).discoverChance, difficultyAt(GAME.durationSec).discoverChance);
});

test('pickLine never repeats the previous line when there is a choice', () => {
  const lines = ['a', 'b', 'c'];
  for (let prev = 0; prev < lines.length; prev++) {
    for (const r of [0, 0.34, 0.67, 0.99]) {
      const { index } = pickLine(lines, prev, () => r);
      assert.notEqual(index, prev);
    }
  }
});

test('pickLine handles single-line and empty pools', () => {
  assert.deepEqual(pickLine(['only'], 0, () => 0.5), { text: 'only', index: 0 });
  assert.deepEqual(pickLine([], -1, () => 0.5), { text: null, index: -1 });
  assert.deepEqual(pickLine(undefined, -1, () => 0.5), { text: null, index: -1 });
});

test('CUISINES have ids and image paths', () => {
  assert.ok(CUISINES.length >= 4);
  CUISINES.forEach((c) => assert.match(c.img, /^assets\/cuisine\/[a-z]+\.webp$/));
});

function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
