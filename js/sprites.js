// Small offscreen-canvas helpers shared by the renderers. Anything drawn with
// text, strokes or paths more than once is rasterised here once and then only
// blitted with drawImage in the frame loop (text shaping — especially colour
// emoji — and path tessellation are the slowest canvas calls on phones).

export function makeCanvas(w, h, dpr, reuse = null) {
  const c = reuse || document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

// One shared scratch context for measuring text (never drawn to screen).
let probe = null;
export function measure(text, font) {
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  return probe.measureText(text).width;
}

// Outlined text centred in its own canvas. The canvas carries its CSS size in
// `cssW` / `cssH` so callers can centre it without knowing the dpr.
export function textSprite(text, { font, px, color, stroke = null, lineWidth = 0, dpr, reuse = null }) {
  const full = font.replace('{px}', px);
  const pad = lineWidth / 2 + 2;
  const textW = measure(text, full);
  const w = textW + pad * 2;
  const h = px * 1.35 + pad * 2;
  const { c, ctx } = makeCanvas(w, h, dpr, reuse);
  ctx.font = full;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (stroke && lineWidth) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, w / 2, h / 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  c.cssW = c.width / dpr;
  c.cssH = c.height / dpr;
  c.textW = textW;
  return c;
}

// Bounded LRU memo: `build()` runs only on a miss; the least recently used
// entry goes when full, so hot sprites (e.g. the 😋 popup) are never evicted.
export function createMemo(max) {
  const map = new Map();
  return {
    get(key, build) {
      let v = map.get(key);
      if (v === undefined) {
        if (map.size >= max) map.delete(map.keys().next().value);
        v = build();
      } else {
        map.delete(key);
      }
      map.set(key, v);
      return v;
    },
    clear: () => map.clear(),
  };
}

// Soft ground shadow as a sprite: one drawImage instead of a path + fill.
export function shadowSprite(color, dpr) {
  const rx = 48; const ry = 12;
  const { c, ctx } = makeCanvas(rx * 2 + 2, ry * 2 + 2, dpr);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(rx + 1, ry + 1, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  c.padX = 1 / (rx * 2 + 2); // fraction of the canvas that is margin, per side
  c.padY = 1 / (ry * 2 + 2);
  return c;
}

// `steps` pre-rotated copies of a square sprite in one horizontal strip, so a
// spinning projectile is an axis-aligned blit instead of setTransform + rotate.
// Cells are 1.25× the sprite so rotated corners are never clipped.
export const SPIN_PAD = 1.25;
export function spinStrip(img, steps) {
  const cell = Math.ceil(img.width * SPIN_PAD);
  const c = document.createElement('canvas');
  c.width = cell * steps;
  c.height = cell;
  const ctx = c.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), cell * i + cell / 2, cell / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  }
  c.cell = cell;
  c.steps = steps;
  return c;
}
