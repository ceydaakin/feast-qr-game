// UI wiring: screens, HUD, store CTA, persistence. Game rules live in logic.js.

import {
  ITEMS, CUISINES, detectPlatform, storeUrl, rankFor, pickLocale, pickLine,
} from './logic.js';
import { makeT } from './i18n.js';
import { sfx } from './audio.js';
import { createGame } from './game.js';
import { renderSprite } from './art.js';
import { buildObstacleSprites } from './scenery.js';
import { RUN } from './runner-logic.js';

const BEST_KEY = 'feast-game.best.v1';
const MUTE_KEY = 'feast-game.muted.v1';
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
const t = makeT(locale);
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
  document.title = `${t('title')} · feast.`;
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    el.alt = t(el.dataset.i18nAlt);
  });
}

function renderLegend() {
  const LEGEND_GROUP = { good: 'catch', bad: 'dodge', bonus: 'bonus', discover: 'discover' };
  const groups = { catch: [], dodge: [], bonus: [], discover: [] };
  Object.entries(ITEMS).forEach(([kind, def]) => groups[LEGEND_GROUP[def.type]].push(kind));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const dodgeHost = $('[data-legend="dodge"]');
  Object.values(buildObstacleSprites(40, dpr)).forEach((sprite) => {
    sprite.className = 'legend-icon legend-obstacle';
    sprite.setAttribute('aria-hidden', 'true');
    dodgeHost.appendChild(sprite);
  });
  Object.entries(groups).forEach(([key, kinds]) => {
    if (key === 'dodge') return;
    const host = $(`[data-legend="${key}"]`);
    kinds.slice(0, key === 'catch' ? 4 : 3).forEach((kind) => {
      const c = renderSprite(kind, Math.round(40 * dpr), ITEMS[kind].type === 'bad');
      c.className = 'legend-icon';
      c.setAttribute('aria-hidden', 'true');
      host.appendChild(c);
    });
  });
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
  $('#desktop-qr').hidden = Boolean(STORE_URL);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('is-active', el.id === id);
  });
  $('#hud').hidden = id !== 'play';
}

// Only touch the DOM when a value actually changed (HUD is fed every frame).
function makeHud() {
  const els = {
    score: $('#hud-score'), lives: $('#hud-lives'), meters: $('#hud-meters'),
    pins: $('#hud-pins'), mult: $('#hud-mult'), magnet: $('#hud-magnet'),
  };
  let prev = {};
  return (h) => {
    if (h.score !== prev.score) {
      els.score.textContent = h.score;
      els.score.classList.remove('bump');
      void els.score.offsetWidth;
      els.score.classList.add('bump');
    }
    if (h.lives !== prev.lives) {
      els.lives.textContent = '❤️'.repeat(Math.max(0, h.lives)) + '🤍'.repeat(RUN.lives - Math.max(0, h.lives));
    }
    if (h.meters !== prev.meters) els.meters.textContent = h.meters;
    if (h.pins !== prev.pins) els.pins.textContent = h.pins;
    if (h.multiplier !== prev.multiplier) {
      els.mult.textContent = `x${h.multiplier}`;
      els.mult.hidden = h.multiplier <= 1;
    }
    if (h.magnet !== prev.magnet) els.magnet.hidden = !h.magnet;
    prev = { ...h };
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
  $('#over-stats').textContent = t('stats', { distance: result.distance, caught: result.caught });
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

async function share(score) {
  const url = `${location.origin}${location.pathname}`;
  const text = t('shareText', { score });
  track('share', { score });
  try {
    if (navigator.share) {
      await navigator.share({ title: t('title'), text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    const btn = $('#btn-share');
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
  ['gesturestart', 'gesturechange'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.scrollable')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('canvas')) e.preventDefault();
  });
}

async function boot() {
  applyStrings();
  renderLegend();
  setupStoreLinks();
  setupMute();
  setupCraving();
  preventPageGestures();
  startTicker();

  let best = Number(storage('get', BEST_KEY)) || 0;
  $('#start-best').textContent = best ? `${t('best')}: ${best}` : '';

  const [chefImages, cuisineImages] = await Promise.all([
    Promise.all(['assets/chef1.webp', 'assets/chef2.webp', 'assets/chef3.webp'].map(loadImage)),
    Promise.all(CUISINES.map((c) => loadImage(c.img))),
  ]);
  const billboards = CUISINES.map((c, i) => ({ img: cuisineImages[i], label: t(`cuisine_${c.id}`) }));
  let lastScore = 0;

  const game = createGame({
    canvas: $('#stage'),
    chefImages,
    billboards,
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
      setTimeout(() => showGameOver(result, best, isNewBest), 450);
    },
  });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      game.resize();
    });
  });

  const play = () => {
    sfx.unlock();
    showScreen('play');
    track('start');
    game.start();
  };
  $('#btn-play').addEventListener('click', play);
  $('#btn-again').addEventListener('click', play);
  $('#btn-share').hidden = !(navigator.share || navigator.clipboard);
  $('#btn-share').addEventListener('click', () => share(lastScore));

  document.body.classList.add('is-ready');
  track('view', { platform });
}

boot().catch((err) => {
  console.error('[feast-game] boot failed', err);
  document.body.classList.add('is-ready');
});
