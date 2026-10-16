import * as THREE from 'three';
import { OVERRIDES } from './shotkeys/index.js';

// ---------------------------------------------------------------------------
// The film: 10 shots x 7 s. Each shot: camera keyframes (pos/target) sampled
// by a Catmull-Rom spline with eased progress; lens; focus; post overrides;
// shadow focus region.
// ---------------------------------------------------------------------------

export const SHOT_DUR = 7.0;

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export const SHOTS = [
  {
    name: 'Lantern — inside the glowing openwork, pulling back to the pagoda across the pond',
    ease: 'reveal',
    keys: [
      { pos: [43.62, 3.62, 22.28], look: [42.85, 3.72, 21.5], focal: 45, focus: 1.05, fstop: 2.8 },
      { pos: [44.45, 2.8, 21.0], look: [-30, 9.8, -9], focal: 24, focus: 40, fstop: 5.6 },
    ],
    shadow: { center: [24, 2, 8], radius: 50 },
    post: { dof: true },
  },
  {
    name: 'Lotus — macro on a lotus flower, gliding through the bed toward the bridge',
    keys: [
      { pos: [3.6, 0.22, 16.9], look: [10, 2.0, 4.5], focal: 40, focus: 0.6, fstop: 2.8 },
      { pos: [5.2, 0.32, 13.9], look: [10, 2.6, 3.5], focal: 35, focus: 2.6, fstop: 3.5 },
    ],
    near: 0.03,
    shadow: { center: [8, 0, 10], radius: 24 },
    post: { dof: true },
  },
  {
    name: 'Giboshi — gold finial macro on the bridge, rising over the rail to the hall',
    ease: 'reveal',
    keys: [
      { pos: [12.35, 3.5, 21.9], look: [11.8, 3.55, 21.0], focal: 45, focus: 0.9, fstop: 2.8 },
      { pos: [11.0, 4.6, 15.8], look: [10, 6.2, -18], focal: 28, focus: 18, fstop: 5.6 },
    ],
    near: 0.05,
    shadow: { center: [10, 2, 8], radius: 28 },
    post: { dof: true },
  },
  {
    name: 'Wind bell — bronze futaku at the pagoda corner, pulling back up the storeys',
    ease: 'reveal',
    keys: [
      { pos: [-40.35, 4.75, 0.55], look: [-39.5, 5.05, -0.5], focal: 45, focus: 1.35, fstop: 2.8 },
      { pos: [-45.5, 1.8, 6.8], look: [-33, 13.5, -7.5], focal: 22, focus: 14, fstop: 8 },
    ],
    near: 0.05,
    shadow: { center: [-33, 8, -6], radius: 22 },
    post: { dof: true },
  },
  {
    name: 'Stone lantern — moss and flame, swinging onto the processional axis',
    ease: 'reveal',
    keys: [
      { pos: [6.95, 1.72, 2.95], look: [6.0, 1.72, 2.0], focal: 45, focus: 1.3, fstop: 2.8 },
      { pos: [10.0, 1.8, 5.4], look: [10, 6.5, -22], focal: 28, focus: 16, fstop: 5.6 },
    ],
    near: 0.05,
    shadow: { center: [10, 3, -8], radius: 28 },
    post: { dof: true },
  },
  {
    name: 'Eave corner — gold rafter caps and bell under the hall roof, sliding along the west front',
    keys: [
      { pos: [-9.6, 5.2, -6.6], look: [-7.57, 8.4, -8.93], focal: 28, focus: 4, fstop: 4 },
      { pos: [-14.5, 2.4, -2.5], look: [4, 9.5, -18], focal: 22, focus: 14, fstop: 8 },
    ],
    shadow: { center: [0, 8, -16], radius: 26 },
    post: { dof: true },
  },
  {
    name: 'Inner sanctum — the Buddha face, pulling back through the gold canopy',
    ease: 'reveal',
    keys: [
      { pos: [10, 5.75, -24.4], look: [10, 5.85, -27.2], focal: 50, focus: 2.8, fstop: 2.8 },
      { pos: [10, 2.7, -16.8], look: [10, 5.2, -27], focal: 22, focus: 11, fstop: 4 },
    ],
    shadow: { center: [10, 5, -22], radius: 22 },
    noShadow: ['vegetation', 'terrain', 'buildings', 'pagoda'],
    post: { exposure: 1.0, dof: true },
  },
  {
    name: 'South gate — gilt fitting on the gate pillar, sliding to the telephoto view of the hall',
    ease: 'reveal',
    keys: [
      { pos: [8.3, 1.55, 47.6], look: [7.75, 1.55, 46.8], focal: 50, focus: 1.0, fstop: 2.8 },
      { pos: [10.4, 1.7, 55.5], look: [9.9, 8, -22], focal: 50, focus: 60, fstop: 5.6 },
    ],
    near: 0.05,
    shadow: { center: [10, 4, 30], radius: 40 },
    post: { dof: true },
  },
  {
    name: 'Mirror — just above the water, rising to the reflections of pagoda and hall',
    keys: [
      { pos: [30.5, -0.3, 27.6], look: [26, -0.55, 23.5], focal: 35, focus: 3, fstop: 4 },
      { pos: [27.5, 0.45, 25.5], look: [-30, 10, -6], focal: 24, focus: 30, fstop: 8 },
    ],
    near: 0.05,
    shadow: { center: [0, 0, 6], radius: 60 },
    post: { dof: true },
  },
  {
    name: 'Finale — backlit maple leaves, then a rising crane over the whole complex',
    ease: 'reveal',
    keys: [
      { pos: [38.6, 3.1, 36.3], look: [36.3, 3.5, 34.4], focal: 40, focus: 1.1, fstop: 2.8 },
      { pos: [52, 12, 47], look: [-25, 6, -7], focal: 28 },
      { pos: [72, 30, 61], look: [-22, 3, -8], focal: 24, focus: 90, fstop: 11 },
    ],
    near: 0.05,
    shadow: { center: [10, 0, 6], radius: 80 },
    post: { fog: 0.65, exposure: 0.95, dof: true },
  },
];

