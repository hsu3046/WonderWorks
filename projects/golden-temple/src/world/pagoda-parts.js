// ---------------------------------------------------------------------------
// Geometry generators for the five-storey pagoda (all procedural).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Instance collector: key -> InstancedMesh (one draw call per key)
// ---------------------------------------------------------------------------
export class InstSet {
  constructor() { this.defs = new Map(); }
  // jitter: per-instance brightness variation (0..1), tint: [r,g,b] extra random tint amplitude
  def(key, geo, mat, { castShadow = true, receiveShadow = true, jitter = 0, tint = null } = {}) {
    this.defs.set(key, { geo, mat, arr: [], castShadow, receiveShadow, jitter, tint });
  }
  add(key, m) {
    const d = this.defs.get(key);
    if (!d) throw new Error('InstSet: unknown key ' + key);
    for (let i = 0; i < 16; i++) d.arr.push(m.elements[i]);
  }
  count(key) { return this.defs.get(key).arr.length / 16; }
  build(group, rng = null) {
    let n = 0;
    for (const [key, d] of this.defs) {
      const c = d.arr.length / 16;
      if (!c) continue;
      const im = new THREE.InstancedMesh(d.geo, d.mat, c);
      im.instanceMatrix.array.set(d.arr);
      im.instanceMatrix.needsUpdate = true;
      if (d.jitter > 0 && rng) {
        const col = new Float32Array(c * 3);
        for (let i = 0; i < c; i++) {
          const v = 1 + (rng.float() - 0.5) * 2 * d.jitter;
          const t = d.tint ? rng.float() - 0.5 : 0;
          col[i * 3] = v * (1 + t * (d.tint ? d.tint[0] : 0));
          col[i * 3 + 1] = v * (1 + t * (d.tint ? d.tint[1] : 0));
          col[i * 3 + 2] = v * (1 + t * (d.tint ? d.tint[2] : 0));
        }
        im.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
      }
      im.castShadow = d.castShadow; im.receiveShadow = d.receiveShadow;
      im.name = 'pagoda_' + key;
      im.computeBoundingSphere();
      im.computeBoundingBox();
      group.add(im);
      n++;
    }
    return n;
  }
}

