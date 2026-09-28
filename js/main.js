// UI wiring: screens, HUD, store CTA, persistence. Game rules live in logic.js.

import {
  CUISINES, detectPlatform, storeUrl, rankFor, pickLocale, pickLine,
} from './logic.js';
import { makeT } from './i18n.js';
import { pickTheme } from './themes.js';
import { sfx } from './audio.js';
import { createGame } from './game.js';
import { buildLegendIcons } from './crowd-art.js';
import { pickFlow, introPlan } from './flow.js';
import { REWARD_CONFIG } from './reward-config.js';
import { themeStringsWithReward } from './campus.js';
import { playIntro, openBoxScreen, renderReward } from './reward-ui.js';

const BEST_KEY = 'feast-game.best.v1';
const MUTE_KEY = 'feast-game.muted.v1';
const INTRO_SEEN_KEY = 'feast-game.intro-seen.v1';
const BUMP_MIN = 5;
const RESIZE_DEBOUNCE_MS = 150;
const BUMP_FRAMES = [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }];
const $ = (sel) => document.querySelector(sel);

const params = new URLSearchParams(location.search);
const source = (params.get('src') || 'qr_game').replace(/[^\w-]/g, '').slice(0, 40) || 'qr_game';
const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
const STORE_URL = storeUrl(platform, source);

// Smart link: the desktop QR points at "?dl=1" so phones jump straight to their store.
if (params.get('dl') === '1' && STORE_URL) {
  track('store_redirect', { platform });
  location.replace(STORE_URL);
}

const locale = pickLocale(params.get('lang'));
const theme = pickTheme(source);
const flow = pickFlow(theme);
// Reward flow copy comes from reward-config.js with ?campus= filled in (default İTÜ).
const t = makeT(locale, flow === 'reward' ? themeStringsWithReward(theme, params.get('campus')) : theme?.strings);
document.documentElement.lang = locale;

function track(event, data = {}) {
  // Hook for GTM/analytics if the host page injects a dataLayer; no-op otherwise.
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: `feast_game_${event}`, source, ...data });
}

function storage(action, key, value) {
  try {
    if (action === 'get') return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the game still works, it just forgets.
  }
  return null;
}

function applyStrings() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    // Platform-aware copy: "App Store'dan indir" vs "Google Play'den indir".
    const key = el.dataset.i18n;
    const specific = `${key}_${platform}`;
    const hasSpecific = 'i18nPlatform' in el.dataset && t(specific) !== specific;
    el.textContent = t(hasSpecific ? specific : key);
  });
  // The round badge stays on one line; CSS shrinks its font by text length
  // (themes like İTÜ have much longer copy). +2 accounts for the ⏱ icon.
  const badge = $('.round-badge');
  badge?.style.setProperty('--badge-len', String(t('roundBadge').length + 2));
  document.title = `${t('title')} · feast.`;
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    el.alt = t(el.dataset.i18nAlt);
  });
}

function renderLegend() {
  const icons = buildLegendIcons(Math.min(window.devicePixelRatio || 1, 2), theme?.art);
  const place = (host, sprites) => sprites.forEach((sprite) => {
    sprite.className = 'legend-icon legend-wide';
    sprite.setAttribute('aria-hidden', 'true');
    $(`[data-legend="${host}"]`).appendChild(sprite);
  });
  place('gates', [icons.gate, icons.gateBad]);
  place('eaters', [icons.eater, icons.big]);
}

// Chef lines per game event, never repeating the previous line for that event.
function makeChatter() {
  const lastIndex = {};
  return (event) => {
    const { text, index } = pickLine(t(`lines_${event}`), lastIndex[event] ?? -1);
    lastIndex[event] = index;
    return text;
  };
}

// Rotating feast. benefits under the Play button (only ticks while visible).
function startTicker() {
  const el = $('#ticker-text');
  const lines = t('ticker');
  let prev = -1;
  const next = () => {
    if (!$('#start').classList.contains('is-active')) return;
    const { text, index } = pickLine(lines, prev);
    prev = index;
    el.classList.remove('in');
    void el.offsetWidth;
    el.textContent = text;
    el.classList.add('in');
  };
  next();
  setInterval(next, 2800);
}

// "Canın ne çekiyor?" — picking a cuisine personalises the download pitch.
function setupCraving() {
  const grid = $('#craving-grid');
  CUISINES.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'craving-item';
    btn.dataset.cuisine = c.id;
    const img = document.createElement('img');
    img.src = c.img;
    img.alt = '';
    img.width = 88;
    img.height = 88;
    img.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = t(`cuisine_${c.id}`);
    btn.append(img, label);
    btn.addEventListener('click', () => pickCraving(c.id));
    grid.appendChild(btn);
  });
}

