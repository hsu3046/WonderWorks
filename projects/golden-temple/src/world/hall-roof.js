// ---------------------------------------------------------------------------
// hall-roof: hongawara tiled roofs (irimoya main roof + mokoshi skirt roof),
// eave carpentry (double rafters, kioi, fascia, purlins, hip rafters), ridges
// (noshi stacks + kanmuri caps + onigawara), irimoya gables, roof warp (sori).
// All coordinates are hall-local (origin at hall centre on the ground,
// +X east, +Z south/front, +Y up).
// ---------------------------------------------------------------------------
import { cbox, beam, lathe, extrude, sweep, bar, xf, basis, mul, v3, clamp, lerp, sstep, circlePts } from './hall-lib.js';
import { onigawara, tileDisc, rosette, gegyo, kaerumata, bez, kanagu } from './hall-orn.js';
import { carveSideGable } from './hall-gable.js';
import { rafterCap, cornerPlate } from './hall-detail.js';
// orthonormal end-face frame for a member ending at p0 pointing along dir (+Z = dir)
const endFrame = (p0, dir) => { const side = v3.norm(v3.cross([0, 1, 0], dir)); const up = v3.cross(dir, side); return basis(p0, side, up, dir); };

// Roof rise profile: slope s0 at the eave increasing to s1 at depth D.
export function makeProfile(s0, s1, D, k = 1.5) {
  const P = (d) => s0 * d + ((s1 - s0) * D * Math.pow(Math.max(d, 0) / D, k + 1)) / (k + 1);
  const dP = (d) => s0 + (s1 - s0) * Math.pow(Math.max(d, 0) / D, k);
  const n = 800, dm = D * 1.2;
  const S = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const d0 = ((i - 1) / n) * dm, d1 = (i / n) * dm; const m = dP((d0 + d1) / 2);
    S[i] = S[i - 1] + (d1 - d0) * Math.sqrt(1 + m * m);
  }
  const arc = (d) => { const f = clamp(d / dm, 0, 1) * n; const i = Math.min(Math.floor(f), n - 1); return S[i] + (S[i + 1] - S[i]) * (f - i); };
  const dOf = (s) => {
    let lo = 0, hi = n;
    if (s <= 0) return 0;
    if (s >= S[n]) return dm;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    return ((lo + (s - S[lo]) / (S[hi] - S[lo])) / n) * dm;
  };
  return { P, dP, arc, dOf, D, s0, s1 };
}

// Roof warp (sori): lift toward the corners + outward plan flare.
// L = c(ux) * c(uz), c(u) = ((u-u0)/(1-u0))^pw : zero inside the wall
// rectangle, 1 at the eave corner; lifts y by A*L and pushes the corner out by B*L.
export function makeWarp(ex, ez, A, B, u0 = 0.7, pw = 2.0) {
  const c = (u) => { const t = clamp((u - u0) / (1 - u0), 0, 1.18); return Math.pow(t, pw); };
  return (x, y, z, out) => {
    const L = c(Math.abs(x) / ex) * c(Math.abs(z) / ez);
    out[0] = x + Math.sign(x) * B * L;
    out[1] = y + A * L;
    out[2] = z + Math.sign(z) * B * L;
    return out;
  };
}

// ---------------------------------------------------------------------------
// faces
// ---------------------------------------------------------------------------
export function faceList(T) {
  const F = [];
  const mk = (name, o, t, e, aMax, dmax, excl = []) => F.push({ name, o, t, e, aMax, dmax, excl });
  if (T.kind === 'irimoya') {
    const fb = (a) => (Math.abs(a) <= T.xb ? T.ez - 0.02 : T.ex - Math.abs(a));
    const sd = (a) => Math.min(T.ez - Math.abs(a), T.ex - T.xg);
    mk('front', [0, 1], [1, 0], T.ez, T.ex, fb);
    mk('back', [0, -1], [-1, 0], T.ez, T.ex, fb);
    mk('east', [1, 0], [0, -1], T.ex, T.ez, sd);
    mk('west', [-1, 0], [0, 1], T.ex, T.ez, sd);
  } else {
    const fb = (a) => Math.min(T.ex - Math.abs(a), T.ez - T.zi);
    const sd = (a) => Math.min(T.ez - Math.abs(a), T.ex - T.xi);
    mk('front', [0, 1], [1, 0], T.ez, T.ex, fb, T.frontExcl || []);
    mk('back', [0, -1], [-1, 0], T.ez, T.ex, fb);
    mk('east', [1, 0], [0, -1], T.ex, T.ez, sd);
    mk('west', [-1, 0], [0, 1], T.ex, T.ez, sd);
  }
  return F;
}

