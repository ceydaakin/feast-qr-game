// The road/field. Everything that does not scroll (sky, field, verges, road,
// solid curbs, lane lines) is baked once per resize into one opaque backdrop,
// so a frame is one full-screen blit plus the scrolling stripes and the haze
// instead of ~8 overlapping full-screen path fills.

import { SQUAD } from './squad-logic.js';
import { makeCanvas } from './sprites.js';

const TILE = 2.5; // world units per road tile
const EDGE = SQUAD.roadHalf;
const Z_NEAR = -SQUAD.camDist * 0.2;
const Z_FAR = SQUAD.spawnZ + 40;
const SIDES = [[-8, -EDGE - 0.12], [EDGE + 0.12, 8]];
const CURBS = [[-EDGE - 0.12, -EDGE], [EDGE, EDGE + 0.12]];
const ROAD = [[-EDGE, EDGE]];
const LANES = [-0.75, 0, 0.75].map((l) => [l - 0.02, l + 0.02]);

export function createGround(ground, proj) {
  const { xAt, yAt } = proj;
  let haze = null;
  let hazeH = 0;

  // Adds one road-space quad to the current path (callers fill once per colour).
  function quad(ctx, l0, l1, z0, z1) {
    const y0 = yAt(z0); const y1 = yAt(z1);
    ctx.moveTo(xAt(l0, z0), y0);
    ctx.lineTo(xAt(l1, z0), y0);
    ctx.lineTo(xAt(l1, z1), y1);
    ctx.lineTo(xAt(l0, z1), y1);
    ctx.closePath();
  }

  function fillQuads(ctx, color, spans) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < spans.length; i++) quad(ctx, spans[i][0], spans[i][1], Z_NEAR, Z_FAR);
    ctx.fill();
  }

  // Every other half-tile of `spans`, scrolled by distance — one fill per colour.
  function fillStripes(ctx, color, spans, shift, dist) {
    if (!color) return;
    const off = dist % TILE;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = -1; k * TILE < SQUAD.spawnZ; k++) {
      const z0 = k * TILE - off + shift;
      for (let i = 0; i < spans.length; i++) quad(ctx, spans[i][0], spans[i][1], z0, z0 + TILE / 2);
    }
    ctx.fill();
  }

  const solidCurbs = ground.edgeA === ground.edgeB;

  // Static layers, in the same order they used to be painted each frame.
  function renderBackdrop(sky, w, h, horizonY, groundY, dpr, frameCtx) {
    const { c, ctx } = makeCanvas(w, h, dpr);
    ctx.drawImage(sky, 0, 0, w, horizonY + 2);
    ctx.fillStyle = ground.field;
    ctx.fillRect(0, horizonY, w, h - horizonY);
    fillQuads(ctx, ground.side, SIDES);
    fillQuads(ctx, ground.road, ROAD);
    if (solidCurbs) fillQuads(ctx, ground.edgeA, CURBS);
    if (ground.lanes) fillQuads(ctx, ground.lanes, LANES);
    hazeH = (groundY - horizonY) * 0.16;
    haze = frameCtx.createLinearGradient(0, horizonY, 0, horizonY + hazeH);
    haze.addColorStop(0, `rgba(${ground.haze},1)`);
    haze.addColorStop(1, `rgba(${ground.haze},0)`);
    return c;
  }

  // Per frame: only what scrolls, then the horizon haze on top.
  function drawMoving(ctx, dist, w, horizonY) {
    fillStripes(ctx, ground.sideAlt, SIDES, 0, dist); // mowed-grass stripes
    fillStripes(ctx, ground.roadStripe, ROAD, 0, dist);
    if (!solidCurbs) {
      fillStripes(ctx, ground.edgeA, CURBS, 0, dist);
      fillStripes(ctx, ground.edgeB, CURBS, TILE / 2, dist);
    }
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY, w, hazeH);
  }

  return { renderBackdrop, drawMoving, TILE };
}
