// ---------------------------------------------------------------------------
// BUILDINGS: viewing pavilion (hero), enclosing corridor (kairo), south gate
// (romon), bell tower (shoro), two side halls. Fully procedural.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LB, m4, chamferBox, block, lathe, rosette, colBand, sweep, rectProfile, tileParams, makeLift, buildIx, hash3, extrude, giboshi, kibanaGeo, scrollPlate } from './buildings-kit.js';
import { eaves, bracketSet, column, irimoyaRoof, railing, loopPath, linePath } from './buildings-arch.js';
import { buildCorridor } from './buildings-corridor.js';
import { buildGate, buildBellTower, buildSideHall } from './buildings-halls.js';
import { makeHeroMats, withClearcoatMod } from './buildings-mat.js';
import { kanaguHooks } from './buildings-kanagu.js';

const V3 = THREE.Vector3;

function frameFor(center, facing) {
  const yaw = Math.atan2(facing[0], facing[2]);
  return new THREE.Matrix4().makeRotationY(yaw).setPosition(center[0], center[1] || 0, center[2]);
}
const toWorld = (base, p) => new V3(p[0], p[1], p[2]).applyMatrix4(base).toArray().map((v) => +v.toFixed(4));

// coffered ceiling panels with painted roundels (world-space cell grid)
function ceilingMat(ctx, U) {
  const { mat } = ctx;
  return mat.std({ color: 0xffffff, roughness: 0.55, metalness: 0 }, {
    uniforms: U,
    fragHead: /* glsl */ `uniform vec2 uCellO; uniform vec2 uCellS; float g_gold;`,
    fragColor: /* glsl */ `
      {
        vec2 q = (vWPos.xz - uCellO) / uCellS;
        vec2 f = fract(q) - 0.5; vec2 id = floor(q);
        float r = length(f); float a = atan(f.y, f.x);
        vec3 bg = vec3(0.020, 0.045, 0.036);
        vec3 col = bg;
        float petals = 0.30 * (0.62 + 0.38 * pow(abs(cos(a * 4.0)), 0.7));
        float petals2 = 0.20 * (0.6 + 0.4 * pow(abs(cos(a * 4.0 + 0.785)), 0.7));
        float ring = smoothstep(0.012, 0.0, abs(r - 0.38)) ;
        float ring2 = smoothstep(0.008, 0.0, abs(r - 0.355));
        float pet = smoothstep(0.012, 0.0, r - petals);
        float pet2 = smoothstep(0.01, 0.0, r - petals2);
        vec3 pc = mix(vec3(0.55, 0.06, 0.03), vec3(0.85, 0.32, 0.06), smoothstep(0.05, 0.3, r));
        col = mix(col, pc, pet);
        col = mix(col, vec3(0.05, 0.22, 0.15), pet2);
        float center = smoothstep(0.01, 0.0, r - 0.07);
        float edge = smoothstep(0.006, 0.0, abs(r - petals)) * pet;
        g_gold = max(max(ring, ring2 * 0.8), max(center, edge * 0.9));
        // corner leaves
        vec2 cf = abs(f);
        float leaf = smoothstep(0.012, 0.0, length(cf - 0.5) - 0.12);
        col = mix(col, vec3(0.04, 0.14, 0.09), leaf);
        g_gold = max(g_gold, smoothstep(0.006, 0.0, abs(length(cf - 0.5) - 0.12)) * 0.8);
        col = mix(col, vec3(0.95, 0.68, 0.30), g_gold);
        diffuseColor.rgb *= col;
      }
    `,
    fragMetal: /* glsl */ `metalnessFactor = g_gold;`,
    fragRough: /* glsl */ `roughnessFactor = mix(0.6, 0.28, g_gold);`,
  });
}

