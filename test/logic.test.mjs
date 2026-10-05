import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatform,
  pickLocale,
  pickLine,
  CUISINES,
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

test('pickLocale is always Turkish unless ?lang=en is requested', () => {
  assert.equal(pickLocale(null), 'tr');
  assert.equal(pickLocale(undefined), 'tr');
  assert.equal(pickLocale('tr'), 'tr');
  assert.equal(pickLocale('de'), 'tr');
  assert.equal(pickLocale('en'), 'en');
  assert.equal(pickLocale('EN'), 'en');
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