// ---------------------------------------------------------------------------
// Polygon soup with flat normals. faces: arrays of Vector3 (unordered, convex
// polygons). center: a point inside the (convex) solid for orientation.
// ---------------------------------------------------------------------------
const _t = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _n = new THREE.Vector3();
export function facesToGeo(faces, center = V3(0, 0, 0)) {
  const pos = [], nrm = [];
  for (const f of faces) {
    const g = V3(0, 0, 0); f.forEach((p) => g.add(p)); g.multiplyScalar(1 / f.length);
    const n = V3(0, 0, 0).subVectors(g, center).normalize();
    _t1.subVectors(f[0], g); _t1.addScaledVector(n, -_t1.dot(n)).normalize();
    _t2.crossVectors(n, _t1);
    const sorted = f.map((p) => { _t.subVectors(p, g); return { p, a: Math.atan2(_t.dot(_t2), _t.dot(_t1)) }; })
      .sort((A, B) => A.a - B.a).map((o) => o.p);
    // true face normal
    const fn = V3(0, 0, 0).subVectors(sorted[1], sorted[0]).cross(_t.subVectors(sorted[2], sorted[0])).normalize();
    if (fn.dot(n) < 0) fn.negate();
    for (let i = 1; i < sorted.length - 1; i++) {
      for (const p of [sorted[0], sorted[i], sorted[i + 1]]) { pos.push(p.x, p.y, p.z); nrm.push(fn.x, fn.y, fn.z); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return geo;
}

// Chamfered box centred on the origin (26 faces, crisp highlights on edges)
const _cbCache = new Map();
export function chamferBox(w, h, d, c = 0.012) {
  c = Math.max(0.0005, Math.min(c, w * 0.42, h * 0.42, d * 0.42));
  const key = [w, h, d, c].map((v) => v.toFixed(4)).join(',');
  if (_cbCache.has(key)) return _cbCache.get(key);
  const X = w / 2, Y = h / 2, Z = d / 2;
  const P = (sx, sy, sz, ax) => V3(
    sx * (ax === 0 ? X : X - c), sy * (ax === 1 ? Y : Y - c), sz * (ax === 2 ? Z : Z - c));
  const faces = [];
  const S = [-1, 1];
  // main faces
  for (const s of S) {
    faces.push([P(s, -1, -1, 0), P(s, -1, 1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0)]);
    faces.push([P(-1, s, -1, 1), P(-1, s, 1, 1), P(1, s, -1, 1), P(1, s, 1, 1)]);
    faces.push([P(-1, -1, s, 2), P(-1, 1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2)]);
  }
  // edge chamfers
  for (const a of S) for (const b of S) {
    faces.push([P(a, b, -1, 0), P(a, b, 1, 0), P(a, b, -1, 1), P(a, b, 1, 1)]); // x-y edges
    faces.push([P(a, -1, b, 0), P(a, 1, b, 0), P(a, -1, b, 2), P(a, 1, b, 2)]); // x-z edges
    faces.push([P(-1, a, b, 1), P(1, a, b, 1), P(-1, a, b, 2), P(1, a, b, 2)]); // y-z edges
  }
  // corners
  for (const a of S) for (const b of S) for (const e of S) faces.push([P(a, b, e, 0), P(a, b, e, 1), P(a, b, e, 2)]);
  const g = facesToGeo(faces);
  _cbCache.set(key, g);
  return g;
}

// Bearing block (masu): chamfered upper box + tapered foot. Origin at bottom centre.
export function masuGeo(s, h, footFrac = 0.42, footScale = 0.76, c = 0.012) {
  const pts = [];
  const hb = h * footFrac, X = s / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(V3(sx * X, h - c, sz * (X - c)), V3(sx * (X - c), h, sz * (X - c)), V3(sx * (X - c), h - c, sz * X));
    pts.push(V3(sx * X, hb, sz * (X - c)), V3(sx * (X - c), hb, sz * X));
    const b = X * footScale;
    pts.push(V3(sx * b, 0, sz * (b - c * 0.5)), V3(sx * (b - c * 0.5), 0, sz * b));
    // slight concave hint: intermediate ring
    const m = X * (footScale + (1 - footScale) * 0.35);
    pts.push(V3(sx * m, hb * 0.5, sz * m));
  }
  return new ConvexGeometry(pts);
}

// Bearing block (masu) with a true concave (cove) lower profile, a crisp ledge and a
// chamfered upper box. Origin at bottom centre, size s x s, height h.
export function masuCoveGeo(s, h, { footFrac = 0.44, footScale = 0.72, c = 0.012 } = {}) {
  const X = s / 2, hb = h * footFrac, b = X * footScale;
  const ring = (r, y, cc = c) => {
    const q = Math.max(r - cc, 0.0001);
    return [V3(r, y, -q), V3(r, y, q), V3(q, y, r), V3(-q, y, r), V3(-r, y, q), V3(-r, y, -q), V3(-q, y, -r), V3(q, y, -r)];
  };
  const secs = [], refs = [];
  const push = (r, y, cc) => { secs.push(ring(r, y, cc)); refs.push(V3(0, y, 0)); };
  push(b - 0.004, 0, c * 0.5);
  push(b, 0.006, c * 0.5);
  const NC = 6;
  for (let i = 0; i <= NC; i++) {
    const t = i / NC;
    push(b + (X - 0.006 - b) * Math.pow(t, 2.3), 0.012 + (hb - 0.012) * t, c * 0.6);
  }
  push(X, hb + 0.004, c);         // ledge (small step out)
  push(X, h - c, c);
  push(X - c, h, c);
  return loft(secs, { refs });
}

// Bracket arm (hijiki): length along X (unit 1 -> scale), height h, width w.
// Lower ends curve inward (kurikata). Origin: x-centre, bottom, z-centre.
export function armGeo(h = 0.24, w = 0.14, len = 1.0) {
  const L2 = len / 2, e = h * 0.46, r = h * 0.62, bev = 0.008;
  const s = new THREE.Shape();
  const st = 0.045, sd = h * 0.14; // carved step at the upper end corners
  s.moveTo(-L2 + bev + st, h - bev);
  s.lineTo(L2 - bev - st, h - bev);
  s.lineTo(L2 - bev - st * 0.55, h - bev - sd * 0.45);
  s.lineTo(L2 - bev, h - bev - sd);
  s.lineTo(L2 - bev, h - e);
  s.quadraticCurveTo(L2 - bev - r * 0.08, bev, L2 - r, bev);
  s.lineTo(-L2 + r, bev);
  s.quadraticCurveTo(-L2 + bev + r * 0.08, bev, -L2 + bev, h - e);
  s.lineTo(-L2 + bev, h - bev - sd);
  s.lineTo(-L2 + bev + st * 0.55, h - bev - sd * 0.45);
  s.lineTo(-L2 + bev + st, h - bev);
  const g = new THREE.ExtrudeGeometry(s, { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 5 });
  g.translate(0, 0, -(w - 2 * bev) / 2);
  g.deleteAttribute('uv');
  return g;
}

// Carved scroll eye on a bracket-arm side face: raised boss with a spiral lip, facing +Z.
export function armEyeGeo(r = 0.034) {
  const parts = [];
  const base = new THREE.CylinderGeometry(r, r * 1.08, 0.008, 12, 1); base.rotateX(Math.PI / 2); base.translate(0, 0, 0.004); parts.push(base);
  const lip = new THREE.TorusGeometry(r * 0.72, r * 0.16, 3, 12, Math.PI * 1.65); lip.translate(0, 0, 0.008); parts.push(lip);
  const dot = new THREE.CylinderGeometry(r * 0.28, r * 0.34, 0.012, 8, 1); dot.rotateX(Math.PI / 2); dot.translate(r * 0.12, r * 0.1, 0.006); parts.push(dot);
  return mergeClean(parts);
}

// Gold end cap (kibana kanagu): plate in XY facing +Z, back at z=0, unit 1x1 (scale x,y).
export function capGeo() {
  const parts = [];
  const plate = chamferBox(1, 1, 0.03, 0.01).clone(); plate.translate(0, 0, 0.003);
  parts.push(plate);
  // raised inner panel: truncated pyramid (bevelled frame look)
  const fr = new THREE.CylinderGeometry(0.33 * Math.SQRT2 * 0.82, 0.33 * Math.SQRT2, 0.012, 4, 1);
  fr.rotateY(Math.PI / 4); fr.rotateX(Math.PI / 2); fr.translate(0, 0, 0.024);
  parts.push(fr);
  const boss = new THREE.SphereGeometry(0.17, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2);
  boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.07); boss.translate(0, 0, 0.029);
  parts.push(boss);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const nail = new THREE.SphereGeometry(0.04, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2);
    nail.rotateX(Math.PI / 2); nail.scale(1, 1, 0.3); nail.translate(sx * 0.37, sy * 0.37, 0.016); parts.push(nail);
  }
  const lipR = new THREE.TorusGeometry(0.2, 0.022, 3, 12); lipR.scale(1, 1, 0.5); lipR.translate(0, 0, 0.03); parts.push(lipR);
  return mergeGeometries(parts.map(cleanGeo));
}

