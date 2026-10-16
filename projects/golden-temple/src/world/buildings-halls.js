// ---------------------------------------------------------------------------
// Generic irimoya hall (columns, walls, bracket sets, eaves, roof) and the
// south gate (romon), bell tower (shoro) and side halls built from it.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LB, m4, beamM, chamferBox, block, lathe, colBand, ornBand, rosette, giboshi, sweep, rectProfile, roundProfile, tileParams, tileCapGeos, makeLift, extrude, hash3, armGeo, ni, kibanaGeo, scrollPlate } from './buildings-kit.js';
import { eaves, bracketSet, column, irimoyaRoof, railing, loopPath, linePath, ridgeProfile } from './buildings-arch.js';
import { kanaguBand } from './buildings-kanagu.js';

const V3 = THREE.Vector3;

// ---------------------------------------------------------------------------
// Wall infill of one bay, built in a side frame: x along the side (a..b),
// wall plane z = c, outward +z. Y = { y0, yN (nageshi bottom), yK (kashira-nuki bottom) }
// ---------------------------------------------------------------------------
export function wallBay(lb, K, a, b, c, type, Y, o = {}) {
  if (type === 'open') return;
  const L = b - a, x = (a + b) / 2, t = 0.12;
  const { y0, yN, yK } = Y;
  const lo = !!o.lo;
  // ji-nageshi (base sill), uchinori-nageshi, both proud of the wall
  lb.box(K.red, L, 0.18, t + 0.08, [x, y0 + 0.09, c], [0, 0, 0], 0.014);
  lb.box(K.red, L, 0.18, t + 0.08, [x, yN + 0.09, c], [0, 0, 0], 0.014);
  // kokabe (plaster above the nageshi)
  if (yK - (yN + 0.18) > 0.05) lb.box(K.plaster, L, yK - (yN + 0.18), t, [x, (yK + yN + 0.18) / 2, c]);
  const y1 = y0 + 0.18;
  if (type === 'plaster') {
    lb.box(K.plaster, L, yN - y1, t, [x, (yN + y1) / 2, c]);
    // vertical stud (tsuka) in long bays
    if (L > 2.6) lb.box(K.red, 0.14, yN - y1, t + 0.04, [x, (yN + y1) / 2, c], [0, 0, 0], 0.01);
  } else if (type === 'window') {
    const yk = y1 + Math.min(0.75, (yN - y1) * 0.36);
    lb.box(K.plaster, L, yk - y1, t, [x, (yk + y1) / 2, c]);
    lb.box(K.red, L, 0.12, t + 0.05, [x, yk + 0.06, c], [0, 0, 0], 0.01);
    const w0 = yk + 0.12, w1 = yN - 0.02;
    const inset = Math.max(0.12, L * 0.14);
    // plaster jambs left/right of the window
    lb.box(K.plaster, inset, w1 - w0, t, [a + inset / 2, (w0 + w1) / 2, c]);
    lb.box(K.plaster, inset, w1 - w0, t, [b - inset / 2, (w0 + w1) / 2, c]);
    const wa = a + inset, wb = b - inset;
    for (const xx of [wa + 0.04, wb - 0.04]) lb.box(K.red, 0.08, w1 - w0, t + 0.04, [xx, (w0 + w1) / 2, c], [0, 0, 0], 0.008);
    lb.box(K.red, wb - wa, 0.06, t + 0.04, [(wa + wb) / 2, w0 + 0.03, c], [0, 0, 0], 0.008);
    const n = Math.floor((wb - wa - 0.16) / 0.12);
    for (let i = 1; i < n; i++) lb.add(chamferBox(0.05, w1 - w0 - 0.06, 0.05, lo ? 0 : 0.006), K.lattice, m4([wa + 0.08 + ((wb - wa - 0.16) * i) / n, (w0 + w1 + 0.06) / 2, c], [0, Math.PI / 4, 0]));
    // dark backing (shoji closed behind the bars)
    lb.box(K.dark, wb - wa, w1 - w0, 0.02, [(wa + wb) / 2, (w0 + w1) / 2, c - 0.05]);
  } else if (type === 'door') {
    // two-leaf door (sankarado style): frame + panels + gold studs, threshold
    const w0 = y1, w1 = yN;
    for (const s of [-1, 1]) {
      const cxp = x + s * L / 4;
      lb.box(K.red, L / 2 - 0.02, w1 - w0, 0.09, [cxp, (w0 + w1) / 2, c], [0, 0, 0], 0.01);
      // raised frame rails
      for (const yy of [w0 + 0.12, w0 + (w1 - w0) * 0.5, w1 - 0.12]) lb.box(K.redDark, L / 2 - 0.1, 0.08, 0.03, [cxp, yy, c + 0.055], [0, 0, 0], 0.008);
      for (const xx of [cxp - L / 4 + 0.07, cxp + L / 4 - 0.07]) lb.box(K.redDark, 0.08, w1 - w0 - 0.1, 0.03, [xx, (w0 + w1) / 2, c + 0.055], [0, 0, 0], 0.008);
      // gold studs in rows
      if (!lo) {
        const ns = Math.max(3, Math.round((L / 2) / 0.22));
        for (const yy of [w0 + 0.12, w0 + (w1 - w0) * 0.5, w1 - 0.12]) for (let i = 0; i < ns; i++) {
          const xx = cxp - L / 4 + 0.12 + ((L / 2 - 0.24) * i) / (ns - 1);
          lb.add(rosette(0.03, 6, 0.01, true), K.gold, m4([xx, yy, c + 0.072]));
        }
        lb.box(K.gold, 0.1, 0.24, 0.02, [x + s * 0.06, (w0 + w1) / 2, c + 0.06], [0, 0, 0], 0.004);
      }
    }
  } else if (type === 'lattice') {
    // kongo-goshi: thick vertical bars, low wall below
    const yk = y1 + 0.55;
    lb.box(K.plaster, L, yk - y1, t, [x, (yk + y1) / 2, c]);
    lb.box(K.red, L, 0.1, t + 0.06, [x, yk + 0.05, c], [0, 0, 0], 0.01);
    lb.box(K.red, L, 0.1, t + 0.06, [x, yN - 0.05, c], [0, 0, 0], 0.01);
    const n = Math.floor(L / 0.16);
    for (let i = 1; i < n; i++) lb.box(K.red, 0.07, yN - yk - 0.2, 0.07, [a + (L * i) / n, (yN + yk) / 2, c + 0.02], [0, 0, 0], 0.01);
    lb.box(K.red, L - 0.1, 0.06, 0.06, [x, (yN + yk) / 2, c + 0.06], [0, 0, 0], 0.008);
    lb.box(K.dark, L, yN - yk, 0.03, [x, (yN + yk) / 2, c - 0.25]);
  }
}

