// ---------------------------------------------------------------------------
// props-geo.js — procedural geometry kit for the props module.
// Everything accumulates into an indexed `Acc` with uniform attributes:
//   position, normal, aRel (vec4: u, v, faceW, faceH — face-local coords for
//   procedural relief), aTag (vec4: meaning depends on the material).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------- CPU noise (deterministic) ----------------
function h3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c000 = h3(xi, yi, zi, s), c100 = h3(xi + 1, yi, zi, s), c010 = h3(xi, yi + 1, zi, s), c110 = h3(xi + 1, yi + 1, zi, s);
  const c001 = h3(xi, yi, zi + 1, s), c101 = h3(xi + 1, yi, zi + 1, s), c011 = h3(xi, yi + 1, zi + 1, s), c111 = h3(xi + 1, yi + 1, zi + 1, s);
  return lerp(lerp(lerp(c000, c100, u), lerp(c010, c110, u), v), lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w) * 2 - 1;
}
export function fbm3(x, y, z, oct = 3, s = 0) {
  let a = 0.5, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise3(x * f, y * f, z * f, s + i * 31); n += a; a *= 0.5; f *= 2.07; }
  return sum / n;
}

const ZERO4 = [0, 0, 1, 1];
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------
export class Acc {
  constructor() { this.P = []; this.N = []; this.R = []; this.T = []; this.I = []; this.tag = [0, 0, 0, 0]; }
  get n() { return this.P.length / 3; }
  get tris() { return this.I.length / 3; }
  v(x, y, z, nx, ny, nz, rel = null, tag = null) {
    this.P.push(x, y, z); this.N.push(nx, ny, nz);
    const r = rel || ZERO4; this.R.push(r[0], r[1], r[2], r[3]);
    const t = tag || this.tag; this.T.push(t[0], t[1], t[2], t[3]);
    return this.n - 1;
  }
  // quad a-b-c-d around its perimeter; winding chosen so the face agrees with the vertex normals
  quad(a, b, c, d) {
    const P = this.P, N = this.N;
    const e1x = P[c * 3] - P[a * 3], e1y = P[c * 3 + 1] - P[a * 3 + 1], e1z = P[c * 3 + 2] - P[a * 3 + 2];
    const e2x = P[d * 3] - P[b * 3], e2y = P[d * 3 + 1] - P[b * 3 + 1], e2z = P[d * 3 + 2] - P[b * 3 + 2];
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    const nx = N[a * 3] + N[b * 3] + N[c * 3] + N[d * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1] + N[d * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2] + N[d * 3 + 2];
    if (fx * nx + fy * ny + fz * nz >= 0) this.I.push(a, b, c, a, c, d); else this.I.push(a, c, b, a, d, c);
  }
  tri(a, b, c) {
    const P = this.P, N = this.N;
    const e1x = P[b * 3] - P[a * 3], e1y = P[b * 3 + 1] - P[a * 3 + 1], e1z = P[b * 3 + 2] - P[a * 3 + 2];
    const e2x = P[c * 3] - P[a * 3], e2y = P[c * 3 + 1] - P[a * 3 + 1], e2z = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz >= 0) this.I.push(a, b, c); else this.I.push(a, c, b);
  }
  // Add a three.js geometry. relFn(localPos, localNormal, uv) -> [u,v,w,h] (evaluated BEFORE the matrix)
  addGeo(geo, m = null, tag = null, relFn = null) {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    const base = this.n;
    if (m) _m3.getNormalMatrix(m);
    const lp = new THREE.Vector3(), ln = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      lp.fromBufferAttribute(pos, i); ln.fromBufferAttribute(nor, i);
      const u = uv ? [uv.getX(i), uv.getY(i)] : [0, 0];
      const rel = relFn ? relFn(lp, ln, u) : [u[0], u[1], 1, 1];
      const tg = typeof tag === 'function' ? tag(lp, ln) : tag;
      _v.copy(lp); _n.copy(ln);
      if (m) { _v.applyMatrix4(m); _n.applyMatrix3(_m3).normalize(); }
      this.v(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, rel, tg);
    }
    const flip = m && m.determinant() < 0;
    const push = (a, b, c) => { if (flip) this.I.push(base + a, base + c, base + b); else this.I.push(base + a, base + b, base + c); };
    if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i += 3) push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)); }
    else for (let i = 0; i < pos.count; i += 3) push(i, i + 1, i + 2);
    return this;
  }
  // Append another accumulator with an optional matrix (tags/rel are kept, or overridden by tagFn)
  addAcc(o, m = null, tagFn = null) {
    const base = this.n;
    if (m) _m3.getNormalMatrix(m);
    for (let i = 0; i < o.n; i++) {
      _v.set(o.P[i * 3], o.P[i * 3 + 1], o.P[i * 3 + 2]); _n.set(o.N[i * 3], o.N[i * 3 + 1], o.N[i * 3 + 2]);
      if (m) { _v.applyMatrix4(m); _n.applyMatrix3(_m3).normalize(); }
      const tg = [o.T[i * 4], o.T[i * 4 + 1], o.T[i * 4 + 2], o.T[i * 4 + 3]];
      this.v(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, [o.R[i * 4], o.R[i * 4 + 1], o.R[i * 4 + 2], o.R[i * 4 + 3]], tagFn ? tagFn(tg) : tg);
    }
    const flip = m && m.determinant() < 0;
    for (let i = 0; i < o.I.length; i += 3) {
      if (flip) this.I.push(base + o.I[i], base + o.I[i + 2], base + o.I[i + 1]);
      else this.I.push(base + o.I[i], base + o.I[i + 1], base + o.I[i + 2]);
    }
    return this;
  }
  // Organic irregularity: displace vertices [from, to) with a smooth vector noise field (crack free).
  jitter(from, to, amp, freq, seed = 0, filter = null) {
    for (let i = from; i < to; i++) {
      const x = this.P[i * 3], y = this.P[i * 3 + 1], z = this.P[i * 3 + 2];
      if (filter && !filter(x, y, z, i)) continue;
      this.P[i * 3] += amp * fbm3(x * freq, y * freq, z * freq, 2, seed);
      this.P[i * 3 + 1] += amp * 0.6 * fbm3(x * freq + 17.3, y * freq, z * freq, 2, seed + 7);
      this.P[i * 3 + 2] += amp * fbm3(x * freq, y * freq + 9.1, z * freq, 2, seed + 13);
    }
  }
  setTag(from, to, k, val) { for (let i = from; i < to; i++) this.T[i * 4 + k] = val; }
  bounds() {
    const b = new THREE.Box3();
    for (let i = 0; i < this.n; i++) b.expandByPoint(_v.set(this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]));
    return b;
  }
  build({ smooth = false } = {}) {
    // sanitize normals: unit length, never zero/NaN (GLSL normalize(0) = NaN -> exploding vertices)
    const N = this.N;
    for (let i = 0; i < N.length; i += 3) {
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]);
      if (!(l > 1e-8)) { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; } else { N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    }
    for (let i = 0; i < this.P.length; i++) if (!Number.isFinite(this.P[i])) this.P[i] = 0;
    for (let i = 0; i < this.I.length; i++) if (!(this.I[i] >= 0 && this.I[i] < this.n)) throw new Error('Acc: bad index ' + this.I[i]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aRel', new THREE.Float32BufferAttribute(this.R, 4));
    g.setAttribute('aTag', new THREE.Float32BufferAttribute(this.T, 4));
    if (smooth) {
      // position-welded averaged normal: coincident vertices (hard edges) share it, so shader
      // displacement along it can never open cracks
      const map = new Map(), S = new Float32Array(N.length), P = this.P, q = 1e4;
      const key = (i) => `${Math.round(P[i * 3] * q)},${Math.round(P[i * 3 + 1] * q)},${Math.round(P[i * 3 + 2] * q)}`;
      for (let i = 0; i < this.n; i++) {
        const k = key(i); let a = map.get(k);
        if (!a) { a = [0, 0, 0]; map.set(k, a); }
        a[0] += N[i * 3]; a[1] += N[i * 3 + 1]; a[2] += N[i * 3 + 2];
      }
      for (let i = 0; i < this.n; i++) {
        const a = map.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
        S[i * 3] = a[0] / l; S[i * 3 + 1] = a[1] / l; S[i * 3 + 2] = a[2] / l;
      }
      g.setAttribute('aSmooth', new THREE.BufferAttribute(S, 3));
    }
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------------------
// Rounded regular polygon ring (apothem a, corner radius rc). Returns, per side,
// the list of perimeter points from the middle of the previous corner arc to the
// middle of the next one, with outward 2D normals and face-local u (0..1 over the
// straight part). Sides duplicate their shared corner-mid point (u seams).
// ---------------------------------------------------------------------------
export function polyRing(n, a, rc, rot = 0, sideSeg = 2, arcSeg = 2) {
  // NOTE: the point count must not depend on `a` (rings of one stack are stitched index-wise)
  rc = Math.min(rc, a * 0.92);
  if (rc < 1e-6) rc = 0;
  const ap = a - rc;
  const R = ap / Math.cos(Math.PI / n);
  const half = ap * Math.tan(Math.PI / n);
  const sideLen = 2 * half;
  const halfArc = rc * Math.PI / n;
  const us = sideLen > 1e-6 ? 1 / sideLen : 0;
  const sides = [];
  for (let i = 0; i < n; i++) {
    const th = rot + (i * TAU) / n;
    const a0 = th - Math.PI / n, a1 = th + Math.PI / n;
    const V0x = R * Math.cos(a0), V0z = R * Math.sin(a0), V1x = R * Math.cos(a1), V1z = R * Math.sin(a1);
    const pts = [];
    for (let k = 0; k < arcSeg; k++) {
      const psi = a0 + (Math.PI / n) * (k / arcSeg);
      const nx = Math.cos(psi), nz = Math.sin(psi);
      pts.push({ x: V0x + rc * nx, z: V0z + rc * nz, nx, nz, u: -halfArc * (1 - k / arcSeg) * us });
    }
    const nx = Math.cos(th), nz = Math.sin(th);
    for (let k = 0; k <= sideSeg; k++) {
      const s = k / sideSeg;
      pts.push({ x: lerp(V0x, V1x, s) + rc * nx, z: lerp(V0z, V1z, s) + rc * nz, nx, nz, u: s });
    }
    for (let k = 1; k <= arcSeg; k++) {
      const psi = th + (Math.PI / n) * (k / arcSeg);
      const cx = Math.cos(psi), cz = Math.sin(psi);
      pts.push({ x: V1x + rc * cx, z: V1z + rc * cz, nx: cx, nz: cz, u: 1 + halfArc * (k / arcSeg) * us });
    }
    sides.push(pts);
  }
  return { sides, w: Math.max(sideLen, 1e-4) };
}

// ---------------------------------------------------------------------------
// polyStack: a stack of rounded-polygon rings following a (apothem, y) profile
// (bottom -> top). Each segment is a band with its own normals (hard edges);
// profile point {s:true} smooths the normal with the previous band.
//   profile: [{a, y, s?, sub?, tag?}]   (tag of the start point applies to the band)
// ---------------------------------------------------------------------------
export function polyStack(acc, o) {
  const { n, rot = 0, rc = 0, sideSeg = 2, profile, tag = null, capBottom = false, m = null } = o;
  const arcSeg = o.arcSeg ?? (rc > 0 ? 2 : 0);
  const target = m ? new Acc() : acc;
  const from = target.n;
  const bands = [];
  for (let j = 0; j < profile.length - 1; j++) {
    const p0 = profile[j], p1 = profile[j + 1];
    const da = p1.a - p0.a, dy = p1.y - p0.y;
    const L = Math.hypot(da, dy) || 1e-6;
    bands.push({ nr: dy / L, ny: -da / L, p0, p1, len: L });
  }
  const avgN = (A, B) => { const r = A.nr + B.nr, y = A.ny + B.ny, l = Math.hypot(r, y) || 1; return { nr: r / l, ny: y / l }; };
  for (let j = 0; j < bands.length; j++) {
    const B = bands[j];
    if (B.len < 1e-6) continue;
    const n0 = B.p0.s && j > 0 ? avgN(bands[j - 1], B) : B;
    const n1 = B.p1.s && j < bands.length - 1 ? avgN(B, bands[j + 1]) : B;
    const sub = B.p0.sub || 1;
    const tg = B.p0.tag || tag;
    const rings = [];
    for (let k = 0; k <= sub; k++) {
      const t = k / sub;
      const a = lerp(B.p0.a, B.p1.a, t), y = lerp(B.p0.y, B.p1.y, t);
      let nr = lerp(n0.nr, n1.nr, t), ny = lerp(n0.ny, n1.ny, t); const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
      rings.push({ y, t, nr, ny, ring: polyRing(n, Math.max(a, 1e-5), rc, rot, sideSeg, arcSeg) });
    }
    for (let i = 0; i < n; i++) {
      const idx = rings.map((R) => R.ring.sides[i].map((pt) => target.v(pt.x, R.y, pt.z, pt.nx * R.nr, R.ny, pt.nz * R.nr, [pt.u, R.t, R.ring.w, B.len], tg)));
      for (let k = 0; k < idx.length - 1; k++) {
        if (idx[k].length !== idx[k + 1].length) throw new Error('polyStack: ring size mismatch');
        for (let q = 0; q < idx[k].length - 1; q++) target.quad(idx[k][q], idx[k][q + 1], idx[k + 1][q + 1], idx[k + 1][q]);
      }
    }
  }
  if (capBottom) {
    const p = profile[0];
    const ring = polyRing(n, p.a, rc, rot, sideSeg, arcSeg);
    const c = target.v(0, p.y, 0, 0, -1, 0, [0.5, 0.5, 1, 1], tag);
    for (const side of ring.sides) {
      const ids = side.map((pt) => target.v(pt.x, p.y, pt.z, 0, -1, 0, [0.5, 0.5, 1, 1], tag));
      for (let q = 0; q < ids.length - 1; q++) target.tri(c, ids[q], ids[q + 1]);
    }
  }
  if (m) acc.addAcc(target, m);
  return from;
}

// Chamfered step helper: returns profile points for a block of apothem a from y0 to y1
// with chamfer c on the top edge (and optional bottom chamfer cb). top inset: next band starts at aTop.
export function block(a, y0, y1, c = 0.01, cb = 0, tag = null, sub = 1) {
  const pts = [];
  if (cb > 0) { pts.push({ a: a - cb, y: y0, tag }); pts.push({ a, y: y0 + cb, tag, sub }); }
  else pts.push({ a, y: y0, tag, sub });
  pts.push({ a, y: y1 - c, tag });
  pts.push({ a: a - c, y: y1, tag });
  return pts;
}

// ---------------------------------------------------------------------------
// Grid surface -> BufferGeometry (indexed, smooth normals). fn(i, j) -> [x,y,z]
// wrapI: periodic in i (no seam).
// ---------------------------------------------------------------------------
export function gridGeo(ni, nj, fn, wrapI = false, flip = false) {
  const cols = wrapI ? ni : ni + 1;
  const pos = new Float32Array(cols * (nj + 1) * 3);
  const uv = new Float32Array(cols * (nj + 1) * 2);
  for (let j = 0; j <= nj; j++) for (let i = 0; i < cols; i++) {
    const p = fn(i, j); const k = j * cols + i;
    pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
    uv[k * 2] = i / ni; uv[k * 2 + 1] = j / nj;
  }
  const idx = [];
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
    const i1 = wrapI ? (i + 1) % ni : i + 1;
    const a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i1, d = (j + 1) * cols + i;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Resample a 2D polyline [[r,y],...] by arc length into `count` points; returns [{r,y,nr,ny,t}]
export function resampleProfile(profile, count) {
  const L = [0];
  for (let i = 1; i < profile.length; i++) L.push(L[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  const total = L[L.length - 1];
  const out = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const s = (k / (count - 1)) * total;
    while (seg < profile.length - 2 && L[seg + 1] < s) seg++;
    const t = (s - L[seg]) / Math.max(L[seg + 1] - L[seg], 1e-9);
    const r = lerp(profile[seg][0], profile[seg + 1][0], t), y = lerp(profile[seg][1], profile[seg + 1][1], t);
    out.push({ r, y, t: k / (count - 1) });
  }
  // profile normals (outward = (dy, -dr) going bottom->top)
  for (let k = 0; k < out.length; k++) {
    const a = out[Math.max(k - 1, 0)], b = out[Math.min(k + 1, out.length - 1)];
    const dr = b.r - a.r, dy = b.y - a.y, l = Math.hypot(dr, dy) || 1;
    out[k].nr = dy / l; out[k].ny = -dr / l;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lotus petal relief field. x = petal coordinate (petal centres at integers),
// tp = 0 (petal base) .. 1 (petal tip). Returns height 0..~1.15
// ---------------------------------------------------------------------------
export function petalField(x, tp, inner = true) {
  if (tp <= 0.0 || tp >= 1.0) return 0;
  const f = x - Math.round(x);
  const w = 0.49 * Math.pow(Math.sin(Math.PI * Math.pow(tp, 0.8)), 0.65);
  if (w <= 1e-4 || Math.abs(f) >= w) return 0;
  const q = f / w;
  const aq = Math.abs(q);
  const env = Math.pow(Math.sin(Math.PI * Math.min(tp * 0.92 + 0.08, 1)), 0.3);
  // soft dome + crisp raised outline rim + deeper groove at the very edge
  let h = (0.62 * Math.sqrt(1 - q * q) + 0.32 * sstep(0.6, 0.8, aq) * sstep(1.0, 0.86, aq)) * env;
  h *= sstep(1.0, 0.93, aq) * 0.85 + 0.15;
  if (inner) {
    // raised inner petal (double outline typical of carved stone lotus)
    const tpi = tp * 1.25 - 0.05;
    if (tpi > 0 && tpi < 1) {
      const wi = 0.3 * Math.pow(Math.sin(Math.PI * Math.pow(tpi, 0.8)), 0.65);
      const qi = Math.abs(f) / Math.max(wi, 1e-4);
      h += 0.22 * sstep(1.08, 0.86, qi);
    }
  }
  // gentle midrib
  h += 0.08 * Math.exp(-Math.pow(f / 0.035, 2)) * sstep(0.1, 0.6, tp);
  return h;
}

// Lotus petal band around the Y axis following profile [[r,y]...] (bottom -> top).
//   N petals, depth (m) of relief along the profile normal, dir: +1 tips at the top, -1 tips at the bottom,
//   rows2: second offset row, tipCurl: outward flick at the tip, rot: angular offset.
export function petalBand(acc, o) {
  const { profile, N = 12, depth = 0.03, dir = 1, rows2 = true, tipCurl = 0, rot = 0, tag = null, m = null } = o;
  const seg = o.seg || N * 10, rows = o.rows || 16;
  const S = resampleProfile(profile, rows + 1);
  const geo = gridGeo(seg, rows, (i, j) => {
    const th = rot + (i / seg) * TAU;
    const s = S[j];
    const tp = dir > 0 ? s.t : 1 - s.t;
    const x = (th / TAU) * N;
    const h1 = petalField(x, tp);
    const h2 = rows2 ? petalField(x + 0.5, tp * 1.18 - 0.18) * 0.82 : 0;
    const h = Math.max(h1, h2);
    let d = depth * h;
    const curl = tipCurl * sstep(0.72, 1.0, tp) * Math.min(h1 * 3, 1);
    const r = s.r + s.nr * d + curl;
    const y = s.y + s.ny * d - curl * 0.35 * dir;
    return [Math.cos(th) * r, y, Math.sin(th) * r];
  }, true);
  // orientation: our param goes CCW in (x,z) from +x towards +z, rows up; ensure outward normals
  fixOutward(geo);
  acc.addGeo(geo, m, tag, (p, nn, uv) => [uv[0], uv[1], 1, 1]);
  return acc;
}

// make sure normals of a closed-ish surface around the Y axis point away from the axis on average
export function fixOutward(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  let s = 0;
  for (let i = 0; i < p.count; i++) s += p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i);
  if (s < 0) {
    const ix = geo.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return geo;
}

// Lathe (around Y) from [[r,y]...] bottom->top. Smooth normals.
export function lathe(acc, profile, seg = 32, tag = null, m = null, relFn = null) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  const g = new THREE.LatheGeometry(pts, seg);
  acc.addGeo(g, m, tag, relFn);
  return acc;
}

// Lathe with a hard edge at every profile point flagged with a 3rd element `1`.
export function latheHard(acc, profile, seg = 32, tag = null, m = null) {
  let cur = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    cur.push(profile[i]);
    if (profile[i][2] === 1 || i === profile.length - 1) { if (cur.length > 1) lathe(acc, cur, seg, tag, m); cur = [profile[i]]; }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Tapered tube along points (Vector3[]), radius(t) function. Closed rounded ends.
// ---------------------------------------------------------------------------
export function taperTube(acc, points, radiusFn, { radial = 8, segs = null, tag = null, m = null, capStart = true, capEnd = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const ns = segs || Math.max(8, points.length * 3);
  const frames = curve.computeFrenetFrames(ns, false);
  const geoP = [], geoN = [];
  const rows = [];
  for (let i = 0; i <= ns; i++) {
    const t = i / ns;
    const P = curve.getPointAt(t);
    const r = radiusFn(t);
    const row = [];
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * TAU;
      const nx = frames.normals[i].x * Math.cos(a) + frames.binormals[i].x * Math.sin(a);
      const ny = frames.normals[i].y * Math.cos(a) + frames.binormals[i].y * Math.sin(a);
      const nz = frames.normals[i].z * Math.cos(a) + frames.binormals[i].z * Math.sin(a);
      row.push([P.x + nx * r, P.y + ny * r, P.z + nz * r, nx, ny, nz]);
    }
    rows.push({ P, T: frames.tangents[i], row });
  }
  const sub = new Acc();
  const ids = rows.map((R) => R.row.map((v) => sub.v(v[0], v[1], v[2], v[3], v[4], v[5], null, tag)));
  for (let i = 0; i < ns; i++) for (let k = 0; k < radial; k++) {
    const k1 = (k + 1) % radial;
    sub.quad(ids[i][k], ids[i][k1], ids[i + 1][k1], ids[i + 1][k]);
  }
  const cap = (R, sign, rr) => {
    const tip = R.P.clone().addScaledVector(R.T, sign * rr * 0.8);
    const c = sub.v(tip.x, tip.y, tip.z, R.T.x * sign, R.T.y * sign, R.T.z * sign, null, tag);
    const ring = R.row.map((v) => sub.v(v[0], v[1], v[2], v[3] * 0.5 + R.T.x * sign * 0.5, v[4] * 0.5 + R.T.y * sign * 0.5, v[5] * 0.5 + R.T.z * sign * 0.5, null, tag));
    for (let k = 0; k < radial; k++) sub.tri(c, ring[k], ring[(k + 1) % radial]);
  };
  if (capStart) cap(rows[0], -1, radiusFn(0));
  if (capEnd) cap(rows[ns], 1, radiusFn(1));
  acc.addAcc(sub, m, tag ? () => tag : null);
  return acc;
}

// Planar spiral scroll (warabi / fern curl). origin = start point, out = horizontal outward unit
// vector, R0 = initial radius, turns, shrink = final radius fraction.
export function scrollPoints(origin, out, R0, turns = 1.15, shrink = 0.35, steps = 28, startAng = -0.75 * Math.PI) {
  const up = new THREE.Vector3(0, 1, 0);
  const C = { x: 0, y: R0 * 1.0 };
  const pts = [];
  const total = turns * TAU;
  // start point at angle startAng on the initial circle
  const sx = C.x + R0 * Math.cos(startAng), sy = C.y + R0 * Math.sin(startAng);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const ang = startAng + f * total;
    const R = R0 * (1 - (1 - shrink) * f);
    const x = C.x + R * Math.cos(ang) - sx, y = C.y + R * Math.sin(ang) - sy;
    pts.push(origin.clone().addScaledVector(out, x).addScaledVector(up, y));
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Hipped polygonal roof cap (stone kasa / bronze lantern roof).
//  n, rot: polygon; A: eave apothem; knobA: apothem where the roof meets the knob;
//  yEave: top of the eave edge at mid-side; H: rise eave->knob; rise(t): 0..1 shape (t=0 knob, 1 eave);
//  thick: eave edge thickness; lift: corner up-turn; soffitA: apothem where the flat soffit ends;
//  ridge: {h, w} raised hips. Tags: tagTop, tagEdge, tagBottom.
// ---------------------------------------------------------------------------
export function roofCap(acc, o) {
  const { n, rot = 0, A, knobA, yEave, H, thick, lift = 0, soffitA, segS = 12, segT = 12, m = null } = o;
  const rise = o.rise || ((t) => Math.pow(1 - t, 1.6));
  const ridge = o.ridge || null;
  const liftFn = o.liftFn || ((s, t) => lift * Math.pow(Math.abs(s), 3.2) * Math.pow(t, 2.2));
  const cR = 1 / Math.cos(Math.PI / n);
  const sub = new Acc();
  const yTop = (s, t, halfW) => {
    let y = yEave + H * rise(t) + liftFn(s, t);
    if (ridge) {
      const dist = (1 - Math.abs(s)) * halfW; // metres from the hip line
      y += ridge.h * Math.exp(-Math.pow(dist / ridge.w, 2)) * (0.4 + 0.6 * t);
    }
    return y;
  };
  for (let i = 0; i < n; i++) {
    const th = rot + (i * TAU) / n;
    const a0 = th - Math.PI / n, a1 = th + Math.PI / n;
    const C0 = [Math.cos(a0) * cR, Math.sin(a0) * cR], C1 = [Math.cos(a1) * cR, Math.sin(a1) * cR];
    const pt = (s, apo) => { const f = (s + 1) / 2; return [lerp(C0[0], C1[0], f) * apo, lerp(C0[1], C1[1], f) * apo]; };
    const halfW = (t) => lerp(knobA, A, t) * Math.tan(Math.PI / n);
    // top surface
    const top = gridGeo(segS, segT, (ii, jj) => {
      const s = -1 + (2 * ii) / segS, t = jj / segT;
      const apo = lerp(knobA, A, t);
      const p = pt(s, apo);
      return [p[0], yTop(s, t, halfW(t)), p[1]];
    });
    orientUp(top, 1);
    sub.addGeo(top, null, o.tagTop, (p, nn, uv) => [uv[0], uv[1], A * 2 * Math.tan(Math.PI / n), A - knobA]);
    // eave edge band (3 rows: top, nose, bottom)
    const yB = (s) => yEave - thick + liftFn(s, 1) * 0.85;
    const edge = gridGeo(segS, 3, (ii, jj) => {
      const s = -1 + (2 * ii) / segS;
      const yt = yTop(s, 1, halfW(1)), yb = yB(s);
      const f = [0, 0.18, 0.7, 1][jj];
      const bulge = [0, 0.006, 0.004, -0.002][jj] * (A / 0.6);
      const p = pt(s, A + bulge);
      return [p[0], lerp(yt, yb, f), p[1]];
    });
    orientOut(edge, th);
    sub.addGeo(edge, null, o.tagEdge || o.tagTop, (p, nn, uv) => [uv[0], uv[1], A * 2 * Math.tan(Math.PI / n), thick]);
    // soffit (flat-ish underside)
    const bot = gridGeo(segS, 3, (ii, jj) => {
      const s = -1 + (2 * ii) / segS;
      const f = jj / 3;
      const apo = lerp(A - 0.002, soffitA, f);
      const p = pt(s, apo);
      const y = lerp(yB(s), yEave - thick, sstep(0, 0.8, f));
      return [p[0], y, p[1]];
    });
    orientUp(bot, -1);
    sub.addGeo(bot, null, o.tagBottom || o.tagTop, (p, nn, uv) => [uv[0], uv[1], 1, 1]);
  }
  acc.addAcc(sub, m);
  return {
    // world-ish helpers for placing hips/curls (in roof-local coords)
    corner: (k) => {
      const ang = rot + (k * TAU) / n + Math.PI / n;
      const s = 1; const y = yTop(s, 1, A * Math.tan(Math.PI / n));
      return { x: Math.cos(ang) * cR * A, y, z: Math.sin(ang) * cR * A, dir: new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)) };
    },
    hipPoint: (k, t) => {
      const ang = rot + (k * TAU) / n + Math.PI / n;
      const apo = lerp(knobA, A, t);
      const y = yTop(1, t, apo * Math.tan(Math.PI / n));
      return new THREE.Vector3(Math.cos(ang) * cR * apo, y, Math.sin(ang) * cR * apo);
    },
  };
}

function orientUp(geo, sign) {
  const n = geo.attributes.normal; let s = 0;
  for (let i = 0; i < n.count; i++) s += n.getY(i);
  if (s * sign < 0) flipGeo(geo);
}
function orientOut(geo, th) {
  const n = geo.attributes.normal; let s = 0; const cx = Math.cos(th), cz = Math.sin(th);
  for (let i = 0; i < n.count; i++) s += n.getX(i) * cx + n.getZ(i) * cz;
  if (s < 0) flipGeo(geo);
}
export function flipGeo(geo) {
  const ix = geo.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
}

// Extruded 2D shape (with holes) -> creased-normal geometry, optional bevel.
// NOTE: bevelOffset must stay 0 (negative offsets collapse small corner radii and break the cap
// triangulation). Callers pre-shrink outlines / pre-grow holes by `bevel` when exact sizes matter.
export function extrude(shape, depth, bevel = 0, curveSegments = 4, bevelSegments = 1) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * bevel, 1e-4), steps: 1, curveSegments,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments,
  });
  if (bevel > 0) g.translate(0, 0, bevel);
  g.deleteAttribute('uv');
  return toCreasedNormals(g, 0.6);
}

// Superellipse cross-section lathe (rounded-square bells). profile [[r,y]...], aspect z/x, exponent p.
export function superLathe(acc, profile, { seg = 24, p = 3.0, aspect = 1.0, tag = null, m = null, rows = null } = {}) {
  const S = rows ? resampleProfile(profile, rows + 1) : profile.map(([r, y], k) => ({ r, y, t: k / (profile.length - 1) }));
  const nj = S.length - 1;
  const geo = gridGeo(seg, nj, (i, j) => {
    const a = (i / seg) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    const k = 1 / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p);
    const r = S[j].r * k;
    return [c * r, S[j].y, s * r * aspect];
  }, true);
  fixOutward(geo);
  acc.addGeo(geo, m, tag, (pp, nn, uv) => [uv[0], uv[1], 1, 1]);
  return acc;
}

export function mat4(pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale);
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, s);
}

// basis matrix from axes (columns) + origin
export function basis(X, Y, Z, O) {
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(O);
}
