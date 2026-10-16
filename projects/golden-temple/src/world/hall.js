// ---------------------------------------------------------------------------
// MAIN HALL (hondō) — exterior shell. Two-tier roof (mokoshi skirt roof +
// irimoya main roof with chidori-hafu), karahafu porch over the stairs,
// granite podium, vermilion columns, rich bracket sets and gold fittings.
// Built in hall-local coordinates and placed at L.hall.center (faces +Z).
// ---------------------------------------------------------------------------
import { Acc, xf, basis, mul, v3, sweep, cbox, lathe } from './hall-lib.js';
import { makeProfile, makeWarp, buildTiles, buildEaves, buildIrimoyaRidges, buildIrimoyaGables, ridgeAlong } from './hall-roof.js';
import { onigawara } from './hall-orn.js';
import { karahafuParams, buildKarahafu, buildChidori } from './hall-kara.js';
import { HB, buildPodium, buildStairs, buildVeranda, buildWalls, buildInterior, buildUpper, placeBrackets, kentoku, railing } from './hall-body.js';
import { stairBalustrade } from './hall-stair.js';
import { aoVariant, weatherHooks, paintHooks, mergeHooks, agedGiltHooks, lacquerMicroHooks } from './hall-mats.js';

let _interiorMats = [];

function makeMaterials(ctx) {
  const { THREE, M } = ctx;
  const P = ctx.mat.PROC;
  const tile = ctx.mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12 }, P.roofTile());
  tile.shadowSide = THREE.DoubleSide; tile.name = 'hallTile';
  const intFloor = ctx.mat.phys({ color: 0xffffff, roughness: 0.26, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12 }, P.wood('vec3(0.12, 0.055, 0.03)', 'x'));
  intFloor.name = 'hallIntFloor';
  const intWall = ctx.mat.phys({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }, P.lacquer('vec3(0.26, 0.045, 0.022)'));
  intWall.name = 'hallIntWall';
  const intPlaster = ctx.mat.std({ color: 0xffffff, roughness: 0.93, metalness: 0 }, P.plaster());
  intPlaster.name = 'hallIntPlaster';
  const intCeil = ctx.mat.std({ color: 0xffffff, roughness: 0.7, metalness: 0 }, P.wood('vec3(0.08, 0.045, 0.028)', 'x'));
  intCeil.name = 'hallIntCeil';
  _interiorMats = [intFloor, intWall, intPlaster, intCeil];
  // exterior: AO-aware variants of the shared library (same look, baked occlusion on indirect light)
  const A = (m, extra, params) => aoVariant(ctx, m, extra, params);
  // per-tile tint + roof-scale weathering seen from the crane views: rain-wash
  // bands running down the slope, lichen rosettes, pale dust on the tile crowns
  const tileA = A(tile, {
    vertexHead: 'attribute float aTint; varying float vTint;', vertexWorld: 'vTint = aTint;', fragHead: 'varying float vTint;',
    fragColor: /* glsl */ `
      diffuseColor.rgb *= vTint;
      {
        vec3 wn = normalize(vWNrm);
        vec3 c = diffuseColor.rgb;
        float wash = n_fbm3(vWPos * vec3(1.3, 0.22, 1.3) + 6.0, 3) * 0.5 + 0.5;
        c *= 0.82 + 0.36 * wash;
        float li = smoothstep(0.6, 0.78, n_fbm3(vWPos * 1.7 + 13.0, 3) * 0.5 + 0.5);
        float lf = n_snoise3(vWPos * 9.0 + 1.0) * 0.5 + 0.5;
        li *= mix(0.55, smoothstep(0.35, 0.7, lf), hk_aa(9.0));
        c = mix(c, vec3(0.115, 0.112, 0.085), li * 0.5 * smoothstep(0.1, 0.6, wn.y));
        c += vec3(0.010, 0.009, 0.008) * smoothstep(0.75, 0.98, wn.y);
        diffuseColor.rgb = c;
      }`,
  }); tileA.shadowSide = THREE.DoubleSide;
  // lacquer palette: vermilion (brackets, railings, fascia), aged red-brown
  // (columns, beams, rafters), dark crimson boards, dark soffits; all weathered
  const lac = (base, cc = 0.2, rough = 0.52) => ctx.mat.phys({ color: 0xffffff, roughness: rough, metalness: 0, clearcoat: cc, clearcoatRoughness: 0.45 }, P.lacquer(base));
  // weathered lacquer: low sheen (limits the grazing sky reflection that turned backlit fascias white)
  const SH = { clearcoat: 0.1, specularIntensity: 0.55 };
  const red = A(M.lacquerRed, mergeHooks(weatherHooks(0.9, 0.7, 0.8), lacquerMicroHooks(1.0)), SH); red.name = 'hallRed';
  const redA = A(lac('vec3(0.205, 0.054, 0.032)', 0.12, 0.58), mergeHooks(weatherHooks(1.0, 1.0, 1.0), lacquerMicroHooks(1.0)), { specularIntensity: 0.6 }); redA.name = 'hallRedAged';
  const redDark = A(M.lacquerRedDark, mergeHooks(weatherHooks(0.8, 0.6, 1.0), lacquerMicroHooks(0.8)), SH); redDark.name = 'hallRedDark';
  const soffit = A(lac('vec3(0.13, 0.040, 0.024)', 0.08, 0.62), mergeHooks(weatherHooks(0.5, 0.0, 0.4), lacquerMicroHooks(0.7))); soffit.name = 'hallSoffit';
  // gilt: saturated warm leaf (engine golds read pale/khaki on flat fittings)
  const gilt = (base, rough) => ctx.mat.std({ color: 0xffffff, roughness: rough, metalness: 1.0 }, P.gold(base));
  const bkt = A(M.lacquerRed, mergeHooks(paintHooks(), weatherHooks(0.8, 0.5, 0.5), lacquerMicroHooks(0.9)), SH); bkt.name = 'hallBracket';
  bkt.userData.wantLoc = true; // Mesher stores primitive-local coords (aLoc) for the paint bands
  return {
    red, redA, redDark, soffit, bkt, gold: A(gilt('vec3(1.0, 0.64, 0.24)', 0.27), agedGiltHooks(0.6)), goldB: A(gilt('vec3(1.0, 0.70, 0.30)', 0.18), agedGiltHooks(0.4)), black: A(M.blackLacquer, null, { clearcoat: 0.7, clearcoatRoughness: 0.28, roughness: 0.4 }),
    tile: tileA, plaster: A(M.plaster, weatherHooks(0.3, 0.0, 0.45)), granite: A(M.granite), graniteMoss: A(M.graniteMossy), stone: A(M.graniteClean),
    woodX: A(M.woodRaw), woodZ: A(M.woodRawZ), woodDark: A(M.woodDark), bronze: A(M.bronze),
    // (all-over painted ornament materials retired: gilt work is real carved geometry now)
    goldL: A(gilt('vec3(1.0, 0.65, 0.25)', 0.36), agedGiltHooks(0.6)),
    // carved gilt relief (horimono): fresher leaf, a bit rougher than fittings
    goldC: Object.assign(A(gilt('vec3(1.0, 0.66, 0.25)', 0.3), agedGiltHooks(0.45)), { name: 'hallGoldCarve' }),
    // recessed ground of gilt carvings: deeper amber, rougher (reads as shadowed gilding)
    goldR: Object.assign(A(gilt('vec3(0.78, 0.45, 0.14)', 0.5), agedGiltHooks(0.6)), { name: 'hallGoldRecess' }),
    // gable fields behind the carvings: dark red-brown lacquered wood
    panel: Object.assign(A(lac('vec3(0.15, 0.044, 0.026)', 0.12, 0.55), weatherHooks(0.6, 0.0, 0.5)), { name: 'hallPanel' }),
    intFloor, intWall, intPlaster, intCeil,
  };
}

