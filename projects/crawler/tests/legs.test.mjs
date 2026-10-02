// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegs, legJoints, advanceLegs } from '../src/legs.ts';

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const intersects = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8;

function assertAnatomy(body, scale, legs) {
  assert.equal(legs.length, 8);
  const chains = legs.map(leg => ({ ...legJoints(body, scale, leg), side: leg.side, row: leg.row }));
  for (const leg of chains) {
    for (const point of [leg.hip, leg.knee, leg.foot]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      const lateral = -(point.x - body.x) * Math.sin(body.angle) + (point.y - body.y) * Math.cos(body.angle);
      assert.ok(lateral * leg.side > 0, `pair ${leg.row + 1} crossed the body midline`);
    }
  }
  for (let a = 0; a < chains.length; a++) for (let b = a + 1; b < chains.length; b++) {
    const first = chains[a], second = chains[b];
    for (const [start, end] of [[first.hip, first.knee], [first.knee, first.foot]]) {
      for (const [otherStart, otherEnd] of [[second.hip, second.knee], [second.knee, second.foot]]) {
        assert.equal(intersects(start, end, otherStart, otherEnd), false, `legs ${a} and ${b} intersect`);
      }
    }
  }
}

test('eight distinct legs form four mirrored pairs, with rear knees on their own side', () => {
  const body = { x: 0, y: 0, angle: 0 };
  const legs = createLegs(body, 1);
  for (const side of [-1, 1]) assert.deepEqual(legs.filter(leg => leg.side === side).map(leg => leg.row), [0, 1, 2, 3]);
  for (let row = 0; row < 4; row++) {
    const left = legJoints(body, 1, legs[row]), right = legJoints(body, 1, legs[row + 4]);
    for (const joint of ['hip', 'knee', 'foot']) {
      assert.ok(Math.abs(left[joint].x - right[joint].x) < 1e-8);
      assert.ok(Math.abs(left[joint].y + right[joint].y) < 1e-8);
    }
  }
  assertAnatomy(body, 1, legs);
});

test('stance is planted, zero dt is inert, and walking alternates two supporting groups', () => {
  const body = { x: 0, y: 0, angle: 0 };
  const legs = createLegs(body, 1);
  const initial = structuredClone(legs);
  assert.equal(advanceLegs(legs, body, 1, 0, 0), 0);
  assert.deepEqual(legs, initial);
  body.x = 1;
  advanceLegs(legs, body, 1, 1 / 60, 0);
  legs.forEach((leg, index) => assert.deepEqual(leg.foot, initial[index].foot));
  const groups = new Set();
  let next = 0;
  for (let frame = 0; frame < 360; frame++) {
    body.x += 0.8;
    next = advanceLegs(legs, body, 1, 1 / 60, next);
    const moving = legs.filter(leg => leg.progress < 1);
    if (moving.length) {
      assert.equal(moving.length, 4);
      assert.equal(moving.filter(leg => leg.side === -1).length, 2);
      assert.equal(moving.filter(leg => leg.side === 1).length, 2);
      groups.add(moving.map(leg => `${leg.side}:${leg.row}`).join(','));
    }
    assertAnatomy(body, 1, legs);
  }
  assert.equal(groups.size, 2);
});

test('all eight leg chains stay separate during turns, reversal, resize, and different frame rates', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) for (const size of [0.85, 1, 1.6]) {
    const body = { x: 100, y: 100, angle: 0 };
    const legs = createLegs(body, size);
    let group = 0;
    for (let frame = 0; frame < 900; frame++) {
      body.angle += dt * 2.4;
      if (frame === 450) body.angle += Math.PI;
      body.x += Math.cos(body.angle) * dt * 63;
      body.y += Math.sin(body.angle) * dt * 63;
      const scale = frame > 600 ? size * 0.8 : size;
      group = advanceLegs(legs, body, scale, dt, group);
      assertAnatomy(body, scale, legs);
    }
  }
});