// point on face at across a and depth d (from eave). Returns position and normal.
export function facePt(T, F, a, d) {
  const e = F.e - d;
  const x = F.t[0] * a + F.o[0] * e, z = F.t[1] * a + F.o[1] * e;
  const y = T.y0 + T.prof.P(d);
  const m = T.prof.dP(d);
  const l = Math.sqrt(1 + m * m);
  return { p: [x, y, z], n: [(F.o[0] * m) / l, 1 / l, (F.o[1] * m) / l] };
}
const inExcl = (F, a, pad = 0) => F.excl.some(([a0, a1]) => a > a0 - pad && a < a1 + pad);

// ---------------------------------------------------------------------------
// tiles
// ---------------------------------------------------------------------------
export const TILE = { S: 0.335, r0: 0.097, L: 0.355, dR: 0.008, panT: 0.024, dip: 0.038 };

function samples(prof, d0, d1) {
  const L = TILE.L;
  const s0 = prof.arc(d0), s1 = prof.arc(d1);
  const out = [];
  const ph = (s) => 1 - (s / L - Math.floor(s / L));
  out.push([s0, ph(s0), Math.floor(s0 / L)]);
  for (let k = Math.floor(s0 / L); k * L < s1; k++) {
    for (const [s, p] of [[k * L, 1], [k * L + 0.5 * L, 0.5], [k * L + L - 0.007, 0.02]]) {
      if (s <= s0 + 1e-4 || s >= s1 - 1e-4) continue;
      out.push([s, p, k]);
    }
  }
  out.push([s1, ph(s1), Math.floor(s1 / L)]);
  return out;
}

// Generic row emitters working on a "row geometry" callback rowPt(s) -> {p, n, t}
// (t = across unit vector). Used by both straight faces and the karahafu.
export function emitRound(ms, smp, rowPt, R, hide, opts = {}) {
  const J = 7; const r0 = opts.r0 || TILE.r0; const dR = TILE.dR;
  let prev = null; const jit = new Map();
  ms.begin(null);
  for (const [s, ph, k] of smp) {
    if (!jit.has(k)) { const o = R.next(); jit.set(k, [R.range(-0.004, 0.004), R.range(-0.003, 0.003), o < 0.06 ? R.range(0.62, 0.75) : o > 0.95 ? R.range(1.18, 1.32) : R.range(0.86, 1.1)]); }
    const [jn, jt, tn] = jit.get(k); ms.tint = tn;
    const { p, n, t } = rowPt(s);
    const vis = !hide || !hide(p[0], p[2], p[1]);
    const r = r0 + dR * ph;
    const ring = [];
    for (let j = 0; j < J; j++) {
      const th = (Math.PI * j) / (J - 1);
      const c = Math.cos(th), sn = Math.sin(th);
      const ox = t[0] * (r * c + jt) + n[0] * (r * sn * 0.94 + jn);
      const oy = t[1] * (r * c + jt) + n[1] * (r * sn * 0.94 + jn);
      const oz = t[2] * (r * c + jt) + n[2] * (r * sn * 0.94 + jn);
      ring.push(ms.v(p[0] + ox, p[1] + oy, p[2] + oz, t[0] * c + n[0] * sn, t[1] * c + n[1] * sn, t[2] * c + n[2] * sn));
    }
    if (prev && prev.vis && vis) for (let j = 0; j < J - 1; j++) ms.quadN(prev.ring[j], prev.ring[j + 1], ring[j + 1], ring[j]);
    prev = { ring, vis };
    ms.tint = 1;
  }
}

// pan strip between across offsets w0..w1 (relative to rowPt's centre line)
export function emitPan(ms, smp, rowPt, w0, w1, hide, seed = 0) {
  const U = [0, 0.33, 0.67, 1];
  const W = w1 - w0;
  let prev = null;
  ms.begin(null);
  for (const [s, ph, kk] of smp) {
    { const h = Math.sin((kk + 1) * 12.9898 + seed * 78.233) * 43758.5453; ms.tint = 0.88 + 0.2 * (h - Math.floor(h)); }
    const { p, n, t } = rowPt(s);
    const vis = !hide || !hide(p[0], p[2], p[1]);
    const lift = TILE.panT * ph;
    const ring = [];
    for (const u of U) {
      const w = w0 + W * u;
      const h = -TILE.dip * (1 - (2 * u - 1) ** 2) + lift;
      const slope = (4 * TILE.dip * (2 * u - 1)) / W; // dh/dw
      const nn = v3.norm([n[0] - t[0] * slope, n[1] - t[1] * slope, n[2] - t[2] * slope]);
      ring.push(ms.v(p[0] + t[0] * w + n[0] * h, p[1] + t[1] * w + n[1] * h, p[2] + t[2] * w + n[2] * h, nn[0], nn[1], nn[2]));
    }
    if (prev && prev.vis && vis) for (let j = 0; j < U.length - 1; j++) ms.quadN(prev.ring[j], prev.ring[j + 1], ring[j + 1], ring[j]);
    prev = { ring, vis };
    ms.tint = 1;
  }
}

