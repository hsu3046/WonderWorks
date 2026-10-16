// ---------------------------------------------------------------------------
// hall-kara: karahafu porch (cusped bargeboard gable over the stairs) and the
// chidori-hafu (triangular dormer gable) on the front of the main roof.
// Hall-local coordinates.
// ---------------------------------------------------------------------------
import { cbox, beam, lathe, extrude, sweep, bar, xf, basis, mul, v3, clamp, lerp, sstep, circlePts } from './hall-lib.js';
import { onigawara, tileDisc, rosette, gegyo, kaerumata, giboshi, bez, kanagu } from './hall-orn.js';
import { TILE, emitRound, emitPan, noshiProfile, ridgeAlong } from './hall-roof.js';
import { carveKaraGable, carveKoryo, carveChidori } from './hall-gable.js';

// 1D arc-length table for a curve y = f(x) over [x0,x1]
function arcTable(f, x0, x1, n = 600) {
  const S = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const a = x0 + ((x1 - x0) * (i - 1)) / n, b = x0 + ((x1 - x0) * i) / n;
    S[i] = S[i - 1] + Math.hypot(b - a, f(b) - f(a));
  }
  const xOf = (s) => {
    if (s <= 0) return x0; if (s >= S[n]) return x1;
    let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    return x0 + ((x1 - x0) * (lo + (s - S[lo]) / (S[hi] - S[lo]))) / n;
  };
  return { total: S[n], xOf };
}

function halfRowSamples(total) {
  // s from the eave (0) toward the crest (total); tiles every L
  const L = TILE.L; const out = [];
  out.push([0, 1, 0]);
  for (let k = 0; k * L < total; k++) {
    for (const [s, p] of [[k * L, 1], [k * L + 0.5 * L, 0.5], [k * L + L - 0.007, 0.02]]) {
      if (s <= 1e-4 || s >= total - 1e-4) continue;
      out.push([s, p, k]);
    }
  }
  out.push([total, 1 - (total / L - Math.floor(total / L)), Math.floor(total / L)]);
  return out;
}

// ---------------------------------------------------------------------------
// KARAHAFU
// ---------------------------------------------------------------------------
export function karahafuParams() {
  const K = {
    zc: 12.4, // porch column line
    zf: 14.45, // bargeboard plane (front)
    xc: 5.57, // porch column half-spacing
    Wk: 7.15, // half width at eaves
    ye: 8.52, // tile top at side eaves
    Hk: 1.78, // crest rise
    colTop: 7.05,
  };
  K.f = (x) => {
    const u = Math.min(Math.abs(x) / K.Wk, 1.08);
    const base = (1 + Math.cos(Math.PI * Math.min(u, 1))) / 2;
    const up = 0.055 * Math.pow(sstep(0.82, 1.08, u), 2);
    return K.ye + K.Hk * (base + up) + (u > 1 ? K.Hk * 0.0 : 0);
  };
  K.df = (x) => (K.f(x + 0.002) - K.f(x - 0.002)) / 0.004;
  return K;
}