// ---------------------------------------------------------------------------
// Generic irimoya hall. lb in the building frame (origin at ground center).
// ---------------------------------------------------------------------------
export function hallBuilding(lb, K, S) {
  const xs = S.xs, zs = S.zs;
  const cx = Math.max(...xs), cz = Math.max(...zs);
  const colR = S.colR, y0 = S.y0, yct = S.yct;
  const knH = S.knH || 0.27, plH = 0.15;
  const yPlate = yct + plH;
  const lo = !!S.lo;
  const perim = [];
  for (const x of xs) for (const z of zs) if (Math.abs(x) === cx || Math.abs(z) === cz || S.interior) perim.push([x, z]);
  // columns
  for (const [x, z] of perim) {
    column(lb, K, x, z, S.colBase ?? y0, yct, colR, { seg: lo ? 20 : 28, base: S.soseki, baseH: 0.08, bands: S.bands || [{ y: y0, h: 0.14, studs: lo ? 0 : 10 }], lo });
  }
  // kashira-nuki + daiwa loops with kibana ends, gold caps
  for (const s of [-1, 1]) {
    lb.box(K.red, 2 * cx + 0.16, knH, 0.14, [0, yct - knH / 2, s * cz], [0, 0, 0], 0.014);
    lb.box(K.red, 0.14, knH, 2 * cz + 0.16, [s * cx, yct - knH / 2, 0], [0, 0, 0], 0.014);
    lb.box(K.red, 2 * cx + 0.46, plH, 0.26, [0, yPlate - plH / 2, s * cz], [0, 0, 0], 0.014);
    lb.box(K.red, 0.26, plH, 2 * cz + 0.46, [s * cx, yPlate - plH / 2, 0], [0, 0, 0], 0.014);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {

    // carved kibana ends with gold scroll plates
    for (const [px, pz, yaw] of [[sx * cx, sz * cz, sx > 0 ? 0 : Math.PI], [sx * cx, sz * cz, sz > 0 ? -Math.PI / 2 : Math.PI / 2]]) {
      const kb = lb.child(m4([px, yct - knH, pz], [0, yaw, 0]));
      kb.add(kibanaGeo(0.4, knH, 0.14), K.red, m4([0.05, 0, 0]));
      kb.add(scrollPlate(0.055), K.cap, m4([0.3, knH * 0.5, 0.14 / 2 + 0.006]));
      kb.add(scrollPlate(0.055), K.cap, m4([0.3, knH * 0.5, -0.14 / 2 - 0.006], [0, Math.PI, 0]));
    }
  }
  // walls per bay (side frames: front +z, back -z, right +x, left -x)
  const Y = { y0, yN: S.yN ?? (y0 + (yct - knH - y0) * 0.74), yK: yct - knH };
  const sideDefs = [
    { name: 'front', yaw: 0, pos: xs, c: cz }, { name: 'back', yaw: Math.PI, pos: xs, c: cz },
    { name: 'right', yaw: Math.PI / 2, pos: zs, c: cx }, { name: 'left', yaw: -Math.PI / 2, pos: zs, c: cx },
  ];
  for (const sd of sideDefs) {
    const fr = lb.child(m4([0, 0, 0], [0, sd.yaw, 0]));
    const P = [...sd.pos].sort((p, q) => p - q);
    for (let i = 0; i < P.length - 1; i++) {
      const type = S.walls ? S.walls(sd.name, i, P.length - 1) : 'open';
      wallBay(fr, K, P[i] + colR, P[i + 1] - colR, sd.c, type, Y, { lo });
      // rosettes on nageshi at columns
      if (type !== 'open') {
        for (const xx of [P[i], P[i + 1]]) fr.add(rosette(0.075, 6, 0.014, true), K.gold, m4([xx, Y.yN + 0.09, sd.c + 0.105]));
      }
    }
  }
  // bracket sets
  const BS = { ...S.BS, lo: S.lo || S.BS.lo };
  const bsH = BS.daito[1] + BS.tiers * (BS.armH + BS.blockH);
  const sidesB = [
    { pts: xs.map((x) => [x, cz]), yaw: 0 }, { pts: xs.map((x) => [x, -cz]), yaw: Math.PI },
    { pts: zs.map((z) => [cx, z]), yaw: Math.PI / 2 }, { pts: zs.map((z) => [-cx, z]), yaw: -Math.PI / 2 },
  ];
  for (const sb of sidesB) {
    for (let i = 0; i < sb.pts.length; i++) {
      const p = sb.pts[i];
      const isCorner = Math.abs(p[0]) === cx && Math.abs(p[1]) === cz;
      if (!isCorner) bracketSet(lb, m4([p[0], yPlate, p[1]], [0, sb.yaw, 0]), BS);
      if (S.inter !== false && i < sb.pts.length - 1) {
        const q = sb.pts[i + 1];
        const gap = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const n = gap > 3.2 ? 2 : 1;
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1);
          bracketSet(lb, m4([p[0] + (q[0] - p[0]) * t, yPlate, p[1] + (q[1] - p[1]) * t], [0, sb.yaw, 0]), { ...BS, goldDaito: false });
        }
      }
    }
  }
  for (const [sx, sz, yaw] of [[1, 1, 0], [-1, 1, -Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI / 2]]) {
    bracketSet(lb, m4([sx * cx, yPlate, sz * cz], [0, yaw, 0]), { ...BS, corner: true });
  }
  // plaster infill between the bracket sets (closed halls), above the plate
  if (S.infill) {
    const hI = bsH - 0.02;
    for (const s2 of [-1, 1]) {
      lb.box(K.plaster, 2 * cx, hI, 0.08, [0, yPlate + hI / 2, s2 * cz]);
      lb.box(K.plaster, 0.08, hI, 2 * cz, [s2 * cx, yPlate + hI / 2, 0]);
    }
  }
  // eaves
  const ov = S.ov;
  const exT = cx + ov + 0.08, ezT = cz + ov + 0.08;
  const lift = makeLift(exT, ezT, S.liftL ?? 0.4, 0.45, 2.3);
  const yWall = yPlate + bsH + 0.17;
  const E = eaves(lb, {
    cx, cz, ov, yWall, sBase: S.sBase ?? 0.31, d1: S.d1 ?? 0.8, rB: S.rB || [0.095, 0.11], kioiH: 0.09, sFly: 0.18, rF: S.rF || [0.09, 0.1],
    sp: S.sp || 0.25, fasciaH: S.fasciaH || 0.12, proj: BS.proj[BS.proj.length - 1], lift, twoTier: S.twoTier !== false, capGold: true,
    tipOut: S.tipOut, lo,
    K: { rafter: K.rafter, soffit: K.soffit, cap: K.cap, beam: K.beam, rafterCap: K.capPaint },
  });
  // ceiling (open buildings)
  if (S.ceiling) {
    const yC = yWall + 0.13;
    const g = new THREE.PlaneGeometry(2 * cx, 2 * cz).rotateX(Math.PI / 2);
    lb.add(g, S.ceilingMat || K.soffit, m4([0, yC, 0]));
    const nx = Math.max(2, Math.round((2 * cx) / 0.5)), nz = Math.max(2, Math.round((2 * cz) / 0.5));
    for (let i = 0; i <= nx; i++) lb.box(K.black, 0.06, 0.07, 2 * cz, [-cx + (2 * cx * i) / nx, yC - 0.035, 0], [0, 0, 0], 0.006);
    for (let j = 0; j <= nz; j++) lb.box(K.black, 2 * cx, 0.07, 0.06, [0, yC - 0.035, -cz + (2 * cz * j) / nz], [0, 0, 0], 0.006);
    lb.add(sweep(loopPath(cx - 0.1, cz - 0.1, () => yC - 0.12, 0.6), rectProfile(0.12, 0.12), { closed: true, outward: true }), K.red);
  }
  // roof
  const T = tileParams({ p: S.tileP || 0.28, c: 0.27, detail: S.tileDetail ?? 2 });
  const ry0 = E.fasciaTop + T.lip + T.pd;
  const a0 = S.slope0 ?? 0.4;
  const b2 = (S.roofRise - a0 * ezT) / (ezT * ezT);
  const prof = (d) => a0 * d + b2 * d * d;
  const roof = irimoyaRoof(lb, {
    ex: exT, ez: ezT, y0: ry0, prof, gd: S.gd ?? Math.min(ezT * 0.42, 2.6), ov: S.ovG ?? 0.6, lift, T,
    K: { tileVC: K.tileVC, tile: K.tile, gold: K.gold, red: K.red, soffit: K.soffit, plaster: K.plaster, lattice: K.lattice },
    ridge: S.ridge || { w: 0.62, h: 0.58, layers: 6, capR: 0.11, drop: 0.45 }, hip: S.hip || { w: 0.34, h: 0.34, layers: 4, capR: 0.08, drop: 0.22 },
    oni: S.oni || { s: 0.9 }, gegyo: S.gegyo || 0.65, hafuH: S.hafuH || 0.38, capGoldMat: K.cap, gableLattice: S.gableLattice ?? true, lo,
  });
  return { E, roof, lift, yWall, cx, cz, exT, ezT };
}