export function cleanGeo(g) {
  let geo = g.index ? g.toNonIndexed() : g.clone();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  geo.morphAttributes = {};
  geo.clearGroups();
  return geo;
}

export function mergeClean(list) { return mergeGeometries(list.map(cleanGeo)); }

// ---------------------------------------------------------------------------
// Roof tiles (hongawara). All tiles: axis along +Z (toward the eave), up +Y.
// ---------------------------------------------------------------------------
export const TILE = { L: 0.34, r0: 0.094, r1: 0.083, th: 0.017 };

// Convex round tile (marugawara): half tube, front end (z=+L/2) larger, with a
// collar step that reads as the overlap joint.
export function roundTileGeo(seg = 8, simple = false) {
  const { L, r0, r1, th } = TILE;
  // profile in (r, y) with y along the tile axis; increasing y = toward front
  const prof = (simple ? [
    [r1, -L / 2], [r0 - 0.003, L / 2 - 0.04], [r0 + 0.001, L / 2 - 0.006], [r0 - th, L / 2],
  ] : [
    [r1, -L / 2], [r0 - 0.004, L / 2 - 0.045], [r0, L / 2 - 0.032], [r0 + 0.002, L / 2 - 0.006], [r0 - th, L / 2],
  ]).map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, seg, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2); // lathe y -> +z ; half lies in y >= 0
  return g;
}