export function buildKarahafu(acc, mats, R, K, mokoshiY, anchors) {
  const tile = acc.m(mats.tile), gold = acc.m(mats.gold), red = acc.m(mats.red), redD = acc.m(mats.soffit || mats.redDark), redA = acc.m(mats.redA || mats.red);
  const f = K.f, df = K.df;
  const zBackVisible = (x, z) => f(x) > mokoshiY(x, z) + 0.02;
  const hide = (x, z, y) => !(y > mokoshiY(x, z) - 0.01);
  // ---- tiles: rows along x at fixed z, in two halves meeting at the crest
  const half = arcTable(f, 0, K.Wk); // x from 0 (crest) to Wk (eave)
  const rows = [];
  for (let z = K.zf - 0.12; z > 6.0; z -= TILE.S) { if (!zBackVisible(0, z)) break; rows.push(z); }
  // add rows until fully hidden (sides already hidden earlier)
  const total = half.total;
  for (let i = 0; i < rows.length; i++) {
    const z = rows[i];
    for (const sgn of [-1, 1]) {
      const rowPt = (s) => {
        const x = sgn * half.xOf(total - s); // s=0 at eave
        const m = sgn * df(Math.abs(x)) * 1; // slope dy/dx at x
        const dydx = sgn > 0 ? df(x) : -df(-x);
        const n = v3.norm([-dydx, 1, 0]);
        return { p: [x, f(x), z], n, t: [0, 0, 1] };
      };
      const smp = halfRowSamples(total);
      emitRound(tile, smp, rowPt, R, hide);
      if (i < rows.length - 1) emitPan(tile, smp, rowPt, -(z - rows[i + 1]) + TILE.r0 * 0.72, -TILE.r0 * 0.72, hide, z * 5.3 + sgn * 2.1);
    }
    // eave end discs at both side eaves + lips
    for (const sgn of [-1, 1]) {
      const x = sgn * K.Wk;
      if (!(f(x) > mokoshiY(x, z) - 0.05)) continue;
      const n = v3.norm([-(sgn > 0 ? df(x) : -df(-x)), 1, 0]);
      const out = [sgn, 0, 0];
      const c = v3.add([x, f(x), z], v3.scale(n, TILE.r0 * 0.45));
      tileDisc(tile, gold, basis(v3.add(c, [sgn * 0.01, 0, 0]), [0, 0, sgn], out, v3.cross([0, 0, sgn], out)), 0.122, 0.05, true);
    }
  }
  // front verge pan beyond the first row (covers to the bargeboard)
  {
    const z = rows[0];
    for (const sgn of [-1, 1]) {
      const rowPt = (s) => { const x = sgn * half.xOf(total - s); const dydx = sgn > 0 ? df(x) : -df(-x); return { p: [x, f(x), z], n: v3.norm([-dydx, 1, 0]), t: [0, 0, 1] }; };
      emitPan(tile, halfRowSamples(total), rowPt, TILE.r0 * 0.6, 0.16, null);
    }
  }
  // crest ridge running back from the front
  {
    const pth = [];
    for (let z = K.zf - 0.05; z > 6.0; z -= 0.4) { pth.push([0, f(0) - 0.02, z]); if (!zBackVisible(0, z - 0.6)) { pth.push([0, f(0) - 0.02, z - 0.5]); break; } }
    if (pth.length > 1) ridgeAlong(tile, pth, 0.42, 2, 0.1, 0.15, 0.3);
    // karahafu onigawara at the front of the crest
    onigawara(tile, gold, basis([0, f(0) - 0.1, K.zf + 0.02], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 1.05, 1.2, 0.26, { hornLen: 0.8, goldEdge: true, flame: 0.4 });
  }
  // ---- bargeboard following the curve, extended past the eaves with flared tips
  const bb = [];
  const xe = K.Wk + 0.42;
  for (let i = 0; i <= 64; i++) {
    const x = -xe + (2 * xe * i) / 64;
    bb.push([x, f(x) - 0.06, K.zf + 0.06]);
  }
  const bbProf = [[-0.62, -0.1], [0.0, -0.1], [0.0, 0.1], [-0.62, 0.1]].map(([v, u]) => [u, v]);
  // sweep frame: T along x, U = up (orthogonalised), S = T x U = +z
  sweep(red, bb, [[-0.1, -0.62], [0.1, -0.62], [0.1, 0], [-0.1, 0]], { closed: true, caps: true });
  void bbProf;
  sweep(gold, bb, [[-0.115, -0.66], [0.115, -0.66], [0.115, -0.59], [-0.115, -0.59]], { closed: true, caps: true });
  sweep(gold, bb, [[-0.11, -0.05], [0.11, -0.05], [0.11, 0.0], [-0.11, 0.0]], { closed: true, caps: true });
  // gold rosettes along the board
  for (const x of [-6.0, -4.3, -2.6, 2.6, 4.3, 6.0]) {
    const dydx = x > 0 ? df(x) : -df(-x);
    const t = v3.norm([1, dydx, 0]); const U = v3.norm(v3.sub([0, 1, 0], v3.scale(t, t[1])));
    const c = v3.add([x, f(x) - 0.06, K.zf + 0.17], v3.scale(U, -0.31));
    kanagu(gold, basis(v3.add(c, [0, 0, -0.012]), t, U, [0, 0, 1]), 0.46, 0.5, 0.01);
    rosette(gold, basis(v3.add(c, [0, 0, 0.004]), t, U, [0, 0, 1]), 0.12, 8, 0.035);
  }
  // big gold gegyo at the centre under the crest
  gegyo(acc.m(mats.goldR || mats.goldL || mats.gold), red, basis([0, f(0) - 0.55, K.zf + 0.2], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 2.2, 1.35, 0.16, acc.m(mats.goldC || mats.gold));
  // flared bargeboard tips (gold caps)
  for (const sgn of [-1, 1]) {
    const p = bb[sgn < 0 ? 0 : bb.length - 1];
    cbox(gold, xf([p[0], p[1] - 0.31, p[2]]), 0.03, 0.34, 0.12, 0.01);
  }
  // ---- porch structure
  const colR = 0.3;
  for (const sx of [-1, 1]) {
    const x = sx * K.xc;
    // column on soseki (podium top 1.6)
    lathe(acc.m(mats.granite), xf([x, 1.6, K.zc]), [[0, 0], [0.5, 0], [0.5, 0.08], [0.42, 0.14], [0.36, 0.16], [0, 0.16]], 24);
    lathe(redA, xf([x, 1.74, K.zc]), [[0, 0], [colR, 0], [colR, K.colTop - 1.74], [0, K.colTop - 1.74]], 28);
    // black & gold foot band
    lathe(acc.m(mats.black), xf([x, 1.74, K.zc]), [[colR + 0.012, 0], [colR + 0.012, 0.32], [0, 0.32]], 28);
    lathe(gold, xf([x, 2.04, K.zc]), [[colR + 0.018, 0], [colR + 0.018, 0.035], [0, 0.035]], 28);
    lathe(gold, xf([x, K.colTop - 0.62, K.zc]), [[colR + 0.014, 0], [colR + 0.014, 0.05], [0, 0.05]], 28);
    // head tie to the main column (ebi-koryo: curved shrimp beam)
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const z = K.zc + (8.5 - K.zc) * t;
      const y = K.colTop - 0.45 + 0.55 * Math.sin((t * Math.PI) / 2) ** 1.5;
      pts.push([x, y, z]);
    }
    sweep(redA, pts, [[-0.11, -0.17], [0.11, -0.17], [0.11, 0.17], [-0.11, 0.17]], { closed: true, caps: true });
    sweep(gold, pts.slice(0, 3), [[-0.125, -0.185], [0.125, -0.185], [0.125, 0.185], [-0.125, 0.185]], { closed: true, caps: true });
    // daito + simple bracket on the porch column
    cbox(red, xf([x, K.colTop + 0.12, K.zc]), 0.32, 0.12, 0.32, 0.014, { taper: [0.8, 0.8] });
    cbox(gold, xf([x, K.colTop + 0.16, K.zc + 0.325]), 0.27, 0.06, 0.005, 0.003);
    // side tie beam from porch column outward to the side eave (supports eave)
    beam(red, [x, K.colTop + 0.38, K.zc], [sx * (K.Wk - 0.2), K.colTop + 0.38 + 0.12, K.zc], 0.18, 0.22, 0.015);
    // front lanterns hanging under the porch (between porch column and wall)
    anchors.hangingLanterns.push({ pos: [sx * 3.55, K.f(sx * 3.55) - 0.62 - 0.14, (K.zc + 8.5) / 2 + 0.6], scale: 1.15, rotY: 0 });
    // big front lanterns hung from the karahafu vault just outside the porch
    // columns, in front of the side tie beam (visible under the bargeboard)
    {
      const xl = sx * 6.42, Dl = 0.62 - 0.32 * sstep(0.6, 1.0, 6.42 / K.Wk);
      anchors.hangingLanterns.push({ pos: [xl, K.f(xl) - Dl - 0.1, 13.35], scale: 1.5, rotY: 0 });
    }
  }
  // koryo (rainbow beam) between porch columns, kibana ends projecting
  {
    const pts = []; const n = 24; const xe2 = K.xc + 0.75;
    for (let i = 0; i <= n; i++) { const x = -xe2 + (2 * xe2 * i) / n; pts.push([x, K.colTop - 0.25 + 0.08 * Math.cos((Math.PI * x) / (2 * xe2)), K.zc]); }
    sweep(redA, pts, [[-0.16, -0.26], [0.16, -0.26], [0.16, 0.26], [-0.16, 0.26]], { closed: true, caps: true });
    for (const vv of [-0.2, 0.2]) sweep(gold, pts, [[0.155, vv - 0.012], [0.172, vv - 0.012], [0.172, vv + 0.012], [0.155, vv + 0.012]], { closed: true, caps: true });
    // gold kirikane bands near the columns
    for (const x of [-K.xc + 0.45, K.xc - 0.45]) cbox(gold, xf([x, K.colTop - 0.25 + 0.08 * Math.cos((Math.PI * x) / (2 * xe2)), K.zc]), 0.06, 0.27, 0.17, 0.005);
    // carved gilt motifs on the beam face
    carveKoryo(acc, mats, (x) => K.colTop - 0.25 + 0.08 * Math.cos((Math.PI * x) / (2 * xe2)), K.zc + 0.16, xe2);
    // kibana carved ends: gold caps
    for (const s of [-1, 1]) {
      cbox(gold, xf([s * (xe2 + 0.005), K.colTop - 0.25, K.zc]), 0.012, 0.25, 0.15, 0.004);
      rosette(gold, basis([s * (xe2 + 0.02), K.colTop - 0.25, K.zc], [0, 0, -s], [0, 1, 0], [s, 0, 0]), 0.11, 6, 0.03);
    }
  }
  // gable panel under the bargeboard, set back
  {
    const zp = K.zf - 0.35;
    const outline = [];
    const n = 40; const xw = K.xc + 0.6;
    outline.push([-xw, K.colTop + 0.02]);
    for (let i = 0; i <= n; i++) { const x = -xw + (2 * xw * i) / n; outline.push([x, Math.max(f(x) - 0.62, K.colTop + 0.1)]); }
    outline.push([xw, K.colTop + 0.02]);
    extrude(acc.m(mats.panel || mats.soffit), xf([0, 0, zp - 0.06]), outline, [], 0, 0.06);
    carveKaraGable(acc, mats, K, zp);
    // central kaerumata with gold + flanking frame struts
    kaerumata(red, gold, xf([0, K.colTop + 0.02, zp + 0.1]), 1.8, 1.25, 0.2);
    for (const s of [-1, 1]) {
      beam(red, [s * 2.4, K.colTop + 0.02, zp + 0.06], [s * 2.4, f(s * 2.4) - 0.62, zp + 0.06], 0.16, 0.16, 0.015, [0, 0, 1]);
      kaerumata(red, gold, xf([s * 3.9, K.colTop + 0.02, zp + 0.08]), 1.2, 0.62, 0.16);
    }
    // horizontal beam across the gable panel
    beam(red, [-xw, K.colTop + 1.3, zp + 0.08], [xw, K.colTop + 1.3, zp + 0.08], 0.2, 0.24, 0.015);
  }
  // curved vault soffit and ribs (rafters) under the karahafu
  {
    const zA = 8.62, zB = K.zf - 0.02;
    const nx = 60, nz = 8;
    const Dl = (x) => 0.62 - 0.32 * sstep(0.6, 1.0, Math.abs(x) / K.Wk);
    const rows2 = [];
    for (let j = 0; j <= nz; j++) {
      const z = zA + ((zB - zA) * j) / nz; const row = [];
      for (let i = 0; i <= nx; i++) { const x = -K.Wk + (2 * K.Wk * i) / nx; row.push(redD.v(x, f(x) - Dl(x), z, 0, -1, 0)); }
      rows2.push(row);
    }
    redD.begin(null);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) redD.quadN(rows2[j][i], rows2[j][i + 1], rows2[j + 1][i + 1], rows2[j + 1][i]);
    // ribs
    for (let z = zA + 0.12; z < zB - 0.05; z += 0.26) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const x = -(K.Wk + 0.1) + (2 * (K.Wk + 0.1) * i) / 40; pts.push([x, f(x) - Dl(x) - 0.055, z]); }
      sweep(redA, pts, [[-0.05, -0.06], [0.05, -0.06], [0.05, 0.06], [-0.05, 0.06]], { closed: true, caps: true });
      for (const s of [-1, 1]) { const p = pts[s < 0 ? 0 : pts.length - 1]; cbox(gold, xf([p[0] + s * 0.006, p[1], p[2]]), 0.007, 0.068, 0.058, 0.003); }
    }
    // back closure against the facade
    const back = [[-K.Wk, 7.95]];
    for (let i = 0; i <= 40; i++) { const x = -K.Wk + (2 * K.Wk * i) / 40; back.push([x, f(x) - Dl(x) + 0.02]); }
    back.push([K.Wk, 7.95]);
    extrude(redD, xf([0, 0, 8.56]), back, [], 0, 0.04);
    // side eave fascia boards (at x = +-Wk) from vault edge up to tile lip
    for (const s of [-1, 1]) {
      const x = s * (K.Wk + 0.12);
      const yb = f(K.Wk) - Dl(K.Wk) - 0.12, yt = f(K.Wk) - 0.06;
      beam(red, [x, (yb + yt) / 2, zA - 0.4], [x, (yb + yt) / 2, zB + 0.2], 0.12, yt - yb, 0.012);
      beam(gold, [x + s * 0.065, yb + 0.03, zA - 0.4], [x + s * 0.065, yb + 0.03, zB + 0.2], 0.012, 0.05, 0.004);
    }
  }
}