function pickCraving(id) {
  document.querySelectorAll('.craving-item').forEach((b) => {
    b.classList.toggle('is-picked', b.dataset.cuisine === id);
  });
  const title = $('#cta-title');
  title.textContent = t('cravingCta', { c: t(`cuisine_${id}`) });
  const cta = $('#cta');
  cta.classList.remove('flash');
  void cta.offsetWidth;
  cta.classList.add('flash');
  cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (navigator.vibrate) navigator.vibrate(15);
  track('craving', { cuisine: id });
}

function resetCraving() {
  document.querySelectorAll('.craving-item').forEach((b) => b.classList.remove('is-picked'));
  $('#cta-title').textContent = t('ctaTitle');
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('[feast-game] failed to load', src);
      resolve(img);
    };
    img.src = src;
  });
}

function setupStoreLinks() {
  document.querySelectorAll('[data-store]').forEach((a) => {
    if (STORE_URL) {
      a.href = STORE_URL;
      a.addEventListener('click', () => track('store_click', { platform, from: a.dataset.store }));
    } else {
      a.hidden = true;
    }
  });
  document.querySelectorAll('[data-store-only]').forEach((el) => { el.hidden = !STORE_URL; });
  document.querySelectorAll('[data-desktop-only]').forEach((el) => { el.hidden = Boolean(STORE_URL); });
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('is-active', el.id === id);
  });
  $('#hud').hidden = id !== 'play';
}

// Only touch the DOM when a value actually changed (HUD is fed every frame).
// The game reuses one HUD object, so `prev` is a field-by-field copy (no
// per-frame spread allocation).
function makeHud() {
  const els = {
    hud: $('#hud'), score: $('#hud-score'), count: $('#hud-count'), meters: $('#hud-meters'), pins: $('#hud-pins'),
    left: $('#hud-left'), bar: $('#hud-time'),
  };
  const prev = {};
  return (h) => {
    if (h.score !== prev.score) {
      els.score.textContent = h.score;
      // Distance ticks the score every frame; only pop on real rewards, and via
      // WAAPI so it never forces a layout mid-frame.
      if (h.score - (prev.score || 0) >= BUMP_MIN && els.score.animate) {
        els.score.animate(BUMP_FRAMES, { duration: 180, easing: 'ease-out' });
      }
    }
    if (h.count !== prev.count) els.count.textContent = h.count;
    if (h.meters !== prev.meters) els.meters.textContent = h.meters;
    if (h.pins !== prev.pins) els.pins.textContent = h.pins;
    if (h.timeLeft !== prev.timeLeft) els.left.textContent = h.timeLeft;
    if (h.timeFrac !== prev.timeFrac) els.bar.style.transform = `scaleX(${1 - h.timeFrac})`;
    if (h.rush !== prev.rush) els.hud.classList.toggle('rush', h.rush);
    prev.score = h.score; prev.count = h.count; prev.meters = h.meters; prev.pins = h.pins;
    prev.timeLeft = h.timeLeft; prev.timeFrac = h.timeFrac; prev.rush = h.rush;
  };
}

