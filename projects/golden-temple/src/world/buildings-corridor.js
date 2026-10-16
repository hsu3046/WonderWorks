// ---------------------------------------------------------------------------
// KAIRO — the enclosing roofed corridor. Instanced bay units + column lines +
// deduplicated columns; non-instanced L-shaped corner pieces (hip outside,
// valley inside) that also contain one bay of each run.
// Unit frame: x along the run (0..bay), z across (-z = OUTER side with wall), y up.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LB, m4, beamM, chamferBox, block, lathe, colBand, sweep, rectProfile, roundProfile, roofSurface, tileCapGeos, tileParams, armGeo, extrude, rosette, hash3, buildIx } from './buildings-kit.js';
import { ridgeProfile, rafterField, linePath } from './buildings-arch.js';

export const CW = 2.68;          // tile eave half width
const TIP = 0.08;                // rafter tip line inset from the tile eave
const COLZ = 1.5;                // column rows at z = +-1.5
const COL_R = 0.15;
const Y_PL = 0.45;               // plinth top
const Y_COLTOP = 3.35;
const Y_PLATE = 3.80;            // wall plate top (= rafter bottom at the column line)
const S_RAF = 0.42;
const RAF = [0.08, 0.1];
const FASCIA_H = 0.1;
const yRB = (d) => Y_PLATE + S_RAF * (d - (CW - COLZ));
const yRT = (d) => yRB(d) + RAF[1];
const TILE = { p: 3.6 / 13, c: 0.3, rw: 0.13, rh: 0.055, pd: 0.016, lip: 0.05, thR: 0.02, thP: 0.012, detail: 0 };
const Y0 = yRT(TIP) + FASCIA_H + TILE.lip + TILE.pd;
const prof = (d) => 0.42 * d + 0.045 * d * d;
export const CORRIDOR_RIDGE_Y = Y0 + prof(CW);

// ---------------------------------------------------------------------------
// body of one bay (no columns, no roof): plinth, beams, ridge beam, outer wall
// ---------------------------------------------------------------------------
function body(lb, K, bay, { wall = true } = {}) {
  const half = bay / 2;
  // plinth: two courses of blocks + top slabs
  for (let i = 0; i < 2; i++) {
    const x = half * (i + 0.5);
    lb.box(K.stone, half - 0.01, 0.5, 4.3, [x, -0.2, 0], [0, 0, 0], 0.03);
    lb.box(K.stone, half - 0.01, 0.28, 4.3, [x, 0.19, 0], [0, 0, 0], 0.025);
    for (let j = 0; j < 3; j++) lb.box(K.stoneClean, half - 0.012, 0.12, 4.3 / 3 - 0.012, [x, 0.39, -4.3 / 3 + j * (4.3 / 3)], [0, 0, 0], 0.012);
  }
  for (const s of [-1, 1]) {
    lb.box(K.red, bay, 0.22, 0.12, [half, Y_COLTOP - 0.11, s * COLZ], [0, 0, 0], 0.012);
    lb.box(K.red, bay, 0.16, 0.15, [half, Y_PLATE - 0.08, s * COLZ], [0, 0, 0], 0.012);
  }
  lb.box(K.red, bay, 0.18, 0.17, [half, yRB(CW) - 0.09, 0], [0, 0, 0], 0.012);
  if (wall) outerWall(lb, K, COL_R, bay - COL_R, -COLZ, true);
}
// wall between a and b (along x) at z = zw
function outerWall(lb, K, a, b, zw) {
  const L = b - a, x = (a + b) / 2;
  lb.box(K.red, L, 0.15, 0.15, [x, Y_PL + 0.075, zw], [0, 0, 0], 0.012);
  lb.box(K.plaster, L, 0.6, 0.1, [x, Y_PL + 0.15 + 0.3, zw]);
  lb.box(K.red, L, 0.12, 0.14, [x, 1.26, zw], [0, 0, 0], 0.012);
  lb.box(K.red, L, 0.06, 0.13, [x, 1.35, zw], [0, 0, 0], 0.008);
  lb.box(K.red, L, 0.06, 0.13, [x, 2.41, zw], [0, 0, 0], 0.008);
  const n = Math.floor(L / 0.13);
  for (let i = 1; i < n; i++) lb.add(chamferBox(0.048, 1.0, 0.048, 0), K.lattice, m4([a + (L * i) / n, 1.88, zw], [0, Math.PI / 4, 0]));
  lb.box(K.red, L, 0.16, 0.16, [x, 2.54, zw], [0, 0, 0], 0.014);
  lb.box(K.plaster, L, 0.51, 0.1, [x, 2.875, zw]);
}

