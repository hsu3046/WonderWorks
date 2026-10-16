// ---------------------------------------------------------------------------
// props.js — hero props: stone lanterns (kasuga-dōrō), hanging bronze lanterns
// (tsuri-dōrō), wind bells (fūtaku), incense burner (jōkōro), water basin
// (chōzubachi / tsukubai) and stepping stones. All procedural, all instanced.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { stoneHooks, paperHooks, metalHooks, swayDepthHooks, panelHooks, BAMBOO_HOOKS, WATER_HOOKS, ASH_HOOKS, smokeMaterial } from './props-mat.js';
import { buildStoneLantern } from './props-stone.js';
import { buildHangingLantern, buildBell } from './props-hang.js';
import { buildJokoro, buildTsukubai, buildSteppingStones, smokeGeo } from './props-plaza.js';
import { Acc, mat4 } from './props-geo.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

// module state shared between build / placeAnchors / update
const STATE = { lights: [], glowPoints: [], mats: null, ctx: null, cache: {} };

function makeMats(ctx) {
  if (STATE.mats) return STATE.mats;
  const sh = stoneHooks();
  const stoneU = {
    uMoss: { value: 1.0 }, uLichen: { value: 1.0 }, uDirt: { value: 1.0 }, uMossDisp: { value: 0.012 },
    uFireCol: { value: new THREE.Color().setRGB(1.0, 0.5, 0.18) }, uFireI: { value: 4.8 }, uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const stone = ctx.mat.std({ color: 0xffffff, roughness: 0.85, metalness: 0 }, { ...sh, uniforms: stoneU });
  stone.name = 'props.stone';
  const stoneDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  // the shadow caster is shrunk 5 mm along the welded normal: kills self-shadow acne
  // striping on the mossy kasa under the 7-degree grazing sun (no visible peter-panning)
  const depthShrink = /* glsl */ `
  {
    vec3 nn2 = aSmooth;
    #ifdef USE_INSTANCING
      nn2 = mat3(instanceMatrix) * nn2;
    #endif
    wPos4.xyz -= normalize(mat3(modelMatrix) * nn2 + vec3(0.0, 1e-5, 0.0)) * 0.005;
  }`;
  ctx.mat.patch(stoneDepth, { vertexHead: sh.vertexHead, vertexWorld: sh.vertexWorld + depthShrink, uniforms: stoneU });

  // warm amber paper: keep linear values moderate + saturated so the tonemapper
  // does not wash the glow out to beige
  const paperU = { uPaperI: { value: 6.0 }, uPaperHot: { value: new THREE.Color().setRGB(1.0, 0.8, 0.5) }, uPaperEdge: { value: new THREE.Color().setRGB(1.0, 0.45, 0.13) } };
  const paper = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  ctx.mat.patch(paper, { ...paperHooks(), uniforms: paperU });
  paper.name = 'props.paper';

  // metals: one program, per-use sway uniforms
  const swayU = (a1, a2, f) => ({ uSway: { value: a1 }, uSway2: { value: a2 }, uSwayFreq: { value: f }, uWear: { value: 1.0 } });
  const mk = (u) => {
    const m = ctx.mat.std({ color: 0xffffff, roughness: 0.35, metalness: 1.0 }, { ...metalHooks(), uniforms: u });
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    ctx.mat.patch(d, { ...swayDepthHooks(), uniforms: u });
    return [m, d];
  };
  const lanternU = swayU(0.006, 0.0, 1.05);
  const [metalLantern, metalLanternDepth] = mk(lanternU);
  const [metalBell, metalBellDepth] = mk(swayU(0.045, 0.2, 2.4));
  const [metalStatic, metalStaticDepth] = mk(swayU(0, 0, 1));
  const panelU = { ...lanternU, uGlowI: { value: 3.5 }, uGlowHot: { value: new THREE.Color().setRGB(1.0, 0.58, 0.17) }, uGlowEdge: { value: new THREE.Color().setRGB(1.0, 0.27, 0.04) } };
  const panel = ctx.mat.std({ color: 0xffffff, roughness: 0.4, metalness: 1.0 }, { ...panelHooks(), uniforms: panelU });
  const panelDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  ctx.mat.patch(panelDepth, { ...swayDepthHooks(), uniforms: panelU });
  metalLantern.name = 'props.metalLantern'; metalBell.name = 'props.metalBell'; panel.name = 'props.panel';
  const bamboo = ctx.mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0 }, BAMBOO_HOOKS);
  const waterU = { uDrip: { value: new THREE.Vector3() } };
  const water = ctx.mat.phys({ color: 0xffffff, roughness: 0.03, metalness: 0, ior: 1.33, specularIntensity: 1.0 }, { ...WATER_HOOKS, uniforms: waterU });
  const ash = ctx.mat.std({ color: 0xffffff, roughness: 0.95, metalness: 0 }, ASH_HOOKS);
  const ember = ctx.mat.glow([1.0, 0.32, 0.06], 7);
  const smoke = smokeMaterial(ctx.G);
  bamboo.name = 'props.bamboo'; water.name = 'props.water'; ash.name = 'props.ash'; smoke.name = 'props.smoke';
  STATE.mats = { stone, stoneDepth, stoneU, paper, paperU, metalLantern, metalLanternDepth, metalBell, metalBellDepth, metalStatic, metalStaticDepth, panel, panelDepth, panelU,
    bamboo, water, waterU, ash, ember, smoke };
  return STATE.mats;
}

