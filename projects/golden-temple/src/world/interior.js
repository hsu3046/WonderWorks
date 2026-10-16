// ---------------------------------------------------------------------------
// INTERIOR — the inner sanctum of the main hall.
// Golden Amida on a lotus throne with a flame mandorla, two bodhisattvas,
// lacquer + gold altar with offerings, canopy, banners, lanterns, coffered
// ceiling, columns, tatami + polished wood floor, incense smoke, dust.
// Everything inside x in [cx-12.5, cx+12.5], z in [cz-8, cz+8], y in [2.12, 9.2].
// ---------------------------------------------------------------------------
import { meshSDF, surfacePoint, sdfNormal, disposePool } from './interior-sdf.js';
import { getShape, HAIR } from './interior-shapes.js';
import { makeInteriorMaterials, boxProject } from './interior-mats.js';
import { petalGeo, latheGeo, ringGeo, rbox, merge, extrude, flameShape } from './interior-geo.js';
import * as THREE from 'three';
import {
  buildShumidan, buildFrontTable, buildRaiban, buildFloorLantern, buildCandlestick, flameGeo,
  buildIncenseBurner, buildJoka, buildFlowerVase, flowerHeadGeo, leafGeo, buildFruitStand, addTassel,
  buildKin, buildMokugyo, buildSutraDesk,
} from './interior-altar.js';
import { makeStrandKit, flushStrands, buildCanopy, buildBanner, buildPendantLantern } from './interior-hang.js';
import { buildColumns, buildBeams, buildCeiling, buildBackScreen, buildSideScreen } from './interior-arch.js';
import { buildShafts, buildDust, buildSmoke } from './interior-fx.js';

