// Crowd-shooter engine (Last Z style): drag to steer the chef squad, pass through
// gates to grow it, throw food to feed hungry crowds and unlock restaurants.
// Hot-path entities live in fixed object pools and are mutated in place on
// purpose — allocating per frame would cause GC hitches on low-end phones.

import {
  SQUAD, applyGate, gateLabel, isGoodGate, gateSide, formation, squadRadius, squadReach, volleyDamage,
  contactLoss, speedAt, pickSegment, blockReward, crowdScore, dragToX, ROUND, roundLeft, isFinalStretch,
} from './squad-logic.js';
import { buildSpriteCache } from './art.js';
import { buildBillboard, buildSign, renderSky, renderStadium, GROUNDS } from './scenery.js';
import { createBees } from './bees.js';
import { createLabelCache } from './labels.js';
import { buildCrowdSprites, buildGateSprites } from './crowd-art.js';
import { createFx } from './fx.js';
import { createGround } from './ground.js';
import { createOverlays } from './overlays.js';
import { createMemo, shadowSprite, spinStrip, SPIN_PAD } from './sprites.js';

const MAX_DPR = 2;
const MIN_DPR = 1;
// Backing-store budget in device px: a 390×844 phone renders at ~1.6× instead
// of 2–3×. The scene is fill-bound, and the flat cartoon art stays crisp.
const PIXEL_BUDGET = 0.85e6;
const DPR_STEP = 0.25;
const SLOW_FRAME = 1 / 50; // average frame time above this drops render resolution
const PERF_WINDOW = 1; // seconds of slow frames before stepping resolution down
const SPIN_STEPS = 16; // pre-rotated frames per thrown food
const HUD_TEXT_EVERY = 0.1; // score/metres DOM text at 10 Hz (count/pins/time stay instant)
const TIMEBAR_STEPS = 400; // timer bar moves in sub-pixel steps, not every frame
const GATE_MEMO = 16;
const COUNTDOWN = 2;
const SHADOW = 'rgba(40,20,10,0.2)';
const GATE_PREVIEW_Z = 16; // road units ahead where the chosen gate starts to stand out
const GATE_DIM = 0.35;
const STEER_RATE = 18;
const MAX_DT = 1 / 30;
const COLORS = { gold: '#ffd23f', red: '#ff3131', ink: '#3a1d10', green: '#2bb673', food: '#ffb100' };
const BUBBLE = { life: 2.6, gap: 1.2, idleEvery: 8.5 };
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';
const FOOD = ['tomato', 'cheese', 'pepperoni', 'mushroom', 'olive', 'basil'];
const SQUAD_Z = 2.2;
const LANE_MAX = 180; // px; lane width also scales with height so landscape/short screens fit
const LANE_W_FRAC = 0.31;
const LANE_H_FRAC = 0.25;
const BILLBOARD_EVERY = 21;
const MAX_EMITTERS = 5;
const KEY_SPEED = 3.2; // road units per second with arrow keys
const HALF_W = { eater: 0.24, big: 0.42, block: 0.72, boss: 0.95 };
const TARGETS = new Set(['eater', 'big', 'block', 'boss']);
const OPENING = ['gates', 'horde', 'gates', 'block', 'horde', 'gates']; // teaches each mechanic once

const pool = (n) => Array.from({ length: n }, () => ({ active: false }));
function acquire(arr) {
  for (let i = 0; i < arr.length; i++) if (!arr[i].active) return arr[i];
  return null;
}
const byDepth = (a, b) => b.z - a.z;

