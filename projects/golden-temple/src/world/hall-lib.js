// ---------------------------------------------------------------------------
// hall-lib: low-level procedural mesh accumulation for the main hall.
// Everything is appended into growable typed buffers per material (one draw
// call per material), with optional local transforms, mirroring, smooth
// "rounded" chamfers and a post-hoc world warp (roof sori).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

class FBuf {
  constructor(n = 1 << 14) { this.a = new Float32Array(n); this.n = 0; }
  reserve(k) {
    if (this.n + k <= this.a.length) return;
    let m = this.a.length * 2; while (m < this.n + k) m *= 2;
    const b = new Float32Array(m); b.set(this.a.subarray(0, this.n)); this.a = b;
  }
}
class UBuf {
  constructor(n = 1 << 14) { this.a = new Uint32Array(n); this.n = 0; }
  reserve(k) {
    if (this.n + k <= this.a.length) return;
    let m = this.a.length * 2; while (m < this.n + k) m *= 2;
    const b = new Uint32Array(m); b.set(this.a.subarray(0, this.n)); this.a = b;
  }
}

const _nm = new THREE.Matrix3();

export class Mesher {
  constructor(material) {
    this.material = material;
    this.P = new FBuf(); this.N = new FBuf(); this.I = new UBuf();
    this.C = new FBuf(); this.tint = 1;
    // optional primitive-local coordinates (pre-transform input position) for
    // materials that paint patterns in member space (userData.wantLoc)
    this.L = material && material.userData && material.userData.wantLoc ? new FBuf() : null;
    this.vc = 0; this._e = null; this._n = null; this._flip = false;
  }
  begin(X) {
    if (X) {
      this._e = X.elements;
      this._n = _nm.getNormalMatrix(X).elements.slice();
      this._flip = X.determinant() < 0;
    } else { this._e = null; this._n = null; this._flip = false; }
    return this;
  }
  v(x, y, z, nx, ny, nz) {
    const e = this._e;
    let X = x, Y = y, Z = z, NX = nx, NY = ny, NZ = nz;
    if (e) {
      X = e[0] * x + e[4] * y + e[8] * z + e[12];
      Y = e[1] * x + e[5] * y + e[9] * z + e[13];
      Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      const n = this._n;
      NX = n[0] * nx + n[3] * ny + n[6] * nz;
      NY = n[1] * nx + n[4] * ny + n[7] * nz;
      NZ = n[2] * nx + n[5] * ny + n[8] * nz;
    }
    const l = Math.hypot(NX, NY, NZ) || 1;
    const P = this.P, N = this.N; P.reserve(3); N.reserve(3);
    P.a[P.n++] = X; P.a[P.n++] = Y; P.a[P.n++] = Z;
    N.a[N.n++] = NX / l; N.a[N.n++] = NY / l; N.a[N.n++] = NZ / l;
    const Cb = this.C; Cb.reserve(1); Cb.a[Cb.n++] = this.tint;
    if (this.L) { const Lb = this.L; Lb.reserve(3); Lb.a[Lb.n++] = x; Lb.a[Lb.n++] = y; Lb.a[Lb.n++] = z; }
    return this.vc++;
  }
  // raw triangle (winding as given, flipped if mirrored)
  tri(a, b, c) {
    const I = this.I; I.reserve(3);
    if (this._flip) { I.a[I.n++] = a; I.a[I.n++] = c; I.a[I.n++] = b; }
    else { I.a[I.n++] = a; I.a[I.n++] = b; I.a[I.n++] = c; }
  }
  // triangle oriented to agree with its vertex normals (robust, a bit slower)
  triN(a, b, c) {
    const p = this.P.a, n = this.N.a;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az;
    const vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const nx = n[a * 3] + n[b * 3] + n[c * 3], ny = n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1], nz = n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2];
    const I = this.I; I.reserve(3);
    if (cx * nx + cy * ny + cz * nz >= 0) { I.a[I.n++] = a; I.a[I.n++] = b; I.a[I.n++] = c; }
    else { I.a[I.n++] = a; I.a[I.n++] = c; I.a[I.n++] = b; }
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  quadN(a, b, c, d) { this.triN(a, b, c); this.triN(a, c, d); }
  get tris() { return this.I.n / 3; }

  append(o) {
    const off = this.vc;
    this.P.reserve(o.P.n); this.P.a.set(o.P.a.subarray(0, o.P.n), this.P.n); this.P.n += o.P.n;
    this.N.reserve(o.N.n); this.N.a.set(o.N.a.subarray(0, o.N.n), this.N.n); this.N.n += o.N.n;
    this.C.reserve(o.C.n); this.C.a.set(o.C.a.subarray(0, o.C.n), this.C.n); this.C.n += o.C.n;
    if (this.L) {
      if (o.L) { this.L.reserve(o.L.n); this.L.a.set(o.L.a.subarray(0, o.L.n), this.L.n); this.L.n += o.L.n; }
      else { this.L.reserve(o.vc * 3); this.L.a.fill(0, this.L.n, this.L.n + o.vc * 3); this.L.n += o.vc * 3; }
    }
    this.I.reserve(o.I.n);
    const ia = this.I.a, oa = o.I.a; let k = this.I.n;
    for (let i = 0; i < o.I.n; i++) ia[k++] = oa[i] + off;
    this.I.n = k; this.vc += o.vc;
  }

  // Apply a smooth deformation fn(x,y,z,out) to positions; normals are
  // transformed with the inverse-transpose of the numerical Jacobian.
  warp(fn) {
    const p = this.P.a, n = this.N.a, h = 0.02;
    const o0 = [0, 0, 0], ox = [0, 0, 0], oy = [0, 0, 0], oz = [0, 0, 0];
    for (let i = 0; i < this.vc; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      fn(x, y, z, o0); fn(x + h, y, z, ox); fn(x, y + h, z, oy); fn(x, y, z + h, oz);
      const j0x = (ox[0] - o0[0]) / h, j0y = (ox[1] - o0[1]) / h, j0z = (ox[2] - o0[2]) / h;
      const j1x = (oy[0] - o0[0]) / h, j1y = (oy[1] - o0[1]) / h, j1z = (oy[2] - o0[2]) / h;
      const j2x = (oz[0] - o0[0]) / h, j2y = (oz[1] - o0[1]) / h, j2z = (oz[2] - o0[2]) / h;
      // cofactor columns
      const c0x = j1y * j2z - j1z * j2y, c0y = j1z * j2x - j1x * j2z, c0z = j1x * j2y - j1y * j2x;
      const c1x = j2y * j0z - j2z * j0y, c1y = j2z * j0x - j2x * j0z, c1z = j2x * j0y - j2y * j0x;
      const c2x = j0y * j1z - j0z * j1y, c2y = j0z * j1x - j0x * j1z, c2z = j0x * j1y - j0y * j1x;
      const nx = n[i * 3], ny = n[i * 3 + 1], nz = n[i * 3 + 2];
      let mx = nx * c0x + ny * c1x + nz * c2x, my = nx * c0y + ny * c1y + nz * c2y, mz = nx * c0z + ny * c1z + nz * c2z;
      const l = Math.hypot(mx, my, mz) || 1;
      n[i * 3] = mx / l; n[i * 3 + 1] = my / l; n[i * 3 + 2] = mz / l;
      p[i * 3] = o0[0]; p[i * 3 + 1] = o0[1]; p[i * 3 + 2] = o0[2];
    }
  }

  // per-vertex ambient occlusion from an analytic field fn(x,y,z,nx,ny,nz) -> 0..1
  computeAO(fn) {
    const p = this.P.a, n = this.N.a; const A = new Float32Array(this.vc);
    for (let i = 0; i < this.vc; i++) A[i] = fn(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
    this.A = A;
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.a.slice(0, this.P.n), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.a.slice(0, this.N.n), 3));
    if (this.A) g.setAttribute('aAO', new THREE.BufferAttribute(this.A, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(this.C.a.slice(0, this.C.n), 1));
    if (this.L) g.setAttribute('aLoc', new THREE.BufferAttribute(this.L.a.slice(0, this.L.n), 3));
    g.setIndex(new THREE.BufferAttribute(this.I.a.slice(0, this.I.n), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

export class Acc {
  constructor() { this.map = new Map(); }
  m(material) {
    let x = this.map.get(material);
    if (!x) { x = new Mesher(material); this.map.set(material, x); }
    return x;
  }
  warp(fn) { for (const m of this.map.values()) m.warp(fn); return this; }
  computeAO(fn) { for (const m of this.map.values()) m.computeAO(fn); return this; }
  absorb(other) { for (const [mat, ms] of other.map) this.m(mat).append(ms); return this; }
  get tris() { let t = 0; for (const m of this.map.values()) t += m.tris; return t; }
  build(name = 'acc', { noShadow = new Set(), noReceive = new Set() } = {}) {
    const g = new THREE.Group(); g.name = name;
    for (const [mat, ms] of this.map) {
      if (!ms.vc) continue;
      const mesh = new THREE.Mesh(ms.toGeometry(), mat);
      mesh.name = name + ':' + (mat.name || mat.type);
      mesh.castShadow = !noShadow.has(mat);
      mesh.receiveShadow = !noReceive.has(mat);
      g.add(mesh);
    }
    return g;
  }
}

// ---------------------------------------------------------------------------
// transforms
// ---------------------------------------------------------------------------
const _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
// pos, yaw (about Y), pitch (about local X), roll (about local Z), scale
export function xf(pos = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = 1) {
  _p.set(pos[0], pos[1], pos[2]);
  _q.setFromEuler(_eu.set(pitch, yaw, roll, 'YXZ'));
  if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}
// matrix from origin + explicit (not necessarily orthonormal) axes
export function basis(o, ax, ay, az) {
  return new THREE.Matrix4().set(
    ax[0], ay[0], az[0], o[0],
    ax[1], ay[1], az[1], o[1],
    ax[2], ay[2], az[2], o[2],
    0, 0, 0, 1);
}
export const mul = (A, B) => new THREE.Matrix4().multiplyMatrices(A, B);

// vector helpers on arrays
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
};

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

// Chamfered box centred at the local origin. Chamfer normals are smoothed
// between the adjacent faces so edges read as rounded fillets in the light.
// opts.taper = [sx, sz] scales the bottom (y=-hy) face; opts.skip = set of
// face keys ('+x','-y',...) to omit (hidden faces).
export function cbox(ms, X, hx, hy, hz, c = 0.015, opts = {}) {
  ms.begin(X);
  const h = [hx, hy, hz];
  c = Math.max(0, Math.min(c, 0.45 * Math.min(hx, hy, hz)));
  const tp = opts.taper;
  const skip = opts.skip;
  const put = (p, nrm) => {
    let x = p[0], y = p[1], z = p[2];
    if (tp) { const f = (y + hy) / (2 * hy); x *= tp[0] + (1 - tp[0]) * f; z *= tp[1] + (1 - tp[1]) * f; }
    return ms.v(x, y, z, nrm[0], nrm[1], nrm[2]);
  };
  const orient = (pa, pb, pc, ia, ib, ic) => {
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const s = n[0] * (pa[0] + pb[0] + pc[0]) + n[1] * (pa[1] + pb[1] + pc[1]) + n[2] * (pa[2] + pb[2] + pc[2]);
    if (s >= 0) ms.tri(ia, ib, ic); else ms.tri(ia, ic, ib);
  };
  const keys = ['x', 'y', 'z'];
  // faces
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    if (skip && skip.has((s > 0 ? '+' : '-') + keys[k])) continue;
    const i = (k + 1) % 3, j = (k + 2) % 3;
    const nrm = [0, 0, 0]; nrm[k] = s;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = [0, 0, 0]; p[k] = s * h[k]; p[i] = a * (h[i] - c); p[j] = b * (h[j] - c); return p; });
    const id = pts.map((p) => put(p, nrm));
    orient(pts[0], pts[1], pts[2], id[0], id[1], id[2]);
    orient(pts[0], pts[2], pts[3], id[0], id[2], id[3]);
  }
  if (c <= 0) { ms.begin(null); return; }
  // edges
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const k = 3 - i - j;
    for (const si of [-1, 1]) for (const sj of [-1, 1]) {
      const pts = [], nrms = [];
      for (const [side, sk] of [['A', -1], ['A', 1], ['B', 1], ['B', -1]]) {
        const p = [0, 0, 0]; const nn = [0, 0, 0];
        p[k] = sk * (h[k] - c);
        if (side === 'A') { p[i] = si * h[i]; p[j] = sj * (h[j] - c); nn[i] = si; }
        else { p[i] = si * (h[i] - c); p[j] = sj * h[j]; nn[j] = sj; }
        pts.push(p); nrms.push(nn);
      }
      const id = pts.map((p, q) => put(p, nrms[q]));
      orient(pts[0], pts[1], pts[2], id[0], id[1], id[2]);
      orient(pts[0], pts[2], pts[3], id[0], id[2], id[3]);
    }
  }
  // corners
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const pa = [sx * hx, sy * (hy - c), sz * (hz - c)], pb = [sx * (hx - c), sy * hy, sz * (hz - c)], pc = [sx * (hx - c), sy * (hy - c), sz * hz];
    const ia = put(pa, [sx, 0, 0]), ib = put(pb, [0, sy, 0]), ic = put(pc, [0, 0, sz]);
    orient(pa, pb, pc, ia, ib, ic);
  }
  ms.begin(null);
}