// Concave flat tile (hiragawara) plate: width 0.3 across X, length L along Z.
export function flatTileGeo(nx = 6) {
  const { L } = TILE;
  const W = 0.30, th = 0.02;
  const pos = [];
  const yAt = (x) => -0.018 * Math.cos((Math.PI * x) / W) + 0.006;
  const quad = (a, b, c, d) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (let i = 0; i < nx; i++) {
    const x0 = -W / 2 + (W * i) / nx, x1 = -W / 2 + (W * (i + 1)) / nx;
    // top surface (normal +y): order for CCW from above
    quad([x0, yAt(x0), L / 2], [x1, yAt(x1), L / 2], [x1, yAt(x1), -L / 2], [x0, yAt(x0), -L / 2]);
    // front edge (normal +z)
    quad([x0, yAt(x0) - th, L / 2], [x1, yAt(x1) - th, L / 2], [x1, yAt(x1), L / 2], [x0, yAt(x0), L / 2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Eave end disc (nokimarugawara mon): faces +Z, back at z~-0.03. Mitsudomoe-ish
// pinwheel + bead ring + rim.
export function discGeo(R = 0.104, detail = 1) {
  const prof = (detail ? [
    [0.085, -0.032], [R, -0.018], [R + 0.002, 0.014], [R - 0.01, 0.028], [R - 0.022, 0.016],
    [0.03, 0.012], [0.016, 0.026], [0.0001, 0.03],
  ] : [
    [0.085, -0.032], [R, -0.018], [R + 0.002, 0.014], [R - 0.012, 0.027], [R - 0.022, 0.014], [0.0001, 0.016],
  ]).map(([r, y]) => new THREE.Vector2(r, y));
  const parts = [];
  const lathe = new THREE.LatheGeometry(prof, detail ? 16 : 10);
  lathe.rotateX(Math.PI / 2); // y -> z (front)
  parts.push(lathe);
  if (detail) {
    // eight-spoke wheel mon with petal-like spoke ends
    const L = R - 0.066;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const sp = new THREE.BoxGeometry(0.01, L, 0.01);
      sp.translate(0, 0.024 + L / 2, 0.017);
      sp.rotateZ(a);
      parts.push(sp);
      // petal between the spokes
      const tip = new THREE.OctahedronGeometry(1, 0); tip.scale(0.012, 0.019, 0.008);
      tip.translate(0, 0.047, 0.016); tip.rotateZ(a + Math.PI / 8);
      parts.push(tip);
    }
    // bead ring (renju) inside the rim
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const bd = new THREE.OctahedronGeometry(0.0062, 0); bd.scale(1, 1, 0.8);
      bd.translate(Math.cos(a) * 0.071, Math.sin(a) * 0.071, 0.0155);
      parts.push(bd);
    }
    const hub = new THREE.CylinderGeometry(0.022, 0.026, 0.014, 10, 1); hub.rotateX(Math.PI / 2); hub.translate(0, 0, 0.022);
    parts.push(hub);
  }
  return mergeClean(parts);
}

// Front lip of the flat eave tile (karakusa nokihiragawara): faces +Z
export function lipGeo() {
  const parts = [];
  const b = chamferBox(0.27, 0.065, 0.04, 0.008).clone(); b.translate(0, -0.03, -0.01);
  parts.push(b);
  for (const sx of [-1, 1]) {
    const s = new THREE.OctahedronGeometry(1, 0); s.scale(0.04, 0.012, 0.009); s.translate(sx * 0.06, -0.03, 0.011);
    parts.push(s);
  }
  const m = new THREE.OctahedronGeometry(0.013, 0); m.translate(0, -0.03, 0.011); parts.push(m);
  return mergeClean(parts);
}

// ---------------------------------------------------------------------------
// Loft / sweep utilities
// ---------------------------------------------------------------------------
// sections: array of arrays of Vector3 (same length, closed ring order). Builds
// side quads with flat normals, oriented away from each section's centroid.
export function loft(sections, { caps = true, closed = true, refs = null } = {}) {
  const pos = [], nrm = [];
  const n = sections.length, m = sections[0].length;
  const cents = sections.map((s) => { const c = V3(0, 0, 0); s.forEach((p) => c.add(p)); return c.multiplyScalar(1 / s.length); });
  const tri = (a, b, c, ref, outward = true) => {
    _t1.subVectors(b, a); _t2.subVectors(c, a); _n.crossVectors(_t1, _t2);
    if (_n.lengthSq() < 1e-14) return;
    _n.normalize();
    _t.set((a.x + b.x + c.x) / 3 - ref.x, (a.y + b.y + c.y) / 3 - ref.y, (a.z + b.z + c.z) / 3 - ref.z);
    let flip = _n.dot(_t) < 0; if (!outward) flip = !flip;
    if (flip) { _n.negate(); pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z); }
    else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let k = 0; k < 3; k++) nrm.push(_n.x, _n.y, _n.z);
  };
  const ref = V3();
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < (closed ? m : m - 1); k++) {
      const k2 = (k + 1) % m;
      const a = sections[i][k], b = sections[i][k2], c = sections[i + 1][k2], d = sections[i + 1][k];
      if (refs) ref.addVectors(refs[i], refs[i + 1]).multiplyScalar(0.5);
      else ref.addVectors(cents[i], cents[i + 1]).multiplyScalar(0.5);
      tri(a, b, c, ref); tri(a, c, d, ref);
    }
  }
  if (caps && closed) {
    for (const [idx, nb] of [[0, 1], [n - 1, n - 2]]) {
      const s = sections[idx], c = cents[idx];
      // outward = away from neighbour section
      const away = V3().subVectors(c, cents[nb]);
      const refp = V3().subVectors(c, away);
      for (let k = 0; k < m; k++) tri(c, s[k], s[(k + 1) % m], refp);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

// Sweep a 2D profile [[u,v]] (u = side, v = up) along points.
export function sweep(points, profile, up = V3(0, 1, 0), opts = {}) {
  const n = points.length;
  const secs = [];
  for (let i = 0; i < n; i++) {
    const t = V3().subVectors(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)]).normalize();
    const side = V3().crossVectors(t, up).normalize();
    const u2 = V3().crossVectors(side, t).normalize();
    secs.push(profile.map(([u, v]) => points[i].clone().addScaledVector(side, u).addScaledVector(u2, v)));
  }
  return loft(secs, opts);
}

