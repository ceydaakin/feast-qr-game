// Procedural cartoon ingredient art. Each item is drawn once into an offscreen
// canvas (sprite cache) so the game loop only ever calls drawImage.

import { spriteOverride, drawContain } from './sprites.js';

const INK = '#3a1d10';

function outline(ctx, w = 3) {
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function shine(ctx, x, y, rx, ry, rot = -0.6, alpha = 0.55) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// All painters draw inside a 100x100 box centred on (0,0).
const PAINTERS = {
  tomato(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 6, 40, 36, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e8352b';
    ctx.fill();
    outline(ctx, 4);
    shine(ctx, -16, -8, 10, 6);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * 18, -28 + Math.sin(a) * 9);
      const b = a + Math.PI / 5;
      ctx.lineTo(Math.cos(b) * 6, -28 + Math.sin(b) * 3);
    }
    ctx.closePath();
    ctx.fillStyle = '#3f9a3a';
    ctx.fill();
    outline(ctx, 3);
  },
  cheese(ctx) {
    ctx.beginPath();
    ctx.moveTo(-40, 26);
    ctx.lineTo(40, 26);
    ctx.lineTo(34, -12);
    ctx.lineTo(-40, -30);
    ctx.closePath();
    ctx.fillStyle = '#ffc93c';
    ctx.fill();
    outline(ctx, 4);
    ctx.fillStyle = '#e8a318';
    [[-14, 4, 8], [12, 12, 6], [-26, -14, 5], [20, -4, 4]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    shine(ctx, -20, 18, 14, 3, 0, 0.45);
  },
  pepperoni(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#b8261d';
    ctx.fill();
    outline(ctx, 4);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#d23a2a';
    ctx.fill();
    ctx.fillStyle = '#8e1a14';
    [[-12, -10, 5], [10, -14, 4], [14, 8, 6], [-8, 14, 4], [0, 0, 3]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    shine(ctx, -14, -18, 9, 4);
  },
  mushroom(ctx) {
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-14, 36);
    ctx.quadraticCurveTo(0, 42, 14, 36);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fillStyle = '#f4e3c8';
    ctx.fill();
    outline(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(-42, 6);
    ctx.bezierCurveTo(-42, -40, 42, -40, 42, 6);
    ctx.quadraticCurveTo(0, -4, -42, 6);
    ctx.closePath();
    ctx.fillStyle = '#a8703f';
    ctx.fill();
    outline(ctx, 4);
    shine(ctx, -14, -20, 12, 5);
  },
  olive(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 30, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2a2f';
    ctx.fill();
    outline(ctx, 4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 11, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#b3313a';
    ctx.fill();
    outline(ctx, 3);
    shine(ctx, -14, -14, 8, 4, -0.6, 0.35);
  },
  basil(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.bezierCurveTo(-46, 10, -30, -34, 0, -42);
    ctx.bezierCurveTo(30, -34, 46, 10, 0, 40);
    ctx.closePath();
    ctx.fillStyle = '#3fae49';
    ctx.fill();
    outline(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(0, -34);
    [-18, -2, 14].forEach((y) => {
      ctx.moveTo(0, y);
      ctx.lineTo(-16, y - 10);
      ctx.moveTo(0, y);
      ctx.lineTo(16, y - 10);
    });
    ctx.strokeStyle = '#2a7f33';
    ctx.lineWidth = 3;
    ctx.stroke();
    shine(ctx, -14, -12, 6, 12, 0.3, 0.3);
  },
  mustache(ctx) {
    const grad = ctx.createLinearGradient(0, -30, 0, 30);
    grad.addColorStop(0, '#fff2a8');
    grad.addColorStop(0.5, '#ffc21a');
    grad.addColorStop(1, '#d68a00');
    ctx.save();
    ctx.shadowColor = 'rgba(255,200,40,0.9)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(14, -24, 34, -18, 38, -2);
    ctx.bezierCurveTo(46, -6, 48, -18, 44, -24);
    ctx.bezierCurveTo(56, -14, 50, 18, 26, 16);
    ctx.bezierCurveTo(14, 16, 6, 8, 0, 4);
    ctx.bezierCurveTo(-6, 8, -14, 16, -26, 16);
    ctx.bezierCurveTo(-50, 18, -56, -14, -44, -24);
    ctx.bezierCurveTo(-48, -18, -46, -6, -38, -2);
    ctx.bezierCurveTo(-34, -18, -14, -24, 0, -8);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    outline(ctx, 4);
    shine(ctx, -22, -6, 9, 3, -0.3, 0.7);
    shine(ctx, 22, -6, 9, 3, 0.3, 0.7);
  },
  boot(ctx) {
    ctx.beginPath();
    ctx.moveTo(-22, -40);
    ctx.lineTo(8, -40);
    ctx.lineTo(10, 4);
    ctx.quadraticCurveTo(42, 8, 44, 26);
    ctx.lineTo(44, 34);
    ctx.lineTo(-26, 34);
    ctx.closePath();
    ctx.fillStyle = '#7a4a2a';
    ctx.fill();
    outline(ctx, 4);
    ctx.fillStyle = '#4f2e18';
    ctx.fillRect(-26, 26, 70, 8);
    ctx.beginPath();
    ctx.moveTo(-26, 26);
    ctx.lineTo(44, 26);
    outline(ctx, 3);
    ctx.strokeStyle = '#d9c3a0';
    ctx.lineWidth = 3;
    [-28, -18, -8].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(-16, y);
      ctx.lineTo(4, y + 4);
      ctx.stroke();
    });
    // stink lines
    ctx.strokeStyle = '#7fae3a';
    ctx.lineWidth = 3;
    [-34, -20].forEach((x, i) => {
      ctx.beginPath();
      ctx.moveTo(x + 40, -30);
      ctx.bezierCurveTo(x + 48, -36 - i * 4, x + 36, -42, x + 44, -48);
      ctx.stroke();
    });
  },
  fishbone(ctx) {
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    const bones = () => {
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(28, 0);
      [-14, -2, 10].forEach((x) => {
        ctx.moveTo(x, -18);
        ctx.quadraticCurveTo(x + 6, 0, x, 18);
      });
      ctx.stroke();
    };
    bones();
    ctx.strokeStyle = '#e9edf0';
    ctx.lineWidth = 4;
    bones();
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(44, -18);
    ctx.lineTo(44, 18);
    ctx.closePath();
    ctx.fillStyle = '#e9edf0';
    ctx.fill();
    outline(ctx, 3);
    ctx.beginPath();
    ctx.ellipse(-34, 0, 14, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e9edf0';
    ctx.fill();
    outline(ctx, 3);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-40, -6);
    ctx.lineTo(-34, 0);
    ctx.moveTo(-34, -6);
    ctx.lineTo(-40, 0);
    ctx.stroke();
  },
  // Restaurant pin: feast-red map marker with a fork & knife — "new place discovered".
  pin(ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,49,49,0.75)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.bezierCurveTo(-8, 30, -38, 8, -38, -12);
    ctx.arc(0, -12, 38, Math.PI, 0);
    ctx.bezierCurveTo(38, 8, 8, 30, 0, 46);
    ctx.closePath();
    ctx.fillStyle = '#ff3131';
    ctx.fill();
    ctx.restore();
    outline(ctx, 4);
    ctx.beginPath();
    ctx.arc(0, -12, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    outline(ctx, 3);
    // fork
    ctx.strokeStyle = '#ff3131';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    [-13, -9, -5].forEach((x) => { ctx.moveTo(x, -26); ctx.lineTo(x, -17); });
    ctx.moveTo(-13, -17);
    ctx.quadraticCurveTo(-9, -12, -5, -17);
    ctx.moveTo(-9, -14);
    ctx.lineTo(-9, 2);
    // knife
    ctx.moveTo(8, 2);
    ctx.lineTo(8, -26);
    ctx.quadraticCurveTo(15, -18, 12, -8);
    ctx.lineTo(8, -8);
    ctx.stroke();
    shine(ctx, -20, -30, 8, 4, -0.6, 0.5);
  },
  pineapple(ctx) {
    ctx.beginPath();
    [[-16, -26, -8, -48], [0, -28, 0, -52], [16, -26, 8, -48]].forEach(([x, y, tx, ty]) => {
      ctx.moveTo(x - 7, y);
      ctx.quadraticCurveTo(tx - 4, (y + ty) / 2, tx, ty);
      ctx.quadraticCurveTo(tx + 4, (y + ty) / 2, x + 7, y);
    });
    ctx.fillStyle = '#3f9a3a';
    ctx.fill();
    outline(ctx, 3);
    ctx.beginPath();
    ctx.ellipse(0, 8, 28, 36, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2b52c';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#b87a12';
    ctx.lineWidth = 2.5;
    for (let i = -60; i <= 60; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i - 40, -40);
      ctx.lineTo(i + 40, 50);
      ctx.moveTo(i + 40, -40);
      ctx.lineTo(i - 40, 50);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 8, 28, 36, 0, 0, Math.PI * 2);
    outline(ctx, 4);
  },
};

// Red "no" badge stamped on bad items so they read as hazards at a glance.
function stampNo(ctx) {
  ctx.save();
  ctx.translate(30, 30);
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ff3131';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(10, 10);
  ctx.stroke();
  ctx.restore();
}

// True when this food can be shown: drawn procedurally or loaded as an image.
export const canDrawFood = (kind) => Boolean(PAINTERS[kind] || spriteOverride(kind));

export function renderSprite(kind, sizePx, isBad) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  const png = spriteOverride(kind); // e.g. assets/itu/tomato.png
  if (png) {
    const pad = sizePx * (10 / 120); // same margin the drawn food has
    drawContain(ctx, png, pad, pad, sizePx - pad * 2, sizePx - pad * 2, 'center');
    if (isBad) {
      ctx.translate(sizePx / 2, sizePx / 2);
      ctx.scale(sizePx / 120, sizePx / 120);
      stampNo(ctx);
    }
    return canvas;
  }
  // 100-unit box plus padding for glow/outline overflow.
  const scale = sizePx / 120;
  ctx.translate(sizePx / 2, sizePx / 2);
  ctx.scale(scale, scale);
  PAINTERS[kind](ctx);
  if (isBad) stampNo(ctx);
  return canvas;
}

