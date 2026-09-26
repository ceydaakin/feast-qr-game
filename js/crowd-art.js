// Crowd-shooter sprites, pre-rendered once into offscreen canvases.
// Sizes are the "z = 0" (closest) size in CSS px × dpr; the engine only scales them.

import { gateLabel, isGoodGate } from './squad-logic.js';

const INK = '#3a1d10';
const RED = '#ff3131';
const FONT = 'ui-rounded, system-ui, -apple-system, sans-serif';
const GATE_COLORS = { good: ['rgba(43,182,115,0.78)', '#1d8f58'], bad: ['rgba(255,49,49,0.78)', '#c01818'] };

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

function ellipse(ctx, x, y, rx, ry, fill, line = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) ink(ctx, line);
}

// Chef seen from behind, arm raised to throw. Leader gets a gold star + wider mustache.
function chefBack(size, dpr, leader) {
  const w = size * 0.8; const h = size;
  const { c, ctx } = makeCanvas(w + 6, h + 6, dpr);
  ctx.translate(3, 3);
  const lw = Math.max(1.5, size * 0.035);
  const cx = w / 2;
  // legs
  ctx.fillStyle = '#2b2b33';
  rr(ctx, cx - w * 0.2, h * 0.78, w * 0.16, h * 0.2, 3); ctx.fill();
  rr(ctx, cx + w * 0.04, h * 0.78, w * 0.16, h * 0.2, 3); ctx.fill();
  // throwing arm (raised, right)
  rr(ctx, cx + w * 0.22, h * 0.3, w * 0.14, h * 0.3, w * 0.07);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, lw);
  ellipse(ctx, cx + w * 0.29, h * 0.3, w * 0.08, w * 0.08, '#f2c09a', lw);
  // body (white jacket) + red apron strings
  rr(ctx, cx - w * 0.3, h * 0.44, w * 0.6, h * 0.4, w * 0.16);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, lw);
  ctx.fillStyle = RED;
  ctx.fillRect(cx - w * 0.28, h * 0.66, w * 0.56, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.68); ctx.lineTo(cx - w * 0.07, h * 0.8); ctx.lineTo(cx + w * 0.01, h * 0.8);
  ctx.moveTo(cx, h * 0.68); ctx.lineTo(cx + w * 0.07, h * 0.8); ctx.lineTo(cx - w * 0.01, h * 0.8);
  ctx.fill();
  // head (back of), mustache tips poking out
  const hy = h * 0.37;
  ctx.fillStyle = '#6b3b1f';
  const tip = leader ? w * 0.36 : w * 0.3;
  ctx.beginPath();
  ctx.ellipse(cx - tip * 0.78, hy + h * 0.05, tip * 0.34, h * 0.035, -0.4, 0, Math.PI * 2);
  ctx.ellipse(cx + tip * 0.78, hy + h * 0.05, tip * 0.34, h * 0.035, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ellipse(ctx, cx, hy, w * 0.2, h * 0.12, '#f2c09a', lw);
  ellipse(ctx, cx, hy + h * 0.02, w * 0.19, h * 0.09, '#6b3b1f');
  // toque
  rr(ctx, cx - w * 0.17, h * 0.17, w * 0.34, h * 0.13, 3);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, lw);
  ctx.beginPath();
  ctx.arc(cx - w * 0.12, h * 0.14, w * 0.12, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.12, h * 0.14, w * 0.12, 0, Math.PI * 2);
  ctx.arc(cx, h * 0.09, w * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, lw);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - w * 0.15, h * 0.16, w * 0.3, h * 0.06);
  if (leader) {
    star(ctx, cx, h * 0.12, w * 0.1, '#ffd23f', lw * 0.8);
  }
  return c;
}

function star(ctx, x, y, r, fill, lw) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, lw);
}

