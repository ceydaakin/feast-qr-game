// Endless-runner engine (Subway Surfers style): 3 lanes, swipe to switch / jump / slide.
// Hot-path entities live in fixed object pools and are mutated in place on
// purpose — allocating per frame would cause GC hitches on low-end phones.

import { ITEMS, multiplierFor, chefStageFor } from './logic.js';
import {
  RUN, speedAt, rowGapAt, classifyGesture, nextLane, collides, pickRow, runScore,
} from './runner-logic.js';
import { buildSpriteCache } from './art.js';
import { buildObstacleSprites, buildBillboard, renderSky } from './scenery.js';

const MAX_DPR = 2;
const MAX_DT = 1 / 30;
const CHEF_ASPECT = 319 / 400;
const BODY_CX = 0.4; // horizontal centre of the chef's body inside the sprite
const COLORS = { gold: '#ffd23f', red: '#ff3131', ink: '#3a1d10', coin: '#ffb100' };
const BUBBLE = { life: 2.6, gap: 1.2, idleEvery: 8.5 };
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';
const COIN_KINDS = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'good');
const STRIPE = 2; // world units per curb stripe
const DASH_EVERY = 4;
const BILLBOARD_EVERY = 17;
const SPEEDUP_EVERY = 15; // seconds between "faster!" callouts

const pool = (n) => Array.from({ length: n }, () => ({ active: false }));
const acquire = (arr) => arr.find((o) => !o.active) || null;

