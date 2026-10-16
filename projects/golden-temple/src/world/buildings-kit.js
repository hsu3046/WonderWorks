// ---------------------------------------------------------------------------
// Japanese temple carpentry kit (procedural): primitives, tiled hongawara roof
// generator, profile sweeps, eaves (two-tier rafters), bracket sets (kumimono),
// railings with giboshi, gold fittings. Used by buildings.js.
// All functions work in a building-LOCAL frame: x along the facade, z depth
// (+z = front), y up. A LocalBuilder (LB) maps local -> world.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export function hash3(a, b, c) { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return h - Math.floor(h); }

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
export function m4(pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ'));
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(new THREE.Vector3(pos[0], pos[1], pos[2]), _q.clone(), s);
}
// matrix whose local +X runs from a to b (centered between), local +Y ~ upHint
export function beamM(a, b, upHint = [0, 1, 0]) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const x = B.clone().sub(A); const len = x.length(); x.normalize();
  let up = new THREE.Vector3(...upHint);
  if (Math.abs(up.dot(x)) > 0.98) up = new THREE.Vector3(0, 0, 1);
  const z = new THREE.Vector3().crossVectors(x, up).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(A.clone().add(B).multiplyScalar(0.5));
  return { m, len, x, y, z };
}

// ---------------------------------------------------------------------------
// Local builder: wraps geom.Builder with a base matrix.
// ---------------------------------------------------------------------------
export class LB {
  constructor(builder, base = new THREE.Matrix4(), ix = null) { this.b = builder; this.base = base.clone(); this.ix = ix; }
  add(geo, mat, m = null) { this.b.add(geo, mat, m ? this.base.clone().multiply(m) : this.base); return this; }
  box(mat, w, h, d, pos, rot = [0, 0, 0], c = 0) { return this.add(chamferBox(w, h, d, c), mat, m4(pos, rot)); }
  beam(mat, a, b, w, h, c = 0.01, upHint = [0, 1, 0]) {
    const { m, len } = beamM(a, b, upHint);
    return this.add(chamferBox(len, h, w, c), mat, m);
  }
  cyl(mat, rt, rb, h, pos, rot = [0, 0, 0], seg = 24) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1), mat, m4(pos, rot)); }
  child(m) { return new LB(this.b, this.base.clone().multiply(m), this.ix); }
  // indexed geometry collector (big roof grids keep their index + colors)
  addIx(geo, mat) {
    const g = geo.clone(); g.applyMatrix4(this.base);
    // fix normals after mirror transforms
    if (this.base.determinant() < 0) flipIndex(g);
    const k = mat.uuid;
    if (!this.ix.has(k)) this.ix.set(k, { mat, geos: [] });
    this.ix.get(k).geos.push(g);
    return this;
  }
}
function flipIndex(g) {
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
}
export function buildIx(ix, group, { castShadow = true, receiveShadow = true } = {}) {
  for (const { mat, geos } of ix.values()) {
    const keys = Object.keys(geos[0].attributes);
    const gs = geos.map((g) => { for (const k of Object.keys(g.attributes)) if (!keys.includes(k)) g.deleteAttribute(k); return g; });
    const merged = mergeGeometries(gs, false);
    if (!merged) { console.warn('[buildings] ix merge failed'); continue; }
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
    group.add(mesh);
  }
}

// ---------------------------------------------------------------------------
// Chamfered box (all 12 edges bevelled), 44 triangles, flat normals.
// ---------------------------------------------------------------------------
const _cache = new Map();
function cached(key, fn) { let g = _cache.get(key); if (!g) { g = fn(); _cache.set(key, g); } return g; }
export const ni = (g) => (g.index ? g.toNonIndexed() : g);

