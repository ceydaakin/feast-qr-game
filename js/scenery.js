// Road scenery, pre-rendered once into offscreen canvases.
// Every sprite is drawn at its "z = 0" (closest) size in CSS px × dpr; the engine
// only scales them with drawImage.

const INK = '#3a1d10';
const RED = '#ff3131';
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';

function makeCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { c, ctx };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function ink(ctx, w = 3) {
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// Roadside billboard: the app's own cuisine photo + "feast'te keşfet!".
export function buildBillboard(img, label, cta, laneW, dpr) {
  const w = laneW * 1.05; const h = laneW * 1.55;
  const { c, ctx } = makeCanvas(w + 8, h + 8, dpr);
  ctx.translate(4, 4);
  ctx.fillStyle = '#6b6f78';
  rr(ctx, w * 0.46, h * 0.6, w * 0.08, h * 0.4, 3);
  ctx.fill();
  ink(ctx, 2);
  rr(ctx, 0, 0, w, h * 0.66, 12);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ink(ctx, 3.5);
  const pad = w * 0.06;
  const iw = w - pad * 2; const ih = h * 0.4;
  ctx.save();
  rr(ctx, pad, pad, iw, ih, 8);
  ctx.clip();
  if (img && img.naturalWidth) {
    const s = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth * s; const dh = img.naturalHeight * s;
    ctx.drawImage(img, pad + (iw - dw) / 2, pad + (ih - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#ffe7cc';
    ctx.fillRect(pad, pad, iw, ih);
  }
  ctx.restore();
  ctx.fillStyle = RED;
  rr(ctx, pad, pad + ih + 4, iw, h * 0.66 - ih - pad * 2 - 4, 6);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const bandY = pad + ih + 4;
  const bandH = h * 0.66 - ih - pad * 2 - 4;
  ctx.font = `900 ${bandH * 0.36}px ${FONT}`;
  ctx.fillText(label, w / 2, bandY + bandH * 0.32, iw - 8);
  ctx.font = `800 ${bandH * 0.26}px ${FONT}`;
  ctx.fillText(cta, w / 2, bandY + bandH * 0.72, iw - 8);
  return c;
}

// Sky + Istanbul skyline, drawn once per resize.
export function renderSky(w, horizonY, dpr) {
  const { c, ctx } = makeCanvas(w, horizonY + 2, dpr);
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#ffd9a8');
  sky.addColorStop(0.6, '#ffe9cf');
  sky.addColorStop(1, '#fff3e3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  [[0.2, 0.3, 26], [0.7, 0.18, 34], [0.9, 0.42, 20]].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(w * x, horizonY * y, r, 0, Math.PI * 2);
    ctx.arc(w * x + r, horizonY * y + 4, r * 0.8, 0, Math.PI * 2);
    ctx.arc(w * x - r, horizonY * y + 6, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
  const base = horizonY;
  ctx.fillStyle = '#e8b9a0';
  const u = Math.min(w, 520) / 100;
  const cx = w / 2;
  // domes
  [[-30, 9], [0, 13], [26, 8]].forEach(([dx, r]) => {
    ctx.beginPath();
    ctx.arc(cx + dx * u, base - 6 * u, r * u, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx + (dx - r) * u, base - 6 * u, r * 2 * u, 6 * u);
  });
  // minarets
  [-44, -18, 18, 40].forEach((dx) => {
    ctx.fillRect(cx + dx * u - 1.2 * u, base - 30 * u, 2.4 * u, 30 * u);
    ctx.beginPath();
    ctx.moveTo(cx + dx * u - 1.8 * u, base - 30 * u);
    ctx.lineTo(cx + dx * u, base - 37 * u);
    ctx.lineTo(cx + dx * u + 1.8 * u, base - 30 * u);
    ctx.fill();
  });
  // Galata tower on the left
  const gx = w * 0.14;
  ctx.fillRect(gx - 4 * u, base - 26 * u, 8 * u, 26 * u);
  ctx.beginPath();
  ctx.moveTo(gx - 5 * u, base - 26 * u);
  ctx.lineTo(gx, base - 36 * u);
  ctx.lineTo(gx + 5 * u, base - 26 * u);
  ctx.fill();
  // low rooftops band
  ctx.fillStyle = '#efc7ae';
  for (let x = 0; x < w; x += 18 * u) {
    const hh = (4 + ((x * 7) % 5)) * u;
    ctx.fillRect(x, base - hh, 17 * u, hh);
  }
  return c;
}
