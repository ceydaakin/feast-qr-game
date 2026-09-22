// Game engine: loop, input, collisions, rendering.
// Hot-path entities live in fixed object pools and are mutated in place on
// purpose — allocating per frame would cause GC hitches on low-end phones.

import {
  GAME, ITEMS, difficultyAt, pickItemKind, scoreFor, multiplierFor, chefStageFor,
} from './logic.js';
import { buildSpriteCache, renderBackground } from './art.js';

const MAX_DPR = 2;
const MAX_DT = 1 / 30;
const CHEF_ASPECT = 319 / 400;
// Where the pizza sits inside the chef sprite (fractions of sprite box).
const PIZZA = { cx: 0.74, cy: 0.735, rx: 0.2, ry: 0.05, catchY: 0.7 };
const MAX_TOPPINGS = 30;
const COLORS = { good: '#ffb100', bonus: '#ffd23f', bad: '#ff3131', ink: '#3a1d10' };
// Chef speech bubble timing (seconds).
const BUBBLE = { life: 2.6, gap: 1.2, idleEvery: 8.5 };
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';

function makePool(size, factory) {
  return Array.from({ length: size }, factory);
}

function acquire(pool) {
  for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
  return null;
}

export function createGame({ canvas, chefImages, sfx, t, chatter, onHud, onEnd }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const kinds = Object.keys(ITEMS);
  const items = makePool(40, () => ({ active: false }));
  const particles = makePool(80, () => ({ active: false }));
  const popups = makePool(14, () => ({ active: false }));
  const toppings = [];
  const keys = { left: false, right: false };

  let W = 0; let H = 0; let dpr = 1;
  let bg = null; let sprites = null;
  let itemSize = 56; let chefW = 0; let chefH = 0; let chefBottom = 0;
  let rafId = 0; let lastTs = 0;
  let s = freshState();

  function freshState() {
    return {
      running: false, over: false, elapsed: 0, score: 0, combo: 0, maxCombo: 0,
      caught: 0, lives: GAME.lives, magnetT: 0, spawnT: 0.4, countdown: 0,
      px: W / 2, targetX: W / 2, facing: 1, squash: 0, shake: 0, flash: 0,
      lastTickSec: -1, discovered: 0, stage: 0, rushSaid: false,
      bubble: null, bubbleGap: 0, idleT: BUBBLE.idleEvery,
    };
  }

  // ---------- layout ----------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    itemSize = Math.max(44, Math.min(72, W * 0.14));
    chefH = Math.min(H * 0.3, 300, (W * 0.58) / CHEF_ASPECT);
    chefW = chefH * CHEF_ASPECT;
    chefBottom = H * 0.9 + chefH * 0.02;
    bg = renderBackground(W, H, dpr);
    sprites = buildSpriteCache(kinds, Math.round(itemSize * 1.2 * dpr), (k) => ITEMS[k].type === 'bad');
    s.px = clampX(s.px || W / 2);
    s.targetX = clampX(s.targetX || W / 2);
    if (!s.running) draw();
  }

  const pizzaRX = () => chefW * PIZZA.rx;
  const catchY = () => chefBottom - chefH + chefH * PIZZA.catchY;
  const clampX = (x) => Math.max(pizzaRX() + 6, Math.min(W - pizzaRX() - 6, x));

  // ---------- input ----------
  function onPointer(e) {
    if (!s.running) return;
    const rect = canvas.getBoundingClientRect();
    s.targetX = clampX(e.clientX - rect.left);
  }
  function onKey(e, down) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = down;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = down;
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (s.running) {
      s.countdown = Math.max(s.countdown, 3);
      loop();
    }
  }

  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointermove', onPointer);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- spawning / effects ----------
  function spawnItem(diff) {
    const it = acquire(items);
    if (!it) return;
    const kind = pickItemKind(diff);
    const r = itemSize / 2;
    it.active = true;
    it.kind = kind;
    it.type = ITEMS[kind].type;
    it.r = r;
    it.x = r + 6 + Math.random() * (W - 2 * r - 12);
    it.y = -r;
    it.prevY = it.y;
    const speedJitter = 0.85 + Math.random() * 0.3;
    it.vy = diff.fallSpeed * H * speedJitter * (it.type === 'bonus' ? 0.8 : 1);
    const upright = it.type === 'discover';
    it.rot = upright ? 0 : Math.random() * Math.PI * 2;
    it.vr = upright ? 0 : (Math.random() - 0.5) * 3;
    it.sway = it.type === 'bonus' || upright ? 40 : 0;
    it.phase = Math.random() * Math.PI * 2;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const p = acquire(particles);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220;
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - 120;
      p.life = p.max = 0.5 + Math.random() * 0.3;
      p.color = color;
      p.size = 3 + Math.random() * 4;
    }
  }

  function popup(x, y, text, color, big = false) {
    const p = acquire(popups);
    if (!p) return;
    p.active = true;
    p.x = x; p.y = y; p.text = text; p.color = color;
    p.life = p.max = big ? 1.2 : 0.8;
    p.big = big;
  }

  function addTopping(kind) {
    if (toppings.length >= MAX_TOPPINGS) toppings.shift();
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * 0.78;
    toppings.push({ kind, u: Math.cos(a) * d, v: Math.sin(a) * d * 0.7 - 0.3, rot: Math.random() * 6.28 });
  }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // Chef speech bubble. `force` interrupts the current line (for key moments).
  function say(event, force = false) {
    if (!force && (s.bubble || s.bubbleGap > 0)) return;
    const text = chatter(event);
    if (!text) return;
    s.bubble = { lines: wrapText(text, Math.min(W - 40, 280)), life: BUBBLE.life };
    s.idleT = BUBBLE.idleEvery;
  }

  function wrapText(text, maxW) {
    ctx.font = `800 15px ${FONT}`;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const next = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(next).width > maxW) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, 3);
  }

  // ---------- catch outcomes ----------
  function onCatch(it) {
    const x = it.x; const y = catchY();
    if (it.type === 'bad') {
      s.lives -= 1;
      s.combo = 0;
      s.shake = 0.35;
      s.flash = 1;
      sfx.hurt();
      vibrate(90);
      burst(x, y, COLORS.bad, 14);
      popup(x, y - 30, t(`bad_${it.kind}`), COLORS.bad, true);
      say('bad', true);
      if (s.lives <= 0) finish('lives');
      return;
    }
    const pts = scoreFor(it.kind, s.combo);
    const prevMult = multiplierFor(s.combo);
    s.score += pts;
    s.combo += 1;
    s.caught += 1;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.squash = 1;
    if (it.type === 'bonus') {
      s.magnetT = GAME.magnetSec;
      sfx.bonus();
      vibrate(30);
      burst(x, y, COLORS.bonus, 22);
      popup(W / 2, H * 0.4, t('magnet'), COLORS.bonus, true);
      say('magnet', true);
    } else if (it.type === 'discover') {
      s.discovered += 1;
      sfx.bonus();
      vibrate(25);
      burst(x, y, COLORS.bad, 18);
      popup(W / 2, H * 0.36, t('newPlace'), COLORS.bad, true);
      say('discover', true);
    } else {
      sfx.catchGood(prevMult);
      burst(x, y, COLORS.good, 8);
      addTopping(it.kind);
    }
    popup(x, y - 20, `+${pts}`, it.type === 'bonus' ? COLORS.bonus : '#ffffff');
    const mult = multiplierFor(s.combo);
    if (mult > prevMult) {
      popup(W / 2, H * 0.32, `x${mult} ${t('combo')}`, '#ff3131', true);
      say('combo');
    }
    const stage = chefStageFor(s.score);
    if (stage !== s.stage) {
      s.stage = stage;
      say(`stage${stage}`, true);
    }
  }

  function finish(reason) {
    if (s.over) return;
    s.running = false;
    s.over = true;
    sfx.gameOver();
    vibrate(40);
    emitHud();
    onEnd({ score: s.score, caught: s.caught, maxCombo: s.maxCombo, discovered: s.discovered, reason });
  }

  // ---------- update ----------
  function update(dt) {
    s.shake = Math.max(0, s.shake - dt);
    s.flash = Math.max(0, s.flash - dt * 2.5);
    s.squash = Math.max(0, s.squash - dt * 5);

    if (keys.left) s.targetX = clampX(s.targetX - W * 1.4 * dt);
    if (keys.right) s.targetX = clampX(s.targetX + W * 1.4 * dt);
    s.px += (s.targetX - s.px) * (1 - Math.exp(-dt * 22));
    // Body flips to the inner side near screen edges so the chef stays on-screen.
    if (s.facing === 1 && s.px < W * 0.38) s.facing = -1;
    else if (s.facing === -1 && s.px > W * 0.62) s.facing = 1;

    updateEffects(dt);
    updateBubble(dt);

    if (s.countdown > 0) {
      const before = Math.ceil(s.countdown);
      s.countdown -= dt;
      if (Math.ceil(s.countdown) !== before && s.countdown > 0) sfx.tick();
      if (s.countdown <= 0 && s.running) say('start', true);
      return;
    }
    if (!s.running) return;

    s.elapsed += dt;
    s.magnetT = Math.max(0, s.magnetT - dt);
    const left = GAME.durationSec - s.elapsed;
    const sec = Math.ceil(left);
    if (left <= 5 && sec !== s.lastTickSec) {
      s.lastTickSec = sec;
      sfx.tick();
    }

    if (left <= GAME.finalRushSec && !s.rushSaid) {
      s.rushSaid = true;
      say('rush', true);
    }
    s.idleT -= dt;
    if (s.idleT <= 0) say('idle');

    const diff = difficultyAt(s.elapsed);
    const rush = left <= GAME.finalRushSec ? 0.8 : 1;
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      spawnItem(diff);
      s.spawnT = diff.spawnEvery * rush * (0.75 + Math.random() * 0.5);
    }

    updateItems(dt);
    if (left <= 0) finish('time');
  }

  function updateItems(dt) {
    const cy = catchY();
    const reach = pizzaRX();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.active) continue;
      it.prevY = it.y;
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
      if (it.sway) it.x += Math.sin(s.elapsed * 3 + it.phase) * it.sway * dt;
      if (s.magnetT > 0 && it.type !== 'bad' && it.y > H * 0.25) {
        const dx = s.px - it.x;
        it.x += Math.sign(dx) * Math.min(Math.abs(dx), GAME.magnetPull * dt);
      }
      if (it.prevY < cy && it.y >= cy && Math.abs(it.x - s.px) <= reach + it.r * 0.45) {
        it.active = false;
        onCatch(it);
        if (s.over) return;
        continue;
      }
      if (it.y - it.r > H) {
        it.active = false;
        if (it.type === 'good') s.combo = 0;
      }
    }
  }

  function updateBubble(dt) {
    s.bubbleGap = Math.max(0, s.bubbleGap - dt);
    if (!s.bubble) return;
    s.bubble.life -= dt;
    if (s.bubble.life <= 0) {
      s.bubble = null;
      s.bubbleGap = BUBBLE.gap;
    }
  }

  function updateEffects(dt) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.y -= 50 * dt;
    }
  }

  // ---------- render ----------
  function draw() {
    if (!bg) return;
    const sx = s.shake > 0 ? (Math.random() - 0.5) * 14 * s.shake : 0;
    const sy = s.shake > 0 ? (Math.random() - 0.5) * 14 * s.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    ctx.drawImage(bg, 0, 0, W, H);
    drawChef();
    drawItems();
    drawParticles();
    drawPopups();
    if (s.bubble) drawBubble();
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,49,49,${s.flash * 0.22})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (s.countdown > 0) drawCountdown();
  }

  function drawChef() {
    const img = chefImages[chefStageFor(s.score)];
    const sq = s.squash * 0.06;
    ctx.save();
    ctx.translate(s.px, chefBottom);
    ctx.scale(s.facing * (1 + sq), 1 - sq);
    // ground shadow
    ctx.fillStyle = 'rgba(58,29,16,0.18)';
    ctx.beginPath();
    ctx.ellipse(-chefW * 0.3, -2, chefW * 0.4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (s.magnetT > 0) {
      const pulse = 0.6 + Math.sin(performance.now() / 90) * 0.25;
      ctx.fillStyle = `rgba(255,210,63,${0.35 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(0, -chefH * (1 - PIZZA.cy), chefW * 0.34, chefH * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const left = -chefW * PIZZA.cx;
    const top = -chefH;
    if (img && img.complete) ctx.drawImage(img, left, top, chefW, chefH);
    const size = itemSize * 0.42;
    const pcx = 0; const pcy = top + chefH * PIZZA.cy;
    const rx = chefW * PIZZA.rx; const ry = chefH * PIZZA.ry;
    for (let i = 0; i < toppings.length; i++) {
      const tp = toppings[i];
      ctx.save();
      ctx.translate(pcx + tp.u * rx, pcy + tp.v * ry);
      ctx.rotate(tp.rot);
      ctx.drawImage(sprites[tp.kind], -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawItems() {
    const size = itemSize * 1.2;
    const half = size / 2;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.active) continue;
      const c = Math.cos(it.rot) * dpr; const sn = Math.sin(it.rot) * dpr;
      ctx.setTransform(c, sn, -sn, c, it.x * dpr, it.y * dpr);
      ctx.drawImage(sprites[it.kind], -half, -half, size, size);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      if (!p.active) continue;
      const k = p.life / p.max;
      const pop = p.big ? 1 + Math.max(0, k - 0.8) * 2 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${Math.round((p.big ? 28 : 22) * pop)}px ui-rounded, system-ui, -apple-system, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = COLORS.ink;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  // Speech bubble anchored above the chef's head, clamped inside the screen.
  function drawBubble() {
    const b = s.bubble;
    const age = BUBBLE.life - b.life;
    const pop = Math.min(1, age / 0.18);
    const fade = Math.min(1, b.life / 0.3);
    const lineH = 19;
    ctx.font = `800 15px ${FONT}`;
    const textW = Math.max(...b.lines.map((l) => ctx.measureText(l).width));
    const bw = textW + 28;
    const bh = b.lines.length * lineH + 18;
    const headX = s.px + (0.36 - PIZZA.cx) * chefW * s.facing;
    const tipY = chefBottom - chefH * 0.98;
    const bx = Math.max(10, Math.min(W - bw - 10, headX - bw / 2));
    const by = tipY - bh - 14;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(headX, tipY);
    ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    ctx.translate(-headX, -tipY);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 16);
    else ctx.rect(bx, by, bw, bh); // iOS < 16
    ctx.moveTo(headX - 9, by + bh - 1);
    ctx.lineTo(headX, tipY);
    ctx.lineTo(headX + 9, by + bh - 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    // hide the stroke seam where the tail joins the box
    ctx.fillRect(headX - 7.5, by + bh - 3, 15, 4);
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    b.lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 9 + lineH * (i + 0.5)));
    ctx.restore();
  }

  function drawCountdown() {
    const n = Math.ceil(s.countdown);
    const frac = s.countdown - Math.floor(s.countdown);
    const scale = 1 + frac * 0.6;
    ctx.save();
    ctx.translate(W / 2, H * 0.4);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, frac * 3 + 0.2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 96px ui-rounded, system-ui, -apple-system, sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeStyle = COLORS.ink;
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = '#ff3131';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }

  // ---------- HUD bridge ----------
  function emitHud() {
    onHud({
      score: s.score,
      lives: s.lives,
      timeLeft: Math.max(0, GAME.durationSec - s.elapsed),
      multiplier: multiplierFor(s.combo),
      magnet: s.magnetT > 0,
    });
  }

  // ---------- loop ----------
  function loop() {
    lastTs = 0;
    const frame = (ts) => {
      const dt = lastTs ? Math.min(MAX_DT, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      update(dt);
      draw();
      if (s.running) emitHud();
      const idle = !s.running && !hasLiveEffects();
      rafId = idle ? 0 : requestAnimationFrame(frame);
    };
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function hasLiveEffects() {
    return particles.some((p) => p.active) || popups.some((p) => p.active);
  }

  function start() {
    items.forEach((it) => { it.active = false; });
    particles.forEach((p) => { p.active = false; });
    popups.forEach((p) => { p.active = false; });
    toppings.length = 0;
    s = freshState();
    s.px = s.targetX = W / 2;
    s.running = true;
    s.countdown = 3;
    sfx.tick();
    emitHud();
    loop();
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onPointer);
    canvas.removeEventListener('pointermove', onPointer);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  resize();
  return { start, resize, destroy };
}
