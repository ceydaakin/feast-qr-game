// Pure game rules + config. No DOM access here so it can be unit-tested in Node.

export const STORE = Object.freeze({
  appStoreId: '6762010641',
  androidPackage: 'com.feast.mobile',
});

export const GAME = Object.freeze({
  durationSec: 60,
  lives: 3,
  comboStep: 5,
  maxMultiplier: 5,
  magnetSec: 6,
  magnetPull: 520, // px/s horizontal pull toward the pizza while magnet is active
  stageThresholds: [300, 900], // score where chef sprite advances sauce → cheese → toppings
  rankThresholds: [300, 900, 1800],
  finalRushSec: 10,
});

// type: good = +points, bad = lose a life, bonus = magnet power-up,
// discover = restaurant pin (counts toward "restaurants discovered")
export const ITEMS = Object.freeze({
  tomato: { type: 'good', points: 10 },
  cheese: { type: 'good', points: 10 },
  mushroom: { type: 'good', points: 10 },
  olive: { type: 'good', points: 10 },
  pepperoni: { type: 'good', points: 15 },
  basil: { type: 'good', points: 15 },
  mustache: { type: 'bonus', points: 50 },
  pin: { type: 'discover', points: 30 }, // "new restaurant" — the marketing hook
  boot: { type: 'bad', points: 0 },
  fishbone: { type: 'bad', points: 0 },
  pineapple: { type: 'bad', points: 0 },
});

const GOOD_KINDS = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'good');
const BAD_KINDS = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'bad');

export function detectPlatform(userAgent, maxTouchPoints) {
  const ua = userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  // iPadOS 13+ reports a desktop Mac UA; touch support gives it away.
  if (/macintosh/i.test(ua) && (maxTouchPoints || 0) > 1) return 'ios';
  return 'desktop';
}

export function storeUrl(platform, source = 'qr_game') {
  if (platform === 'ios') {
    return `https://apps.apple.com/tr/app/feast/id${STORE.appStoreId}`;
  }
  if (platform === 'android') {
    const referrer = encodeURIComponent(`utm_source=${source}&utm_medium=game`);
    return `https://play.google.com/store/apps/details?id=${STORE.androidPackage}&referrer=${referrer}`;
  }
  return null;
}

export function multiplierFor(combo) {
  return Math.min(GAME.maxMultiplier, 1 + Math.floor(combo / GAME.comboStep));
}

export function scoreFor(kind, combo) {
  return ITEMS[kind].points * multiplierFor(combo);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// fallSpeed is in screen-heights per second so it scales with any phone size.
export function difficultyAt(elapsedSec) {
  const p = clamp01(elapsedSec / GAME.durationSec);
  const eased = p * p * (3 - 2 * p);
  return {
    spawnEvery: lerp(0.85, 0.36, eased),
    fallSpeed: lerp(0.3, 0.68, eased),
    badChance: lerp(0.12, 0.3, eased),
    bonusChance: 0.035,
    discoverChance: 0.06,
  };
}

function stepIndex(value, thresholds) {
  return thresholds.filter((t) => value >= t).length;
}

export function chefStageFor(score) {
  return stepIndex(score, GAME.stageThresholds);
}

export function rankFor(score) {
  return stepIndex(score, GAME.rankThresholds);
}

// The game is Turkish-first: English only when the link explicitly asks (?lang=en).
export function pickLocale(langParam) {
  return String(langParam || '').toLowerCase() === 'en' ? 'en' : 'tr';
}

export function pickItemKind(diff, rnd = Math.random) {
  const r = rnd();
  const discover = diff.discoverChance || 0;
  if (r < diff.bonusChance) return 'mustache';
  if (r < diff.bonusChance + discover) return 'pin';
  if (r < diff.bonusChance + discover + diff.badChance) {
    return BAD_KINDS[Math.floor(rnd() * BAD_KINDS.length) % BAD_KINDS.length];
  }
  return GOOD_KINDS[Math.floor(rnd() * GOOD_KINDS.length) % GOOD_KINDS.length];
}

// Random line from a pool, never the same as the previous one (when possible).
export function pickLine(lines, prevIndex, rnd = Math.random) {
  if (!Array.isArray(lines) || lines.length === 0) return { text: null, index: -1 };
  if (lines.length === 1) return { text: lines[0], index: 0 };
  if (prevIndex < 0 || prevIndex >= lines.length) {
    const index = Math.min(lines.length - 1, Math.floor(rnd() * lines.length));
    return { text: lines[index], index };
  }
  const choices = lines.length - 1;
  let index = Math.min(choices - 1, Math.floor(rnd() * choices));
  if (index >= prevIndex) index += 1;
  return { text: lines[index], index };
}

// Cuisine picker on the end screen — images come from the app's own category art.
export const CUISINES = Object.freeze([
  { id: 'pizza', img: 'assets/cuisine/pizza.webp' },
  { id: 'burger', img: 'assets/cuisine/burger.webp' },
  { id: 'doner', img: 'assets/cuisine/doner.webp' },
  { id: 'kahvalti', img: 'assets/cuisine/kahvalti.webp' },
  { id: 'sushi', img: 'assets/cuisine/sushi.webp' },
  { id: 'tatli', img: 'assets/cuisine/tatli.webp' },
]);
