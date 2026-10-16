// ---------------------------------------------------------------------------
// hall-carve: real-geometry gilt relief carving (horimono) for gable fields,
// beam faces and panels. Everything is laid out in a local XY plane and raised
// toward local +Z, then mapped by a frame matrix X (hall-local).
//  - ridge2: tapered half-round strand along a 2D polyline (vines, leaves)
//  - scroll / leaf / peony / cloud: karakusa vocabulary
//  - karakusaBand: a non-repeating scrolling-vine composition that fills a
//    band [yLo(x), yHi(x)] over [x0, x1], splitting into rows when tall
//  - beamMotif: discrete symmetric gilt motif for a beam face
// ---------------------------------------------------------------------------
import { lathe, xf, mul, clamp } from './hall-lib.js';

const TAU = Math.PI * 2;

// Tapered half-round strand. pts: [[x,y],...]; wf/hf: number or fn(t in 0..1).
// J = samples across the half-round. Ends get flat half-disc caps unless the
// width there is ~0.
export function ridge2(ms, X, pts, wf, hf, J = 5, opts = {}) {
  const n = pts.length; if (n < 2) return;
  const S = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = S[n - 1] || 1;
  const W = typeof wf === 'function' ? wf : () => wf;
  const H = typeof hf === 'function' ? hf : () => hf;
  const z0 = opts.z0 || 0;
  ms.begin(X);
  let prev = null; const ends = [];
  for (let i = 0; i < n; i++) {
    const t = S[i] / L;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx;
    const w = Math.max(W(t), 1e-4), h = Math.max(H(t), 1e-4);
    const ring = [];
    for (let j = 0; j < J; j++) {
      const th = (Math.PI * j) / (J - 1); const c = Math.cos(th), s = Math.sin(th);
      let enx = c / w, enz = s / h; const el = Math.hypot(enx, enz) || 1; enx /= el; enz /= el;
      ring.push(ms.v(pts[i][0] + nx * w * c, pts[i][1] + ny * w * c, z0 + h * s, nx * enx, ny * enx, enz));
    }
    if (prev) for (let j = 0; j < J - 1; j++) ms.quadN(prev[j], prev[j + 1], ring[j + 1], ring[j]);
    prev = ring;
    if (i === 0 || i === n - 1) ends.push({ i, w, h, tx, ty, nx, ny, sgn: i === 0 ? -1 : 1 });
  }
  // end caps (flat half discs) where the strand is still thick
  for (const e of ends) {
    if (e.w < 0.004) continue;
    const p = pts[e.i];
    const c = ms.v(p[0], p[1], z0 + 0.0005, e.tx * e.sgn, e.ty * e.sgn, 0);
    const rim = [];
    for (let j = 0; j < J; j++) {
      const th = (Math.PI * j) / (J - 1);
      rim.push(ms.v(p[0] + e.nx * e.w * Math.cos(th), p[1] + e.ny * e.w * Math.cos(th), z0 + e.h * Math.sin(th), e.tx * e.sgn, e.ty * e.sgn, 0));
    }
    for (let j = 0; j < J - 1; j++) ms.triN(c, rim[j], rim[j + 1]);
  }
  ms.begin(null);
}

// small dome (bead / boss) at (x,y) on the plane
export function bead(ms, X, x, y, r, h = r, seg = 10, z0 = 0) {
  lathe(ms, mul(X, xf([x, y, z0], 0, Math.PI / 2)), [[0, 0], [r, 0], [r * 0.92, h * 0.42], [r * 0.66, h * 0.8], [r * 0.3, h * 0.97], [0, h]], seg, { hardDeg: 60 });
}

