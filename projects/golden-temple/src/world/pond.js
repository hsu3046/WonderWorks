// ---------------------------------------------------------------------------
// POND — water surface (planar reflections), stone basin edging, island,
// lotus colonies (hero), water lilies, koi, floating leaves/petals.
// World coordinates from L.pond. Water surface y = L.pond.waterY.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise, sdPoly, smoothClosed, inwardNormals, smooth, clamp, pointInPoly } from './pond-util.js';
import { buildWater, pondUniforms } from './pond-water.js';
import { buildStone } from './pond-stone.js';
import { buildLotus, planLotus } from './pond-lotus.js';
import { buildKoi, buildDebris } from './pond-koi.js';
import { buildShore } from './pond-shore.js';
import { sunDir } from '../core/env.js';

let SHOTS = null, evalShot = null, SHOT_DUR = 7;
try { const m = await import('../shots.js'); SHOTS = m.SHOTS; evalShot = m.evalShot; SHOT_DUR = m.SHOT_DUR || 7; } catch (e) { SHOTS = null; }

// ---------------------------------------------------------------------------
// Site: shore distance field, floor depth, map texture
// ---------------------------------------------------------------------------
async function makeSite(ctx) {
  const L = ctx.L;
  const P = L.pond;
  const waterY = P.waterY ?? -0.55;
  const bottomY = P.bottomY ?? -1.7;
  const rnd = ctx.rng('pond-site');
  const noise = makeNoise(() => rnd.float());

  const shore = smoothClosed(P.outline, 0.5);
  const island = smoothClosed(P.island, 0.35);
  const shoreN = inwardNormals(shore.pts);
  const islandN = inwardNormals(island.pts);

  // The terrain module carves the basin (raw outline, bridge-head peninsula,
  // land bumps at shore lanterns). Use its field so shore stones, depth map and
  // lotus all agree with the real bank. Standalone previews import it read-only.
  let F = ctx.modules && ctx.modules.terrain && ctx.modules.terrain.field;
  const terrainLoaded = !!F;
  if (!F) { try { F = (await import('./terrain-field.js')).createField(L); } catch (e) { F = null; console.warn('[pond] terrain field unavailable, using own basin', e && e.message); } }

  // south bridge landing (peninsula)
  const br = L.bridge;
  let landing = null;
  if (F && F.PEN) landing = { minX: F.PEN.cx - F.PEN.hx, maxX: F.PEN.cx + F.PEN.hx, minZ: F.PEN.cz - F.PEN.hz, maxZ: F.PEN.cz + F.PEN.hz, r: F.PEN.r };
  else if (br && br.south && pointInPoly(br.south[0], br.south[2], P.outline)) {
    const hw = Math.max(br.width / 2 + 1.6, 3.2);
    landing = { minX: br.south[0] - hw, maxX: br.south[0] + hw, minZ: br.south[2] - 0.2, maxZ: 40, r: 0 };
  }
  const landingPoly = landing ? [[landing.minX, landing.minZ], [landing.maxX, landing.minZ], [landing.maxX, landing.maxZ], [landing.minX, landing.maxZ]] : null;

  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [x, z] of P.outline) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  minX -= 2.6; maxX += 2.6; minZ -= 2.6; maxZ += 2.6;
  const rect = { minX, maxX, minZ, maxZ, sx: maxX - minX, sz: maxZ - minZ };

  // signed distance to the WATERLINE (+ in water)
  const WL_OUT = 0.65, WL_ISL = 0.3; // where the terrain bank crosses the water level
  function sdExact(x, z) {
    if (F) return Math.min(-F.sdPondEff(x, z) - WL_OUT, F.sdIsland(x, z) - WL_ISL);
    let d = sdPoly(x, z, shore.pts);
    if (d > -3) {
      d = Math.min(d, -sdPoly(x, z, island.pts));
      if (landingPoly) d = Math.min(d, -sdPoly(x, z, landingPoly));
    }
    return d;
  }

  const RES = 0.2;
  const nx = Math.ceil(rect.sx / RES) + 1, nz = Math.ceil(rect.sz / RES) + 1;
  const sdGrid = new Float32Array(nx * nz);
  const floorGrid = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = minX + i * RES, z = minZ + j * RES;
      sdGrid[j * nx + i] = sdExact(x, z);
    }
  }
  const D = waterY - bottomY; // max depth
  function floorFromSd(x, z, sd) {
    const n = noise.fbm2(x * 0.18, z * 0.18, 3);
    const n2 = noise.fbm2(x * 0.9 + 11, z * 0.9 - 4, 2);
    if (sd <= 0) return waterY - 0.12 + Math.min(-sd, 2.0) * 0.55 + n2 * 0.04;
    const s = smooth(0, 3.4, sd);
    let depth = 0.12 + (D - 0.12) * Math.pow(s, 0.85);
    depth += n * 0.16 * smooth(0.5, 3, sd) + n2 * 0.04;
    return waterY - Math.max(0.06, depth);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = minX + i * RES, z = minZ + j * RES;
    floorGrid[k] = F ? F.heightAt(x, z) : floorFromSd(x, z, sdGrid[k]);
  }
  const lotusGrid = new Float32Array(nx * nz);

  function bil(grid, x, z) {
    const fx = clamp((x - minX) / RES, 0, nx - 1.001), fz = clamp((z - minZ) / RES, 0, nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = grid[j * nx + i], b = grid[j * nx + i + 1], c = grid[(j + 1) * nx + i], d = grid[(j + 1) * nx + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  const site = {
    L, waterY, bottomY, noise, rnd, F, terrainLoaded,
    shore, island, shoreN, islandN, landing, landingPoly,
    rect, RES, nx, nz, gx0: minX, gz0: minZ, sdGrid, floorGrid, lotusGrid,
    sd: (x, z) => bil(sdGrid, x, z),
    sdExact,
    floorY: (x, z) => bil(floorGrid, x, z),
    lotusAt: (x, z) => bil(lotusGrid, x, z),
    rings: [],
    mapTex: null,
  };
  return site;
}

function finalizeMap(site) {
  const { nx, nz, sdGrid, floorGrid, lotusGrid, waterY } = site;
  // blur the lotus mask a little
  const lb = new Float32Array(nx * nz);
  const R = 3;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let s = 0, w = 0;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const ww = 1 / (1 + di * di + dj * dj);
      s += lotusGrid[jj * nx + ii] * ww; w += ww;
    }
    lb[j * nx + i] = s / w;
  }
  const data = new Uint8Array(nx * nz * 4);
  for (let k = 0; k < nx * nz; k++) {
    const depth = clamp(waterY - floorGrid[k], 0, 2);
    data[k * 4 + 0] = Math.round((depth / 2) * 255);
    data[k * 4 + 1] = Math.round(clamp((sdGrid[k] + 2) / 8, 0, 1) * 255);
    data[k * 4 + 2] = Math.round(clamp(lb[k], 0, 1) * 255);
    data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  site.mapTex = tex;
  // texel-centre alignment: texture covers [minX - RES/2, minX + (nx-0.5)*RES]
  site.rect = { ...site.rect, minX: site.rect.minX - site.RES / 2, minZ: site.rect.minZ - site.RES / 2, sx: nx * site.RES, sz: nz * site.RES };
}

// Camera paths of shots that skim the pond (kept free of stems/leaves)
function pondCameraPaths(site) {
  const paths = [];
  if (SHOTS) {
    SHOTS.forEach((s, si) => {
      const keys = s.keys || [];
      const low = keys.length && keys.every((k) => k.pos[1] < 2.0 && site.sdExact(k.pos[0], k.pos[2]) > -0.5);
      if (!low) return;
      // sample the real camera curve (easing, spline, lens) of the film
      const pts = [];
      const N = 48;
      for (let i = 0; i <= N; i++) {
        let pos, look, focal;
        if (evalShot) {
          const c = evalShot(si, (i / N) * SHOT_DUR);
          pos = c.pos.toArray(); look = c.look.toArray(); focal = c.focal;
        } else {
          const u = i / N, seg = u * (keys.length - 1);
          const a = Math.min(Math.floor(seg), keys.length - 2), t = seg - a;
          const A = keys[a].pos, B = keys[a + 1].pos, LA = keys[a].look, LB = keys[a + 1].look;
          pos = A.map((v, j) => v + (B[j] - v) * t); look = LA.map((v, j) => v + (LB[j] - v) * t); focal = keys[a].focal ?? 35;
        }
        pts.push({ pos, look, focal });
      }
      // hero: the first key's focus point (what the opening macro is about)
      const k0 = keys[0];
      const d = [k0.look[0] - k0.pos[0], k0.look[1] - k0.pos[1], k0.look[2] - k0.pos[2]];
      const dl = Math.hypot(...d) || 1;
      const fd = k0.focus ?? dl;
      const hero = s.pondHero ? { ...s.pondHero, at: k0.pos.map((v, j) => v + (d[j] / dl) * fd), cam: k0.pos.slice(), dir: d.map((v) => v / dl) } : null;
      const kind = s.pondHero ? s.pondHero.kind : (/lotus/i.test(s.name || '') ? 'flower' : 'pad');
      paths.push({ name: s.name, shot: si, kind, hero, focal: keys[0].focal ?? 35, pts });
    });
  }
  if (!paths.length) {
    paths.push({ name: 'lotus', kind: 'flower', hero: null, focal: 35, pts: [{ pos: [21, -0.05, 20], look: [10, 1.5, 8], focal: 35 }, { pos: [18.5, 0.15, 17], look: [10, 2.2, 6], focal: 35 }] });
    paths.push({ name: 'mirror', kind: 'pad', hero: null, focal: 24, pts: [{ pos: [34, 0.25, 30], look: [-28, 9, -6], focal: 24 }, { pos: [28, 0.35, 26], look: [-30, 10, -6], focal: 24 }] });
  }
  return paths;
}

// Module-only previews: main.js adds a flat granite disc at y=0 when the terrain
// module is absent; replace it with one that leaves the basin open.
function punchFallbackGround(ctx, site) {
  const fg = ctx.scene.getObjectByName('fallbackGround');
  if (!fg) return;
  const r = site.rect;
  const x0 = r.minX, x1 = r.minX + r.sx, z0 = r.minZ, z1 = r.minZ + r.sz;
  const outer = new THREE.Shape();
  outer.absarc(0, 0, 400, 0, Math.PI * 2, false);
  const hole = new THREE.Path([new THREE.Vector2(x0, -z0), new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0)]);
  outer.holes.push(hole);
  const ring = new THREE.ShapeGeometry(outer, 64).rotateX(-Math.PI / 2);
  // grid inside the basin rect, kept where the shore distance says land
  const res = 0.25;
  const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res);
  const pos = [], idx = [];
  const vid = new Int32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = Math.min(x0 + i * res, x1), z = Math.min(z0 + j * res, z1);
    vid[j * (nx + 1) + i] = pos.length / 3;
    pos.push(x, site.F ? Math.max(site.F.heightAt(x, z), -0.3) : 0, z);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * res, cz = z0 + (j + 0.5) * res;
    if (site.sd(cx, cz) > -1.15) continue;
    if (site.F && site.F.sdIsland(cx, cz) < 0.8) continue;
    const a = vid[j * (nx + 1) + i], b = a + 1, c = vid[(j + 1) * (nx + 1) + i], d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  grid.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
  grid.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  grid.setIndex(idx);
  const ringNI = ring.toNonIndexed(); const gridNI = grid.toNonIndexed();
  ringNI.deleteAttribute('uv'); gridNI.deleteAttribute('uv');
  const merged = mergeGeometries([ringNI, gridNI], false);
  if (merged) { fg.geometry.dispose(); fg.geometry = merged; }
}

