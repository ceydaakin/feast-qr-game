// Pure rules for the crowd shooter (Last Z style): gates grow the chef squad,
// the squad throws food forward to feed hungry crowds and break locked restaurants.
// No DOM access so everything here is unit-tested in Node.

export const SQUAD = Object.freeze({
  startCount: 3,
  maxCount: 999,
  maxVisible: 42, // drawn members; the rest only exist as the number on the banner
  maxRadius: 0.5, // formation radius in road units — small enough that a full squad fits one gate panel
  roadHalf: 1.5,
  edgePad: 0.3,
  dragGain: 1.6, // full-road swipe moves the squad 1.6 road widths (feels snappy)
  chefDps: 6,
  fireEvery: 0.09,
  bulletSpeed: 52,
  bulletRange: 42,
  baseSpeed: 11,
  maxSpeed: 18,
  speedRampSec: 25, // mostly ramped inside the 45 s round
  eaterWalk: 2.4,
  camDist: 20,
  spawnZ: 56,
  segmentGap: 15,
  bossEvery: 7, // every Nth segment is a boss…
  firstBoss: 13, // …but never before the squad had time to grow
  eaterPerChef: 4, // an eater with hp h grabs ceil(h / 4) chefs on contact
  blockPerChef: 10,
  fedPoints: 10,
  pinPoints: 100,
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// `max` lets a theme raise the squad cap (İTÜ: 999 999 instead of 999).
export function applyGate(count, gate, max = SQUAD.maxCount) {
  let next = count;
  if (gate.op === 'add') next = count + gate.value;
  else if (gate.op === 'sub') next = count - gate.value;
  else if (gate.op === 'mul') next = count * gate.value;
  else if (gate.op === 'div') next = Math.ceil(count / gate.value);
  return clamp(Math.round(next), 1, max);
}

const SYMBOL = { add: '+', sub: '-', mul: '×', div: '÷' };
export const gateLabel = (gate) => `${SYMBOL[gate.op]}${gate.value}`;
export const isGoodGate = (gate) => gate.op === 'add' || gate.op === 'mul';
export const gateSide = (x) => (x < 0 ? 0 : 1);

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SLOT_SPACING = SQUAD.maxRadius / Math.sqrt(SQUAD.maxVisible - 1);

// Sunflower packing: dense, round blob that grows outward as chefs join.
export function formation(count) {
  const n = clamp(count, 0, SQUAD.maxVisible);
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return { dx: 0, dz: 0 };
    const r = SLOT_SPACING * Math.sqrt(i);
    const a = i * GOLDEN;
    return { dx: r * Math.cos(a), dz: r * Math.sin(a) };
  });
}

export const squadRadius = (count) => SLOT_SPACING * Math.sqrt(Math.max(0, Math.min(count, SQUAD.maxVisible) - 1)) + 0.22;

// How far the squad centre may steer: the blob stays on the road, and a full
// squad pushed to one side still fits inside a single gate panel.
export const squadReach = (count) => Math.max(0.2, SQUAD.roadHalf - squadRadius(count) * 0.95);

export function volleyDamage(count, projectiles) {
  if (projectiles <= 0 || count <= 0) return 0;
  return (count * SQUAD.chefDps * SQUAD.fireEvery) / projectiles;
}

export function contactLoss(kind, hp) {
  const per = kind === 'block' ? SQUAD.blockPerChef : SQUAD.eaterPerChef;
  return Math.max(1, Math.ceil(hp / per));
}

export function speedAt(elapsedSec) {
  const k = 1 - Math.exp(-Math.max(0, elapsedSec) / SQUAD.speedRampSec);
  return SQUAD.baseSpeed + (SQUAD.maxSpeed - SQUAD.baseSpeed) * k;
}

export function hordeHp(difficulty, count) {
  return Math.max(1, Math.round(1 + difficulty * 4 + count * 0.12));
}

// Seconds of full squad fire a locked restaurant soaks up, rounded to a friendly number.
export function blockHp(difficulty, count) {
  const raw = count * SQUAD.chefDps * lerp(1.1, 1.9, clamp(difficulty, 0, 1));
  const step = raw > 200 ? 10 : raw > 40 ? 5 : 1;
  return Math.max(4, Math.round(raw / step) * step);
}

