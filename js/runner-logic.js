// Pure rules for the endless runner (lanes, speed, gestures, collisions, spawning).
// No DOM access so everything here is unit-tested in Node.

export const RUN = Object.freeze({
  lanes: [-1, 0, 1],
  baseSpeed: 14, // world units per second
  maxSpeed: 30,
  speedRampSec: 50,
  minReactSec: 0.42, // min time between obstacle rows at any speed
  baseGap: 13,
  camDist: 6, // perspective: scale = camDist / (z + camDist)
  spawnZ: 70,
  lives: 3,
  invulnSec: 1.4,
  jumpSec: 0.62,
  slideSec: 0.62,
  laneSwitchSec: 0.12,
  jumpClear: 0.45, // jump height fraction needed to clear a barrier
  magnetSec: 6,
  coinSpacing: 2.2,
  coinsPerLine: 5,
  swipeMin: 28, // px
  tapMax: 14, // px
  gestureMaxMs: 600,
});

export function speedAt(elapsedSec) {
  const k = 1 - Math.exp(-Math.max(0, elapsedSec) / RUN.speedRampSec);
  return RUN.baseSpeed + (RUN.maxSpeed - RUN.baseSpeed) * k;
}

// Rows get closer as speed rises, but never below the reaction window.
export function rowGapAt(speed) {
  const shrink = (speed - RUN.baseSpeed) / (RUN.maxSpeed - RUN.baseSpeed);
  const gap = RUN.baseGap * (1 - shrink * 0.2);
  return Math.max(gap, speed * RUN.minReactSec);
}

export function classifyGesture(dx, dy, ms) {
  if (ms > RUN.gestureMaxMs) return 'none';
  const dist = Math.hypot(dx, dy);
  if (dist <= RUN.tapMax) return 'tap';
  if (dist < RUN.swipeMin) return 'none';
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export function nextLane(lane, dir) {
  if (dir === 'left') return Math.max(-1, lane - 1);
  if (dir === 'right') return Math.min(1, lane + 1);
  return lane;
}

// barrier: low → jump over. overhead: banner → slide under. truck: must change lane.
export function collides(type, player) {
  if (type === 'barrier') return player.jump < RUN.jumpClear;
  if (type === 'overhead') return !player.sliding;
  return true;
}

// t: 0 at the horizon → 1 at the player (used to place things on screen).
export function project(z) {
  const scale = RUN.camDist / (Math.max(0, z) + RUN.camDist);
  return { scale, t: scale };
}

const OBSTACLE_WEIGHTS = [['barrier', 0.4], ['overhead', 0.3], ['truck', 0.3]];

function weighted(rnd, table) {
  let r = rnd();
  for (const [value, w] of table) {
    if (r < w) return value;
    r -= w;
  }
  return table[table.length - 1][0];
}

function shuffledLanes(rnd) {
  const lanes = [...RUN.lanes];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)) % (i + 1);
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes;
}

// One "row" of the track. difficulty ∈ [0, 1].
export function pickRow(rnd, difficulty) {
  const lanes = shuffledLanes(rnd);
  const coinOnly = rnd() < 0.28 - difficulty * 0.12;
  const blockedCount = coinOnly ? 0 : rnd() < 0.25 + difficulty * 0.4 ? 2 : 1;
  const obstacles = lanes.slice(0, blockedCount).map((lane) => ({ lane, type: weighted(rnd, OBSTACLE_WEIGHTS) }));
  const free = lanes.slice(blockedCount);
  const coinLane = coinOnly || rnd() < 0.65 ? free[0] : null;
  const s = rnd();
  const special = s < 0.08
    ? { kind: 'pin', lane: free[free.length - 1] }
    : s < 0.11 ? { kind: 'mustache', lane: free[free.length - 1] } : null;
  return { obstacles, coinLane, special };
}

export function runScore(distance, itemPoints) {
  return Math.floor(distance) + itemPoints;
}