export async function build(ctx) {
  const t0 = performance.now();
  const group = new THREE.Group();
  group.name = 'pond';
  const site = await makeSite(ctx);
  site.camPaths = pondCameraPaths(site);
  const tSite = performance.now();

  // lotus plan first (it shapes the calm-water mask and keeps koi lanes open)
  let plan = null;
  try { plan = planLotus(ctx, site); } catch (e) { console.error('[pond] lotus plan failed', e.stack || e); }

  // koi rings / surface disturbances in open water
  {
    const r = ctx.rng('pond-rings');
    const rings = [];
    // water-level shot facing the low sun: two young rings (a drip, a koi kiss)
    // spreading through the sun's reflection so it breaks into arcs of glitter
    const padPath = site.camPaths.find((p) => p.kind === 'pad' && p.hero);
    if (padPath) {
      const c = padPath.hero.cam;
      const sl = Math.hypot(sunDir.x, sunDir.z) || 1;
      const sx = sunDir.x / sl, sz = sunDir.z / sl;
      const T0 = (padPath.shot ?? 8) * SHOT_DUR + 37.0; // shader clock = film time + 37 (main.js)
      // a sunlit breeze patch along the sun's reflection (only during that shot)
      site.glitter = [c[0] + sx * 2.3, c[2] + sz * 2.3, 2.8, 1.3];
      site.glitterShot = padPath.shot ?? 8;
      site.glitterT = [T0 + 1.5, T0 + 4.2]; // the gust dies down as the camera rises to the mirror view
      for (const [d, lat, per, age0, amp] of [[1.05, 0.06, 7, 1.0, 2.2], [1.7, -0.18, 7, 2.0, 2.2], [2.6, 0.3, 7, 0.4, 2.0]]) {
        const x = c[0] + sx * d - sz * lat, z = c[2] + sz * d + sx * lat;
        if (site.sd(x, z) < 0.6) continue;
        rings.push([x, z, per, ((age0 - T0) % per + per) % per, amp]);
      }
    }
    let guard = 0;
    while (rings.length < 8 && guard++ < 400) {
      const x = r.range(site.rect.minX + 3, site.rect.maxX - 3), z = r.range(site.rect.minZ + 3, site.rect.maxZ - 3);
      if (site.sd(x, z) < 2.0 || site.lotusAt(x, z) > 0.2) continue;
      rings.push([x, z, r.range(6, 13), r.range(0, 13)]);
    }
    site.rings = rings;
  }
  finalizeMap(site);
  const U = pondUniforms(site);
  site.U = U;

  const updates = [];
  const parts = {};
  const tryPart = (name, fn) => {
    const ts = performance.now();
    try {
      const res = fn();
      parts[name] = res;
      if (res && res.object) group.add(res.object);
      if (res && res.mesh) group.add(res.mesh);
      if (res && res.update) updates.push(res.update);
    } catch (e) { console.error(`[pond] part ${name} failed:`, e.stack || e); }
    const dt = performance.now() - ts;
    if (dt > 150) console.log(`[world] pond: ${name} ${dt.toFixed(0)} ms`);
  };

  tryPart('water', () => buildWater(ctx, site, U));
  tryPart('stone', () => buildStone(ctx, site, U));
  if (plan) tryPart('lotus', () => buildLotus(ctx, site, U, plan));
  tryPart('koi', () => buildKoi(ctx, site, U, plan));
  tryPart('debris', () => buildDebris(ctx, site, U, plan));
  tryPart('shore', () => buildShore(ctx, site, U, plan));

  console.log(`[world] pond: built in ${(performance.now() - t0).toFixed(0)} ms (site ${(tSite - t0).toFixed(0)} ms)`);

  return {
    object: group,
    update: (T, c) => { for (const u of updates) u(T, c); },
    finalize: (c) => punchFallbackGround(c, site),
    site,
    dispose: () => parts.water?.reflRT.dispose(),
    showcase: [
      { cam: [20.6, 0.0, 19.4], look: [10, 1.7, 7.6], focal: 35 },
      { cam: [33, 0.28, 29.4], look: [-28, 9, -6], focal: 24 },
      { cam: [44, 4.5, 33], look: [8, 0, 14], focal: 30 },
    ],
  };
}
