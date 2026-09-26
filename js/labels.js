// Outlined number labels (enemy HP) composed from a digit atlas. HP changes on
// nearly every bullet hit (~55/s in a boss fight), so a per-value cache kept
// missing and rasterising fresh text + canvases in the frame loop. Now the ten
// digits are rendered once per resize — the ink outline in one strip, the fill
// in one strip per colour — and a label is 2 × digits drawImage calls with no
// allocation. All outlines are drawn before all fills, exactly like a single
// strokeText + fillText, so neighbouring digits never cover each other.

import { makeCanvas, measure } from './sprites.js';

const BASE_PX = 48;
const PAD = BASE_PX * 0.2;
const CELL_H = BASE_PX * 1.3;
const GAP = 2; // device px between cells so filtering never bleeds a neighbour in

export function createLabelCache({ font, ink }) {
  const fontStr = `900 ${BASE_PX}px ${font}`;
  let dpr = 1;
  let adv = null; // CSS px advance per digit at BASE_PX
  let cellX = null; // device-px x of each digit cell in the strips
  let cellW = null; // device-px width of each cell
  let outline = null;
  const fills = new Map();

  function strip(paint) {
    const total = cellX[9] + cellW[9];
    const { c, ctx } = makeCanvas(total / dpr, CELL_H, dpr);
    ctx.font = fontStr;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let d = 0; d < 10; d++) paint(ctx, String(d), cellX[d] / dpr + PAD, CELL_H / 2);
    return c;
  }

  function fillFor(color) {
    let c = fills.get(color);
    if (!c) {
      c = strip((ctx, ch, x, y) => { ctx.fillStyle = color; ctx.fillText(ch, x, y); });
      fills.set(color, c);
    }
    return c;
  }

  // Draws `value` (a non-negative integer) centred on (x, y) at roughly `size` px.
  function draw(ctx, value, x, y, size, color) {
    if (!outline) return;
    const v = value > 0 ? Math.floor(value) : 0;
    const k = size / BASE_PX;
    let top = 1;
    while (top * 10 <= v) top *= 10;
    let total = 0;
    for (let p = top; p >= 1; p = Math.floor(p / 10)) total += adv[Math.floor(v / p) % 10];
    const fill = fillFor(color);
    const dh = CELL_H * k;
    const dy = y - dh / 2;
    for (let pass = 0; pass < 2; pass++) {
      const img = pass === 0 ? outline : fill;
      let cx = x - (total * k) / 2;
      for (let p = top; p >= 1; p = Math.floor(p / 10)) {
        const d = Math.floor(v / p) % 10;
        const sw = cellW[d];
        ctx.drawImage(img, cellX[d], 0, sw, img.height, cx - PAD * k, dy, (sw / dpr) * k, dh);
        cx += adv[d] * k;
      }
    }
  }

  function reset(pixelRatio) {
    dpr = pixelRatio;
    fills.clear();
    adv = []; cellX = []; cellW = [];
    let at = 0;
    for (let d = 0; d < 10; d++) {
      adv[d] = measure(String(d), fontStr);
      cellX[d] = at;
      cellW[d] = Math.ceil((adv[d] + PAD * 2) * dpr);
      at += cellW[d] + GAP;
    }
    outline = strip((ctx, ch, x, y) => {
      ctx.lineWidth = BASE_PX * 0.22;
      ctx.strokeStyle = ink;
      ctx.strokeText(ch, x, y);
    });
  }

  return { draw, reset };
}