// Chamfered rectangle profile (w x h) centred at origin
export function rectProfile(w, h, c = 0.015) {
  const X = w / 2, Y = h / 2;
  return [[-X + c, -Y], [X - c, -Y], [X, -Y + c], [X, Y - c], [X - c, Y], [-X + c, Y], [-X, Y - c], [-X, -Y + c]];
}

// Grid surface: fn(u,v) -> Vector3 (u,v in 0..1); `facing` = desired normal hint
// (Vector3) or null; triangles are flipped to agree with it.
export function gridSurface(fn, nu, nv, facing = null) {
  const pts = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(fn(i / nu, j / nv));
  const pos = [];
  const idx = (i, j) => pts[j * (nu + 1) + i];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    for (const [p, q, r] of [[a, b, c], [a, c, d]]) {
      _t1.subVectors(q, p); _t2.subVectors(r, p); _n.crossVectors(_t1, _t2);
      if (_n.lengthSq() < 1e-14) continue;
      if (facing && _n.dot(facing) < 0) pos.push(p.x, p.y, p.z, r.x, r.y, r.z, q.x, q.y, q.z);
      else pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Ornaments
// ---------------------------------------------------------------------------
export function lathe(profile, seg = 20) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg);
}

// gold onion finial (giboshi), height ~0.36, origin at base
export function giboshiGeo() {
  return lathe([
    [0.0001, 0], [0.068, 0], [0.07, 0.012], [0.062, 0.02], [0.062, 0.05], [0.074, 0.056], [0.074, 0.07], [0.058, 0.076],
    [0.062, 0.095], [0.086, 0.125], [0.097, 0.155], [0.094, 0.185], [0.078, 0.215], [0.052, 0.245], [0.03, 0.27],
    [0.018, 0.295], [0.022, 0.31], [0.012, 0.335], [0.0001, 0.355],
  ], 20);
}

// small bell (fuurin-like) for chains / rings, origin at hook (top), hangs -Y
export function smallBellGeo(s = 1) {
  const g = lathe([
    [0.0001, 0], [0.008, 0], [0.008, -0.012], [0.024, -0.018], [0.03, -0.04], [0.034, -0.07], [0.042, -0.09],
    [0.04, -0.096], [0.03, -0.094], [0.0001, -0.094],
  ], 12);
  g.scale(s, s, s);
  return g;
}