function polyGeo(tris) {
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tris.length * 2), 2));
  return g;
}
function convexTris(faces, center = [0, 0, 0]) {
  const out = [];
  const tri = (a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const cen = [(a[0] + b[0] + c[0]) / 3 - center[0], (a[1] + b[1] + c[1]) / 3 - center[1], (a[2] + b[2] + c[2]) / 3 - center[2]];
    if (n[0] * cen[0] + n[1] * cen[1] + n[2] * cen[2] < 0) out.push(a, c, b); else out.push(a, b, c);
  };
  for (const f of faces) for (let i = 1; i < f.length - 1; i++) tri(f[0], f[i], f[i + 1]);
  return out;
}
export function chamferBox(w, h, d, c = 0) {
  const key = `cb${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)},${c.toFixed(4)}`;
  return cached(key, () => {
    if (c <= 0) return new THREE.BoxGeometry(w, h, d);
    const cc = Math.min(c, w * 0.45, h * 0.45, d * 0.45);
    const X = w / 2, Y = h / 2, Z = d / 2;
    const P = (sx, sy, sz, f) => (f === 0 ? [sx * X, sy * (Y - cc), sz * (Z - cc)] : f === 1 ? [sx * (X - cc), sy * Y, sz * (Z - cc)] : [sx * (X - cc), sy * (Y - cc), sz * Z]);
    const S = [-1, 1], F = [];
    for (const s of S) {
      F.push([P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0)]);
      F.push([P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1)]);
      F.push([P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2)]);
    }
    for (const a of S) for (const b of S) {
      F.push([P(-1, a, b, 1), P(1, a, b, 1), P(1, a, b, 2), P(-1, a, b, 2)]);
      F.push([P(a, -1, b, 0), P(a, 1, b, 0), P(a, 1, b, 2), P(a, -1, b, 2)]);
      F.push([P(a, b, -1, 0), P(a, b, 1, 0), P(a, b, 1, 1), P(a, b, -1, 1)]);
    }
    for (const a of S) for (const b of S) for (const e of S) F.push([P(a, b, e, 0), P(a, b, e, 1), P(a, b, e, 2)]);
    return polyGeo(convexTris(F));
  });
}
// tapered block (frustum): top w1 x d1, bottom w0 x d0, height h, origin at bottom center
export function taper(w0, d0, w1, d1, h) {
  return cached(`tp${w0},${d0},${w1},${d1},${h}`, () => {
    const b = [[-w0 / 2, 0, -d0 / 2], [w0 / 2, 0, -d0 / 2], [w0 / 2, 0, d0 / 2], [-w0 / 2, 0, d0 / 2]];
    const t = [[-w1 / 2, h, -d1 / 2], [w1 / 2, h, -d1 / 2], [w1 / 2, h, d1 / 2], [-w1 / 2, h, d1 / 2]];
    const F = [b, t];
    for (let i = 0; i < 4; i++) F.push([b[i], b[(i + 1) % 4], t[(i + 1) % 4], t[i]]);
    return polyGeo(convexTris(F, [0, h / 2, 0]));
  });
}
// bearing block (to): chamfered top part + tapered "sara" bottom. origin at bottom center
export function block(w, h, d) {
  return cached(`bk${w},${h},${d}`, () => {
    const hb = h * 0.38;
    const top = chamferBox(w, h - hb, d, 0.012).clone().translate(0, hb + (h - hb) / 2, 0);
    const bot = taper(w * 0.76, d * 0.76, w, d, hb);
    return mergeGeometries([ni(top), ni(bot)]);
  });
}
// extruded 2D shape, centered on the extrusion depth (z)
export function extrude(shapePts, depth, bevel = 0.006, key = null, curveSegments = 6) {
  const build = () => {
    const s = shapePts instanceof THREE.Shape ? shapePts : new THREE.Shape(shapePts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments });
    g.translate(0, 0, -(depth - 2 * bevel) / 2);
    g.computeVertexNormals();
    return g;
  };
  return key ? cached('ex' + key, build) : build();
}
export function lathe(profile, seg = 24, key = null) {
  const build = () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  return key ? cached('la' + key + seg, build) : build();
}