// Spiral polyline: r(t) = R0 (1 - shrink t), angle = a0 + wind * TAU * turns * t
export function spiralPts(cx, cy, R0, a0, wind, turns, shrink = 0.84) {
  const N = Math.max(10, Math.ceil(turns * 34));
  const out = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; const r = R0 * (1 - shrink * t); const a = a0 + wind * TAU * turns * t;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// Curled scroll: strand that starts at radius R0 and winds inward, ending in a bead.
export function scroll(ms, X, cx, cy, R0, a0, wind, turns, w0, h0, opts = {}) {
  const pts = spiralPts(cx, cy, R0, a0, wind, turns, opts.shrink ?? 0.84);
  const wEnd = opts.wEnd ?? 0.45;
  const z0 = opts.z0 || 0;
  ridge2(ms, X, pts, (t) => w0 * (1 - (1 - wEnd) * t), (t) => h0 * (1 - 0.35 * t), 5, { z0 });
  const e = pts[pts.length - 1];
  if (opts.bead !== false) bead(ms, X, e[0], e[1], w0 * (opts.beadR ?? 1.35), h0 * 1.25, 9, z0);
  return pts;
}

// Pointed leaf from p along direction ang (radians), length Ln, max half-width Wl,
// bending by `curl` radians over its length. Optional central vein groove look via two lobes.
export function leaf(ms, X, px, py, ang, Ln, Wl, hl, curl = 0.5, z0 = 0) {
  const N = 9; const pts = [];
  let x = px, y = py, a = ang;
  for (let i = 0; i <= N; i++) {
    pts.push([x, y]);
    a += curl / N; x += (Ln / N) * Math.cos(a); y += (Ln / N) * Math.sin(a);
  }
  ridge2(ms, X, pts, (t) => Wl * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.75) * (1 - 0.25 * t), (t) => hl * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05)), 0.6), 5, { z0 });
}

// Peony / chrysanthemum medallion: two rings of domed petals and a boss.
export function peony(ms, X, cx, cy, R, h, petals = 8) {
  for (let ring = 0; ring < 2; ring++) {
    const n = ring === 0 ? petals : Math.max(5, petals - 2);
    const r0 = ring === 0 ? R * 0.34 : R * 0.18, r1 = ring === 0 ? R : R * 0.68;
    const wp = ring === 0 ? (Math.PI * R / n) * 0.62 : (Math.PI * r1 / n) * 0.7;
    const hz = ring === 0 ? h : h * 1.5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + (ring ? Math.PI / n : 0);
      const pts = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; const r = r0 + (r1 - r0) * t; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      ridge2(ms, X, pts, (t) => wp * Math.pow(Math.sin(Math.PI * (0.12 + 0.8 * t)), 0.55), (t) => hz * (0.55 + 0.45 * Math.sin(Math.PI * (0.2 + 0.7 * t))), 5);
    }
  }
  bead(ms, X, cx, cy, R * 0.26, h * 2.0, 12);
}

// Auspicious cloud (kumo): a cluster of three scroll curls on a short tail.
export function cloud(ms, X, cx, cy, S, h, dir = 1, z0 = 0) {
  const w = S * 0.07;
  scroll(ms, X, cx, cy, S * 0.28, Math.PI * 0.95, -1, 1.1, w, h, { z0 });
  scroll(ms, X, cx + dir * S * 0.42, cy + S * 0.06, S * 0.22, Math.PI * 1.0, -dir, 1.05, w * 0.9, h, { z0 });
  scroll(ms, X, cx - dir * S * 0.36, cy - S * 0.04, S * 0.18, 0.0, dir, 1.0, w * 0.85, h, { z0 });
  // tail
  const tail = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; tail.push([cx - dir * (S * 0.2 + S * 0.7 * t), cy - S * 0.22 - S * 0.12 * Math.sin(Math.PI * t)]); }
  ridge2(ms, X, tail, (t) => w * (1 - 0.8 * t), (t) => h * (1 - 0.5 * t), 5, { z0 });
}