// gilt rosette nail cover (kugikakushi) facing +Z, back at z=0, ~0.16 dia
export function rosetteGeo() {
  const parts = [];
  const petals = 8;
  const shape = new THREE.Shape();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const r = 0.06 + 0.016 * Math.pow(Math.abs(Math.cos((a * petals) / 2)), 0.7);
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false, curveSegments: 1 });
  parts.push(g);
  const boss = new THREE.SphereGeometry(0.03, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2); boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.6); boss.translate(0, 0, 0.01);
  parts.push(boss);
  const ring = new THREE.TorusGeometry(0.045, 0.005, 3, 16); ring.translate(0, 0, 0.011); parts.push(ring);
  return mergeClean(parts);
}

// door stud (dobyo): low dome facing +Z
export function studGeo() {
  const g = new THREE.SphereGeometry(0.024, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  g.rotateX(Math.PI / 2); g.scale(1, 1, 0.75);
  const base = new THREE.CylinderGeometry(0.03, 0.03, 0.006, 10); base.rotateX(Math.PI / 2); base.translate(0, 0, 0.003);
  return mergeClean([g, base]);
}

// Onigawara (ridge-end ogre tile) plaque, faces +Z, base at y=0, ~0.5 wide x 0.6 tall
export function onigawaraGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.22, 0);
  s.lineTo(0.22, 0);
  s.lineTo(0.23, 0.16);
  s.quadraticCurveTo(0.31, 0.24, 0.25, 0.33);
  s.quadraticCurveTo(0.3, 0.44, 0.2, 0.48);
  s.quadraticCurveTo(0.2, 0.6, 0.1, 0.6);
  s.quadraticCurveTo(0.05, 0.56, 0.03, 0.62);
  s.lineTo(0, 0.66);
  s.lineTo(-0.03, 0.62);
  s.quadraticCurveTo(-0.05, 0.56, -0.1, 0.6);
  s.quadraticCurveTo(-0.2, 0.6, -0.2, 0.48);
  s.quadraticCurveTo(-0.3, 0.44, -0.25, 0.33);
  s.quadraticCurveTo(-0.31, 0.24, -0.23, 0.16);
  s.lineTo(-0.22, 0);
  const parts = [];
  // chunky plaque (thick, deeply bevelled so it reads as a fired-clay block, not a cut-out)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -0.1);
  parts.push(g);
  // rear body that merges into the ridge (seen from below / the side it is solid, not a floating slab)
  const back = chamferBox(0.36, 0.34, 0.42, 0.03).clone(); back.translate(0, 0.17, -0.3); parts.push(back);
  // stepped plinth (where the ridge cap meets the plaque)
  const pl = chamferBox(0.5, 0.07, 0.26, 0.015).clone(); pl.translate(0, 0.035, -0.06); parts.push(pl);
  // relief: ring, boss, side scrolls, brow
  const ring = new THREE.TorusGeometry(0.1, 0.026, 6, 24); ring.translate(0, 0.28, 0.07); parts.push(ring);
  const boss = new THREE.SphereGeometry(0.058, 12, 6); boss.scale(1, 1, 0.7); boss.translate(0, 0.28, 0.07); parts.push(boss);
  for (const sx of [-1, 1]) {
    const sc = new THREE.TorusGeometry(0.05, 0.019, 5, 14, Math.PI * 1.5); sc.rotateZ(sx > 0 ? 0 : Math.PI); sc.translate(sx * 0.16, 0.42, 0.06); parts.push(sc);
    const lb = new THREE.SphereGeometry(0.04, 8, 5); lb.scale(1, 0.8, 0.7); lb.translate(sx * 0.17, 0.13, 0.065); parts.push(lb);
    // flame horns (tsuno) curling up and out from the crown
    for (let q = 0; q < 4; q++) {
      const t = q / 3;
      const r = 0.045 * (1 - 0.62 * t);
      const b = new THREE.SphereGeometry(r, 7, 5);
      b.translate(sx * (0.14 + 0.1 * t + 0.03 * t * t), 0.55 + 0.12 * t, -0.02 - 0.03 * t);
      parts.push(b);
    }
  }
  const brow = new THREE.TorusGeometry(0.15, 0.024, 5, 18, Math.PI); brow.translate(0, 0.33, 0.055); parts.push(brow);
  // raised inner border following the outline (second relief layer)
  const inner = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 5 });
  inner.scale(0.84, 0.86, 1); inner.translate(0, 0.035, 0.035); parts.push(inner);
  // bead ring (renju) around the central boss
  for (let q = 0; q < 14; q++) {
    const a = (q / 14) * Math.PI * 2;
    const b = new THREE.SphereGeometry(0.016, 6, 4); b.scale(1, 1, 0.75); b.translate(Math.cos(a) * 0.15, 0.28 + Math.sin(a) * 0.15, 0.085); parts.push(b);
  }
  // inner petal ring + boss rim
  const ring2 = new THREE.TorusGeometry(0.065, 0.012, 5, 20); ring2.translate(0, 0.28, 0.105); parts.push(ring2);
  // side fins (hire): stacked scallops down both flanks
  for (const sx of [-1, 1]) for (let q = 0; q < 3; q++) {
    const f = new THREE.SphereGeometry(0.045 - q * 0.008, 7, 5); f.scale(0.55, 1, 0.8); f.translate(sx * (0.255 - q * 0.012), 0.2 + q * 0.1, 0.0); parts.push(f);
  }
  // fangs / beard at the base
  for (const sx of [-1, 0, 1]) { const g = new THREE.ConeGeometry(0.022, 0.07, 6); g.rotateZ(Math.PI); g.translate(sx * 0.06, 0.1, 0.075); parts.push(g); }
  return mergeClean(parts);
}

