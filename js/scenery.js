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

// Roadside text sign for event themes (e.g. "Ayazağa / Yemekhane sırası →").
export function buildSign([title, sub], laneW, dpr) {
  const w = laneW * 1.05; const h = laneW * 1.2;
  const { c, ctx } = makeCanvas(w + 8, h + 8, dpr);
  ctx.translate(4, 4);
  ctx.fillStyle = '#6b6f78';
  rr(ctx, w * 0.46, h * 0.5, w * 0.08, h * 0.5, 3);
  ctx.fill();
  ink(ctx, 2);
  rr(ctx, 0, 0, w, h * 0.56, 12);
  ctx.fillStyle = '#0b3e7a';
  ctx.fill();
  ink(ctx, 3.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${h * 0.14}px ${FONT}`;
  ctx.fillText(title, w / 2, h * 0.2, w - 14);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `800 ${h * 0.1}px ${FONT}`;
  ctx.fillText(sub, w / 2, h * 0.4, w - 14);
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

// Ground palettes: the default beige street, or an athletics track in a stadium.
export const GROUNDS = Object.freeze({
  street: {
    field: '#f4d6b0', side: '#e8c49a', sideAlt: null, road: '#6a605d', roadStripe: 'rgba(255,255,255,0.07)',
    edgeA: RED, edgeB: '#ffffff', lanes: null, haze: '255,243,227',
  },
  stadium: {
    // roadStripe: null — a real tartan track is one smooth colour, only the lane lines show.
    // sideFar: the average of side/sideAlt, used for grass too far away for single stripes.
    field: '#5cae4a', side: '#4f9e3f', sideAlt: '#63b953', sideFar: '#59ac49', road: '#c1502f', roadStripe: null,
    edgeA: '#ffffff', edgeB: '#ffffff', lanes: 'rgba(255,255,255,0.8)', haze: '238,246,251', toHorizon: true,
  },
});

// Palette sampled from photos of the ITU Stadium (Ayazağa): pale sky, Maslak
// glass towers, apartment blocks, trees, light-grey side stands, white railings.
const TOWERS = ['#8fa3b8', '#a7b8c9', '#7e93a8', '#b5c3d1'];
const BLOCKS = ['#e9d7c3', '#dcc6b0', '#efe3d3', '#d8cbbd'];
// [x (0..1), width, height] in skyline units; the tall cluster sits right, like Maslak.
const SKYLINE = [[0.02, 5, 26], [0.27, 4, 20], [0.45, 6, 34], [0.62, 4, 22], [0.7, 5, 30], [0.78, 4, 38],
  [0.84, 5, 44], [0.9, 4, 36], [0.95, 5, 28]];

// Far end of the ITU Stadium, seen from the track.
export function renderStadium(w, horizonY, dpr) {
  const { c, ctx } = makeCanvas(w, horizonY + 2, dpr);
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#b9dcf5');
  sky.addColorStop(1, '#eef6fb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 2);
  const u = Math.min(w, 520) / 100;
  const base = horizonY;
  // Maslak towers
  SKYLINE.forEach(([x, tw, th], i) => {
    const px = x * w; const top = base - th * u - 10 * u;
    ctx.fillStyle = TOWERS[i % TOWERS.length];
    ctx.fillRect(px, top, tw * u, base - top);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = top + 2 * u; y < base; y += 3 * u) ctx.fillRect(px + 0.6 * u, y, tw * u - 1.2 * u, 0.7 * u);
  });
  // apartment blocks
  for (let x = 0, i = 0; x < w; x += 13 * u, i++) {
    const bh = (9 + (i * 7) % 6) * u;
    ctx.fillStyle = BLOCKS[i % BLOCKS.length];
    ctx.fillRect(x, base - bh - 4 * u, 11 * u, bh + 4 * u);
    ctx.fillStyle = 'rgba(90,70,60,0.35)';
    for (let wy = base - bh - 2 * u; wy < base - 4 * u; wy += 3 * u) {
      for (let wx = x + 1.5 * u; wx < x + 10 * u; wx += 3 * u) ctx.fillRect(wx, wy, 1.2 * u, 1.2 * u);
    }
  }
  // tree line
  ctx.fillStyle = '#4f7f45';
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let x = 0, i = 0; x <= w + 8 * u; x += 5 * u, i++) {
    ctx.arc(x, base - 5 * u - ((i * 5) % 3) * u, 4 * u, Math.PI, 0);
  }
  ctx.lineTo(w, base);
  ctx.fill();
  // floodlight masts
  [0.18, 0.5, 0.82].forEach((x) => drawFloodlight(ctx, w * x, base - 44 * u, base, u));
  // scoreboard + white railing along the far end
  ctx.fillStyle = '#22252b';
  ctx.fillRect(w / 2 - 7 * u, base - 11 * u, 14 * u, 6 * u);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w / 2 - 0.6 * u, base - 5 * u, 1.2 * u, 5 * u);
  ctx.fillRect(0, base - 3.2 * u, w, 0.9 * u);
  ctx.fillRect(0, base - 0.9 * u, w, 0.9 * u);
  for (let x = 0; x < w; x += 6 * u) ctx.fillRect(x, base - 3.2 * u, 0.7 * u, 3.2 * u);
  drawSideStand(ctx, 0, w * 0.3, base, u, false);
  drawSideStand(ctx, w, w * 0.7, base, u, true);
  return c;
}

// Light-grey seating wedge receding toward the far end; the right one has the
// white cantilever roof seen in photos.
function drawSideStand(ctx, outerX, innerX, base, u, roofed) {
  const nearH = 26 * u; const farH = 7 * u;
  ctx.fillStyle = '#c9ced5';
  ctx.beginPath();
  ctx.moveTo(outerX, base - nearH);
  ctx.lineTo(innerX, base - farH);
  ctx.lineTo(innerX, base);
  ctx.lineTo(outerX, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#eef1f4';
  ctx.lineWidth = 0.8 * u;
  for (let k = 1; k < 7; k++) { // seat rows
    const f = k / 7;
    ctx.beginPath();
    ctx.moveTo(outerX, base - nearH * f);
    ctx.lineTo(innerX, base - farH * f);
    ctx.stroke();
  }
  if (roofed) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(outerX, base - nearH - 8 * u);
    ctx.quadraticCurveTo((outerX + innerX) / 2, base - nearH - 6 * u, innerX, base - farH - 4 * u);
    ctx.lineTo(innerX, base - farH - 2.5 * u);
    ctx.quadraticCurveTo((outerX + innerX) / 2, base - nearH - 3 * u, outerX, base - nearH - 5 * u);
    ctx.fill();
    ctx.strokeStyle = '#8a9099';
    ctx.lineWidth = 0.5 * u;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff'; // front railing
  ctx.fillRect(Math.min(outerX, innerX), base - 1.4 * u, Math.abs(innerX - outerX), 1.4 * u);
}

function drawFloodlight(ctx, x, top, base, u) {
  ctx.fillStyle = '#7d828a';
  ctx.fillRect(x - 0.5 * u, top, u, base - top);
  ctx.fillStyle = '#f4f6f8';
  ctx.strokeStyle = '#7d828a';
  ctx.lineWidth = 0.5 * u;
  rr(ctx, x - 3 * u, top - 2 * u, 6 * u, 3 * u, 0.6 * u);
  ctx.fill();
  ctx.stroke();
}
