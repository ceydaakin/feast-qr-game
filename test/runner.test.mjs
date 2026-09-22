import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUN, speedAt, rowGapAt, classifyGesture, nextLane, collides, project, pickRow, runScore,
} from '../js/runner-logic.js';

test('speedAt starts at base, rises, and never exceeds max', () => {
  assert.equal(speedAt(0), RUN.baseSpeed);
  assert.ok(speedAt(30) > speedAt(10));
  assert.ok(speedAt(1e6) <= RUN.maxSpeed);
});

test('rowGapAt keeps a reaction window of at least minReactSec', () => {
  for (const t of [0, 20, 60, 300]) {
    const v = speedAt(t);
    assert.ok(rowGapAt(v) / v >= RUN.minReactSec - 1e-9, `t=${t}`);
  }
});

test('classifyGesture maps swipes and taps', () => {
  assert.equal(classifyGesture(-60, 5, 120), 'left');
  assert.equal(classifyGesture(70, -10, 120), 'right');
  assert.equal(classifyGesture(4, -80, 120), 'up');
  assert.equal(classifyGesture(-8, 90, 120), 'down');
  assert.equal(classifyGesture(3, 4, 90), 'tap');
  assert.equal(classifyGesture(10, 10, 900), 'none');
});

test('nextLane clamps to the three lanes', () => {
  assert.equal(nextLane(0, 'left'), -1);
  assert.equal(nextLane(-1, 'left'), -1);
  assert.equal(nextLane(1, 'right'), 1);
  assert.equal(nextLane(0, 'up'), 0);
});

test('collides respects jump, slide and full-height obstacles', () => {
  const run = { jump: 0, sliding: false };
  const jumping = { jump: 0.8, sliding: false };
  const sliding = { jump: 0, sliding: true };
  assert.equal(collides('barrier', run), true);
  assert.equal(collides('barrier', jumping), false);
  assert.equal(collides('overhead', run), true);
  assert.equal(collides('overhead', sliding), false);
  assert.equal(collides('overhead', jumping), true);
  assert.equal(collides('truck', jumping), true);
  assert.equal(collides('truck', sliding), true);
});

test('project shrinks with distance and hits scale 1 at the player', () => {
  const near = project(0);
  const far = project(40);
  assert.equal(near.scale, 1);
  assert.ok(far.scale < near.scale && far.scale > 0);
  assert.ok(far.t < near.t);
});

test('pickRow never blocks all lanes and keeps coins in a free lane', () => {
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2000; i++) {
    const row = pickRow(rnd, i / 2000);
    const blocked = new Set(row.obstacles.map((o) => o.lane));
    assert.ok(blocked.size <= 2);
    row.obstacles.forEach((o) => assert.ok(['barrier', 'overhead', 'truck'].includes(o.type)));
    if (row.coinLane !== null) assert.ok(!blocked.has(row.coinLane) || row.obstacles.find((o) => o.lane === row.coinLane).type !== 'truck');
    if (row.special) assert.ok(['pin', 'mustache'].includes(row.special.kind));
  }
});

test('runScore adds distance and item points', () => {
  assert.equal(runScore(120.7, 35), 155);
});
