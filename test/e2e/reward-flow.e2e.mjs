// End-to-end check of the İTÜ reward flow in real Chrome. Needs `npm run serve`
// in another terminal. Plays one full round, so it takes up to about a minute.
// Every check runs even if an earlier one fails; the run fails at the end.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_URL || 'http://localhost:5174/';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
// Phone-first: the game is a feast ad opened from a QR code on phones.
const SIZES = [
  [320, 568], [360, 640], [375, 667], [360, 740], [390, 844], [412, 915], [430, 932],
  [568, 320], [640, 300], [667, 375], [844, 390], [932, 430], [1280, 720],
];
const LOCALES = ['tr', 'en'];
const IMAGE_DELAY_MS = 5_000; // long enough that BAŞLA is surely tapped before images arrive

const browser = await chromium.launch({ channel: 'chrome' });
const failures = [];
const active = (page) => page.evaluate(() => document.querySelector('.screen.is-active')?.id);
const waitForScreen = (page, id, timeout) => page.waitForFunction(
  (want) => document.querySelector('.screen.is-active')?.id === want, id, { timeout },
);

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures.push(name);
    const detail = String(err.message).split('\n').filter((l) => l.trim()).slice(0, 6).join('\n      ');
    console.log(`FAIL  ${name}\n      ${detail}`);
  }
}

// `npm run serve` (python http.server) sometimes resets a request under load
// (a JS module, a stylesheet…), which leaves the page half-loaded. Such a load
// is retried instead of being judged; the dropped URLs are logged.
async function open(context, query = '?src=itu', attempts = 4) {
  const page = await context.newPage();
  let dropped = [];
  page.on('requestfailed', (req) => dropped.push(req.url().replace(BASE, '')));
  for (let i = 1; ; i++) {
    dropped = [];
    await page.goto(BASE + query);
    try {
      await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 5_000 });
      if (!dropped.length) return page;
      throw new Error(`dev server dropped: ${dropped.join(', ')}`);
    } catch (err) {
      console.log(`      (reload ${i}: ${String(err.message).split('\n')[0]})`);
      if (i >= attempts) throw err;
    }
  }
}

const showOnly = (page, id) => page.evaluate((want) => {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === want));
}, id);

// Test-only: jump straight to a filled reward screen (skips a 45 s round).
const forceReward = (page) => page.evaluate(async () => {
  const { renderReward } = await import('/js/reward-ui.js');
  const { makeT } = await import('/js/i18n.js');
  const { pickTheme } = await import('/js/themes.js'); const { themeStringsWithReward } = await import('/js/campus.js');
  const t = makeT(document.documentElement.lang, themeStringsWithReward(pickTheme('itu'), new URLSearchParams(location.search).get('campus')));
  renderReward({
    avatarsEl: document.getElementById('reward-avatars'),
    placesEl: document.getElementById('reward-places'),
    scoreEl: document.getElementById('reward-score'),
    scoreText: t('rewardScore', { score: 1688 }),
  });
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === 'reward'));
});

// Every visible element of the active screen lies inside the viewport and the
// screen does not need scrolling. Returns the offending extent, or null.
const overflow = (page) => page.evaluate(() => {
  const screen = document.querySelector('.screen.is-active');
  screen.scrollTop = 0;
  const box = { top: Infinity, bottom: -Infinity, left: Infinity, right: -Infinity };
  screen.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
    box.top = Math.min(box.top, r.top); box.bottom = Math.max(box.bottom, r.bottom);
    box.left = Math.min(box.left, r.left); box.right = Math.max(box.right, r.right);
  });
  const scrolls = screen.scrollHeight > screen.clientHeight + 1;
  const fits = box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth && !scrolls;
  return fits ? null : `${screen.id}: y ${Math.round(box.top)}..${Math.round(box.bottom)} / ${innerHeight}, x ${Math.round(box.left)}..${Math.round(box.right)} / ${innerWidth}${scrolls ? ', scrolls' : ''}`;
});

// True when the element is visible and fits the viewport — after scrolling it
// into view, but only if its screen is one the user can actually scroll.
async function reachable(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return false;
    if (el.closest('.screen')?.classList.contains('scrollable')) el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  }, selector);
}

// Animations still running on elements inside screens that are not shown.
const hiddenAnimations = (page) => page.evaluate(() => document.getAnimations()
  .filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.screen:not(.is-active)'))
  .map((a) => `${a.effect.target.closest('.screen').id}:${a.effect.target.className}:${a.animationName}`));

