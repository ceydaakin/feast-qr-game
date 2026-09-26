// Particles + floating text, pooled. Entries are mutated in place on purpose —
// allocating per frame would cause GC hitches on low-end phones. Popup text is
// rasterised once per distinct text/colour into a cached sprite; the frame loop
// only blits it (strokeText of colour emoji every frame was the #2 hotspot).

import { textSprite, createMemo } from './sprites.js';

const INK = '#3a1d10';
const FONT = '900 {px}px ui-rounded, system-ui, -apple-system, sans-serif';
const BIG_PX = 28;
const SMALL_PX = 22;
const BIG_POP = 1.4; // big popups start 1.4× larger; rendered at that size so they never upscale
const LINE_W = 6;
const EDGE = 24;

export function createFx(ctx) {
  const particles = Array.from({ length: 140 }, () => ({ active: false }));
  const popups = Array.from({ length: 16 }, () => ({ active: false, img: null }));
  const sprites = createMemo(64);
  let pCursor = 0;
  let live = 0; // active particles + popups, so busy() is O(1)
  let dpr = 1;
  let viewW = 360;

  function acquire(arr, from) {
    for (let n = 0; n < arr.length; n++) {
      const i = (from + n) % arr.length;
      if (!arr[i].active) return i;
    }
    return -1;
  }

  function burst(x, y, color, count, speed = 1) {
    for (let n = 0; n < count; n++) {
      const i = acquire(particles, pCursor);
      if (i < 0) return;
      pCursor = (i + 1) % particles.length;
      const p = particles[i];
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 200) * speed;
      const life = 0.45 + Math.random() * 0.3;
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 140;
      p.life = life; p.max = life; p.color = color; p.size = 3 + Math.random() * 4;
      live += 1;
    }
  }

  function spriteFor(text, color, big) {
    return sprites.get(`${text}|${color}|${big ? 1 : 0}`, () => {
      const k = big ? BIG_POP : 1;
      return textSprite(text, {
        font: FONT, px: (big ? BIG_PX : SMALL_PX) * k, color, stroke: INK, lineWidth: LINE_W * k, dpr,
      });
    });
  }

  function popup(x, y, text, color, big = false) {
    const i = acquire(popups, 0);
    if (i < 0) return;
    const p = popups[i];
    const life = big ? 1.3 : 0.7;
    p.active = true; p.x = x; p.y = y; p.big = big; p.life = life; p.max = life;
    p.img = spriteFor(text, color, big);
    // Same fit-to-screen rule as before: never wider than the viewport minus a margin.
    p.fitMax = (viewW - EDGE) / Math.max(1, p.img.textW / (big ? BIG_POP : 1));
    live += 1;
  }

  function update(dt) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; live -= 1; continue; }
      p.vy += 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; p.img = null; live -= 1; } else p.y -= 50 * dt;
    }
  }

  function draw() {
    if (!live) return;
    let color = null;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = p.life / p.max;
      if (p.color !== color) { color = p.color; ctx.fillStyle = color; }
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      if (!p.active) continue;
      const k = p.life / p.max;
      const pop = p.big ? 1 + Math.max(0, k - 0.8) * 2 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      const s = Math.min(pop, p.fitMax) / (p.big ? BIG_POP : 1);
      const w = p.img.cssW * s; const h = p.img.cssH * s;
      ctx.drawImage(p.img, p.x - w / 2, p.y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    for (let i = 0; i < particles.length; i++) particles[i].active = false;
    for (let i = 0; i < popups.length; i++) { popups[i].active = false; popups[i].img = null; }
    live = 0;
  }

  // Called on resize: sprites are re-rasterised at the new asset resolution.
  function reset(pixelRatio, width) {
    dpr = pixelRatio;
    viewW = width;
    sprites.clear(); // live popups keep their old sprite until they fade
  }

  const busy = () => live > 0;

  return { burst, popup, update, draw, clear, busy, reset, warm: spriteFor };
}
