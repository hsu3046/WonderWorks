// ---------------------------------------------------------------------------
// props-stone.js — kasuga-dōrō stone lanterns (3 variants), built once each and
// instanced. Local frame: base at y=0, front window faces +Z.
// Stone tag = [pattern, glowRecv, mossBias, fireY]; pattern 1 koza-ma, 2 flower panel, 3 bead frieze.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Acc, polyStack, petalBand, lathe, roofCap, taperTube, scrollPoints, extrude, basis, mat4, TAU, fbm3 } from './props-geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const T = (pat, glow, moss) => [pat, glow, moss, 0];

function roundedRectPath(path, w, h, r, cx = 0, cy = 0) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
  path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
  path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
  path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}
function circlePath(R, cx, cy, seg = 28) {
  const p = new THREE.Path();
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * TAU; const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; if (i === 0) p.moveTo(x, y); else p.lineTo(x, y); }
  return p;
}
function crescentPath(R, cx, cy, seg = 40) {
  // outer circle minus an offset inner circle
  const ox = R * 0.45, oy = R * 0.18, r2 = R * 0.86;
  const inside2 = (x, y) => (x - ox) * (x - ox) + (y - oy) * (y - oy) < r2 * r2;
  const pts = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * TAU; const x = Math.cos(a) * R, y = Math.sin(a) * R; if (!inside2(x, y)) pts.push([x, y, a]); }
  // order outer arc points contiguously
  let k = 0; for (let i = 1; i < pts.length; i++) if (pts[i][2] - pts[i - 1][2] > (TAU / seg) * 1.5) k = i;
  const outer = pts.slice(k).concat(pts.slice(0, k));
  const a0 = Math.atan2(outer[outer.length - 1][1] - oy, outer[outer.length - 1][0] - ox);
  const a1 = Math.atan2(outer[0][1] - oy, outer[0][0] - ox);
  let da = a1 - a0; while (da > 0) da -= TAU;
  const inner = [];
  for (let i = 1; i < seg / 2; i++) { const a = a0 + (da * i) / (seg / 2); inner.push([ox + Math.cos(a) * r2, oy + Math.sin(a) * r2]); }
  const p = new THREE.Path();
  const all = outer.map((q) => [q[0], q[1]]).concat(inner);
  all.forEach(([x, y], i) => { if (i === 0) p.moveTo(cx + x, cy + y); else p.lineTo(cx + x, cy + y); });
  p.lineTo(cx + all[0][0], cy + all[0][1]);
  return p;
}