function groundY(ctx, x, z) {
  const t = ctx.modules && ctx.modules.terrain;
  if (t && typeof t.heightAt === 'function') { const h = t.heightAt(x, z); if (Number.isFinite(h)) return h; }
  return 0;
}

function stats(obj) {
  let tris = 0, draws = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return { tris: Math.round(tris), draws };
}

function instanced(geo, mat, matrices, { cast = true, receive = true, depth = null, name = '' } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(matrices.length, 1));
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = matrices.length;
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = receive;
  if (depth) im.customDepthMaterial = depth;
  im.name = name;
  im.computeBoundingSphere();
  im.frustumCulled = matrices.length > 0;
  return im;
}

// ---------------------------------------------------------------------------
// Stone lanterns
// ---------------------------------------------------------------------------
function placeStoneLanterns(ctx, group) {
  const { L } = ctx;
  const M = makeMats(ctx);
  const R = ctx.rng('props.stoneLanterns');
  const list = (L.stoneLanterns || []).map((e, i) => {
    const [x, z, h] = e;
    let kind = 'C';
    if (i < 4) kind = 'B';
    else if (i < 9) kind = 'A';
    else if (h >= 2.05) kind = 'A';
    let yaw = 0;
    if (i >= 6 && i < 9) yaw = Math.PI / 2;               // pagoda lanterns face the plaza
    if (i >= 9) yaw = Math.atan2(10 - x, 20 - z);         // shore lanterns face the pond
    yaw += R.range(-0.07, 0.07);
    return { i, x, z, h, kind, yaw, tx: R.range(-0.012, 0.012), tz: R.range(-0.012, 0.012) };
  });
  const kinds = {};
  for (const e of list) (kinds[e.kind] = kinds[e.kind] || []).push(e);
  const out = [];
  for (const [kind, items] of Object.entries(kinds)) {
    const lan = buildStoneLantern(kind);
    const mats = items.map((e) => {
      const s = e.h / lan.height;
      const y = groundY(ctx, e.x, e.z) - 0.02;
      return new THREE.Matrix4().compose(new THREE.Vector3(e.x, y, e.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(e.tx, e.yaw, e.tz, 'YXZ')), new THREE.Vector3(s, s, s));
    });
    const mS = instanced(lan.stone.build({ smooth: true }), M.stone, mats, { depth: M.stoneDepth, name: `stoneLantern${kind}` });
    const mP = instanced(lan.paper.build(), M.paper, mats, { cast: false, receive: false, name: `stoneLanternPaper${kind}` });
    items.forEach((e, k) => {
      const fire = new THREE.Vector3(0, lan.fireY, 0).applyMatrix4(mats[k]);
      STATE.glowPoints.push({ pos: fire, kind: 'stone', bias: 1.6, intensity: 0.9 });
      out.push({ ...e, matrix: mats[k], mesh: mS, paperMesh: mP, index: k, lan });
    });
    group.add(mS, mP);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hanging lanterns + bells at building anchors
// ---------------------------------------------------------------------------
function anchorMatrix(a) {
  const s = a.scale ?? 1;
  return new THREE.Matrix4().compose(new THREE.Vector3(...a.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.rotY || 0, 0)), new THREE.Vector3(s, s, s));
}

function hangGeometry() {
  if (!STATE.cache.hang) {
    const h = buildHangingLantern();
    STATE.cache.hang = { metal: h.metal.build(), panel: h.panel.build(), lightY: h.lightY, bottom: h.bottom };
  }
  return STATE.cache.hang;
}
function bellGeometry() {
  if (!STATE.cache.bell) STATE.cache.bell = buildBell({ seg: 22 }).metal.build();
  return STATE.cache.bell;
}

export function placeAnchors(ctx, anchors = {}) {
  const M = makeMats(ctx);
  const g = new THREE.Group();
  g.name = 'props.anchors';
  const lanterns = (anchors.hangingLanterns || []).filter((a) => a && a.pos);
  const bells = [...(anchors.bells || []), ...(anchors.smallBells || []).map((b) => ({ ...b, scale: (b.scale ?? 1) * 0.6 }))].filter((a) => a && a.pos);
  if (lanterns.length) {
    const H = hangGeometry();
    const mats = lanterns.map(anchorMatrix);
    const metal = instanced(H.metal.clone(), M.metalLantern, mats, { depth: M.metalLanternDepth, name: 'hangingLanternMetal' });
    const pg = H.panel.clone();
    const style = new Float32Array(lanterns.length);
    lanterns.forEach((a, i) => {
      // consistent style per building cluster (or explicit anchor.style)
      style[i] = a.style ?? (Math.floor(a.pos[0] / 24 + 100) + Math.floor(a.pos[2] / 24 + 100)) % 2;
    });
    pg.setAttribute('iStyle', new THREE.InstancedBufferAttribute(style, 1));
    const panel = instanced(pg, M.panel, mats, { depth: M.panelDepth, name: 'hangingLanternPanels' });
    g.add(metal, panel);
    mats.forEach((m) => STATE.glowPoints.push({ pos: new THREE.Vector3(0, H.lightY, 0).applyMatrix4(m), kind: 'hang', bias: 1.0, intensity: 1.0 }));
    // showcase: hero lantern nearest the hall front (close-up from below)
    if (STATE.showcase) {
      const target = new THREE.Vector3(10, 5, -8);
      let best = null, bd = Infinity;
      for (const m of mats) { const p = new THREE.Vector3(0, H.lightY, 0).applyMatrix4(m); const d = p.distanceTo(target); if (d < bd) { bd = d; best = p; } }
      if (best) {
        const dir = new THREE.Vector3(best.x - 10, 0, 1).normalize();
        const cam = best.clone().addScaledVector(dir, 1.6); cam.y -= 0.55;
        STATE.showcase.push({ cam: cam.toArray().map((v) => +v.toFixed(2)), look: [+(best.x - dir.x * 3).toFixed(2), +(best.y + 0.9).toFixed(2), +(best.z - 4).toFixed(2)], focal: 28, what: 'hero hanging lantern' });
      }
    }
  }
  if (bells.length) {
    const mats = bells.map(anchorMatrix);
    g.add(instanced(bellGeometry(), M.metalBell, mats, { depth: M.metalBellDepth, name: 'windBells' }));
  }
  console.log(`[world] props anchors: ${lanterns.length} hanging lanterns, ${bells.length} bells, ${JSON.stringify(stats(g))}`
    + (Q.has('propsdbg') ? ' bells@' + JSON.stringify(bells.slice(0, 6).map((b) => b.pos.map((v) => +v.toFixed(2)))) + ' lanterns@' + JSON.stringify(lanterns.slice(0, 40).map((b) => b.pos.map((v) => +v.toFixed(2)))) : ''));
  return g;
}

// ---------------------------------------------------------------------------
// Plaza props: jōkōro, tsukubai, stepping stones (one merged stone mesh)
// ---------------------------------------------------------------------------
export const PLAZA = {
  // in front of the hall stairs (stairs reach z≈-5.7, side posts -4.95), between the z=-4 lantern pair
  // scale 0.78: the burner sinks fully below the frame by the end of the shot-5
  // dolly instead of leaving a cut-off roof sliver at the bottom centre
  jokoro: { at: [10, -3.45], rotY: 0, scale: 0.78 },
  tsukubai: { at: [-15.0, -10.2], rotY: 0.12 },
  stepping: [
    // from the pagoda path north to the tsukubai
    { x: -14.8, z: -6.9, rot: 0.3, s: 1.05 }, { x: -15.25, z: -7.75, rot: 1.2, s: 0.9 }, { x: -14.85, z: -8.6, rot: 2.1, s: 1.0 },
    // from the path south toward the shore lantern (-12, 4.2)
    { x: -12.3, z: -2.55, rot: 0.6, s: 1.0 }, { x: -11.85, z: -1.6, rot: 1.9, s: 0.92 }, { x: -12.35, z: -0.7, rot: 0.2, s: 1.08 },
    { x: -11.95, z: 0.25, rot: 2.6, s: 0.95 }, { x: -12.45, z: 1.15, rot: 1.1, s: 1.0 }, { x: -12.0, z: 2.1, rot: 0.4, s: 0.9 },
  ],
};

function placePlaza(ctx, group, propBells) {
  const M = makeMats(ctx);
  const L = ctx.L;
  const R = ctx.rng('props.plaza');
  const gy = (x, z) => groundY(ctx, x, z);
  const stone = new Acc(), metal = new Acc(), ash = new Acc(), ember = new Acc(), bamboo = new Acc(), water = new Acc();
  // jōkōro
  const J = { ...PLAZA.jokoro, ...(L.jokoro || {}) };
  const jk = buildJokoro(R);
  const jm = new THREE.Matrix4().compose(new THREE.Vector3(J.at[0], gy(J.at[0], J.at[1]) - 0.02, J.at[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, J.rotY || 0, 0)), new THREE.Vector3(J.scale, J.scale, J.scale));
  stone.addAcc(jk.stone, jm); metal.addAcc(jk.metal, jm); ash.addAcc(jk.ash, jm); ember.addAcc(jk.glow, jm);
  for (const b of jk.cornerBells) propBells.push({ pos: new THREE.Vector3(...b.pos).applyMatrix4(jm).toArray(), scale: b.scale * J.scale, rotY: J.rotY || 0 });
  const sm = new THREE.Mesh(smokeGeo(7, 1.0, 0.5), M.smoke);
  const wd = ctx.G.uWindDir.value;
  sm.position.set(0, jk.smokeY, 0).applyMatrix4(jm);
  sm.rotation.y = -Math.atan2(wd.y, wd.x);
  sm.scale.setScalar(J.scale);
  sm.renderOrder = 10; sm.castShadow = false; sm.receiveShadow = false; sm.name = 'props.smoke';
  group.add(sm);
  STATE.glowPoints.push({ pos: new THREE.Vector3(0, jk.smokeY + 0.05, 0).applyMatrix4(jm), kind: 'ember', bias: 3.0, intensity: 0.35 });
  // tsukubai
  const T = { ...PLAZA.tsukubai, ...(L.tsukubai || {}) };
  const tk = buildTsukubai(R);
  const tm = new THREE.Matrix4().compose(new THREE.Vector3(T.at[0], gy(T.at[0], T.at[1]) - 0.03, T.at[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, T.rotY || 0, 0)), new THREE.Vector3(0.8, 0.8, 0.8));
  stone.addAcc(tk.stone, tm); bamboo.addAcc(tk.bamboo, tm); water.addAcc(tk.water, tm);
  M.waterU.uDrip.value.set(...tk.drip).applyMatrix4(tm);
  // stepping stones
  stone.addAcc(buildSteppingStones(PLAZA.stepping, gy));
  const mesh = (acc, mat, { cast = true, receive = true, depth = null, name }) => {
    if (!acc.n) return null;
    const m = new THREE.Mesh(acc.build({ smooth: mat === M.stone }), mat);
    m.castShadow = cast; m.receiveShadow = receive; if (depth) m.customDepthMaterial = depth; m.name = name;
    group.add(m); return m;
  };
  mesh(stone, M.stone, { depth: M.stoneDepth, name: 'props.plazaStone' });
  mesh(metal, M.metalStatic, { depth: M.metalStaticDepth, name: 'props.jokoroMetal' });
  mesh(ash, M.ash, { name: 'props.jokoroAsh' });
  mesh(ember, M.ember, { cast: false, receive: false, name: 'props.embers' });
  mesh(bamboo, M.bamboo, { name: 'props.bamboo' });
  mesh(water, M.water, { cast: false, name: 'props.basinWater' });
  return { jokoro: { matrix: jm, height: jk.height }, tsukubai: { matrix: tm } };
}

// ---------------------------------------------------------------------------
// Warm point lights that follow the nearest glowing lanterns (max 4).
// Weights fade smoothly as a lantern's rank approaches #5, so no popping.
// ---------------------------------------------------------------------------
function makeLights(group) {
  STATE.lights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(new THREE.Color().setRGB(1.0, 0.58, 0.26), 0, 7.5, 2);
    l.castShadow = false;
    l.name = 'props.lanternLight' + i;
    group.add(l);
    STATE.lights.push(l);
  }
}
const _cp = new THREE.Vector3();
const lightRanks = [];
const lastLightCamera = new THREE.Vector3(Infinity,Infinity,Infinity);
let lastLightCount = -1;
function updateLights(camPos) {
  const pts = STATE.glowPoints;
  if (!pts.length || !STATE.lights.length) return;
  if(lastLightCount===pts.length && lastLightCamera.distanceToSquared(camPos)<1e-8)return;
  lastLightCount=pts.length;lastLightCamera.copy(camPos);
  lightRanks.length=pts.length;
  for(let i=0;i<pts.length;i++){const rank=lightRanks[i] ||= {i:0,d:0};rank.i=i;rank.d=pts[i].pos.distanceTo(camPos)*pts[i].bias;}
  const d=lightRanks;
  d.sort((a, b) => a.d - b.d);
  const d5 = d.length > 4 ? d[4].d : Infinity;
  for (let k = 0; k < 4; k++) {
    const l = STATE.lights[k];
    if (k >= d.length) { l.intensity = 0; continue; }
    const p = pts[d[k].i];
    const w = d5 === Infinity ? 1 : Math.min(Math.max((d5 - d[k].d) / 2.0, 0), 1);
    l.position.copy(p.pos);
    l.intensity = 1.6 * p.intensity * w;
    l.updateMatrixWorld();
  }
}
function hookSceneLights(scene) {
  if (scene.userData.__propsLightHook) return;
  scene.userData.__propsLightHook = true;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, sc, camera, rt) {
    if (prev) prev.call(this, renderer, sc, camera, rt);
    try { camera.getWorldPosition(_cp); updateLights(_cp); } catch (e) { /* never break rendering */ }
  };
}