// ---------------------------------------------------------------------------
// Gate door leaf (itatobira): framed vertical-plank leaf with gilt hinge straps
// (cusped spear ends, domed nails), rows of domed studs, corner fittings and a
// ring pull. Frame: hinge at x = 0, leaf toward -s*x, y up from the sill, z = 0 mid-plane.
// ---------------------------------------------------------------------------
const _dg = new Map();
const dgc = (k, fn) => { let g = _dg.get(k); if (!g) { g = fn(); _dg.set(k, g); } return g; };
function strapGeo(L, h) {
  return dgc(`strap${L.toFixed(3)},${h}`, () => {
    const s = new THREE.Shape();
    const Ls = L - 0.2;
    s.moveTo(0, -h / 2); s.lineTo(Ls, -h / 2);
    s.quadraticCurveTo(Ls + 0.02, -h * 1.05, Ls + 0.07, -h * 0.85);
    s.quadraticCurveTo(Ls + 0.1, -h * 0.55, Ls + 0.11, -h * 0.28);
    s.quadraticCurveTo(Ls + 0.17, -h * 0.32, L, 0);
    s.quadraticCurveTo(Ls + 0.17, h * 0.32, Ls + 0.11, h * 0.28);
    s.quadraticCurveTo(Ls + 0.1, h * 0.55, Ls + 0.07, h * 0.85);
    s.quadraticCurveTo(Ls + 0.02, h * 1.05, Ls, h / 2);
    s.lineTo(0, h / 2); s.lineTo(0, -h / 2);
    return extrude(s, 0.009, 0.0025, null, 5);
  });
}
// domed nail head on a thin washer, facing +z, origin on the back
function domeGeo(r) {
  return dgc(`dome${r}`, () => {
    const d = new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.8).translate(0, 0, 0.004);
    const w = new THREE.CylinderGeometry(r * 1.4, r * 1.5, 0.005, 14, 1).rotateX(Math.PI / 2).translate(0, 0, 0.0025);
    return mergeGeometries([ni(d), ni(w)]);
  });
}
function gateLeaf(dl, K, s, dw, dh) {
  const core = 0.07, st = 0.13, lay = 0.022;
  dl.box(K.redDark, dw, dh, core, [-s * dw / 2, dh / 2, 0], [0, 0, 0], 0.008);
  for (const f of [-1, 1]) {
    const zF = f * (core / 2 + lay / 2);
    const zT = f * (core / 2 + lay);                 // outer face of the frame
    const face = (x, y, z) => new THREE.Matrix4().makeBasis(new V3(-s, 0, 0), new V3(0, -s * f, 0), new V3(0, 0, f)).setPosition(x, y, z);
    const nail = (x, y, z, r = 0.016) => dl.add(domeGeo(r), K.gold, m4([x, y, z], [0, f > 0 ? 0 : Math.PI, 0]));
    // frame: stiles + rails
    dl.box(K.red, st, dh, lay, [-s * st / 2, dh / 2, zF], [0, 0, 0], 0.006);
    dl.box(K.red, st, dh, lay, [-s * (dw - st / 2), dh / 2, zF], [0, 0, 0], 0.006);
    dl.box(K.red, dw - 2 * st, 0.16, lay, [-s * dw / 2, dh - 0.08, zF], [0, 0, 0], 0.006);
    dl.box(K.red, dw - 2 * st, 0.22, lay, [-s * dw / 2, 0.11, zF], [0, 0, 0], 0.006);
    // vertical planks (column-grain lacquer), slightly uneven, dark joints between them
    const nP = 4, fw = dw - 2 * st, pw = fw / nP, ph = dh - 0.38;
    for (let i = 0; i < nP; i++) {
      const inset = 0.003 + 0.004 * hash3(i, f, s);
      dl.box(K.col, pw - 0.009, ph, lay - 0.006, [-s * (st + pw * (i + 0.5)), 0.22 + ph / 2, f * (core / 2 + (lay - 0.006) / 2 - inset * 0.3)], [0, 0, 0], 0.003);
    }
    // hinge straps with domed nails
    const L = dw * 0.8, sh = 0.12;
    const yS = [0.46, dh * 0.5, dh - 0.42];
    for (const yy of yS) {
      dl.add(strapGeo(L, sh), K.cap, face(0, yy, zT + f * 0.0045));
      for (let k = 0; k < 5; k++) nail(-s * (0.08 + k * ((L - 0.36) / 4)), yy, zT + f * 0.008, 0.017);
      nail(-s * (L - 0.1), yy, zT + f * 0.008, 0.019);
    }
    // rows of domed studs between the straps
    for (const yy of [(yS[0] + yS[1]) / 2, (yS[1] + yS[2]) / 2]) {
      for (let i = 0; i < nP; i++) nail(-s * (st + pw * (i + 0.5)), yy, f * (core / 2 + lay - 0.006), 0.026);
    }
    // gilt corner fittings (L plates) on the meeting stile + top/bottom of the hinge stile
    for (const [cx, cy, sy] of [[dw, dh, -1], [dw, 0, 1], [0, dh, -1], [0, 0, 1]]) {
      const xIn = cx > 0 ? 1 : -1;     // toward the leaf interior along local -s*x
      const x0 = -s * cx, y0 = cy;
      dl.box(K.cap, 0.34, 0.085, 0.008, [x0 + s * xIn * 0.17, y0 + sy * 0.0425, zT + f * 0.004], [0, 0, 0], 0.002);
      dl.box(K.cap, 0.085, 0.3, 0.008, [x0 + s * xIn * 0.0425, y0 + sy * 0.15, zT + f * 0.004], [0, 0, 0], 0.002);
      nail(x0 + s * xIn * 0.045, y0 + sy * 0.045, zT + f * 0.008, 0.015);
      nail(x0 + s * xIn * 0.26, y0 + sy * 0.0425, zT + f * 0.008, 0.012);
      nail(x0 + s * xIn * 0.0425, y0 + sy * 0.23, zT + f * 0.008, 0.012);
    }
    // ring pull (hikite) on the meeting stile
    const xr = -s * (dw - st / 2), yr = dh * 0.5 + 0.34;
    dl.add(rosette(0.085, 8, 0.016), K.gold, m4([xr, yr, zT], [0, f > 0 ? 0 : Math.PI, 0]));
    dl.add(new THREE.TorusGeometry(0.062, 0.011, 8, 24), K.gold, m4([xr, yr - 0.07, zT + f * 0.014]));
  }
}