// ---------------------------------------------------------------------------
// CHIDORI-HAFU (triangular dormer gable on the main roof front slope)
// ---------------------------------------------------------------------------
export function buildChidori(acc, mats, R, C, mainY) {
  const tile = acc.m(mats.tile), gold = acc.m(mats.gold), red = acc.m(mats.red), redD = acc.m(mats.soffit || mats.redDark);
  const Q = (x) => C.ye + C.H * Math.pow(Math.max(0, 1 - Math.abs(x) / C.W), 1.22);
  const dQ = (x) => (Q(x + 0.002) - Q(x - 0.002)) / 0.004;
  const vis = (x, z) => Q(x) > mainY(z) + 0.02;
  const hide = (x, z, y) => !(y > mainY(z) - 0.01);
  const half = arcTable(Q, 0, C.W);
  const rows = [];
  for (let z = C.zf - 0.1; z > C.zf - 9; z -= TILE.S) { if (!vis(0, z)) break; rows.push(z); }
  const total = half.total;
  for (let i = 0; i < rows.length; i++) {
    const z = rows[i];
    for (const sgn of [-1, 1]) {
      const rowPt = (s) => { const x = sgn * half.xOf(total - s); const n = v3.norm([-dQ(x), 1, 0]); return { p: [x, Q(x), z], n, t: [0, 0, 1] }; };
      const smp = halfRowSamples(total);
      emitRound(tile, smp, rowPt, R, hide);
      if (i < rows.length - 1) emitPan(tile, smp, rowPt, -(z - rows[i + 1]) + TILE.r0 * 0.72, -TILE.r0 * 0.72, hide, z * 5.3 + sgn * 2.1);
      if (i === 0) emitPan(tile, smp, rowPt, TILE.r0 * 0.6, 0.14, null);
    }
    for (const sgn of [-1, 1]) {
      const x = sgn * C.W;
      if (!(Q(x) > mainY(z) - 0.03)) continue;
      const n = v3.norm([-dQ(x), 1, 0]);
      const c = v3.add([x, Q(x), z], v3.scale(n, TILE.r0 * 0.45));
      tileDisc(tile, gold, basis(v3.add(c, [sgn * 0.01, 0, 0]), [0, 0, sgn], [sgn, 0, 0], v3.cross([0, 0, sgn], [sgn, 0, 0])), 0.122, 0.05, true);
    }
  }
  // ridge on the crest + onigawara at the front
  {
    const pth = [];
    for (let z = C.zf; z > C.zf - 9; z -= 0.4) { pth.push([0, Q(0) - 0.02, z]); if (!vis(0, z - 0.5)) { pth.push([0, Q(0) - 0.02, z - 0.6]); break; } }
    ridgeAlong(tile, pth, 0.46, 4, 0.1, 0.14, 0.4);
    onigawara(tile, gold, basis([0, Q(0) - 0.16, C.zf + 0.08], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 1.0, 1.35, 0.26, { hornLen: 0.75, goldEdge: true, flame: 0.42 });
  }
  // bargeboards
  for (const sgn of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const x = sgn * (C.W + 0.3) * (i / 20); pts.push([x, Q(x) - 0.06, C.zf + 0.05]); }
    sweep(red, pts, [[-0.09, -0.52], [0.09, -0.52], [0.09, 0], [-0.09, 0]], { closed: true, caps: true });
    sweep(gold, pts, [[-0.105, -0.56], [0.105, -0.56], [0.105, -0.49], [-0.105, -0.49]], { closed: true, caps: true });
    sweep(gold, pts, [[-0.1, -0.045], [0.1, -0.045], [0.1, 0.0], [-0.1, 0.0]], { closed: true, caps: true });
    for (const t of [0.35, 0.68]) {
      const x = sgn * C.W * t; const tt = v3.norm([1, dQ(x), 0]); const U = v3.norm(v3.sub([0, 1, 0], v3.scale(tt, tt[1])));
      rosette(gold, basis(v3.add([x, Q(x) - 0.06, C.zf + 0.15], v3.scale(U, -0.27)), tt, U, [0, 0, 1]), 0.11, 8, 0.03);
    }
    const pe = pts[pts.length - 1];
    gegyo(acc.m(mats.goldR || mats.goldL || mats.gold), null, mul(basis([pe[0], pe[1] - 0.05, pe[2] + 0.1], [sgn, 0, 0], [0, 1, 0], [0, 0, 1]), xf([0, 0, 0], 0, 0, 0, [0.5, 0.65, 1])), 1.0, 0.9, 0.1, acc.m(mats.goldC || mats.gold));
  }
  gegyo(acc.m(mats.goldR || mats.goldL || mats.gold), red, basis([0, Q(0) - 0.38, C.zf + 0.18], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 1.7, 1.3, 0.14, acc.m(mats.goldC || mats.gold));
  // gable face (set back) with kitsuregoshi lattice and frame
  {
    const zp = C.zf - 0.7;
    const base = mainY(zp) - 0.1;
    const outline = [[-C.W, base]];
    for (let i = 0; i <= 30; i++) { const x = -C.W + (2 * C.W * i) / 30; outline.push([x, Math.max(Q(x) - 0.5, base)]); }
    outline.push([C.W, base]);
    extrude(acc.m(mats.panel || mats.soffit), xf([0, 0, zp - 0.08]), outline, [], 0, 0.08);
    carveChidori(acc, mats, C, Q, zp, base);
    // vertical lattice bars
    for (let x = -C.W + 0.25; x < C.W - 0.2; x += 0.2) {
      const top = Q(x) - 0.52; if (top < base + 1.6) continue;
      beam(red, [x, base + 1.44, zp + 0.035], [x, top, zp + 0.035], 0.06, 0.07, 0.008, [0, 0, 1]);
    }
    // horizontal beams with gold sleeves
    for (const hy of [base + 0.32, base + 1.35]) {
      let xx = 0; for (let x = 0; x < C.W; x += 0.02) { if (Q(x) - 0.5 < hy + 0.15) { xx = x; break; } xx = x; }
      if (xx < 0.4) continue;
      beam(red, [-xx, hy, zp + 0.1], [xx, hy, zp + 0.1], 0.14, 0.22, 0.015);
      for (const s of [-1, 1]) cbox(gold, xf([s * (xx - 0.15), hy, zp + 0.1]), 0.09, 0.125, 0.085, 0.005);
    }
    kaerumata(red, gold, xf([0, base + 0.43, zp + 0.12]), 1.2, 0.9, 0.15);
    // verge soffit between the gable face and the bargeboard
    const rowsV = [];
    for (let i = 0; i <= 30; i++) {
      const x = -C.W - 0.25 + (2 * (C.W + 0.25) * i) / 30;
      const y = Q(x) - 0.5;
      rowsV.push([redD.v(x, y, zp, 0, -1, 0), redD.v(x, y, C.zf + 0.02, 0, -1, 0)]);
    }
    redD.begin(null);
    for (let i = 0; i < 30; i++) redD.quadN(rowsV[i][0], rowsV[i][1], rowsV[i + 1][1], rowsV[i + 1][0]);
    // purlin ends under the verge
    for (const x of [-C.W * 0.62, -C.W * 0.3, 0, C.W * 0.3, C.W * 0.62]) {
      const y = Q(x) - 0.62;
      beam(red, [x, y, zp], [x, y, C.zf - 0.05], 0.16, 0.2, 0.015);
    }
    // side eave fascias along z at x = +-W
    for (const s of [-1, 1]) {
      const x = s * (C.W + 0.06);
      const zA = C.zf + 0.05; let zB = zA; for (let z = zA; z > zA - 3; z -= 0.05) { zB = z; if (Q(C.W) - 0.08 < mainY(z)) break; }
      if (zA - zB > 0.2) beam(red, [x, Q(C.W) - 0.2, zA], [x, Q(C.W) - 0.2, zB], 0.1, 0.24, 0.01);
      // close the side triangle under the chidori eave down to the main roof
      const tri = [[zp, mainY(zp) - 0.05], [C.zf + 0.02, Math.min(Q(C.W) - 0.3, mainY(C.zf))], [C.zf + 0.02, Q(s * C.W) - 0.3]];
      void tri;
    }
  }
}