export function createGame({ canvas, chefImages, billboards, sfx, t, chatter, onHud, onEnd }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const objects = pool(90);
  const particles = pool(80);
  const popups = pool(12);
  const drawList = [];
  const gesture = { active: false, x: 0, y: 0, t: 0, used: false };

  let W = 0; let H = 0; let dpr = 1;
  let horizonY = 0; let groundY = 0; let laneW = 0; let chefH = 0; let chefW = 0;
  let sky = null; let coinSprites = null; let obstacleSprites = null; let boardSprites = [];
  let rafId = 0; let lastTs = 0;
  let s = freshState();

  function freshState() {
    return {
      running: false, over: false, elapsed: 0, dist: 0, itemPts: 0, score: 0,
      combo: 0, maxCombo: 0, caught: 0, discovered: 0, lives: RUN.lives,
      lane: 0, x: 0, jumpT: -1, slideT: -1, invulnT: 0, magnetT: 0,
      nextRowAt: 20, nextBoardAt: 8, boardSide: 1, boardIdx: 0,
      runPhase: 0, countdown: 0, shake: 0, flash: 0, speedTier: 0, stage: 0,
      bubble: null, bubbleGap: 0, idleT: BUBBLE.idleEvery,
    };
  }

  // ---------- projection ----------
  const scaleAt = (z) => RUN.camDist / (z + RUN.camDist);
  const yAt = (z) => horizonY + (groundY - horizonY) * scaleAt(z);
  const xAt = (laneX, z) => W / 2 + laneX * laneW * scaleAt(z);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    horizonY = H * 0.34;
    groundY = H * 0.9;
    laneW = Math.min(W * 0.31, 170);
    chefH = Math.min(laneW * 1.35, H * 0.26);
    chefW = chefH * CHEF_ASPECT;
    sky = renderSky(W, horizonY, dpr);
    coinSprites = buildSpriteCache([...COIN_KINDS, 'pin', 'mustache'], Math.round(laneW * 0.5 * dpr), () => false);
    obstacleSprites = buildObstacleSprites(laneW, dpr);
    boardSprites = billboards.map((b) => buildBillboard(b.img, b.label, t('boardCta'), laneW, dpr));
    if (!s.running) draw();
  }

  // ---------- input ----------
  function act(dir) {
    if (!s.running || s.countdown > 0) return;
    if (dir === 'left' || dir === 'right') {
      const lane = nextLane(s.lane, dir);
      if (lane !== s.lane) {
        s.lane = lane;
        sfx.tick();
      }
    } else if (dir === 'up') {
      if (s.jumpT < 0) {
        s.jumpT = 0;
        s.slideT = -1;
        sfx.catchGood(1);
      }
    } else if (dir === 'down') {
      s.jumpT = -1; // fast-drop out of a jump, like the real thing
      s.slideT = 0;
      sfx.tick();
    }
  }

  function onDown(e) {
    Object.assign(gesture, { active: true, x: e.clientX, y: e.clientY, t: performance.now(), used: false });
  }
  function onMove(e) {
    if (!gesture.active || gesture.used) return;
    const dir = classifyGesture(e.clientX - gesture.x, e.clientY - gesture.y, performance.now() - gesture.t);
    // Fire as soon as the swipe is long enough — waiting for pointerup feels laggy.
    if (dir !== 'tap' && dir !== 'none') {
      gesture.used = true;
      act(dir);
    }
  }
  function onUp(e) {
    if (!gesture.active) return;
    gesture.active = false;
    if (gesture.used) return;
    const dir = classifyGesture(e.clientX - gesture.x, e.clientY - gesture.y, performance.now() - gesture.t);
    if (dir === 'tap') act(e.clientX < W / 2 ? 'left' : 'right');
    else if (dir !== 'none') act(dir);
  }
  const KEYMAP = {
    ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
    ArrowUp: 'up', w: 'up', ' ': 'up', ArrowDown: 'down', s: 'down',
  };
  function onKey(e) {
    const dir = KEYMAP[e.key];
    if (!dir || e.repeat) return;
    e.preventDefault();
    act(dir);
  }
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (s.running) {
      s.countdown = Math.max(s.countdown, 3);
      loop();
    }
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- spawning ----------
  function spawn(props) {
    const o = acquire(objects);
    if (!o) return null;
    Object.assign(o, { active: true, bob: Math.random() * 6.28 }, props);
    return o;
  }

  function spawnRow() {
    const row = pickRow(Math.random, Math.min(1, s.elapsed / 90));
    const z = RUN.spawnZ;
    row.obstacles.forEach((ob) => spawn({ kind: ob.type, cat: 'obstacle', lane: ob.lane, z }));
    const gap = rowGapAt(speedAt(s.elapsed));
    if (row.coinLane !== null) {
      const sameLane = Boolean(row.special) && row.special.lane === row.coinLane;
      const room = Math.floor(gap / RUN.coinSpacing) - (sameLane ? 1 : 0);
      const count = Math.max(2, Math.min(RUN.coinsPerLine, room));
      const kind = COIN_KINDS[Math.floor(Math.random() * COIN_KINDS.length)];
      for (let i = 0; i < count; i++) {
        spawn({ kind, cat: 'coin', lane: row.coinLane, z: z + (i + (sameLane ? 1 : 0)) * RUN.coinSpacing });
      }
    }
    if (row.special) spawn({ kind: row.special.kind, cat: row.special.kind, lane: row.special.lane, z });
    s.nextRowAt = s.dist + gap;
  }

  function spawnBoard() {
    if (boardSprites.length) {
      spawn({ cat: 'board', sprite: boardSprites[s.boardIdx % boardSprites.length], lane: s.boardSide * 2.25, z: RUN.spawnZ });
      s.boardIdx += 1;
      s.boardSide *= -1;
    }
    s.nextBoardAt = s.dist + BILLBOARD_EVERY;
  }

  // ---------- effects ----------
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const p = acquire(particles);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 200;
      const life = 0.5 + Math.random() * 0.3;
      Object.assign(p, {
        active: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140,
        life, max: life, color, size: 3 + Math.random() * 4,
      });
    }
  }

  function popup(x, y, text, color, big = false) {
    const p = acquire(popups);
    if (!p) return;
    const life = big ? 1.2 : 0.7;
    Object.assign(p, { active: true, x, y, text, color, big, life, max: life });
  }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

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

  // ---------- player state ----------
  const jumpFrac = () => (s.jumpT < 0 ? 0 : Math.sin(Math.PI * Math.min(1, s.jumpT / RUN.jumpSec)));
  const sliding = () => s.slideT >= 0;
  const playerY = () => groundY - jumpFrac() * chefH * 0.8;

  // ---------- outcomes ----------
  function collect(o) {
    const px = xAt(s.x, 0);
    const py = playerY() - chefH * 0.5;
    if (o.cat === 'coin') {
      const prev = multiplierFor(s.combo);
      const pts = ITEMS[o.kind].points * prev;
      s.itemPts += pts;
      s.combo += 1;
      s.caught += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      sfx.catchGood(prev);
      burst(px, py, COLORS.coin, 5);
      popup(px, py - 20, `+${pts}`, '#ffffff');
      if (multiplierFor(s.combo) > prev) {
        popup(W / 2, H * 0.28, `x${multiplierFor(s.combo)} ${t('combo')}`, COLORS.red, true);
        say('combo');
      }
    } else if (o.cat === 'pin') {
      s.itemPts += ITEMS.pin.points;
      s.discovered += 1;
      sfx.bonus();
      vibrate(25);
      burst(px, py, COLORS.red, 18);
      popup(W / 2, H * 0.3, t('newPlace'), COLORS.red, true);
      say('discover', true);
    } else if (o.cat === 'mustache') {
      s.itemPts += ITEMS.mustache.points;
      s.magnetT = RUN.magnetSec;
      sfx.bonus();
      vibrate(30);
      burst(px, py, COLORS.gold, 22);
      popup(W / 2, H * 0.3, t('magnet'), COLORS.gold, true);
      say('magnet', true);
    }
  }

  function crash(o) {
    if (s.invulnT > 0) return;
    s.lives -= 1;
    s.combo = 0;
    s.invulnT = RUN.invulnSec;
    s.shake = 0.4;
    s.flash = 1;
    sfx.hurt();
    vibrate(120);
    const px = xAt(s.x, 0);
    burst(px, groundY - chefH * 0.6, COLORS.red, 16);
    popup(px, groundY - chefH * 1.1, t(`hit_${o.kind}`), COLORS.red, true);
    say('bad', true);
    if (s.lives <= 0) finish('lives');
  }

  function finish(reason) {
    if (s.over) return;
    s.running = false;
    s.over = true;
    sfx.gameOver();
    emitHud();
    onEnd({
      score: s.score, caught: s.caught, maxCombo: s.maxCombo, discovered: s.discovered,
      distance: Math.floor(s.dist), reason,
    });
  }

  // ---------- update ----------
  function update(dt) {
    s.shake = Math.max(0, s.shake - dt);
    s.flash = Math.max(0, s.flash - dt * 2.5);
    s.x += (s.lane - s.x) * (1 - Math.exp(-dt / (RUN.laneSwitchSec / 3)));
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

    const speed = speedAt(s.elapsed);
    s.elapsed += dt;
    s.dist += speed * dt;
    s.runPhase += dt * (8 + speed * 0.35);
    s.invulnT = Math.max(0, s.invulnT - dt);
    s.magnetT = Math.max(0, s.magnetT - dt);
    if (s.jumpT >= 0) {
      s.jumpT += dt;
      if (s.jumpT >= RUN.jumpSec) s.jumpT = -1;
    }
    if (s.slideT >= 0) {
      s.slideT += dt;
      if (s.slideT >= RUN.slideSec) s.slideT = -1;
    }

    const tier = Math.floor(s.elapsed / SPEEDUP_EVERY);
    if (tier > s.speedTier) {
      s.speedTier = tier;
      popup(W / 2, H * 0.24, t('faster'), COLORS.red, true);
      say('speed');
    }
    s.idleT -= dt;
    if (s.idleT <= 0) say('idle');

    if (s.dist >= s.nextRowAt) spawnRow();
    if (s.dist >= s.nextBoardAt) spawnBoard();
    updateObjects(dt, speed);

    s.score = runScore(s.dist, s.itemPts);
    const stage = chefStageFor(s.score);
    if (stage !== s.stage) {
      s.stage = stage;
      say(`stage${stage}`, true);
    }
  }

  function updateObjects(dt, speed) {
    const player = { jump: jumpFrac(), sliding: sliding() };
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      if (!o.active) continue;
      const prevZ = o.z;
      o.z -= speed * dt;
      if (s.magnetT > 0 && o.cat === 'coin' && o.z < 30) o.lane += (s.x - o.lane) * Math.min(1, dt * 8);
      const sameLane = Math.abs(o.lane - s.x) < 0.5;
      if (o.cat === 'obstacle') {
        if (prevZ > 0 && o.z <= 0 && sameLane && collides(o.kind, player)) crash(o);
      } else if (o.cat !== 'board' && prevZ > 0.4 && o.z <= 0.4 && sameLane) {
        o.active = false;
        collect(o);
        continue;
      }
      if (s.over) return;
      if (o.z < -RUN.camDist * 0.7) o.active = false;
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
    particles.forEach((p) => {
      if (!p.active) return;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; return; }
      p.vy += 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    popups.forEach((p) => {
      if (!p.active) return;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      else p.y -= 50 * dt;
    });
  }

  // ---------- render ----------
  function draw() {
    if (!sky) return;
    const sx = s.shake > 0 ? (Math.random() - 0.5) * 16 * s.shake : 0;
    const sy = s.shake > 0 ? (Math.random() - 0.5) * 16 * s.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    ctx.drawImage(sky, 0, 0, W, horizonY + 2);
    drawGround();
    drawWorld();
    drawParticles();
    drawPopups();
    if (s.bubble) drawBubble();
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,49,49,${s.flash * 0.22})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (s.countdown > 0) drawCountdown();
  }

  // Band between two lane offsets from depth z0 to z1.
  function band(l0, l1, z0, z1) {
    ctx.beginPath();
    ctx.moveTo(xAt(l0, z0), yAt(z0));
    ctx.lineTo(xAt(l1, z0), yAt(z0));
    ctx.lineTo(xAt(l1, z1), yAt(z1));
    ctx.lineTo(xAt(l0, z1), yAt(z1));
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    const zNear = -RUN.camDist * 0.35; // projects below the bottom edge of the screen
    const zFar = RUN.spawnZ + 40;
    ctx.fillStyle = '#f4d6b0';
    ctx.fillRect(0, horizonY, W, H - horizonY);
    ctx.fillStyle = '#e8c49a';
    band(-6, -1.62, zNear, zFar);
    band(1.62, 6, zNear, zFar);
    ctx.fillStyle = '#5d5250';
    band(-1.5, 1.5, zNear, zFar);
    const off = s.dist % STRIPE;
    for (let k = -1; k * STRIPE < RUN.spawnZ; k++) {
      const z0 = k * STRIPE - off;
      const z1 = z0 + STRIPE / 2;
      ctx.fillStyle = COLORS.red;
      band(-1.62, -1.5, z0, z1);
      band(1.5, 1.62, z0, z1);
      ctx.fillStyle = '#ffffff';
      band(-1.62, -1.5, z1, z1 + STRIPE / 2);
      band(1.5, 1.62, z1, z1 + STRIPE / 2);
    }
    const doff = s.dist % DASH_EVERY;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = -1; k * DASH_EVERY < RUN.spawnZ; k++) {
      const z0 = k * DASH_EVERY - doff;
      band(-0.53, -0.47, z0, z0 + 1.3);
      band(0.47, 0.53, z0, z0 + 1.3);
    }
    // soft haze at the horizon hides pop-in
    const hazeH = (groundY - horizonY) * 0.18;
    const haze = ctx.createLinearGradient(0, horizonY, 0, horizonY + hazeH);
    haze.addColorStop(0, 'rgba(255,243,227,1)');
    haze.addColorStop(1, 'rgba(255,243,227,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY, W, hazeH);
  }

  function drawWorld() {
    drawList.length = 0;
    objects.forEach((o) => { if (o.active && o.z > -RUN.camDist * 0.6) drawList.push(o); });
    drawList.sort((a, b) => b.z - a.z);
    let playerDrawn = false;
    for (let i = 0; i < drawList.length; i++) {
      const o = drawList[i];
      if (!playerDrawn && o.z < 0) {
        drawPlayer();
        playerDrawn = true;
      }
      drawObject(o);
    }
    if (!playerDrawn) drawPlayer();
  }

  function drawObject(o) {
    const sc = scaleAt(o.z);
    const x = xAt(o.lane, o.z);
    const y = yAt(o.z);
    if (o.cat === 'obstacle' || o.cat === 'board') {
      const sp = o.cat === 'board' ? o.sprite : obstacleSprites[o.kind];
      const w = (sp.width / dpr) * sc;
      const h = (sp.height / dpr) * sc;
      if (o.cat === 'obstacle') {
        ctx.fillStyle = 'rgba(40,20,10,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.5, 6 * sc + 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(sp, x - w / 2, y - h, w, h);
      return;
    }
    const size = laneW * 0.5 * sc;
    const lift = (0.35 + Math.sin(s.runPhase * 0.6 + o.bob) * 0.06) * laneW * sc;
    ctx.fillStyle = 'rgba(40,20,10,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.35, 4 * sc + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(coinSprites[o.kind], x - size / 2, y - lift - size / 2, size, size);
  }

  function drawPlayer() {
    const img = chefImages[chefStageFor(s.score)];
    const x = xAt(s.x, 0);
    const jf = jumpFrac();
    const slide = sliding();
    const running = s.running && s.countdown <= 0;
    const bob = running && !jf && !slide ? Math.abs(Math.sin(s.runPhase)) * chefH * 0.035 : 0;
    const tilt = (s.lane - s.x) * 0.35 + (running ? Math.sin(s.runPhase * 0.5) * 0.04 : 0);
    ctx.fillStyle = `rgba(40,20,10,${0.25 - jf * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY, chefW * 0.36 * (1 - jf * 0.35), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (s.magnetT > 0) {
      ctx.fillStyle = `rgba(255,210,63,${0.25 + Math.sin(performance.now() / 90) * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(x, groundY - chefH * 0.45, chefW * 0.6, chefH * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.invulnT > 0 && Math.floor(s.invulnT * 12) % 2) return;
    ctx.save();
    ctx.translate(x, playerY() - bob);
    ctx.rotate(tilt);
    ctx.scale(slide ? 1.15 : 1, slide ? 0.55 : 1);
    if (img && img.complete) ctx.drawImage(img, -chefW * BODY_CX, -chefH, chefW, chefH);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((p) => {
      if (!p.active) return;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    popups.forEach((p) => {
      if (!p.active) return;
      const k = p.life / p.max;
      const pop = p.big ? 1 + Math.max(0, k - 0.8) * 2 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${Math.round((p.big ? 28 : 22) * pop)}px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = COLORS.ink;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  function drawBubble() {
    const b = s.bubble;
    const pop = Math.min(1, (BUBBLE.life - b.life) / 0.18);
    const lineH = 19;
    ctx.font = `800 15px ${FONT}`;
    const textW = Math.max(...b.lines.map((l) => ctx.measureText(l).width));
    const bw = textW + 28;
    const bh = b.lines.length * lineH + 18;
    const headX = xAt(s.x, 0);
    const tipY = playerY() - chefH * (sliding() ? 0.6 : 1.02);
    const bx = Math.max(10, Math.min(W - bw - 10, headX - bw / 2));
    const by = tipY - bh - 14;
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
    // control tutorial while counting down
    ctx.font = `900 17px ${FONT}`;
    ctx.lineWidth = 5;
    [t('tutLanes'), t('tutJump'), t('tutSlide')].forEach((line, i) => {
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
      score: s.score,
      lives: s.lives,
      meters: Math.floor(s.dist),
      pins: s.discovered,
      multiplier: multiplierFor(s.combo),
      magnet: s.magnetT > 0,
    });
  }

  function loop() {
    lastTs = 0;
    const frame = (ts) => {
      const dt = lastTs ? Math.min(MAX_DT, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      update(dt);
      draw();
      if (s.running) emitHud();
      const idle = !s.running && !particles.some((p) => p.active) && !popups.some((p) => p.active);
      rafId = idle ? 0 : requestAnimationFrame(frame);
    };
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    [objects, particles, popups].forEach((arr) => arr.forEach((o) => { o.active = false; }));
    s = freshState();
    s.running = true;
    s.countdown = 3;
    // A few pickups right away so the first seconds feel rewarding.
    for (let i = 0; i < 5; i++) {
      spawn({ kind: COIN_KINDS[i % COIN_KINDS.length], cat: 'coin', lane: 0, z: 8 + i * RUN.coinSpacing });
    }
    sfx.tick();
    emitHud();
    loop();
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  resize();
  return { start, resize, destroy };
}