try {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  await check('first visit plays the intro; a tap skips to ready', async () => {
    const page = await open(mobile);
    assert.equal(await active(page), 'intro');
    assert.equal(await page.getAttribute('#intro', 'data-step'), 'mystery');
    await page.click('#intro', { position: { x: 20, y: 20 } });
    assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');
    await page.close();
  });

  await check('feast leads the intro: logo on the brand, promise and ready frames', async () => {
    const page = await open(mobile);
    for (const step of ['brand', 'promise', 'ready']) {
      await page.evaluate((id) => { document.getElementById('intro').dataset.step = id; }, step);
      assert.ok(await page.isVisible(`[data-frame="${step}"] img.intro-logo`), `no feast logo on ${step}`);
    }
    assert.equal(await page.textContent('[data-frame="brand"]').then((x) => x.includes('İTÜ\'lülere')), true);
    await page.close();
  });

  await check('returning visitor lands on the ready screen', async () => {
    const page = await open(mobile);
    assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');
    await page.close();
  });

  await check('BAŞLA starts the game even while images are still loading', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA });
    await ctx.route('**/assets/cuisine/**', async (route) => {
      await new Promise((r) => setTimeout(r, IMAGE_DELAY_MS));
      await route.continue();
    });
    const page = await ctx.newPage();
    // 'load' would wait for the delayed images; the intro runs before that.
    // Same dev-server retry as open(): a reset module request never starts the intro.
    for (let i = 1; ; i++) {
      await page.goto(`${BASE}?src=itu`, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForFunction(() => document.getElementById('intro').dataset.step, null, { timeout: 5_000 });
        break;
      } catch (err) {
        if (i >= 4) throw err;
      }
    }
    await page.click('#intro', { position: { x: 20, y: 20 } });
    await page.click('#btn-reward-play', { force: true });
    assert.equal(await page.evaluate(() => document.body.classList.contains('is-ready')), false, 'images should still be loading');
    await waitForScreen(page, 'play', IMAGE_DELAY_MS + 5_000);
    await ctx.close();
  });

  await check('no animations run on hidden screens during a classic round', async () => {
    const page = await open(desktop, '');
    await page.click('#btn-play', { force: true });
    await page.waitForTimeout(1_000);
    assert.deepEqual(await hiddenAnimations(page), []);
    await page.close();
  });

  await check('full İTÜ round → box opens once on double tap → reward', async () => {
    const page = await open(mobile);
    await page.click('#btn-reward-play', { force: true });
    assert.equal(await active(page), 'play');
    await page.waitForTimeout(1_000);
    assert.deepEqual(await hiddenAnimations(page), [], 'hidden animations during İTÜ round');
    await waitForScreen(page, 'box', 60_000);
    await page.click('#btn-box', { force: true });
    await page.click('#btn-box', { force: true });
    await waitForScreen(page, 'reward', 5_000);
    assert.equal(await page.locator('#reward-places .place-card').count(), 4);
    assert.equal(await page.isVisible('[data-store="reward"]'), true, 'TOPLA visible on phones');
    assert.equal(await page.isHidden('#reward [data-desktop-only]'), true, 'QR hidden on phones');
    await page.close();
  });

  await check('?campus= renames the campus in the intro and the reward title', async () => {
    const page = await open(desktop, '?src=itu&campus=ODTÜ');
    await page.click('#intro', { position: { x: 5, y: 5 } });
    assert.match(await page.textContent('[data-frame="ready"] .intro-lead'), /ODTÜ'lülere özel/);
    await forceReward(page);
    assert.match(await page.textContent('.reward-title'), /^ODTÜ'de, Kadıköy'de/);
    await page.close();
  });

  await check('reward is kept simple: restaurant cards (Mustachio first), no chat or sticker', async () => {
    const page = await open(mobile);
    await forceReward(page);
    const cards = await page.locator('#reward-places .place-card').allTextContents();
    assert.ok(cards.length >= 3, `only ${cards.length} restaurant cards`);
    assert.match(cards[0], /Mustachio/);
    assert.equal(await page.locator('#reward .reward-chat, #reward .chef-sticker').count(), 0);
    await page.close();
  });

  await check('box opening: shake builds up, then flash and particles', async () => {
    const page = await open(mobile);
    await showOnly(page, 'box');
    await page.evaluate(async () => {
      const { openBoxScreen } = await import('/js/reward-ui.js');
      openBoxScreen({ root: document.getElementById('box'), button: document.getElementById('btn-box'), onOpened: () => {} });
    });
    await page.click('#btn-box', { force: true });
    await page.waitForTimeout(900);
    const sparks = await page.evaluate(() => [...document.querySelectorAll('#box .box-spark')]
      .filter((el) => el.getAnimations().some((a) => a.playState === 'running')).length);
    assert.ok(sparks >= 8, `${sparks} flying particles`);
    assert.ok(await page.evaluate(() => document.querySelector('#box .box-flash')?.getAnimations().length > 0), 'no flash');
    await page.close();
  });

  await check('desktop: TOPLA hidden, QR shown', async () => {
    const page = await open(desktop);
    await forceReward(page);
    assert.equal(await page.isHidden('[data-store="reward"]'), true);
    assert.equal(await page.isVisible('#reward [data-desktop-only]'), true);
    await page.close();
  });

  await check('classic flow still opens on the start screen', async () => {
    const page = await open(desktop, '');
    assert.equal(await active(page), 'start');
    await page.close();
  });

  for (const lang of LOCALES) {
    for (const [width, height] of SIZES) {
      await check(`${lang} ${width}x${height}: ready, box and reward fit without scrolling`, async () => {
        const ctx = await browser.newContext({ viewport: { width, height }, userAgent: IPHONE_UA });
        try {
          const page = await open(ctx, `?src=itu&lang=${lang}`);
          await page.click('#intro', { position: { x: 5, y: 5 } });
          const problems = [await overflow(page)];
          await showOnly(page, 'box');
          problems.push(await overflow(page));
          await forceReward(page);
          problems.push(await overflow(page));
          assert.ok(await reachable(page, '[data-store="reward"]'), 'TOPLA not on screen');
          assert.deepEqual(problems.filter(Boolean), []);
        } finally {
          await ctx.close();
        }
      });
    }
  }
} finally {
  await browser.close();
}

assert.deepEqual(failures, [], `${failures.length} e2e check(s) failed`);
console.log('reward flow e2e: all checks passed');