// cloth banner material with a procedural 5-petal mon (GLSL SDF)
function clothMaterial(ctx, kind) {
  const { THREE } = ctx;
  const hooks = {
    vertexHead: 'attribute vec2 aBUV; varying vec2 vBUV;',
    vertexWorld: 'vBUV = aBUV; { float flex = pow(1.0 - aBUV.y, 1.3); wPos4.xyz += windOffset(wPos4.xyz, flex) * 0.55; }',
    fragHead: /* glsl */ `varying vec2 vBUV; float g_mon;
      float monSDF(vec2 p){
        float r = length(p);
        float ring = abs(r - 0.86) - 0.07;
        float a = atan(p.y, p.x);
        float pet = 1e3;
        for (int i = 0; i < 5; i++){
          float ang = 1.5707963 + float(i) * 1.2566371;
          vec2 c = vec2(cos(ang), sin(ang)) * 0.4;
          pet = min(pet, length(p - c) - 0.27);
        }
        float hole = r - 0.1;
        float petals = max(pet, -hole);
        petals = max(petals, -(abs(r - 0.15) - 0.025));
        return min(ring, petals);
      }`,
    fragColor: kind === 'black' ? /* glsl */ `
      {
        vec2 uv = vBUV; vec2 p = (uv - vec2(0.5, 0.64)) * vec2(1.5, 3.25) / 0.56;
        float d = monSDF(p);
        g_mon = 1.0 - smoothstep(-0.01, 0.01, d);
        float border = step(uv.x, 0.04) + step(0.96, uv.x) + step(0.97, uv.y);
        vec3 cloth = vec3(0.018, 0.016, 0.02) * (0.9 + 0.2 * n_snoise(uv * vec2(80.0, 300.0)));
        vec3 gold = vec3(0.85, 0.58, 0.2);
        vec3 col = mix(cloth, gold, max(g_mon, clamp(border, 0.0, 1.0) * 0.0));
        col = mix(col, vec3(0.42, 0.06, 0.03), clamp(border, 0.0, 1.0));
        g_mon = max(g_mon, 0.0);
        diffuseColor.rgb *= col;
      }` : /* glsl */ `
      {
        vec2 uv = vBUV; float cells = 9.0;
        float cx = (floor(uv.x * cells) + 0.5) / cells;
        vec2 p = (uv - vec2(cx, 0.45)) * vec2(11.0, 0.62) / 0.2;
        float d = monSDF(p);
        g_mon = 1.0 - smoothstep(-0.015, 0.015, d);
        vec3 cloth = vec3(0.80, 0.78, 0.72) * (0.92 + 0.12 * n_snoise(uv * vec2(400.0, 60.0)));
        vec3 col = mix(cloth, vec3(0.025, 0.022, 0.03), g_mon);
        float band = step(0.86, uv.y);
        col = mix(col, vec3(0.20, 0.06, 0.22), band);
        g_mon = 0.0;
        diffuseColor.rgb *= col;
      }`,
    fragRough: 'roughnessFactor = mix(roughnessFactor, 0.35, g_mon);',
    fragMetal: 'metalnessFactor = mix(metalnessFactor, 0.85, g_mon);',
  };
  const m = ctx.mat.std({ color: 0xffffff, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }, hooks);
  m.name = 'hallCloth_' + kind;
  return { m, hooks };
}