// Hungry customer walking toward the camera: hangry face, drool, fork up.
function eater(size, dpr, { skin = '#c9e3a1', shirt = '#7b61ff', big = false, label = big ? 'OBUR' : 'AÇ' } = {}) {
  const w = size * 0.8; const h = size;
  const { c, ctx } = makeCanvas(w + 6, h + 6, dpr);
  ctx.translate(3, 3);
  const lw = Math.max(1.5, size * 0.03);
  const cx = w / 2;
  ctx.fillStyle = '#34344a';
  rr(ctx, cx - w * 0.2, h * 0.8, w * 0.15, h * 0.18, 3); ctx.fill();
  rr(ctx, cx + w * 0.05, h * 0.8, w * 0.15, h * 0.18, 3); ctx.fill();
  // body + bib
  rr(ctx, cx - w * 0.32, h * 0.46, w * 0.64, h * 0.38, w * 0.2);
  ctx.fillStyle = shirt; ctx.fill(); ink(ctx, lw);
  rr(ctx, cx - w * 0.17, h * 0.48, w * 0.34, h * 0.26, 6);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, lw * 0.8);
  ctx.font = `900 ${h * 0.09}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = RED;
  ctx.fillText(label, cx, h * 0.61, w * 0.3);
  // fork (left) and knife (right) raised
  ctx.strokeStyle = '#9aa0aa';
  ctx.lineWidth = lw * 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.38, h * 0.55); ctx.lineTo(cx - w * 0.42, h * 0.22);
  ctx.moveTo(cx + w * 0.38, h * 0.55); ctx.lineTo(cx + w * 0.42, h * 0.22);
  ctx.stroke();
  [-0.46, -0.42, -0.38].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(cx + w * k, h * 0.24); ctx.lineTo(cx + w * k, h * 0.16);
    ctx.stroke();
  });
  ellipse(ctx, cx + w * 0.43, h * 0.19, w * 0.035, h * 0.06, '#c7ccd4', lw * 0.6);
  ellipse(ctx, cx - w * 0.38, h * 0.55, w * 0.06, w * 0.06, skin, lw * 0.8);
  ellipse(ctx, cx + w * 0.38, h * 0.55, w * 0.06, w * 0.06, skin, lw * 0.8);
  // head
  const hy = h * 0.3;
  ellipse(ctx, cx, hy, w * 0.26, h * 0.17, skin, lw);
  // angry brows + eyes
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.16, hy - h * 0.08); ctx.lineTo(cx - w * 0.04, hy - h * 0.05);
  ctx.moveTo(cx + w * 0.16, hy - h * 0.08); ctx.lineTo(cx + w * 0.04, hy - h * 0.05);
  ctx.stroke();
  ellipse(ctx, cx - w * 0.09, hy - h * 0.015, w * 0.035, h * 0.03, INK);
  ellipse(ctx, cx + w * 0.09, hy - h * 0.015, w * 0.035, h * 0.03, INK);
  // open mouth + tongue + drool
  ellipse(ctx, cx, hy + h * 0.075, w * 0.11, h * 0.055, '#6a1414', lw * 0.8);
  ellipse(ctx, cx, hy + h * 0.1, w * 0.06, h * 0.022, '#ff7a8a');
  ellipse(ctx, cx + w * 0.08, hy + h * 0.14, w * 0.025, h * 0.03, '#9fd8ff');
  return c;
}

function buildGateSprite(gate, laneW, dpr) {
  const w = laneW * 1.44; const h = laneW * 0.95;
  const { c, ctx } = makeCanvas(w + 6, h + 6, dpr);
  ctx.translate(3, 3);
  const [fill, edge] = GATE_COLORS[isGoodGate(gate) ? 'good' : 'bad'];
  // posts
  ctx.fillStyle = edge;
  rr(ctx, 0, 0, w * 0.06, h, 4); ctx.fill();
  rr(ctx, w * 0.94, 0, w * 0.06, h, 4); ctx.fill();
  // translucent panel
  rr(ctx, w * 0.04, h * 0.18, w * 0.92, h * 0.64, 8);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  // top bar with feast.
  rr(ctx, w * 0.02, 0, w * 0.96, h * 0.16, 6);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 2.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${h * 0.11}px ${FONT}`;
  ctx.fillStyle = RED;
  ctx.fillText('feast.', w / 2, h * 0.085);
  // big label
  ctx.font = `900 ${h * 0.4}px ${FONT}`;
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.strokeText(gateLabel(gate), w / 2, h * 0.52);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(gateLabel(gate), w / 2, h * 0.52);
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.8); ctx.lineTo(w * 0.28, h * 0.2); ctx.lineTo(w * 0.36, h * 0.2); ctx.lineTo(w * 0.18, h * 0.8);
  ctx.fill();
  return c;
}

export function buildGateSprites(gates, laneW, dpr) {
  return gates.map((g) => buildGateSprite(g, laneW, dpr));
}