// roof package over faces: tiles, caps, soffit, rafters
function roofPackage(lb, K, faces, T, { rafSp = 0.26 } = {}) {
  const tf = faces.map((F) => ({ ...F, y0: Y0, prof, lip: F.lip !== false }));
  const { geo, caps } = roofSurface(tf, T, () => 0);
  lb.addIx(geo, K.tileVC);
  const [cd, cg] = tileCapGeos(T.rw * 0.55, T.detail);
  for (const c of caps) {
    const mm = m4(c.pos, [0, Math.atan2(c.out[0], c.out[1]), 0]);
    lb.add(cd, K.tile, mm); lb.add(cg, K.cap, mm);
  }
  const sf = faces.map((F) => ({ ...F, y0: 0, prof: yRT, dmin: (u) => Math.max(TIP, F.dmin ? F.dmin(u) : 0) }));
  const s = roofSurface(sf, null, () => 0, { flip: true, du: 0.4, dd: 0.4 }).geo;
  s.deleteAttribute('color');
  lb.add(s, K.soffit);
  rafterField(lb, faces, { sp: rafSp, w: RAF[0], h: RAF[1], yBot: yRB, dStart: TIP, mat: K.red, capMat: K.capPaint, lo: true });
}
function fascia(lb, K, pts, inside) {
  const path = pts.map(([x, z]) => new THREE.Vector3(x, yRT(TIP), z));
  const prof = [[-0.045, 0], [0.045, 0], [0.045, FASCIA_H - 0.02], [0.13, FASCIA_H - 0.02], [0.13, FASCIA_H], [-0.045, FASCIA_H]];
  lb.add(sweep(path, prof, { inside }), K.red);
}

// ---------------------------------------------------------------------------
// The repeating bay unit (built for bay = 3.6, instanced with x-scale)
// ---------------------------------------------------------------------------
function unitBay(lb, K) {
  const bay = 3.6;
  body(lb, K, bay);
  const T = tileParams({ ...TILE, phase: 0 });
  const faces = [
    { O: [0, CW], a: [1, 0], n: [0, -1], u0: 0, u1: bay, dmax: () => CW },
    { O: [0, -CW], a: [-1, 0], n: [0, 1], u0: -bay, u1: 0, dmax: () => CW },
  ];
  roofPackage(lb, K, faces, T, { rafSp: bay / 14 });
  for (const s of [-1, 1]) fascia(lb, K, [[0, s * (CW - TIP - 0.045)], [bay, s * (CW - TIP - 0.045)]], [bay / 2, 0]);
  lb.add(sweep(linePath([0, 0], [bay, 0], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), ridgeProfile(0.42, 0.36, 4, 0.08, 0.3)), K.tile);
}
// column line: koryo (rainbow beam) across, kaerumata, ridge block, funahijiki on both columns
function unitLine(lb, K) {
  // koryo
  const top = Y_PLATE;
  const s = new THREE.Shape();
  s.moveTo(-1.82, top - 0.26); s.lineTo(-1.5, top - 0.28);
  s.quadraticCurveTo(0, top - 0.17, 1.5, top - 0.28); s.lineTo(1.82, top - 0.26);
  s.lineTo(1.86, top - 0.12); s.lineTo(1.8, top); s.lineTo(-1.8, top); s.lineTo(-1.86, top - 0.12); s.lineTo(-1.82, top - 0.26);
  lb.add(extrude(s, 0.17, 0.012, 'koryo', 4), K.red, m4([0, 0, 0], [0, Math.PI / 2, 0]));
  for (const sz of [-1, 1]) lb.add(chamferBox(0.18, 0.2, 0.012, 0.003), K.cap, m4([0, top - 0.13, sz * 1.86]));
  // kaerumata (frog-leg strut) from koryo top to the ridge daito
  const kh = yRB(CW) - 0.18 - 0.11 - 0.14 - top;
  const k = new THREE.Shape();
  k.moveTo(-0.42, 0); k.lineTo(-0.3, 0);
  k.bezierCurveTo(-0.2, kh * 0.45, -0.1, kh * 0.6, -0.07, kh); k.lineTo(0.07, kh);
  k.bezierCurveTo(0.1, kh * 0.6, 0.2, kh * 0.45, 0.3, 0); k.lineTo(0.42, 0);
  k.bezierCurveTo(0.3, kh * 0.55, 0.16, kh * 0.8, 0.12, kh + 0.02); k.lineTo(-0.12, kh + 0.02);
  k.bezierCurveTo(-0.16, kh * 0.8, -0.3, kh * 0.55, -0.42, 0);
  lb.add(extrude(k, 0.11, 0, 'kaeru' + kh.toFixed(3), 3), K.red, m4([0, top, 0], [0, Math.PI / 2, 0]));
  lb.add(rosette(0.045, 6, 0.01, true), K.cap, m4([0.06, top + kh * 0.35, 0], [0, Math.PI / 2, 0]));
  lb.add(rosette(0.045, 6, 0.01, true), K.cap, m4([-0.06, top + kh * 0.35, 0], [0, -Math.PI / 2, 0]));
  lb.add(block(0.26, 0.14, 0.26), K.red, m4([0, top + kh + 0.02, 0]));
  lb.add(armGeo(0.9, 0.11, 0.12, true), K.red, m4([0, top + kh + 0.16, 0]));
  // funahijiki on the column daito, along the run
  for (const sz of [-1, 1]) lb.add(armGeo(1.24, 0.12, 0.13, true), K.red, m4([0, Y_COLTOP + 0.17, sz * COLZ]));
}
function unitColumn(lb, K) {
  lb.add(lathe([[0, -0.05], [0.25, -0.05], [0.25, 0.02], [0.22, 0.05], [0.18, 0.07], [0, 0.07]], 10, 'csos'), K.stoneClean, m4([0, Y_PL, 0]));
  lb.add(new THREE.CylinderGeometry(COL_R, COL_R * 1.02, Y_COLTOP - Y_PL - 0.07, 16, 1), K.col, m4([0, (Y_COLTOP + Y_PL + 0.07) / 2, 0]));
  lb.add(colBand(COL_R, 0.11, 12, 0, true), K.gold, m4([0, Y_PL + 0.07, 0]));
  lb.add(block(0.32, 0.17, 0.32), K.red, m4([0, Y_COLTOP, 0]));
}

