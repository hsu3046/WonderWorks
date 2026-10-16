// ---------------------------------------------------------------------------
// Lotus (Nelumbo nucifera) flower geometry: boat-shaped pointed petals in four
// whorls (5+6+6+6), flat-topped receptacle, a dense ring of stamens (filament +
// anther + pale appendage). One generator covers every stage through `open`:
//   0 = closed tear-drop bud, ~0.35 = goblet / half-open, 1 = fully open.
// Plus spent flowers (seed pod + a few hanging petals) and fallen petals.
// Vertex attribute aPart:
//   0 petal | 1 receptacle top | 2 receptacle side | 3 filament | 4 anther
//   8 pod top | 9 pod side | 10 withered (brown) | 11 anther appendage (cream)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// petal half-width profile along its length (u 0 base .. 1 tip): narrow claw,
// broad elliptic body widest a little above the middle, pointed tip
const PW = [[0, 0.16], [0.06, 0.32], [0.16, 0.57], [0.3, 0.82], [0.45, 0.96], [0.58, 1.0], [0.7, 0.95], [0.8, 0.83], [0.88, 0.63], [0.94, 0.4], [0.98, 0.17], [1, 0]];
function tab(T, u) {
  for (let k = 1; k < T.length; k++) {
    if (u <= T[k][0]) {
      const a = T[k - 1], b = T[k];
      const t = (u - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (0.5 * t + 0.5 * t * t * (3 - 2 * t));
    }
  }
  return T[T.length - 1][1];
}

export function newOut() { return { pos: [], uv: [], part: [], idx: [], sd: [], _sd: 0 }; }

// petal midrib in the local (y = along, z = toward the flower axis) plane
function centre(L, nu, bend, hood, curl) {
  const C = [], N = [];
  let y = 0, z = 0;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const th = bend * Math.pow(u, 1.25) + hood * Math.pow(sm(0.7, 1.0, u), 1.5) + curl * Math.pow(sm(0.5, 1.0, u), 2);
    C.push([y, z]); N.push([-Math.sin(th), Math.cos(th)]);
    y += Math.cos(th) * L / nu; z += Math.sin(th) * L / nu;
  }
  return { C, N };
}

// radial distance of the petal tip from the flower axis for a given pose
function tipRadial(L, tilt, bend, rb) {
  const { C } = centre(L, 20, bend, 0, 0);
  const [Y, Z] = C[20];
  return rb + Y * Math.sin(tilt) - Z * Math.cos(tilt);
}
// bend that brings the petal tip to `target` radius (closed bud)
function solveBend(L, tilt, rb, target) {
  let lo = -0.5, hi = 2.6;
  for (let k = 0; k < 32; k++) {
    const m = (lo + hi) / 2;
    if (tipRadial(L, tilt, m, rb) > target) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// One petal. Local frame: base at origin, grows along +Y, width along X, the
// concave (inner) side faces +Z. `mtx` places it on the flower.
export function petalInto(out, mtx, o) {
  const { L, W, cup = 0.5, bend = 0, hood = 0, curl = 0, nu = 14, nv = 8, part = 0, twist = 0, rip = 0, ph = 0, keel = 0, crumple = 0, seed = 0 } = o;
  const base = out.pos.length / 3;
  const { C, N } = centre(L, nu, bend, hood, curl);
  const v3 = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const w = Math.max(W * tab(PW, u), 0.0004);
    // boat-shaped: cupped along the whole length, spoon-like (hooded) toward the tip
    const cu = cup * (0.72 + 0.5 * sm(0.5, 0.97, u)) * (0.65 + 0.35 * sm(0.0, 0.22, u));
    const tw = twist * u;
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      const x = v * w * 0.5;
      const av = Math.abs(v);
      let zc = cu * v * v * w * 0.5;
      // slightly wavy margins
      zc += rip * W * av * av * av * Math.sin(u * 13 + ph + (v > 0 ? 1.7 : 0)) * sm(0.15, 0.6, u);
      // midrib keel (outer side ridge) and soft longitudinal pleats / crumples
      if (keel) zc -= keel * W * Math.exp(-v * v * 22) * sm(0.05, 0.5, u) * (1 - 0.6 * sm(0.85, 1.0, u));
      if (crumple) {
        zc += crumple * W * sm(0.1, 0.4, u) * (0.6 * Math.sin(v * 9.5 + u * 3.1 + seed * 7.3) * (0.4 + 0.6 * av) + 0.4 * Math.sin(u * 17 + v * 4.2 + seed * 3.1) * av * av);
      }
      const xr = x * Math.cos(tw) - zc * Math.sin(tw), zr = x * Math.sin(tw) + zc * Math.cos(tw);
      v3.set(xr, C[i][0] + N[i][0] * zr, C[i][1] + N[i][1] * zr).applyMatrix4(mtx);
      out.pos.push(v3.x, v3.y, v3.z); out.uv.push(u, v); out.part.push(part); out.sd.push(out._sd);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = base + i * row + j, b = a + 1, c = a + row, d = c + 1;
    out.idx.push(a, c, b, b, c, d);
  }
}

export function boxInto(out, mtx, w, h, d, part, uvU = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.applyMatrix4(mtx);
  const p = g.attributes.position;
  const base = out.pos.length / 3;
  for (let i = 0; i < p.count; i++) { out.pos.push(p.getX(i), p.getY(i), p.getZ(i)); out.uv.push(uvU, i / p.count); out.part.push(part); out.sd.push(out._sd); out.idx.push(base + i); }
  g.dispose();
}

export function latheInto(out, mtx, profile, seg, part) {
  const g = new THREE.LatheGeometry(profile.map(([rr, yy]) => new THREE.Vector2(Math.max(rr, 1e-4), yy)), seg);
  g.applyMatrix4(mtx);
  const p = g.attributes.position, uvA = g.attributes.uv;
  const base = out.pos.length / 3;
  for (let i = 0; i < p.count; i++) { out.pos.push(p.getX(i), p.getY(i), p.getZ(i)); out.uv.push(uvA.getX(i), uvA.getY(i)); out.part.push(part); out.sd.push(out._sd); }
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i++) out.idx.push(base + ix[i]);
  g.dispose();
}

