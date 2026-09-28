// End-to-end check of the İTÜ reward flow in real Chrome. Needs `npm run serve`
// in another terminal. Plays one full round, so it takes up to about a minute.
// Every check runs even if an earlier one fails; the run fails at the end.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_URL || 'http://localhost:5174/';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const SIZES = [[320, 568], [375, 667], [390, 844], [1280, 720], [568, 320], [640, 300], [667, 375], [844, 390]];
const LOCALES = ['tr', 'en'];

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
    console.log(`FAIL  ${name}\n      ${String(err.message).split('\n')[0]}`);
  }
}

// `npm run serve` (python http.server) sometimes resets a module request under
// load, so a page that never becomes ready gets a few reloads before failing.
async function open(context, query = '?src=itu', attempts = 4) {
  const page = await context.newPage();
  for (let i = 1; ; i++) {
    await page.goto(BASE + query);
    try {
      await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 5_000 });
      return page;
    } catch (err) {
      if (i >= attempts) throw err;
    }
  }
}

// Test-only: jump straight to the reward screen (skips a 45 s round).
const forceReward = (page) => page.evaluate(() => {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === 'reward'));
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

  await check('returning visitor lands on the ready screen', async () => {
    const page = await open(mobile);
    assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');
    await page.close();
  });

  await check('BAŞLA starts the game even while images are still loading', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA });
    await ctx.route('**/assets/cuisine/**', async (route) => {
      await new Promise((r) => setTimeout(r, 2_500));
      await route.continue();
    });
    const page = await ctx.newPage();
    // 'load' would wait for the delayed images; the intro runs before that.
    await page.goto(`${BASE}?src=itu`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('intro').dataset.step);
    await page.click('#intro', { position: { x: 20, y: 20 } });
    await page.click('#btn-reward-play', { force: true });
    assert.equal(await page.evaluate(() => document.body.classList.contains('is-ready')), false, 'images should still be loading');
    await waitForScreen(page, 'play', 8_000);
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
    assert.ok(await page.locator('#reward-chat li').count() >= 2);
    assert.equal(await page.isVisible('[data-store="reward"]'), true, 'TOPLA visible on phones');
    assert.equal(await page.isHidden('#reward [data-desktop-only]'), true, 'QR hidden on phones');
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
      await check(`${lang} ${width}x${height}: BAŞLA and TOPLA reachable`, async () => {
        const ctx = await browser.newContext({ viewport: { width, height }, userAgent: IPHONE_UA });
        try {
          const page = await open(ctx, `?src=itu&lang=${lang}`);
          await page.click('#intro', { position: { x: 5, y: 5 } });
          assert.ok(await reachable(page, '#btn-reward-play'), 'BAŞLA unreachable');
          assert.ok(await reachable(page, '.intro-ready .intro-lead'), 'ready-screen lead clipped');
          await forceReward(page);
          assert.ok(await reachable(page, '[data-store="reward"]'), 'TOPLA unreachable');
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