// ---------------------------------------------------------------------------
// Corner piece (canonical): corner at the origin; run A extends toward -x,
// run B toward +z; outer quadrant (+x,-z). Includes one bay of each run.
// ---------------------------------------------------------------------------
function cornerPiece(lb, K, bayA, bayB) {
  const W = CW;
  const Lx = COLZ + bayA, Lz = COLZ + bayB;
  // bodies of the two included bays
  body(lb.child(m4([-Lx, 0, 0])), K, bayA);
  body(lb.child(m4([0, 0.003, COLZ], [0, -Math.PI / 2, 0])), K, bayB);
  // corner square plinth: region x in [-1.5, 2.15], z in [-2.15, 1.5] (the bays cover the rest)
  {
    const sx = 3.65, cxp = 0.325, czp = -0.325;
    lb.box(K.stone, sx - 0.01, 0.5, sx - 0.01, [cxp, -0.2, czp], [0, 0, 0], 0.03);
    lb.box(K.stone, sx - 0.01, 0.28, sx - 0.01, [cxp, 0.19, czp], [0, 0, 0], 0.025);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) lb.box(K.stoneClean, sx / 3 - 0.012, 0.12, sx / 3 - 0.012, [cxp - sx / 3 + i * sx / 3, 0.39, czp - sx / 3 + j * sx / 3], [0, 0, 0], 0.012);
  }
  for (const s of [-1, 1]) {
    lb.box(K.red, 2 * COLZ, 0.22, 0.12, [0, Y_COLTOP - 0.11, s * COLZ], [0, 0, 0], 0.012);
    lb.box(K.red, 0.12, 0.22, 2 * COLZ, [s * COLZ, Y_COLTOP - 0.11, 0], [0, 0, 0], 0.012);
    lb.box(K.red, 2 * COLZ + 0.15, 0.16, 0.15, [0, Y_PLATE - 0.08, s * COLZ], [0, 0, 0], 0.012);
    lb.box(K.red, 0.15, 0.16, 2 * COLZ + 0.15, [s * COLZ, Y_PLATE - 0.08, 0], [0, 0, 0], 0.012);
  }
  lb.box(K.red, COLZ + 0.1, 0.18, 0.17, [-COLZ / 2, yRB(CW) - 0.09, 0], [0, 0, 0], 0.012);
  lb.box(K.red, 0.17, 0.18, COLZ + 0.1, [0, yRB(CW) - 0.09, COLZ / 2], [0, 0, 0], 0.012);
  lb.add(block(0.3, 0.3, 0.3), K.red, m4([0, yRB(CW) - 0.18 - 0.3, 0]));
  lb.add(new THREE.CylinderGeometry(0.09, 0.09, yRB(CW) - 0.48 - Y_PLATE, 12), K.col, m4([0, (yRB(CW) - 0.48 + Y_PLATE) / 2, 0]));
  outerWall(lb, K, -COLZ + COL_R, COLZ - COL_R, -COLZ);
  outerWall(lb.child(m4([0, 0, 0], [0, -Math.PI / 2, 0])), K, -COLZ + COL_R, COLZ - COL_R, -COLZ);
  // roof faces (hip on the outer diagonal, valley on the inner diagonal)
  const faces = [
    { O: [0, -W], a: [1, 0], n: [0, 1], u0: -Lx, u1: W, dmax: (u) => (u <= 0 ? W : W - u), phase: -COLZ, p: bayA / 13 },
    { O: [0, W], a: [1, 0], n: [0, -1], u0: -Lx, u1: 0, dmin: (u) => Math.max(0, u + W), dmax: () => W, phase: -COLZ, p: bayA / 13 },
    { O: [W, 0], a: [0, 1], n: [-1, 0], u0: -W, u1: Lz, dmax: (u) => (u < 0 ? u + W : W), phase: COLZ, p: bayB / 13 },
    { O: [-W, 0], a: [0, 1], n: [1, 0], u0: 0, u1: Lz, dmin: (u) => Math.max(0, W - u), dmax: () => W, phase: COLZ, p: bayB / 13 },
  ];
  for (const F of faces) {
    const T = tileParams({ ...TILE, p: F.p, phase: F.phase });
    roofPackage(lb, K, [F], T, { rafSp: 0.26 });
  }
  // fascia L's
  const f = CW - TIP - 0.045;
  fascia(lb, K, [[-Lx, -f], [f, -f], [f, Lz]], [0, 0]);
  fascia(lb, K, [[-Lx, f], [-f, f], [-f, Lz]], [0, 0]);
  // ridges: A, B, hip
  const rp = ridgeProfile(0.42, 0.36, 4, 0.08, 0.3);
  lb.add(sweep(linePath([-Lx, 0], [0.12, 0], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), rp), K.tile);
  lb.add(sweep(linePath([0, -0.12], [0, Lz], () => CORRIDOR_RIDGE_Y - 0.02, 0.9), rp), K.tile);
  const hp = ridgeProfile(0.3, 0.26, 3, 0.065, 0.18);
  lb.add(sweep(linePath([0.05, -0.05], [W + 0.03, -W - 0.03], (x, z) => Y0 + prof(W - Math.max(x, -z)) - 0.02, 0.2), hp), K.tile);
  // small oni at the hip end
  const oy = Y0 - 0.06;
  lb.add(chamferBox(0.34, 0.36, 0.1, 0.02), K.tile, m4([W + 0.06, oy + 0.12, -W - 0.06], [0, Math.PI * 0.75, 0]));
  lb.add(rosette(0.07, 8, 0.016, true), K.cap, m4([W + 0.1, oy + 0.14, -W - 0.1], [0, Math.PI * 0.75, 0]));
  // valley channel (dark metal)
  lb.add(sweep(linePath([-W, W], [-0.15, 0.15], (x, z) => Y0 + prof(W - Math.min(-x, z)) - 0.035, 0.25), rectProfile(0.14, 0.02)), K.black);
}