// per-module camera overrides (src/shotkeys/*.js)
for (const o of OVERRIDES) for (const [k, v] of Object.entries(o || {})) Object.assign(SHOTS[+k], v);
// motion smoothing (seconds) where hand-made keys produced acceleration snaps (tools/camcheck.mjs)
const SMOOTH = { 4: 0.22, 9: 0.45 };
for (const [k, v] of Object.entries(SMOOTH)) if (SHOTS[+k].smooth === undefined) SHOTS[+k].smooth = v;


const tmpA = new THREE.Vector3();

function ease(u) {
  // gentle ease in/out that keeps motion alive in the middle
  const s = u * u * (3 - 2 * u);
  return u * 0.35 + s * 0.65;
}

// Evaluate camera for shot index `i` at local time `t` (0..SHOT_DUR)
// Keys: { pos, look, focal?, focus?, fstop? }. Orientation is interpolated as a
// DIRECTION (so close-up -> wide reveals pan smoothly), look distance in log space,
// lens (focal, focus, fstop) per key with fallback to the shot-level values.
function easeFor(S, u) {
  const e = S.ease || 'inout';
  if (e === 'linear') return u;
  if (e === 'reveal') { // linger on the close-up, then accelerate into the reveal, soft landing
    const a = u * u * (3 - 2 * u);
    return Math.pow(a, 1.35);
  }
  return ease(u);
}
function lerpKeys(vals, u) {
  const n = vals.length - 1;
  const x = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1), f = x - i;
  return vals[i] + (vals[i + 1] - vals[i]) * f;
}
// Optional temporal smoothing (S.smooth = Gaussian sigma in seconds): averages the raw
// camera over neighbouring times, removing acceleration snaps from hand-made keys.
export function evalShot(i, t) {
  const S = SHOTS[i];
  const sg = S.smooth || 0;
  if (!sg) return evalShotRaw(i, t);
  const c = evalShotRaw(i, t);
  const pos = new THREE.Vector3(), dir = new THREE.Vector3();
  let wsum = 0, ld = 0, focal = 0;
  const E = SHOT_DUR - 1e-4;
  // point-reflection extrapolation beyond the shot ends keeps velocity continuous
  const sample = (tk) => {
    if (tk >= 0 && tk <= E) return evalShotRaw(i, tk);
    const edge = tk < 0 ? 0 : E, mir = tk < 0 ? -tk : 2 * E - tk;
    const a = evalShotRaw(i, edge), b = evalShotRaw(i, Math.min(Math.max(mir, 0), E));
    const da = a.look.clone().sub(a.pos), db = b.look.clone().sub(b.pos);
    const la = da.length(), lb = db.length();
    da.divideScalar(la); db.divideScalar(lb);
    a.pos = a.pos.clone().multiplyScalar(2).sub(b.pos);
    const d = da.multiplyScalar(2).sub(db).normalize();
    a.look = a.pos.clone().addScaledVector(d, Math.exp(2 * Math.log(la) - Math.log(lb)));
    a.focal = 2 * a.focal - b.focal;
    return a;
  };
  for (let k = -6; k <= 6; k++) {
    const tk = t + (k / 6) * 2.5 * sg;
    const w = Math.exp(-0.5 * ((k / 6) * 2.5) ** 2);
    const ck = sample(tk);
    pos.addScaledVector(ck.pos, w);
    const d = ck.look.clone().sub(ck.pos); const l = d.length();
    dir.addScaledVector(d.divideScalar(l), w); ld += Math.log(l) * w; focal += ck.focal * w; wsum += w;
  }
  pos.divideScalar(wsum); dir.normalize();
  c.pos = pos; c.look = pos.clone().addScaledVector(dir, Math.exp(ld / wsum)); c.focal = focal / wsum;
  return c;
}
function evalShotRaw(i, t) {
  const S = SHOTS[i];
  const u = easeFor(S, Math.min(Math.max(t / SHOT_DUR, 0), 1));
  const K = S.keys;
  const P = K.map((k) => V(k.pos));
  const D = K.map((k) => V(k.look).sub(V(k.pos)));
  const LD = D.map((d) => Math.log(Math.max(d.length(), 0.05)));
  D.forEach((d) => d.normalize());
  let pos, dir;
  if (K.length === 2) {
    pos = P[0].clone().lerp(P[1], u);
    dir = D[0].clone().lerp(D[1], u).normalize();
  } else {
    pos = new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.5).getPoint(u);
    dir = new THREE.CatmullRomCurve3(D, false, 'catmullrom', 0.5).getPoint(u).normalize();
  }
  const ld = Math.exp(lerpKeys(LD, u));
  const look = pos.clone().addScaledVector(dir, ld);
  const focal = lerpKeys(K.map((k) => k.focal ?? S.focal ?? 35), u);
  const fstop = lerpKeys(K.map((k) => k.fstop ?? S.fstop ?? 8), u);
  let focusDist;
  if (K.some((k) => k.focus !== undefined)) focusDist = Math.exp(lerpKeys(K.map((k, j) => Math.log(k.focus ?? (S.focus === 'look' || S.focus === undefined ? Math.exp(LD[j]) : S.focus))), u));
  else focusDist = S.focus === 'look' ? ld : S.focus;
  return {
    index: i, noShadow: S.noShadow || null,
    pos, look,
    focal, near: S.near || 0.12, far: S.far || 6000,
    focusDist, fstop,
    roll: S.roll || 0,
    shadow: S.shadow, post: S.post || {},
  };
}

export const FILM_DURATION = SHOTS.length * SHOT_DUR;