// ---------------------------------------------------------------------------
// Test rig (?propstest): a lacquered beam with hanging lanterns and bells.
// ---------------------------------------------------------------------------
function testRig(ctx, group) {
  const { THREE: T3 } = ctx;
  const mat = ctx.M.lacquerRed;
  const b = new ctx.geom.Builder();
  b.box(mat, 9.0, 0.36, 0.3, [24, 3.78, -2], [0, 0, 0], 0.03);
  b.box(mat, 0.34, 3.6, 0.34, [19.8, 1.8, -2], [0, 0, 0], 0.03);
  b.box(mat, 0.34, 3.6, 0.34, [28.2, 1.8, -2], [0, 0, 0], 0.03);
  b.box(ctx.M.roofTile, 9.6, 0.12, 1.6, [24, 4.05, -2], [0.08, 0, 0], 0.02);
  const rig = b.build({ name: 'props.testRig' });
  group.add(rig);
  return {
    hangingLanterns: [
      { pos: [21.6, 3.6, -2], scale: 1.0, rotY: 0, style: 0 },
      { pos: [24.0, 3.6, -2], scale: 1.0, rotY: 0.3, style: 1 },
      { pos: [26.4, 3.6, -2], scale: 1.0, rotY: 0, style: 0 },
    ],
    bells: [
      { pos: [20.4, 3.6, -1.95], scale: 1.0, rotY: 0 },
      { pos: [22.8, 3.6, -1.95], scale: 1.0, rotY: 0 },
      { pos: [25.2, 3.6, -1.95], scale: 1.0, rotY: 0.2 },
      { pos: [27.6, 3.6, -1.95], scale: 1.0, rotY: 0 },
    ],
  };
}