export async function build(ctx) {
  const { THREE, L, geom } = ctx;
  const t0 = performance.now();
  const M = makeInteriorMaterials(ctx);
  const root = new THREE.Group();
  root.name = 'interior';
  const [cx, , cz] = L.hall.center;
  const Y0 = 2.12;
  const S = {
    cx, cz, Y0,
    zB: cz - 5.4,          // main Buddha axis (z)
    daisH: 0.62,
    pedH: 1.12,            // octagonal pedestal (below the lotus)
    lotusH: 0.65,
    beamY: 7.7,            // column tops
    ceilY: 8.95,           // coffered ceiling panel plane
  };
  S.yThrone = Y0 + S.daisH;
  S.ySeat = S.yThrone + S.pedH + S.lotusH;
  S.probe = [cx, 4.6, cz - 0.5];
  // parallax-corrected reflections on the polished floor and lacquer
  const bpBox = { min: [cx - 12.5, Y0 - 0.05, cz - 8.0], max: [cx + 12.5, 9.2, cz + 8.0], probe: S.probe };
  boxProject(THREE, M.woodFloor, bpBox);
  boxProject(THREE, M.black, bpBox);
  const B = new geom.Builder();
  const K = makeStrandKit();
  const rnd = ctx.rng('interior').next;
  const flames = [], embers = [], lights = [];
  const inst = { flowers: [], leaves: [] };

  // ---------------------------------------------------------------- floor + dais
  buildFloor(ctx, B, M, S);
  buildShumidan(B, M, { x: cx, y: Y0, z: cz - 5.62, w: 10.0, d: 4.6, h: S.daisH, panels: 10, sidePanels: 4 });

  // ---------------------------------------------------------------- figures
  const figures = await buildFigures(ctx, M, S);
  root.add(figures);

  // ---------------------------------------------------------------- thrones + mandorlas
  buildThrone(ctx, B, M, S, { x: cx, z: S.zB, y: S.yThrone, scale: 1 });
  buildMandorla(ctx, B, M, { x: cx, y: S.ySeat, z: S.zB, s: 1, headY: HAIR.HPY + (2.03 - HAIR.HPY) * HAIR.HK - HAIR.HD });
  for (const sx of [-1, 1]) {
    const ax = cx + sx * 3.35, az = cz - 4.75, s = 0.58;
    buildThrone(ctx, B, M, S, { x: ax, z: az, y: S.yThrone, scale: s, rows: 3 });
    const seat = S.yThrone + (S.pedH + S.lotusH) * s;
    buildMandorla(ctx, B, M, { x: ax, y: seat, z: az, s: 0.6, headY: 1.19, bodhi: true });
    buildBodhiOrnaments(ctx, B, M, { x: ax, y: seat, z: az });
  }

  // ---------------------------------------------------------------- altar + offerings
  const yA = Y0 + 1.05;
  buildShumidan(B, M, { x: cx, y: Y0, z: cz - 2.55, w: 7.4, d: 1.7, h: 1.05, panels: 6, sidePanels: 2, ids: [4, 7, 5, 5, 7, 4] });
  for (const sx of [-1, 1]) {
    buildJoka(B, M, { x: cx + sx * 1.8, y: yA, z: cz - 2.85, s: 1.3 }, rnd);
    buildCandlestick(B, M, { x: cx + sx * 0.85, y: yA, z: cz - 2.05, h: 0.5 }, flames);
    buildCandlestick(B, M, { x: cx + sx * 2.75, y: yA, z: cz - 2.15, h: 0.72 }, flames);
    lights.push({ p: buildFloorLantern(B, M, { x: cx + sx * 2.35, y: yA, z: cz - 3.0, s: 0.5 }).light, i: 0 });
    buildFlowerVase(B, M, { x: cx + sx * 1.15, y: yA, z: cz - 2.95, s: 0.75, h: 0.75, spread: 0.32, n: 20, pink: 0.3 }, rnd, inst);
    buildFruitStand(B, M, { x: cx + sx * 0.4, y: yA, z: cz - 2.15 });
    buildFlowerVase(B, M, { x: cx + sx * 3.25, y: yA, z: cz - 2.6, s: 0.7, h: 0.7, spread: 0.3, n: 16, pink: 0.45 }, rnd, inst);
  }
  const smokeSrc2 = buildIncenseBurner(B, M, { x: cx, y: yA, z: cz - 2.3, s: 0.45 }, embers);

  // front table + big incense burner + candles
  const yT = Y0 + 0.85;
  buildFrontTable(B, M, { x: cx, y: Y0, z: cz - 1.05, w: 3.2, d: 0.8, h: 0.85 });
  const smokeSrc = buildIncenseBurner(B, M, { x: cx, y: yT, z: cz - 1.08, s: 0.85 }, embers);
  for (const sx of [-1, 1]) {
    buildCandlestick(B, M, { x: cx + sx * 1.25, y: yT, z: cz - 1.0, h: 0.42 }, flames);
    buildFlowerVase(B, M, { x: cx + sx * 0.72, y: yT, z: cz - 1.2, s: 0.55, h: 0.55, spread: 0.22, n: 12, pink: 0.25 }, rnd, inst);
  }
  buildRaiban(B, M, { x: cx, y: Y0, z: cz + 0.35 });
  buildSutraDesk(B, M, { x: cx, y: Y0 + 0.16, z: cz - 0.2 });
  buildKin(B, M, { x: cx + 1.3, y: Y0, z: cz + 0.2 });
  buildMokugyo(B, M, { x: cx - 1.3, y: Y0, z: cz + 0.2 });

  // floor lanterns + big flower arrangements on stands
  for (const sx of [-1, 1]) {
    lights.push({ p: buildFloorLantern(B, M, { x: cx + sx * 2.65, y: Y0, z: cz - 0.55, s: 1.0 }).light, i: 1 });
    // low black stand + big arrangement
    B.add(latheGeo([[0, 0], [0.36, 0], [0.36, 0.05], [0.3, 0.07], [0.3, 0.3], [0.38, 0.33], [0.38, 0.38], [0, 0.38]], 8, Math.PI / 8), M.black, geom.mat4([cx + sx * 4.55, Y0, cz - 1.15]));
    buildFlowerVase(B, M, { x: cx + sx * 4.55, y: Y0 + 0.38, z: cz - 1.15, s: 1.35, h: 1.1, spread: 0.6, n: 64, pink: 0.4 }, rnd, inst);
  }

  // ---------------------------------------------------------------- architecture
  const colX = [-9.29, -5.57, 5.57, 9.29], colZ = [5.1, 1.7, -1.7, -5.1];
  const cols = [];
  for (const x of colX) for (const z of colZ) cols.push({ x: cx + x, z: cz + z, r: Math.abs(x) < 6 ? 0.36 : 0.32 });
  buildColumns(B, M, S, cols);
  buildBeams(B, M, S, colX, colZ);
  const fit = buildCeiling(ctx, B, M, S, { x0: cx - 12.4, x1: cx + 12.4, z0: cz - 7.95, z1: cz + 7.95, yc: S.ceilY, cell: 0.885 });
  root.add(fit);
  buildBackScreen(B, M, S, { x0: cx - 5.2, x1: cx + 5.2, z: cz - 7.9, y0: Y0, y1: S.ceilY - 0.12 });
  for (const sx of [-1, 1]) buildSideScreen(B, M, S, { x: cx + sx * 7.45, z0: cz - 7.95, z1: cz - 2.3, y0: Y0, y1: 6.6, facing: -sx });

  // ---------------------------------------------------------------- hanging ornaments
  // great tengai over the Amida: wide, with the long strands on the outside so the curtain
  // frames the head (the centre stays short enough to clear the face from the shot-6 eye line)
  buildCanopy(B, M, K, { x: cx, y: S.ceilY - 0.12, z: S.zB + 0.75, r: 2.05, depth: 0.46, rings: 8, lenOuter: 1.75, lenInner: 1.0 }, rnd);
  for (const sx of [-1, 1]) {
    buildCanopy(B, M, K, { x: cx + sx * 3.35, y: S.ceilY - 0.3, z: cz - 4.3, r: 0.85, depth: 0.3, rings: 4, lenOuter: 1.2, lenInner: 0.95 }, rnd);
    buildBanner(B, M, K, { x: cx + sx * 4.6, y: S.ceilY - 0.15, z: cz - 1.0, w: 0.74, plates: 5, plateH: 0.66 }, rnd);
    lights.push({ p: buildPendantLantern(B, M, K, { x: cx + sx * 3.05, y: S.ceilY - 0.12, z: cz - 0.2, s: 1.0, chain: 1.45 }, rnd), i: 2 });
    buildPendantLantern(B, M, K, { x: cx + sx * 6.7, y: S.ceilY - 0.12, z: cz - 1.0, s: 1.15, chain: 1.3 }, rnd);
    buildPendantLantern(B, M, K, { x: cx + sx * 2.15, y: S.ceilY - 0.12, z: cz - 3.6, s: 1.1, chain: 1.75 }, rnd);
    buildPendantLantern(B, M, K, { x: cx + sx * 5.3, y: S.ceilY - 0.12, z: cz - 4.2, s: 1.05, chain: 1.2 }, rnd);
  }

  // test shell (only when ?ishell=1 and no hall module is present)
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('ishell') === '1') {
      const { buildTestShell } = await import('./interior-testshell.js');
      root.add(buildTestShell(ctx, S));
    }
  } catch (e) { console.warn('[interior] test shell failed', e); }

  // ---------------------------------------------------------------- merge + instances
  const built = B.build({ name: 'interior-static' });
  root.add(built);
  const hang = new THREE.Group(); hang.name = 'interior-strands';
  flushStrands(ctx, K, M, hang);
  root.add(hang);
  // flowers + leaves
  if (inst.flowers.length) {
    const fg = flowerHeadGeo();
    const wh = inst.flowers.filter((f) => !f.pink).map((f) => f.m), pk = inst.flowers.filter((f) => f.pink).map((f) => f.m);
    if (wh.length) root.add(geom.instanced(fg, M.petalWhite, wh));
    if (pk.length) root.add(geom.instanced(fg, M.petalPink, pk));
    root.add(geom.instanced(leafGeo(), M.leaf, inst.leaves));
  }
  // flames (HDR glow) + embers
  const fgeo = flameGeo();
  const fl = geom.instanced(fgeo, M.flame, flames.map((f) => geom.mat4([f[0], f[1], f[2]], [0, 0, 0], f[3] || 1)), { castShadow: false, receiveShadow: false });
  fl.name = 'interior-flames';
  root.add(fl);
  const core = geom.instanced(fgeo, M.flameCore, flames.map((f) => geom.mat4([f[0], f[1] - 0.008, f[2]], [0, 0, 0], (f[3] || 1) * 0.5)), { castShadow: false, receiveShadow: false });
  root.add(core);
  if (embers.length) root.add(geom.instanced(new THREE.SphereGeometry(0.004, 6, 4), M.ember, embers.map((e) => geom.mat4(e)), { castShadow: false, receiveShadow: false }));

  // ---------------------------------------------------------------- local lights (max 6)
  addLights(ctx, root, S, lights, flames);
  S.pointLights = root.userData.flicker;

  // ---------------------------------------------------------------- atmosphere
  S.volume = { min: [cx - 12.45, Y0, cz - 7.98], max: [cx + 12.45, S.ceilY - 0.12, cz + 7.98] };
  S.dustBox = { min: [cx - 9, Y0 + 0.4, cz - 6.5], max: [cx + 9, 8.3, cz + 7.5] };
  // the hall shell (walls + 0.6 m): occluders beyond it are ignored by the interior shafts
  S.shell = { min: [cx - 13.6, Y0 - 0.3, cz - 9.1], max: [cx + 13.6, 9.7, cz + 9.1] };
  S.hazeAmb = 0.0028;
  const shafts = buildShafts(ctx, S, { slices: ctx.quality === 'preview' ? 32 : 56, density: 0.18 });
  root.add(shafts);
  root.add(buildDust(ctx, S, { count: 1600 }));
  root.add(buildSmoke(ctx, [smokeSrc, smokeSrc2], { height: 1.5 }));
  root.userData.fx = [shafts];

  disposePool();
  {
    const rows = [];
    let tot = 0, calls = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      tot += n; calls++;
      rows.push([n, `${o.name && o.name !== 'built' ? o.name + '/' : ''}${(o.material.name || o.material.type)}=${Math.round(n / 1000)}k`]);
    });
    rows.sort((a, b) => b[0] - a[0]);
    console.log(`[info] interior tris=${Math.round(tot / 1000)}k meshes=${calls} top: ${rows.slice(0, 18).map((r) => r[1]).join(' ')}`);
  }
  console.log(`[interior] built in ${(performance.now() - t0).toFixed(0)} ms`);

  return {
    object: root,
    update: (T) => {
      const k = 1 + 0.018 * Math.sin(T * 2.3) + 0.012 * Math.sin(T * 3.7 + 1.3);
      for (const l of root.userData.flicker || []) l.intensity = l.userData.base * k;
    },
    finalize: (c) => finalizeInterior(c, M, S, root),
    showcase: [
      // shot 7: push-in from the door line toward the Amida
      { cam: [cx, 3.2, cz + 8.5], look: [cx, 4.4, cz - 5], focal: 30 },
      // the Amida's face inside the halo and the petal fan
      { cam: [cx + 0.9, 6.3, cz - 2.0], look: [cx, 6.55, cz - 5.4], focal: 50 },
      // low altar close-up: priest seat, kin, sutra desk, front table, incense smoke
      { cam: [cx, 3.1, cz + 3.4], look: [cx, 2.6, cz], focal: 35 },
      // looking up: canopies, coffered ceiling, attendant
      { cam: [cx + 2.5, 3.3, cz + 0.5], look: [cx, 8.2, cz - 4.5], focal: 22 },
      // three-quarter view across the sanctum from the west aisle
      { cam: [cx - 8, 4.0, cz + 2.5], look: [cx + 0.5, 4.6, cz - 4.5], focal: 28 },
    ],
  };
}