// Eave tile ends: disc on each round row + lip under each pan.
function eaveEnds(acc, mats, T, F, rows, goldDiscs) {
  const msT = acc.m(mats.tile), msG = acc.m(mats.gold);
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (inExcl(F, a, 0.25)) continue;
    const { p, n } = facePt(T, F, a, 0);
    const tv = [F.t[0], 0, F.t[1]];
    // tile axis (down-slope outward): perpendicular to n within the (o, up) plane
    const ax = v3.norm(v3.cross(tv, n)); // points outward-down or inward-up: fix sign to outward
    const out = v3.dot(ax, [F.o[0], 0, F.o[1]]) > 0 ? ax : v3.scale(ax, -1);
    const c = v3.add(p, v3.scale(n, TILE.r0 * 0.45));
    const X = basis(v3.add(c, v3.scale(out, 0.01)), tv, out, v3.cross(tv, out));
    tileDisc(msT, goldDiscs ? msG : null, X, 0.122, 0.05, goldDiscs);
    // pan lip toward the next row
    if (i < rows.length - 1) {
      const a2 = rows[i + 1];
      if (inExcl(F, a2, 0.25)) continue;
      const w0 = TILE.r0 * 0.9, w1 = a2 - a - TILE.r0 * 0.9;
      const N = 5; const top = [], bot = [];
      msT.begin(null);
      for (let k = 0; k <= N; k++) {
        const u = k / N; const w = w0 + (w1 - w0) * u;
        const base = v3.add(v3.add(p, v3.scale(tv, w)), v3.scale(out, 0.004));
        const sag = 0.026 * Math.sin(Math.PI * u);
        top.push(msT.v(base[0], base[1] + 0.012, base[2], out[0], 0.2, out[2]));
        bot.push(msT.v(base[0], base[1] - 0.075 - sag, base[2], out[0], -0.2, out[2]));
      }
      for (let k = 0; k < N; k++) msT.quadN(top[k], top[k + 1], bot[k + 1], bot[k]);
      // underside of lip
      const bk = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N; const w = w0 + (w1 - w0) * u;
        const base = v3.add(v3.add(p, v3.scale(tv, w)), v3.scale(out, -0.05));
        bk.push(msT.v(base[0], base[1] - 0.06 - 0.026 * Math.sin(Math.PI * u), base[2], 0, -1, 0));
      }
      const bf = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N; const w = w0 + (w1 - w0) * u;
        const base = v3.add(v3.add(p, v3.scale(tv, w)), v3.scale(out, 0.004));
        bf.push(msT.v(base[0], base[1] - 0.075 - 0.026 * Math.sin(Math.PI * u), base[2], 0, -1, 0));
      }
      for (let k = 0; k < N; k++) msT.quadN(bf[k], bf[k + 1], bk[k + 1], bk[k]);
    }
  }
}

export function buildTiles(acc, T, mats, R, opts = {}) {
  const ms = acc.m(mats.tile);
  for (const F of faceList(T)) {
    const K = Math.floor((F.aMax - 0.1) / TILE.S);
    const rows = [];
    for (let k = -K; k <= K; k++) rows.push(k * TILE.S);
    const tv = [F.t[0], 0, F.t[1]];
    const rowPtFor = (a) => (s) => { const d = T.prof.dOf(s); const { p, n } = facePt(T, F, a, d); return { p, n, t: tv }; };
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      const dm = F.dmax(a) - 0.03;
      if (dm > 0.1) emitRound(ms, samples(T.prof, 0, dm), rowPtFor(a), R, T.hide);
      if (i < rows.length - 1) {
        const a2 = rows[i + 1];
        const dm2 = Math.min(F.dmax(a), F.dmax(a2)) - 0.02;
        if (dm2 > 0.1) emitPan(ms, samples(T.prof, 0, dm2), rowPtFor(a), TILE.r0 * 0.72, a2 - a - TILE.r0 * 0.72, T.hide, a * 3.7 + F.o[0] * 11.3 + F.o[1] * 17.1);
      }
    }
    // pans outside the outermost rows (toward the corner), short
    for (const [a, w0, w1] of [[rows[0], -(F.aMax - Math.abs(rows[0])) - 0.02, -TILE.r0 * 0.72], [rows[rows.length - 1], TILE.r0 * 0.72, F.aMax - rows[rows.length - 1] + 0.02]]) {
      const dm = Math.min(F.dmax(a), 0.4);
      if (dm > 0.05) emitPan(ms, samples(T.prof, 0, dm), rowPtFor(a), w0, w1, T.hide);
    }
    if (!opts.noEaveEnds) eaveEnds(acc, mats, T, F, rows, opts.goldDiscs !== false);
  }
}

