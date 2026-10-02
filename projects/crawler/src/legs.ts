// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type { Point } from './types';

export interface BodyPose extends Point { angle: number; }
export interface Leg {
  foot: Point;
  from: Point;
  to: Point;
  progress: number;
  side: -1 | 1;
  row: number;
  strained: boolean;
}
interface LegLayout { hip: Point; knee: Point; foot: Point; minAngle: number; maxAngle: number; }

const radians = (degrees: number) => degrees * Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Four distinct fans on EACH side, all attached to the cephalothorax.
// Hip, knee and foot share a convex sector, so adjacent legs cannot cross.
const LAYOUT: readonly LegLayout[] = [
  { hip: { x: 13, y: 7 }, knee: { x: 43, y: 39 }, foot: { x: 72, y: 38 }, minAngle: radians(8), maxAngle: radians(48) },
  { hip: { x: 6, y: 10 }, knee: { x: 28, y: 52 }, foot: { x: 22, y: 88 }, minAngle: radians(52), maxAngle: radians(88) },
  { hip: { x: -2, y: 10 }, knee: { x: -28, y: 52 }, foot: { x: -24, y: 88 }, minAngle: radians(94), maxAngle: radians(133) },
  { hip: { x: -9, y: 7 }, knee: { x: -50, y: 38 }, foot: { x: -77, y: 39 }, minAngle: radians(138), maxAngle: radians(174) },
];

function worldPoint(body: BodyPose, scale: number, side: number, point: Point): Point {
  const c = Math.cos(body.angle), s = Math.sin(body.angle);
  return { x: body.x + (c * point.x - s * point.y * side) * scale, y: body.y + (s * point.x + c * point.y * side) * scale };
}

function localPoint(body: BodyPose, scale: number, side: number, point: Point): Point {
  const c = Math.cos(body.angle), s = Math.sin(body.angle);
  const dx = (point.x - body.x) / scale, dy = (point.y - body.y) / scale;
  return { x: c * dx + s * dy, y: (-s * dx + c * dy) * side };
}

function inSector(point: Point, layout: LegLayout, minRadius: number, maxRadius: number): Point {
  const angle = clamp(Math.atan2(point.y, point.x), layout.minAngle, layout.maxAngle);
  const radius = clamp(Math.hypot(point.x, point.y), minRadius, maxRadius);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function restFoot(body: BodyPose, scale: number, side: -1 | 1, row: number, lead = 0): Point {
  const rest = LAYOUT[row]!.foot;
  return worldPoint(body, scale, side, { x: rest.x + lead, y: rest.y });
}

function constrainFoot(body: BodyPose, scale: number, leg: Leg, point: Point): Point {
  const layout = LAYOUT[leg.row]!;
  const radius = Math.hypot(layout.foot.x, layout.foot.y);
  return worldPoint(body, scale, leg.side, inSector(localPoint(body, scale, leg.side, point), layout, radius * 0.8, radius * 1.18));
}

export function createLegs(body: BodyPose, scale: number): Leg[] {
  const legs: Leg[] = [];
  for (const side of [-1, 1] as const) for (let row = 0; row < 4; row++) {
    const foot = restFoot(body, scale, side, row);
    legs.push({ foot, from: { ...foot }, to: { ...foot }, progress: 1, side, row, strained: false });
  }
  return legs;
}

export function legJoints(body: BodyPose, scale: number, leg: Leg): { hip: Point; knee: Point; foot: Point } {
  const layout = LAYOUT[leg.row]!;
  const foot = constrainFoot(body, scale, leg, leg.foot);
  const localFoot = localPoint(body, scale, leg.side, foot);
  const dx = localFoot.x - layout.hip.x, dy = localFoot.y - layout.hip.y;
  const d = Math.max(0.001, Math.hypot(dx, dy));
  const upper = distance(layout.hip, layout.knee), lower = distance(layout.knee, layout.foot);
  const reach = Math.max(1, d / ((upper + lower) * 0.999));
  const a = (upper ** 2 * reach ** 2 - lower ** 2 * reach ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, (upper * reach) ** 2 - a ** 2));
  const middle = { x: layout.hip.x + dx / d * a, y: layout.hip.y + dy / d * a };
  const first = { x: middle.x - dy / d * h, y: middle.y + dx / d * h };
  const second = { x: middle.x + dy / d * h, y: middle.y - dx / d * h };
  // A pair-specific pole selects the anatomical IK branch. A shared bend sign
  // would fold the rear knees through the body's opposite side.
  const candidate = distance(first, layout.knee) < distance(second, layout.knee) ? first : second;
  const knee = inSector(candidate, layout, Math.hypot(layout.hip.x, layout.hip.y) + 12, Math.hypot(localFoot.x, localFoot.y) * 0.94);
  return { hip: worldPoint(body, scale, leg.side, layout.hip), knee: worldPoint(body, scale, leg.side, knee), foot };
}

const groupOf = (leg: Leg) => (leg.row + (leg.side > 0 ? 1 : 0)) % 2;

export function advanceLegs(legs: Leg[], body: BodyPose, scale: number, elapsed: number, nextGroup: number): number {
  if (elapsed <= 0) return nextGroup;
  for (const leg of legs) {
    if (leg.progress < 1) {
      leg.progress = Math.min(1, leg.progress + elapsed / 0.23);
      const t = leg.progress, eased = t * t * (3 - 2 * t);
      leg.foot = { x: leg.from.x + (leg.to.x - leg.from.x) * eased, y: leg.from.y + (leg.to.y - leg.from.y) * eased };
    }
    const bounded = constrainFoot(body, scale, leg, leg.foot);
    leg.strained = distance(bounded, leg.foot) > 0.01 * scale;
    // A sharp turn must not drag a planted foot across another leg's fan.
    // Ordinary stance remains fixed; only the anatomical boundary clips reach.
    if (leg.strained) leg.foot = bounded;
  }
  if (legs.some(leg => leg.progress < 1)) return nextGroup;
  const needsStep = (leg: Leg) => leg.strained || distance(leg.foot, restFoot(body, scale, leg.side, leg.row)) > 10 * scale;
  let group = nextGroup;
  if (!legs.some(leg => groupOf(leg) === group && needsStep(leg))) group = 1 - group;
  if (!legs.some(leg => groupOf(leg) === group && needsStep(leg))) return nextGroup;
  // Two legs on each side swing together; the complementary four support the body.
  for (const leg of legs) if (groupOf(leg) === group) {
    leg.from = { ...leg.foot };
    leg.to = constrainFoot(body, scale, leg, restFoot(body, scale, leg.side, leg.row, 7));
    leg.progress = 0;
  }
  return 1 - group;
}