// ---------------------------------------------------------------------------
// SOUTH GATE (romon): lower open storey with massive pillars, balcony on
// bracket sets, upper storey (hallBuilding), irimoya roof.
// ---------------------------------------------------------------------------
export function buildGate(ctx, K, lb, anchors, toW) {
  const xs = [-5.2, -2.0, 2.0, 5.2], zs = [-2.4, 0, 2.4];
  const yP = 0.5;                  // platform top (5 cm above the corridor floor)
  const yLT = 5.4;                 // lower column top
  const R = 0.3;
  // platform with steps on the passage (south and north)
  lb.box(K.stone, 14.2, 0.5, 9.0, [0, yP - 0.25, 0], [0, 0, 0], 0.04);
  lb.box(K.stoneClean, 14.4, 0.06, 9.2, [0, yP - 0.03, 0], [0, 0, 0], 0.02);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) lb.box(K.stoneClean, 4.0 / 5 - 0.012, 0.03, 9.0 / 3 - 0.012, [-1.6 + i * 0.8, yP + 0.012, -3 + j * 3], [0, 0, 0], 0.006);
  for (const s of [-1, 1]) {
    lb.box(K.stoneClean, 4.6, 0.25, 0.42, [0, 0.125, s * 4.7], [0, 0, 0], 0.02);
  }
  // lower columns with ornate gold kazari-kanagu
  const lowCols = [];
  for (const x of xs) for (const z of zs) lowCols.push([x, z]);
  for (const [x, z] of lowCols) {
    lb.add(lathe([[0, -0.1], [R * 1.75, -0.1], [R * 1.75, 0.03], [R * 1.55, 0.08], [R * 1.25, 0.12], [0, 0.12]], 32, 'gsos'), K.stoneClean, m4([x, yP, z]));
    lb.add(new THREE.CylinderGeometry(R, R * 1.015, yLT - yP - 0.12, 36, 1), K.col, m4([x, (yLT + yP + 0.12) / 2, z]));
    // hero kazari-kanagu (south row full detail; seam turned to the north)
    const kHero = z > 1;
    lb.add(kanaguBand(R, 'base', kHero), K.kanagu || K.gold, m4([x, yP + 0.1, z], [0, Math.PI, 0]));
    lb.add(kanaguBand(R, 'eye', kHero), K.kanagu || K.gold, m4([x, 1.86, z], [0, Math.PI, 0]));
    lb.add(colBand(R, 0.12, 36, 0), K.gold, m4([x, 4.08, z]));
    lb.add(colBand(R, 0.1, 36, 0), K.gold, m4([x, yLT - 0.42, z]));
  }
  // beams: kashira-nuki, nageshi (both faces) with big rosettes, koshi-nuki in side bays
  const knH = 0.32;
  for (const z of zs) lb.box(K.red, 2 * 5.2 + 0.8, knH, 0.2, [0, yLT - knH / 2, z], [0, 0, 0], 0.016);
  for (const x of xs) lb.box(K.red, 0.2, knH, 2 * 2.4 + 0.8, [x, yLT - knH / 2, 0], [0, 0, 0], 0.016);
  for (const sx of [-1, 1]) for (const z of zs) lb.box(K.cap, 0.014, knH + 0.012, 0.21, [sx * 5.6, yLT - knH / 2, z], [0, 0, 0], 0.003);
  for (const x of xs) for (const sz of [-1, 1]) lb.box(K.cap, 0.21, knH + 0.012, 0.014, [x, yLT - knH / 2, sz * 2.8], [0, 0, 0], 0.003);
  const yN = 4.2, nH = 0.22;
  for (const z of [-2.4, 2.4]) for (const f of [-1, 1]) {
    lb.box(K.red, 2 * 5.2 + 0.2, nH, 0.09, [0, yN + nH / 2, z + f * (R + 0.04)], [0, 0, 0], 0.014);
    for (const x of xs) {
      lb.box(K.cap, 0.4, 0.26, 0.012, [x, yN + nH / 2, z + f * (R + 0.09)], [0, 0, 0], 0.004);
      lb.add(rosette(0.13, 8, 0.025), K.gold, m4([x, yN + nH / 2, z + f * (R + 0.095)], [0, f > 0 ? 0 : Math.PI, 0]));
    }
  }
  for (const x of [-5.2, 5.2]) for (const f of [-1, 1]) lb.box(K.red, 0.09, nH, 2 * 2.4 + 0.2, [x + f * (R + 0.04), yN + nH / 2, 0], [0, 0, 0], 0.014);
  // side bays: lattice screens front/back, plaster back wall (z=0) and outer side walls
  const Yl = { y0: yP, yN, yK: yLT - knH };
  for (const yaw of [0, Math.PI]) {
    const fr = lb.child(m4([0, 0, 0], [0, yaw, 0]));
    for (const [a, b] of [[-5.2, -2.0], [2.0, 5.2]]) wallBay(fr, K, a + R, b - R, 2.4, 'lattice', Yl);
  }
  for (const [a, b] of [[-5.2, -2.0], [2.0, 5.2]]) wallBay(lb, K, a + R, b - R, 0, 'plaster', Yl);
  for (const yaw of [Math.PI / 2, -Math.PI / 2]) {
    const fr = lb.child(m4([0, 0, 0], [0, yaw, 0]));
    for (const [a, b] of [[-2.4, 0], [0, 2.4]]) wallBay(fr, K, a + R, b - R, 5.2, 'plaster', Yl);
  }
  // ji-nageshi in side bays + rosettes on the lattice frames
  for (const x of xs) for (const z of [-2.4, 2.4]) {
    if (Math.abs(x) === 2.0) lb.add(rosette(0.1, 8, 0.02), K.gold, m4([x + (x > 0 ? 0.35 : -0.35), yP + 0.09, z + Math.sign(z) * 0.12], [0, z > 0 ? 0 : Math.PI, 0]));
  }
  // main doors (open, swung inward to the north) between the center pillars
  for (const s of [-1, 1]) {
    const hinge = [s * (2.0 - R - 0.02), 0.0];
    const dw = 1.68, dh = yN - yP - 0.1;
    const ang = s * Math.PI / 2; // open 90 deg, flush with the passage sides
    const dl = lb.child(m4([hinge[0], yP + 0.05, hinge[1] - 0.08], [0, ang, 0]));
    gateLeaf(dl, K, s, dw, dh);
  }
  // threshold
  lb.box(K.redDark, 4.0 - 2 * R, 0.16, 0.22, [0, yP + 0.08, 0], [0, 0, 0], 0.015);
  // passage ceiling (coffered, under the balcony)
  const yCL = yLT + 0.02;
  {
    const g = new THREE.PlaneGeometry(10.4, 4.8).rotateX(Math.PI / 2);
    lb.add(g, K.ceilingGate, m4([0, yCL + 0.36, 0]));
    for (let i = 0; i <= 20; i++) lb.box(K.black, 0.06, 0.07, 4.8, [-5.2 + i * 0.52, yCL + 0.325, 0], [0, 0, 0], 0.006);
    for (let j = 0; j <= 10; j++) lb.box(K.black, 10.4, 0.07, 0.06, [0, yCL + 0.325, -2.4 + j * 0.48], [0, 0, 0], 0.006);
  }
  // koshigumi: bracket sets supporting the balcony
  const BSk = { tiers: 2, proj: [0.42, 0.8], armH: 0.15, armW: 0.13, blockH: 0.12, daito: [0.42, 0.22], mak: [0.21, 0.12], wall: [1.0, 1.25], inner: false, goldCaps: true, goldMak: true, goldDaito: true, lo: true, K: { wood: K.red, gold: K.cap } };
  const kH = 0.22 + 2 * 0.27;
  const cxL = 5.2, czL = 2.4;
  const yKP = yLT + 0.02;
  for (const s of [-1, 1]) {
    lb.box(K.red, 2 * cxL + 0.5, 0.16, 0.3, [0, yKP - 0.0 + 0.08 - 0.02, s * czL], [0, 0, 0], 0.014);
    lb.box(K.red, 0.3, 0.16, 2 * czL + 0.5, [s * cxL, yKP + 0.06, 0], [0, 0, 0], 0.014);
  }
  const yKB = yKP + 0.14;
  for (const x of xs) for (const s of [-1, 1]) bracketSet(lb, m4([x, yKB, s * czL], [0, s > 0 ? 0 : Math.PI, 0]), Math.abs(x) === cxL ? { ...BSk, corner: true } : BSk);
  for (const s of [-1, 1]) bracketSet(lb, m4([s * cxL, yKB, 0], [0, s * Math.PI / 2, 0]), BSk);
  for (const [sx, sz, yaw] of [[1, 1, 0], [-1, 1, -Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI / 2]]) bracketSet(lb, m4([sx * cxL, yKB, sz * czL], [0, yaw, 0]), { ...BSk, corner: true });
  for (const x of [-3.6, 0, 3.6]) for (const s of [-1, 1]) bracketSet(lb, m4([x, yKB, s * czL], [0, s > 0 ? 0 : Math.PI, 0]), { ...BSk, goldDaito: false });
  // balcony: edge beams on the bracket ends, floor, railing
  const yBal = yKB + kH + 0.16;
  const bx = cxL + 0.98, bz = czL + 0.98;
  lb.add(sweep(loopPath(cxL + 0.8, czL + 0.8, () => yKB + kH, 0.6), rectProfile(0.16, 0.16), { closed: true, outward: true }), K.red);
  lb.add(sweep(loopPath(bx - 0.08, bz - 0.08, () => yBal - 0.22, 0.6), rectProfile(0.16, 0.24), { closed: true, outward: true }), K.redDark);
  lb.add(sweep(loopPath(bx, bz, () => yBal - 0.2, 0.6), rectProfile(0.014, 0.025, 0.12), { closed: true, outward: true }), K.gold);
  for (let i = 0; i < 20; i++) {
    const z = -bz + 0.06 + (2 * bz - 0.12) * (i + 0.5) / 20;
    lb.box(K.floorX, 2 * bx - 0.12, 0.05, (2 * bz - 0.12) / 20 - 0.008, [0, yBal - 0.025, z], [0, 0, 0], 0.004);
  }
  // under-balcony soffit (between bracket tips)
  lb.box(K.soffit, 2 * bx, 0.03, 2 * bz, [0, yBal - 0.27, 0]);
  railing(lb, [[-bx + 0.1, -bz + 0.1], [bx - 0.1, -bz + 0.1], [bx - 0.1, bz - 0.1], [-bx + 0.1, bz - 0.1], [-bx + 0.1, -bz + 0.1 + 0.001]], yBal, {
    H: 0.8, post: 0.12, spacing: 1.6, midY: 0.45, gibSeg: 22, lo: true, K: { red: K.red, redDark: K.redDark, gold: K.gold, gib: K.gib },
  });
  // upper storey
  const up = hallBuilding(lb, K, {
    xs, zs: [-2.4, 2.4], colR: 0.25, y0: yBal, yct: yBal + 2.5, knH: 0.28,
    walls: (side, i, n) => {
      if (side === 'front' || side === 'back') return i === 1 ? 'door' : 'window';
      return 'window';
    },
    BS: { tiers: 3, proj: [0.45, 0.88], armH: 0.15, armW: 0.13, blockH: 0.12, daito: [0.38, 0.21], mak: [0.2, 0.12], wall: [0.95, 1.2, 1.4], inner: false, goldCaps: true, goldMak: true, goldDaito: true, K: { wood: K.red, gold: K.cap } },
    ov: 2.5, sBase: 0.3, d1: 0.95, liftL: 0.55, roofRise: 2.6, gd: 2.3, ovG: 0.65, tileP: 0.3, tileDetail: 1, lo: true,
    ridge: { w: 0.7, h: 0.66, layers: 7, capR: 0.12, drop: 0.5 }, hip: { w: 0.38, h: 0.38, layers: 4, capR: 0.085, drop: 0.24 }, oni: { s: 1.05 }, gegyo: 0.8, hafuH: 0.44,
    bands: [{ y: yBal, h: 0.16, studs: 10 }, { y: yBal + 2.5 - 0.28 - 0.12, h: 0.1 }], infill: true,
  });
  for (const h of up.E.hooks) anchors.bells.push({ pos: toW(h.local), scale: 1.2, rotY: 0 });
  // hanging lantern in the passage (both sides of the doors) and under the front eave
  // the south lantern hangs lower on a longer gilt rod so the telephoto view
  // through the gate (shot 7) frames the whole lantern, not a cut-off roof
  // One lantern in the passage (north of the doors) on a long gilt rod: the
  // telephoto view through the gate (shot 7) frames its whole body top-centre
  // with only the rod leaving the frame (a south twin would show as a cut-off
  // lantern bottom at the top edge of shot 7, so there is none).
  {
    const z = -1.3, rod = 0.66;
    lb.add(new THREE.CylinderGeometry(0.014, 0.014, rod, 8), K.gold, m4([0, yCL + 0.34 - rod / 2, z]));
    lb.add(new THREE.CylinderGeometry(0.026, 0.02, 0.035, 12), K.gold, m4([0, yCL + 0.34 - rod + 0.02, z]));
    lb.box(K.gold, 0.14, 0.025, 0.14, [0, yCL + 0.32, z], [0, 0, 0], 0.004);
    anchors.hangingLanterns.push({ pos: toW([0, yCL + 0.34 - rod, z]), scale: 1.15, rotY: 0 });
  }
  return { yRidge: up.roof ? up.roof.yRidge : 0 };
}