// ============================================================================
function addLights(ctx, root, S, lights, flames) {
  const { THREE } = ctx;
  const { cx, cz, Y0 } = S;
  const warm = new THREE.Color().setRGB(1.0, 0.62, 0.3);
  const L = [];
  const mk = (p, I, dist) => {
    const l = new THREE.PointLight(warm, I, dist, 2);
    l.position.set(p[0], p[1], p[2]);
    l.castShadow = false;
    l.userData.base = I;
    root.add(l); L.push(l);
    return l;
  };
  // floor lanterns (2)
  for (const l of lights.filter((q) => q.i === 1)) mk(l.p, 7.0, 10);
  // pendant lanterns (2)
  for (const l of lights.filter((q) => q.i === 2)) mk(l.p, 5.0, 9);
  // candle cluster on the front table/altar (1) + warm fill on the Buddha (1)
  mk([cx, Y0 + 1.45, cz - 2.0], 9.0, 8);
  mk([cx - 2.6, Y0 + 5.2, cz - 1.2], 30.0, 15).userData.noHalo = true;
  root.userData.flicker = L;
}

// ============================================================================
function buildFloor(ctx, B, M, S) {
  const { THREE } = ctx;
  const { cx, cz, Y0 } = S;
  // polished wood everywhere (thin slab so it never z-fights the shell floor)
  B.box(M.woodFloor, 25.0, 0.04, 16.0, [cx, Y0 - 0.02, cz], [0, 0, 0], 0);
  // tatami field in front of the altar (traditional alternating layout)
  const tw = 0.91, tl = 1.82, th = 0.05;
  const mats = [];
  const x0 = cx - 1.5 * tl, z0 = cz + 1.25;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const rot = (r + c) % 2 === 0;
      const px = x0 + c * tl + tl * 0.5;
      const pz = z0 + r * tl + tl * 0.5;
      if (!rot) { mats.push({ x: px, z: pz - tw * 0.5, rot: 0 }); mats.push({ x: px, z: pz + tw * 0.5, rot: 0 }); }
      else { mats.push({ x: px - tw * 0.5, z: pz, rot: 1 }); mats.push({ x: px + tw * 0.5, z: pz, rot: 1 }); }
    }
  }
  // matte underlay so the joints between mats never show the polished floor (bright doorway glints)
  B.box(M.incense, 3 * tl + 0.01, 0.006, 3 * tl + 0.01, [cx, Y0 + 0.003, z0 + 1.5 * tl], [0, 0, 0], 0);
  mats.forEach((m, k) => {
    const g = rbox(tl - 0.002, th, tw - 0.002, 0.008, 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    // u carries +2 m per mat (a whole number of weave periods) so the shader can recover the mat index
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 2.0 * k, p.getZ(i));
    B.add(g, M.tatami, ctx.geom.mat4([m.x, Y0 + th * 0.5, m.z], [0, m.rot ? Math.PI / 2 : 0, 0]));
  });
}