// Beam between two points: local X along p0->p1, cross-section w (side) x h (up).
export function beam(ms, p0, p1, w, h, c = 0.015, up = [0, 1, 0], opts = {}) {
  const d = v3.sub(p1, p0); const L = v3.len(d); if (L < 1e-5) return;
  const ax = v3.scale(d, 1 / L);
  let ay = v3.sub(up, v3.scale(ax, v3.dot(up, ax)));
  if (v3.len(ay) < 1e-4) ay = Math.abs(ax[0]) < 0.9 ? v3.cross(ax, [1, 0, 0]) : v3.cross(ax, [0, 0, 1]);
  ay = v3.norm(ay);
  const az = v3.cross(ax, ay);
  const o = v3.lerp(p0, p1, 0.5);
  cbox(ms, basis(o, ax, ay, az), L / 2, h / 2, w / 2, c, opts);
}

// Surface of revolution about local +Y. profile: [[r,y],...]. Hard corners
// (normal turn > hardDeg) get split normals. opts.seg, opts.phase, opts.arc
export function lathe(ms, X, profile, seg = 16, opts = {}) {
  const hardCos = Math.cos(((opts.hardDeg ?? 32) * Math.PI) / 180);
  const n = profile.length;
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  // rings: list of {r,y,nr,ny}; for each segment the ring index at start and end
  const rings = []; const segRing = [];
  for (let s = 0; s < n - 1; s++) {
    let startIdx;
    if (s > 0) {
      const a = segN[s - 1], b = segN[s];
      if (a[0] * b[0] + a[1] * b[1] > hardCos) startIdx = segRing[s - 1][1]; // smooth: share
    }
    if (startIdx === undefined) { rings.push({ r: profile[s][0], y: profile[s][1], nr: segN[s][0], ny: segN[s][1] }); startIdx = rings.length - 1; }
    let nr = segN[s][0], ny = segN[s][1];
    if (s < n - 2) {
      const b = segN[s + 1];
      if (nr * b[0] + ny * b[1] > hardCos) { nr = (nr + b[0]) / 2; ny = (ny + b[1]) / 2; }
    }
    // average with previous at the start ring if shared
    rings.push({ r: profile[s + 1][0], y: profile[s + 1][1], nr, ny });
    segRing.push([startIdx, rings.length - 1]);
  }
  // fix shared start rings: their normal was set by the previous segment's end (already averaged)
  ms.begin(X);
  const phase = opts.phase || 0;
  const arc = opts.arc || Math.PI * 2;
  const closed = arc >= Math.PI * 2 - 1e-6;
  const K = closed ? seg : seg + 1;
  const base = [];
  for (const rg of rings) {
    const row = [];
    for (let k = 0; k < K; k++) {
      const t = phase + (arc * k) / seg; const c = Math.cos(t), s = Math.sin(t);
      row.push(ms.v(rg.r * c, rg.y, rg.r * s, rg.nr * c, rg.ny, rg.nr * s));
    }
    base.push(row);
  }
  for (const [a, b] of segRing) {
    const A = base[a], B = base[b];
    if (rings[a].r < 1e-5 && rings[b].r < 1e-5) continue;
    for (let k = 0; k < seg; k++) {
      const k1 = closed ? (k + 1) % seg : k + 1;
      if (rings[a].r < 1e-5) ms.triN(A[k], B[k], B[k1]);
      else if (rings[b].r < 1e-5) ms.triN(A[k], B[k], A[k1]);
      else ms.quadN(A[k], A[k1], B[k1], B[k]);
    }
  }
  ms.begin(null);
}