// ---------------------------------------------------------------------------
// BELL TOWER (shoro) with bonsho and striker
// ---------------------------------------------------------------------------
function bonsho(lb, K, at, Rb = 0.5, Hb = 1.65) {
  const prof = [
    [0, 0.06], [Rb * 0.9, 0.06], [Rb * 0.97, 0.02], [Rb * 1.02, 0], [Rb * 1.03, 0.04], [Rb * 1.0, 0.1], [Rb * 0.97, 0.22],
    [Rb * 0.95, Hb * 0.5], [Rb * 0.93, Hb * 0.8], [Rb * 0.88, Hb * 0.9], [Rb * 0.76, Hb * 0.96], [Rb * 0.5, Hb * 0.995], [0, Hb],
  ];
  const b = lb.child(m4(at));
  b.add(lathe(prof, 56, 'bonsho'), K.bronze);
  // horizontal bands
  for (const yy of [0.32, Hb * 0.6, Hb * 0.62, Hb * 0.86]) {
    const r = Rb * (yy < Hb * 0.7 ? 0.955 : 0.925) + 0.012;
    b.add(new THREE.TorusGeometry(r, 0.014, 6, 56).rotateX(Math.PI / 2), K.bronze, m4([0, yy, 0]));
  }
  // vertical bands (kesadasuki)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.add(chamferBox(0.05, Hb * 0.86 - 0.32, 0.03, 0.008), K.bronze, m4([Math.sin(a) * (Rb * 0.95 + 0.01), (Hb * 0.86 + 0.32) / 2, Math.cos(a) * (Rb * 0.95 + 0.01)], [0, a, 0]));
  }
  // chi (nipple bosses) in 4 upper panels: 3 rows x 4
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2 + Math.PI / 4;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const a = a0 + (c - 1.5) * 0.16 + Math.PI / 4;
      const yy = Hb * 0.66 + r * 0.075;
      const rr = Rb * (0.93 - r * 0.004) + 0.005;
      b.add(new THREE.SphereGeometry(0.024, 8, 6), K.bronze, m4([Math.sin(a) * rr, yy, Math.cos(a) * rr]));
    }
  }
  // striking seats (tsukiza) lotus medallions
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    b.add(rosette(0.11, 8, 0.02), K.bronze, m4([Math.sin(a) * (Rb * 0.96), 0.46, Math.cos(a) * (Rb * 0.96)], [0, a, 0]));
  }
  // ryuzu (dragon hook): double arch on top
  const tor = new THREE.TorusGeometry(0.16, 0.05, 8, 20, Math.PI);
  b.add(tor, K.bronze, m4([0, Hb + 0.02, 0]));
  b.add(new THREE.SphereGeometry(0.075, 10, 8).scale(1.3, 0.9, 1), K.bronze, m4([0.16, Hb + 0.05, 0]));
  b.add(new THREE.SphereGeometry(0.075, 10, 8).scale(1.3, 0.9, 1), K.bronze, m4([-0.16, Hb + 0.05, 0]));
  b.add(new THREE.CylinderGeometry(0.035, 0.06, 0.16, 10), K.bronze, m4([0, Hb + 0.2, 0]));
}