// ============================================================================
// FIGURES: Amida + 2 bodhisattvas (SDF sculpted) + hair curls
async function buildFigures(ctx, M, S) {
  const { THREE } = ctx;
  const g = new THREE.Group();
  g.name = 'interior-figures';
  const { cx, cz, ySeat, zB } = S;
  const q = ctx.quality === 'preview';
  const hBody = q ? 0.02 : 0.0092, hHead = q ? 0.009 : 0.003, hBodhi = q ? 0.016 : 0.0088;
  const [body, head, bodhi] = await Promise.all([
    meshSDF(THREE, 'buddha', null, [-1.16, -0.04, -0.62], [1.16, 1.62, 0.76], hBody, { aoDist: 0.08, cached: !!ctx.realtime?.enabled }),
    meshSDF(THREE, 'buddha', null, [-0.41, 1.5, -0.47], [0.41, 2.56, 0.43], hHead, { aoDist: 0.04, newton: 3, cached: !!ctx.realtime?.enabled }),
    meshSDF(THREE, 'bodhi', null, [-0.7, -0.03, -0.32], [0.7, 1.56, 0.4], hBodhi, { aoDist: 0.05, cached: !!ctx.realtime?.enabled }),
  ]);
  const curls = makeCurls(ctx);
  const add = (geo, x, y, z, s = 1) => {
    const m = new THREE.Mesh(geo, M.statueGold);
    m.position.set(x, y, z); m.scale.setScalar(s);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(body, cx, ySeat, zB);
  add(head, cx, ySeat, zB);
  add(curls, cx, ySeat, zB);
  const bs = 0.58;
  const bseat = S.yThrone + (S.pedH + S.lotusH) * bs;
  for (const sx of [-1, 1]) add(bodhi, cx + sx * 3.35, bseat, cz - 4.75, 1.0);
  return g;
}

function makeCurls(ctx) {
  const { THREE } = ctx;
  const f = getShape('buddha').f;
  const pts = [];
  const N = 900;
  const K = HAIR.HK;
  const c = [0, HAIR.HPY + (2.03 - HAIR.HPY) * K - HAIR.HD, -0.05];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    const d = [Math.cos(a) * r, y, Math.sin(a) * r];
    if (d[1] < -0.35) continue;
    const o = [c[0] + d[0] * 0.66, c[1] + d[1] * 0.66, c[2] + d[2] * 0.66];
    const p = surfacePoint(f, o[0], o[1], o[2], -d[0], -d[1], -d[2], 0.66, 80);
    if (!p) continue;
    const h = HAIR.headSpace(p[0], p[1], p[2]);
    if (h[1] < HAIR.hairY(h[0], h[2]) + 0.012) continue;
    if (Math.abs(h[0]) > 0.215 && h[1] < 2.02 && h[2] > -0.15) continue;
    pts.push(p);
  }
  // snail-shell curls (rahotsu): a dome wound by a deep spiral groove, two mirror-handed
  // variants, each curl turned about its normal so the spirals never line up
  const shells = [snailGeo(THREE, 1), snailGeo(THREE, -1)];
  const list = [];
  const up = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();
  pts.forEach((p, i) => {
    const n = sdfNormal(f, p[0], p[1], p[2], 0.003);
    const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(...n));
    spin.setFromAxisAngle(up, (i * 2.399963) % (Math.PI * 2));
    q.multiply(spin);
    const r = 0.0215 * K * (0.94 + 0.12 * ((i * 0.618034) % 1));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p[0] + n[0] * r * 0.1, p[1] + n[1] * r * 0.1, p[2] + n[2] * r * 0.1), q, new THREE.Vector3(r, r * 0.85, r));
    list.push(shells[i % 2].clone().applyMatrix4(m));
  });
  const geo = merge(list);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = 0.75; col[i * 3 + 1] = 0; col[i * 3 + 2] = 1; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// unit snail-shell curl: dome (height 1 along +Y, radius 1) wound by a spiral groove