// Scrolling-vine (karakusa) composition filling a band. yLo/yHi: fn(x).
// opts: { R (rng for variation), minH, maxRowH, scale (stroke scale), flowers }
export function karakusaBand(ms, X, x0, x1, yLo, yHi, opts = {}) {
  const maxRowH = opts.maxRowH || 0.75;
  const minH = opts.minH || 0.16;
  // split into rows if tall: rows are sub-bands of equal height fraction
  const Hmax = (() => { let m = 0; for (let i = 0; i <= 24; i++) { const x = x0 + ((x1 - x0) * i) / 24; m = Math.max(m, yHi(x) - yLo(x)); } return m; })();
  const rows = Math.max(1, Math.round(Hmax / maxRowH));
  if (rows > 1 && !opts._row) {
    for (let r = 0; r < rows; r++) {
      const lo = (x) => yLo(x) + ((yHi(x) - yLo(x)) * r) / rows;
      const hi = (x) => yLo(x) + ((yHi(x) - yLo(x)) * (r + 1)) / rows;
      // shorter rows only where the band is tall enough to keep proportions
      let a = x0, b = x1;
      while (a < b && hi(a) - lo(a) < minH) a += 0.03;
      while (b > a && hi(b) - lo(b) < minH) b -= 0.03;
      if (b - a > 0.3) karakusaBand(ms, X, a, b, lo, hi, { ...opts, _row: true, phase: (opts.phase || 0) + r * 0.5 });
    }
    return;
  }
  const Hc = (x) => yHi(x) - yLo(x);
  const Ym = (x) => (yHi(x) + yLo(x)) / 2;
  // pick a period from the typical band height
  const Hmid = Hc((x0 + x1) / 2);
  const Hs = Math.max(minH, Math.min(Hmax, Hmid));
  let P = clamp(1.25 * Hs, 0.32, 1.1);
  const nHalf = Math.max(1, Math.round((x1 - x0) / (P / 2)));
  P = (2 * (x1 - x0)) / nHalf;
  const phase = (opts.phase || 0) * Math.PI;
  const k0 = opts.scale || 1;
  const strokeW = (H) => clamp(0.034 * H, 0.008, 0.026) * k0;
  const th = (x) => phase + (Math.PI * 2 * (x - x0)) / P;
  const amp = (x) => 0.18 * Hc(x);
  const stemY = (x) => Ym(x) + amp(x) * Math.sin(th(x));
  // stem
  const stem = [];
  const ns = Math.max(8, Math.ceil((x1 - x0) / 0.03));
  for (let i = 0; i <= ns; i++) { const x = x0 + ((x1 - x0) * i) / ns; if (Hc(x) >= minH * 0.7) stem.push([x, stemY(x)]); }
  if (stem.length > 3) {
    ridge2(ms, X, stem, (t) => strokeW(Hc(x0 + (x1 - x0) * t)) * (0.95 + 0.1 * Math.sin(t * 40)), (t) => strokeW(Hc(x0 + (x1 - x0) * t)) * 0.95);
    for (const e of [stem[0], stem[stem.length - 1]]) bead(ms, X, e[0], e[1], strokeW(Hc(e[0])) * 1.6, strokeW(Hc(e[0])) * 1.5, 9);
  }
  // scrolls in the pockets
  let flip = 0;
  for (let k = 0; k < nHalf; k++) {
    const tC = Math.PI / 2 + k * Math.PI; // crest/trough angle
    const xk = x0 + ((tC - phase) / (Math.PI * 2)) * P;
    if (xk < x0 + 0.05 || xk > x1 - 0.05) continue;
    const H = Hc(xk); if (H < minH) continue;
    const crest = Math.sin(th(xk)) > 0;
    const sgn = crest ? 1 : -1;
    const sw = strokeW(H);
    // branch point after the crest/trough
    const xb = xk + (0.12 * P);
    const Sp = [xb, stemY(xb)];
    const C = [xk + 0.02 * P, Ym(xk) - sgn * 0.11 * H];
    const R0 = Math.hypot(Sp[0] - C[0], Sp[1] - C[1]);
    const a0 = Math.atan2(Sp[1] - C[1], Sp[0] - C[0]);
    const wind = crest ? -1 : 1;
    const flower = opts.flowers !== false && (flip++ % 2 === 1);
    if (flower) {
      scroll(ms, X, C[0], C[1], R0, a0, wind, 0.62, sw * 0.95, sw * 0.9, { bead: false, wEnd: 0.8, shrink: 0.3 });
      peony(ms, X, C[0], C[1], R0 * 0.68, sw * 1.1, 9);
    } else {
      scroll(ms, X, C[0], C[1], R0, a0, wind, 1.3, sw * 0.95, sw * 0.9);
      // inner secondary curl
      scroll(ms, X, C[0] + 0.25 * R0 * Math.cos(a0 + wind * 2.4), C[1] + 0.25 * R0 * Math.sin(a0 + wind * 2.4), R0 * 0.32, a0 + wind * 2.4 + Math.PI, wind, 0.9, sw * 0.55, sw * 0.6, { beadR: 1.2 });
    }
    // leaves: one on the outer side of the stem before the crest, one along the scroll
    const xl = xk - 0.1 * P; const yl = stemY(xl);
    leaf(ms, X, xl, yl, Math.PI * (crest ? 0.62 : -0.62), 0.33 * H, 0.1 * H, sw * 1.05, crest ? 0.7 : -0.7);
    leaf(ms, X, xl + 0.04 * P, yl, Math.PI * (crest ? 0.3 : -0.3), 0.22 * H, 0.075 * H, sw * 0.95, crest ? 0.9 : -0.9);
    const xl2 = xk + 0.3 * P; const yl2 = stemY(xl2);
    leaf(ms, X, xl2, yl2, crest ? -0.25 * Math.PI : 0.25 * Math.PI, 0.26 * H, 0.085 * H, sw * 0.95, crest ? -0.9 : 0.9);
    // small tendril curl on the open side
    scroll(ms, X, xk - 0.2 * P, Ym(xk) + sgn * 0.32 * H, 0.07 * H, crest ? -Math.PI * 0.5 : Math.PI * 0.5, -wind, 1.0, sw * 0.5, sw * 0.55, { beadR: 1.1 });
  }
}