function makeMaterials(ctx) {
  const { M, mat } = ctx;
  const K = {
    red: M.lacquerRed, col: M.lacquerRed, beam: M.lacquerRed, rafter: M.lacquerRed, wood: M.lacquerRed,
    redDark: M.lacquerRedDark, soffit: M.lacquerRedDark,
    gold: M.gold, cap: M.goldLeaf, gib: M.goldBright,
    tile: M.roofTile, plaster: M.plaster, lattice: M.latticeGreen, stone: M.granite, stoneClean: M.graniteClean,
    floorX: M.woodFloorX, floorZ: M.woodFloorZ, black: M.blackLacquer, bronze: M.bronze, woodRaw: M.woodRaw,
  };
  K.tileVC = mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12, vertexColors: true }, mat.PROC.roofTile());
  K.tileVC.name = 'roofTileVC';
  K.ceiling = ceilingMat(ctx, K.ceilU = { uCellO: { value: new THREE.Vector2(0, 0) }, uCellS: { value: new THREE.Vector2(0.5, 0.5) } });
  const gc = ctx.L.gate.center, bc = ctx.L.bellTower.center;
  K.ceilingGate = ceilingMat(ctx, { uCellO: { value: new THREE.Vector2(gc[0] - 5.2, gc[2] - 2.4) }, uCellS: { value: new THREE.Vector2(0.52, 0.48) } });
  K.ceilingBell = ceilingMat(ctx, { uCellO: { value: new THREE.Vector2(bc[0] - 1.95, bc[2] - 1.95) }, uCellS: { value: new THREE.Vector2(3.9 / 8, 3.9 / 8) } });
  // gilt panel with interlocking-circle (shippo) relief + small bosses, bump mapped
  K.goldRelief = mat.std({ color: 0xffffff, roughness: 0.3, metalness: 1.0 }, {
    fragHead: /* glsl */ `float g_h;`,
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        vec2 uv = vec2(abs(wn.x) > abs(wn.z) ? wp.z : wp.x, wp.y) * 5.2;
        vec2 c1 = fract(uv) - 0.5;
        vec2 c2 = fract(uv + 0.5) - 0.5;
        float w = 0.09;
        float ring1 = smoothstep(w, w * 0.25, abs(length(c1) - 0.5));
        float ring2 = smoothstep(w, w * 0.25, abs(length(c2) - 0.5));
        float dots = smoothstep(0.1, 0.05, length(c1)) + smoothstep(0.07, 0.03, length(c2));
        float h = clamp(max(ring1, ring2) + dots, 0.0, 1.0);
        float n = n_fbm3(wp * 3.0, 3);
        g_h = h;
        vec3 base = vec3(1.0, 0.72, 0.33);
        vec3 col = mix(base * vec3(0.42, 0.3, 0.16), base, 0.35 + 0.65 * h);
        col *= 0.92 + 0.1 * n;
        diffuseColor.rgb *= col;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = mix(0.5, 0.3, g_h);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0035);`,
  });
  K.capPaint = mat.std({ color: 0xffffff, roughness: 0.55, metalness: 0.55 }, mat.PROC.gold('vec3(0.80, 0.56, 0.24)'));
  // hero surfaces: worn urushi lacquer, engraved gilt fittings, lacquered floor
  const H = makeHeroMats(ctx);
  K.col = H.col; K.red = H.red; K.beam = H.rafter; K.rafter = H.rafter; K.wood = H.rafter;
  K.redDark = H.redDark; K.gold = H.gold; K.cap = H.cap; K.floorX = H.floorX; K.floorZ = H.floorZ;
  K.kanagu = (typeof location !== 'undefined' && /nokan/.test(location.search)) ? H.gold : mat.std({ color: 0xffffff, roughness: 0.3, metalness: 1.0 }, kanaguHooks(0.3));
  K.kanagu.name = 'bk.kanagu';
  K.dark = mat.std({ color: new THREE.Color().setRGB(0.025, 0.018, 0.014), roughness: 0.9 });
  K.rope = mat.std({ color: new THREE.Color().setRGB(0.42, 0.33, 0.2), roughness: 0.95 });
  return K;
}

// Materials re-instanced per building so finalize() can give them a local
// environment capture (correct reflections/ambient under deep eaves).
const LOCAL_KEYS = ['kanagu', 'red', 'col', 'beam', 'rafter', 'wood', 'redDark', 'soffit', 'gold', 'cap', 'capPaint', 'gib', 'plaster', 'lattice', 'floorX', 'floorZ', 'black', 'goldRelief', 'ceiling', 'stoneClean'];
function localize(ctx, K, keys, sets, center, off, floorY = 0.5) {
  const out = { ...K };
  const made = new Map();
  for (const k of keys) {
    const m = K[k]; if (!m) continue;
    if (!made.has(m.uuid)) {
      let hooks = m.userData.patch;
      const c = m.clone();
      // per-building floor height for the lacquer's hand-wear / dust zones
      if (hooks && hooks.uniforms && hooks.uniforms.uLacFloor) hooks = { ...hooks, uniforms: { ...hooks.uniforms, uLacFloor: { value: floorY } } };
      if (hooks) ctx.mat.patch(c, hooks);
      if (m.userData.ccMod) withClearcoatMod(c);
      made.set(m.uuid, c);
    }
    out[k] = made.get(m.uuid);
  }
  if (K.ceilU && out.ceiling !== K.ceiling) out.ceilU = K.ceilU;
  sets.push({ pos: [center[0] + off[0], (center[1] || 0) + off[1], center[2] + off[2]], mats: [...made.values()] });
  return out;
}

// ---------------------------------------------------------------------------
// VIEWING PAVILION (east shore, open to the west)
// ---------------------------------------------------------------------------
function buildPavilion(ctx, K, builder, ix, anchors) {
  const P = ctx.L.pavilion;
  const base = frameFor(P.center, P.facing);
  const lb = new LB(builder, base, ix);
  const yF = P.floorY;
  const cx = 4.05, cz = 3.05, colR = 0.17;
  const xs = [-4.05, -1.35, 1.35, 4.05], zs = [-3.05, 0, 3.05];
  const yColTop = 3.85, yPlate = 4.0;
  const hx = 5.6, zF = 4.6, zB = -4.0; // floor extents (wide verandas west/north/south)
  const zc = (zF + zB) / 2, hz = (zF - zB) / 2;
  // world grain direction: local x maps to world z
  const floorMat = K.floorZ;

  // ---- foundation: granite pillars + posts + beams under the floor
  const postsAt = [];
  for (const x of xs) for (const z of zs) if (Math.abs(x) === cx || Math.abs(z) === cz) postsAt.push([x, z, colR, true]);
  for (const x of xs) for (const zz of [zB + 0.15, zF - 0.15]) postsAt.push([x, zz, 0.11, false]);
  for (const z of zs) for (const s of [-1, 1]) postsAt.push([s * (hx - 0.15), z, 0.11, false]);
  for (const s of [-1, 1]) for (const zz of [zB + 0.15, zF - 0.15]) postsAt.push([s * (hx - 0.15), zz, 0.11, false]);
  for (const [x, z, r, isCol] of postsAt) {
    const pw = isCol ? 0.46 : 0.34;
    lb.box(K.stone, pw, 2.1, pw, [x, -0.75, z], [0, 0, 0], 0.03);
    lb.box(K.stone, pw + 0.08, 0.1, pw + 0.08, [x, 0.27, z], [0, 0, 0], 0.025);
    if (!isCol) lb.box(K.redDark, 0.16, yF - 0.32 - 0.05, 0.16, [x, (0.32 + yF - 0.05) / 2, z], [0, 0, 0], 0.012);
  }
  // under-floor beams (obiki) and ties (nuki)
  for (const z of [zB + 0.15, ...zs, zF - 0.15]) lb.box(K.redDark, 2 * hx - 0.1, 0.2, 0.16, [0, yF - 0.2 - 0.1 - 0.045, z], [0, 0, 0], 0.012);
  for (const x of [-hx + 0.15, ...xs, hx - 0.15]) lb.box(K.redDark, 0.12, 0.14, 2 * hz - 0.1, [x, 0.55, zc], [0, 0, 0], 0.01);
  // joists
  for (let x = -hx + 0.3; x <= hx - 0.3 + 1e-6; x += 0.6) lb.box(K.redDark, 0.08, 0.1, 2 * hz - 0.2, [x, yF - 0.045 - 0.05, zc], [0, 0, 0], 0.008);
  // floor planks (along local x), staggered joints, small gaps
  const pwid = 0.235, gap = 0.007;
  const nP = Math.floor((2 * hz) / (pwid + gap));
  const z0 = zB + ((2 * hz) - nP * (pwid + gap)) / 2 + (pwid + gap) / 2;
  for (let i = 0; i < nP; i++) {
    const z = z0 + i * (pwid + gap);
    let x = -hx + 0.12;
    const end = hx - 0.12;
    let k = 0;
    while (x < end - 0.05) {
      const len = Math.min(end - x, 2.2 + 2.6 * hash3(i, k, 7));
      lb.box(floorMat, len - 0.006, 0.045, pwid, [x + len / 2, yF - 0.0225, z], [0, 0, 0], 0.004);
      x += len; k++;
    }
  }
  // veranda edge beam (en-gamachi) around the floor
  { const fl = lb.child(m4([0, 0, zc]));
    fl.add(sweep(loopPath(hx - 0.06, hz - 0.06, () => yF - 0.2, 0.5), rectProfile(0.13, 0.205), { closed: true, outward: true }), K.redDark);
    fl.add(sweep(loopPath(hx - 0.002, hz - 0.002, () => yF - 0.2, 0.5), rectProfile(0.012, 0.03, 0.03), { closed: true, outward: true }), K.gold); }

  // ---- columns with gold fittings
  for (const x of xs) for (const z of zs) {
    if (!(Math.abs(x) === cx || Math.abs(z) === cz)) continue;
    column(lb, K, x, z, 0.32, yColTop, colR, {
      seg: 48,
      bands: [{ y: yF, h: 0.36, orn: true }, { y: 0.32, h: 0.1 }, { y: 3.02, h: 0.07 }, { y: yColTop - 0.3 - 0.11, h: 0.1 }],
    });
  }
  // ---- head-tie beams (kashira-nuki) with kibana ends, plate (daiwa), nageshi + ranma
  const kn = (len, pos, rotY) => lb.box(K.red, len, 0.27, 0.14, pos, [0, rotY, 0], 0.015);
  for (const s of [-1, 1]) {
    kn(2 * cx + 0.16, [0, yColTop - 0.135, s * cz], 0);
    kn(2 * cz + 0.16, [s * cx, yColTop - 0.135, 0], Math.PI / 2);
    lb.box(K.red, 2 * cx + 0.5, 0.15, 0.26, [0, yPlate - 0.075, s * cz], [0, 0, 0], 0.015);
    lb.box(K.red, 0.26, 0.15, 2 * cz + 0.5, [s * cx, yPlate - 0.075, 0], [0, 0, 0], 0.015);
  }
  // gilt nail-cover rosettes (kugikakushi) along both faces of the head-tie beams
  // (the inner face of the west beam frames the top of shot 1)
  for (const s of [-1, 1]) for (const f of [-1, 1]) {
    for (let i = 0; i < xs.length - 1; i++) for (const t of [1 / 3, 2 / 3]) {
      const x = xs[i] + (xs[i + 1] - xs[i]) * t;
      lb.add(rosette(0.055, 8, 0.012), K.gold, m4([x, yColTop - 0.135, s * cz + f * 0.07], [0, f > 0 ? 0 : Math.PI, 0]));
    }
    for (let i = 0; i < zs.length - 1; i++) for (const t of [1 / 3, 2 / 3]) {
      const z = zs[i] + (zs[i + 1] - zs[i]) * t;
      lb.add(rosette(0.055, 8, 0.012), K.gold, m4([s * cx + f * 0.07, yColTop - 0.135, z], [0, f > 0 ? Math.PI / 2 : -Math.PI / 2, 0]));
    }
    // thin gilt edging along the lower arris of each head-tie beam face
    lb.box(K.gold, 2 * cx - 0.36, 0.014, 0.012, [0, yColTop - 0.262, s * cz + f * 0.072], [0, 0, 0], 0.003);
    lb.box(K.gold, 0.012, 0.014, 2 * cz - 0.36, [s * cx + f * 0.072, yColTop - 0.262, 0], [0, 0, 0], 0.003);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // gold caps on beam ends

    // carved kibana ends with gold scroll plates
    for (const [px, pz, yaw] of [[sx * cx, sz * cz, sx > 0 ? 0 : Math.PI], [sx * cx, sz * cz, sz > 0 ? -Math.PI / 2 : Math.PI / 2]]) {
      const kb = lb.child(m4([px, yColTop - 0.27, pz], [0, yaw, 0]));
      kb.add(kibanaGeo(0.4, 0.27, 0.14), K.red, m4([0.05, 0, 0]));
      kb.add(scrollPlate(0.055), K.cap, m4([0.3, 0.27 * 0.5, 0.14 / 2 + 0.006]));
      kb.add(scrollPlate(0.055), K.cap, m4([0.3, 0.27 * 0.5, -0.14 / 2 - 0.006], [0, Math.PI, 0]));
    }
    lb.box(K.cap, 0.012, 0.16, 0.27, [sx * (cx + 0.255), yPlate - 0.075, sz * cz], [0, 0, 0], 0.003);
    lb.box(K.cap, 0.27, 0.16, 0.012, [sx * cx, yPlate - 0.075, sz * (cz + 0.255)], [0, 0, 0], 0.003);
  }
  // nageshi on both faces + ranma lattice
  const yN0 = 3.02, yN1 = 3.2;
  for (const s of [-1, 1]) for (const f of [-1, 1]) {
    if (s < 0) lb.box(K.red, 2 * cx + 0.1, yN1 - yN0, 0.07, [0, (yN0 + yN1) / 2, s * cz + f * (colR + 0.02)], [0, 0, 0], 0.012);
    lb.box(K.red, 0.07, yN1 - yN0, 2 * cz + 0.1, [s * cx + f * (colR + 0.02), (yN0 + yN1) / 2, 0], [0, 0, 0], 0.012);
  }
  for (const x of xs) for (const z of zs) {
    if (!(Math.abs(x) === cx || Math.abs(z) === cz)) continue;
    for (const f of [-1, 1]) {
      if (z === -cz) lb.add(rosette(0.07, 6, 0.014), K.gold, m4([x, (yN0 + yN1) / 2, z + Math.sign(z) * f * (colR + 0.055)], [0, f * Math.sign(z) > 0 ? 0 : Math.PI, 0]));
      if (Math.abs(x) === cx) lb.add(rosette(0.07, 6, 0.014), K.gold, m4([x + Math.sign(x) * f * (colR + 0.055), (yN0 + yN1) / 2, z], [0, f * Math.sign(x) > 0 ? Math.PI / 2 : -Math.PI / 2, 0]));
    }
  }
  // ranma: lattice between nageshi and kashira-nuki
  const ranmaY0 = yN1, ranmaY1 = yColTop - 0.27;
  const ranma = (a, b, alongX, off) => {
    const L = b - a;
    lb.box(K.red, alongX ? L : 0.05, 0.04, alongX ? 0.05 : L, alongX ? [(a + b) / 2, ranmaY0 + 0.02, off] : [off, ranmaY0 + 0.02, (a + b) / 2], [0, 0, 0], 0.006);
    const n = Math.floor(L / 0.11);
    for (let i = 1; i < n; i++) {
      const t = a + (L * i) / n;
      lb.box(K.lattice, 0.035, ranmaY1 - ranmaY0 - 0.04, 0.035, alongX ? [t, (ranmaY0 + ranmaY1 + 0.04) / 2, off] : [off, (ranmaY0 + ranmaY1 + 0.04) / 2, t], [0, Math.PI / 4, 0], 0.004);
    }
  };
  for (let i = 0; i < xs.length - 1; i++) ranma(xs[i] + colR, xs[i + 1] - colR, true, -cz); // open west front: no ranma
  for (let i = 0; i < zs.length - 1; i++) for (const s of [-1, 1]) ranma(zs[i] + colR, zs[i + 1] - colR, false, s * cx);

  // ---- bracket sets on the plate
  const BS = { tiers: 3, proj: [0.45, 0.85], armH: 0.15, armW: 0.12, blockH: 0.12, daito: [0.34, 0.2], mak: [0.19, 0.12], wall: [0.9, 1.12, 1.32], inner: true, goldCaps: true, goldMak: true, goldDaito: true, K: { wood: K.red, gold: K.cap } };
  const sides = [
    { pts: xs.map((x) => [x, cz]), yaw: 0 }, { pts: xs.map((x) => [x, -cz]), yaw: Math.PI },
    { pts: zs.map((z) => [cx, z]), yaw: Math.PI / 2 }, { pts: zs.map((z) => [-cx, z]), yaw: -Math.PI / 2 },
  ];
  for (const S of sides) {
    for (let i = 0; i < S.pts.length; i++) {
      const p = S.pts[i];
      const isCorner = Math.abs(p[0]) === cx && Math.abs(p[1]) === cz;
      if (!isCorner) bracketSet(lb, m4([p[0], yPlate, p[1]], [0, S.yaw, 0]), BS);
      if (i < S.pts.length - 1) {
        const q = S.pts[i + 1];
        bracketSet(lb, m4([(p[0] + q[0]) / 2, yPlate, (p[1] + q[1]) / 2], [0, S.yaw, 0]), { ...BS, goldDaito: false });
      }
    }
  }
  for (const [sx, sz, yaw] of [[1, 1, 0], [-1, 1, -Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI / 2]]) {
    bracketSet(lb, m4([sx * cx, yPlate, sz * cz], [0, yaw, 0]), { ...BS, corner: true });
  }

  // ---- eaves
  const ov = 2.0;
  const exT = cx + ov + 0.08, ezT = cz + ov + 0.08;
  const lift = makeLift(exT, ezT, 0.42, 0.45, 2.3);
  const E = eaves(lb, {
    cx, cz, ov, yWall: 5.18, sBase: 0.318, d1: 0.8, rB: [0.095, 0.11], kioiH: 0.09, sFly: 0.18, rF: [0.09, 0.1], sp: 0.25,
    fasciaH: 0.12, proj: 0.85, lift, twoTier: true, capGold: true,
    K: { rafter: K.rafter, soffit: K.soffit, cap: K.cap, beam: K.beam, rafterCap: K.capPaint },
  });
  for (const h of E.hooks) anchors.bells.push({ pos: toWorld(base, h.local), scale: 1.0, rotY: 0 });

  // ---- ceiling: cornice + coffered grid (gotenjo)
  const yC = 5.33;
  lb.add(sweep(loopPath(cx - 0.12, cz - 0.12, () => yC - 0.1, 0.5), rectProfile(0.1, 0.1), { closed: true, outward: true }), K.red);
  {
    const g = new THREE.PlaneGeometry(2 * cx, 2 * cz).rotateX(Math.PI / 2);
    lb.add(g, K.ceiling, m4([0, yC, 0]));
    const nx = 16, nz = 12;
    for (let i = 0; i <= nx; i++) { const x = -cx + (2 * cx * i) / nx; lb.box(K.black, 0.06, 0.07, 2 * cz, [x, yC - 0.035, 0], [0, 0, 0], 0.008); }
    for (let j = 0; j <= nz; j++) { const z = -cz + (2 * cz * j) / nz; lb.box(K.black, 2 * cx, 0.07, 0.06, [0, yC - 0.035, z], [0, 0, 0], 0.008); }
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const x = -cx + (2 * cx * i) / nx, z = -cz + (2 * cz * j) / nz;
      lb.box(K.cap, 0.1, 0.012, 0.1, [x, yC - 0.074, z], [0, Math.PI / 4, 0], 0.003);
    }
    // world cell grid for the panel shader (local->world: x->z, z->-x)
    const o = toWorld(base, [-cx, yC, cz]);
    K.ceilU.uCellO.value.set(o[0], o[2]);
    K.ceilU.uCellS.value.set((2 * cz) / nz, (2 * cx) / nx);
  }

  // ---- roof
  const T = tileParams({ p: 0.27, c: 0.26, detail: 2 });
  const y0 = E.fasciaTop + T.lip + T.pd;
  const b2 = (3.45 - 0.4 * ezT) / (ezT * ezT);
  const prof = (d) => 0.4 * d + b2 * d * d;
  const DBG = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('bdbg')) || '';
  const roof = DBG.includes('noroof') ? null : irimoyaRoof(lb, {
    ex: exT, ez: ezT, y0, prof, gd: 2.15, ov: 0.6, lift, T,
    K: { tileVC: K.tileVC, tile: K.tile, gold: K.gold, red: DBG.includes("redg") ? K.lattice : K.red, soffit: K.soffit, plaster: K.plaster, lattice: K.lattice },
    ridge: { w: 0.6, h: 0.55, layers: 6, capR: 0.11, drop: 0.45 }, hip: { w: 0.32, h: 0.32, layers: 4, capR: 0.075, drop: 0.2 },
    oni: { s: 0.85 }, gegyo: 0.62, hafuH: 0.36, capGoldMat: K.cap, gableLattice: true,
  });

  // ---- railing with giboshi
  const ry = yF, rx = hx - 0.1, rzF = zF - 0.1, rzB = zB + 0.1;
  const stairZ0 = 0.35, stairZ1 = 2.7;
  railing(lb, [[-rx, stairZ0], [-rx, rzB], [rx, rzB], [rx, rzF], [-rx, rzF], [-rx, stairZ1]], ry, {
    H: 0.86, post: 0.13, spacing: 1.36, midY: 0.48, gibSeg: 32, K: { red: K.red, redDark: K.redDark, gold: K.gold, gib: K.gib, relief: K.goldRelief },
  });
  // ---- stairs (north side = local -x), between z = stairZ0..stairZ1
  {
    const n = 5, rise = yF / n, tread = 0.3;
    const w = stairZ1 - stairZ0 - 0.16, zc = (stairZ0 + stairZ1) / 2;
    for (let i = 0; i < n - 1; i++) {
      const y = yF - rise * (i + 1);
      const x = -hx - tread * (i + 0.5) - 0.02;
      lb.box(floorMat, tread + 0.04, 0.05, w, [x, y - 0.025, zc], [0, 0, 0], 0.005);
      lb.box(K.redDark, 0.03, rise, w, [x + tread / 2, y + rise / 2 - 0.05, zc], [0, 0, 0], 0.004);
    }
    const run = tread * (n - 1) + 0.1;
    for (const s of [-1, 1]) {
      const zz = zc + s * (w / 2 + 0.05);
      const a = [-hx + 0.05, yF + 0.02], b = [-hx - run - 0.05, -0.02];
      const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
      lb.add(chamferBox(len, 0.28, 0.09, 0.012), K.red, new THREE.Matrix4().makeRotationZ(ang).setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.08, zz));
      lb.add(chamferBox(0.1, 0.3, 0.1, 0.01), K.cap, m4([b[0] + 0.03, 0.08, zz]));
    }
    lb.box(K.stoneClean, run + 0.6, 0.3, w + 0.5, [-hx - run / 2 - 0.1, -0.16, zc], [0, 0, 0], 0.03);
  }

  // ---- hanging lantern anchors on all four eaves (hook = bottom of a short gilt rod under a rafter)
  const hang = (x, z, d, scale) => {
    const yr = (d < 0.8 ? E.yFB(d) : E.yBB(d)) + lift(x, z);
    lb.box(K.gold, 0.11, 0.02, 0.11, [x, yr - 0.01, z], [0, 0, 0], 0.004);
    lb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), K.gold, m4([x, yr - 0.16, z]));
    lb.add(new THREE.TorusGeometry(0.03, 0.008, 6, 14), K.gold, m4([x, yr - 0.3 + 0.03, z]));
    anchors.hangingLanterns.push({ pos: toWorld(base, [x, yr - 0.3, z]), scale, rotY: 0 });
  };
  // west front (shot 1 hero lantern): larger lanterns
  for (const x of [-3.5, 0, 3.5]) hang(x, cz + ov - 0.9, 0.9, 1.22);
  for (const sx of [-1, 1]) for (const z of [-1.5, 1.5]) hang(sx * (cx + ov - 0.9), z, 0.9, 0.95);
  for (const x of [-1.5, 1.5]) hang(x, -(cz + ov - 0.9), 0.9, 0.9);
  return { base, roof };
}

// ---------------------------------------------------------------------------
export async function build(ctx) {
  const { THREE: T3, geom } = ctx;
  const K = makeMaterials(ctx);
  const group = new THREE.Group(); group.name = 'buildings';
  const anchors = { hangingLanterns: [], bells: [] };
  const only = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('bparts')) || 'pavilion,corridor,gate,belltower,sidehalls';
  const want = new Set(only.split(','));
  const localSets = [];
  const DBGQ = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('bdbg')) || '';

  if (want.has('pavilion')) {
    const b = new geom.Builder(); const ix = new Map();
    const KP = localize(ctx, K, LOCAL_KEYS, localSets, ctx.L.pavilion.center, [0, 2.5, 0], ctx.L.pavilion.floorY);
    try { buildPavilion(ctx, KP, b, ix, anchors); } catch (e) { console.error('[buildings] pavilion failed', e.stack || e); }
    const g = b.build({ name: 'pavilion' }); buildIx(ix, g); group.add(g);
  }
  if (want.has('corridor')) {
    const g = new THREE.Group(); g.name = 'corridor';
    try { buildCorridor(ctx, K, g); } catch (e) { console.error('[buildings] corridor failed', e.stack || e); }
    group.add(g);
  }
  if (want.has('gate')) {
    const b = new geom.Builder(); const ix = new Map();
    const G = ctx.L.gate; const base = frameFor(G.center, G.facing);
    const KG = localize(ctx, K, LOCAL_KEYS.filter((k) => k !== 'ceiling'), localSets, G.center, [0, 2.2, 0]);
    try { buildGate(ctx, KG, new LB(b, base, ix), anchors, (p) => toWorld(base, p)); } catch (e) { console.error('[buildings] gate failed', e.stack || e); }
    const g = b.build({ name: 'gate' }); buildIx(ix, g); group.add(g);
  }
  if (want.has('belltower') || want.has('sidehalls')) {
    const b = new geom.Builder(); const ix = new Map();
    if (want.has('belltower')) {
      const B = ctx.L.bellTower; const base = frameFor(B.center, B.facing || [0, 0, 1]);
      try { buildBellTower(ctx, K, new LB(b, base, ix), anchors, (p) => toWorld(base, p)); } catch (e) { console.error('[buildings] bell tower failed', e.stack || e); }
    }
    if (want.has('sidehalls')) {
      for (const sh of ctx.L.sideHalls) {
        const base = frameFor(sh.center, sh.facing);
        try { buildSideHall(ctx, K, new LB(b, base, ix), anchors, (p) => toWorld(base, p), sh); } catch (e) { console.error('[buildings] side hall failed', e.stack || e); }
      }
    }
    const g = b.build({ name: 'outbuildings' }); buildIx(ix, g); group.add(g);
  }
  if (DBGQ.includes('tris')) {
    const kName = {}; for (const [k, v] of Object.entries(K)) if (v && v.isMaterial && !kName[v.uuid]) kName[v.uuid] = k;
    for (const g of group.children) {
      const per = {}; let tot = 0;
      g.traverse((o) => { if (!o.isMesh) return; const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); const k = (kName[o.material.uuid] || o.material.type) + (o.isInstancedMesh ? '#' + o.name : ''); per[k] = (per[k] || 0) + n; tot += n; });
      console.log(`[info] tris ${g.name}: ${Math.round(tot / 1000)}k ` + Object.entries(per).map(([k, v]) => `${k}=${Math.round(v / 1000)}k`).join(' '));
    }
  }
  return {
    object: group,
    anchors,
    finalize: async (c) => {
      if (ctx.quality === 'preview' || DBGQ.includes('noenv')) return;
      for (const L of localSets) {
        try {
          const env = c.captureEnv(L.pos, { size: 256 });
          for (const m of L.mats) { m.envMap = env; m.needsUpdate = true; }
        } catch (e) { console.error('[buildings] local env failed', e.stack || e); }
      }
    },
    showcase: [
      { cam: [44.6, 2.6, 16.0], look: [-30, 12, -4], focal: 24 },
      { cam: [36, 5, 14], look: [47, 5, 18], focal: 30 },
    ],
  };
}