export function buildBellTower(ctx, K, lb, anchors, toW) {
  const yF = 1.3;
  // stone base: two courses + coping + stairs (south)
  lb.box(K.stone, 6.6, 0.7, 6.6, [0, 0.35 - 0.1, 0], [0, 0, 0], 0.04);
  lb.box(K.stone, 6.4, 0.55, 6.4, [0, 0.25 + 0.55 / 2 + 0.25, 0], [0, 0, 0], 0.035);
  lb.box(K.stoneClean, 6.7, 0.14, 6.7, [0, yF - 0.07, 0], [0, 0, 0], 0.03);
  for (let i = 0; i < 6; i++) {
    const y = (i + 1) * (yF / 6);
    lb.box(K.stoneClean, 2.2, 0.08, 0.36, [0, y - 0.04, 3.35 + (5 - i) * 0.32 + 0.16], [0, 0, 0], 0.015);
    lb.box(K.stone, 2.2, y - 0.08, 0.34, [0, (y - 0.08) / 2, 3.35 + (5 - i) * 0.32 + 0.16], [0, 0, 0], 0.015);
  }
  const H = hallBuilding(lb, K, {
    xs: [-1.95, 1.95], zs: [-1.95, 1.95], colR: 0.22, y0: yF, yct: yF + 4.1, knH: 0.26,
    walls: () => 'open', soseki: true,
    BS: { tiers: 3, proj: [0.42, 0.8], armH: 0.14, armW: 0.12, blockH: 0.11, daito: [0.34, 0.19], mak: [0.18, 0.11], wall: [0.85, 1.05, 1.25], inner: true, goldCaps: true, goldMak: true, goldDaito: true, K: { wood: K.red, gold: K.cap } },
    ov: 1.9, liftL: 0.45, roofRise: 2.7, gd: 1.7, ovG: 0.5, tileP: 0.26, tileDetail: 1, lo: true,
    ridge: { w: 0.56, h: 0.5, layers: 5, capR: 0.1, drop: 0.4 }, hip: { w: 0.3, h: 0.3, layers: 3, capR: 0.07, drop: 0.2 }, oni: { s: 0.8 }, gegyo: 0.55, hafuH: 0.34,
    ceiling: true, ceilingMat: K.ceilingBell,
    bands: [{ y: yF, h: 0.15, studs: 10 }, { y: yF + 4.1 - 0.26 - 0.12, h: 0.1 }],
  });
  for (const h of H.E.hooks) anchors.bells.push({ pos: toW(h.local), scale: 1.0, rotY: 0 });
  // tie beams (nuki) between columns at mid height + hanging beam for the bell
  for (const s of [-1, 1]) {
    lb.box(K.red, 3.9 + 0.5, 0.2, 0.12, [0, yF + 2.6, s * 1.95], [0, 0, 0], 0.012);
    lb.box(K.red, 0.12, 0.2, 3.9 + 0.5, [s * 1.95, yF + 2.6, 0], [0, 0, 0], 0.012);
  }
  const yHang = yF + 3.35;
  lb.box(K.red, 3.9, 0.26, 0.26, [0, yHang + 0.13, 0], [0, 0, 0], 0.02);
  lb.box(K.cap, 0.3, 0.3, 0.3, [0, yHang + 0.13, 0], [0, 0, 0], 0.01);
  lb.add(new THREE.TorusGeometry(0.09, 0.025, 8, 16), K.black, m4([0, yHang - 0.07, 0]));
  // bell
  const Hb = 1.8;
  bonsho(lb, K, [0, yHang - 0.16 - Hb - 0.24, 0], 0.56, Hb);
  // striker (shumoku) hung on ropes, pointing at the bell along x
  const ys = yHang - 0.16 - Hb - 0.24 + 0.5;
  const sx0 = 0.68, sl = 1.32;
  lb.add(new THREE.CylinderGeometry(0.11, 0.115, sl, 18, 1), K.woodRaw, m4([sx0 + sl / 2, ys, 0], [0, 0, Math.PI / 2]));
  lb.add(new THREE.CylinderGeometry(0.118, 0.118, 0.04, 18), K.black, m4([sx0 + 0.03, ys, 0], [0, 0, Math.PI / 2]));
  const rope = (a, b) => { const { m, len } = beamM(a, b, [1, 0, 0]); lb.add(new THREE.CylinderGeometry(0.014, 0.014, len, 6).rotateZ(Math.PI / 2), K.rope, m); };
  const yRB = yF + 4.1 - 0.26 - 0.09;
  for (const x of [sx0 + 0.25, sx0 + sl - 0.25]) {
    rope([x, ys + 0.11, 0], [x, yRB - 0.08, 0.55]);
    rope([x, ys + 0.11, 0], [x, yRB - 0.08, -0.55]);
    lb.box(K.red, 0.14, 0.16, 3.9, [x, yRB, 0], [0, 0, 0], 0.01);
  }
  lb.add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), K.rope, m4([sx0 + sl + 0.1, ys - 0.22, 0], [0, 0, 0.3]));
}

