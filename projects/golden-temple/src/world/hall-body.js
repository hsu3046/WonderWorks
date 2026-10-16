// ---------------------------------------------------------------------------
// hall-body: granite podium (kidan), stairs, columns, walls & facades,
// veranda (en) with railings, interior floor/ceiling shell, upper storey,
// bracket-set placement. Hall-local coordinates.
// ---------------------------------------------------------------------------
import { cbox, beam, lathe, extrude, sweep, bar, xf, basis, mul, v3, clamp, lerp, sstep } from './hall-lib.js';
import { rosette, giboshi, monCrest, kaerumata, kanagu } from "./hall-orn.js";
import { bracketSet, bracketBeams } from './hall-bracket.js';
import { hinge, pullRing, columnBand } from './hall-detail.js';

export const HB = {
  pod: { hx: 18, hz: 13.5, h: 1.6 },
  colX: [-13, -9.2857, -5.5714, -1.8571, 1.8571, 5.5714, 9.2857, 13],
  colZ: [-8.5, -5.1, -1.7, 1.7, 5.1, 8.5],
  colR: 0.32, colBase: 1.6, colTop: 8.0,
  floorY: 2.1, ceilY: 9.2,
  ver: { x: 15.4, z: 10.9 },
  up: { xs: [-9.2857, -5.5714, -1.8571, 1.8571, 5.5714, 9.2857], zs: [-4.8, -1.6, 1.6, 4.8], r: 0.27, top: 12.9, base: 10.4 },
  stair: { hw: 5.0, rise: 0.16, run: 0.31, n: 10, sideW: 0.8 },
  frontSteps: { z0: 10.9, n: 3, run: 0.28 },
};

// ------------------------------------------------------------------ podium
export function buildPodium(acc, mats, R) {
  const { hx, hz, h } = HB.pod;
  const g = acc.m(mats.granite), gm = acc.m(mats.graniteMoss), gc = acc.m(mats.stone);
  const courses = [
    { y0: 0, y1: 0.24, proj: 0.07, ms: gm, lmin: 0.9, lmax: 1.5 },
    { y0: 0.24, y1: 0.62, proj: 0, ms: gm, lmin: 0.8, lmax: 1.7 },
    { y0: 0.62, y1: 1.0, proj: 0, ms: g, lmin: 0.8, lmax: 1.7 },
    { y0: 1.0, y1: 1.36, proj: 0, ms: g, lmin: 0.8, lmax: 1.7 },
    { y0: 1.36, y1: 1.6, proj: 0.06, ms: g, lmin: 1.1, lmax: 2.0, coping: true },
  ];
  const stairHole = HB.stair.hw + HB.stair.sideW + 0.02;
  // each side: run along the edge
  const sides = [
    { o: [0, 0, 1], t: [1, 0, 0], e: hz, L: hx },
    { o: [0, 0, -1], t: [-1, 0, 0], e: hz, L: hx },
    { o: [1, 0, 0], t: [0, 0, -1], e: hx, L: hz },
    { o: [-1, 0, 0], t: [0, 0, 1], e: hx, L: hz },
  ];
  for (const S of sides) {
    const front = S.o[2] === 1;
    for (const [ci, C] of courses.entries()) {
      const depth = C.coping ? 0.55 : 0.45;
      let a = -S.L - C.proj + (ci % 2 ? R.range(0.2, 0.6) : 0);
      const aEnd = S.L + C.proj;
      // first block starts flush at the corner
      let first = true;
      a = -S.L - C.proj;
      while (a < aEnd - 0.01) {
        let len = first && ci % 2 ? R.range(C.lmin * 0.5, C.lmin) : R.range(C.lmin, C.lmax);
        first = false;
        let b = Math.min(a + len, aEnd);
        if (aEnd - b < 0.35) b = aEnd;
        // stair opening at the front
        if (front && b > -stairHole && a < stairHole) {
          if (a < -stairHole) b = -stairHole; else { a = stairHole; continue; }
        }
        const mid = (a + b) / 2, hl = (b - a) / 2 - 0.004;
        const outOff = R.range(-0.006, 0.01);
        const e = S.e + C.proj - depth / 2 + outOff;
        const yaw = R.range(-0.003, 0.003);
        const c = [S.t[0] * mid + S.o[0] * e, (C.y0 + C.y1) / 2, S.t[2] * mid + S.o[2] * e];
        const ax = S.t, az = S.o;
        const M = mul(basis(c, ax, [0, 1, 0], az), xf([0, 0, 0], yaw));
        cbox(C.ms, M, hl, (C.y1 - C.y0) / 2 - 0.003, depth / 2, C.coping ? 0.035 : 0.028);
        a = b;
      }
    }
  }
  // hidden fill
  cbox(g, xf([0, 0.78, 0]), hx - 0.4, 0.78, hz - 0.4, 0, { skip: new Set(['-y']) });
  // top paving: strip from coping inward to the wall line (and under veranda)
  const pv = (x0, x1, z0, z1, sw, sd, along) => {
    // slabs in rows; along = 'x' rows run in x
    const A0 = along === 'x' ? x0 : z0, A1 = along === 'x' ? x1 : z1;
    const B0 = along === 'x' ? z0 : x0, B1 = along === 'x' ? z1 : x1;
    let bb = B0, row = 0;
    while (bb < B1 - 0.05) {
      const be = Math.min(bb + sd, B1);
      let aa = A0 + (row % 2 ? -sw * 0.5 : 0);
      while (aa < A1 - 0.05) {
        const ae = Math.min(aa + sw * R.range(0.8, 1.25), A1);
        const a0 = Math.max(aa, A0);
        if (ae - a0 > 0.08) {
          const cA = (a0 + ae) / 2, cB = (bb + be) / 2;
          const c = along === 'x' ? [cA, 1.6 - 0.06 + R.range(-0.004, 0.003), cB] : [cB, 1.6 - 0.06 + R.range(-0.004, 0.003), cA];
          const hA = (ae - a0) / 2 - 0.006, hB = (be - bb) / 2 - 0.006;
          cbox(gc, xf(c, R.range(-0.003, 0.003)), along === 'x' ? hA : hB, 0.06, along === 'x' ? hB : hA, 0.018);
        }
        aa = ae;
      }
      bb = be; row++;
    }
  };
  const cz = hz - 0.55, cx = hx - 0.55;
  pv(-cx, cx, 8.6, cz, 0.95, 0.62, 'x');
  pv(-cx, cx, -cz, -8.6, 0.95, 0.62, 'x');
  pv(13.1, cx, -8.6, 8.6, 0.95, 0.62, 'z');
  pv(-cx, -13.1, -8.6, 8.6, 0.95, 0.62, 'z');
  // drip-line cobbles under the mokoshi eaves (amaochi): rounded stones in a shallow channel
  const dripMs = acc.m(mats.graniteMoss);
  const drip = (p0, p1) => {
    const L = v3.len(v3.sub(p1, p0)); const n = Math.floor(L / 0.16);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const p = v3.lerp(p0, p1, t);
      for (const off of [-0.09, 0.09]) {
        const dir = v3.norm(v3.sub(p1, p0)); const side = [-dir[2], 0, dir[0]];
        const q = v3.add(p, v3.scale(side, off + R.range(-0.025, 0.025)));
        const r = R.range(0.055, 0.08);
        lathe(dripMs, xf([q[0], 1.6 - 0.02, q[2]], R.range(0, 6), 0, 0, [1, R.range(0.45, 0.6), R.range(0.75, 1.1)]), [[0, 0], [r, 0], [r * 0.95, r * 0.5], [r * 0.6, r * 0.9], [0, r]], 7);
      }
    }
  };
  drip([-16.8, 0, 12.3], [-stairHole, 0, 12.3]); drip([stairHole, 0, 12.3], [16.8, 0, 12.3]);
  drip([-16.8, 0, -12.3], [16.8, 0, -12.3]);
  drip([16.8, 0, -12.2], [16.8, 0, 12.2]); drip([-16.8, 0, -12.2], [-16.8, 0, 12.2]);
}

