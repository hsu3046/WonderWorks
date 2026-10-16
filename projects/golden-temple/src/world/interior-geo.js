// ---------------------------------------------------------------------------
// Procedural geometry helpers for the interior (petals, flames, mouldings...)
// All return THREE.BufferGeometry in a local frame.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Lotus petal: closed shell. Base at origin, length along +Y, outer face toward +Z.
// cup  : edges curl toward -Z (concave inside)  bend: centreline bends toward +Z at the tip
// tip  : tip flick toward +Z (positive) or -Z
export function petalGeo({ len = 1, width = 0.45, thick = 0.04, cup = 0.12, bend = 0.1, tip = 0.05, ridge = 0.012, segU = 14, segV = 10, base = 0.32, pointy = 0.75, wpow = 0.75 } = {}) {
  const g = new THREE.SphereGeometry(1, segV * 2, segU);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.y + 1) * 0.5; // 0 base .. 1 tip
    const wprof = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(t, pointy)), 0), wpow) * (1 - base) + base * (1 - t);
    const w = width * 0.5 * wprof;
    const th = thick * (1 - 0.65 * t) * 0.5;
    const r = Math.sqrt(v.x * v.x + v.z * v.z) || 1e-6;
    const sx = v.x / Math.max(r, 1e-6) * Math.min(r * 1.0, 1);
    let x = v.x * w;
    let z = v.z * th;
    const xn = x / (width * 0.5);
    z -= cup * width * 0.5 * xn * xn * Math.sin(Math.PI * Math.min(t * 1.1, 1));
    z += bend * len * t * t + tip * len * Math.pow(t, 6);
    if (v.z > 0) z += ridge * Math.exp(-xn * xn * 30) * Math.sin(Math.PI * t);
    p.setXYZ(i, x, t * len, z);
    void sx;
  }
  g.computeVertexNormals();
  return g;
}

// Flame tongue: flat bevelled extrusion, base at origin, pointing +Y, curling tip.
export function flameShape(h = 1, w = 0.35, curl = 0.25) {
  const s = new THREE.Shape();
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; // up the right side
    const x = w * 0.5 * Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * t)), 0.8) * (1 - t) + curl * w * Math.pow(t, 2.5);
    pts.push([x + curl * w * 0.4 * Math.sin(t * Math.PI * 2.2) * t, t * h]);
  }
  const left = [];
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const x = -w * 0.5 * Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * t)), 0.8) * (1 - t) + curl * w * Math.pow(t, 2.5);
    left.push([x + curl * w * 0.4 * Math.sin(t * Math.PI * 2.2) * t * 0.6, t * h]);
  }
  s.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts.slice(1)) s.lineTo(q[0], q[1]);
  for (const q of left) s.lineTo(q[0], q[1]);
  s.closePath();
  return s;
}

export function extrude(shape, depth, bevel = 0.01, curveSegments = 12, bevelSegments = 2) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments, curveSegments });
  g.translate(0, 0, -depth * 0.5);
  return g;
}

// Pointed leaf / petal outline (for flat openwork fans)
export function leafShape(h = 1, w = 0.3, pointy = 0.7) {
  const s = new THREE.Shape();
  const N = 20;
  s.moveTo(0, 0);
  for (let i = 1; i <= N; i++) { const t = i / N; s.lineTo(w * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, pointy)), 0.85), t * h); }
  for (let i = N - 1; i >= 1; i--) { const t = i / N; s.lineTo(-w * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, pointy)), 0.85), t * h); }
  s.closePath();
  return s;
}

// Lathe from [[r,y]...] with optional polygonal (octagonal) section
export function latheGeo(profile, seg = 48, phase = 0) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, phase);
  return g;
}

// Moulding ring: rectangle-ish profile swept around a circle/polygon (lathe of a small profile)
export function ringGeo(R, r, y = 0, seg = 64, radial = 8) {
  const g = new THREE.TorusGeometry(R, r, radial, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// Box with bevel, centred
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function rbox(w, h, d, bevel = 0.01, seg = 2) {
  const mn = Math.min(w, h, d);
  if (bevel <= 0.0045 || mn < 0.02) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, mn < 0.06 ? 1 : seg, Math.min(bevel, mn * 0.45));
}

// Chain of beads/links along a path (returns matrices)
export function beadMatrices(points, spacing, scale = 1) {
  const out = [];
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const L = c.getLength();
  const n = Math.max(2, Math.floor(L / spacing));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = c.getPointAt(u);
    const t = c.getTangentAt(u);
    const q = new THREE.Quaternion().setFromUnitVectors(up, t);
    out.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(scale, scale, scale)));
  }
  return out;
}

export function merge(list) {
  const gs = list.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    return x;
  });
  return mergeGeometries(gs, false);
}