// ---------------------------------------------------------------------------
// ridge stacks (noshi layers + kanmuri cap)
// ---------------------------------------------------------------------------
export function noshiProfile(w0, layers, lh, capR, bury = 0.45, taper = 0.012) {
  const right = [[w0 / 2 + 0.12, -bury], [w0 / 2, -0.02]];
  let v = 0;
  for (let i = 0; i < layers; i++) {
    const w = w0 / 2 - i * taper;
    right.push([w + 0.012, v], [w + 0.012, v + lh - 0.016], [w - 0.006, v + lh - 0.006], [w - 0.006, v + lh]);
    v += lh;
  }
  const top = v;
  // cap: semicircle from right to left
  const cap = [];
  const cw = Math.max(capR, w0 / 2 - layers * taper - 0.02);
  for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; cap.push([cw * Math.cos(a), top + capR * 0.9 * Math.sin(a)]); }
  const left = right.slice().reverse().map(([u, vv]) => [-u, vv]);
  const prof = [...right, ...cap.slice(1, -1), ...left];
  return { prof, height: top + capR * 0.9 };
}

export function ridgeAlong(ms, path, w0, layers, lh, capR, bury = 0.45) {
  const { prof } = noshiProfile(w0, layers, lh, capR, bury);
  sweep(ms, path, prof, { closed: true, caps: true });
}

// ---------------------------------------------------------------------------
// eave carpentry (pre-warp), per face side
// ---------------------------------------------------------------------------
// E = { dP, yP, sb, dTip, sf, rafW, rafH, frafW, frafH, dw (wall depth), fasciaH, purW, purH }
function rafterY(E, d) { return E.yP + E.sb * (d - E.dP); } // base rafter TOP at depth d
function flyY(E, d) { return E.yF0 + E.sf * d; } // flying rafter TOP at depth d