function clothGeometry(THREE, x0, x1, yTop, h, z, pleat = 0.32, amp = 0.035, seed = 0) {
  const nx = Math.max(8, Math.round((x1 - x0) / 0.06)), ny = Math.max(6, Math.round(h / 0.12));
  const pos = [], nrm = [], buv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = 1 - j / ny;
    const x = x0 + (x1 - x0) * u;
    const y = yTop - h * (1 - v);
    const ph = (2 * Math.PI * (x - x0)) / pleat + seed;
    const dz = amp * Math.sin(ph) * (0.6 + 0.4 * (1 - v)) + 0.02 * Math.sin(3.1 * x + 1.7 * y + seed) * (1 - v);
    const dd = (amp * 2 * Math.PI / pleat) * Math.cos(ph) * (0.6 + 0.4 * (1 - v));
    pos.push(x, y, z + dz);
    const l = Math.hypot(dd, 1); nrm.push(-dd / l, 0, 1 / l);
    buv.push(u, v);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aBUV', new THREE.Float32BufferAttribute(buv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export async function build(ctx) {
  const { THREE, L } = ctx;
  const C = L.hall.center;
  const R = ctx.rng('hall-main');
  const mats = makeMaterials(ctx);
  const anchors = { hangingLanterns: [], bells: [] };
  const t0 = performance.now();

  // ------------------------------------------------------------ parameters
  const K = karahafuParams();
  const xi = HB.up.xs[HB.up.xs.length - 1], zi = HB.up.zs[HB.up.zs.length - 1];
  const mok = {
    kind: 'mokoshi', ex: 16.8, ez: 12.3, y0: 8.55, prof: makeProfile(0.28, 0.40, 7.5, 1.5), xi, zi,
    frontExcl: [[-K.Wk - 0.05, K.Wk + 0.05]],
    E: { dP: 3.36, yP: 9.2, sb: 0.32, dTip: 0.85, yF0: 8.36, sf: 0.22, dFly: 1.7, rafW: 0.11, rafH: 0.13, frafW: 0.1, frafH: 0.115, dwX: 3.8, dwZ: 3.8, purW: 0.22, purH: 0.26, spacing: 0.3 },
    bellScale: 0.85,
  };
  const main = {
    kind: 'irimoya', ex: xi + 5.4, ez: zi + 5.4, y0: 13.95, prof: makeProfile(0.30, 1.155, zi + 5.4, 1.5), xg: 10.7, xb: 11.6,
    E: { dP: 4.08, yP: 14.82, sb: 0.33, dTip: 0.9, yF0: 13.74, sf: 0.22, dFly: 1.95, rafW: 0.13, rafH: 0.15, frafW: 0.12, frafH: 0.13, dwX: 5.4, dwZ: 5.4, purW: 0.26, purH: 0.3, spacing: 0.3 },
    bellScale: 1.1,
  };
  const warpM = makeWarp(mok.ex, mok.ez, 0.55, 0.32, Math.max(13 / mok.ex, 8.5 / mok.ez) - 0.02);
  const warpU = makeWarp(main.ex, main.ez, 0.95, 0.5, Math.max(xi / main.ex, zi / main.ez));
  const tmp = [0, 0, 0];
  // mokoshi tile height (with warp lift) for intersections
  const mokY = (x, z) => {
    const d = Math.min(mok.ez - Math.abs(z), mok.ex - Math.abs(x));
    warpM(x, 0, z, tmp);
    return mok.y0 + mok.prof.P(Math.max(d, 0)) + tmp[1];
  };
  // karahafu hides mokoshi tiles under it
  mok.hide = (x, z, y) => Math.abs(x) < K.Wk + 0.02 && z < K.zf && z > 6.0 && y < K.f(x) - 0.03;
  const mainYc = (z) => main.y0 + main.prof.P(main.ez - z);

  // ------------------------------------------------------------ mokoshi tier
  const accM = new Acc();
  buildTiles(accM, mok, mats, R);
  const bellsM = buildEaves(accM, mok, mats);
  {
    const tile = accM.m(mats.tile), gold = accM.m(mats.gold);
    const Y = (d) => mok.y0 + mok.prof.P(d);
    const Dm = Math.min(mok.ex - xi, mok.ez - zi);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const path = [];
      for (let i = 0; i <= 18; i++) { const d = 0.12 + ((Dm - 0.2 - 0.12) * i) / 18; path.push([sx * (mok.ex - d), Y(d) - 0.03, sz * (mok.ez - d)]); }
      // shallow bury: the corner end overhangs the eave, a deep bury hung below it as a dark slab
      ridgeAlong(tile, path, 0.42, 3, 0.1, 0.13, 0.16);
      const hd = v3.norm([sx, 0, sz]);
      onigawara(tile, gold, basis(v3.add(path[0], [0, -0.1, 0]), v3.cross([0, 1, 0], hd), [0, 1, 0], hd), 0.74, 0.95, 0.2, { hornLen: 0.62, goldEdge: true });
    }
    // flashing ridges against the upper wall
    const yF = (d) => Y(d) - 0.02;
    const pf = (pts) => ridgeAlong(tile, pts, 0.36, 2, 0.1, 0.12, 0.38);
    for (const sz of [-1, 1]) { const pts = []; for (let i = 0; i <= 20; i++) { const x = -(xi + 0.15) + (2 * (xi + 0.15) * i) / 20; pts.push([x, yF(mok.ez - zi - 0.14), sz * (zi + 0.14)]); } pf(pts); }
    for (const sx of [-1, 1]) { const pts = []; for (let i = 0; i <= 12; i++) { const z = -(zi + 0.15) + (2 * (zi + 0.15) * i) / 12; pts.push([sx * (xi + 0.14), yF(mok.ex - xi - 0.14), z]); } pf(pts); }
  }
  placeBrackets(accM, mats, HB.colX, HB.colZ, HB.colTop, 'demitsudo', {
    flatFront: (x) => Math.abs(x) < K.Wk + 0.1,
    frontSpans: [[-13, -K.Wk - 0.2], [K.Wk + 0.2, 13]], frontGaps: [[-K.Wk - 0.2, K.Wk + 0.2]],
  });
  kentoku(accM, mats, 13, 8.5, HB.colTop - 0.02, mok.E.yP + mok.E.sb * (mok.E.dwX - mok.E.dP) + 0.02, HB.colR);
  accM.warp(warpM);
  for (const b of bellsM.bells) { warpM(b.pos[0], b.pos[1], b.pos[2], tmp); b.pos = [tmp[0], tmp[1], tmp[2]]; anchors.bells.push(b); }

  // ------------------------------------------------------------ main tier
  const accU = new Acc();
  buildTiles(accU, main, mats, R);
  const bellsU = buildEaves(accU, main, mats);
  buildIrimoyaRidges(accU, main, mats);
  buildIrimoyaGables(accU, main, mats);
  buildChidori(accU, mats, R, { zf: 7.65, W: 4.3, ye: 15.02, H: 3.45 }, mainYc);
  buildUpper(accU, mats, R);
  placeBrackets(accU, mats, HB.up.xs, HB.up.zs, HB.up.top, 'mitesaki', { kw: 1.05, fullInter: true });
  kentoku(accU, mats, xi, zi, HB.up.top - 0.02, main.E.yP + main.E.sb * (main.E.dwX - main.E.dP) + 0.03, HB.up.r);
  accU.warp(warpU);
  for (const b of bellsU.bells) { warpU(b.pos[0], b.pos[1], b.pos[2], tmp); b.pos = [tmp[0], tmp[1], tmp[2]]; anchors.bells.push(b); }

  // ------------------------------------------------------------ karahafu
  const accK = new Acc();
  buildKarahafu(accK, mats, R, K, mokY, anchors);

  // ------------------------------------------------------------ body
  const accB = new Acc();
  buildPodium(accB, mats, R);
  buildStairs(accB, mats, R);
  buildVeranda(accB, mats, R);
  buildWalls(accB, mats, R,
    ['panel', 'panel', 'open', 'open', 'open', 'panel', 'panel'],
    ['board', 'board', 'board', 'door', 'board', 'board', 'board'],
    ['panel', 'renji', 'renji', 'renji', 'renji'],
    ['board', 'renji', 'board', 'renji', 'board']);
  buildInterior(accB, mats, R);
  // stair railings (bridge-like, following the slope, gold giboshi)
  {
    const S = HB.stair;
    for (const sx of [-1, 1]) {
      const x = sx * (S.hw + S.sideW / 2);
      const zTop = HB.pod.hz, zBot = HB.pod.hz + (S.n - 1) * S.run + 0.15;
      const yAt = (z) => HB.pod.h + 0.32 + ((0.5 - (HB.pod.h + 0.32)) * (z - zTop)) / (zBot - zTop) + 0.06;
      const zN = zBot + 0.13; // heavy newel on the stone plinth at the stair foot
      const yTopRail = yAt(zTop + 0.05);
      const posts = [[x, yTopRail, K.zc + 0.5, yTopRail - HB.pod.h], [x, yTopRail, zTop + 0.05]];
      for (let k = 1; k <= 2; k++) { const z = zTop + 0.05 + ((zN - zTop - 0.05) * k) / 3; posts.push([x, yAt(z), z]); }
      posts.push([x, yAt(zN), zN]);
      stairBalustrade(accB, mats, posts, posts.length - 1, { h: 0.95, outX: sx });
    }
  }

  // ------------------------------------------------------------ lantern anchors
  const E = mok.E;
  const hookY = E.yP + E.sb * (1.95 - E.dP) - E.rafH - 0.02;
  for (const x of [-11.14, -8.0, 8.0, 11.14]) anchors.hangingLanterns.push({ pos: [x, hookY, mok.ez - 1.95], scale: 1, rotY: 0 });
  for (const sx of [-1, 1]) for (const z of [-6.8, -3.4, 3.4, 6.8]) anchors.hangingLanterns.push({ pos: [sx * (mok.ex - 1.95), hookY, z], scale: 1, rotY: Math.PI / 2 });

  // ------------------------------------------------------------ assemble
  const all = new Acc();
  all.absorb(accB).absorb(accM).absorb(accU).absorb(accK);
  // ---- baked analytic ambient occlusion (indirect light only)
  const mainSurf = (x, z) => {
    const d = Math.min(main.ez - Math.abs(z), main.ex - Math.abs(x));
    warpU(x, 0, z, tmp);
    return main.y0 + main.prof.P(Math.max(d, 0)) + tmp[1];
  };
  const occl = (t, h, up, down, k) => {
    const bl = Math.atan2(Math.max(0, t), h) / (Math.PI / 2);
    return 1 - k * bl * (0.56 + 0.32 * up + 0.12 * down);
  };
  const aoField = (x, y, z, nx, ny, nz) => {
    let ao = 1;
    const ax = Math.abs(x), az = Math.abs(z);
    const up = Math.max(0, ny), down = Math.max(0, -ny);
    const inUpper = ax < xi + 0.35 && az < zi + 0.35 && y > 10.2;
    // under the mokoshi skirt roof
    if (!inUpper && y > 1.4 && ax < mok.ex + 0.4 && az < mok.ez + 0.4) {
      const ym = mokY(x, z);
      if (y < ym - 0.14) {
        const t = Math.min(mok.ex - ax, mok.ez - az) + 0.25;
        ao *= occl(t, Math.max(0, 8.45 - y) + 0.35, up, down, 0.82);
      }
    }
    // under the main roof
    if (y > 10.2 && ax < main.ex + 0.5 && az < main.ez + 0.5 && y < mainSurf(x, z) - 0.18) {
      const t = Math.min(main.ex - ax, main.ez - az) + 0.3;
      ao *= occl(t, Math.max(0, 13.75 - y) + 0.35, up, down, 0.82);
    }
    // karahafu porch (under the vault)
    if (ax < K.Wk + 0.1 && z > 8.4 && z < K.zf + 0.25 && y > 1.5 && y < K.f(x) - 0.35) {
      const t = Math.min(K.Wk - ax, K.zf - z) + 0.2;
      ao *= occl(t, Math.max(0, K.f(x) - 0.7 - y) + 0.3, up, down, 0.75);
    }
    // bracket clusters (deep cavities between arms and blocks)
    {
      const wM = Math.max(ax - 13, az - 8.5);
      if (y > 7.9 && y < 9.3 && wM > -0.25 && wM < 1.0) ao *= 0.8;
      const wU = Math.max(ax - xi, az - zi);
      if (y > 12.85 && y < 14.9 && wU > -0.25 && wU < 1.6) ao *= 0.8;
    }
    // veranda crawlspace
    if (y > 1.45 && y < 1.97 && (ax > 12.8 || az > 8.3) && ax < 15.45 && az < 10.95) ao *= 0.3;
    // ground contact
    if (y < 0.45) ao *= 0.6 + 0.4 * (y / 0.45);
    return Math.max(0.12, Math.min(1, ao));
  };
  all.computeAO(aoField);
  const group = all.build('hall', { noShadow: new Set([]) });
  // cloth: black banners in bays 2 & 4 (outer halves), white valance over the open bays
  {
    const blk = clothMaterial(ctx, 'black'), wht = clothMaterial(ctx, 'white');
    const z = 8.5 + 0.42;
    for (const s of [-1, 1]) {
      const g = clothGeometry(THREE, s < 0 ? -5.2 : 3.7, s < 0 ? -3.7 : 5.2, 5.85, 3.25, z + 0.02, 0.3, 0.03, s);
      const m = new THREE.Mesh(g, blk.m); m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    }
    const gv = clothGeometry(THREE, -5.5, 5.5, 6.12, 0.62, z + 0.08, 0.26, 0.04, 0.7);
    const mv = new THREE.Mesh(gv, wht.m); mv.castShadow = true; mv.receiveShadow = true;
    group.add(mv);
    // curtain rod
  }
  group.position.set(C[0], C[1], C[2]);
  group.updateMatrixWorld(true);
  for (const k of ['hangingLanterns', 'bells']) for (const a of anchors[k]) a.pos = [a.pos[0] + C[0], a.pos[1] + C[1], a.pos[2] + C[2]];

  const carveTris = (all.map.get(mats.goldC)?.tris || 0) + (all.map.get(mats.goldR)?.tris || 0);
  console.log(`[world] hall: built in ${(performance.now() - t0).toFixed(0)} ms, tris=${all.tris} (gilt carving ${carveTris}), meshes=${group.children.length}`);

  const showcase = [
    { cam: [10, 2.2, 4], look: [10, 7.5, -22], focal: 24 },
    { cam: [-14, 3, 6], look: [10, 9, -20], focal: 28 },
    { cam: [22, 1.7, -5], look: [8, 6, -14], focal: 30 },
  ];
  return {
    object: group,
    anchors,
    showcase,
    finalize: async (c) => {
      try {
        // interior IBL: capture a local environment inside the hall twice (bounce)
        let env = null;
        for (let pass = 0; pass < (c.realtime?.enabled ? 1 : 2); pass++) {
          const e = c.captureEnv([C[0], C[1] + 5.0, C[2] + 1.0], { size: 128, near: 0.3 });
          for (const m of _interiorMats) { m.envMap = e; m.envMapIntensity = 1.0; m.needsUpdate = true; }
          if (env) env.dispose();
          env = e;
        }
      } catch (e) { console.warn('[hall] interior env capture failed', e); }
    },
  };
}