// ------------------------------------------------------------------ stairs
export function buildStairs(acc, mats, R) {
  const S = HB.stair;
  const gc = acc.m(mats.stone), g = acc.m(mats.granite), gm = acc.m(mats.graniteMoss);
  const z0 = HB.pod.hz; // top edge of main stair at podium front
  for (let i = 1; i <= S.n; i++) {
    const yTop = S.rise * i;
    const zf = z0 + (S.n - i) * S.run;
    // split into stones
    let a = -S.hw; const cuts = [];
    while (a < S.hw - 0.01) { let b = Math.min(a + R.range(1.7, 3.0), S.hw); if (S.hw - b < 0.8) b = S.hw; cuts.push([a, b]); a = b; }
    for (const [a0, a1] of cuts) {
      const d = S.run + 0.12;
      cbox(gc, xf([(a0 + a1) / 2, yTop / 2 - 0.0, zf - d / 2 + 0.02], R.range(-0.002, 0.002)), (a1 - a0) / 2 - 0.004, yTop / 2, d / 2, 0.022);
    }
  }
  // side walls (sode-ishi) + end posts
  for (const sx of [-1, 1]) {
    const x0 = sx * S.hw, x1 = sx * (S.hw + S.sideW);
    const zTop = z0, zBot = z0 + (S.n - 1) * S.run + 0.15;
    const yT = HB.pod.h + 0.32, yB = 0.5;
    // sloped wall as extruded profile in (z,y)
    const prof = [[zTop - 0.1, 0], [zBot, 0], [zBot, yB], [zTop, yT], [zTop - 0.1, yT]];
    const X = basis([Math.min(x0, x1), 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]);
    extrude(g, X, prof, [], 0, S.sideW);
    // coping along slope
    const pA = [(x0 + x1) / 2, yT + 0.06, zTop - 0.05], pB = [(x0 + x1) / 2, yB + 0.06, zBot];
    beam(gc, pA, pB, S.sideW + 0.08, 0.13, 0.03);
    // bottom post
    // low plinth under the vermilion newel post (hall.js / hall-stair.js)
    cbox(gm, xf([(x0 + x1) / 2, 0.235, zBot + 0.14]), S.sideW / 2 + 0.06, 0.235, 0.27, 0.04);
    cbox(gc, xf([(x0 + x1) / 2, 0.475, zBot + 0.14]), S.sideW / 2 + 0.1, 0.03, 0.31, 0.02);
  }
  // wooden steps up to the veranda (kizahashi)
  const F = HB.frontSteps;
  const wood = acc.m(mats.woodX);
  for (let j = 1; j <= F.n; j++) {
    const y = HB.pod.h + ((HB.floorY - HB.pod.h) * j) / F.n;
    const zf = F.z0 + (F.n - j + 1) * F.run;
    cbox(wood, xf([0, y - 0.04, zf - F.run / 2]), S.hw - 0.05, 0.04, F.run / 2 + 0.02, 0.01);
    // risers
    cbox(acc.m(mats.redDark), xf([0, (y - 0.08 + HB.pod.h) / 2, zf - 0.03]), S.hw - 0.08, (y - 0.08 - HB.pod.h) / 2 + 0.001, 0.025, 0.004);
  }
  // stringers
  for (const sx of [-1, 1]) {
    const x = sx * (S.hw - 0.02);
    beam(acc.m(mats.red), [x, HB.floorY + 0.02, F.z0 - 0.02], [x, HB.pod.h + 0.08, F.z0 + F.n * F.run + 0.08], 0.14, 0.3, 0.015);
  }
}