export function buildEaves(acc, T, mats, opts = {}) {
  const E = T.E;
  const red = acc.m(mats.red), redD = acc.m(mats.soffit || mats.redDark), gold = acc.m(mats.gold);
  const redA = acc.m(mats.redA || mats.red);
  const anchors = { bells: [] };
  for (const F of faceList(T)) {
    const o = [F.o[0], 0, F.o[1]], tv = [F.t[0], 0, F.t[1]];
    const P = (a, d, y) => [tv[0] * a + o[0] * (F.e - d), y, tv[2] * a + o[2] * (F.e - d)];
    const hipD = (a) => F.e === T.ez ? T.ex - Math.abs(a) : T.ez - Math.abs(a);
    const dw = F.name === 'front' || F.name === 'back' ? E.dwZ : E.dwX;
    const aLim = F.aMax;
    // intervals of a along this side excluding excl zones
    const spans = [];
    { let cur = -aLim; const ex = [...F.excl].sort((p, q) => p[0] - q[0]);
      for (const [a0, a1] of ex) { if (a0 - 0.15 > cur) spans.push([cur, a0 - 0.15]); cur = Math.max(cur, a1 + 0.15); }
      if (cur < aLim) spans.push([cur, aLim]); }
    // rafters
    const sp = E.spacing || 0.3;
    const K = Math.floor(aLim / sp);
    for (let k = -K; k <= K; k++) {
      const a = k * sp;
      if (inExcl(F, a, 0.2)) continue;
      const hd = hipD(a) - 0.16;
      // base rafter (jidaruki)
      const dIn = Math.min(dw, hd);
      if (dIn > E.dTip + 0.25) {
        const p0 = P(a, E.dTip, rafterY(E, E.dTip) - E.rafH / 2), p1 = P(a, dIn, rafterY(E, dIn) - E.rafH / 2);
        beam(redA, p0, p1, E.rafW, E.rafH, 0.012);
        // gilt kibana fitting on the tip
        const dir = v3.norm(v3.sub(p0, p1));
        rafterCap(gold, endFrame(p0, dir), E.rafW / 2, E.rafH / 2);
      }
      // flying rafter (hiendaruki)
      const dF = Math.min(E.dFly, hd);
      if (dF > 0.5 && hipD(a) > 0.22) {
        const p0 = P(a, 0.0, flyY(E, 0) - E.frafH / 2), p1 = P(a, dF, flyY(E, dF) - E.frafH / 2);
        beam(redA, p0, p1, E.frafW, E.frafH, 0.01);
        const dir = v3.norm(v3.sub(p0, p1));
        rafterCap(gold, endFrame(p0, dir), E.frafW / 2, E.frafH / 2, { sleeve: 0.04 });
      }
    }
    // continuous members along the side (subdivided for the warp)
    for (const [s0, s1] of spans) {
      const along = (d, y, ext = 0) => {
        const lo = Math.max(s0, -(hipD(0) - (F.e === T.ez ? T.ez : T.ex) + aLim) - ext);
        const a0 = Math.max(s0, -(aLim - d) - ext), a1 = Math.min(s1, aLim - d + ext);
        void lo;
        const pts = [];
        const n = Math.max(2, Math.ceil((a1 - a0) / 0.35));
        for (let i = 0; i <= n; i++) pts.push(P(a0 + ((a1 - a0) * i) / n, d, y));
        return pts;
      };
      // kioi board at base-rafter tips
      {
        const d = E.dTip + 0.06;
        const y = rafterY(E, d) + 0.04;
        const pts = along(d, y, -0.05);
        if (pts.length > 1) sweep(redA, pts, [[-0.06, -0.045], [0.06, -0.045], [0.06, 0.045], [-0.06, 0.045]].map(([u, v]) => [u, v]), { closed: true, caps: true });
      }
      // fascia (kayaoi) at flying rafter tips + gold strip
      {
        const yb = flyY(E, 0) - 0.01, yt = T.y0 - 0.025;
        const yc = (yb + yt) / 2, hh = (yt - yb) / 2;
        const pts = along(0.075, yc, 0.06);
        if (pts.length > 1) {
          // profile u = outward (S), v = up ; slightly bevelled top edge
          sweep(red, pts, [[-0.075, -hh], [0.075, -hh], [0.075, hh - 0.02], [0.05, hh], [-0.075, hh]], { closed: true, caps: true });
          const ptsG = along(-0.004, yb + 0.025, 0.07);
          sweep(gold, ptsG, [[-0.01, -0.025], [0.01, -0.025], [0.01, 0.025], [-0.01, 0.025]], { closed: true, caps: true });
          const ptsG2 = along(-0.004, yt - 0.018, 0.07);
          sweep(gold, ptsG2, [[-0.008, -0.016], [0.008, -0.016], [0.008, 0.016], [-0.008, 0.016]], { closed: true, caps: true });
          // chased gilt corner fittings (sumi-kanagu) on the fascia next to the hips
          for (const [aEnd, sg] of [[s0, 1], [s1, -1]]) {
            if (Math.abs(Math.abs(aEnd) - aLim) > 1e-6) continue;
            const ac = aEnd + sg * (0.075 + 0.26);
            const c = P(ac, -0.001, yc);
            cornerPlate(gold, basis(c, v3.scale(tv, sg), [0, 1, 0], o), 0.46, 2 * hh + 0.012, 0.006, 3);
          }
        }
      }
      // purlin (gangyo) on bracket tips
      if (!opts.noPurlin) {
        const d = E.dP;
        const pts = along(d, E.yP - E.purH / 2, 0.25);
        if (pts.length > 1) sweep(redA, pts, [[-E.purW / 2, -E.purH / 2], [E.purW / 2, -E.purH / 2], [E.purW / 2, E.purH / 2], [-E.purW / 2, E.purH / 2]], { closed: true, caps: true });
      }
    }
    // soffit boards (on top of rafters), clipped to the hip; split by excl spans
    for (const [s0, s1] of spans) {
      const strip = (dA, dB, yfun, nd) => {
        const rows = [];
        for (let i = 0; i <= nd; i++) {
          const d = dA + ((dB - dA) * i) / nd;
          const lim = (F.e === T.ez ? T.ex : T.ez) - d; // hip limit in a
          const a0 = Math.max(s0, -lim), a1 = Math.min(s1, lim);
          const row = [];
          const na = 40;
          for (let j = 0; j <= na; j++) {
            const a = a0 + ((a1 - a0) * j) / na;
            const p = P(a, d, yfun(d) + 0.004);
            row.push(redD.v(p[0], p[1], p[2], 0, -1, 0));
          }
          rows.push(row);
        }
        redD.begin(null);
        for (let i = 0; i < nd; i++) for (let j = 0; j < 40; j++) redD.quadN(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
      };
      redD.begin(null);
      strip(E.dTip - 0.05, dw, (d) => rafterY(E, d), 8);
      strip(-0.01, E.dTip + 0.1, (d) => flyY(E, d), 3);
    }
  }
  // hip rafters (sumigi + flying sumigi) with gold caps; bell anchors
  if (!opts.noSumigi) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const dirH = v3.norm([sx, 0, sz]);
    const pt = (d, y) => [sx * (T.ex - d), y, sz * (T.ez - d)];
    const dIn = Math.min(E.dwX, E.dwZ);
    const s0 = pt(E.dTip - 0.25, rafterY(E, E.dTip - 0.25) - 0.16 + 0.05), s1 = pt(dIn, rafterY(E, dIn) - 0.16 + 0.05);
    beam(redA, s0, s1, 0.26, 0.32, 0.02);
    const f0 = pt(-0.32, flyY(E, -0.32) - 0.12 + 0.05), f1 = pt(E.dFly + 0.2, flyY(E, E.dFly + 0.2) - 0.12 + 0.05);
    beam(redA, f0, f1, 0.22, 0.26, 0.02);
    for (const [q0, q1, w, h] of [[s0, s1, 0.26, 0.32], [f0, f1, 0.22, 0.26]]) {
      const dir = v3.norm(v3.sub(q0, q1));
      const side = v3.norm(v3.cross(dir, [0, 1, 0]));
      const up = v3.cross(side, dir);
      // gilt end sleeve + domed cap covering the whole end face (avoids flat sun-mirror faces)
      const gl = acc.m(mats.goldL || mats.gold);
      cbox(gl, basis(v3.add(q0, v3.scale(dir, -0.1)), dir, up, side), 0.1, h / 2 + 0.014, w / 2 + 0.014, 0.012);
      const Rc = 0.5 * Math.hypot(w, h) + 0.015;
      // rimmed rectangular kibana plate over the end face (a round domed / cushion
      // cap read as a blown-out gold coin in the low sun), rosette boss, corner nails
      const Fe = endFrame(q0, dir);
      const ww = w / 2 + 0.016, hh2 = h / 2 + 0.016;
      rafterCap(gl, Fe, ww, hh2, { sleeve: 0, boss: false });
      // black-lacquered inset inside the gilt frame (covers the end grain, which
      // was coplanar with the sleeve face) + low rosette boss
      const iw = (ww + 0.007) * 0.73, ih = (hh2 + 0.007) * 0.79;
      extrude(acc.m(mats.black), Fe, [[-iw, -ih], [iw, -ih], [iw, ih], [-iw, ih]], [], 0, 0.004, { back: false });
      rosette(gl, mul(Fe, xf([0, 0, 0.003])), Math.min(w, h) * 0.26, 8, 0.016);
      for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lathe(gl, mul(Fe, xf([nx * w * 0.36, ny * h * 0.37, 0.001], 0, Math.PI / 2)), [[0.016, 0], [0.012, 0.008], [0, 0.012]], 6);
      // chased gilt plates on the sleeve sides and soffit (seen from below in close-ups)
      const sc = v3.add(q0, v3.scale(dir, -0.1));
      const mdir = v3.scale(dir, -1);
      for (const sg of [-1, 1]) cornerPlate(gl, basis(v3.add(sc, v3.scale(side, sg * (w / 2 + 0.014))), mdir, up, v3.scale(side, sg)), 0.19, h + 0.01, 0.006, 2);
      cornerPlate(gl, basis(v3.add(sc, v3.scale(up, -(h / 2 + 0.014))), mdir, side, v3.scale(up, -1)), 0.19, w + 0.01, 0.006, 2);
    }
    const tip = v3.add(f0, v3.scale(dirH, 0.0));
    anchors.bells.push({ pos: [tip[0], tip[1] - 0.15, tip[2]], scale: T.bellScale || 1, rotY: Math.atan2(sx, sz) });
  }
  return anchors;
}