// Symmetric gilt motif for a beam face, centred at (cx, cy), half-length Lh,
// height Hh: central peony with paired scrolls and leaves, end clouds.
export function beamMotif(ms, X, cx, cy, Lh, Hh, k = 1) {
  const sw = clamp(0.06 * Hh, 0.008, 0.02) * k;
  peony(ms, X, cx, cy, Hh * 0.42, sw * 1.1, 8);
  for (const s of [-1, 1]) {
    // flowing stem out from the flower to each side
    const stem = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; const x = cx + s * (Hh * 0.38 + (Lh - Hh * 0.6) * t); stem.push([x, cy + Hh * 0.18 * Math.sin(Math.PI * 1.6 * t + 0.3)]); }
    ridge2(ms, X, stem, (t) => sw * (1 - 0.4 * t), sw * 0.9);
    const e = stem[stem.length - 1];
    scroll(ms, X, e[0] - s * Hh * 0.2, e[1] + Hh * 0.04, Hh * 0.22, s > 0 ? -0.2 : Math.PI + 0.2, s > 0 ? 1 : -1, 1.2, sw * 0.9, sw * 0.9);
    const m = stem[9];
    scroll(ms, X, m[0] + s * Hh * 0.05, m[1] - Hh * 0.27, Hh * 0.2, Math.PI / 2, s > 0 ? -1 : 1, 1.1, sw * 0.75, sw * 0.8);
    leaf(ms, X, stem[5][0], stem[5][1], s > 0 ? 0.9 : Math.PI - 0.9, Hh * 0.42, Hh * 0.09, sw, s > 0 ? 0.6 : -0.6);
    leaf(ms, X, stem[13][0], stem[13][1], s > 0 ? 1.2 : Math.PI - 1.2, Hh * 0.34, Hh * 0.08, sw * 0.9, s > 0 ? -0.5 : 0.5);
  }
}
