// Pure game rules + config. No DOM access here so it can be unit-tested in Node.

export const STORE = Object.freeze({
  appStoreId: '6762010641',
  androidPackage: 'com.feast.mobile',
});

// Score needed for each end-screen rank (Çırak → Kalfa → Usta → Efsane).
export const RANK_THRESHOLDS = Object.freeze([600, 1800, 4000]);

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

function stepIndex(value, thresholds) {
  return thresholds.filter((t) => value >= t).length;
}

export function rankFor(score) {
  return stepIndex(score, RANK_THRESHOLDS);
}

// The game is Turkish-first: English only when the link explicitly asks (?lang=en).
export function pickLocale(langParam) {
  return String(langParam || '').toLowerCase() === 'en' ? 'en' : 'tr';
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