// Extrude a 2D shape (outer contour CCW in local XY, optional holes) along +Z
// from z0 to z1. Flat-shaded sides. opts.caps (default both).
export function extrude(ms, X, outer, holes = [], z0 = 0, z1 = 0.1, opts = {}) {
  let o = outer.slice();
  if (THREE.ShapeUtils.isClockWise(o.map((p) => new THREE.Vector2(p[0], p[1])))) o.reverse();
  const hs = holes.map((h) => { const hh = h.slice(); if (!THREE.ShapeUtils.isClockWise(hh.map((p) => new THREE.Vector2(p[0], p[1])))) hh.reverse(); return hh; });
  ms.begin(X);
  const cv = o.map((p) => new THREE.Vector2(p[0], p[1]));
  const hv = hs.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
  const faces = THREE.ShapeUtils.triangulateShape(cv, hv);
  const all = o.concat(...hs);
  const capFront = opts.front !== false, capBack = opts.back !== false;
  if (capFront) {
    const ids = all.map((p) => ms.v(p[0], p[1], z1, 0, 0, 1));
    for (const f of faces) ms.triN(ids[f[0]], ids[f[1]], ids[f[2]]);
  }
  if (capBack) {
    const ids = all.map((p) => ms.v(p[0], p[1], z0, 0, 0, -1));
    for (const f of faces) ms.triN(ids[f[0]], ids[f[1]], ids[f[2]]);
  }
  if (opts.sides !== false) {
    for (const loop of [o, ...hs]) {
      for (let i = 0; i < loop.length; i++) {
        const p = loop[i], q = loop[(i + 1) % loop.length];
        const dx = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dx, dy) || 1;
        const nx = dy / l, ny = -dx / l;
        const a = ms.v(p[0], p[1], z0, nx, ny, 0), b = ms.v(q[0], q[1], z0, nx, ny, 0);
        const c = ms.v(q[0], q[1], z1, nx, ny, 0), d = ms.v(p[0], p[1], z1, nx, ny, 0);
        ms.quadN(a, b, c, d);
      }
    }
  }
  ms.begin(null);
}