// ---------------------------------------------------------------------------
// Fire box (hibukuro): panels with openings, corner posts, paper screens.
// faces[i]: 'win' | 'win2' | 'sun' | 'moon' | 'relief'
// ---------------------------------------------------------------------------
function fireBox(S, P, o) {
  const { n, rot, af, y0, y1, t = 0.045, faces, postW = 0.056, mossW = 0.22 } = o;
  const fw = 2 * af * Math.tan(Math.PI / n);
  const pw = fw - postW * 0.7;
  const ph = y1 - y0;
  const yc = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) {
    const th = rot + (i * TAU) / n;
    const N = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const Tn = new THREE.Vector3(Math.sin(th), 0, -Math.cos(th));
    const face = faces[i % faces.length];
    const bev = 0.0065;
    const shape = new THREE.Shape();
    roundedRectPath(shape, pw - 2 * bev, ph - 2 * bev, 0.003);
    const hw = pw * (n === 4 ? 0.70 : 0.62), hh = ph * 0.64, hcy = ph * 0.03;
    let paper = null;
    const deco = [];
    if (face === 'win') {
      shape.holes.push(roundedRectPath(new THREE.Path(), hw + 2 * bev, hh + 2 * bev, 0.012, 0, hcy));
      paper = { w: hw + 0.03, h: hh + 0.03, cy: hcy, style: 0 };
      deco.push({ type: 'frame', w: hw + 2 * bev, h: hh + 2 * bev, cy: hcy });
    } else if (face === 'win2') {
      const bw = Math.max(0.03, hw * 0.12);
      const sw = (hw - bw) / 2;
      shape.holes.push(roundedRectPath(new THREE.Path(), sw + 2 * bev, hh + 2 * bev, 0.01, -(bw / 2 + sw / 2), hcy));
      shape.holes.push(roundedRectPath(new THREE.Path(), sw + 2 * bev, hh + 2 * bev, 0.01, +(bw / 2 + sw / 2), hcy));
      paper = { w: hw + 0.03, h: hh + 0.03, cy: hcy, style: 1 };
      deco.push({ type: 'frame', w: hw + 2 * bev, h: hh + 2 * bev, cy: hcy });
    } else if (face === 'sun' || face === 'sunP') {
      const R = Math.min(pw, ph) * 0.27;
      shape.holes.push(circlePath(R + bev, 0, hcy, 40));
      if (face === 'sunP') paper = { w: 2 * R + 0.04, h: 2 * R + 0.04, cy: hcy, style: 2 };
      deco.push({ type: 'ring', R: R + bev + 0.013, cy: hcy });
    } else if (face === 'moon' || face === 'moonP') {
      const R = Math.min(pw, ph) * 0.29;
      shape.holes.push(crescentPath(R + bev, 0, hcy, 48));
      if (face === 'moonP') paper = { w: 2 * R + 0.04, h: 2 * R + 0.04, cy: hcy, style: 2 };
      deco.push({ type: 'ring', R: R + bev + 0.015, cy: hcy });
    }
    const g = extrude(shape, t, bev, 3, 1);
    const O = N.clone().multiplyScalar(af); O.y = yc;
    const M = basis(Tn, UP, N.clone().negate(), O);
    const relief = face === 'relief' ? 2 : 0;
    S.addGeo(g, M, (lp, ln) => [ln.z < -0.7 ? relief : 0, 1, mossW, 0], (lp) => [(lp.x + pw / 2) / pw, (lp.y + ph / 2) / ph, pw, ph]);
    for (const dc of deco) {
      if (dc.type === 'frame') {
        // raised, softly bevelled window surround + a projecting sill that catches moss
        const fw = 0.024, dz = 0.014;
        const fr = new THREE.Shape(); roundedRectPath(fr, dc.w + 2 * fw, dc.h + 2 * fw, 0.012, 0, dc.cy);
        fr.holes.push(roundedRectPath(new THREE.Path(), dc.w, dc.h, 0.01, 0, dc.cy));
        const fg = extrude(fr, dz, 0.004, 4, 2).translate(0, 0, -dz);
        S.addGeo(fg, M, [0, 1, mossW * 0.6, 0], (lp) => [(lp.x + pw / 2) / pw, (lp.y + ph / 2) / ph, pw, ph]);
        const sg = new RoundedBoxGeometry(dc.w + 2 * fw + 0.05, 0.022, 0.034, 2, 0.006);
        S.addGeo(sg, M.clone().multiply(mat4([0, dc.cy - dc.h / 2 - fw - 0.011, -0.017])), [0, 1, Math.max(mossW, 0.5) * 1.6, 0], null);
      } else if (dc.type === 'ring') {
        // carved raised ring around the sun / moon opening
        const rg = new THREE.TorusGeometry(dc.R, 0.0075, 10, 56).scale(1, 1, 0.8);
        S.addGeo(rg, M.clone().multiply(mat4([0, dc.cy, -0.001])), [0, 1, mossW * 0.5, 0], null);
      }
    }
    if (paper && paper.style < 2) {
      // kumiko: thin lattice bars standing on the paper, silhouetted against the glow
      const d = t + 0.016;
      const nx = paper.style === 1 ? 4 : 3;
      const bw = 0.0075, bd = 0.011;
      const zc = t + 0.0145 - bd * 0.5;  // just in front of the paper (local +z = inward)
      const pw2 = paper.w, ph2 = paper.h;
      const bars = [];
      for (let k = 1; k < nx; k++) {
        if (paper.style === 1 && k === 2) continue;   // the stone mullion is already there
        bars.push([-pw2 / 2 + (k / nx) * pw2, paper.cy, bw, ph2]);
      }
      for (let k = 1; k < 4; k++) bars.push([0, paper.cy - ph2 / 2 + (k / 4) * ph2, pw2, bw]);
      for (const [bx, by, sw, sh] of bars) {
        const bg = new THREE.BoxGeometry(sw, sh, bd);
        S.addGeo(bg, M.clone().multiply(mat4([bx, by, zc])), [5, 0, 0, 0], null);
      }
      void d;
    }
    if (paper) {
      const d = t + (paper.style === 2 ? 0.026 : 0.016);
      const C = N.clone().multiplyScalar(af - d); C.y = yc + paper.cy;
      const ids = [];
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const p = C.clone().addScaledVector(Tn, (u - 0.5) * paper.w).addScaledVector(UP, (v - 0.5) * paper.h);
        // tag: style, paper centre height above the candle flame, depth from the paper to the axis
        ids.push(P.v(p.x, p.y, p.z, N.x, N.y, N.z, [u, v, paper.w, paper.h], [paper.style, hh * 0.2, af - d, 0]));
      }
      P.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }
  // the candle itself (seen directly through the sun / moon openings); rides in the
  // paper mesh: tag.x 3 = flame (rel.y = 0 base .. 1 tip), 4 = candle wax
  {
    const fy = yc - 0.098 * ph, fh = 0.034;
    const yb = y0 + 0.002, yt = fy - fh * 0.82;
    if (yt - yb > 0.02) {
      const cg = new THREE.CylinderGeometry(0.017, 0.018, yt - yb, 12, 1, false);
      P.addGeo(cg, mat4([0, (yb + yt) / 2, 0]), [4, 0, 0, 0], (lp) => [0, (lp.y + (yt - yb) / 2) / (yt - yb), 0, 0]);
    }
    const prof = [[0.0, -fh], [0.006, -fh * 0.92], [0.0105, -fh * 0.6], [0.011, -fh * 0.25], [0.0085, fh * 0.2], [0.005, fh * 0.6], [0.0018, fh * 0.9], [0.0, fh]];
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 10);
    P.addGeo(lg, mat4([0, fy, 0]), [3, 0, 0, 0], (lp) => [0, (lp.y + fh) / (2 * fh), 0, 0]);
  }
  // corner posts
  const Rc = af / Math.cos(Math.PI / n);
  for (let i = 0; i < n; i++) {
    const ang = rot + (i * TAU) / n + Math.PI / n;
    const D = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const Tg = new THREE.Vector3(Math.sin(ang), 0, -Math.cos(ang));
    const depth = n === 4 ? 0.06 : 0.05;
    const g = new RoundedBoxGeometry(postW, ph + 0.004, depth, 3, 0.011);
    const O = D.clone().multiplyScalar(Rc - depth * 0.5 - (n === 4 ? 0.012 : 0.004)); O.y = yc;
    const MB = basis(Tg, UP, D, O);
    S.addGeo(g, MB, T(0, 1, mossW), null);
    // carved collars (capital + base ring) on each post
    const cg = new RoundedBoxGeometry(postW + 0.014, 0.024, depth + 0.012, 2, 0.006);
    for (const sy of [-1, 1]) S.addGeo(cg, MB.clone().multiply(mat4([0, sy * (ph / 2 - 0.016), 0.003])), T(0, 0, mossW * 1.4), null);
    const cg2 = new RoundedBoxGeometry(postW + 0.006, 0.009, depth + 0.005, 1, 0.003);
    for (const sy of [-1, 1]) S.addGeo(cg2, MB.clone().multiply(mat4([0, sy * (ph / 2 - 0.042), 0.001])), T(0, 0, mossW), null);
  }
}

