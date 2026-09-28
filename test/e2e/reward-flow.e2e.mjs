// End-to-end check of the İTÜ reward flow in real Chrome. Needs `npm run serve`
// in another terminal. Plays one full round, so it takes up to about a minute.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_URL || 'http://localhost:5174/';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const SIZES = [[320, 568], [375, 667], [390, 844], [1280, 720], [568, 320], [667, 375], [844, 390]];

const browser = await chromium.launch({ channel: 'chrome' });
const active = (page) => page.evaluate(() => document.querySelector('.screen.is-active')?.id);

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

// True when the element is visible and fits the viewport once scrolled into view.
async function reachable(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return false;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  }, selector);
}

try {
  // 1. First visit plays the intro; a tap skips to the ready screen.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true });
  let page = await open(mobile);
  assert.equal(await active(page), 'intro');
  assert.equal(await page.getAttribute('#intro', 'data-step'), 'mystery');
  await page.click('#intro', { position: { x: 20, y: 20 } });
  assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');

  // 2. Returning visitor lands on the ready screen directly.
  await page.close();
  page = await open(mobile);
  assert.equal(await page.getAttribute('#intro', 'data-step'), 'ready');

  // 3. Play a full round → box → double tap opens once → reward.
  await page.click('#btn-reward-play', { force: true });
  assert.equal(await active(page), 'play');
  await page.waitForFunction(() => document.querySelector('.screen.is-active')?.id === 'box', null, { timeout: 60_000 });
  await page.click('#btn-box', { force: true });
  await page.click('#btn-box', { force: true });
  await page.waitForFunction(() => document.querySelector('.screen.is-active')?.id === 'reward', null, { timeout: 5_000 });
  assert.ok(await page.locator('#reward-chat li').count() >= 2);
  assert.equal(await page.isVisible('[data-store="reward"]'), true, 'TOPLA visible on phones');
  assert.equal(await page.isHidden('#reward [data-desktop-only]'), true, 'QR hidden on phones');

  // 4. Desktop: TOPLA hidden, QR shown.
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const dpage = await open(desktop);
  await forceReward(dpage);
  assert.equal(await dpage.isHidden('[data-store="reward"]'), true, 'TOPLA hidden on desktop');
  assert.equal(await dpage.isVisible('#reward [data-desktop-only]'), true, 'QR shown on desktop');

  // 5. Classic flow is untouched.
  const classic = await open(desktop, '');
  assert.equal(await active(classic), 'start');

  // 6. Size sweep: BAŞLA and TOPLA reachable on every size.
  for (const [width, height] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width, height }, userAgent: IPHONE_UA });
    const p = await open(ctx);
    await p.click('#intro', { position: { x: 5, y: 5 } });
    assert.ok(await reachable(p, '#btn-reward-play'), `BAŞLA unreachable at ${width}x${height}`);
    await forceReward(p);
    assert.ok(await reachable(p, '[data-store="reward"]'), `TOPLA unreachable at ${width}x${height}`);
    await ctx.close();
  }

  console.log('reward flow e2e: all checks passed');
} finally {
  await browser.close();
}