// ---------------------------------------------------------------------------
export async function build(ctx) {
  STATE.ctx = ctx; STATE.glowPoints = []; STATE.mats = null; STATE.cache = {};
  const group = new THREE.Group();
  group.name = 'props';
  STATE.stoneLanterns = placeStoneLanterns(ctx, group);
  const propBells = [];
  STATE.plaza = placePlaza(ctx, group, propBells);
  if (propBells.length) group.add(instanced(bellGeometry(), makeMats(ctx).metalBell, propBells.map(anchorMatrix), { depth: makeMats(ctx).metalBellDepth, name: 'props.jokoroBells' }));
  makeLights(group);
  hookSceneLights(ctx.scene);
  if (Q.has('propstest')) {
    const anchors = testRig(ctx, group);
    group.add(placeAnchors(ctx, anchors));
  }
  console.log(`[world] props base: ${JSON.stringify(stats(group))}`);
  STATE.showcase = [
    { cam: [10, 1.45, 2.6], look: [10, 1.9, -4.5], focal: 24, what: 'processional axis: carved lantern pair + jokoro before the hall stairs' },
    { cam: [8.2, 1.2, -0.4], look: [6.2, 1.75, -4.2], focal: 30, what: 'hero square lantern: carving, moss, glowing two-pane windows' },
    { cam: [7.2, 1.75, 33.2], look: [-6, 4, 10], focal: 26, what: 'bridge-head kasuga lantern foreground, pagoda behind' },
    { cam: [11.4, 1.45, -1.2], look: [10, 1.25, -3.35], focal: 35, what: 'jokoro close-up: bronze bowl, incense embers, smoke, roof bells' },
    { cam: [-14.55, 0.95, -8.6], look: [-15, 0.3, -10.2], focal: 35, what: 'tsukubai: mossy basin, bamboo spout, ripples, stepping stones' },
  ];
  return {
    object: group,
    update(T, c) { if (c && c.camera) { c.camera.getWorldPosition(_cp); updateLights(_cp); } },
    showcase: STATE.showcase,
  };
}
