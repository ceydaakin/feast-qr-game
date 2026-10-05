// Campus name from ?campus= (default İTÜ) and the Turkish suffixes the reward
// copy needs: "İTÜ'lülere özel", "ODTÜ'de". Pure, unit-tested in Node.

import { REWARD_CONFIG } from './reward-config.js';

const CAMPUS_CHARS = /^[\p{L}\p{N} .-]+$/u;
const BACK_VOWELS = 'aıou';
const VOWELS = 'aıoueiöü';
const HARD_CONSONANTS = 'fstkçşhp'; // "fıstıkçı şahap": -de → -te after these
const LI_BY_VOWEL = { a: 'lı', ı: 'lı', e: 'li', i: 'li', o: 'lu', u: 'lu', ö: 'lü', ü: 'lü' };

export function pickCampus(raw) {
  const name = String(raw ?? '').trim();
  if (!name || name.length > REWARD_CONFIG.campus.maxLength || !CAMPUS_CHARS.test(name)) return null;
  return name;
}

function lastVowel(name) {
  const lower = name.toLocaleLowerCase('tr');
  for (let i = lower.length - 1; i >= 0; i--) if (VOWELS.includes(lower[i])) return lower[i];
  return 'e';
}

// "İTÜ" → "İTÜ'lülere" (people from İTÜ, dative plural)
export function turkishPluralDative(name) {
  const li = LI_BY_VOWEL[lastVowel(name)];
  const lere = BACK_VOWELS.includes(li[1]) ? 'lara' : 'lere';
  return `${name}'${li}${lere}`;
}

// "İTÜ" → "İTÜ'de", "Koç" → "Koç'ta"
export function turkishLocative(name) {
  const lastChar = name.toLocaleLowerCase('tr').slice(-1);
  const d = HARD_CONSONANTS.includes(lastChar) ? 't' : 'd';
  const e = BACK_VOWELS.includes(lastVowel(name)) ? 'a' : 'e';
  return `${name}'${d}${e}`;
}

const fill = (value, vars) => {
  if (typeof value === 'string') return value.replace(/\{(campus\w*)\}/g, (_, k) => vars[k]);
  if (Array.isArray(value)) return value.map((v) => fill(v, vars));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, vars)]));
  return value;
};

// Theme strings plus the reward-flow copy with the campus filled in, in the
// { tr, en } shape makeT() takes.
export function themeStringsWithReward(theme, campusRaw) {
  const custom = pickCampus(campusRaw);
  const trName = custom || REWARD_CONFIG.campus.tr;
  const enName = custom || REWARD_CONFIG.campus.en;
  const { strings } = REWARD_CONFIG;
  return {
    tr: {
      ...theme?.strings?.tr,
      ...fill(strings.tr, { campus: trName, campusPlural: turkishPluralDative(trName), campusLoc: turkishLocative(trName) }),
    },
    en: { ...theme?.strings?.en, ...fill(strings.en, { campus: enName }) },
  };
}
