import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTheme, THEMES } from '../js/themes.js';
import { makeT, STRINGS } from '../js/i18n.js';

test('pickTheme resolves known sources case-insensitively', () => {
  assert.equal(pickTheme('itu').id, 'itu');
  assert.equal(pickTheme('ITU').id, 'itu');
  assert.equal(pickTheme('qr_game'), null);
  assert.equal(pickTheme(''), null);
  assert.equal(pickTheme('toString'), null);
});

test('theme strings override base strings, falling back per key', () => {
  const t = makeT('tr', THEMES.itu.strings);
  assert.match(t('shareText'), /İTÜ/);
  assert.equal(t('again'), STRINGS.tr.again);
});

test('English theme falls back to the base English string, not Turkish theme copy', () => {
  const t = makeT('en', THEMES.itu.strings);
  assert.match(t('shareText'), /ITU/);
  assert.equal(t('lines_idle'), STRINGS.en.lines_idle);
});
