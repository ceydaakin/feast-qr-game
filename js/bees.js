// Decorative bees buzzing over the stadium (event theme). Screen-space only —
// they never collide with anything. Two pre-rendered wing frames per resize;
// flight state is mutated in place (hot path, no per-frame allocation).

const INK = '#3a1d10';
const FLAP_HZ = 18;

function beeFrame(size, dpr, wingsUp) {
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

export function createBees(count) {
  const bees = Array.from({ length: count }, (_, i) => ({
    phase: i * 2.1, speed: 0.35 + (i % 3) * 0.12, depth: 0.55 + (i % 4) * 0.15, x: 0, y: 0, dir: 1,
  }));
  let frames = null;
  let box = { w: 1, top: 0, bottom: 1 };
  let time = 0;
  let dpr = 1;

  function resize(w, top, bottom, size, pixelRatio) {
    dpr = pixelRatio;
    box = { w, top, bottom };
    frames = [beeFrame(size, dpr, true), beeFrame(size, dpr, false)];
  }

  // Lazy figure-eight loops across the upper field.
  function update(dt) {
    time += dt;
    const midY = (box.top + box.bottom) / 2;
    const ampY = (box.bottom - box.top) / 2;
    bees.forEach((b) => {
      const t = time * b.speed + b.phase;
      const nx = box.w * (0.5 + 0.44 * Math.sin(t));
      b.dir = nx >= b.x ? 1 : -1;
      b.x = nx;
      b.y = midY + ampY * Math.sin(t * 2 + b.phase) * 0.8 + Math.sin(time * 9 + b.phase) * 2;
    });
  }

  function draw(ctx) {
    if (!frames) return;
    const frame = frames[Math.floor(time * FLAP_HZ) % 2];
    const w = frame.width / dpr; const h = frame.height / dpr;
    bees.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.dir * b.depth, b.depth);
      ctx.drawImage(frame, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }

  return { resize, update, draw };
}