// Warabite: fern-curl scrolls on the roof corners
function curls(S, roof, n, { R0 = 0.036, t0 = 0.86, moss = 0.6 } = {}) {
  for (let k = 0; k < n; k++) {
    const c = roof.corner(k);
    const start = roof.hipPoint(k, t0);
    start.y -= R0 * 0.55;
    const pts = scrollPoints(start, c.dir, R0, 0.95, 0.42, 22);
    taperTube(S, pts, (t) => R0 * (0.78 - 0.42 * t) * (1 + 0.18 * Math.sin(Math.PI * Math.min(t * 1.6, 1))), { radial: 9, segs: 26, tag: T(0, 0, moss) });
  }
}

function hoju(S, y, s = 1, moss = 0.5) {
  // small upward lotus + onion jewel
  petalBand(S, { profile: [[0.06 * s, y], [0.085 * s, y + 0.012 * s], [0.11 * s, y + 0.035 * s], [0.12 * s, y + 0.055 * s]], N: 8, depth: 0.011 * s, dir: 1, rows2: true, tipCurl: 0.004 * s, seg: 80, rows: 10, tag: T(0, 0, moss) });
  const yb = y + 0.035 * s;
  lathe(S, [[0.0, yb], [0.06 * s, yb + 0.004 * s], [0.082 * s, yb + 0.022 * s], [0.096 * s, yb + 0.05 * s], [0.098 * s, yb + 0.072 * s],
    [0.09 * s, yb + 0.1 * s], [0.07 * s, yb + 0.13 * s], [0.042 * s, yb + 0.162 * s], [0.018 * s, yb + 0.188 * s], [0.004 * s, yb + 0.205 * s], [0.0, yb + 0.21 * s]], 32, T(0, 0, moss));
  return yb + 0.21 * s;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------
export function buildStoneLantern(kind) {
  const S = new Acc(), P = new Acc();
  let fireY = 1.0, top = 2.6;
  if (kind === 'A') ({ fireY, top } = variantA(S, P));
  else if (kind === 'B') ({ fireY, top } = variantB(S, P));
  else ({ fireY, top } = variantC(S, P));
  // hand-carved irregularity (vector noise; crack free) — stone only
  S.jitter(0, S.n, 0.0045, 3.1, kind.charCodeAt(0));
  S.jitter(0, S.n, 0.0018, 13.0, kind.charCodeAt(0) + 9);
  const _n0 = S.tris; const MT = mossTufts(S, kind.charCodeAt(0) * 7 + 3, kind === 'B' ? 0.8 : 0.6); S.addAcc(MT);
  if (typeof process !== 'undefined' && process.env.PROPSDBG) console.log('tufts', kind, MT.tris, 'stone tris before', _n0);
  S.setTag(0, S.n, 3, fireY);
  return { stone: S, paper: P, fireY, height: top };
}

// Classic hexagonal kasuga: round sao with fushi, lotus chudai, sun & moon openings
function variantA(S, P) {
  const n = 6, rot = Math.PI / 2;
  // plinth (two steps)
  polyStack(S, { n, rot, rc: 0.012, sideSeg: 4, profile: [
    { a: 0.60, y: 0.0, tag: T(0, 0, 0.55), sub: 2 }, { a: 0.60, y: 0.104 }, { a: 0.586, y: 0.12, tag: T(0, 0, 1.0) },
    { a: 0.52, y: 0.12, tag: T(0, 0, 0.55), sub: 2 }, { a: 0.52, y: 0.204 }, { a: 0.506, y: 0.22, tag: T(0, 0, 1.0) }, { a: 0.40, y: 0.22 },
  ] });
  // kiso: koza-ma panels + lip
  polyStack(S, { n, rot, rc: 0.008, sideSeg: 4, profile: [
    { a: 0.44, y: 0.22, tag: T(1, 0, 0.45), sub: 2 }, { a: 0.44, y: 0.385 }, { a: 0.452, y: 0.392, tag: T(0, 0, 0.5) }, { a: 0.452, y: 0.412 },
    { a: 0.44, y: 0.42, tag: T(0, 0, 1.0) }, { a: 0.36, y: 0.42 },
  ] });
  // kaeribana (down-turned lotus)
  petalBand(S, { profile: [[0.415, 0.418], [0.422, 0.436], [0.41, 0.475], [0.365, 0.525], [0.29, 0.56], [0.2, 0.578]], N: 10, depth: 0.044, dir: -1, tipCurl: 0.014, seg: 110, rows: 14, tag: T(0, 0, 0.42) });
  lathe(S, [[0.19, 0.574], [0.205, 0.585], [0.205, 0.6], [0.19, 0.612], [0.17, 0.614]], 40, T(0, 0, 0.8));
  // sao with fushi rings
  lathe(S, [[0.17, 0.612], [0.168, 0.626], [0.152, 0.642], [0.141, 0.664], [0.137, 0.72], [0.133, 0.9], [0.13, 1.02],
    [0.14, 1.026], [0.149, 1.036], [0.149, 1.046], [0.139, 1.056], [0.134, 1.06], [0.146, 1.066], [0.155, 1.077], [0.155, 1.092], [0.146, 1.102], [0.134, 1.107],
    [0.139, 1.112], [0.149, 1.122], [0.149, 1.132], [0.14, 1.142], [0.128, 1.148], [0.124, 1.25], [0.121, 1.40], [0.123, 1.44], [0.133, 1.462], [0.148, 1.475], [0.16, 1.486], [0.165, 1.5]], 44, T(0, 0, 0.22));
  // chudai: upward lotus then hex block with koza-ma
  petalBand(S, { profile: [[0.16, 1.495], [0.2, 1.507], [0.27, 1.532], [0.33, 1.566], [0.37, 1.605], [0.388, 1.636]], N: 12, depth: 0.034, dir: 1, tipCurl: 0.016, seg: 120, rows: 13, tag: T(0, 0, 0.5) });
  polyStack(S, { n, rot, rc: 0.008, sideSeg: 4, profile: [
    { a: 0.30, y: 1.636, tag: T(0, 0, 0.1) }, { a: 0.40, y: 1.636, tag: T(4, 0, 0.4), sub: 2 }, { a: 0.40, y: 1.77 }, { a: 0.388, y: 1.782, tag: T(0, 0, 0.9) },
    { a: 0.345, y: 1.782, tag: T(0, 0, 0.45) }, { a: 0.345, y: 1.80 }, { a: 0.333, y: 1.81, tag: T(0, 0, 0.8) }, { a: 0.27, y: 1.81 },
  ] });
  // fire box
  const y0 = 1.81, y1 = 2.245;
  polyStack(S, { n, rot, rc: 0.006, sideSeg: 2, profile: [
    { a: 0.272, y: y0, tag: T(0, 0, 0.35) }, { a: 0.272, y: y0 + 0.035 }, { a: 0.262, y: y0 + 0.04, tag: T(0, 1, 0.4) }, { a: 0.0, y: y0 + 0.04 },
  ] });
  fireBox(S, P, { n, rot, af: 0.255, y0: y0 + 0.04, y1: y1 - 0.05, faces: ['win', 'moon', 'relief', 'win', 'relief', 'sun'] });
  polyStack(S, { n, rot, rc: 0.006, sideSeg: 2, profile: [
    { a: 0.0, y: y1 - 0.05, tag: T(0, 1, 0) }, { a: 0.262, y: y1 - 0.05, tag: T(0, 0, 0.3) }, { a: 0.274, y: y1 - 0.044, tag: T(3, 0, 0.3) }, { a: 0.274, y: y1 - 0.004, tag: T(0, 0, 0.3) },
    { a: 0.31, y: y1, tag: T(0, 0, 0.3) }, { a: 0.31, y: y1 + 0.02 }, { a: 0.35, y: y1 + 0.025 }, { a: 0.35, y: y1 + 0.04 },
  ] });
  // kasa
  const thA = 0.094; // chunky granite kasa
  const yE = y1 + 0.04 + thA;
  const roof = roofCap(S, { n, rot, A: 0.58, knobA: 0.12, yEave: yE, H: 0.205, thick: thA, lift: 0.055, soffitA: 0.34, segS: 16, segT: 14,
    rise: (t) => Math.pow(1 - t, 1.45), ridge: { h: 0.012, w: 0.022 }, tagTop: T(0, 0, 0.82), tagEdge: T(0, 0, 0.55), tagBottom: T(0, 0, 0.05) });
  curls(S, roof, n, { R0: 0.034, t0: 0.87 });
  const yk = yE + 0.205;
  lathe(S, [[0.0, yk - 0.03], [0.142, yk - 0.03], [0.144, yk - 0.005], [0.136, yk + 0.02], [0.12, yk + 0.034], [0.1, yk + 0.04], [0.0, yk + 0.04]], 40, T(0, 0, 0.9));
  const top = hoju(S, yk + 0.034, 1.0, 0.6);
  return { fireY: (y0 + y1) / 2 + 0.01, top };
}

// Square lantern with carved shaft and two-tier crown (the hero pair)
function variantB(S, P) {
  const n6 = 6, r6 = Math.PI / 2;
  const n = 4, rot = Math.PI / 2;
  polyStack(S, { n: n6, rot: r6, rc: 0.012, sideSeg: 4, profile: [
    { a: 0.56, y: 0.0, tag: T(0, 0, 0.55), sub: 2 }, { a: 0.56, y: 0.10 }, { a: 0.545, y: 0.115, tag: T(0, 0, 1.0) },
    { a: 0.48, y: 0.115, tag: T(0, 0, 0.55), sub: 2 }, { a: 0.48, y: 0.19 }, { a: 0.466, y: 0.205, tag: T(0, 0, 1.0) }, { a: 0.37, y: 0.205 },
  ] });
  polyStack(S, { n: n6, rot: r6, rc: 0.008, sideSeg: 4, profile: [
    { a: 0.405, y: 0.205, tag: T(1, 0, 0.45), sub: 2 }, { a: 0.405, y: 0.355 }, { a: 0.418, y: 0.362, tag: T(0, 0, 0.5) }, { a: 0.418, y: 0.38 },
    { a: 0.405, y: 0.388, tag: T(0, 0, 1.0) }, { a: 0.33, y: 0.388 },
  ] });
  petalBand(S, { profile: [[0.385, 0.386], [0.392, 0.402], [0.38, 0.44], [0.335, 0.49], [0.26, 0.522], [0.18, 0.538]], N: 10, depth: 0.044, dir: -1, tipCurl: 0.014, seg: 110, rows: 14, tag: T(0, 0, 0.42) });
  // square shaft: base moulding, carved faces, capital
  polyStack(S, { n, rot, rc: 0.014, sideSeg: 4, profile: [
    { a: 0.0, y: 0.532, tag: T(0, 0, 0.6) }, { a: 0.175, y: 0.532, tag: T(0, 0, 0.5) }, { a: 0.175, y: 0.565 }, { a: 0.163, y: 0.575, tag: T(0, 0, 0.8) },
    { a: 0.148, y: 0.575, tag: T(2, 0, 0.25), sub: 3 }, { a: 0.138, y: 1.17, tag: T(0, 0, 0.6) }, { a: 0.16, y: 1.17, tag: T(0, 0, 0.4) }, { a: 0.16, y: 1.205 }, { a: 0.172, y: 1.212 }, { a: 0.172, y: 1.232 }, { a: 0.0, y: 1.232 },
  ] });
  petalBand(S, { profile: [[0.15, 1.228], [0.2, 1.24], [0.28, 1.265], [0.345, 1.30], [0.385, 1.34], [0.398, 1.365]], N: 12, depth: 0.036, dir: 1, tipCurl: 0.016, seg: 120, rows: 13, tag: T(0, 0, 0.5) });
  polyStack(S, { n, rot, rc: 0.01, sideSeg: 4, profile: [
    { a: 0.3, y: 1.365, tag: T(0, 0, 0.1) }, { a: 0.405, y: 1.365, tag: T(4, 0, 0.4), sub: 2 }, { a: 0.405, y: 1.505 }, { a: 0.392, y: 1.516, tag: T(0, 0, 0.9) },
    { a: 0.36, y: 1.516, tag: T(0, 0, 0.45) }, { a: 0.36, y: 1.535 }, { a: 0.348, y: 1.545, tag: T(0, 0, 0.8) }, { a: 0.3, y: 1.545 },
  ] });
  // large fire box (nearly as wide as the chudai, big glowing two-pane windows)
  const y0 = 1.545, y1 = 2.075;
  polyStack(S, { n, rot, rc: 0.008, sideSeg: 2, profile: [
    { a: 0.322, y: y0, tag: T(0, 0, 0.35) }, { a: 0.322, y: y0 + 0.032 }, { a: 0.312, y: y0 + 0.04, tag: T(0, 1, 0.4) }, { a: 0.0, y: y0 + 0.04 },
  ] });
  fireBox(S, P, { n, rot, af: 0.3, y0: y0 + 0.04, y1: y1 - 0.055, t: 0.05, faces: ['win2', 'sunP', 'win2', 'moonP'], postW: 0.075 });
  polyStack(S, { n, rot, rc: 0.008, sideSeg: 2, profile: [
    { a: 0.0, y: y1 - 0.055, tag: T(0, 1, 0) }, { a: 0.312, y: y1 - 0.055, tag: T(0, 0, 0.3) }, { a: 0.326, y: y1 - 0.048, tag: T(3, 0, 0.3) }, { a: 0.326, y: y1 - 0.004, tag: T(0, 0, 0.3) },
    { a: 0.36, y: y1, tag: T(0, 0, 0.3) }, { a: 0.36, y: y1 + 0.024 }, { a: 0.405, y: y1 + 0.03 }, { a: 0.405, y: y1 + 0.046 },
  ] });
  const thB = 0.108;
  const yE = y1 + 0.046 + thB;
  const roof = roofCap(S, { n, rot, A: 0.62, knobA: 0.14, yEave: yE, H: 0.22, thick: thB, lift: 0.095, soffitA: 0.395, segS: 18, segT: 14,
    rise: (t) => Math.pow(1 - t, 1.55), ridge: { h: 0.016, w: 0.026 }, tagTop: T(0, 0, 0.5), tagEdge: T(0, 0, 0.55), tagBottom: T(0, 0, 0.05) });
  curls(S, roof, n, { R0: 0.045, t0: 0.88 });
  const yk = yE + 0.22;
  // neck + second (small hexagonal) roof
  polyStack(S, { n, rot, rc: 0.01, sideSeg: 2, profile: [
    { a: 0.0, y: yk - 0.03, tag: T(0, 0, 0.9) }, { a: 0.15, y: yk - 0.03 }, { a: 0.15, y: yk + 0.01 }, { a: 0.14, y: yk + 0.02, tag: T(0, 0, 0.9) },
    { a: 0.11, y: yk + 0.02, tag: T(0, 0, 0.4) }, { a: 0.11, y: yk + 0.075 }, { a: 0.15, y: yk + 0.08, tag: T(0, 0, 0.3) }, { a: 0.15, y: yk + 0.095 },
  ] });
  const yE2 = yk + 0.095 + 0.04;
  const roof2 = roofCap(S, { n: n6, rot: r6, A: 0.25, knobA: 0.06, yEave: yE2, H: 0.11, thick: 0.04, lift: 0.03, soffitA: 0.14, segS: 10, segT: 10,
    rise: (t) => Math.pow(1 - t, 1.4), ridge: { h: 0.008, w: 0.014 }, tagTop: T(0, 0, 1.0), tagEdge: T(0, 0, 0.5), tagBottom: T(0, 0, 0.05) });
  curls(S, roof2, n6, { R0: 0.018, t0: 0.84 });
  const yk2 = yE2 + 0.11;
  lathe(S, [[0.0, yk2 - 0.02], [0.075, yk2 - 0.02], [0.076, yk2], [0.068, yk2 + 0.015], [0.0, yk2 + 0.018]], 32, T(0, 0, 0.9));
  const top = hoju(S, yk2 + 0.012, 0.72, 0.6);
  return { fireY: (y0 + y1) / 2 + 0.01, top };
}

// Stocky hexagonal shore lantern with hexagonal shaft and bold roof
function variantC(S, P) {
  const n = 6, rot = Math.PI / 2;
  polyStack(S, { n, rot, rc: 0.014, sideSeg: 4, profile: [
    { a: 0.47, y: 0.0, tag: T(0, 0, 0.6), sub: 2 }, { a: 0.47, y: 0.095 }, { a: 0.455, y: 0.11, tag: T(0, 0, 1.0) }, { a: 0.33, y: 0.11 },
  ] });
  polyStack(S, { n, rot, rc: 0.008, sideSeg: 4, profile: [
    { a: 0.36, y: 0.11, tag: T(1, 0, 0.5), sub: 2 }, { a: 0.36, y: 0.255 }, { a: 0.348, y: 0.265, tag: T(0, 0, 1.0) }, { a: 0.29, y: 0.265 },
  ] });
  petalBand(S, { profile: [[0.33, 0.262], [0.336, 0.276], [0.322, 0.31], [0.28, 0.35], [0.21, 0.375], [0.15, 0.388]], N: 9, depth: 0.036, dir: -1, tipCurl: 0.012, seg: 99, rows: 13, tag: T(0, 0, 0.42) });
  polyStack(S, { n, rot, rc: 0.01, sideSeg: 2, profile: [
    { a: 0.0, y: 0.384, tag: T(0, 0, 0.7) }, { a: 0.14, y: 0.384, tag: T(0, 0, 0.5) }, { a: 0.14, y: 0.41 }, { a: 0.125, y: 0.42, tag: T(0, 0, 0.7) },
    { a: 0.112, y: 0.42, tag: T(0, 0, 0.25), sub: 3 }, { a: 0.106, y: 0.96, tag: T(0, 0, 0.5) }, { a: 0.125, y: 0.962, tag: T(0, 0, 0.4) }, { a: 0.125, y: 0.99 }, { a: 0.0, y: 0.99 },
  ] });
  petalBand(S, { profile: [[0.12, 0.985], [0.16, 0.995], [0.22, 1.018], [0.27, 1.05], [0.3, 1.085], [0.312, 1.105]], N: 10, depth: 0.03, dir: 1, tipCurl: 0.014, seg: 100, rows: 12, tag: T(0, 0, 0.5) });
  polyStack(S, { n, rot, rc: 0.008, sideSeg: 4, profile: [
    { a: 0.24, y: 1.105, tag: T(0, 0, 0.1) }, { a: 0.325, y: 1.105, tag: T(1, 0, 0.4), sub: 2 }, { a: 0.325, y: 1.215 }, { a: 0.313, y: 1.226, tag: T(0, 0, 0.9) },
    { a: 0.27, y: 1.226, tag: T(0, 0, 0.45) }, { a: 0.27, y: 1.24 }, { a: 0.26, y: 1.248, tag: T(0, 0, 0.8) }, { a: 0.2, y: 1.248 },
  ] });
  const y0 = 1.248, y1 = 1.63;
  polyStack(S, { n, rot, rc: 0.006, sideSeg: 2, profile: [
    { a: 0.222, y: y0, tag: T(0, 0, 0.35) }, { a: 0.222, y: y0 + 0.03 }, { a: 0.213, y: y0 + 0.035, tag: T(0, 1, 0.4) }, { a: 0.0, y: y0 + 0.035 },
  ] });
  fireBox(S, P, { n, rot, af: 0.205, y0: y0 + 0.035, y1: y1 - 0.045, t: 0.04, faces: ['win', 'sun', 'relief', 'win', 'relief', 'moon'], postW: 0.048 });
  polyStack(S, { n, rot, rc: 0.006, sideSeg: 2, profile: [
    { a: 0.0, y: y1 - 0.045, tag: T(0, 1, 0) }, { a: 0.213, y: y1 - 0.045, tag: T(0, 0, 0.3) }, { a: 0.224, y: y1 - 0.04 }, { a: 0.224, y: y1 - 0.004 },
    { a: 0.26, y: y1, tag: T(0, 0, 0.3) }, { a: 0.26, y: y1 + 0.02 }, { a: 0.3, y: y1 + 0.026 }, { a: 0.3, y: y1 + 0.038 },
  ] });
  const thC = 0.086;
  const yE = y1 + 0.038 + thC;
  const roof = roofCap(S, { n, rot, A: 0.52, knobA: 0.1, yEave: yE, H: 0.19, thick: thC, lift: 0.07, soffitA: 0.29, segS: 16, segT: 14,
    rise: (t) => Math.pow(1 - t, 1.35), ridge: { h: 0.012, w: 0.02 }, tagTop: T(0, 0, 1.0), tagEdge: T(0, 0, 0.55), tagBottom: T(0, 0, 0.05) });
  curls(S, roof, n, { R0: 0.036, t0: 0.86 });
  const yk = yE + 0.19;
  lathe(S, [[0.0, yk - 0.03], [0.12, yk - 0.03], [0.122, yk - 0.005], [0.114, yk + 0.018], [0.09, yk + 0.03], [0.0, yk + 0.032]], 36, T(0, 0, 0.9));
  const top = hoju(S, yk + 0.028, 0.9, 0.6);
  return { fireY: (y0 + y1) / 2 + 0.01, top };
}

// ---------------------------------------------------------------------------
// Moss cushions: lumpy flattened blobs scattered (deterministically) over the
// up-facing, moss-prone stone (tag.z = moss bias), clustered by a noise field,
// bigger and denser on the kasa and ledges. Tag pattern 9 = pure moss.
// ---------------------------------------------------------------------------
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let _blob = null, _blobS = null;
function blobBase(big = true) {
  if (!big) { if (!_blobS) { const g1 = new THREE.IcosahedronGeometry(1, 1); g1.deleteAttribute('uv'); g1.deleteAttribute('normal'); _blobS = mergeVertices(g1, 1e-4); } return _blobS; }
  if (!_blob) { const g0 = new THREE.IcosahedronGeometry(1, 2); g0.deleteAttribute('uv'); g0.deleteAttribute('normal'); _blob = mergeVertices(g0, 1e-4); }
  return _blob;
}
function mossTufts(S, seed, density = 1) {
  const M = new Acc();
  const rnd = mulberry(seed * 7919 + 17);
  const P = S.P, N = S.N, Tg = S.T, I = S.I;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();

  for (let i = 0; i < I.length; i += 3) {
    const i0 = I[i], i1 = I[i + 1], i2 = I[i + 2];
    const ny = (N[i0 * 3 + 1] + N[i1 * 3 + 1] + N[i2 * 3 + 1]) / 3;
    if (ny < 0.5) continue;
    const mb = (Tg[i0 * 4 + 2] + Tg[i1 * 4 + 2] + Tg[i2 * 4 + 2]) / 3;
    if (mb < 0.25) continue;
    if (Tg[i0 * 4] > 8.5) continue;
    a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
    const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() * 0.5;
    const exp = area * 700 * density * Math.min(mb, 1.6) * (ny - 0.4);
    let k = Math.floor(exp + rnd());
    while (k-- > 0) {
      let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const p = a.clone().multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v);
      const cl = fbm3(p.x * 5.0, p.y * 5.0, p.z * 5.0, 3, seed) * 0.5 + 0.5;
      const fine = fbm3(p.x * 19.0, p.y * 19.0, p.z * 19.0, 2, seed + 3) * 0.5 + 0.5;
      if (cl * 0.8 + fine * 0.35 + (mb - 1) * 0.15 < 0.62) continue;
      nrm.set(N[i0 * 3] + N[i1 * 3] + N[i2 * 3], N[i0 * 3 + 1] + N[i1 * 3 + 1] + N[i2 * 3 + 1], N[i0 * 3 + 2] + N[i1 * 3 + 2] + N[i2 * 3 + 2]).normalize();
      const r = (0.011 + 0.022 * Math.pow(rnd(), 1.6)) * (0.8 + 0.5 * cl);
      const hgt = r * (0.4 + 0.3 * rnd());
      const g = blobBase(r > 0.021).clone();
      const pos = g.attributes.position;
      const sx = 0.8 + 0.4 * rnd(), sz = 0.8 + 0.4 * rnd(), ph = rnd() * 50;
      for (let j = 0; j < pos.count; j++) {
        let x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
        const bump = 1 + 0.22 * fbm3(x * 2.2 + ph, y * 2.2, z * 2.2 + ph, 2, seed + 5) + 0.08 * fbm3(x * 6 + ph, y * 6, z * 6, 1, seed + 9);
        x *= r * sx * bump; z *= r * sz * bump;
        y = y > 0 ? y * hgt * bump : y * r * 0.12;
        pos.setXYZ(j, x, y - r * 0.08, z);
      }
      g.computeVertexNormals();
      q.setFromUnitVectors(up, nrm);
      const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
      M.addGeo(g, m, [9, 0, 1.5, 0], () => [0.5, 0.5, 1, 1]);
    }
  }
  return M;
}
