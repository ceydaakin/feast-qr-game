// Screen-space overlays drawn over the road: squad count banner, chef speech
// bubble and the countdown/tutorial. Each is rasterised once (per value, per
// line of speech, per resize) and only blitted per frame — these used to set
// fonts, measure and draw emoji text every single frame.

import { makeCanvas, textSprite, measure, createMemo } from './sprites.js';

const BANNER_MAX_POP = 1.2; // count banner bumps up to 1.2×; rendered at that size
const DIGIT_MAX_POP = 1.6; // countdown digit shrinks from 1.6×
const BUBBLE_LINE_H = 19;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h); // iOS < 16
}

export function createOverlays({ font, colors }) {
  const texts = createMemo(24);
  const bannerCanvas = document.createElement('canvas');
  let bannerFor = -1;
  let bannerW = 0; let bannerH = 0;
  let dpr = 1;

  function reset(pixelRatio) {
    dpr = pixelRatio;
    texts.clear();
    bannerFor = -1;
  }

  // ---------- count banner ----------
  function renderBanner(count) {
    const k = BANNER_MAX_POP;
    const text = `👨‍🍳 ${count}`;
    const f = `900 ${Math.round(20 * k)}px ${font}`;
    const w = measure(text, f) + 22 * k;
    const h = 30 * k;
    const pad = 3;
    makeCanvas(w + pad * 2, h + pad * 2, dpr, bannerCanvas); // reuses the one canvas
    const ctx = bannerCanvas.getContext('2d');
    rr(ctx, pad, pad, w, h, h / 2);
    ctx.fillStyle = colors.red;
    ctx.fill();
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.font = f;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad + w / 2, pad + h / 2 + k);
    bannerW = (w + pad * 2) / k;
    bannerH = (h + pad * 2) / k;
    bannerFor = count;
  }

  function drawBanner(ctx, count, x, y, pop) {
    if (count !== bannerFor) renderBanner(count);
    const w = bannerW * pop; const h = bannerH * pop;
    ctx.drawImage(bannerCanvas, x - w / 2, y - h / 2, w, h);
  }

  // ---------- speech bubble ----------
  // Body + text rendered once when the chef starts talking; the tail follows
  // the squad per frame (3-point path), since the box is clamped to the screen.
  function makeBubble(lines) {
    const f = `800 15px ${font}`;
    let textW = 0;
    for (let i = 0; i < lines.length; i++) textW = Math.max(textW, measure(lines[i], f));
    const bw = textW + 28;
    const bh = lines.length * BUBBLE_LINE_H + 18;
    const pad = 2;
    const { c, ctx } = makeCanvas(bw + pad * 2, bh + pad * 2, dpr);
    rr(ctx, pad, pad, bw, bh, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.ink;
    ctx.stroke();
    ctx.font = f;
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], pad + bw / 2, pad + 9 + BUBBLE_LINE_H * (i + 0.5));
    }
    return { img: c, bw, bh, pad };
  }

  function drawBubble(ctx, b, headX, tipY, alpha, scale, viewW) {
    const { bw, bh, pad } = b.card;
    const bx = Math.max(10, Math.min(viewW - bw - 10, headX - bw / 2));
    const by = tipY - bh - 12;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(headX, tipY);
    ctx.scale(scale, scale);
    ctx.translate(-headX, -tipY);
    ctx.drawImage(b.card.img, bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
    ctx.beginPath();
    ctx.moveTo(headX - 9, by + bh - 1);
    ctx.lineTo(headX, tipY);
    ctx.lineTo(headX + 9, by + bh - 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.ink;
    ctx.stroke();
    ctx.fillRect(headX - 7.5, by + bh - 3, 15, 4); // hide the seam where the tail joins
    ctx.restore();
  }

  // ---------- countdown ----------
  function digitSprite(n) {
    return texts.get(`d${n}`, () => textSprite(String(n), {
      font: `900 {px}px ${font}`, px: 96 * DIGIT_MAX_POP, color: colors.red,
      stroke: colors.ink, lineWidth: 12 * DIGIT_MAX_POP, dpr,
    }));
  }

  function lineSprite(line) {
    return texts.get(`l${line}`, () => textSprite(line, {
      font: `900 {px}px ${font}`, px: 17, color: colors.ink, stroke: '#ffffff', lineWidth: 5, dpr,
    }));
  }

  function blitCentred(ctx, img, x, y, s) {
    const w = img.cssW * s; const h = img.cssH * s;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }

  // Tutorial as one tidy card (themes with `tutorialCard`): white rounded
  // panel, ink border, one short line per row. Rendered once per resize.
  function cardSprite(lines) {
    return texts.get(`card${lines.join('|')}`, () => {
      const f = `800 16px ${font}`;
      const lineH = 26;
      let textW = 0;
      for (let i = 0; i < lines.length; i++) textW = Math.max(textW, measure(lines[i], f));
      const w = textW + 36; const h = lines.length * lineH + 22; const pad = 6;
      const { c, ctx } = makeCanvas(w + pad * 2, h + pad * 2 + 4, dpr);
      rr(ctx, pad, pad + 4, w, h, 18); // offset "shadow"
      ctx.fillStyle = colors.ink;
      ctx.fill();
      rr(ctx, pad, pad, w, h, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors.ink;
      ctx.stroke();
      ctx.font = f;
      ctx.fillStyle = colors.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], pad + w / 2, pad + 11 + lineH * (i + 0.5));
      c.cssW = w + pad * 2;
      c.cssH = h + pad * 2 + 4;
      return c;
    });
  }

  function drawCountdown(ctx, countdown, cx, cy, lines, card = false) {
    const n = Math.ceil(countdown);
    const frac = countdown - Math.floor(countdown);
    ctx.globalAlpha = Math.min(1, frac * 3 + 0.2);
    blitCentred(ctx, digitSprite(n), cx, cy, (1 + frac * 0.6) / DIGIT_MAX_POP);
    ctx.globalAlpha = 1;
    if (card) {
      if (lines.length) blitCentred(ctx, cardSprite(lines), cx, cy + 112, 1);
      return;
    }
    for (let i = 0; i < lines.length; i++) blitCentred(ctx, lineSprite(lines[i]), cx, cy + 90 + i * 28, 1);
  }

  return { reset, drawBanner, makeBubble, drawBubble, drawCountdown };
}