// Sorin water-flame (suien) openwork panel in XY plane, centred on x=0, base y=0.
export function suienGeo(H = 1.75, W = 0.62) {
  const s = new THREE.Shape();
  const P = [];
  // right half outline (u, v): flame tongues (tips) with curled notches, mirrored for the left
  const half = [
    [0.07, 0], [0.2, 0.04], [0.34, 0.12], [0.56, 0.24], [0.36, 0.28], [0.44, 0.36], [0.6, 0.52], [0.38, 0.52],
    [0.44, 0.62], [0.54, 0.82], [0.32, 0.78], [0.36, 0.9], [0.44, 1.08], [0.24, 1.04], [0.26, 1.18], [0.3, 1.34],
    [0.13, 1.3], [0.12, 1.44], [0.06, 1.58], [0, 1.68],
  ];
  const sx = W / 0.6, sy = H / 1.68;
  for (const [u, v] of half) P.push([u * sx, v * sy]);
  const left = P.slice(0, -1).reverse().map(([u, v]) => [-u, v]);
  const all = P.concat(left);
  s.moveTo(all[0][0], all[0][1]);
  for (let i = 1; i < all.length; i++) {
    const [u0, v0] = all[i - 1], [u1, v1] = all[i];
    // slight outward bow on each edge -> curling tongues
    s.quadraticCurveTo((u0 + u1) / 2 + (v1 - v0) * 0.12 * Math.sign(u0 + u1 || 1), (v0 + v1) / 2 - Math.abs(u1 - u0) * 0.12, u1, v1);
  }
  // openwork holes (teardrops / jewels)
  const hole = (cx, cy, rx, ry) => {
    const h = new THREE.Path();
    h.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true, 0);
    s.holes.push(h);
  };
  hole(0, 0.42 * sy, 0.07 * sx, 0.1 * sy);
  hole(0, 0.95 * sy, 0.05 * sx, 0.08 * sy);
  for (const sgn of [-1, 1]) {
    hole(sgn * 0.24 * sx, 0.24 * sy, 0.07 * sx, 0.045 * sy);
    hole(sgn * 0.3 * sx, 0.6 * sy, 0.08 * sx, 0.06 * sy);
    hole(sgn * 0.17 * sx, 0.72 * sy, 0.04 * sx, 0.05 * sy);
    hole(sgn * 0.24 * sx, 0.96 * sy, 0.06 * sx, 0.05 * sy);
    hole(sgn * 0.14 * sx, 1.2 * sy, 0.045 * sx, 0.05 * sy);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -0.011);
  return g;
}

export { V3, mergeGeometries, ConvexGeometry };