// Sweep a 2D profile [[u,v],...] along a path of 3D points. Frame: T tangent,
// U = up (per-point or global) orthogonalised, S = T x U. Profile u->S, v->U.
// opts.closed (profile loop), opts.smooth (shared normals), opts.caps.
export function sweep(ms, path, profile, opts = {}) {
  const N = path.length; if (N < 2) return;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(N - 1, i + 1)];
    const T = v3.norm(v3.sub(b, a));
    const up0 = opts.ups ? opts.ups[i] : (opts.up || [0, 1, 0]);
    let U = v3.sub(up0, v3.scale(T, v3.dot(up0, T)));
    if (v3.len(U) < 1e-5) U = [1, 0, 0];
    U = v3.norm(U);
    const S = v3.cross(T, U);
    frames.push({ T, U, S, p: path[i] });
  }
  const closed = !!opts.closed;
  const M = profile.length;
  const nseg = closed ? M : M - 1;
  ms.begin(opts.X || null);
  const at = (f, u, v) => [f.p[0] + f.S[0] * u + f.U[0] * v, f.p[1] + f.S[1] * u + f.U[1] * v, f.p[2] + f.S[2] * u + f.U[2] * v];
  const segN = [];
  for (let s = 0; s < nseg; s++) {
    const a = profile[s], b = profile[(s + 1) % M];
    const du = b[0] - a[0], dv = b[1] - a[1]; const l = Math.hypot(du, dv) || 1;
    segN.push([dv / l, -du / l]);
  }
  const flip = opts.flip ? -1 : 1;
  if (opts.smooth) {
    const pn = profile.map((_, i) => {
      let a = segN[i] || segN[i - 1]; let b = segN[i - 1] || segN[i];
      if (closed) { a = segN[i % nseg]; b = segN[(i - 1 + nseg) % nseg]; }
      return v3.norm([a[0] + b[0], a[1] + b[1], 0]);
    });
    const ids = frames.map((f) => profile.map((pp, i) => {
      const P = at(f, pp[0], pp[1]);
      const nn = v3.add(v3.scale(f.S, pn[i][0] * flip), v3.scale(f.U, pn[i][1] * flip));
      return ms.v(P[0], P[1], P[2], nn[0], nn[1], nn[2]);
    }));
    for (let i = 0; i < N - 1; i++) for (let s = 0; s < nseg; s++) {
      const s1 = (s + 1) % M;
      ms.quadN(ids[i][s], ids[i][s1], ids[i + 1][s1], ids[i + 1][s]);
    }
  } else {
    for (let s = 0; s < nseg; s++) {
      const a = profile[s], b = profile[(s + 1) % M];
      const ids = frames.map((f) => {
        const nn = v3.add(v3.scale(f.S, segN[s][0] * flip), v3.scale(f.U, segN[s][1] * flip));
        const P = at(f, a[0], a[1]), Q = at(f, b[0], b[1]);
        return [ms.v(P[0], P[1], P[2], nn[0], nn[1], nn[2]), ms.v(Q[0], Q[1], Q[2], nn[0], nn[1], nn[2])];
      });
      for (let i = 0; i < N - 1; i++) ms.quadN(ids[i][0], ids[i][1], ids[i + 1][1], ids[i + 1][0]);
    }
  }
  if (opts.caps && closed) {
    const pv = profile.map((p) => new THREE.Vector2(p[0], p[1]));
    const tri = THREE.ShapeUtils.triangulateShape(pv, []);
    for (const [fi, sgn] of [[0, -1], [N - 1, 1]]) {
      const f = frames[fi];
      const ids = profile.map((pp) => { const P = at(f, pp[0], pp[1]); return ms.v(P[0], P[1], P[2], f.T[0] * sgn, f.T[1] * sgn, f.T[2] * sgn); });
      for (const t of tri) ms.triN(ids[t[0]], ids[t[1]], ids[t[2]]);
    }
  }
  ms.begin(null);
}

// Flat quad (two triangles), normal oriented to `n`.
export function quadFlat(ms, a, b, c, d, n) {
  ms.begin(null);
  const i = [a, b, c, d].map((p) => ms.v(p[0], p[1], p[2], n[0], n[1], n[2]));
  ms.quadN(i[0], i[1], i[2], i[3]);
}

// Cylinder between two points (round bar).
export function bar(ms, p0, p1, r, seg = 10, caps = true, r1 = null) {
  const d = v3.sub(p1, p0); const L = v3.len(d); if (L < 1e-6) return;
  const ay = v3.scale(d, 1 / L);
  let ax = Math.abs(ay[1]) < 0.9 ? v3.norm(v3.cross(ay, [0, 1, 0])) : v3.norm(v3.cross(ay, [1, 0, 0]));
  const az = v3.cross(ax, ay);
  const rr = r1 ?? r;
  const prof = caps ? [[0, 0], [r, 0], [rr, L], [0, L]] : [[r, 0], [rr, L]];
  lathe(ms, basis(p0, ax, ay, az), prof, seg);
}

// Smooth step & misc
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Polyline helpers for 2D shapes
export function circlePts(cx, cy, r, n = 24, a0 = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