export function finishGeo(out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(out.part, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(out.sd.length === out.part.length ? out.sd : new Array(out.part.length).fill(0), 1));
  g.setIndex(out.idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const _up = new THREE.Vector3(0, 1, 0);
// a straight segment (box) from point a along unit dir d with length len
function rodInto(out, a, d, len, w, t, part) {
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d);
  const c = a.clone().addScaledVector(d, len * 0.5);
  out._m.compose(c, q, new THREE.Vector3(1, 1, 1));
  boxInto(out, out._m, w, len, t, part, 0.5);
}

// Smooth closed tube (no seam duplicate -> round shading) along pts with per-point
// radii (rx across, ry along the second frame axis for flattened sections).
// `cap` closes the far end with a fan. uv.x runs 0..1 along the tube.
const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
function tubeInto(out, pts, rx, ry, sides, part, cap = false) {
  const base = out.pos.length / 3;
  const n = pts.length;
  let prevN = null;
  for (let i = 0; i < n; i++) {
    _t.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    if (prevN) _n.copy(prevN).addScaledVector(_t, -prevN.dot(_t)).normalize();
    else _n.crossVectors(_t, Math.abs(_t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : _up).normalize();
    prevN = _n.clone();
    _b.crossVectors(_t, _n).normalize();
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU;
      const c = Math.cos(a) * rx[i], s = Math.sin(a) * ry[i];
      const p = pts[i];
      out.pos.push(p.x + _n.x * c + _b.x * s, p.y + _n.y * c + _b.y * s, p.z + _n.z * c + _b.z * s);
      out.uv.push(i / (n - 1), j / sides); out.part.push(part); out.sd.push(out._sd);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
    const a = base + i * sides + j, b = base + i * sides + ((j + 1) % sides);
    const c = a + sides, d = b + sides;
    out.idx.push(a, c, b, b, c, d);
  }
  if (cap) {
    const p = pts[n - 1];
    const tipI = out.pos.length / 3;
    _t.subVectors(pts[n - 1], pts[n - 2]).normalize();
    const e = Math.max(rx[n - 1], ry[n - 1]) * 0.8;
    out.pos.push(p.x + _t.x * e, p.y + _t.y * e, p.z + _t.z * e); out.uv.push(1, 0); out.part.push(part); out.sd.push(out._sd);
    const r0 = base + (n - 1) * sides;
    for (let j = 0; j < sides; j++) out.idx.push(r0 + j, tipI, r0 + ((j + 1) % sides));
  }
}

// One stamen: slender filament arching out of the receptacle base, a long
// linear 4-locular anther (slightly flattened, gently curved) and the cream
// club-shaped connective appendage at its tip.
const _q0 = new THREE.Vector3(), _q1 = new THREE.Vector3();
function stamenInto(out, base, d1, d2, fl, an, S, r, macro = false) {
  // filament: gently arched (3 points) on macro flowers
  const fr = 0.00042 * S;
  if (macro) {
    const mid = base.clone().addScaledVector(d1, fl * 0.5).addScaledVector(d2, fl * 0.04);
    const fP3 = [base.clone(), mid, base.clone().addScaledVector(d1, fl)];
    tubeInto(out, fP3, [fr * 1.2, fr * 1.05, fr], [fr * 1.2, fr * 1.05, fr], 5, 3);
  }
  const fP = [base.clone(), base.clone().addScaledVector(d1, fl)];
  if (!macro) tubeInto(out, fP, [fr * 1.15, fr], [fr * 1.15, fr], 4, 3);
  // anther: quadratic arc from d1 toward d2
  const aP = [], ax = [], ay = [];
  const a0 = fP[1].clone().addScaledVector(d1, -fl * 0.04);
  const NA = macro ? 5 : 3;
  const w = (0.00092 + r.range(-0.0001, 0.00012)) * S;
  _q0.copy(a0);
  for (let i = 0; i <= NA; i++) {
    const u = i / NA;
    if (i > 0) {
      _q1.copy(d1).lerp(d2, u).normalize();
      _q0.addScaledVector(_q1, an / NA);
    }
    aP.push(_q0.clone());
    const prof = Math.min(1, 0.55 + u * 3.0) * (1 - 0.18 * u);
    ax.push(w * prof); ay.push(w * prof * 0.72);
  }
  tubeInto(out, aP, ax, ay, macro ? 7 : 5, 4);
  // appendage: short club, pale cream, rounded tip
  const tip = aP[NA], dir = _q1.subVectors(aP[NA], aP[NA - 1]).normalize().clone();
  const ap = [tip.clone().addScaledVector(dir, -an * 0.03), tip.clone().addScaledVector(dir, 0.0019 * S)];
  const cw = w * 0.85;
  tubeInto(out, ap, [cw * 0.72, cw], [cw * 0.72, cw], macro ? 6 : 4, 11, true);
}

// four whorls, outer -> inner. tB/tO: tilt from vertical when bud / open,
// bO/hO: midrib bend / tip hood when open, delay: inner whorls open later,
// tgt: tip radius of the closed bud (outer petals enclose the inner ones)
const WHORLS = [
  { n: 5, L: 0.084, W: 0.05, rb: 0.0122, y: -0.016, tB: 0.56, tO: 1.42, bO: -0.3, hO: 0.15, cup: 0.5, delay: 0.0, tgt: 0.0062 },
  { n: 6, L: 0.094, W: 0.058, rb: 0.0112, y: -0.0125, tB: 0.47, tO: 1.13, bO: -0.15, hO: 0.2, cup: 0.58, delay: 0.1, tgt: 0.0048 },
  { n: 6, L: 0.097, W: 0.06, rb: 0.0102, y: -0.009, tB: 0.38, tO: 0.86, bO: -0.03, hO: 0.2, cup: 0.64, delay: 0.2, tgt: 0.0034 },
  { n: 5, L: 0.09, W: 0.056, rb: 0.0092, y: -0.0055, tB: 0.29, tO: 0.56, bO: -0.02, hO: 0.16, cup: 0.7, delay: 0.3, tgt: 0.0022 },
];

// Nelumbo flower at any stage. `macro` = hero quality for 0.3-1 m close-ups:
// dense petal grids with a midrib keel and soft pleats, arched stamens,
// sculpted carpels (stigma nubs) on the receptacle, dew drops (part 13).
// Parts: 12 stigma nub, 13 water drop.
export function lotusFlower(r, { open = 1, hi = true, S = 1.3, petalScale = 1, macro = false, dew = 0 } = {}) {
  const out = newOut();
  out._m = new THREE.Matrix4();
  const m = out._m;
  const nu = macro ? 30 : hi ? 16 : 7, nv = macro ? 16 : hi ? 8 : 4;
  const rp = 0.0138 * S, hp = 0.022 * S;
  const showCentre = open > 0.18;
  // receptacle (obconical, flat top)
  if (showCentre) {
    const prof = macro
      ? [[0.0035 * S, -0.018 * S], [0.0048 * S, -0.015 * S], [0.0062 * S, -0.011 * S], [rp * 0.62, 0], [rp * 0.8, hp * 0.5], [rp * 0.93, hp * 0.8], [rp, hp * 0.93], [rp * 0.995, hp * 0.975], [rp * 0.96, hp], [rp * 0.75, hp + 0.0008 * S], [rp * 0.45, hp + 0.0013 * S], [0.0001, hp + 0.0015 * S]]
      : [[0.0035 * S, -0.018 * S], [0.0062 * S, -0.011 * S], [rp * 0.8, hp * 0.5], [rp, hp * 0.93], [rp * 0.985, hp], [rp * 0.55, hp + 0.0012 * S], [0.0001, hp + 0.0014 * S]];
    latheInto(out, m.identity(), prof, macro ? 48 : hi ? 22 : 10, 2);
    for (let i = 0; i < out.part.length; i++) if (out.pos[i * 3 + 1] > hp * 0.97) out.part[i] = 1;
    if (macro) {
      // carpels: stigma nubs sunk into the flat top, in rings
      const rings = [[0, 1], [0.34, 6], [0.6, 10], [0.84, 14]];
      for (const [rr, n] of rings) {
        const ph = r.range(0, TAU);
        for (let k = 0; k < n; k++) {
          const a = ph + (k / n) * TAU + r.range(-0.08, 0.08);
          const rad = rr * rp * r.range(0.96, 1.03);
          const yTop = hp + 0.0015 * S * (1 - Math.pow(rad / rp, 2)) - 0.0002 * S;
          const bs = r.range(0.85, 1.15);
          const w = 0.00125 * S * bs, hh = 0.0011 * S * bs;
          m.makeTranslation(Math.cos(a) * rad, yTop, Math.sin(a) * rad);
          latheInto(out, m, [[w * 1.18, -0.0004 * S], [w, 0.0], [w * 0.92, hh * 0.45], [w * 0.62, hh * 0.85], [w * 0.25, hh], [0.0001, hh * 1.02]], 10, 12);
        }
      }
      m.identity();
    }
    // stamens: dense ring around the receptacle base, arching outward
    const ns = macro ? 240 : hi ? 160 : 34;
    const so = sm(0.18, 1.0, open);
    const d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
    for (let k = 0; k < ns; k++) {
      const a = (k / ns) * TAU + r.range(-0.035, 0.035);
      const ring = r.range(0.0062, 0.0098) * S;
      const by = r.range(-0.011, -0.004) * S;
      const al = lerp(0.12, 0.72, so) + r.range(-0.22, 0.22) * (0.4 + 0.6 * so);
      const ca = Math.cos(a), sa = Math.sin(a);
      d1.set(ca * Math.sin(al), Math.cos(al), sa * Math.sin(al)).normalize();
      const al2 = al + r.range(0.12, 0.38) * so;
      d2.set(ca * Math.sin(al2), Math.cos(al2), sa * Math.sin(al2)).normalize();
      const fl = r.range(0.014, 0.019) * S, an = r.range(0.011, 0.015) * S;
      const base = new THREE.Vector3(ca * ring, by, sa * ring);
      if (hi) {
        out._sd = r.float();
        stamenInto(out, base, d1, d2, fl, an, S, r, macro);
        out._sd = 0;
      } else {
        rodInto(out, base, d1, fl, 0.0008 * S, 0.0008 * S, 3);
        const aBase = base.clone().addScaledVector(d1, fl * 0.97);
        rodInto(out, aBase, d2, an, 0.0021 * S, 0.0014 * S, 4);
      }
    }
    if (!hi) {
      // low-detail: a cone band reads as the stamen fringe at distance
      const t = so;
      latheInto(out, m.identity(), [[0.006 * S, -0.008 * S], [lerp(0.009, 0.02, t) * S, lerp(0.016, 0.01, t) * S], [lerp(0.0095, 0.022, t) * S, lerp(0.017, 0.011, t) * S]], 14, 4);
    }
  }
  // petals
  const qy = new THREE.Quaternion(), qt = new THREE.Quaternion(), qz = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const ph0 = r.range(0, TAU);
  const petalStart = out.pos.length / 3;
  WHORLS.forEach((wh, wi) => {
    const ow = Math.pow(THREE.MathUtils.clamp((open - wh.delay * (1 - open * 0.2)) / (1 - wh.delay), 0, 1), 0.85);
    for (let k = 0; k < wh.n; k++) {
      const a = ph0 + ((k + (wi % 2) * 0.5) / wh.n) * TAU + wi * 0.31 + r.range(-0.1, 0.1);
      const L = wh.L * S * petalScale * r.range(0.93, 1.06), W = wh.W * S * petalScale * r.range(0.9, 1.08);
      const rb = wh.rb * S;
      const tiltB = wh.tB + r.range(-0.03, 0.03);
      const bBud = solveBend(L, tiltB, rb, wh.tgt * S);
      // the macro flower is in full bloom: inner whorls spread to show the crown of stamens
      const tOx = macro ? [0.0, 0.05, 0.16, 0.26][wi] : 0;
      const tilt = lerp(tiltB, wh.tO + tOx + r.range(-0.1, 0.1) * (wi === 0 ? 1.4 : 1), ow);
      const bend = lerp(bBud, wh.bO + r.range(-0.08, 0.08), ow);
      const hood = lerp(0.0, wh.hO + r.range(-0.08, 0.08), ow);
      const pos = new THREE.Vector3(Math.cos(a) * rb, wh.y * S, Math.sin(a) * rb);
      qy.setFromAxisAngle(AY, -a - Math.PI / 2);
      qt.setFromAxisAngle(AX, -tilt);
      qz.setFromAxisAngle(AZ, r.range(-0.06, 0.06) * ow);
      m.compose(pos, qy.clone().multiply(qt).multiply(qz), new THREE.Vector3(1, 1, 1));
      // seed: whorl in the integer part (0..3), random fraction per petal
      out._sd = wi + r.range(0.02, 0.98);
      petalInto(out, m, {
        L, W, cup: lerp(0.95, wh.cup, ow) * r.range(0.9, 1.1), bend, hood, nu, nv, part: 0,
        twist: r.range(-0.12, 0.12) * ow, rip: r.range(0.02, 0.06) * ow * (macro ? 1.25 : 1), ph: r.range(0, TAU),
        keel: macro || hi ? r.range(0.025, 0.04) : 0, crumple: macro ? r.range(0.006, 0.012) : 0, seed: r.float(),
      });
      out._sd = 0;
    }
  });
  delete out._m;
  let g = finishGeo(out);
  if (dew > 0) g = addDew(g, r, dew, S, petalStart);
  return g;
}

// Dew: a few water drops resting on up-facing petal surfaces (part 13).
// uv of a drop = sphere-local (x, z) for shading; aSeed = drop radius.
function addDew(g, r, count, S, petalStart) {
  const P = g.attributes.position, Nn = g.attributes.normal, UV = g.attributes.uv, PA = g.attributes.aPart, SD = g.attributes.aSeed;
  const cand = [];
  for (let i = petalStart; i < P.count; i++) {
    if (PA.getX(i) > 0.5) continue;
    const u = UV.getX(i), v = UV.getY(i);
    if (u < 0.3 || u > 0.85 || Math.abs(v) > 0.55) continue;
    let ny = Nn.getY(i);
    if (ny < 0) ny = -ny;
    if (ny < 0.55) continue;
    cand.push(i);
  }
  if (!cand.length) return g;
  const sph = new THREE.IcosahedronGeometry(1, 3);
  const extra = [];
  const n = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), mm = new THREE.Matrix4();
  const used = [];
  for (let k = 0; k < count * 6 && extra.length < count; k++) {
    const i = cand[Math.floor(r.float() * cand.length)];
    p.fromBufferAttribute(P, i);
    if (used.some((o) => o.distanceTo(p) < 0.012 * S)) continue;
    n.fromBufferAttribute(Nn, i); if (n.y < 0) n.negate();
    const big = r.chance(0.3);
    const rd = (big ? r.range(0.0022, 0.0034) : r.range(0.0008, 0.0018)) * S;
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    mm.compose(p.clone().addScaledVector(n, rd * 0.42), q, new THREE.Vector3(rd, rd * 0.78, rd));
    const d = sph.clone().applyMatrix4(mm);
    const c = d.attributes.position.count;
    const uv = new Float32Array(c * 2), pa = new Float32Array(c).fill(13), sd = new Float32Array(c).fill(rd);
    const sp = sph.attributes.position;
    for (let j = 0; j < c; j++) { uv[j * 2] = sp.getX(j); uv[j * 2 + 1] = sp.getZ(j); }
    d.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    d.setAttribute('aPart', new THREE.BufferAttribute(pa, 1));
    d.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    // keep the icosphere's smooth normals (a recomputed non-indexed normal would facet the drop)
    extra.push(d);
    used.push(p.clone());
  }
  sph.dispose();
  if (!extra.length) return g;
  // petals keep their smooth indexed normals, drops their sphere normals
  const base = g.toNonIndexed();
  const all = [base, ...extra.map((e) => (e.index ? e.toNonIndexed() : e))];
  const merged = mergeGeometries(all, false);
  merged.computeBoundingSphere();
  g.dispose();
  return merged;
}

// Spent flower: enlarged green seed pod, a ring of withered stamens and a few
// petals still hanging on.
export function lotusSpent(r, { hi = true, S = 1.3, petalsLeft = 3, age = 0.5 } = {}) {
  const out = newOut();
  out._m = new THREE.Matrix4();
  const m = out._m;
  const rp = lerp(0.02, 0.03, age) * S, hp = lerp(0.026, 0.036, age) * S;
  latheInto(out, m.identity(), [[0.0042 * S, -0.03 * S], [0.008 * S, -0.02 * S], [rp * 0.7, hp * 0.45], [rp, hp * 0.92], [rp * 0.985, hp], [rp * 0.55, hp + 0.0018 * S], [0.0001, hp + 0.002 * S]], hi ? 22 : 12, 9);
  for (let i = 0; i < out.part.length; i++) if (out.pos[i * 3 + 1] > hp * 0.97) out.part[i] = 8;
  const d1 = new THREE.Vector3();
  const ns = hi ? 46 : 14;
  for (let k = 0; k < ns; k++) {
    const a = (k / ns) * TAU + r.range(-0.08, 0.08);
    const al = r.range(1.5, 2.6);
    d1.set(Math.cos(a) * Math.sin(al), Math.cos(al), Math.sin(a) * Math.sin(al)).normalize();
    rodInto(out, new THREE.Vector3(Math.cos(a) * 0.009 * S, -0.012 * S, Math.sin(a) * 0.009 * S), d1, r.range(0.012, 0.022) * S, 0.0012 * S, 0.0009 * S, 10);
  }
  const qy = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < petalsLeft; k++) {
    const a = (k / Math.max(petalsLeft, 1)) * TAU + r.range(-0.5, 0.5);
    const pos = new THREE.Vector3(Math.cos(a) * 0.011 * S, -0.018 * S, Math.sin(a) * 0.011 * S);
    qy.setFromAxisAngle(AY, -a - Math.PI / 2);
    qt.setFromAxisAngle(AX, -r.range(1.75, 2.5));
    m.compose(pos, qy.clone().multiply(qt), new THREE.Vector3(1, 1, 1));
    petalInto(out, m, { L: r.range(0.085, 0.1) * S, W: r.range(0.05, 0.06) * S, cup: 0.45, bend: r.range(-0.4, 0.1), hood: 0.1, nu: hi ? 12 : 6, nv: hi ? 6 : 3, part: 0, twist: r.range(-0.4, 0.4), rip: 0.06, ph: r.range(0, TAU) });
  }
  delete out._m;
  return finishGeo(out);
}

// A single fallen petal floating concave-side-up (origin at its centre)
export function fallenPetal(r, { S = 1.3 } = {}) {
  const out = newOut();
  const L = r.range(0.085, 0.1) * S;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.004, L * 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1));
  petalInto(out, m, { L, W: r.range(0.05, 0.062) * S, cup: 0.38, bend: 0.12, hood: 0.18, nu: 10, nv: 5, part: 0, twist: r.range(-0.2, 0.2), rip: 0.04, ph: r.range(0, TAU) });
  return finishGeo(out);
}