// ---------------------------------------------------------------------------
// ridges & gables for the irimoya roof
// ---------------------------------------------------------------------------
export function buildIrimoyaRidges(acc, T, mats) {
  const tile = acc.m(mats.tile), gold = acc.m(mats.goldL || mats.gold);
  const Y = (d) => T.y0 + T.prof.P(d);
  // main ridge (omune)
  const yR = Y(T.ez);
  const xr = T.xb + 0.15;
  const mainPath = [];
  for (let i = 0; i <= 24; i++) mainPath.push([-xr + (2 * xr * i) / 24, yR, 0]);
  const MW = 0.62, ML = 7, MLH = 0.105, MC = 0.2;
  ridgeAlong(tile, mainPath, MW, ML, MLH, MC, 0.75);
  // decorative gold band along the main ridge (kirikane strip under the cap)
  const mainTop = ML * MLH;
  for (const s of [-1, 1]) {
    const pth = mainPath.map((p) => [p[0], p[1] + mainTop - 0.05, s * (MW / 2 - (ML - 1) * 0.012 + 0.014)]);
    sweep(gold, pth, [[-0.012, -0.022], [0.012, -0.022], [0.012, 0.022], [-0.012, 0.022]], { closed: true, caps: true });
  }
  // main onigawara at both ends
  for (const s of [-1, 1]) {
    const X = basis([s * (xr + 0.02), yR - 0.25, 0], [0, 0, -s], [0, 1, 0], [s, 0, 0]);
    onigawara(tile, gold, X, 1.55, 2.05, 0.34, { goldEdge: true, horn: false, shibi: 1.3 });
  }
  // kudarimune (descending verge ridges) and sumimune (hips)
  const dJ = T.ex - T.xb; // depth where verge meets the hip
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const xv = sx * (T.xb - 0.24);
    const path = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const d = T.ez - 0.1 - ((T.ez - 0.1 - (dJ - 0.25)) * i) / n;
      path.push([xv, Y(d) - 0.02, sz * (T.ez - d)]);
    }
    ridgeAlong(tile, path, 0.44, 4, 0.1, 0.13, 0.4);
    // onigawara at the lower end of kudarimune, facing down-slope (outward along z)
    const pe = path[path.length - 1], pp = path[path.length - 2];
    const dir = v3.norm(v3.sub(pe, pp));
    const dirH = v3.norm([0, 0, dir[2]]);
    void dir;
    onigawara(tile, gold, basis(v3.add(pe, [0, -0.12, 0]), v3.cross([0, 1, 0], dirH), [0, 1, 0], dirH), 0.9, 1.15, 0.24, { hornLen: 0.62, goldEdge: true });
    // hip ridge from the junction to the eave corner
    const hp = [];
    const m = 14;
    for (let i = 0; i <= m; i++) {
      const d = (dJ - 0.35) * (1 - i / m) + 0.12 * (i / m);
      hp.push([sx * (T.ex - d), Y(d) - 0.03, sz * (T.ez - d)]);
    }
    ridgeAlong(tile, hp, 0.46, 4, 0.1, 0.13, 0.18);
    // onigawara at the corner end of the hip (faces diagonally outward)
    const he = hp[hp.length - 1];
    const hd = v3.norm([sx, 0, sz]);
    onigawara(tile, gold, basis(v3.add(he, [0, -0.1, 0]), v3.cross([0, 1, 0], hd), [0, 1, 0], hd), 0.82, 1.05, 0.22, { hornLen: 0.7, goldEdge: true });
    // small gold kirikane crest on the hip end tile
  }
}