// --------------------------------------------------------------- railings
// generic railing (koran) between posts along a polyline of post positions
// (each [x, yBase, z]); giboshi on posts flagged in `gibo` set (indices).
export function railing(acc, mats, posts, opts = {}) {
  const red = acc.m(mats.red), gold = acc.m(mats.gold), goldB = acc.m(mats.goldB || mats.gold);
  const H = opts.h || 0.85, pw = opts.postW || 0.14;
  const gibo = opts.gibo || new Set();
  posts.forEach((p, i) => {
    const top = p[1] + H + (gibo.has(i) ? 0.12 : 0.05);
    cbox(red, xf([p[0], (p[1] + top) / 2, p[2]]), pw / 2, (top - p[1]) / 2, pw / 2, 0.012);
    if (gibo.has(i)) {
      cbox(gold, xf([p[0], top - 0.12, p[2]]), pw / 2 + 0.012, 0.1, pw / 2 + 0.012, 0.006);
      giboshi(goldB, xf([p[0], top, p[2]]), pw * 0.62, pw * 2.6, 18);
      cbox(gold, xf([p[0], p[1] + 0.12, p[2]]), pw / 2 + 0.01, 0.06, pw / 2 + 0.01, 0.005);
    } else {
      cbox(gold, xf([p[0], top + 0.006, p[2]]), pw / 2 + 0.006, 0.008, pw / 2 + 0.006, 0.003);
    }
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (opts.skip && opts.skip.has(i)) continue;
    // top rail (round), mid rail, bottom rail
    bar(red, [a[0], a[1] + H, a[2]], [b[0], b[1] + H, b[2]], 0.048, 10, true);
    beam(red, [a[0], a[1] + H * 0.5, a[2]], [b[0], b[1] + H * 0.5, b[2]], 0.07, 0.11, 0.01);
    beam(red, [a[0], a[1] + 0.07, a[2]], [b[0], b[1] + 0.07, b[2]], 0.1, 0.1, 0.01);
    // gold sleeves at rail ends
    const dir = v3.norm(v3.sub(b, a));
    for (const [p, s] of [[a, 1], [b, -1]]) {
      const c = v3.add(p, v3.scale(dir, s * (pw / 2 + 0.06)));
      cbox(gold, basis([c[0], c[1] + H, c[2]], dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.05, 0.056, 0.056, 0.006);
      cbox(gold, basis([c[0], c[1] + H * 0.5, c[2]], dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.05, 0.06, 0.042, 0.005);
    }
    // small struts between mid and top rails
    const n = Math.max(1, Math.round(L / 0.62));
    for (let k = 1; k < n; k++) {
      const t = k / n; const p = v3.lerp(a, b, t);
      cbox(red, basis([p[0], p[1] + H * 0.75, p[2]], dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.03, H * 0.25, 0.03, 0.006);
      // lower struts
      cbox(red, basis([p[0], p[1] + H * 0.285, p[2]], dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.025, H * 0.17, 0.025, 0.005);
    }
  }
}

// ------------------------------------------------------- veranda (en)
export function buildVeranda(acc, mats, R) {
  const { x: vx, z: vz } = HB.ver;
  const fy = HB.floorY;
  const wx = acc.m(mats.woodX), wz = acc.m(mats.woodZ), red = acc.m(mats.red), redD = acc.m(mats.redDark), dark = acc.m(mats.woodDark);
  const bw = 0.3;
  // front & back boards run along x
  for (const sz of [-1, 1]) {
    for (let z = 8.5 + 0.0; z < vz - 0.01; z += bw) {
      const z1 = Math.min(z + bw, vz);
      let x = -vx + (Math.round(z / bw) % 2 ? 0 : -1.2);
      while (x < vx - 0.01) {
        const xe = Math.min(x + R.range(3.2, 4.4), vx); const xs = Math.max(x, -vx);
        if (xe - xs > 0.2) {
          const isStair = sz > 0 && z > 10.0 && Math.abs((xs + xe) / 2) < 5.0;
          void isStair;
          cbox(wx, xf([(xs + xe) / 2, fy - 0.05 + R.range(-0.003, 0.002), sz * (z + z1) / 2]), (xe - xs) / 2 - 0.003, 0.05, (z1 - z) / 2 - 0.004, 0.012);
        }
        x = xe;
      }
    }
  }
  // sides along z
  for (const sx of [-1, 1]) {
    for (let x = 13.0; x < vx - 0.01; x += bw) {
      const x1 = Math.min(x + bw, vx);
      let z = -8.5 + (Math.round(x / bw) % 2 ? 0 : -1.4);
      while (z < 8.5 - 0.01) {
        const ze = Math.min(z + R.range(3.0, 4.2), 8.5); const zs = Math.max(z, -8.5);
        if (ze - zs > 0.2) cbox(wz, xf([sx * (x + x1) / 2, fy - 0.05 + R.range(-0.003, 0.002), (zs + ze) / 2]), (x1 - x) / 2 - 0.004, 0.05, (ze - zs) / 2 - 0.003, 0.012);
        z = ze;
      }
    }
  }
  // edge beams (en-gamachi) and posts (en-zuka)
  const edge = [[-vx, vz], [vx, vz], [vx, -vz], [-vx, -vz], [-vx, vz]];
  for (let i = 0; i < 4; i++) {
    const a = edge[i], b = edge[i + 1];
    beam(red, [a[0], fy - 0.22, a[1]], [b[0], fy - 0.22, b[1]], 0.18, 0.24, 0.015);
    beam(red, [a[0] * 0.995, fy - 0.08, a[1] * 0.995], [b[0] * 0.995, fy - 0.08, b[1] * 0.995], 0.06, 0.06, 0.008);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.round(L / 1.857);
    for (let k = 0; k <= n; k++) {
      const t = k / n; const x = lerp(a[0], b[0], t) * 0.985, z = lerp(a[1], b[1], t) * 0.985;
      cbox(dark, xf([x, (1.6 + fy - 0.34) / 2, z]), 0.08, (fy - 0.34 - 1.6) / 2 + 0.01, 0.08, 0.01);
      lathe(acc.m(mats.granite), xf([x, 1.58, z]), [[0, 0], [0.16, 0], [0.15, 0.06], [0.1, 0.09], [0, 0.09]], 10);
    }
  }
  // railing posts along the edge (inset 0.12), with stair opening at the front
  const inset = 0.13; const ex = vx - inset, ez = vz - inset;
  const frontL = [], frontR = [];
  const xsFront = [-ex, ...HB.colX.filter((x) => Math.abs(x) <= 13 && Math.abs(x) > 5.2), ...HB.colX.slice(0, -1).map((x, i) => (x + HB.colX[i + 1]) / 2).filter((x) => Math.abs(x) > 5.2), ex].sort((a, b) => a - b);
  for (const x of xsFront) { if (x < -5.2) frontL.push([x, fy, ez]); if (x > 5.2) frontR.push([x, fy, ez]); }
  frontL.push([-5.15, fy, ez]); frontR.unshift([5.15, fy, ez]);
  railing(acc, mats, frontL, { gibo: new Set([0, frontL.length - 1]) });
  railing(acc, mats, frontR, { gibo: new Set([0, frontR.length - 1]) });
  const back = xsFront.map((x) => [x, fy, -ez]);
  railing(acc, mats, back, { gibo: new Set([0, back.length - 1]) });
  const zsSide = [-ez, ...HB.colZ, ...HB.colZ.slice(0, -1).map((z, i) => (z + HB.colZ[i + 1]) / 2), ez].sort((a, b) => a - b);
  for (const sx of [-1, 1]) {
    const pts = zsSide.map((z) => [sx * ex, fy, z]);
    railing(acc, mats, pts, { gibo: new Set([0, pts.length - 1]) });
  }
}

// ------------------------------------------------------- columns
export function column(acc, mats, x, z, y0, y1, r, opts = {}) {
  const red = acc.m(mats.redA || mats.red), gold = acc.m(mats.gold), black = acc.m(mats.black);
  lathe(red, xf([x, y0, z]), [[0, 0], [r, 0], [r * 0.995, (y1 - y0) * 0.5], [r * 0.975, y1 - y0], [0, y1 - y0]], 28, { hardDeg: 20 });
  if (opts.foot) {
    lathe(black, xf([x, y0, z]), [[r + 0.012, 0], [r + 0.012, 0.3], [0, 0.3]], 28);
    lathe(gold, xf([x, y0 + 0.3, z]), [[r + 0.02, 0], [r + 0.02, 0.035], [0, 0.035]], 28);
    lathe(gold, xf([x, y0 + 0.05, z]), [[r + 0.018, 0], [r + 0.018, 0.03], [0, 0.03]], 28);
  }
  if (opts.soseki) {
    lathe(acc.m(mats.granite), xf([x, opts.soseki, z]), [[0, 0], [r + 0.3, 0], [r + 0.3, 0.06], [r + 0.2, y0 - opts.soseki - 0.02], [r + 0.05, y0 - opts.soseki], [0, y0 - opts.soseki]], 24);
  }
}

// ------------------------------------------------------- walls
// Wall between two columns. p0,p1 = [x,z] of columns; out = outward unit [x,z].
// type: panel | open | renji | board | door
function bay(acc, mats, R, p0, p1, out, type, ctx2) {
  const red = acc.m(mats.red), redD = acc.m(mats.redDark), gold = acc.m(mats.gold), black = acc.m(mats.black), white = acc.m(mats.plaster);
  const redA = acc.m(mats.redA || mats.red);
  const inW = acc.m(mats.intWall), inP = acc.m(mats.intPlaster);
  const r = HB.colR;
  const fy = HB.floorY;
  const ax = v3.norm([p1[0] - p0[0], 0, p1[1] - p0[1]]);
  const o = [out[0], 0, out[1]];
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
  const half = L / 2 - r * 0.6; // between columns (into the columns a bit)
  const at = (u, y, w) => [cx + ax[0] * u + o[0] * w, y, cz + ax[2] * u + o[2] * w];
  const M = (u, y, w) => basis(at(u, y, w), ax, [0, 1, 0], o);
  const panel = (ms, u0, u1, y0, y1, w0, w1, c = 0.01) => cbox(ms, M((u0 + u1) / 2, (y0 + y1) / 2, (w0 + w1) / 2), (u1 - u0) / 2, (y1 - y0) / 2, (w1 - w0) / 2, c);
  const Y = { sill0: fy, sill1: fy + 0.26, koshi: 2.95, kn1: 3.12, nag0: 5.9, nag1: 6.15, kn0: 7.35, kh1: 7.65, top: HB.colTop };
  // --- structural beams (through columns)
  panel(redA, -L / 2, L / 2, Y.kn0, Y.kh1, -0.11, 0.11, 0.015); // kashiranuki
  // kirikane gold lines along the kashiranuki face + small gold rosettes
  for (const yy of [Y.kn0 + 0.045, Y.kh1 - 0.045]) panel(gold, -L / 2 + r + 0.02, L / 2 - r - 0.02, yy - 0.008, yy + 0.008, 0.108, 0.118, 0.003);
  for (let u = -L / 2 + r + 0.6; u < L / 2 - r - 0.4; u += 0.62) rosette(gold, M(u, (Y.kn0 + Y.kh1) / 2, 0.11), 0.045, 6, 0.015);
  panel(redA, -L / 2, L / 2, Y.top - 0.17, Y.top, -0.13, 0.13, 0.015); // daiwa (head plate)
  if (type !== 'open') panel(redA, -half, half, Y.sill0, Y.sill1, -0.12, 0.12, 0.015); // sill
  else panel(redA, -half, half, Y.sill0, Y.sill0 + 0.1, -0.12, 0.12, 0.01); // low threshold
  // nageshi (proud on the exterior face, applied to the columns)
  panel(redA, -L / 2 - 0.05, L / 2 + 0.05, Y.nag0, Y.nag1, r - 0.02, r + 0.09, 0.02);
  panel(redA, -L / 2 - 0.05, L / 2 + 0.05, Y.sill1 - 0.02, Y.sill1 + 0.16, r - 0.02, r + 0.07, 0.015); // kirime nageshi (low)
  // gold fittings at both ends
  for (const s of [-1, 1]) {
    const u = s * (L / 2 - r - 0.13);
    kanagu(gold, M(u, (Y.nag0 + Y.nag1) / 2, r + 0.088), 0.3, 0.3, 0.012);
    rosette(gold, M(s * (L / 2 - r - 0.02), (Y.nag0 + Y.nag1) / 2, r + 0.1), 0.1, 6, 0.03);
    kanagu(gold, M(u, (Y.kn0 + Y.kh1) / 2, 0.11), 0.26, 0.38, 0.012);
    kanagu(gold, M(u, Y.sill1 + 0.07, r + 0.068), 0.24, 0.22, 0.01, false);
  }
  // rosettes centred on the nageshi at the column (shared, emitted per bay end s=-1 only)
  // --- upper wall: plaster between kashiranuki and daiwa (both faces)
  panel(white, -half, half, Y.kh1, Y.top - 0.17, 0.0, 0.07, 0.006);
  panel(inP, -half, half, Y.kh1, HB.ceilY + 0.08, -0.07, 0.0, 0.006);
  // band between nageshi and kashiranuki
  if (type === 'open') {
    // lattice transom (ranma)
    panel(red, -half, half, Y.nag1, Y.nag1 + 0.08, -0.08, 0.08, 0.008);
    for (let u = -half + 0.12; u < half - 0.08; u += 0.16) panel(red, u - 0.025, u + 0.025, Y.nag1 + 0.08, Y.kn0, -0.035, 0.035, 0.006);
    for (const y of [Y.nag1 + 0.42, Y.nag1 + 0.82]) panel(red, -half, half, y - 0.02, y + 0.02, -0.03, 0.03, 0.005);
    panel(inP, -half, half, Y.kn0 - 0.02, Y.kh1, -0.07, -0.0, 0.004);
  } else {
    panel(white, -half, half, Y.nag1, Y.kn0, 0.0, 0.07, 0.006);
    panel(inP, -half, half, Y.nag1, Y.kn0, -0.07, 0.0, 0.006);
  }
  // --- main zone
  if (type === 'panel') {
    // black lacquered panel doors with big gold mon, studs and frame
    panel(black, -half, half, Y.sill1, Y.nag0, 0.0, 0.06, 0.004);
    panel(inW, -half, half, Y.sill1, Y.nag0, -0.08, 0.0, 0.004);
    // red frame stiles/rails
    const fw = 0.13;
    panel(red, -half, -half + fw, Y.sill1, Y.nag0, 0.0, 0.1, 0.012);
    panel(red, half - fw, half, Y.sill1, Y.nag0, 0.0, 0.1, 0.012);
    panel(red, -0.06, 0.06, Y.sill1, Y.nag0, 0.0, 0.09, 0.01); // meeting stile
    for (const y of [Y.sill1 + 0.06, 3.35, Y.nag0 - 0.06]) panel(red, -half, half, y - 0.06, y + 0.06, 0.0, 0.1, 0.012);
    // lattice upper part (kōshi): black bars over dark recess between 3.41 and nag0-0.12
    for (const s of [-1, 1]) {
      const u0 = s < 0 ? -half + fw : 0.06, u1 = s < 0 ? -0.06 : half - fw;
      for (let u = u0 + 0.11; u < u1 - 0.05; u += 0.12) panel(black, u - 0.022, u + 0.022, 3.41, Y.nag0 - 0.12, 0.06, 0.09, 0.005);
      for (let y = 3.6; y < Y.nag0 - 0.2; y += 0.42) panel(black, u0, u1, y - 0.018, y + 0.018, 0.06, 0.085, 0.004);
      // gold studs on the lower boards
      for (let y = Y.sill1 + 0.3; y < 3.2; y += 0.2) for (let u = u0 + 0.14; u < u1 - 0.1; u += 0.2)
        lathe(gold, mul(M(u, y, 0.06), xf([0, 0, 0], 0, Math.PI / 2)), [[0, 0], [0.026, 0], [0.022, 0.012], [0.01, 0.02], [0, 0.022]], 8);
      // gold corner L-fittings
      for (const [uu, yy] of [[u0 + 0.12, Y.sill1 + 0.17], [u1 - 0.12, Y.sill1 + 0.17], [u0 + 0.12, 3.24], [u1 - 0.12, 3.24]]) panel(gold, uu - 0.12, uu + 0.12, yy - 0.05, yy + 0.05, 0.1, 0.112, 0.004);
      // gilt hinge straps on the rails (outer stile inward), nail heads at the lattice crossings
      const uo = s < 0 ? -half + 0.02 : half - 0.02;
      const hx = s < 0 ? ax : v3.scale(ax, -1);
      for (const yy of [Y.sill1 + 0.06, 3.35, Y.nag0 - 0.06]) hinge(gold, basis(at(uo, yy, 0.1), hx, [0, 1, 0], o), 0.62, 0.085, 0.006);
      for (let u = u0 + 0.11; u < u1 - 0.05; u += 0.12) for (let y = 3.6; y < Y.nag0 - 0.2; y += 0.42)
        lathe(gold, mul(M(u, y, 0.085), xf([0, 0, 0], 0, Math.PI / 2)), [[0.017, 0], [0.013, 0.007], [0, 0.011]], 6);
      // pull ring beside the meeting stile
      pullRing(gold, M(s * 0.2, 3.35, 0.1), 0.05, 0.007);
    }
    // big gold mon roundel straddling the doors (on a black backing disc)
    const mc = (Y.nag0 + 3.41) / 2 + 0.02;
    lathe(black, mul(M(0, mc, 0.09), xf([0, 0, 0], 0, Math.PI / 2)), [[0, 0], [0.72, 0], [0.72, 0.03], [0.69, 0.05], [0, 0.05]], 40);
    monCrest(gold, M(0, mc, 0.14), 0.62, 0.035);
  } else if (type === 'open') {
    // folded doors stacked at both sides, perpendicular to the wall (outward)
    for (const s of [-1, 1]) {
      const u = s * (half - 0.08);
      for (const k of [0, 1]) {
        const uu = u - s * (0.03 + k * 0.075);
        panel(black, uu - 0.032, uu + 0.032, Y.sill1 - 0.05, Y.nag0 - 0.04, 0.12, 0.98, 0.006);
        panel(red, uu - 0.036, uu + 0.036, Y.sill1 - 0.05, Y.sill1 + 0.07, 0.12, 0.98, 0.006);
        panel(red, uu - 0.036, uu + 0.036, Y.nag0 - 0.16, Y.nag0 - 0.04, 0.12, 0.98, 0.006);
        // gold studs on the outer face of the outermost leaf
        if (k === 0) for (let y = Y.sill1 + 0.3; y < Y.nag0 - 0.4; y += 0.32) for (const w of [0.3, 0.55, 0.8])
          lathe(gold, mul(M(uu - s * 0.033, y, w), xf([0, 0, 0], -s * Math.PI / 2, 0, -s * Math.PI / 2)), [[0, 0], [0.022, 0], [0.018, 0.011], [0, 0.018]], 8);
        if (k === 0) panel(gold, uu - s * 0.034 - 0.004, uu - s * 0.034 + 0.004, 3.2, 3.6, 0.42, 0.68, 0.003);
      }
    }
  } else if (type === 'renji') {
    // koshikabe boards + renji window with diagonal square bars
    // koshikabe: black lacquer board with a gilt stud row and corner fittings
    panel(black, -half, half, Y.sill1, Y.koshi, 0.0, 0.07, 0.006);
    for (let u = -half + 0.22; u < half - 0.15; u += 0.3) lathe(gold, mul(M(u, (Y.sill1 + Y.koshi) / 2, 0.07), xf([0, 0, 0], 0, Math.PI / 2)), [[0, 0], [0.028, 0], [0.024, 0.012], [0.01, 0.02], [0, 0.022]], 8);
    for (const su of [-1, 1]) for (const yy of [Y.sill1 + 0.07, Y.koshi - 0.07]) panel(gold, su * (half - 0.14) - 0.13, su * (half - 0.14) + 0.13, yy - 0.05, yy + 0.05, 0.07, 0.082, 0.004);
    panel(inW, -half, half, Y.sill0, Y.koshi, -0.08, 0.0, 0.006);
    panel(redA, -half, half, Y.koshi, Y.kn1, -0.1, 0.1, 0.012); // koshi-nuki
    const fw = 0.14;
    panel(redA, -half, -half + fw, Y.kn1, Y.nag0, -0.1, 0.1, 0.012);
    panel(redA, half - fw, half, Y.kn1, Y.nag0, -0.1, 0.1, 0.012);
    panel(redA, -half, half, Y.nag0 - 0.1, Y.nag0, -0.1, 0.1, 0.012);
    for (let u = -half + fw + 0.1; u < half - fw - 0.05; u += 0.19) {
      cbox(redA, mul(M(u, (Y.kn1 + Y.nag0 - 0.1) / 2, 0.0), xf([0, 0, 0], Math.PI / 4)), 0.034, (Y.nag0 - 0.1 - Y.kn1) / 2, 0.034, 0.005);
    }
    // gold fittings at the window frame corners
    for (const su of [-1, 1]) for (const yy of [Y.kn1 + 0.08, Y.nag0 - 0.12]) panel(gold, su * (half - fw) - 0.09, su * (half - fw) + 0.09, yy - 0.06, yy + 0.06, 0.1, 0.112, 0.004);
    // interior skin above window
    panel(inW, -half, half, Y.nag0, Y.nag1, -0.08, 0.0, 0.004);
  } else if (type === 'board' || type === 'door') {
    panel(redD, -half, half, Y.sill1, Y.nag0, 0.0, 0.07, 0.006);
    panel(inW, -half, half, Y.sill1, Y.nag0, -0.08, 0.0, 0.006);
    if (type === 'board') {
      for (let u = -half + 0.5; u < half - 0.3; u += 0.6) panel(red, u - 0.035, u + 0.035, Y.sill1, Y.nag0, 0.0, 0.1, 0.01);
      panel(red, -half, half, 3.9, 4.06, 0.0, 0.1, 0.012);
    } else {
      panel(red, -half, half, Y.sill1, Y.nag0, 0.07, 0.11, 0.01);
      for (const s of [-1, 1]) for (let y = Y.sill1 + 0.3; y < Y.nag0 - 0.2; y += 0.3) for (let u = 0.25; u < half - 0.15; u += 0.3)
        lathe(gold, mul(M(s * u, y, 0.11), xf([0, 0, 0], 0, Math.PI / 2)), [[0, 0], [0.026, 0], [0.022, 0.012], [0, 0.02]], 8);
      panel(red, -0.05, 0.05, Y.sill1, Y.nag0, 0.1, 0.14, 0.008);
    }
  }
  // interior skin top band above nageshi for open bays handled; for others continuous
  if (type === 'open') panel(inP, -half, half, Y.nag1, Y.kn0, -0.06, -0.035, 0.004);
  void ctx2; void R;
}

export function buildWalls(acc, mats, R, frontTypes, backTypes, westTypes, eastTypes) {
  const X = HB.colX, Z = HB.colZ;
  for (let i = 0; i < X.length - 1; i++) {
    bay(acc, mats, R, [X[i], 8.5], [X[i + 1], 8.5], [0, 1], frontTypes[i]);
    bay(acc, mats, R, [X[i + 1], -8.5], [X[i], -8.5], [0, -1], backTypes[i]);
  }
  for (let j = 0; j < Z.length - 1; j++) {
    bay(acc, mats, R, [-13, Z[j]], [-13, Z[j + 1]], [-1, 0], westTypes[j]);
    bay(acc, mats, R, [13, Z[j + 1]], [13, Z[j]], [1, 0], eastTypes[j]);
  }
  // columns with soseki
  for (const x of X) for (const z of Z) {
    const edge = Math.abs(x) === 13 || Math.abs(z) === 8.5;
    if (!edge) continue;
    column(acc, mats, x, z, HB.colBase + 0.14, HB.colTop, HB.colR, { foot: true, soseki: HB.colBase - 0.02 });
    // chased gilt band under the head-tie (kashiranuki)
    columnBand(acc.m(mats.gold), xf([x, 7.1, z]), HB.colR * 0.976, 0.2, 14);
  }
  // rosettes on nageshi at each column front
  // kibana (decorated beam ends) projecting at the corner columns
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const c = [sx * 13, 7.5, sz * 8.5];
      const e = [c[0] + sx * dx * 0.75, 7.5, c[2] + sz * dz * 0.75];
      beam(acc.m(mats.red), c, e, 0.2, 0.3, 0.02);
      const dir = v3.norm(v3.sub(e, c));
      cbox(acc.m(mats.gold), basis(v3.add(e, v3.scale(dir, 0.005)), dir, [0, 1, 0], v3.cross(dir, [0, 1, 0])), 0.008, 0.16, 0.11, 0.004);
      rosette(acc.m(mats.gold), basis(v3.add(e, v3.scale(dir, 0.012)), v3.cross(dir, [0, 1, 0]), [0, 1, 0], dir), 0.09, 6, 0.03);
    }
  }
}

// --------------------------------------------------------- interior shell
export function buildInterior(acc, mats, R) {
  const fl = acc.m(mats.intFloor);
  const fy = HB.floorY;
  // long polished planks along x (0.36 wide), random lengths & butt joints, tiny bevel
  const pw = 0.36;
  for (let z = -8.5; z < 8.5 - 0.01; z += pw) {
    const z1 = Math.min(z + pw, 8.5);
    let x = -13 - R.range(0, 4.5);
    while (x < 13 - 0.01) {
      const xe = Math.min(x + R.range(4.0, 7.5), 13); const xs = Math.max(x, -13);
      if (xe - xs > 0.1) cbox(fl, xf([(xs + xe) / 2, fy - 0.05 + R.range(-0.0015, 0.0008), (z + z1) / 2]), (xe - xs) / 2 - 0.0015, 0.05, (z1 - z) / 2 - 0.0015, 0.0025);
      x = xe;
    }
  }
  // ceiling slab (flat), perimeter moulding
  const ce = acc.m(mats.intCeil);
  cbox(ce, xf([0, HB.ceilY + 0.06, 0]), 13.0, 0.06, 8.5, 0, { skip: new Set(['+y']) });
  for (const s of [-1, 1]) {
    cbox(acc.m(mats.intWall), xf([0, HB.ceilY - 0.09, s * 8.35]), 12.9, 0.09, 0.09, 0.01);
    cbox(acc.m(mats.intWall), xf([s * 12.85, HB.ceilY - 0.09, 0]), 0.09, 0.09, 8.4, 0.01);
  }
}

// ------------------------------------------------------- upper storey
export function buildUpper(acc, mats, R) {
  const U = HB.up;
  const red = acc.m(mats.red), redD = acc.m(mats.redDark), gold = acc.m(mats.gold), white = acc.m(mats.plaster);
  const redA = acc.m(mats.redA || mats.red);
  const xi = U.xs[U.xs.length - 1], zi = U.zs[U.zs.length - 1];
  for (const x of U.xs) for (const z of U.zs) {
    if (Math.abs(x) !== xi && Math.abs(z) !== zi) continue;
    column(acc, mats, x, z, U.base, U.top, U.r, {});
  }
  // walls between upper columns
  const sides = [];
  for (let i = 0; i < U.xs.length - 1; i++) { sides.push([[U.xs[i], zi], [U.xs[i + 1], zi], [0, 1]]); sides.push([[U.xs[i + 1], -zi], [U.xs[i], -zi], [0, -1]]); }
  for (let j = 0; j < U.zs.length - 1; j++) { sides.push([[-xi, U.zs[j]], [-xi, U.zs[j + 1]], [-1, 0]]); sides.push([[xi, U.zs[j + 1]], [xi, U.zs[j]], [1, 0]]); }
  for (const [p0, p1, out] of sides) {
    const ax = v3.norm([p1[0] - p0[0], 0, p1[1] - p0[1]]); const o = [out[0], 0, out[1]];
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); const cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
    const half = L / 2 - U.r * 0.6;
    const M = (u, y, w) => basis([cx + ax[0] * u + o[0] * w, y, cz + ax[2] * u + o[2] * w], ax, [0, 1, 0], o);
    const panel = (ms, u0, u1, y0, y1, w0, w1, c = 0.01) => cbox(ms, M((u0 + u1) / 2, (y0 + y1) / 2, (w0 + w1) / 2), (u1 - u0) / 2, (y1 - y0) / 2, (w1 - w0) / 2, c);
    panel(redD, -half, half, U.base, 11.3, -0.05, 0.05, 0.005);
    panel(redA, -L / 2, L / 2, 11.12, 11.34, -0.11, 0.11, 0.012); // sill
    // renji window with white shoji backing
    panel(white, -half, half, 11.34, 12.28, -0.06, -0.02, 0.004);
    const fw = 0.12;
    panel(red, -half, -half + fw, 11.34, 12.28, -0.06, 0.08, 0.01);
    panel(red, half - fw, half, 11.34, 12.28, -0.06, 0.08, 0.01);
    for (let u = -half + fw + 0.09; u < half - fw - 0.04; u += 0.17) cbox(red, mul(M(u, 11.81, 0.02), xf([0, 0, 0], Math.PI / 4)), 0.03, 0.47, 0.03, 0.004);
    // nageshi + gold
    panel(redA, -L / 2 - 0.04, L / 2 + 0.04, 12.28, 12.46, U.r - 0.03, U.r + 0.07, 0.015);
    for (const s of [-1, 1]) {
      panel(gold, s * (L / 2 - U.r - 0.13) - 0.11, s * (L / 2 - U.r - 0.13) + 0.11, 12.27, 12.47, U.r + 0.068, U.r + 0.082, 0.004);
      rosette(gold, M(s * (L / 2 - U.r - 0.02), 12.37, U.r + 0.08), 0.085, 6, 0.025);
    }
    panel(white, -half, half, 12.46, 12.55, -0.05, 0.05, 0.004);
    panel(redA, -L / 2, L / 2, 12.55, 12.78, -0.1, 0.1, 0.012); // kashiranuki
    for (const yy of [12.59, 12.74]) panel(gold, -L / 2 + U.r, L / 2 - U.r, yy - 0.007, yy + 0.007, 0.098, 0.107, 0.003);
    panel(redA, -L / 2, L / 2, U.top - 0.15, U.top, -0.12, 0.12, 0.012); // daiwa
    panel(white, -half, half, 12.78, U.top - 0.15, -0.05, 0.05, 0.004);
  }
  // balcony (koshi-gumi): floor + small brackets + railing
  const bo = 1.0; const by = 11.36;
  const bx = xi + bo, bz = zi + bo;
  const wx = acc.m(mats.woodX), wz = acc.m(mats.woodZ);
  for (const sz of [-1, 1]) cbox(wx, xf([0, by, sz * (zi + bo / 2 + 0.05)]), bx, 0.06, bo / 2 - 0.05, 0.01);
  for (const sx of [-1, 1]) cbox(wz, xf([sx * (xi + bo / 2 + 0.05), by, 0]), bo / 2 - 0.05, 0.06, zi + 0.0, 0.01);
  // fascia board of the balcony
  const ring = [[-bx, bz], [bx, bz], [bx, -bz], [-bx, -bz], [-bx, bz]];
  for (let i = 0; i < 4; i++) beam(red, [ring[i][0], by - 0.1, ring[i][1]], [ring[i + 1][0], by - 0.1, ring[i + 1][1]], 0.12, 0.2, 0.012);
  // support brackets at each column (two-step cantilever)
  for (const x of U.xs) for (const z of U.zs) {
    if (Math.abs(x) !== xi && Math.abs(z) !== zi) continue;
    const dirs = [];
    if (Math.abs(z) === zi) dirs.push([0, Math.sign(z)]);
    if (Math.abs(x) === xi) dirs.push([Math.sign(x), 0]);
    for (const [dx, dz] of dirs) {
      beam(red, [x, by - 0.24, z], [x + dx * (bo + 0.02), by - 0.24, z + dz * (bo + 0.02)], 0.16, 0.18, 0.012);
      beam(red, [x, by - 0.5, z], [x + dx * (bo * 0.6), by - 0.5, z + dz * (bo * 0.6)], 0.14, 0.16, 0.012);
      cbox(red, xf([x + dx * bo * 0.55, by - 0.36, z + dz * bo * 0.55]), 0.09, 0.07, 0.09, 0.01, { taper: [0.8, 0.8] });
      cbox(gold, xf([x + dx * (bo + 0.025), by - 0.24, z + dz * (bo + 0.025)]), dx ? 0.006 : 0.09, 0.095, dz ? 0.006 : 0.09, 0.003);
    }
  }
  // railing
  const ins = 0.1;
  const rx = bx - ins, rz = bz - ins;
  const xs = [-rx, ...U.xs, ...U.xs.slice(0, -1).map((x, i) => (x + U.xs[i + 1]) / 2), rx].sort((a, b) => a - b);
  const zs = [-rz, ...U.zs, ...U.zs.slice(0, -1).map((z, i) => (z + U.zs[i + 1]) / 2), rz].sort((a, b) => a - b);
  const yb = by + 0.06;
  railing(acc, mats, xs.map((x) => [x, yb, rz]), { h: 0.72, postW: 0.12, gibo: new Set([0, xs.length - 1]) });
  railing(acc, mats, xs.map((x) => [x, yb, -rz]), { h: 0.72, postW: 0.12, gibo: new Set([0, xs.length - 1]) });
  railing(acc, mats, zs.map((z) => [rx, yb, z]), { h: 0.72, postW: 0.12, gibo: new Set([0, zs.length - 1]) });
  railing(acc, mats, zs.map((z) => [-rx, yb, z]), { h: 0.72, postW: 0.12, gibo: new Set([0, zs.length - 1]) });
}

// ------------------------------------------------------- bracket placement
// ring of columns xs (sorted) at z=+-zw and zs at x=+-xw, column top y.
export function placeBrackets(acc, mats, xs, zs, top, type, opts = {}) {
  const xw = xs[xs.length - 1], zw = zs[zs.length - 1];
  const flatFront = opts.flatFront || (() => false);
  const sets = [];
  // front/back (outward +-z)
  for (const sz of [-1, 1]) {
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const t = sz > 0 && flatFront(x) ? 'flat' : type;
      sets.push([x, sz * zw, [0, sz], t, false]);
      if (i < xs.length - 1) { const xm = (x + xs[i + 1]) / 2; sets.push([xm, sz * zw, [0, sz], t, true]); }
    }
  }
  for (const sx of [-1, 1]) {
    for (let j = 0; j < zs.length; j++) {
      const z = zs[j];
      if (Math.abs(z) !== zw) sets.push([sx * xw, z, [sx, 0], type, false]);
      else sets.push([sx * xw, z, [sx, 0], type, false]);
      if (j < zs.length - 1) { const zm = (z + zs[j + 1]) / 2; sets.push([sx * xw, zm, [sx, 0], type, true]); }
    }
  }
  for (const [x, z, o, t, inter] of sets) {
    const ax = [o[0], 0, o[1]];
    const X = basis([x, top, z], ax, [0, 1, 0], v3.cross(ax, [0, 1, 0]));
    bracketSet(acc, mats, X, t, { inter: inter && !opts.fullInter, kw: opts.kw, lat: inter && opts.fullInter ? 0.56 : undefined });
  }
  // diagonal corner sets
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const d = v3.norm([sx, 0, sz]);
    const X = mul(basis([sx * xw, top, sz * zw], d, [0, 1, 0], v3.cross(d, [0, 1, 0])), xf([0, 0, 0], 0, 0, 0, [1.414, 1, 1]));
    bracketSet(acc, mats, X, type, { lat: 0.3 });
  }
  // continuous beams along each side (extended to cross at corners)
  const P = 0.44;
  for (const sz of [-1, 1]) {
    const segs = opts.frontSpans && sz > 0 ? opts.frontSpans : [[-xw, xw]];
    for (const [a, b] of segs) {
      const ext0 = a <= -xw + 1e-3 ? 0.9 : 0, ext1 = b >= xw - 1e-3 ? 0.9 : 0;
      bracketBeams(acc, mats, [a - ext0, top, sz * zw], [b + ext1, top, sz * zw], [0, 0, sz], type);
    }
    if (opts.frontSpans && sz > 0) for (const [a, b] of opts.frontGaps || []) bracketBeams(acc, mats, [a, top, zw], [b, top, zw], [0, 0, 1], 'flat');
  }
  for (const sx of [-1, 1]) bracketBeams(acc, mats, [sx * xw, top, -zw - 0.9], [sx * xw, top, zw + 0.9], [sx, 0, 0], type);
  void P;
}

// kentoku plaster walls behind bracket sets (wall plane), from column top to y1
export function kentoku(acc, mats, xw, zw, y0, y1, colR) {
  const white = acc.m(mats.plaster), inP = acc.m(mats.intPlaster);
  for (const sz of [-1, 1]) cbox(white, xf([0, (y0 + y1) / 2, sz * zw]), xw, (y1 - y0) / 2, 0.06, 0.004);
  for (const sx of [-1, 1]) cbox(white, xf([sx * xw, (y0 + y1) / 2, 0]), 0.06, (y1 - y0) / 2, zw, 0.004);
  void inP; void colR;
}
