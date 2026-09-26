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
  assert.match(t('headline'), /İTÜ/);
  assert.equal(t('play'), STRINGS.tr.play);
  assert.equal(t('ranks').length, STRINGS.tr.ranks.length);
});

test('English theme falls back to the base English string, not Turkish theme copy', () => {
  const t = makeT('en', THEMES.itu.strings);
  assert.match(t('headline'), /ITU/);
  assert.equal(t('lines_idle'), STRINGS.en.lines_idle);
});

test('every theme rank list matches the number of ranks', () => {
  Object.values(THEMES).forEach((theme) => {
    Object.values(theme.strings).forEach((table) => {
      if (table.ranks) assert.equal(table.ranks.length, STRINGS.tr.ranks.length);
    });
  });
});