function countUp(el, to) {
  const start = performance.now();
  const dur = Math.min(1200, 300 + to * 2);
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showGameOver(result, best, isNewBest) {
  $('#over-title').textContent = t(`over_${result.reason}`);
  $('#over-rank').textContent = t('ranks')[rankFor(result.score)];
  $('#over-stats').textContent = t('stats', { distance: result.distance, fed: result.fed, peak: result.peak });
  const disc = $('#over-discovered');
  disc.hidden = !result.discovered;
  disc.textContent = t('discovered', { n: result.discovered });
  resetCraving();
  $('#over').scrollTo(0, 0);
  $('#over-best').textContent = isNewBest ? t('newBest') : `${t('best')}: ${best}`;
  $('#over-best').classList.toggle('is-new', isNewBest);
  countUp($('#over-score'), result.score);
  showScreen('over');
}

// Lost before time ran out: the config decides between the box anyway and a retry.
function endRewardRound(result) {
  if (result.reason !== 'time' && REWARD_CONFIG.onLose === 'retry') {
    track('retry_offered', { score: result.score });
    showScreen('intro');
    return;
  }
  showBox(result);
}

function showBox(result) {
  openBoxScreen({
    root: $('#box'),
    button: $('#btn-box'),
    onOpened: () => {
      track('box_open', { score: result.score });
      showReward(result);
    },
  });
  showScreen('box');
}

function showReward(result) {
  renderReward({
    avatarsEl: $('#reward-avatars'),
    placesEl: $('#reward-places'),
    scoreEl: $('#reward-score'),
    scoreText: t('rewardScore', { score: result.score }),
  });
  $('#reward').scrollTo(0, 0);
  showScreen('reward');
  track('reward_view', { score: result.score });
}

async function share(score, btn) {
  // Keep the event theme on shared links so friends get the same version.
  const url = `${location.origin}${location.pathname}${theme ? `?src=${theme.id}` : ''}`;
  const text = t('shareText', { score });
  track('share', { score });
  try {
    if (navigator.share) {
      await navigator.share({ title: t('title'), text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    const label = btn.textContent;
    btn.textContent = t('copied');
    setTimeout(() => { btn.textContent = label; }, 1600);
  } catch (err) {
    if (err && err.name !== 'AbortError') console.warn('[feast-game] share failed', err);
  }
}

function setupMute() {
  const btn = $('#btn-mute');
  const apply = (muted) => {
    sfx.setMuted(muted);
    btn.setAttribute('aria-pressed', String(muted));
    btn.textContent = muted ? '🔇' : '🔊';
    storage('set', MUTE_KEY, muted ? '1' : '0');
  };
  apply(storage('get', MUTE_KEY) === '1');
  btn.addEventListener('click', () => apply(!sfx.isMuted()));
}

function preventPageGestures() {
  // Stop pinch-zoom / rubber-band scroll from hijacking drags on iOS.
  ['gesturestart', 'gesturechange'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  // Non-passive listeners make the browser wait on the main thread before every
  // touch move, so keep them off the canvas (it has CSS touch-action: none) —
  // steering during a busy frame stays responsive.
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.addEventListener('touchmove', (e) => {
      if (!e.target.closest('.scrollable')) e.preventDefault();
    }, { passive: false });
  });
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('canvas')) e.preventDefault();
  });
}

// BAŞLA is visible during the intro, before boot() has loaded the game's
// images: a tap then is remembered and starts the round once the game exists.
const rewardStart = { play: null, queued: false };

function startRewardIntro() {
  $('#btn-reward-play').addEventListener('click', () => {
    sfx.unlock(); // inside the tap, so audio is allowed later
    if (rewardStart.play) rewardStart.play();
    else rewardStart.queued = true;
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = storage('get', INTRO_SEEN_KEY) === '1';
  showScreen('intro');
  playIntro({
    root: $('#intro'),
    steps: introPlan({ seen, reducedMotion }),
    onStep: (id) => {
      if (id !== 'ready') return;
      storage('set', INTRO_SEEN_KEY, '1');
      track('intro_ready', { seen });
    },
  });
}

async function boot() {
  applyStrings();
  if (flow === 'reward') startRewardIntro();
  renderLegend();
  setupStoreLinks();
  setupMute();
  setupCraving();
  preventPageGestures();
  startTicker();

  let best = Number(storage('get', BEST_KEY)) || 0;
  $('#start-best').textContent = best ? `${t('best')}: ${best}` : '';

  const cuisineImages = await Promise.all(CUISINES.map((c) => loadImage(c.img)));
  const places = CUISINES.map((c, i) => ({ img: cuisineImages[i], label: t(`cuisine_${c.id}`) }));
  let lastScore = 0;

  const game = createGame({
    canvas: $('#stage'),
    places,
    theme,
    locale,
    sfx,
    t,
    chatter: makeChatter(),
    onHud: makeHud(),
    onEnd: (result) => {
      lastScore = result.score;
      const isNewBest = result.score > best;
      if (isNewBest) {
        best = result.score;
        storage('set', BEST_KEY, String(best));
      }
      track('end', { score: result.score, reason: result.reason });
      setTimeout(() => (flow === 'reward' ? endRewardRound(result) : showGameOver(result, best, isNewBest)), 450);
    },
  });

  // Debounced: iOS fires a burst of resizes while the URL bar animates; one
  // rebuild after it settles instead of one per frame (resize() also skips no-ops).
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => game.resize(), RESIZE_DEBOUNCE_MS);
  });

  const play = () => {
    sfx.unlock();
    showScreen('play');
    track('start');
    game.start();
  };
  $('#btn-play').addEventListener('click', play);
  if (flow === 'reward') {
    rewardStart.play = play;
    if (rewardStart.queued) play();
  }
  document.querySelectorAll('[data-action="again"]').forEach((b) => b.addEventListener('click', play));
  const canShare = Boolean(navigator.share || navigator.clipboard);
  document.querySelectorAll('[data-action="share"]').forEach((b) => {
    b.hidden = !canShare;
    b.addEventListener('click', () => share(lastScore, b));
  });

  document.body.classList.add('is-ready');
  track('view', { platform });
}

boot().catch((err) => {
  console.error('[feast-game] boot failed', err);
  document.body.classList.add('is-ready');
});