// ---------------------------------------------------------------------------
export function buildCorridor(ctx, K, parent) {
  const { geom, L } = ctx;
  const R = L.corridor.rect;
  const gate = L.gate;
  const gx0 = gate.center[0] - 5.14, gx1 = gate.center[0] + 5.14; // corridor ends flush at the gate side walls
  // runs: P0 column line, dir, count, yaw (unit +x -> dir, unit -z -> outer)
  const runs = [
    { name: 'N', P0: [R.minX + COLZ, R.minZ], dir: [1, 0], len: (R.maxX - COLZ) - (R.minX + COLZ), yaw: 0, skip0: 1, skip1: 1, lines: true, endLine: true },
    { name: 'SE', P0: [R.maxX - COLZ, R.maxZ], dir: [-1, 0], len: (R.maxX - COLZ) - gx1, yaw: Math.PI, skip0: 1, skip1: 0, endLine: false },
    { name: 'SW', P0: [gx0, R.maxZ], dir: [-1, 0], len: gx0 - (R.minX + COLZ), yaw: Math.PI, skip0: 0, skip1: 1, startLine: false, endLine: true },
    { name: 'W', P0: [R.minX, R.maxZ - COLZ], dir: [0, -1], len: (R.maxZ - COLZ) - (R.minZ + COLZ), yaw: Math.PI / 2, skip0: 1, skip1: 1, endLine: true },
    { name: 'E', P0: [R.maxX, R.minZ + COLZ], dir: [0, 1], len: (R.maxZ - COLZ) - (R.minZ + COLZ), yaw: -Math.PI / 2, skip0: 1, skip1: 1, endLine: true },
  ];
  const unitM = [], lineM = [], colPos = new Map();
  const addCol = (x, z) => { const k = `${x.toFixed(2)},${z.toFixed(2)}`; if (!colPos.has(k)) colPos.set(k, [x, z]); };
  for (const r of runs) {
    r.n = Math.max(1, Math.round(r.len / 3.6));
    r.bay = r.len / r.n;
    const out = [r.dir[1], -r.dir[0]]; // not used directly; yaw encodes it
    for (let i = 0; i <= r.n; i++) {
      const p = [r.P0[0] + r.dir[0] * r.bay * i, r.P0[1] + r.dir[1] * r.bay * i];
      const isStart = i === 0, isEnd = i === r.n;
      if (i < r.n && i >= r.skip0 && i < r.n - r.skip1) unitM.push(new THREE.Matrix4().compose(new THREE.Vector3(p[0], 0, p[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw), new THREE.Vector3(r.bay / 3.6, 1, 1)));
      if ((isStart && r.startLine === false) || (isEnd && r.endLine === false)) continue;
      lineM.push(new THREE.Matrix4().compose(new THREE.Vector3(p[0], 0, p[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw), new THREE.Vector3(1, 1, 1)));
      // two columns: unit z = +-COLZ -> world
      const c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      for (const zz of [-COLZ, COLZ]) addCol(p[0] + s * zz, p[1] + c * zz);
    }
  }
  // corner pieces
  const byName = Object.fromEntries(runs.map((r) => [r.name, r]));
  const corners = [
    { at: [R.maxX, R.minZ], yaw: 0, A: byName.N.bay, B: byName.E.bay },
    { at: [R.minX, R.minZ], yaw: Math.PI / 2, A: byName.W.bay, B: byName.N.bay },
    { at: [R.minX, R.maxZ], yaw: Math.PI, A: byName.SW.bay, B: byName.W.bay },
    { at: [R.maxX, R.maxZ], yaw: -Math.PI / 2, A: byName.E.bay, B: byName.SE.bay },
  ];
  const cb = new geom.Builder(); const cix = new Map();
  for (const c of corners) {
    const base = new THREE.Matrix4().makeRotationY(c.yaw).setPosition(c.at[0], 0, c.at[1]);
    const lb = new LB(cb, base, cix);
    cornerPiece(lb, K, c.A, c.B);
    // outer corner column
    const oc = new THREE.Vector3(COLZ, 0, -COLZ).applyMatrix4(base);
    addCol(oc.x, oc.z);
  }
  const cg = cb.build({ name: 'corridorCorners' });
  buildIx(cix, cg);
  parent.add(cg);
  // instanced sets
  const mkInst = (fn, mats, name) => {
    const b = new geom.Builder(); const ix = new Map();
    fn(new LB(b, new THREE.Matrix4(), ix), K);
    const g = b.build({ name: name + 'Proto' });
    const meshes = [];
    g.children.forEach((m) => meshes.push({ geo: m.geometry, mat: m.material }));
    for (const { mat, geos } of ix.values()) {
      const merged = ctx.geom.mergeGeometries(geos, false);
      meshes.push({ geo: merged, mat });
    }
    for (const { geo, mat } of meshes) {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true; im.name = name;
      im.computeBoundingSphere(); im.computeBoundingBox?.();
      parent.add(im);
    }
    let tris = 0; for (const { geo } of meshes) tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return tris * mats.length;
  };
  const colM = [...colPos.values()].map(([x, z]) => new THREE.Matrix4().makeTranslation(x, 0, z));
  const t1 = mkInst(unitBay, unitM, 'corridorBay');
  const t2 = mkInst(unitLine, lineM, 'corridorLine');
  const t3 = mkInst(unitColumn, colM, 'corridorColumn');
  console.log(`[buildings] corridor: bays=${unitM.length} lines=${lineM.length} cols=${colM.length} tris~${Math.round((t1 + t2 + t3) / 1000)}k`);
}
