// Decorative bees buzzing over the stadium (event theme). Screen-space only —
// they never collide with anything. Two pre-rendered wing frames per resize;
// flight state is mutated in place (hot path, no per-frame allocation).

import { spriteOverride, drawContain } from './sprites.js';

const INK = '#3a1d10';
const FLAP_HZ = 18;

// İTÜ bee images (assets/itu/bee-1 = wings up, bee-2 = wings down), facing
// left. Drawn into the same box as the procedural bee, right-facing by
// mirroring, so the rest of the code does not care which one it gets.
function imageFrame(img, size, dpr) {
  const w = size * 1.5; const h = size * 1.2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.translate(w, 0); // mirror: the image faces left, frame 0 faces right
  ctx.scale(-1, 1);
  drawContain(ctx, img, 0, 0, w, h, 'center');
  return c;
}

function beeFrame(size, dpr, wingsUp) {
  const png = spriteOverride(wingsUp ? 'bee-1' : 'bee-2');
  if (png && spriteOverride('bee-1') && spriteOverride('bee-2')) return imageFrame(png, size, dpr);
  const w = size * 1.5; const h = size * 1.2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = w * 0.5; const cy = h * 0.62;
  const lw = Math.max(1, size * 0.07);
  // wings (behind body)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = 'rgba(58,29,16,0.5)';
  ctx.lineWidth = lw * 0.7;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(cx + side * size * 0.12, cy - size * (wingsUp ? 0.38 : 0.22), size * 0.22, size * (wingsUp ? 0.3 : 0.18), side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  // body with stripes
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.5, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = INK;
  [-0.12, 0.12].forEach((dx) => ctx.fillRect(cx + dx * size - size * 0.07, cy - size, size * 0.14, size * 2));
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.5, size * 0.34, 0, 0, Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // head + eye, facing right
  ctx.beginPath();
  ctx.arc(cx + size * 0.5, cy - size * 0.02, size * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + size * 0.56, cy - size * 0.07, size * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return c;
}

// Mirror a frame horizontally once, so drawing a left-facing bee needs no
// save/scale/restore per bee per frame.
function flipped(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.setTransform(-1, 0, 0, 1, src.width, 0);
  ctx.drawImage(src, 0, 0);
  return c;
}

const rand = (a, b) => a + Math.random() * (b - a);
const STEER = 3.2; // how fast a bee follows its wandering target (higher = twitchier)
const PERSONAL_SPACE = 2.4; // bees push apart when closer than this many bee-sizes

// Every bee gets its own patch of sky and its own rhythm, so no two fly the
// same path. (They used to share one figure-eight; with phases 2.1 apart and
// only three speeds, bees 0 and 3 ended up almost exactly on top of each other.)
// Each one wanders around a home point that itself drifts slowly across the
// field, flies an uneven loop around it (unrelated x/y frequencies), and
// keeps a little distance from the others.
// The middle of the screen (the track, gates and crowds) is off-limits: each
// bee lives in the left or the right side zone, so it never blocks the view.
const SIDE_ZONES = [[0.02, 0.27], [0.73, 0.98]]; // share of the screen width
export function createBees(count) {
  const bees = Array.from({ length: count }, (_, i) => ({
    zone: SIDE_ZONES[i % 2], // alternate left / right
    homeY: Math.floor(i / 2) % 2 ? rand(0.55, 0.9) : rand(0.1, 0.45),
    driftX: rand(0.04, 0.09), driftY: rand(0.05, 0.11), // home drift frequencies
    ax: rand(0.25, 0.45), ay: rand(0.12, 0.3), // loop size (x: share of the zone, y: of the box)
    fx: rand(0.25, 0.55) * (Math.random() < 0.5 ? -1 : 1), fy: rand(0.4, 0.9), // loop frequencies
    p1: rand(0, Math.PI * 2), p2: rand(0, Math.PI * 2), p3: rand(0, Math.PI * 2),
    depth: rand(0.6, 1.05), // size: nearer bees bigger
    x: -1, y: 0, tx: 0, ty: 0, vx: 0, pushX: 0, pushY: 0, dir: 1,
  }));
  let frames = null; // [up-right, up-left, down-right, down-left]
  let box = { w: 1, top: 0, bottom: 1 };
  let beeSize = 10;
  let time = rand(0, 100);
  let dpr = 1;

  function resize(w, top, bottom, size, pixelRatio) {
    dpr = pixelRatio;
    box = { w, top, bottom };
    beeSize = size;
    const up = beeFrame(size, dpr, true);
    const down = beeFrame(size, dpr, false);
    frames = [up, flipped(up), down, flipped(down)];
  }

  function targetOf(b) {
    const h = box.bottom - box.top;
    const [z0, z1] = b.zone;
    // position inside the side zone: 0 = inner edge … 1 = outer edge, wandering
    const u = 0.5 + 0.3 * Math.sin(time * b.driftX + b.p3) + b.ax * 0.5 * Math.sin(time * b.fx + b.p1);
    const hy = b.homeY + 0.12 * Math.sin(time * b.driftY + b.p1);
    const x = box.w * (z0 + (z1 - z0) * Math.min(1, Math.max(0, u)));
    const y = box.top + h * (hy + b.ay * Math.sin(time * b.fy + b.p2));
    // keep the target inside its zone and the box (margin so wings stay on screen)
    const m = beeSize;
    b.tx = Math.min(box.w * z1, box.w - m, Math.max(box.w * z0, m, x)); // in place: no per-frame allocation
    b.ty = Math.min(box.bottom, Math.max(box.top, y));
  }

  function update(dt) {
    time += dt;
    const k = 1 - Math.exp(-dt * STEER);
    const space = beeSize * PERSONAL_SPACE;
    // gentle separation: overlapping bees get pushed apart, the push fades out
    for (let i = 0; i < bees.length; i++) {
      const a = bees[i];
      a.pushX *= 1 - Math.min(1, dt * 1.5);
      a.pushY *= 1 - Math.min(1, dt * 1.5);
      for (let j = i + 1; j < bees.length; j++) {
        const b = bees[j];
        const dx = a.x - b.x; const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < space) {
          const f = ((space - d) / space) * space * dt * 4;
          a.pushX += (dx / d) * f; a.pushY += (dy / d) * f;
          b.pushX -= (dx / d) * f; b.pushY -= (dy / d) * f;
        }
      }
    }
    for (let i = 0; i < bees.length; i++) {
      const b = bees[i];
      targetOf(b);
      const tx = b.tx; const ty = b.ty;
      if (b.x < 0) { b.x = tx; b.y = ty; } // first frame: start in place
      const nx = b.x + (tx + b.pushX - b.x) * k;
      b.vx += ((nx - b.x) / Math.max(dt, 1e-3) - b.vx) * k;
      // turn around only on a clear change of direction (no flicker)
      if (b.vx > 4) b.dir = 1; else if (b.vx < -4) b.dir = -1;
      // never drift into the middle, even when pushed by a neighbour
      b.x = Math.min(box.w * b.zone[1], Math.max(box.w * b.zone[0], nx));
      b.y += (ty + b.pushY - b.y) * k;
      b.y += Math.sin(time * 9 + b.p2) * 0.6; // tiny buzz
    }
  }

  function draw(ctx) {
    if (!frames) return;
    const wing = (Math.floor(time * FLAP_HZ) % 2) * 2;
    const w = frames[0].width / dpr; const h = frames[0].height / dpr;
    for (let i = 0; i < bees.length; i++) {
      const b = bees[i];
      const dw = w * b.depth; const dh = h * b.depth;
      ctx.drawImage(frames[wing + (b.dir < 0 ? 1 : 0)], b.x - dw / 2, b.y - dh / 2, dw, dh);
    }
  }

  return { resize, update, draw };
}