// bracket arm (hijiki) along local x, length L, height H, width W; origin at bottom center
export function armGeo(L, H, W, lo = false) {
  return cached(`arm${L},${H},${W},${lo}`, () => {
    const s = new THREE.Shape();
    const k = Math.min(H * 0.95, L * 0.22);
    s.moveTo(-L / 2, H); s.lineTo(L / 2, H); s.lineTo(L / 2, H * 0.5);
    s.quadraticCurveTo(L / 2 - k * 0.15, H * 0.02, L / 2 - k, 0);
    s.lineTo(-L / 2 + k, 0);
    s.quadraticCurveTo(-L / 2 + k * 0.15, H * 0.02, -L / 2, H * 0.5);
    s.lineTo(-L / 2, H);
    return extrude(s, W, lo ? 0 : Math.min(0.008, W * 0.08), null, lo ? 2 : 4);
  });
}

// kibana: carved projecting beam end (scroll profile) along +x from x=0, height H, width W; origin bottom at x=0
export function kibanaGeo(L, H, W) {
  return cached(`kib${L},${H},${W}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(L * 0.45, 0);
    s.bezierCurveTo(L * 0.62, -H * 0.02, L * 0.7, H * 0.22, L * 0.62, H * 0.3);
    s.bezierCurveTo(L * 0.72, H * 0.24, L * 1.0, H * 0.28, L * 0.98, H * 0.62);
    s.bezierCurveTo(L * 0.97, H * 0.86, L * 0.86, H * 1.0, L * 0.7, H);
    s.lineTo(0, H); s.lineTo(0, 0);
    return extrude(s, W, Math.min(0.01, W * 0.08), null, 6);
  });
}
// gold scroll plate for the kibana side (spiral lines approximated by a ring + tail)
export function scrollPlate(R) {
  return cached(`scr${R}`, () => {
    const parts = [];
    parts.push(ni(new THREE.TorusGeometry(R, R * 0.14, 4, 18, Math.PI * 1.6)));
    parts.push(ni(new THREE.TorusGeometry(R * 0.55, R * 0.12, 4, 14, Math.PI * 1.4).rotateZ(1.2)));
    parts.push(ni(new THREE.SphereGeometry(R * 0.22, 8, 5)));
    return mergeGeometries(parts);
  });
}

// rosette (kugikakushi / rokuyo): flower plate facing +z, radius R; origin at back center
export function rosette(R, petals = 6, thick = 0.012, lo = false) {
  if (lo) {
    return cached(`rosl${R},${thick}`, () => {
      const d = new THREE.CylinderGeometry(R * 0.85, R, thick, 8, 1).rotateX(Math.PI / 2).translate(0, 0, thick / 2);
      const b = new THREE.ConeGeometry(R * 0.35, R * 0.3, 6, 1).rotateX(Math.PI / 2).translate(0, 0, thick + R * 0.15);
      return mergeGeometries([ni(d), ni(b)]);
    });
  }
  return cached(`ros${R},${petals},${thick}`, () => {
    const s = new THREE.Shape();
    const N = petals * 6;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = R * (0.7 + 0.3 * Math.pow(Math.abs(Math.cos((petals * a) / 2)), 0.6));
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    const plate = extrude(s, thick, thick * 0.35, null, 2).translate(0, 0, thick / 2);
    const boss = new THREE.SphereGeometry(R * 0.32, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, thick * 0.9);
    const ring = new THREE.TorusGeometry(R * 0.5, R * 0.06, 4, 16).translate(0, 0, thick);
    return mergeGeometries([ni(plate), ni(boss), ni(ring)]);
  });
}

// giboshi (onion finial) on railing posts. base radius ~ r, origin at bottom
export function giboshi(r = 0.075, seg = 40) {
  const P = [
    [r * 1.02, 0], [r * 1.06, 0.006], [r * 1.06, 0.03], [r * 0.98, 0.036], [r * 0.82, 0.042], [r * 0.78, 0.058],
    [r * 0.94, 0.064], [r * 0.98, 0.074], [r * 0.94, 0.084], [r * 0.74, 0.09], [r * 0.7, 0.104], [r * 0.88, 0.122],
    [r * 1.08, 0.148], [r * 1.17, 0.175], [r * 1.16, 0.2], [r * 1.05, 0.228], [r * 0.82, 0.255], [r * 0.55, 0.28],
    [r * 0.32, 0.3], [r * 0.16, 0.318], [r * 0.1, 0.33], [r * 0.16, 0.338], [r * 0.15, 0.35], [r * 0.08, 0.362], [0, 0.372],
  ].map(([a, y]) => [a, y * (r / 0.075)]);
  return lathe(P, seg, 'gib' + r);
}

// gold band wrapping a round column (nemaki / kanagu), radius r, height h, origin at bottom
export function colBand(r, h, seg = 32, studs = 0, lo = false) {
  if (lo) return cached(`bandl${r},${h},${seg}`, () => lathe([[r, 0], [r + 0.012, 0], [r + 0.016, h * 0.5], [r + 0.012, h], [r, h]], seg));
  return cached(`band${r},${h},${seg},${studs}`, () => {
    const t = 0.012;
    const P = [[r, 0], [r + t, 0], [r + t * 1.6, h * 0.08], [r + t, h * 0.16], [r + t * 0.6, h * 0.18], [r + t * 0.6, h * 0.82],
      [r + t, h * 0.84], [r + t * 1.6, h * 0.92], [r + t, h], [r, h]];
    const parts = [ni(lathe(P, seg))];
    for (let i = 0; i < studs; i++) {
      const a = (i / studs) * Math.PI * 2;
      const st = new THREE.SphereGeometry(Math.min(0.018, h * 0.13), 6, 3).scale(1, 1, 0.7);
      st.translate(0, 0, r + t * 0.6).rotateY(a).translate(0, h * 0.5, 0);
      parts.push(ni(st));
    }
    return mergeGeometries(parts);
  });
}

// ornate gold column band (kazari-kanagu) for gate pillars: beads, recessed field,
// two rows of studs and vertical leaf plates. origin at bottom.
export function ornBand(r, h, seg = 40) {
  return cached(`orn${r},${h},${seg}`, () => {
    const t = 0.016;
    const P = [[r, 0], [r + t * 1.2, 0], [r + t * 2.0, h * 0.04], [r + t * 1.2, h * 0.08], [r + t * 0.9, h * 0.09],
      [r + t * 0.9, h * 0.2], [r + t * 1.5, h * 0.22], [r + t * 0.7, h * 0.24], [r + t * 0.7, h * 0.76], [r + t * 1.5, h * 0.78],
      [r + t * 0.9, h * 0.8], [r + t * 0.9, h * 0.91], [r + t * 1.2, h * 0.92], [r + t * 2.0, h * 0.96], [r + t * 1.2, h], [r, h]];
    const parts = [ni(lathe(P, seg))];
    const ns = Math.round((2 * Math.PI * r) / 0.085);
    for (const yy of [h * 0.145, h * 0.855]) for (let i = 0; i < ns; i++) {
      const a = ((i + (yy > h / 2 ? 0.5 : 0)) / ns) * Math.PI * 2;
      const st = new THREE.SphereGeometry(0.014, 5, 3).scale(1, 1, 0.75);
      st.translate(0, 0, r + t * 0.9).rotateY(a).translate(0, yy, 0);
      parts.push(ni(st));
    }
    // leaf plates (shippo-like lobed plates) in the recessed field
    const nl = 8;
    const leaf = new THREE.Shape();
    const lh = h * 0.46, lw = Math.min(0.13, (2 * Math.PI * r) / nl * 0.6);
    leaf.moveTo(0, -lh / 2);
    leaf.bezierCurveTo(lw * 0.7, -lh * 0.3, lw * 0.6, lh * 0.1, 0, lh / 2);
    leaf.bezierCurveTo(-lw * 0.6, lh * 0.1, -lw * 0.7, -lh * 0.3, 0, -lh / 2);
    const lg = new THREE.ExtrudeGeometry(leaf, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 3 });
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * Math.PI * 2;
      const g = lg.clone().translate(0, 0, r + t * 0.7).rotateY(a).translate(0, h * 0.5, 0);
      parts.push(ni(g));
      const b = new THREE.SphereGeometry(0.02, 6, 4).scale(1, 1, 0.8).translate(0, 0, r + t * 0.7 + 0.012).rotateY(a + Math.PI / nl).translate(0, h * 0.5, 0);
      parts.push(ni(b));
    }
    return mergeGeometries(parts);
  });
}

// ---------------------------------------------------------------------------
// Sweep a 2D profile along a 3D polyline. Profile points [s, y]: s = horizontal
// offset perpendicular to the path (in plan), y = vertical offset (gravity aligned).
// smooth: share normals across profile vertices (round sections).
// outward: if the path is a loop, +s points away from the loop centroid.
// ---------------------------------------------------------------------------
export function sweep(path, profile, { closed = false, smooth = false, caps = true, outward = false, miter = true, inside = null } = {}) {
  const n = path.length;
  const P = path.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
  const sides = [], scales = [];
  let cx = 0, cz = 0; P.forEach((p) => { cx += p.x; cz += p.z; }); cx /= n; cz /= n;
  for (let i = 0; i < n; i++) {
    const prev = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)];
    const next = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)];
    const d0 = new THREE.Vector2(P[i].x - prev.x, P[i].z - prev.z);
    const d1 = new THREE.Vector2(next.x - P[i].x, next.z - P[i].z);
    if (d0.lengthSq() < 1e-12) d0.copy(d1); if (d1.lengthSq() < 1e-12) d1.copy(d0);
    d0.normalize(); d1.normalize();
    const t = d0.clone().add(d1); if (t.lengthSq() < 1e-8) t.copy(d1); t.normalize();
    // s = t x up (plan): (tx,tz) -> (-tz, tx)
    let s = new THREE.Vector2(-t.y, t.x);
    let sc = 1;
    if (miter) { const c = d0.dot(t); sc = c > 0.2 ? 1 / c : 5; }
    sides.push(s); scales.push(sc);
  }
  if (outward || inside) {
    const ic = inside || [cx, cz];
    const s0 = sides[0]; const v = new THREE.Vector2(P[0].x - ic[0], P[0].z - ic[1]);
    if (s0.dot(v) < 0) sides.forEach((s) => s.multiplyScalar(-1));
  }
  // profile orientation (shoelace)
  let area = 0;
  for (let j = 0; j < profile.length; j++) { const a = profile[j], b = profile[(j + 1) % profile.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const pos = [], idx = [];
  const ring = (i, q) => { const s = sides[i], sc = scales[i]; return [P[i].x + s.x * q[0] * sc, P[i].y + q[1], P[i].z + s.y * q[0] * sc]; };
  const np = profile.length;
  const segs = closed ? n : n - 1;
  const sgnSide = (() => { // check handedness of the (s, up, t) frame relative to default
    const i = 0; const next = P[Math.min(n - 1, 1)]; const t = new THREE.Vector2(next.x - P[0].x, next.z - P[0].z).normalize();
    const sDef = new THREE.Vector2(-t.y, t.x); return Math.sign(sDef.dot(sides[0])) || 1;
  })();
  const flip = (area > 0 ? 1 : -1) * sgnSide > 0;
  const T = (a, b, c) => (flip ? idx.push(a, c, b) : idx.push(a, b, c));
  if (smooth) {
    for (let i = 0; i < n; i++) for (let j = 0; j < np; j++) pos.push(...ring(i, profile[j]));
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % n;
      for (let j = 0; j < np; j++) {
        const j1 = (j + 1) % np;
        const a = i * np + j, b = i * np + j1, c = i1 * np + j1, d = i1 * np + j;
        T(a, b, c); T(a, c, d);
      }
    }
  } else {
    for (let j = 0; j < np; j++) {
      const q0 = profile[j], q1 = profile[(j + 1) % np];
      const base = pos.length / 3;
      for (let i = 0; i < n; i++) { pos.push(...ring(i, q0)); pos.push(...ring(i, q1)); }
      for (let i = 0; i < segs; i++) {
        const i1 = (i + 1) % n;
        const a = base + i * 2, b = base + i * 2 + 1, c = base + i1 * 2 + 1, d = base + i1 * 2;
        T(a, b, c); T(a, c, d);
      }
    }
  }
  if (caps && !closed && n > 1) {
    const contour = profile.map(([x, y]) => new THREE.Vector2(x, y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const end of [0, n - 1]) {
      const base = pos.length / 3;
      const ref = end === 0 ? P[0].clone().sub(P[1]) : P[n - 1].clone().sub(P[n - 2]);
      for (const q of profile) pos.push(...ring(end, q));
      for (const t of tris) {
        const a = new THREE.Vector3().fromArray(pos, (base + t[0]) * 3), b = new THREE.Vector3().fromArray(pos, (base + t[1]) * 3), c = new THREE.Vector3().fromArray(pos, (base + t[2]) * 3);
        const nn = b.sub(a).cross(c.sub(a));
        if (nn.dot(ref) >= 0) idx.push(base + t[0], base + t[1], base + t[2]); else idx.push(base + t[0], base + t[2], base + t[1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function rectProfile(w, h, y0 = 0) { return [[-w / 2, y0], [w / 2, y0], [w / 2, y0 + h], [-w / 2, y0 + h]]; }
export function roundProfile(r, y0 = 0, seg = 10) {
  const out = [];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI; out.push([Math.cos(a) * r, y0 + Math.sin(a) * r]); }
  out.push([-r, y0 - r * 0.25]); out.push([r, y0 - r * 0.25]);
  return out;
}

// ---------------------------------------------------------------------------
// Tiled roof (hongawara) generator.
// faces: { O:[x,z], a:[x,z] (along eave), n:[x,z] (inward), u0, u1, dmin(u), dmax(u),
//          y0, prof(d), lip }  -> plan point P = O + a u + n d ; y = y0 + prof(d) + lift(P)
// T: tile params or null (smooth surface, e.g. soffits).
// Returns { geo (indexed, position/normal/color), caps: [{pos:[x,y,z], out:[x,z], up:[...]}] }
// ---------------------------------------------------------------------------
export function tileParams(o = {}) {
  const T = Object.assign({ p: 0.27, phase: 0, rw: 0.13, rh: 0.058, pd: 0.018, c: 0.26, thR: 0.022, thP: 0.013, neck: 0.008, lip: 0.06, eps: 0.007, detail: 2 }, o);
  const rr = T.rw / 2 / T.p;
  const panMid = rr + 0.4 * (0.5 - rr);
  T.phis = T.detail >= 2
    ? [-0.5, -panMid, -rr, -0.8 * rr, -0.45 * rr, 0, 0.45 * rr, 0.8 * rr, rr, panMid]
    : T.detail === 1 ? [-0.5, -rr, -0.6 * rr, 0, 0.6 * rr, rr] : [-0.5, -rr, 0, rr];
  T.rows = T.detail >= 2 ? [-T.eps, T.eps, T.c * 0.42, T.c * 0.82] : [-T.eps, T.eps];
  return T;
}
function tileH(u, d, T) {
  const phi = (u - T.phase) / T.p;
  const k = Math.round(phi); const f = phi - k;
  const x = Math.abs(f) * T.p;
  const cp = d / T.c; const ck = Math.floor(cp + 1e-6); const cf = cp - ck;
  const rr = T.rw / 2;
  let h, ao, round;
  if (x <= rr + 1e-6) {
    round = true;
    const s = Math.min(1, x / rr);
    const crest = Math.sqrt(Math.max(0, 1 - s * s));
    h = T.rh * crest + T.thR * (1 - cf) - T.neck * sstep(0.7, 1.0, cf) * crest;
    ao = 0.78 + 0.22 * crest;
  } else {
    round = false;
    const s = (x - rr) / (0.5 * T.p - rr);
    h = -T.pd * (1 - (1 - s) * (1 - s)) + T.thP * (1 - cf);
    ao = 0.5 + 0.5 * Math.min(1, s * 1.8);
  }
  if (cf > 0.8) ao *= 1 - 0.4 * (cf - 0.8) / 0.2;
  if (cf < 0.05) ao *= 0.92;
  const r = hash3(k, ck, round ? 1 : 2);
  let v = 0.86 + 0.24 * r;
  if (r > 0.965) v *= 1.18; else if (r < 0.03) v *= 0.8;
  const tint = hash3(k * 3.1, ck * 1.7, 5);
  return { h, c: [ao * v * (0.97 + 0.05 * tint), ao * v, ao * v * (1.02 - 0.04 * tint)] };
}
function zipper(A, B, idx, s) {
  let i = 0, j = 0;
  const T = s > 0 ? (a, b, c) => idx.push(a, b, c) : (a, b, c) => idx.push(a, c, b);
  while (i < A.length - 1 || j < B.length - 1) {
    if (j >= B.length - 1 || (i < A.length - 1 && A[i + 1].d <= B[j + 1].d)) { T(A[i].i, B[j].i, A[i + 1].i); i++; }
    else { T(A[i].i, B[j].i, B[j + 1].i); j++; }
  }
}
export function roofSurface(faces, T, lift = () => 0, opt = {}) {
  const pos = [], col = [], idx = [];
  const caps = [];
  const du = opt.du || 0.3, dd = opt.dd || 0.3;
  let vi = 0;
  const push = (p, c) => { pos.push(p[0], p[1], p[2]); col.push(c[0], c[1], c[2]); return vi++; };
  for (const F of faces) {
    const sgn = Math.sign(F.a[1] * F.n[0] - F.a[0] * F.n[1]) * (opt.flip ? -1 : 1);
    const nsg = Math.sign(F.a[1] * F.n[0] - F.a[0] * F.n[1]);
    const base = (u, d) => {
      const x = F.O[0] + F.a[0] * u + F.n[0] * d, z = F.O[1] + F.a[1] * u + F.n[1] * d;
      return [x, F.y0 + F.prof(d) + lift(x, z) + (opt.yOff || 0), z];
    };
    const normalAt = (u, d) => {
      const e = 0.01;
      const a1 = base(u + e, d), a0 = base(u - e, d), b1 = base(u, d + e), b0 = base(u, d - e);
      const A = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], B = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
      let n = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
      const l = Math.hypot(n[0], n[1], n[2]) * nsg; return [n[0] / l, n[1] / l, n[2] / l];
    };
    const us = new Set();
    if (T) {
      const k0 = Math.floor((F.u0 - T.phase) / T.p) - 1, k1 = Math.ceil((F.u1 - T.phase) / T.p) + 1;
      for (let k = k0; k <= k1; k++) for (const f of T.phis) { const u = T.phase + (k + f) * T.p; if (u > F.u0 + 2e-3 && u < F.u1 - 2e-3) us.add(Math.round(u * 1e5) / 1e5); }
    } else {
      const m = Math.max(1, Math.ceil((F.u1 - F.u0) / du));
      for (let i = 1; i < m; i++) us.add(F.u0 + ((F.u1 - F.u0) * i) / m);
    }
    us.add(F.u0); us.add(F.u1);
    (F.uExtra || []).forEach((u) => { if (u > F.u0 && u < F.u1) us.add(u); });
    const ulist = [...us].sort((a, b) => a - b);
    let prev = null, prevLip = null;
    for (const u of ulist) {
      const dmin = F.dmin ? F.dmin(u) : 0, dmax = F.dmax(u);
      if (!(dmax > dmin + 1e-3)) { prev = null; prevLip = null; continue; }
      const ds = [dmin];
      if (T) {
        const k0 = Math.floor(dmin / T.c) - 1, k1 = Math.ceil(dmax / T.c) + 1;
        for (let k = k0; k <= k1; k++) for (const o of T.rows) { const d = k * T.c + o; if (d > dmin + 2e-3 && d < dmax - 2e-3) ds.push(d); }
      } else {
        const m = Math.max(1, Math.ceil((dmax - dmin) / dd));
        for (let i = 1; i < m; i++) ds.push(dmin + ((dmax - dmin) * i) / m);
      }
      ds.push(dmax); ds.sort((a, b) => a - b);
      const column = [];
      for (const d of ds) {
        const B = base(u, d);
        let p = B, c = opt.color || [1, 1, 1];
        if (T) {
          const n = normalAt(u, d); const t = tileH(u, d, T);
          p = [B[0] + n[0] * t.h, B[1] + n[1] * t.h, B[2] + n[2] * t.h]; c = t.c;
        }
        column.push({ d, i: push(p, c), p });
      }
      if (prev) zipper(prev, column, idx, sgn);
      prev = column;
      if (T && F.lip && dmin < 1e-6) {
        const top = column[0].p;
        const B = base(u, 0);
        const bot = [B[0], B[1] - T.lip - T.pd, B[2]];
        const t = tileH(u, 0, T);
        const cc = t.c.map((v) => v * 0.8);
        const lip = { t: push(top, cc), b: push(bot, cc.map((v) => v * 0.75)) };
        if (prevLip) {
          const tri = sgn > 0 ? (a, b, c) => idx.push(a, b, c) : (a, b, c) => idx.push(a, c, b);
          tri(prevLip.b, lip.b, prevLip.t); tri(lip.b, lip.t, prevLip.t);
        }
        prevLip = lip;
      }
    }
    // round tile end caps along the eave
    if (T && F.lip) {
      const k0 = Math.ceil((F.u0 - T.phase) / T.p), k1 = Math.floor((F.u1 - T.phase) / T.p);
      for (let k = k0; k <= k1; k++) {
        const u = T.phase + k * T.p;
        if (u < F.u0 + T.rw * 0.4 || u > F.u1 - T.rw * 0.4) continue;
        if ((F.dmin ? F.dmin(u) : 0) > 1e-6) continue;
        if ((F.dmax(u) - (F.dmin ? F.dmin(u) : 0)) < 0.05) continue;
        const B = base(u, 0);
        const n = normalAt(u, 0);
        caps.push({ pos: [B[0] - F.n[0] * 0.012, B[1] + n[1] * T.rh * 0.05, B[2] - F.n[1] * 0.012], out: [-F.n[0], -F.n[1]], slope: Math.atan2(base(u, 0.1)[1] - B[1], 0.1) });
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, caps };
}

// Round tile end cap (tomoe-gawara) facing +z, radius r; returns [darkPart, goldPart]
export function tileCapGeos(r, detail = 2) {
  return cached(`cap${r},${detail}`, () => {
    if (detail < 2) {
      const sd = detail === 1 ? 10 : 6, sg = detail === 1 ? 8 : 5;
      const d = new THREE.CylinderGeometry(r, r, 0.03, sd, 1).rotateX(Math.PI / 2).translate(0, 0, 0.015);
      const g = new THREE.CylinderGeometry(r * 0.5, r * 0.55, 0.014, sg, 1).rotateX(Math.PI / 2).translate(0, 0, 0.034);
      return [ni(d), ni(g)];
    }
    const seg = 14;
    const dark = lathe([[0, 0], [r, 0], [r * 1.02, 0.006], [r * 1.0, 0.03], [r * 0.9, 0.032], [r * 0.86, 0.026], [r * 0.62, 0.026], [r * 0.58, 0.03], [0, 0.03]], seg)
      .rotateX(Math.PI / 2);
    // tomoe relief / boss (gold)
    const gold = lathe([[0, 0.024], [r * 0.5, 0.024], [r * 0.52, 0.034], [r * 0.4, 0.04], [r * 0.18, 0.046], [0, 0.048]], seg).rotateX(Math.PI / 2);
    return [ni(dark), ni(gold)];
  });
}

// ---------------------------------------------------------------------------
// Lift (corner up-sweep, "sori") — global over the plan of one roof
// ---------------------------------------------------------------------------
export function makeLift(ex, ez, L, f0 = 0.3, pw = 2.3, cap = 1.45) {
  if (!L) return () => 0;
  return (x, z) => {
    const px = Math.max(0, (Math.abs(x) - ex * f0) / (ex * (1 - f0)));
    const pz = Math.max(0, (Math.abs(z) - ez * f0) / (ez * (1 - f0)));
    return L * Math.min(cap, Math.pow(px, pw) * Math.pow(pz, pw));
  };
}