// ---------------------------------------------------------------------------
// KOHAI with a KARAHAFU: step canopy on two posts in front of a hall, roofed with
// a bell-curved (convex crest, concave flanks) cusped gable facing forward.
// o = { W (roof half width), zb, zf (back / front of the roof), yE (side eave),
//       H (crest rise), postX, postZ, yTop (post top), zWall (front wall face) }
// ---------------------------------------------------------------------------
function karaKohai(lb, K, o) {
  const { W, zb, zf, yE, H, postX, postZ, yTop, zWall } = o;
  const prof = (x) => yE + H * 0.5 * (1 + Math.cos(Math.PI * Math.min(Math.abs(x) / W, 1)));
  const cut = 0.1; // roof slab thickness
  // posts on stone bases with gilt bands, curved tie beams (ebi-koryo) back to the wall
  for (const s of [-1, 1]) {
    const x = s * postX;
    lb.add(lathe([[0, -0.1], [0.28, -0.1], [0.28, 0.04], [0.25, 0.09], [0.2, 0.12], [0, 0.12]], 20, 'khbase'), K.stoneClean, m4([x, 0, postZ]));
    lb.add(new THREE.CylinderGeometry(0.155, 0.16, yTop - 0.12, 24, 1), K.col, m4([x, (yTop + 0.12) / 2, postZ]));
    lb.add(colBand(0.155, 0.14, 24, 8), K.gold, m4([x, 0.12, postZ]));
    lb.add(colBand(0.155, 0.08, 24, 0), K.gold, m4([x, yTop - 0.36, postZ]));
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new V3(x, yTop - 0.06 + 0.22 * Math.sin(t * Math.PI * 0.5) * t, postZ + (zWall - postZ) * t)); }
    lb.add(sweep(pts, rectProfile(0.12, 0.2, -0.2)), K.red);
    lb.add(block(0.32, 0.17, 0.32), K.red, m4([x, yTop, postZ]));
    lb.box(K.cap, 0.27, 0.08, 0.008, [x, yTop + 0.11, postZ + 0.164], [0, 0, 0], 0.002);
  }
  // front rainbow beam (koryo) with gilt end fittings and a raised centre
  {
    const L = postX + 0.32, pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; const x = -L + 2 * L * t; pts.push(new V3(x, yTop + 0.17 + 0.07 * Math.sin(Math.PI * t), postZ)); }
    lb.add(sweep(pts, rectProfile(0.15, 0.3, -0.3)), K.red);
    for (const s of [-1, 1]) {
      lb.box(K.cap, 0.3, 0.31, 0.16, [s * (L - 0.14), yTop + 0.02, postZ], [0, 0, 0], 0.004);
      for (const f of [-1, 1]) lb.add(rosette(0.06, 8, 0.012), K.gold, m4([s * (postX - 0.35), yTop + 0.06, postZ + f * 0.078], [0, f > 0 ? 0 : Math.PI, 0]));
    }
  }
  // kaerumata (frog-leg strut) on the beam centre carrying the crest beam
  const yBeamTop = yTop + 0.24;
  const yRidgeB = prof(0) - cut - 0.2;
  {
    const h = yRidgeB - yBeamTop, w = Math.min(1.2, W * 0.5);
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.bezierCurveTo(-w * 0.42, h * 0.55, -w * 0.12, h * 0.55, -w * 0.09, h * 0.8);
    s.lineTo(-w * 0.12, h); s.lineTo(w * 0.12, h); s.lineTo(w * 0.09, h * 0.8);
    s.bezierCurveTo(w * 0.12, h * 0.55, w * 0.42, h * 0.55, w / 2, 0);
    s.lineTo(w * 0.32, 0);
    s.bezierCurveTo(w * 0.26, h * 0.35, w * 0.1, h * 0.38, 0, h * 0.42);
    s.bezierCurveTo(-w * 0.1, h * 0.38, -w * 0.26, h * 0.35, -w * 0.32, 0);
    s.lineTo(-w / 2, 0);
    lb.add(extrude(s, 0.12, 0.012, null, 8), K.red, m4([0, yBeamTop, postZ]));
    lb.add(rosette(0.09, 8, 0.016), K.gold, m4([0, yBeamTop + h * 0.25, postZ + 0.065]));
    lb.box(K.red, 0.3, 0.12, 0.3, [0, yRidgeB - 0.06, postZ], [0, 0, 0], 0.01);
  }
  // crest beam + side purlins along z (carry the roof)
  lb.box(K.red, 0.16, 0.2, zf - zb - 0.1, [0, yRidgeB + 0.1, (zb + zf) / 2], [0, 0, 0], 0.012);
  for (const s of [-1, 1]) {
    const xp = s * (postX + 0.05);
    lb.box(K.red, 0.16, 0.2, zf - zb - 0.1, [xp, prof(xp) - cut - 0.1, (zb + zf) / 2], [0, 0, 0], 0.012);
  }
  // roof slab: tiled top, soffit below (bell-curved section extruded along z)
  {
    const nx = 40, x0 = -W - 0.04, x1 = W + 0.04;
    const top = [], bot = [], nt = [], nb = [];
    const slope = (x) => (prof(x + 1e-3) - prof(x - 1e-3)) / 2e-3;
    for (let i = 0; i < nx; i++) {
      const xa = x0 + ((x1 - x0) * i) / nx, xb = x0 + ((x1 - x0) * (i + 1)) / nx;
      const ya = prof(xa), yb = prof(xb);
      const na = new V3(-slope(xa), 1, 0).normalize(), nB = new V3(-slope(xb), 1, 0).normalize();
      top.push(xa, ya, zb, xb, yb, zf, xb, yb, zb, xa, ya, zb, xa, ya, zf, xb, yb, zf);
      nt.push(...na.toArray(), ...nB.toArray(), ...nB.toArray(), ...na.toArray(), ...na.toArray(), ...nB.toArray());
      bot.push(xa, ya - cut, zb, xb, yb - cut, zb, xb, yb - cut, zf, xa, ya - cut, zb, xb, yb - cut, zf, xa, ya - cut, zf);
      const da = na.clone().negate(), dB = nB.clone().negate();
      nb.push(...da.toArray(), ...dB.toArray(), ...dB.toArray(), ...da.toArray(), ...dB.toArray(), ...da.toArray());
    }
    const mk = (arr, nrm) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(arr.length / 3 * 2), 2)); return g; };
    lb.add(mk(top, nt), K.tile); lb.add(mk(bot, nb), K.soffit);
    // rafters under the flanks
    for (let z = zb + 0.12; z < zf - 0.05; z += 0.24) for (const s of [-1, 1]) {
      const xa = s * (postX - 0.2), xb = s * (W - 0.02);
      const a = [xa, prof(xa) - cut - 0.05, z], b = [xb, prof(xb) - cut - 0.05, z];
      const { m, len } = beamM(a, b, [0, 1, 0]);
      lb.add(chamferBox(len, 0.08, 0.07, 0), K.rafter || K.red, m);
    }
  }
  // round-tile ribs running down both flanks, with gilt-mon end caps
  const [cd, cg] = tileCapGeos(0.062, 1);
  for (let z = zb + 0.14; z < zf - 0.06; z += 0.27) {
    const pts = [];
    for (let i = 0; i <= 36; i++) { const x = -W + (2 * W * i) / 36; pts.push(new V3(x, prof(x) + 0.03, z)); }
    lb.add(sweep(pts, roundProfile(0.062, 0, 6), { smooth: true }), K.tile);
    for (const s of [-1, 1]) lb.add(cd, K.tile, m4([s * (W + 0.005), prof(W) + 0.03, z], [0, s * Math.PI / 2, 0])), lb.add(cg, K.cap, m4([s * (W + 0.005), prof(W) + 0.03, z], [0, s * Math.PI / 2, 0]));
  }
  // crest ridge along z
  lb.add(sweep(linePath([0, zb], [0, zf + 0.06], () => prof(0) + 0.02, 0.3), ridgeProfile(0.3, 0.2, 2, 0.075, 0.08)), K.tile);
  // side eave fascia
  for (const s of [-1, 1]) lb.add(sweep(linePath([s * (W + 0.02), zb], [s * (W + 0.02), zf + 0.04], () => prof(W) - cut - 0.02, 0.4), rectProfile(0.05, 0.13)), K.red);
  // karahafu bargeboard on the front: vermilion board, gilt lower edge, gilt fittings
  {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const x = -W - 0.06 + ((2 * W + 0.12) * i) / 48; pts.push(new V3(x, prof(x) + 0.05, zf + 0.04)); }
    lb.add(sweep(pts, rectProfile(0.07, 0.3, -0.3)), K.red);
    lb.add(sweep(pts, rectProfile(0.076, 0.03, -0.31)), K.gold);
    lb.add(sweep(pts, rectProfile(0.076, 0.022, -0.005)), K.gold);
    // gegyo-like centre fitting + crest cap + end fittings
    lb.add(rosette(0.13, 8, 0.02), K.gold, m4([0, prof(0) - 0.12, zf + 0.08]));
    lb.box(K.cap, 0.36, 0.3, 0.09, [0, prof(0) - 0.1, zf + 0.04], [0, 0, 0], 0.01);
    for (const s of [-1, 1]) {
      lb.box(K.cap, 0.3, 0.32, 0.09, [s * (W - 0.08), prof(W) - 0.1, zf + 0.04], [0, 0, 0], 0.01);
      for (const t of [0.35, 0.62]) lb.add(rosette(0.045, 6, 0.01), K.gold, m4([s * W * t, prof(W * t) - 0.1, zf + 0.08]));
    }
  }
  // gable board behind the bargeboard (above the koryo), with a gilt mon
  {
    const s = new THREE.Shape();
    const xa = W - 0.3, n = 24;
    s.moveTo(-xa, yBeamTop - 0.02);
    for (let i = 0; i <= n; i++) { const x = -xa + (2 * xa * i) / n; s.lineTo(x, prof(x) - cut - 0.02); }
    s.lineTo(xa, yBeamTop - 0.02); s.lineTo(-xa, yBeamTop - 0.02);
    lb.add(extrude(s, 0.04, 0, null, 2), K.plaster, m4([0, 0, zf - 0.2]));
  }
  return { prof, yBeamTop };
}

