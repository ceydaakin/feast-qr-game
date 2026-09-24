import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SQUAD, applyGate, gateLabel, isGoodGate, gateSide, formation, volleyDamage,
  contactLoss, speedAt, hordeHp, blockHp, pickSegment, crowdScore, dragToX,
} from '../js/squad-logic.js';

const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('applyGate adds, subtracts, multiplies and divides', () => {
  assert.equal(applyGate(5, { op: 'add', value: 10 }), 15);
  assert.equal(applyGate(5, { op: 'sub', value: 3 }), 2);
  assert.equal(applyGate(5, { op: 'mul', value: 3 }), 15);
  assert.equal(applyGate(5, { op: 'div', value: 2 }), 3);
});

test('applyGate never kills the whole squad and respects the cap', () => {
  assert.equal(applyGate(3, { op: 'sub', value: 20 }), 1);
  assert.equal(applyGate(1, { op: 'div', value: 3 }), 1);
  assert.equal(applyGate(SQUAD.maxCount - 1, { op: 'mul', value: 10 }), SQUAD.maxCount);
});

test('gateLabel and isGoodGate describe the gate', () => {
  assert.equal(gateLabel({ op: 'add', value: 5 }), '+5');
  assert.equal(gateLabel({ op: 'sub', value: 4 }), '-4');
  assert.equal(gateLabel({ op: 'mul', value: 2 }), '×2');
  assert.equal(gateLabel({ op: 'div', value: 2 }), '÷2');
  assert.ok(isGoodGate({ op: 'mul', value: 2 }));
  assert.ok(!isGoodGate({ op: 'sub', value: 2 }));
});

test('gateSide picks the half of the road the squad centre is on', () => {
  assert.equal(gateSide(-0.3), 0);
  assert.equal(gateSide(0.01), 1);
  assert.equal(gateSide(0), 1);
});

test('formation returns one slot per visible member, leader first at the centre', () => {
  const slots = formation(12);
  assert.equal(slots.length, 12);
  assert.deepEqual(slots[0], { dx: 0, dz: 0 });
  assert.equal(formation(SQUAD.maxCount).length, SQUAD.maxVisible);
  const radius = Math.max(...formation(SQUAD.maxVisible).map((p) => Math.hypot(p.dx, p.dz)));
  assert.ok(radius <= SQUAD.maxRadius + 1e-9);
});

test('volleyDamage splits the squad firepower over the projectiles', () => {
  const total = volleyDamage(10, 4) * 4;
  assert.ok(Math.abs(total - 10 * SQUAD.chefDps * SQUAD.fireEvery) < 1e-9);
  assert.equal(volleyDamage(0, 4), 0);
});

test('contactLoss scales with what is left of a block', () => {
  assert.equal(contactLoss('eater', 1), 1);
  assert.equal(contactLoss('block', 1), 1);
  assert.ok(contactLoss('block', 200) > contactLoss('block', 20));
});

test('speedAt ramps up and stays bounded', () => {
  assert.equal(speedAt(0), SQUAD.baseSpeed);
  assert.ok(speedAt(40) > speedAt(5));
  assert.ok(speedAt(1e6) <= SQUAD.maxSpeed);
});

test('hordeHp and blockHp grow with difficulty and squad size', () => {
  assert.ok(hordeHp(1, 10) >= hordeHp(0, 10));
  assert.ok(blockHp(0.5, 40) > blockHp(0.5, 5));
  assert.ok(blockHp(0, 1) >= 1);
});

test('pickSegment returns a gate pair with one good side', () => {
  const seg = pickSegment(seq(0.05, 0.3, 0.7, 0.2, 0.9), 0.2, 10, 'gates');
  assert.equal(seg.type, 'gates');
  assert.equal(seg.gates.length, 2);
  assert.ok(seg.gates.some(isGoodGate));
});

test('pickSegment builds hordes and blocks that scale with the squad', () => {
  const horde = pickSegment(seq(0.4, 0.5, 0.6), 0.5, 20, 'horde');
  assert.equal(horde.type, 'horde');
  assert.ok(horde.eaters.length >= 3);
  horde.eaters.forEach((e) => {
    assert.ok(Math.abs(e.x) <= SQUAD.roadHalf);
    assert.ok(e.hp >= 1);
  });
  const block = pickSegment(seq(0.2, 0.8), 0.5, 20, 'block');
  assert.equal(block.type, 'block');
  assert.ok([-1, 1].includes(Math.sign(block.x)));
  assert.ok(block.hp >= 1);
});

test('pickSegment without a forced type follows the level rhythm', () => {
  const types = new Set();
  for (let i = 0; i < 40; i++) types.add(pickSegment(Math.random, 0.5, 10).type);
  assert.ok(types.has('gates') && types.has('horde'));
});

test('crowdScore rewards feeding, discovering and distance', () => {
  assert.equal(crowdScore({ dist: 100.7, fed: 3, discovered: 1, peak: 12 }), 100 + 3 * SQUAD.fedPoints + SQUAD.pinPoints + 12);
});

test('dragToX converts screen drag to a clamped squad position', () => {
  assert.equal(dragToX(0, 100, 200), 0.5 * SQUAD.dragGain);
  assert.equal(dragToX(1.4, 1000, 200), SQUAD.roadHalf - SQUAD.edgePad);
  assert.equal(dragToX(-1.4, -1000, 200), -(SQUAD.roadHalf - SQUAD.edgePad));
});