export function createGame({ canvas, places, theme = null, locale = 'tr', sfx, t, chatter, onHud, onEnd }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const fx = createFx(ctx);
  const labels = createLabelCache({ font: FONT, ink: COLORS.ink });
  const overlays = createOverlays({ font: FONT, colors: COLORS });
  const gateMemo = createMemo(GATE_MEMO);
  const entities = pool(110);
  const bullets = pool(150);
  const drawList = [];
  const targets = []; // live shootable entities, rebuilt once per frame
  const hud = { score: 0, count: 0, meters: 0, pins: 0, timeLeft: 0, timeFrac: 0, rush: false };
  let hudT = 0;
  const drag = { active: false, px: 0 };
  const keys = { left: false, right: false };
  const scene = theme?.scene || {};
  const ground = GROUNDS[scene.ground] || GROUNDS.street;
  const bees = scene.bees ? createBees(scene.bees) : null;

  // dpr = resolution of the main canvas; adpr = resolution the sprites were
  // rasterised at. Adaptive resolution only changes dpr, so a downgrade never
  // rebuilds assets mid-run (that rebuild was a 50–150 ms hitch on slow phones).
  let W = 0; let H = 0; let dpr = 1; let adpr = 1;
  let horizonY = 0; let groundY = 0; let laneW = 0;
  let backdrop = null; let spins = null; let art = null; let boardSprites = [];
  let shadowImg = null; let tutLines = [];
  let slots = []; let slotOrder = []; let slotsFor = -1;
  let rafId = 0; let lastTs = 0;
  let dprCap = MAX_DPR;
  let ox = 0; let oy = 0; // screen-shake offset of the current frame
  const perf = { avg: 1 / 60, t: 0 };
  let s = freshState();

  function freshState() {
    return {
      running: false, over: false, elapsed: 0, dist: 0, score: 0,
      count: SQUAD.startCount, peak: SQUAD.startCount, fed: 0, discovered: 0,
      x: 0, sx: 0, fireT: 0, segIdx: 0, nextSegAt: 6, nextBoardAt: 10, boardSide: 1, boardIdx: 0,
      runPhase: 0, countdown: 0, shake: 0, flash: 0, bumpT: 0, nextFedCall: 25,
      bubble: null, bubbleGap: 0, idleT: BUBBLE.idleEvery,
    };
  }

  // ---------- projection ----------
  const scaleAt = (z) => SQUAD.camDist / (z + SQUAD.camDist);
  const yAt = (z) => horizonY + (groundY - horizonY) * scaleAt(z);
  const xAt = (x, z) => W / 2 + x * laneW * scaleAt(z);
  const roadPx = () => SQUAD.roadHalf * 2 * laneW * scaleAt(SQUAD_Z);
  const groundLayer = createGround(ground, { xAt, yAt });

  function pickDpr(w, h) {
    const budget = Math.sqrt(PIXEL_BUDGET / (w * h));
    return Math.max(MIN_DPR, Math.min(window.devicePixelRatio || 1, dprCap, budget));
  }

  // Only the backing store: cheap, no sprite work.
  function setRenderScale(next) {
    dpr = next;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const next = pickDpr(w, h);
    const sizeChanged = w !== W || h !== H;
    // Mobile browsers fire resize for URL-bar/scroll quirks: skip no-op rebuilds.
    if (!sizeChanged && next === dpr && backdrop) return;
    W = w;
    H = h;
    setRenderScale(next);
    if (sizeChanged || !backdrop || next > adpr) buildAssets();
    if (!s.running) draw();
  }

  function buildAssets() {
    adpr = dpr;
    horizonY = H * 0.24;
    groundY = H * 0.93;
    laneW = Math.min(W * LANE_W_FRAC, H * LANE_H_FRAC, LANE_MAX);
    labels.reset(adpr);
    overlays.reset(adpr);
    fx.reset(adpr, W);
    gateMemo.clear();
    const sky = scene.sky === 'stadium' ? renderStadium(W, horizonY, adpr) : renderSky(W, horizonY, adpr);
    backdrop = groundLayer.renderBackdrop(sky, W, H, horizonY, groundY, adpr, ctx);
    bees?.resize(W, horizonY * 0.55, H * 0.55, laneW * 0.2, adpr);
    const food = buildSpriteCache(FOOD, Math.round(laneW * 0.26 * adpr), () => false);
    spins = FOOD.map((k) => spinStrip(food[k], SPIN_STEPS));
    shadowImg = shadowSprite(SHADOW, adpr);
    art = buildCrowdSprites(laneW, adpr, places, theme?.art);
    const ads = places.map((p) => buildBillboard(p.img, p.label, t('boardCta'), laneW, adpr));
    const signs = (theme?.signs?.[locale] || []).map((lines) => buildSign(lines, laneW, adpr));
    // Alternate feast ads with event signs: ad, sign, ad, sign…
    boardSprites = ads.flatMap((ad, i) => (signs.length ? [ad, signs[i % signs.length]] : [ad]));
    tutLines = [t('tutTime'), t('tutDrag'), t('tutGates'), t('tutFeed')];
    fx.warm('😋', '#ffffff', false); // the most common popup, ready before the first kill
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.active && e.cat === 'gates') e.sprites = gateSprites(e.gates);
    }
  }

  // Gate panels repeat a lot (+5, ×2, ÷2…): build each label once per resize.
  function gateSprites(gates) {
    return gates.map((g) => gateMemo.get(gateLabel(g), () => buildGateSprites([g], laneW, adpr)[0]));
  }

  // ---------- input ----------
  function onDown(e) {
    drag.active = true;
    drag.px = e.clientX;
  }
  // Incremental steering: reversing a swipe responds instantly even after the
  // squad hit the road edge (no dead zone to swipe back through).
  function onMove(e) {
    if (!drag.active || !s.running) return;
    const reach = squadReach(s.count);
    s.x = Math.max(-reach, Math.min(reach, dragToX(s.x, e.clientX - drag.px, roadPx())));
    drag.px = e.clientX;
  }
  function onUp() {
    drag.active = false;
  }
  const KEYMAP = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  function onKey(e) {
    const dir = KEYMAP[e.key];
    if (!dir) return;
    e.preventDefault();
    keys[dir] = e.type === 'keydown';
  }
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (s.running) {
      s.countdown = Math.max(s.countdown, COUNTDOWN);
      loop();
    }
  }

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- spawning ----------
  function spawn(props) {
    const e = acquire(entities);
    if (!e) return null;
    Object.assign(e, props);
    e.active = true;
    e.hitT = 0;
    e.taken = null;
    e.bob = Math.random() * 6.28;
    e.isTarget = TARGETS.has(e.cat);
    return e;
  }

  function spawnSegment() {
    const idx = s.segIdx;
    s.segIdx += 1;
    const boss = idx >= SQUAD.firstBoss && (idx + 1) % SQUAD.bossEvery === 0;
    const type = OPENING[idx] || (boss ? 'boss' : null);
    const seg = pickSegment(Math.random, Math.min(1, s.elapsed / (ROUND.seconds * 1.25)), s.count, type);
    const z = SQUAD.spawnZ;
    if (seg.type === 'gates') {
      spawn({ cat: 'gates', x: 0, z, gates: seg.gates, sprites: gateSprites(seg.gates) });
    } else if (seg.type === 'horde') {
      seg.eaters.forEach((ea) => spawn({
        cat: ea.big ? 'big' : 'eater', x: ea.x, z: z + ea.dz, hp: ea.hp, maxHp: ea.hp,
        look: Math.floor(Math.random() * art.eaters.length),
      }));
    } else if (seg.type === 'block') {
      spawn({ cat: 'block', x: seg.x, z, hp: seg.hp, maxHp: seg.hp, place: seg.cuisine % places.length });
    } else {
      spawn({ cat: 'boss', x: 0, z: z + 6, hp: seg.hp, maxHp: seg.hp });
      fx.popup(W / 2, H * 0.3, t('bossIncoming'), COLORS.red, true);
      say('boss', true);
    }
    const extra = { horde: 7, boss: 16, block: 3 }[seg.type] || 0;
    s.nextSegAt = s.dist + SQUAD.segmentGap + extra;
  }

  function spawnBoard() {
    if (boardSprites.length) {
      spawn({ cat: 'board', sprite: boardSprites[s.boardIdx % boardSprites.length], x: s.boardSide * 2.45, z: SQUAD.spawnZ });
      s.boardIdx += 1;
      s.boardSide *= -1;
    }
    s.nextBoardAt = s.dist + BILLBOARD_EVERY;
  }

  function fire() {
    const k = Math.min(slots.length, MAX_EMITTERS);
    const dmg = volleyDamage(s.count, k);
    for (let j = 0; j < k; j++) {
      const b = acquire(bullets);
      if (!b) return;
      const slot = slots[Math.floor(Math.random() * slots.length)];
      b.active = true;
      b.x = s.sx + slot.dx;
      b.z = SQUAD_Z + slot.dz + 0.3;
      b.dmg = dmg;
      b.kind = Math.floor(Math.random() * FOOD.length);
      b.spin = Math.random() * 6.28;
    }
  }

  // ---------- chef chatter ----------
  function say(event, force = false) {
    if (!force && (s.bubble || s.bubbleGap > 0)) return;
    const text = chatter(event);
    if (!text) return;
    s.bubble = { card: overlays.makeBubble(wrapText(text, Math.min(W - 40, 280))), life: BUBBLE.life };
    s.idleT = BUBBLE.idleEvery;
  }

  function wrapText(text, maxW) {
    ctx.font = `800 15px ${FONT}`;
    const lines = [];
    let line = '';
    text.split(' ').forEach((w) => {
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

  const vibrate = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };
  const squadTopY = () => yAt(SQUAD_Z) - laneW * scaleAt(SQUAD_Z) * 0.75;

  // ---------- outcomes ----------
  function setCount(next) {
    s.count = Math.max(0, Math.min(SQUAD.maxCount, next));
    s.peak = Math.max(s.peak, s.count);
    s.bumpT = 0.25;
    if (s.count <= 0) finish('squad');
  }

  function kill(e) {
    const x = xAt(e.x, e.z);
    const y = yAt(e.z) - laneW * scaleAt(e.z) * 0.4;
    e.active = false;
    if (e.cat === 'eater' || e.cat === 'big') {
      s.fed += e.cat === 'big' ? 5 : 1;
      sfx.catchGood(e.cat === 'big' ? 3 : 1);
      fx.burst(x, y, '#ff6b8a', e.cat === 'big' ? 14 : 5, 0.7);
      fx.popup(x, y - 10, e.cat === 'big' ? t('fedBig') : '😋', '#ffffff', e.cat === 'big');
      if (s.fed >= s.nextFedCall) {
        s.nextFedCall += 40;
        say('fed');
      }
      return;
    }
    const reward = blockReward(s.count) * (e.cat === 'boss' ? 2 : 1);
    setCount(s.count + reward);
    sfx.bonus();
    vibrate(35);
    fx.burst(x, y, COLORS.gold, 26, 1.3);
    fx.burst(x, y, COLORS.red, 14, 1.1);
    s.shake = 0.25;
    if (e.cat === 'boss') {
      s.fed += 25;
      fx.popup(W / 2, H * 0.3, t('bossDown'), COLORS.gold, true);
      say('bossDown', true);
    } else {
      s.discovered += 1;
      fx.popup(W / 2, H * 0.3, t('newPlaceNamed', { c: places[e.place].label }), COLORS.red, true);
      say('discover', true);
    }
    fx.popup(W / 2, H * 0.38, `+${reward} 👨‍🍳`, COLORS.green, true);
  }

  function hurt(loss, e) {
    setCount(s.count - loss);
    s.shake = 0.35;
    s.flash = 1;
    sfx.hurt();
    vibrate(90);
    fx.burst(xAt(s.sx, SQUAD_Z), squadTopY(), COLORS.red, 12);
    fx.popup(xAt(s.sx, SQUAD_Z), squadTopY() - 26, `-${loss} 👨‍🍳`, COLORS.red, true);
    if (e.cat !== 'eater' || Math.random() < 0.3) say('bad');
  }

  function passGate(e) {
    const side = gateSide(s.sx);
    const gate = e.gates[side];
    const before = s.count;
    e.taken = side; // only the chosen panel breaks; the other one rolls on past the squad
    const good = isGoodGate(gate);
    setCount(applyGate(before, gate));
    if (good) sfx.bonus();
    else sfx.hurt();
    vibrate(good ? 20 : 70);
    const x = xAt(side ? 0.75 : -0.75, SQUAD_Z);
    fx.burst(x, squadTopY(), good ? COLORS.green : COLORS.red, 18);
    fx.popup(x, squadTopY() - 30, gateLabel(gate), good ? COLORS.green : COLORS.red, true);
    say(good ? 'gateGood' : 'gateBad', good ? s.count >= 2 * before : true);
  }

  function finish(reason) {
    if (s.over) return;
    s.running = false;
    s.over = true;
    s.score = crowdScore(s);
    if (reason === 'time') {
      sfx.bonus();
      fx.popup(W / 2, H * 0.35, t('timeUp'), COLORS.gold, true);
    } else {
      sfx.gameOver();
    }
    emitHud();
    onEnd({
      score: s.score, fed: s.fed, peak: s.peak, discovered: s.discovered,
      distance: Math.floor(s.dist), reason,
    });
  }

  // ---------- update ----------
  function update(dt) {
    s.shake = Math.max(0, s.shake - dt);
    s.flash = Math.max(0, s.flash - dt * 2.5);
    s.bumpT = Math.max(0, s.bumpT - dt);
    fx.update(dt);
    bees?.update(dt);
    updateBubble(dt);
    if (keys.left !== keys.right) s.x = dragToX(s.x, (keys.left ? -1 : 1) * KEY_SPEED * dt * roadPx() / SQUAD.dragGain, roadPx());
    const reach = squadReach(s.count);
    s.x = Math.max(-reach, Math.min(reach, s.x));
    s.sx += (s.x - s.sx) * (1 - Math.exp(-dt * STEER_RATE));

    if (s.countdown > 0) {
      const before = Math.ceil(s.countdown);
      s.countdown -= dt;
      if (Math.ceil(s.countdown) !== before && s.countdown > 0) sfx.tick();
      if (s.countdown <= 0 && s.running) say('start', true);
      return;
    }
    if (!s.running) return;

    const speed = speedAt(s.elapsed);
    const leftBefore = roundLeft(s.elapsed);
    s.elapsed += dt;
    if (updateClock(leftBefore)) return;
    s.dist += speed * dt;
    s.runPhase += dt * 11;
    s.idleT -= dt;
    if (s.idleT <= 0) say('idle');
    if (s.dist >= s.nextSegAt) spawnSegment();
    if (s.dist >= s.nextBoardAt) spawnBoard();

    s.fireT -= dt;
    while (s.fireT <= 0) {
      s.fireT += SQUAD.fireEvery;
      fire();
    }
    updateBullets(dt);
    updateEntities(dt, speed);
    if (s.running) s.score = crowdScore(s);
  }

  // Returns true once the round is over so the frame stops simulating.
  function updateClock(leftBefore) {
    const left = roundLeft(s.elapsed);
    if (left <= 0) {
      finish('time');
      return true;
    }
    if (left !== leftBefore && isFinalStretch(s.elapsed)) {
      sfx.tick();
      if (left === ROUND.finalStretch) say('final', true);
    }
    return false;
  }

  function hitTarget(b, prevZ) {
    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      if (!e.active) continue;
      if (e.z < prevZ - 0.4 || e.z > b.z + 0.4) continue;
      if (Math.abs(e.x - b.x) > HALF_W[e.cat]) continue;
      e.hp -= b.dmg;
      e.hitT = 0.08;
      if (e.hp <= 0) kill(e);
      return true;
    }
    return false;
  }

  function updateBullets(dt) {
    targets.length = 0;
    for (let i = 0; i < entities.length; i++) if (entities[i].active && entities[i].isTarget) targets.push(entities[i]);
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b.active) continue;
      const prevZ = b.z;
      b.z += SQUAD.bulletSpeed * dt;
      b.spin += dt * 12;
      if (b.z > SQUAD_Z + SQUAD.bulletRange || hitTarget(b, prevZ)) b.active = false;
    }
  }

  function updateEntities(dt, speed) {
    const radius = squadRadius(s.count);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.active) continue;
      const prevZ = e.z;
      e.hitT = Math.max(0, e.hitT - dt);
      e.z -= speed * dt;
      if (e.cat === 'eater' || e.cat === 'big') {
        e.z -= SQUAD.eaterWalk * dt;
        if (e.z < 22) e.x += (s.sx - e.x) * Math.min(1, dt * 0.45);
      }
      if (e.cat === 'gates') {
        if (e.taken === null && prevZ > SQUAD_Z && e.z <= SQUAD_Z) passGate(e);
      } else if (e.isTarget && e.z <= SQUAD_Z + radius * 0.8 && Math.abs(e.x - s.sx) < radius + HALF_W[e.cat]) {
        e.active = false;
        hurt(contactLoss(e.cat === 'eater' || e.cat === 'big' ? 'eater' : 'block', Math.ceil(e.hp)), e);
      }
      if (s.over) return;
      if (e.z < -SQUAD.camDist * 0.7) e.active = false;
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

  // ---------- render ----------
  function draw() {
    if (!backdrop) return;
    ox = s.shake > 0 ? (Math.random() - 0.5) * 16 * s.shake : 0;
    oy = s.shake > 0 ? (Math.random() - 0.5) * 16 * s.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.drawImage(backdrop, 0, 0, W, H);
    groundLayer.drawMoving(ctx, s.dist, W, horizonY);
    drawWorld();
    bees?.draw(ctx);
    fx.draw();
    if (s.bubble) drawBubble();
    if (s.flash > 0) {
      ctx.globalAlpha = s.flash * 0.22;
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.globalAlpha = 1;
    }
    if (s.countdown > 0) overlays.drawCountdown(ctx, s.countdown, W / 2, H * 0.3, tutLines);
  }

  function drawWorld() {
    drawList.length = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.active && e.z > -SQUAD.camDist * 0.6) drawList.push(e);
    }
    drawList.sort(byDepth);
    let squadDrawn = false;
    for (let i = 0; i < drawList.length; i++) {
      const e = drawList[i];
      if (!squadDrawn && e.z < SQUAD_Z) {
        drawBullets();
        drawSquad();
        squadDrawn = true;
      }
      drawEntity(e);
    }
    if (!squadDrawn) {
      drawBullets();
      drawSquad();
    }
  }

  function sprite(img, x, y, sc, extra = 1) {
    const w = (img.width / adpr) * sc * extra;
    const h = (img.height / adpr) * sc * extra;
    ctx.drawImage(img, x - w / 2, y - h, w, h);
    return h;
  }

  // Pre-rendered ellipse, stretched to size: one blit instead of a path fill.
  function shadow(x, y, rx, sc) {
    const ry = 5 * sc + 1;
    const w = (rx * 2) / (1 - shadowImg.padX * 2);
    const h = (ry * 2) / (1 - shadowImg.padY * 2);
    ctx.drawImage(shadowImg, x - w / 2, y - h / 2, w, h);
  }

  function drawEntity(e) {
    const sc = scaleAt(e.z);
    const x = xAt(e.x, e.z);
    const y = yAt(e.z);
    const pop = e.hitT > 0 ? 1.07 : 1;
    if (e.cat === 'gates') {
      // Near the squad, the panel it will actually take stays bright and the other dims,
      // so steering down the middle never looks like it grabs both.
      const chosen = e.taken ?? (e.z < GATE_PREVIEW_Z ? gateSide(s.sx) : null);
      for (let side = 0; side < e.sprites.length; side++) {
        if (side === e.taken) continue;
        ctx.globalAlpha = chosen === null || side === chosen ? 1 : GATE_DIM;
        sprite(e.sprites[side], xAt(side ? 0.75 : -0.75, e.z), y, sc);
      }
      ctx.globalAlpha = 1;
    } else if (e.cat === 'board') {
      sprite(e.sprite, x, y, sc);
    } else if (e.cat === 'block') {
      shadow(x, y, laneW * sc * 0.6, sc);
      const h = sprite(art.places[e.place], x, y, sc, pop);
      hpLabel(Math.ceil(e.hp), x, y - h * 0.42, 30 * sc + 8, '#ffffff');
    } else if (e.cat === 'boss') {
      shadow(x, y, laneW * sc * 0.8, sc);
      const h = sprite(art.boss, x, y - Math.abs(Math.sin(s.runPhase * 0.4)) * 6 * sc, sc, pop);
      hpBar(e, x, y - h - 10 * sc, laneW * 1.6 * sc);
    } else {
      const img = e.cat === 'big' ? art.big : art.eaters[e.look];
      const hop = Math.abs(Math.sin(s.runPhase * 0.8 + e.bob)) * 5 * sc;
      shadow(x, y, laneW * sc * (e.cat === 'big' ? 0.3 : 0.17), sc);
      const h = sprite(img, x, y - hop, sc, pop);
      if (e.maxHp > 1) hpLabel(Math.ceil(e.hp), x, y - h - hop - 4, 13 * sc + 7, COLORS.gold);
    }
  }

  function hpLabel(value, x, y, size, color) {
    labels.draw(ctx, value, x, y, size, color);
  }

  function hpBar(e, x, y, w) {
    const h = Math.max(6, w * 0.07);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(x - w / 2, y - h / 2, w * Math.max(0, e.hp / e.maxHp), h);
    hpLabel(Math.ceil(e.hp), x, y - h * 1.6, h * 2.2, '#ffffff');
  }

  // Spin comes from pre-rotated frames: axis-aligned blits, no setTransform/trig.
  function drawBullets() {
    const size = laneW * 0.26 * SPIN_PAD;
    const turn = SPIN_STEPS / (Math.PI * 2);
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b.active) continue;
      const sc = scaleAt(b.z);
      const d = size * sc;
      const strip = spins[b.kind];
      const cell = strip.cell;
      const frame = Math.floor(b.spin * turn) % SPIN_STEPS;
      const x = xAt(b.x, b.z);
      const y = yAt(b.z) - laneW * 0.45 * sc;
      ctx.drawImage(strip, frame * cell, 0, cell, cell, x - d / 2, y - d / 2, d, d);
    }
  }

  function refreshSlots() {
    const visible = Math.min(s.count, SQUAD.maxVisible);
    if (visible === slotsFor) return;
    slotsFor = visible;
    slots = formation(visible);
    slotOrder = slots.map((_, i) => i).sort((a, b) => slots[b].dz - slots[a].dz);
  }

  function drawSquad() {
    refreshSlots();
    if (!slots.length) return;
    const running = s.running && s.countdown <= 0;
    // All squad shadows in one path: 40+ separate fills are costly on phones.
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    for (let i = 0; i < slots.length; i++) {
      const z = SQUAD_Z + slots[i].dz;
      const sc = scaleAt(z);
      const x = xAt(s.sx + slots[i].dx, z);
      ctx.moveTo(x + laneW * sc * 0.14, yAt(z));
      ctx.ellipse(x, yAt(z), laneW * sc * 0.14, 5 * sc + 1, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    for (let k = 0; k < slotOrder.length; k++) {
      const i = slotOrder[k];
      const slot = slots[i];
      const z = SQUAD_Z + slot.dz;
      const sc = scaleAt(z);
      const x = xAt(s.sx + slot.dx, z);
      const bob = running ? Math.abs(Math.sin(s.runPhase + i * 1.7)) * 4 * sc : 0;
      sprite(i === 0 ? art.leader : art.chef, x, yAt(z) - bob, sc);
    }
    drawCountBanner();
  }

  function drawCountBanner() {
    const x = xAt(s.sx, SQUAD_Z);
    const y = squadTopY() - squadRadius(s.count) * laneW * 0.35;
    overlays.drawBanner(ctx, s.count, x, y, 1 + s.bumpT * 0.8);
  }

  function drawBubble() {
    const b = s.bubble;
    const pop = Math.min(1, (BUBBLE.life - b.life) / 0.18);
    const headX = xAt(s.sx, SQUAD_Z);
    const tipY = squadTopY() - squadRadius(s.count) * laneW * 0.35 - 20;
    overlays.drawBubble(ctx, b, headX, tipY, Math.min(1, b.life / 0.3), 0.6 + pop * 0.4, W);
  }

  // ---------- HUD / loop ----------
  // One reused object; score/metres text refresh at 10 Hz (each DOM text write
  // restyles + relayouts the HUD over the canvas), everything else is instant.
  function emitHud(dt = HUD_TEXT_EVERY) {
    hudT += dt;
    if (hudT >= HUD_TEXT_EVERY || !s.running) {
      hudT = 0;
      hud.score = s.score;
      hud.meters = Math.floor(s.dist);
    }
    hud.count = s.count;
    hud.pins = s.discovered;
    hud.timeLeft = roundLeft(s.elapsed);
    hud.timeFrac = Math.round(Math.min(1, s.elapsed / ROUND.seconds) * TIMEBAR_STEPS) / TIMEBAR_STEPS;
    hud.rush = isFinalStretch(s.elapsed);
    onHud(hud);
  }

  function loop() {
    lastTs = 0;
    const frame = (ts) => {
      const dt = lastTs ? Math.min(MAX_DT, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      update(dt);
      draw();
      if (dt && s.running && s.countdown <= 0) watchPerf(dt);
      if (s.running) emitHud(dt);
      rafId = !s.running && !fx.busy() ? 0 : requestAnimationFrame(frame);
    };
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  // Low-end phones: if frames stay slow, step the render resolution down. Only
  // the backing store changes; sprites keep their resolution and just downscale.
  function watchPerf(dt) {
    perf.avg += (dt - perf.avg) * 0.05;
    perf.t += dt;
    if (perf.t < PERF_WINDOW || perf.avg < SLOW_FRAME || dpr <= MIN_DPR) return;
    dprCap = Math.max(MIN_DPR, dpr - DPR_STEP);
    perf.t = 0;
    perf.avg = 1 / 60;
    setRenderScale(dprCap);
  }

  function start() {
    for (let i = 0; i < entities.length; i++) entities[i].active = false;
    for (let i = 0; i < bullets.length; i++) bullets[i].active = false;
    fx.clear();
    s = freshState();
    s.running = true;
    s.countdown = COUNTDOWN;
    slotsFor = -1;
    hudT = HUD_TEXT_EVERY;
    sfx.tick();
    emitHud();
    loop();
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  resize();
  return { start, resize, destroy };
}