function snailGeo(THREE, hand = 1) {
  const NR = 9, NT = 22, turns = 2.4;
  const pos = [], idx = [];
  pos.push(0, 1, 0);
  for (let i = 1; i <= NR; i++) {
    const rho = i / NR;
    for (let j = 0; j < NT; j++) {
      const th = (j / NT) * Math.PI * 2;
      const ph = rho * turns * Math.PI * 2 - hand * th;
      const g = 0.5 + 0.5 * Math.cos(ph);
      const dome = Math.pow(Math.max(0, 1 - rho * rho), 0.55);
      const hgt = dome * (1 - 0.2 * g * Math.min(1, rho * 3)) + (i === NR ? -0.25 : 0);
      const rr = rho * (1 - 0.06 * g * Math.min(1, rho * 3));
      pos.push(Math.cos(th) * rr, hgt, Math.sin(th) * rr);
    }
  }
  for (let j = 0; j < NT; j++) idx.push(0, 1 + ((j + 1) % NT), 1 + j);
  for (let i = 1; i < NR; i++) {
    const a0 = 1 + (i - 1) * NT, a1 = 1 + i * NT;
    for (let j = 0; j < NT; j++) {
      const j1 = (j + 1) % NT;
      idx.push(a0 + j, a0 + j1, a1 + j1, a0 + j, a1 + j1, a1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// crown, necklace, earrings, scarves for a bodhisattva at seat (x,y,z)
function buildBodhiOrnaments(ctx, B, M, { x, y, z }) {
  const { THREE, geom } = ctx;
  const add = (g, m, p, rot = [0, 0, 0], s = 1) => B.add(g, m, geom.mat4([x + p[0], y + p[1], z + p[2]], rot, s));
  // crown band + points
  const band = new THREE.TorusGeometry(0.152, 0.012, 6, 40).rotateX(Math.PI / 2);
  band.scale(1, 1, 1.05);
  add(band, M.goldBright, [0, 1.262, -0.02]);
  add(new THREE.TorusGeometry(0.148, 0.006, 6, 40).rotateX(Math.PI / 2), M.gold, [0, 1.29, -0.02]);
  const pg = petalGeo({ len: 0.11, width: 0.08, thick: 0.012, cup: -0.08, bend: 0.06, tip: 0.05, ridge: 0.004, segU: 8, segV: 5 });
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.42;
    const big = i === 0 ? 1.45 : 1.0 - Math.abs(i) * 0.08;
    add(pg, M.goldBright, [Math.sin(a) * 0.155, 1.27, -0.02 + Math.cos(a) * 0.16], [-0.15, a, 0], big);
  }
  add(new THREE.SphereGeometry(0.014, 10, 8), M.silkRed, [0, 1.3, 0.15]);
  // crown ribbons behind the ears
  for (const sx of [-1, 1]) add(rbox(0.025, 0.32, 0.006, 0.002), M.gold, [sx * 0.16, 1.1, -0.06], [0, sx * 0.4, sx * 0.08]);
  // necklace with pendants
  const nk = new THREE.TorusGeometry(0.12, 0.009, 6, 40, Math.PI);
  add(nk, M.goldBright, [0, 0.86, 0.04], [0.25, 0, Math.PI]);
  for (const a of [-0.6, 0, 0.6]) add(latheGeo([[0, 0], [0.012, -0.01], [0.015, -0.03], [0, -0.05]], 8), M.goldBright, [Math.sin(a) * 0.12, 0.74 + Math.abs(a) * 0.04, 0.13], [0, 0, 0], a === 0 ? 1.5 : 1);
  // earrings
  for (const sx of [-1, 1]) add(new THREE.TorusGeometry(0.014, 0.004, 6, 12), M.goldBright, [sx * 0.152, 0.995, 0.015], [0, Math.PI / 2, 0]);
  // armlets
  for (const sx of [-1, 1]) add(new THREE.TorusGeometry(0.075, 0.008, 6, 20).rotateX(Math.PI / 2), M.goldBright, [sx * 0.3, 0.6, 0.0], [0, 0, sx * 0.1]);
}

// ============================================================================
// LOTUS THRONE on an octagonal pedestal. Local origin = pedestal base centre.
function buildThrone(ctx, B, M, S, { x, y, z, scale = 1, rows = 3 }) {
  const { geom } = ctx;
  const T = (px, py, pz) => [x + px * scale, y + py * scale, z + pz * scale];
  const add = (g, m, pos = [0, 0, 0], rot = [0, 0, 0], s = 1) => B.add(g, m, geom.mat4(T(...pos), rot, s * scale));
  const oct = (profile) => { const g = latheGeo(profile, 8, Math.PI / 8).toNonIndexed(); g.computeVertexNormals(); return g; };
  const H = S.pedH;
  // --- octagonal pedestal tiers (kamachi / kaeribana / shikinasu / ukeza)
  add(oct([[0, 0], [1.42, 0], [1.42, 0.12], [1.36, 0.14], [1.36, 0.18], [1.26, 0.2], [0, 0.2]]), M.black);
  add(oct([[0, 0.2], [1.2, 0.2], [1.2, 0.27], [1.14, 0.3], [1.14, 0.34], [0, 0.34]]), M.goldAntique);
  add(oct([[1.43, 0.115], [1.44, 0.12], [1.44, 0.135], [1.43, 0.14]]), M.gold);
  // kaeribana core + downturned petals
  add(latheGeo([[0, 0.34], [0.98, 0.34], [1.0, 0.38], [0.92, 0.5], [0.72, 0.6], [0.6, 0.62], [0, 0.62]], 48), M.goldAntique);
  const pd = petalGeo({ len: 0.42, width: 0.42, thick: 0.05, cup: 0.14, bend: -0.05, tip: -0.08, ridge: 0.012, pointy: 1.2, wpow: 0.55 });
  for (let i = 0; i < 16; i++) {
    const th = (i / 16) * Math.PI * 2;
    add(pd, M.goldAntique, [Math.sin(th) * 0.72, 0.6, Math.cos(th) * 0.72], [Math.PI - 1.05, th, 0]);
  }
  // shikinasu (rounded drum) + rings
  add(latheGeo([[0, 0.6], [0.56, 0.6], [0.66, 0.66], [0.7, 0.74], [0.66, 0.82], [0.56, 0.86], [0, 0.86]], 48), M.gold);
  add(ringGeo(0.6, 0.022, 0.62, 64, 8), M.goldBright);
  add(ringGeo(0.58, 0.022, 0.845, 64, 8), M.goldBright);
  // ukeza (octagonal receiving tier)
  add(oct([[0, 0.86], [0.92, 0.86], [0.98, 0.9], [0.98, 0.96], [0.9, 0.99], [0.9, 1.02], [1.0, 1.06], [1.0, 1.1], [0, 1.1]]), M.black);
  add(oct([[0.99, 0.955], [1.0, 0.96], [1.0, 1.065], [0.99, 1.07]]), M.goldAntique);
  // --- lotus (ukebana): receptacle + 3 rows of petals + seed-pod seat (renniku)
  const yL = H;
  add(latheGeo([[0, yL - 0.02], [0.5, yL - 0.02], [0.66, yL + 0.1], [0.85, yL + 0.3], [0.98, yL + 0.48], [1.02, yL + 0.6], [0, yL + 0.6]], 64), M.goldAntique);
  const rowsDef = [
    { n: 16, rb: 0.76, yb: yL + 0.02, a: 1.08, len: 0.74, w: 0.74, off: 0 },
    { n: 16, rb: 0.87, yb: yL + 0.18, a: 0.8, len: 0.7, w: 0.7, off: 0.5 },
    { n: 16, rb: 0.98, yb: yL + 0.36, a: 0.52, len: 0.5, w: 0.58, off: 0 },
  ].slice(0, rows);
  for (const R of rowsDef) {
    const g = petalGeo({ len: R.len, width: R.w, thick: 0.08, cup: 0.26, bend: 0.05, tip: 0.09, ridge: 0.014, pointy: 1.4, wpow: 0.42, base: 0.3, segU: 13, segV: 9 });
    // raised inner petal of the other finish: every petal reads as a bordered, inlaid leaf
    const gIn = petalGeo({ len: R.len * 0.74, width: R.w * 0.66, thick: 0.03, cup: 0.26 * 0.66, bend: 0.05, tip: 0.09, ridge: 0.012, pointy: 1.4, wpow: 0.42, base: 0.25, segU: 11, segV: 7 }).translate(0, R.len * 0.13, 0.036);
    for (let i = 0; i < R.n; i++) {
      const th = ((i + R.off) / R.n) * Math.PI * 2;
      add(g, R === rowsDef[1] ? M.goldBright : M.gold, [Math.sin(th) * R.rb, R.yb, Math.cos(th) * R.rb], [R.a, th, 0]);
      add(gIn, R === rowsDef[1] ? M.gold : M.goldBright, [Math.sin(th) * R.rb, R.yb, Math.cos(th) * R.rb], [R.a, th, 0]);
    }
  }
  add(latheGeo([[0, yL + 0.6], [1.06, yL + 0.6], [1.1, yL + 0.62], [1.1, yL + 0.645], [0.9, yL + 0.65], [0, yL + 0.655]], 64), M.goldAntique);
}

// ============================================================================
// MANDORLA: head halo + body halo + layered fan of flame petals.
// (x,y,z) = seat centre of the figure, s = scale, headY = head centre height (local, unscaled)
function buildMandorla(ctx, B, M, { x, y, z, s = 1, headY = 2.03, bodhi = false }) {
  const { THREE, geom } = ctx;
  const add = (g, m, pos, rot = [0, 0, 0], sc = 1) => B.add(g, m, geom.mat4([x + pos[0] * s, y + pos[1] * s, z + pos[2] * s], rot, sc * s));
  // ---- head halo (zuko): rosette, ray band, beaded rings, petal crown
  const hc = [0, headY / s * (bodhi ? 1 : 1), -0.47];
  if (bodhi) hc[1] = headY / s;
  add(new THREE.CylinderGeometry(0.66, 0.66, 0.03, 128, 1).rotateX(Math.PI / 2), M.goldAntique, hc);
  add(latheGeo([[0, 0], [0.2, 0], [0.205, 0.012], [0.19, 0.03], [0.1, 0.045], [0, 0.05]], 64).rotateX(Math.PI / 2), M.gold, [hc[0], hc[1], hc[2] + 0.015]);
  for (const r of [0.21, 0.3, 0.465, 0.55, 0.645]) add(new THREE.TorusGeometry(r, r > 0.6 ? 0.018 : 0.011, 6, 96), M.goldBright, [hc[0], hc[1], hc[2] + 0.018]);
  const ray = rbox(0.011, 0.15, 0.014, 0.004);
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    add(ray, M.gold, [hc[0] + Math.sin(a) * 0.383, hc[1] + Math.cos(a) * 0.383, hc[2] + 0.02], [0, 0, -a]);
  }
  const bead = new THREE.SphereGeometry(0.016, 6, 4);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    add(bead, M.goldBright, [hc[0] + Math.sin(a) * 0.508, hc[1] + Math.cos(a) * 0.508, hc[2] + 0.022]);
  }
  const rosette = petalGeo({ len: 0.17, width: 0.1, thick: 0.02, cup: -0.05, bend: 0.12, tip: 0.04, ridge: 0.006, segU: 8, segV: 6 });
  for (let i = 0; i < 12; i++) add(rosette, M.goldBright, [hc[0], hc[1], hc[2] + 0.04], [0, 0, -(i / 12) * Math.PI * 2]);
  const crownP = petalGeo({ len: 0.16, width: 0.11, thick: 0.025, cup: -0.08, bend: 0.12, tip: 0.1, ridge: 0.008, segU: 8, segV: 6 });
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    add(crownP, M.gold, [hc[0] + Math.sin(a) * 0.64, hc[1] + Math.cos(a) * 0.64, hc[2] + 0.005], [0, 0, -a]);
  }
  // ---- body halo (shinko): double elliptical ring with a ray band
  const bc = [0, bodhi ? 0.9 : 0.98, -0.63];
  // gilt ground of the body halo (the fan around it is openwork against the dark back plate)
  add(new THREE.CylinderGeometry(1.0, 1.0, 0.02, 96, 1).rotateX(Math.PI / 2).scale(1, 1.08, 1), M.goldAntique, [bc[0], bc[1], bc[2] - 0.03]);
  for (const [r, t] of [[1.0, 0.022], [0.9, 0.014], [0.62, 0.014]]) {
    const er = new THREE.TorusGeometry(r, t, 6, 110);
    er.scale(1.0, 1.08, 1.0);
    add(er, M.goldBright, bc);
  }
  const ray2 = rbox(0.012, 0.25, 0.014, 0.004);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    if (Math.cos(a) < -0.35) continue;
    add(ray2, M.gold, [bc[0] + Math.sin(a) * 0.76, bc[1] + Math.cos(a) * 0.76 * 1.08, bc[2]], [0, 0, -a]);
  }
  // ---- the great fan: three layers of lance-shaped flame petals
  const fc = [0, bodhi ? 1.05 : 1.12, -0.8];
  const kk = bodhi ? 0.85 : 1.0;
  const layers = [
    { n: 22, r0: 1.0, z: -0.1, w: 0.52, lenTop: 1.45 * kk, lenSide: 0.98 * kk, span: 2.62, m: M.fanAntique, bend: 0.1 },
    { n: 22, r0: 0.96, z: -0.02, w: 0.46, lenTop: 1.08 * kk, lenSide: 0.76 * kk, span: 2.55, m: M.fanGold, bend: 0.12, off: 0.5 },
    { n: 18, r0: 0.93, z: 0.06, w: 0.4, lenTop: 0.66 * kk, lenSide: 0.48 * kk, span: 2.45, m: M.gold, bend: 0.14 },
  ];
  for (const Ly of layers) {
    for (let i = 0; i < Ly.n; i++) {
      const t = -Ly.span + (2 * Ly.span * (i + 0.5 + (Ly.off || 0))) / (Ly.n + (Ly.off ? 1 : 0));
      const c = Math.max(0, Math.cos(t));
      const len = Ly.lenSide + (Ly.lenTop - Ly.lenSide) * Math.pow(c, 1.6);
      const w = Ly.w * (0.85 + 0.15 * c);
      const g = petalGeo({ len, width: w, thick: 0.04, cup: -0.08, bend: Ly.bend * 0.6, tip: 0.06, ridge: 0.02, segU: 11, segV: 6, base: 0.22, pointy: 1.15, wpow: 0.6 });
      const pos = [fc[0] + Math.sin(t) * Ly.r0, fc[1] + Math.cos(t) * Ly.r0 * 1.04, fc[2] + Ly.z];
      add(g, Ly.m, pos, [0, 0, -t]);
      const gi = petalGeo({ len: len * 0.72, width: w * 0.55, thick: 0.03, cup: -0.05, bend: Ly.bend * 0.6, tip: 0.04, ridge: 0.012, segU: 8, segV: 5, base: 0.2, pointy: 1.15, wpow: 0.6 });
      add(gi, Ly.m === M.fanAntique ? M.fanGold : M.fanAntique, [pos[0] + Math.sin(t) * len * 0.1, pos[1] + Math.cos(t) * len * 0.1, pos[2] + 0.012], [0, 0, -t]);
    }
  }
  // ---- an inner crown of small, sharp flame petals hugging the body halo
  {
    const nS = bodhi ? 18 : 28;
    const gS = petalGeo({ len: 0.3 * kk, width: 0.15 * kk, thick: 0.025, cup: -0.1, bend: 0.12, tip: 0.1, ridge: 0.01, segU: 9, segV: 5, base: 0.2, pointy: 1.2, wpow: 0.6 });
    for (let i = 0; i < nS; i++) {
      const t = -2.45 + (4.9 * (i + 0.5)) / nS;
      add(gS, i % 2 ? M.goldBright : M.fanGold, [fc[0] + Math.sin(t) * 0.99, fc[1] + Math.cos(t) * 0.99 * 1.04, fc[2] + 0.1], [0, 0, -t]);
    }
  }
  // back plate (boat shaped) to close the fan
  const sh = new THREE.Shape();
  const NP = 90;
  for (let i = 0; i <= NP; i++) {
    const t = -2.7 + (5.4 * i) / NP;
    const c = Math.max(0, Math.cos(t));
    const R = 1.8 * kk + 0.55 * Math.pow(c, 1.6) * kk;
    const px = Math.sin(t) * R, py = Math.cos(t) * R * 1.04;
    if (i === 0) sh.moveTo(px, py); else sh.lineTo(px, py);
  }
  sh.closePath();
  add(extrude(sh, 0.03, 0.01, 4, 1), M.black, [fc[0], fc[1], fc[2] - 0.16]);
  // ---- flame tongues (karyu) licking up around the rim: a crisp openwork silhouette against
  // the dark back wall; on the flanks they curl upward like rising fire
  {
    const NF = bodhi ? 30 : 46;
    const fl = {};
    const fgeo = (k, sgn) => {
      const key = k + '_' + sgn;
      if (!fl[key]) fl[key] = extrude(flameShape(0.42 * k, 0.17 * k, sgn * (0.3 + 0.12 * k)), 0.014, 0.004, 9, 1);
      return fl[key];
    };
    for (let i = 0; i < NF; i++) {
      const t = -2.62 + (5.24 * (i + 0.5)) / NF;
      const c = Math.max(0, Math.cos(t));
      // just inside the tips of the outer fan petals, so the flames lick out beyond them
      const R = (1.0 + 0.98 * kk + 0.47 * kk * Math.pow(c, 1.6)) - 0.1 * kk;
      const k = [0.72, 0.9, 1.05][(i * 7) % 3] * (0.78 + 0.42 * c) * kk;
      const sgn = Math.abs(t) < 0.12 ? (i % 2 ? 1 : -1) : -Math.sign(t);
      const rin = R;
      add(fgeo(Math.round(k * 20) / 20, sgn), i % 3 ? M.goldBright : M.gold, [fc[0] + Math.sin(t) * rin, fc[1] + Math.cos(t) * rin * 1.04, fc[2] - 0.15], [0, 0, -t]);
    }
  }
  // ---- small seated buddhas (kebutsu) floating on lotus pedestals across the great fan
  if (!bodhi) {
    const kb = kebutsuGeo();
    // an outer arc of nine + an inner pair flanking the head halo
    const spots = [0, -0.5, 0.5, -1.0, 1.0, -1.5, 1.5, -2.0, 2.0].map((t) => [t, 1.6 + 0.38 * Math.pow(Math.max(0, Math.cos(t)), 1.6)]);
    spots.push([-0.78, 1.27], [0.78, 1.27]);
    for (const [t, R] of spots) {
      add(kb, M.goldBright, [fc[0] + Math.sin(t) * R, fc[1] + Math.cos(t) * R * 1.04, fc[2] + 0.13], [0, 0, 0], t === 0 ? 1.25 : R < 1.4 ? 0.9 : 1.0);
    }
  }
}