// "Kilitli mekân": frosted crate with the app's cuisine photo inside + padlock.
function lockedPlace(img, label, laneW, dpr) {
  const w = laneW * 1.3; const h = laneW * 1.15;
  const { c, ctx } = makeCanvas(w + 6, h + 6, dpr);
  ctx.translate(3, 3);
  rr(ctx, 0, h * 0.1, w, h * 0.9, 12);
  ctx.fillStyle = '#d7f0ff'; ctx.fill(); ink(ctx, 3.5);
  const pad = w * 0.08;
  const iw = w - pad * 2; const ih = h * 0.56;
  ctx.save();
  rr(ctx, pad, h * 0.1 + pad, iw, ih, 8);
  ctx.clip();
  if (img && img.naturalWidth) {
    const s = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const dw = img.naturalWidth * s; const dh = img.naturalHeight * s;
    ctx.drawImage(img, pad + (iw - dw) / 2, h * 0.1 + pad + (ih - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#ffe7cc';
    ctx.fillRect(pad, h * 0.1 + pad, iw, ih);
  }
  // frost overlay
  ctx.fillStyle = 'rgba(200,235,255,0.45)';
  ctx.fillRect(pad, h * 0.1 + pad, iw, ih);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(pad, h * 0.1 + pad + ih * 0.7); ctx.lineTo(pad + iw * 0.4, h * 0.1 + pad);
  ctx.lineTo(pad + iw * 0.55, h * 0.1 + pad); ctx.lineTo(pad, h * 0.1 + pad + ih);
  ctx.fill();
  ctx.restore();
  // label band
  const bandY = h * 0.1 + pad + ih + 4;
  rr(ctx, pad, bandY, iw, h - bandY - pad * 0.6, 6);
  ctx.fillStyle = RED; ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${h * 0.1}px ${FONT}`;
  ctx.fillText(label, w / 2, bandY + (h - bandY - pad * 0.6) / 2, iw - 8);
  // padlock on top
  const lx = w / 2; const ly = h * 0.1;
  ctx.beginPath();
  ctx.arc(lx, ly, w * 0.08, Math.PI, 0);
  ctx.lineWidth = w * 0.035; ctx.strokeStyle = '#8a8f98'; ctx.stroke();
  rr(ctx, lx - w * 0.11, ly, w * 0.22, h * 0.15, 5);
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ink(ctx, 2.5);
  return c;
}

const DEFAULT_SHIRTS = ['#7b61ff', '#2a9df4', '#ff8a00'];

// `theme` (optional) re-labels the crowd: e.g. İTÜ shirts and a "FİNAL" boss.
export function buildCrowdSprites(laneW, dpr, places, theme = {}) {
  const member = Math.round(laneW * 0.46);
  const shirts = theme.shirts || DEFAULT_SHIRTS;
  const label = theme.eaterLabel;
  return {
    chef: chefBack(member, dpr, false),
    leader: chefBack(member * 1.3, dpr, true),
    eaters: [
      eater(laneW * 0.62, dpr, { shirt: shirts[0], label }),
      eater(laneW * 0.62, dpr, { shirt: shirts[1], skin: '#d4e8a8', label }),
      eater(laneW * 0.62, dpr, { shirt: shirts[2], skin: '#bfdc9a', label }),
    ],
    big: eater(laneW * 1.1, dpr, { shirt: '#3a1d10', skin: '#b6d58f', big: true, label: theme.bigLabel }),
    boss: eater(laneW * 2.1, dpr, { shirt: RED, skin: '#a9cf7f', big: true, label: theme.bossLabel }),
    places: places.map((p) => lockedPlace(p.img, p.label, laneW, dpr)),
  };
}

// Small icons for the start-screen legend.
export function buildLegendIcons(dpr, theme = {}) {
  return {
    gate: buildGateSprite({ op: 'mul', value: 2 }, 34, dpr),
    gateBad: buildGateSprite({ op: 'sub', value: 3 }, 34, dpr),
    eater: eater(40, dpr, { shirt: (theme.shirts || DEFAULT_SHIRTS)[0], label: theme.eaterLabel }),
    big: eater(40, dpr, { shirt: '#3a1d10', skin: '#b6d58f', big: true }),
    chef: chefBack(40, dpr, true),
  };
}