// ---------------------------------------------------------------------------
// SIDE HALL
// ---------------------------------------------------------------------------
export function buildSideHall(ctx, K, lb, anchors, toW, spec) {
  const nb = spec.w >= 13 ? 5 : 4;
  const bw = spec.w >= 13 ? 2.2 : 2.35;
  const xs = []; for (let i = 0; i <= nb; i++) xs.push(+(-nb * bw / 2 + i * bw).toFixed(3));
  const nd = 3, bd = spec.d >= 9 ? 2.1 : 1.95;
  const zs = []; for (let i = 0; i <= nd; i++) zs.push(+(-nd * bd / 2 + i * bd).toFixed(3));
  const cx = xs[xs.length - 1], cz = zs[zs.length - 1];
  const yF = 0.62;
  // podium (kidan) with coping and front steps
  lb.box(K.stone, 2 * cx + 2.2, 0.6, 2 * cz + 2.2, [0, yF / 2 - 0.08, 0], [0, 0, 0], 0.04);
  lb.box(K.stoneClean, 2 * cx + 2.3, 0.1, 2 * cz + 2.3, [0, yF - 0.05, 0], [0, 0, 0], 0.025);
  for (let i = 0; i < 3; i++) {
    const y = (i + 1) * (yF / 3);
    lb.box(K.stoneClean, bw * 1.6, y, 0.34, [0, y / 2, cz + 1.15 + (2 - i) * 0.32 + 0.17], [0, 0, 0], 0.015);
  }
  const mid = Math.floor(nb / 2);
  // wooden veranda (engawa) on the front with a koran railing (gap at the steps)
  {
    const vz0 = cz + 0.2, vz1 = cz + 1.05, vy = yF + 0.06;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const z = vz0 + ((vz1 - vz0) * (i + 0.5)) / n;
      lb.box(spec.facing[0] !== 0 ? K.floorZ : K.floorX, 2 * cx + 1.0, 0.04, (vz1 - vz0) / n - 0.006, [0, vy - 0.02, z], [0, 0, 0], 0.003);
    }
    lb.box(K.redDark, 2 * cx + 1.04, 0.16, 0.1, [0, vy - 0.1, vz1], [0, 0, 0], 0.01);
    const sw = bw * 0.8;
    const rx = cx + 0.45, rz = vz1 - 0.06;
    railing(lb, [[-sw, rz], [-rx, rz], [-rx, vz0 + 0.05]], vy, { H: 0.72, post: 0.11, spacing: 1.5, midY: 0.4, gibSeg: 16, lo: true, panelGold: false, K: { red: K.red, redDark: K.redDark, gold: K.gold, gib: K.gib } });
    railing(lb, [[sw, rz], [rx, rz], [rx, vz0 + 0.05]], vy, { H: 0.72, post: 0.11, spacing: 1.5, midY: 0.4, gibSeg: 16, lo: true, panelGold: false, K: { red: K.red, redDark: K.redDark, gold: K.gold, gib: K.gib } });
  }
  const H = hallBuilding(lb, K, {
    xs, zs, colR: 0.2, y0: yF, yct: yF + 3.55, knH: 0.26,
    walls: (side, i, n) => {
      if (side === 'front') return (n % 2 === 1 && i === mid) || (n % 2 === 0 && (i === n / 2 - 1 || i === n / 2)) ? 'door' : 'window';
      if (side === 'back') return i === 0 || i === n - 1 ? 'plaster' : 'window';
      return 'window';
    },
    BS: { tiers: 3, proj: [0.42, 0.8], armH: 0.14, armW: 0.12, blockH: 0.11, daito: [0.32, 0.19], mak: [0.18, 0.11], wall: [0.85, 1.05, 1.2], inner: false, goldCaps: true, goldMak: true, goldDaito: false, K: { wood: K.red, gold: K.cap } },
    ov: 1.9, liftL: 0.42, roofRise: spec.w >= 13 ? 3.6 : 3.2, ovG: 0.6, tileP: 0.28, tileDetail: 1,
    oni: { s: 0.85 }, lo: true, gableLattice: true, infill: true,
  });
  for (const h of H.E.hooks) anchors.bells.push({ pos: toW(h.local), scale: 0.9, rotY: 0 });
  // karahafu step canopy (kohai) over the front stairs
  const postX = bw * 0.8 + 0.4, Wk = postX + 0.75, yEk = 4.1, cut = 0.1;
  const profK = (x) => yEk + 0.34 * (1 + Math.cos(Math.PI * Math.min(Math.abs(x) / Wk, 1)));
  const kh = karaKohai(lb, K, {
    W: Wk, zb: cz + 1.25, zf: cz + 3.05, yE: yEk, H: 0.68, postX, postZ: cz + 2.55,
    yTop: profK(postX) - cut - 0.2 - 0.17, zWall: cz + 0.1,
  });
  {
    const yh = kh.prof(0) - cut - 0.2, zl = cz + 1.8;
    lb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), K.gold, m4([0, yh - 0.1, zl]));
    anchors.hangingLanterns.push({ pos: toW([0, yh - 0.2, zl]), scale: 0.95, rotY: 0 });
  }
  // lanterns under the front eave, one per bay (a rhythm of lanterns along the eaves)
  for (let i = 0; i < nb; i++) {
    const x = (xs[i] + xs[i + 1]) / 2;
    if (Math.abs(x) < Wk + 0.35) continue;   // the kohai covers the middle bays
    const d = 0.9, zl = cz + 1.9 - d;
    const yr = H.E.yBB(d) + H.lift(x, zl);
    lb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), K.gold, m4([x, yr - 0.15, zl]));
    anchors.hangingLanterns.push({ pos: toW([x, yr - 0.3, zl]), scale: 0.95, rotY: 0 });
  }
}