export const blockReward = (count) => Math.max(5, Math.round(count * 0.5));

function pickGood(rnd, difficulty, count) {
  if (count >= 6 && rnd() < 0.45) return { op: 'mul', value: rnd() < 0.25 + difficulty * 0.2 ? 3 : 2 };
  const base = 4 + Math.round(difficulty * 10);
  return { op: 'add', value: base + Math.floor(rnd() * 6) };
}

function pickBad(rnd, difficulty, count) {
  if (count >= 8 && rnd() < 0.4) return { op: 'div', value: 2 };
  const value = Math.max(2, Math.round(count * lerp(0.3, 0.6, difficulty)));
  return { op: 'sub', value };
}

function gatesSegment(rnd, difficulty, count) {
  const good = pickGood(rnd, difficulty, count);
  const other = rnd() < 0.35 + difficulty * 0.4 ? pickBad(rnd, difficulty, count) : pickGood(rnd, difficulty, count);
  return { type: 'gates', gates: rnd() < 0.5 ? [good, other] : [other, good] };
}

function hordeSegment(rnd, difficulty, count) {
  const n = 3 + Math.round(difficulty * 7) + Math.min(10, Math.floor(count / 6));
  const hp = hordeHp(difficulty, count);
  const lane = SQUAD.roadHalf - 0.25;
  const eaters = Array.from({ length: n }, (_, i) => ({
    x: clamp(lerp(-lane, lane, rnd()), -lane, lane),
    dz: (i / n) * 7 + rnd() * 1.5,
    hp,
    big: false,
  }));
  if (difficulty > 0.3 && rnd() < 0.5) {
    eaters.push({ x: lerp(-0.8, 0.8, rnd()), dz: 8.5, hp: hp * 8, big: true });
  }
  return { type: 'horde', eaters };
}

function blockSegment(rnd, difficulty, count) {
  return {
    type: 'block',
    x: rnd() < 0.5 ? -0.75 : 0.75,
    hp: blockHp(difficulty, count),
    cuisine: Math.floor(rnd() * 6),
  };
}

function bossSegment(rnd, difficulty, count) {
  return { type: 'boss', x: 0, hp: Math.round(blockHp(difficulty, count) * 1.25) };
}

const BUILDERS = { gates: gatesSegment, horde: hordeSegment, block: blockSegment, boss: bossSegment };
const RHYTHM = [['gates', 0.4], ['horde', 0.4], ['block', 0.2]];

// One stretch of road. difficulty ∈ [0, 1]; `type` forces a segment (engine drives the rhythm).
export function pickSegment(rnd, difficulty, count, type = null) {
  let chosen = type;
  if (!chosen) {
    let r = rnd();
    chosen = RHYTHM[RHYTHM.length - 1][0];
    for (const [name, w] of RHYTHM) {
      if (r < w) { chosen = name; break; }
      r -= w;
    }
  }
  return BUILDERS[chosen](rnd, clamp(difficulty, 0, 1), Math.max(1, count));
}

export function crowdScore({ dist, fed, discovered, peak }) {
  return Math.floor(dist) + fed * SQUAD.fedPoints + discovered * SQUAD.pinPoints + peak;
}

export function dragToX(startX, dxPx, roadPx) {
  const limit = SQUAD.roadHalf - SQUAD.edgePad;
  return clamp(startX + (dxPx / Math.max(1, roadPx)) * SQUAD.dragGain, -limit, limit);
}

// A run is a short, fixed-length taste of feast: 45 s, then the store pitch.
export const ROUND = Object.freeze({
  seconds: 45,
  finalStretch: 10, // last N seconds: HUD shakes, clock ticks, chef hypes the app
});

export const roundLeft = (elapsedSec) => Math.max(0, Math.ceil(ROUND.seconds - Math.max(0, elapsedSec)));

export const isFinalStretch = (elapsedSec) => elapsedSec > ROUND.seconds - ROUND.finalStretch && elapsedSec < ROUND.seconds;