// Gable (tsuma) of the irimoya at x = sx*xg: wall triangle, frame, bargeboards,
// purlin ends, gegyo/kegyo, verge soffit, gable-foot ridge.
export function buildIrimoyaGables(acc, T, mats) {
  const tile = acc.m(mats.tile), gold = acc.m(mats.gold), red = acc.m(mats.red), redD = acc.m(mats.soffit || mats.redDark), white = acc.m(mats.plaster);
  const redA = acc.m(mats.redA || mats.red);
  const Y = (d) => T.y0 + T.prof.P(d);
  const dg = T.ex - T.xg; // gable base depth
  const zg = T.ez - dg; // gable base half width
  const Hg = Y(dg);
  const dJ = T.ex - T.xb;
  const under = 0.5; // roof thickness at the verge (tile top to soffit)
  for (const sx of [-1, 1]) {
    const xw = sx * T.xg;
    // --- gable wall: triangle under the roof, two layers (boards + frame)
    const outline = [];
    const N = 24;
    outline.push([-zg, Hg + 0.05]);
    for (let i = 0; i <= N; i++) { const z = -zg + (2 * zg * i) / N; const d = T.ez - Math.abs(z); outline.push([z, Y(d) - under - 0.12]); }
    outline.push([zg, Hg + 0.05]);
    // local frame: shape XY = (z, y), extrude along x outward
    const Xw = basis([xw, 0, 0], [0, 0, -sx], [0, 1, 0], [sx, 0, 0]);
    // note: basis x-axis maps shape-x to world -sx*z ... use direct z mapping instead
    const Xg = basis([xw, 0, 0], [0, 0, 1], [0, 1, 0], [sx, 0, 0]);
    extrude(acc.m(mats.panel), Xg, outline, [], -0.25, 0.0);
    void Xw;
    // horizontal beams on the gable face (koryo + nuki) with gold sleeves
    const face = (z, y, dx = 0) => [xw + sx * dx, y, z];
    const beamsY = [Hg + 0.35, Hg + 1.55, Hg + 2.75];
    carveSideGable(acc, mats, xw, sx, zg, beamsY, (z) => Y(T.ez - Math.abs(z)) - under - 0.2);
    for (const by of beamsY) {
      // width at this height
      let zz = zg; for (let z = 0; z <= zg; z += 0.02) { if (Y(T.ez - z) - under - 0.12 < by + 0.2) { zz = z; break; } }
      if (zz < 0.4) continue;
      beam(redA, face(-zz, by, 0.08), face(zz, by, 0.08), 0.16, 0.26, 0.02);
      for (const s of [-1, 1]) cbox(gold, xf(face(s * (zz - 0.12), by, 0.08)), 0.1, 0.15, 0.12, 0.006);
    }
    // vertical struts (taiheizuka) + diagonal sasu
    for (const z of [-zg * 0.62, 0, zg * 0.62]) {
      const top = Y(T.ez - Math.abs(z)) - under - 0.15;
      beam(redA, face(z, Hg + 0.48, 0.07), face(z, top, 0.07), 0.2, 0.2, 0.02, [0, 0, 1]);
    }
    // gold ornamental panel (karakusa) between the upper beams at the centre
    kaerumata(red, gold, mul(xf(face(0, beamsY[0] + 0.13, 0.12)), basis([0, 0, 0], [0, 0, 1], [0, 1, 0], [sx, 0, 0])), 1.4, 0.95, 0.16);
    kaerumata(red, gold, mul(xf(face(-zg * 0.31, beamsY[0] + 0.13, 0.12)), basis([0, 0, 0], [0, 0, 1], [0, 1, 0], [sx, 0, 0])), 1.1, 0.95, 0.14);
    kaerumata(red, gold, mul(xf(face(zg * 0.31, beamsY[0] + 0.13, 0.12)), basis([0, 0, 0], [0, 0, 1], [0, 1, 0], [sx, 0, 0])), 1.1, 0.95, 0.14);
    // --- gable foot ridge (where the hip face meets the gable wall)
    const fp = [];
    for (let i = 0; i <= 12; i++) fp.push([xw + sx * 0.18, Hg - 0.05, -zg + (2 * zg * i) / 12]);
    ridgeAlong(tile, fp, 0.4, 2, 0.1, 0.11, 0.35);
    // --- verge soffit between gable wall and bargeboard
    {
      const rows = [];
      const n = 30;
      for (let i = 0; i <= n; i++) {
        const z = -(T.ez - dJ) + (2 * (T.ez - dJ) * i) / n;
        const d = T.ez - Math.abs(z);
        const y = Y(d) - under;
        rows.push([redD.v(xw, y, z, 0, -1, 0), redD.v(sx * (T.xb + 0.02), y, z, 0, -1, 0)]);
      }
      redD.begin(null);
      for (let i = 0; i < n; i++) redD.quadN(rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]);
      // purlin ends (moya) projecting through the verge to the bargeboard
      for (const dd of [dJ + 0.6, dJ + (T.ez - dJ) * 0.45, dJ + (T.ez - dJ) * 0.78]) for (const sz of [-1, 1]) {
        const z = sz * (T.ez - dd);
        const y = Y(dd) - under - 0.14;
        beam(redA, [xw, y, z], [sx * (T.xb - 0.05), y, z], 0.2, 0.24, 0.02);
      }
      const yr = Y(T.ez) - under - 0.16;
      beam(redA, [xw, yr, 0], [sx * (T.xb - 0.05), yr, 0], 0.24, 0.28, 0.02);
    }
    // --- bargeboards (hafu-ita) following the verge, meeting at the apex
    for (const sz of [-1, 1]) {
      const path = [];
      const n = 22;
      const dEnd = dJ - 0.55;
      for (let i = 0; i <= n; i++) {
        const d = T.ez - ((T.ez - dEnd) * i) / n;
        path.push([sx * (T.xb + 0.04), Y(d) - 0.07, sz * (T.ez - d)]);
      }
      const prof = [[-0.09, -0.62], [0.09, -0.62], [0.09, 0], [-0.09, 0]];
      sweep(red, path, prof, { closed: true, caps: true });
      // gold bottom edging and top edging
      sweep(gold, path.map((p) => [p[0] + sx * 0.0, p[1] - 0.6, p[2]]), [[-0.105, -0.04], [0.105, -0.04], [0.105, 0.03], [-0.105, 0.03]], { closed: true, caps: true });
      sweep(gold, path.map((p) => [p[0], p[1] - 0.02, p[2]]), [[-0.1, -0.025], [0.1, -0.025], [0.1, 0.025], [-0.1, 0.025]], { closed: true, caps: true });
      // gold rosettes along the bargeboard (kugikakushi) where purlins meet
      for (const dd of [dJ + 0.6, dJ + (T.ez - dJ) * 0.45, dJ + (T.ez - dJ) * 0.78]) {
        const z = sz * (T.ez - dd);
        const y = Y(dd) - 0.07 - 0.31;
        kanagu(gold, basis([sx * (T.xb + 0.128), y, z], [0, 0, 1], [0, 1, 0], [sx, 0, 0]), 0.5, 0.48, 0.01);
        rosette(gold, basis([sx * (T.xb + 0.142), y, z], [0, 0, 1], [0, 1, 0], [sx, 0, 0]), 0.13, 8, 0.035);
      }
      // kegyo (gold end ornament) at the lower end of the bargeboard
      const pe = path[path.length - 1];
      gegyo(acc.m(mats.goldR || mats.goldL || mats.gold), null, basis([pe[0] + sx * 0.12, pe[1] - 0.05, pe[2]], [0, 0, sz], [0, 1, 0], [sx, 0, 0]).multiply(xf([0, 0, 0], 0, 0, 0, [0.55, 0.7, 1])), 1.0, 0.9, 0.1, acc.m(mats.goldC || mats.gold));
    }
    // gegyo at the apex
    gegyo(acc.m(mats.goldR || mats.goldL || mats.gold), red, mul(basis([sx * (T.xb + 0.16), Y(T.ez) - 0.42, 0], [0, 0, 1], [0, 1, 0], [sx, 0, 0]), xf([0, 0, 0])), 2.0, 1.55, 0.14, acc.m(mats.goldC || mats.gold));
  }
}
