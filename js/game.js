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

const MAX_DPR = 2;
const MIN_DPR = 1;
const SLOW_FRAME = 1 / 50; // average frame time above this drops render resolution
const COUNTDOWN = 2;
const SHADOW = 'rgba(40,20,10,0.2)';
const STEER_RATE = 18;
const MAX_DT = 1 / 30;
const COLORS = { gold: '#ffd23f', red: '#ff3131', ink: '#3a1d10', green: '#2bb673', food: '#ffb100' };
const BUBBLE = { life: 2.6, gap: 1.2, idleEvery: 8.5 };
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';
const FOOD = ['tomato', 'cheese', 'pepperoni', 'mushroom', 'olive', 'basil'];
const SQUAD_Z = 2.2;
const TILE = 2.5; // world units per road tile
const BILLBOARD_EVERY = 21;
const MAX_EMITTERS = 5;
const KEY_SPEED = 3.2; // road units per second with arrow keys
const HALF_W = { eater: 0.24, big: 0.42, block: 0.72, boss: 0.95 };
const TARGETS = new Set(['eater', 'big', 'block', 'boss']);
const LANE_LINES = [-0.75, 0, 0.75];
const OPENING = ['gates', 'horde', 'gates', 'block', 'horde', 'gates']; // teaches each mechanic once

const pool = (n) => Array.from({ length: n }, () => ({ active: false }));
const acquire = (arr) => arr.find((o) => !o.active) || null;

