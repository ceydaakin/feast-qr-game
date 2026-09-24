// Particles + floating text, pooled. Entries are mutated in place on purpose —
// allocating per frame would cause GC hitches on low-end phones.

const INK = '#3a1d10';
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';

const pool = (n) => Array.from({ length: n }, () => ({ active: false }));
const acquire = (arr) => arr.find((o) => !o.active) || null;

export function createFx(ctx) {
  const particles = pool(140);
  const popups = pool(16);

  function burst(x, y, color, count, speed = 1) {
    for (let i = 0; i < count; i++) {
      const p = acquire(particles);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 200) * speed;
      const life = 0.45 + Math.random() * 0.3;
      Object.assign(p, {
        active: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140,
        life, max: life, color, size: 3 + Math.random() * 4,
      });
    }
  }

  function popup(x, y, text, color, big = false) {
    const p = acquire(popups);
    if (!p) return;
    const life = big ? 1.3 : 0.7;
    Object.assign(p, { active: true, x, y, text, color, big, life, max: life });
  }

  function update(dt) {
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

  function draw() {
    particles.forEach((p) => {
      if (!p.active) return;
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    popups.forEach((p) => {
      if (!p.active) return;
      const k = p.life / p.max;
      const pop = p.big ? 1 + Math.max(0, k - 0.8) * 2 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${Math.round((p.big ? 28 : 22) * pop)}px ${FONT}`;
      const fit = Math.min(1, (ctx.canvas.clientWidth - 24) / Math.max(1, ctx.measureText(p.text).width));
      if (fit < 1) ctx.font = `900 ${Math.floor((p.big ? 28 : 22) * pop * fit)}px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  const clear = () => [particles, popups].forEach((arr) => arr.forEach((o) => { o.active = false; }));
  const busy = () => particles.some((p) => p.active) || popups.some((p) => p.active);

  return { burst, popup, update, draw, clear, busy };
}