export function buildSpriteCache(kinds, sizePx, isBadFn) {
  return Object.fromEntries(kinds.map((k) => [k, renderSprite(k, sizePx, isBadFn(k))]));
}

// Warm kitchen backdrop: cream wall with brand-red awning and a tiled counter.
export function renderBackground(w, h, dpr) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#fff6e8');
  wall.addColorStop(1, '#ffe7cc');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // soft polka dots
  ctx.fillStyle = 'rgba(255,49,49,0.06)';
  for (let y = 40; y < h * 0.8; y += 46) {
    for (let x = (y / 46) % 2 ? 23 : 0; x < w + 46; x += 46) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // awning scallops
  const stripe = Math.max(28, w / 10);
  const awningH = 26;
  for (let x = 0, i = 0; x < w; x += stripe, i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#ff3131';
    ctx.fillRect(x, 0, stripe, awningH);
    ctx.beginPath();
    ctx.arc(x + stripe / 2, awningH, stripe / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, awningH + stripe / 2, w, 3);

  // counter tiles
  const counterY = h * 0.9;
  const tile = 26;
  for (let y = counterY, r = 0; y < h; y += tile, r++) {
    for (let x = 0, c = 0; x < w; x += tile, c++) {
      ctx.fillStyle = (r + c) % 2 ? '#ff3131' : '#fff4ec';
      ctx.fillRect(x, y, tile, tile);
    }
  }
  ctx.fillStyle = '#c9a27a';
  ctx.fillRect(0, counterY - 8, w, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, counterY, w, 4);
  return canvas;
}