export function createGame({ canvas, places, theme = null, locale = 'tr', sfx, t, chatter, onHud, onEnd }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const fx = createFx(ctx);
  const labels = createLabelCache({ font: FONT, ink: COLORS.ink });
  const entities = pool(110);
  const bullets = pool(150);
  const drawList = [];
  const drag = { active: false, px: 0 };
  const keys = { left: false, right: false };
  const scene = theme?.scene || {};
  const ground = GROUNDS[scene.ground] || GROUNDS.street;
  const bees = scene.bees ? createBees(scene.bees) : null;

  let W = 0; let H = 0; let dpr = 1;
  let horizonY = 0; let groundY = 0; let laneW = 0;
  let sky = null; let foodSprites = null; let art = null; let boardSprites = [];
  let slots = []; let slotOrder = []; let slotsFor = -1;
  let rafId = 0; let lastTs = 0;
  let dprCap = MAX_DPR; let haze = null;
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

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    horizonY = H * 0.24;
    groundY = H * 0.93;
    laneW = Math.min(W * 0.31, 180);
    labels.reset(dpr);
    sky = scene.sky === 'stadium' ? renderStadium(W, horizonY, dpr) : renderSky(W, horizonY, dpr);
    bees?.resize(W, horizonY * 0.55, H * 0.55, laneW * 0.2, dpr);
    haze = makeHaze();
    foodSprites = buildSpriteCache(FOOD, Math.round(laneW * 0.26 * dpr), () => false);
    art = buildCrowdSprites(laneW, dpr, places, theme?.art);
    const ads = places.map((p) => buildBillboard(p.img, p.label, t('boardCta'), laneW, dpr));
    const signs = (theme?.signs?.[locale] || []).map((lines) => buildSign(lines, laneW, dpr));
    // Alternate feast ads with event signs: ad, sign, ad, sign…
    boardSprites = ads.flatMap((ad, i) => (signs.length ? [ad, signs[i % signs.length]] : [ad]));
    entities.forEach((e) => {
      if (e.active && e.cat === 'gates') e.sprites = buildGateSprites(e.gates, laneW, dpr);
    });
    if (!s.running) draw();
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
    Object.assign(e, { active: true, hitT: 0, bob: Math.random() * 6.28 }, props);
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
      spawn({ cat: 'gates', x: 0, z, gates: seg.gates, sprites: buildGateSprites(seg.gates, laneW, dpr) });
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
      Object.assign(b, {
        active: true, x: s.sx + slot.dx, z: SQUAD_Z + slot.dz + 0.3, dmg,
        kind: FOOD[Math.floor(Math.random() * FOOD.length)], spin: Math.random() * 6.28,
      });
    }
  }

  // ---------- chef chatter ----------
  function say(event, force = false) {
    if (!force && (s.bubble || s.bubbleGap > 0)) return;
    const text = chatter(event);
    if (!text) return;
    s.bubble = { lines: wrapText(text, Math.min(W - 40, 280)), life: BUBBLE.life };
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
    e.active = false;
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
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e.active || !TARGETS.has(e.cat)) continue;
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
        if (prevZ > SQUAD_Z && e.z <= SQUAD_Z) passGate(e);
      } else if (TARGETS.has(e.cat) && e.z <= SQUAD_Z + radius * 0.8 && Math.abs(e.x - s.sx) < radius + HALF_W[e.cat]) {
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
    if (!sky) return;
    ox = s.shake > 0 ? (Math.random() - 0.5) * 16 * s.shake : 0;
    oy = s.shake > 0 ? (Math.random() - 0.5) * 16 * s.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.drawImage(sky, 0, 0, W, horizonY + 2);
    drawGround();
    drawWorld();
    bees?.draw(ctx);
    fx.draw();
    if (s.bubble) drawBubble();
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,49,49,${s.flash * 0.22})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (s.countdown > 0) drawCountdown();
  }

  // Adds one road-space quad to the current path (callers fill once per colour).
  function quad(l0, l1, z0, z1) {
    ctx.moveTo(xAt(l0, z0), yAt(z0));
    ctx.lineTo(xAt(l1, z0), yAt(z0));
    ctx.lineTo(xAt(l1, z1), yAt(z1));
    ctx.lineTo(xAt(l0, z1), yAt(z1));
    ctx.closePath();
  }

  function fillQuads(color, spans, z0, z1) {
    ctx.fillStyle = color;
    ctx.beginPath();
    spans.forEach(([l0, l1]) => quad(l0, l1, z0, z1));
    ctx.fill();
  }

  // Every other half-tile of `spans`, scrolled by distance — one fill per colour.
  function fillStripes(color, spans, shift) {
    if (!color) return;
    const off = s.dist % TILE;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = -1; k * TILE < SQUAD.spawnZ; k++) {
      const z0 = k * TILE - off + shift;
      spans.forEach(([l0, l1]) => quad(l0, l1, z0, z0 + TILE / 2));
    }
    ctx.fill();
  }

  function drawGround() {
    const zNear = -SQUAD.camDist * 0.2;
    const zFar = SQUAD.spawnZ + 40;
    const edge = SQUAD.roadHalf;
    ctx.fillStyle = ground.field;
    ctx.fillRect(0, horizonY, W, H - horizonY);
    const sides = [[-8, -edge - 0.12], [edge + 0.12, 8]];
    const curbs = [[-edge - 0.12, -edge], [edge, edge + 0.12]];
    fillQuads(ground.side, sides, zNear, zFar);
    fillQuads(ground.road, [[-edge, edge]], zNear, zFar);
    fillStripes(ground.sideAlt, sides, 0); // mowed-grass stripes
    fillStripes(ground.roadStripe, [[-edge, edge]], 0);
    if (ground.edgeA === ground.edgeB) {
      fillQuads(ground.edgeA, curbs, zNear, zFar);
    } else {
      fillStripes(ground.edgeA, curbs, 0);
      fillStripes(ground.edgeB, curbs, TILE / 2);
    }
    if (ground.lanes) { // athletics track lane lines
      fillQuads(ground.lanes, LANE_LINES.map((l) => [l - 0.02, l + 0.02]), zNear, zFar);
    }
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY, W, (groundY - horizonY) * 0.16);
  }

  function makeHaze() {
    const g = ctx.createLinearGradient(0, horizonY, 0, horizonY + (groundY - horizonY) * 0.16);
    g.addColorStop(0, `rgba(${ground.haze},1)`);
    g.addColorStop(1, `rgba(${ground.haze},0)`);
    return g;
  }

  function drawWorld() {
    drawList.length = 0;
    entities.forEach((e) => { if (e.active && e.z > -SQUAD.camDist * 0.6) drawList.push(e); });
    drawList.sort((a, b) => b.z - a.z);
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
    const w = (img.width / dpr) * sc * extra;
    const h = (img.height / dpr) * sc * extra;
    ctx.drawImage(img, x - w / 2, y - h, w, h);
    return h;
  }

  function shadow(x, y, rx, sc) {
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, 5 * sc + 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEntity(e) {
    const sc = scaleAt(e.z);
    const x = xAt(e.x, e.z);
    const y = yAt(e.z);
    const pop = e.hitT > 0 ? 1.07 : 1;
    if (e.cat === 'gates') {
      e.sprites.forEach((sp, side) => sprite(sp, xAt(side ? 0.75 : -0.75, e.z), y, sc));
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

  function drawBullets() {
    const size = laneW * 0.26;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b.active) continue;
      const sc = scaleAt(b.z);
      const d = size * sc;
      const cos = Math.cos(b.spin) * dpr;
      const sin = Math.sin(b.spin) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, (xAt(b.x, b.z) + ox) * dpr, (yAt(b.z) - laneW * 0.45 * sc + oy) * dpr);
      ctx.drawImage(foodSprites[b.kind], -d / 2, -d / 2, d, d);
    }
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
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
    const pop = 1 + s.bumpT * 0.8;
    const text = `👨‍🍳 ${s.count}`;
    ctx.font = `900 ${Math.round(20 * pop)}px ${FONT}`;
    const w = ctx.measureText(text).width + 22;
    const h = 30 * pop;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = COLORS.red;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }

  function drawBubble() {
    const b = s.bubble;
    const pop = Math.min(1, (BUBBLE.life - b.life) / 0.18);
    const lineH = 19;
    ctx.font = `800 15px ${FONT}`;
    const textW = Math.max(...b.lines.map((l) => ctx.measureText(l).width));
    const bw = textW + 28;
    const bh = b.lines.length * lineH + 18;
    const headX = xAt(s.sx, SQUAD_Z);
    const tipY = squadTopY() - squadRadius(s.count) * laneW * 0.35 - 20;
    const bx = Math.max(10, Math.min(W - bw - 10, headX - bw / 2));
    const by = tipY - bh - 12;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life / 0.3);
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
    ctx.fillRect(headX - 7.5, by + bh - 3, 15, 4); // hide the seam where the tail joins
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    b.lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 9 + lineH * (i + 0.5)));
    ctx.restore();
  }

  function drawCountdown() {
    const n = Math.ceil(s.countdown);
    const frac = s.countdown - Math.floor(s.countdown);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(W / 2, H * 0.3);
    ctx.save();
    ctx.scale(1 + frac * 0.6, 1 + frac * 0.6);
    ctx.globalAlpha = Math.min(1, frac * 3 + 0.2);
    ctx.font = `900 96px ${FONT}`;
    ctx.lineWidth = 12;
    ctx.strokeStyle = COLORS.ink;
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = COLORS.red;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    ctx.font = `900 17px ${FONT}`;
    ctx.lineWidth = 5;
    [t('tutTime'), t('tutDrag'), t('tutGates'), t('tutFeed')].forEach((line, i) => {
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(line, 0, 90 + i * 28);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(line, 0, 90 + i * 28);
    });
    ctx.restore();
  }

  // ---------- HUD / loop ----------
  function emitHud() {
    onHud({
      score: s.score, count: s.count, meters: Math.floor(s.dist), pins: s.discovered,
      timeLeft: roundLeft(s.elapsed), timeFrac: Math.min(1, s.elapsed / ROUND.seconds), rush: isFinalStretch(s.elapsed),
    });
  }

  function loop() {
    lastTs = 0;
    const frame = (ts) => {
      const dt = lastTs ? Math.min(MAX_DT, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      update(dt);
      draw();
      if (dt && s.running && s.countdown <= 0) watchPerf(dt);
      if (s.running) emitHud();
      rafId = !s.running && !fx.busy() ? 0 : requestAnimationFrame(frame);
    };
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  // Low-end phones: if frames stay slow, render at a lower resolution once.
  function watchPerf(dt) {
    perf.avg += (dt - perf.avg) * 0.05;
    perf.t += dt;
    if (perf.t < 2 || perf.avg < SLOW_FRAME || dpr <= MIN_DPR) return;
    dprCap = Math.max(MIN_DPR, dpr - 0.5);
    perf.t = 0;
    perf.avg = 1 / 60;
    resize();
  }

  function start() {
    [entities, bullets].forEach((arr) => arr.forEach((o) => { o.active = false; }));
    fx.clear();
    s = freshState();
    s.running = true;
    s.countdown = COUNTDOWN;
    slotsFor = -1;
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