// a tiny seated buddha on a lotus with head + body halo (base at origin, ~0.26 m tall)
let KEBUTSU = null;
function kebutsuGeo() {
  if (KEBUTSU) return KEBUTSU;
  const parts = [];
  const sp = (sx, sy, sz, x, y, z) => { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(sx, sy, sz); g.translate(x, y, z); parts.push(g); };
  parts.push(latheGeo([[0, -0.02], [0.05, -0.02], [0.085, 0.0], [0.095, 0.02], [0.08, 0.035], [0, 0.04]], 18));
  const pg = petalGeo({ len: 0.05, width: 0.04, thick: 0.008, cup: 0.1, bend: 0.1, tip: 0.05, ridge: 0.002, segU: 6, segV: 4 });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const g = pg.clone(); g.rotateX(0.95); g.rotateY(a); g.translate(Math.sin(a) * 0.06, 0.0, Math.cos(a) * 0.06); parts.push(g); }
  sp(0.078, 0.03, 0.05, 0, 0.065, 0.01);            // crossed legs under the robe
  sp(0.046, 0.066, 0.034, 0, 0.12, 0.0);            // torso
  sp(0.022, 0.018, 0.02, 0, 0.085, 0.035);          // hands in the lap
  sp(0.025, 0.028, 0.025, 0, 0.205, 0.004);         // head
  sp(0.014, 0.013, 0.014, 0, 0.232, -0.002);        // ushnisha
  const halo = new THREE.CylinderGeometry(0.052, 0.052, 0.006, 28); halo.rotateX(Math.PI / 2); halo.translate(0, 0.205, -0.03); parts.push(halo);
  const bh = new THREE.CylinderGeometry(0.075, 0.075, 0.006, 28); bh.rotateX(Math.PI / 2); bh.scale(1, 1.25, 1); bh.translate(0, 0.12, -0.04); parts.push(bh);
  const rim = new THREE.TorusGeometry(0.052, 0.004, 5, 28); rim.translate(0, 0.205, -0.026); parts.push(rim);
  KEBUTSU = merge(parts);
  return KEBUTSU;
}

// ============================================================================
function finalizeInterior(ctx, M, S, root) {
  // local env map at the sanctum centre so gold reflects the gold interior
  const hidden = [];
  root.traverse((o) => { if ((o.isPoints || /interior-(shafts|smoke)/.test(o.name)) && o.visible) { o.visible = false; hidden.push(o); } });
  try {
    for (let pass = 0; pass < (ctx.realtime?.enabled ? 1 : 2); pass++) {
      const env = ctx.captureEnv(S.probe, { size: ctx.realtime?.enabled ? 128 : 256, near: 0.1 });
      const old = new Set();
      for (const m of M.envList) { if (m.envMap && m.envMap !== env) old.add(m.envMap); m.envMap = env; m.envMapIntensity = (m.userData.envK ?? 1) * (S.envBoost || 2.2); m.needsUpdate = true; }
      old.forEach((t) => t.dispose());
    }
  } catch (e) { console.warn('[interior] env capture failed', e); }
  hidden.forEach((o) => { o.visible = true; });
}
