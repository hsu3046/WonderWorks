// ---------------------------------------------------------------------------
// Lotus (Nelumbo nucifera) colonies + water lilies (Nymphaea).
//  - emergent leaves: round peltate, cupped, wavy rims, radiating veins, navel,
//    glaucous waxy bloom (sheen), backlit yellow-green translucency
//  - floating leaves (flat, no notch) and notched lily pads
//  - flowers: open / half-open / bud / seed pod, multi-whorl pointed petals with
//    pink tips, yellow receptacle with carpels and a ring of stamens; petals
//    translucent; lily flowers (white / pink stars)
//  - stems: curved petioles / peduncles, merged, swaying with the leaves
// Everything is instanced per shape variant; wind is a shared GLSL function
// evaluated at the stem top so leaves, flowers and stems move together.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POND_GLSL, UW_FRAGEND } from './pond-water.js';
import { makeNoise, clamp, smooth, pointInPoly } from './pond-util.js';
import { lotusFlower, lotusSpent, fallenPetal } from './pond-lotusgeo.js';
import { LEAK_UNIFORM, LEAK_COV, LEAK_SHOT } from './pond-lotusplan.js';
import { sampleBeads, buildBeads, DROP_GLSL } from './pond-beads.js';

const TAU = Math.PI * 2;

// r186 MeshDepthMaterial only declares objectNormal under USE_DISPLACEMENTMAP,
// but core patch() references it -> provide a global for depth materials.
const DEPTH_FIX = '\nvec3 objectNormal = vec3(0.0, 1.0, 0.0);\n';

// shared sway (vertex stage). a = stem-top xz, h = height above water, seed 0..1
const SWAY_GLSL = /* glsl */ `
uniform float uWaterYV;
vec3 lotusSway(vec2 a, float h, float seed){
  float t = uTime;
  vec2 wd = normalize(uWindDir);
  float ph = seed * 6.2831;
  float gust = 0.55 + 0.45 * sin(t * 0.33 + dot(a, wd) * 0.21 + 1.3) * sin(t * 0.21 + a.x * 0.07 + 0.4);
  float s1 = sin(t * (0.85 + seed * 0.3) + ph + dot(a, vec2(0.6, 0.4)));
  float s2 = sin(t * (1.7 + seed * 0.5) + ph * 1.7 + dot(a, vec2(-0.5, 0.8)));
  vec2 o = wd * (0.5 + 0.5 * s1) * gust * 0.045 + vec2(-wd.y, wd.x) * s2 * 0.014;
  float k = clamp(h, 0.0, 1.4);
  o *= k * uWindStrength;
  return vec3(o.x, -0.3 * dot(o, o) / max(k, 0.05), o.y);
}
`;

// Dappled sun "leak": the hero bed of the macro shot lies in the long shadow of
// the island (pine + shrubs) at this 7 degree sun. Lotus materials add back part
// of the blocked sunlight in a sun-projected dapple pattern inside this zone so
// the hero flowers/leaves catch broken light as if through the pine's gaps.
// uLeak = (centre x, centre z, radius, strength); uLeakCov shifts the dapple coverage
const LEAK_GLSL = /* glsl */ `
uniform vec4 uLeak;
uniform float uLeakCov;
uniform float uLeakShot;
// only in the macro shot (and free cameras): elsewhere the bed reads at a
// distance next to its real shadow, where lit leaves would look wrong
float lotusLeakOn(){ return (uLeak.z > 0.0 && (uShot < -0.5 || abs(uShot - uLeakShot) < 0.5)) ? 1.0 : 0.0; }
float lotusDapple(vec3 wp){
  if (lotusLeakOn() < 0.5) return 0.0;
  vec3 sd = normalize(uSunDir);
  vec3 e1 = normalize(cross(sd, vec3(0.0, 1.0, 0.0)));
  vec3 e2 = cross(e1, sd);
  vec2 q = vec2(dot(wp, e1), dot(wp, e2));
  float n = n_fbm(q * 0.85 + vec2(3.7, 1.3), 3) + 0.3 * n_snoise(q * 2.9 + 5.1);
  float d = smoothstep(-0.2 - uLeakCov, 0.1 - uLeakCov, n);
  float zone = 1.0 - smoothstep(uLeak.z * 0.55, uLeak.z, length(wp.xz - uLeak.xy));
  return d * zone;
}
`;

// ---------------------------------------------------------------------------
// Geometry generators
// ---------------------------------------------------------------------------
function leafGeometry(r, { seg = 48, rings = 10, cup = 0.2, wave = 0.05, droop = 0, floating = false, corr = 0.012, ruffle = 0, nR = 11, fold = 0, lip = 0 }) {
  const ph = [r.range(0, TAU), r.range(0, TAU), r.range(0, TAU), r.range(0, TAU), r.range(0, TAU), r.range(0, TAU)];
  const droopDir = r.range(0, TAU), foldDir = r.range(0, TAU);
  const NV = 21;
  const pos = [], uv = [], idx = [];
  const ringR = (k) => Math.pow(k / rings, 0.92);
  // centre
  pos.push(0, 0, 0); uv.push(0, 0);
  for (let k = 1; k <= rings; k++) {
    const rr = ringR(k);
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * TAU;
      const R = 1 + 0.028 * Math.sin(3 * th + ph[0]) + 0.014 * Math.sin(7 * th + ph[1]) + 0.006 * Math.sin(13 * th + ph[5]);
      const rad = rr * R;
      let y;
      if (floating) {
        y = 0.012 * rr + 0.035 * Math.pow(smooth(0.82, 1.0, rr), 1.5) + wave * 0.25 * Math.pow(rr, 4) * Math.sin(5 * th + ph[2]);
        // hero-resolution pads: soft corrugation between the radiating veins (grazing sun)
        if (seg >= 100) y += 0.004 * rr * (0.5 - 0.5 * Math.cos(NV * th)) * smooth(0.1, 0.6, rr) * (1 - smooth(0.85, 1.0, rr));
      } else {
        y = cup * (0.3 * rr + 0.7 * rr * rr);
        y += wave * Math.pow(rr, 3) * (Math.sin(5 * th + ph[2]) * 0.6 + Math.sin(9 * th + ph[3]) * 0.28 + Math.sin(15 * th + ph[4]) * 0.12);
        y -= droop * Math.pow(Math.max(0, Math.cos(th - droopDir)), 3) * Math.pow(rr, 2.5);
        // corrugation between the radiating veins (catches grazing light)
        y += corr * rr * (0.5 - 0.5 * Math.cos(NV * th)) * smooth(0.08, 0.5, rr);
        // finely ruffled margin
        y += ruffle * Math.pow(smooth(0.6, 1.0, rr), 1.6) * (Math.sin(nR * th + ph[4]) * 0.7 + Math.sin((2 * nR + 1) * th + ph[1]) * 0.3);
        // half-folded young leaves (taco) and a down-turned lip at the rim
        y += fold * rr * rr * Math.pow(Math.abs(Math.sin(th - foldDir)), 1.4);
        y -= lip * Math.pow(smooth(0.86, 1.0, rr), 2);
      }
      pos.push(rad * Math.cos(th), y, rad * Math.sin(th));
      uv.push(rr, j / seg);
    }
  }
  const row = seg + 1;
  for (let j = 0; j < seg; j++) idx.push(0, 1 + j + 1, 1 + j);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * row, a1 = 1 + k * row;
    for (let j = 0; j < seg; j++) {
      const a = a0 + j, b = a0 + j + 1, c = a1 + j, d = a1 + j + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Lily pad: flat disc with a V notch
function lilyPadGeometry(r, { seg = 44, rings = 7 } = {}) {
  const notch = r.range(0.16, 0.3);
  const ph = r.range(0, TAU), ph2 = r.range(0, TAU), up = r.range(0.0, 0.05);
  const pos = [], uv = [], idx = [];
  pos.push(0, 0.004, 0); uv.push(0, 0.5);
  for (let k = 1; k <= rings; k++) {
    const rr = k / rings;
    for (let j = 0; j <= seg; j++) {
      const th = notch / 2 + (j / seg) * (TAU - notch);
      const R = 1 + 0.02 * Math.sin(4 * th + ph) + 0.008 * Math.sin(11 * th + ph2);
      // flat, the margin a little wavy and (on some pads) turned up to show the red underside
      const y = 0.004 + (0.03 + up) * Math.pow(smooth(0.8, 1.0, rr), 2) * (0.6 + 0.4 * Math.sin(3 * th + ph)) + 0.006 * Math.pow(rr, 3) * Math.sin(7 * th + ph2);
      pos.push(rr * R * Math.cos(th), y, rr * R * Math.sin(th));
      uv.push(rr, j / seg);
    }
  }
  const row = seg + 1;
  for (let j = 0; j < seg; j++) idx.push(0, 1 + j + 1, 1 + j);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * row, a1 = 1 + k * row;
    for (let j = 0; j < seg; j++) { const a = a0 + j, b = a0 + j + 1, c = a1 + j, d = a1 + j + 1; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// One petal. Local frame: base at origin, grows along +Y, width along X,
// inner (concave) side faces +Z. Returns arrays to append.
function petalInto(out, mtx, { L, W, cup = 0.5, bend = 0.4, curl = 0.0, nu = 9, nv = 6, part = 0, shape = 0.85, tipW = 0 }) {
  const base = out.pos.length / 3;
  // integrate centreline
  const C = [], T = [], N = [];
  let y = 0, z = 0;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const th = bend * Math.pow(u, 1.4) + curl * Math.pow(smooth(0.6, 1.0, u), 2);
    C.push([y, z]);
    T.push([Math.cos(th), Math.sin(th)]);
    N.push([-Math.sin(th), Math.cos(th)]);
    y += Math.cos(th) * L / nu; z += Math.sin(th) * L / nu;
  }
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
  const nm = new THREE.Matrix3().getNormalMatrix(mtx);
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    let w = W * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(u, 0.999), shape)), shape > 1.1 ? 0.5 : 0.72) * (1 - 0.12 * u);
    if (u > 0.999) w = tipW;
    w = Math.max(w, 0.0005);
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      const x = v * w * 0.5;
      const zc = cup * v * v * w * 0.5;
      // position = centreline + X * x + N * zc
      const py = C[i][0] + N[i][0] * zc;
      const pz = C[i][1] + N[i][1] * zc;
      v3.set(x, py, pz).applyMatrix4(mtx);
      out.pos.push(v3.x, v3.y, v3.z);
      out.uv.push(u, v);
      out.part.push(part);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = base + i * row + j, b = a + 1, c = a + row, d = c + 1;
    out.idx.push(a, c, b, b, c, d);
  }
}

function boxInto(out, mtx, w, h, d, part, uvU = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.applyMatrix4(mtx);
  const p = g.attributes.position;
  const base = out.pos.length / 3;
  for (let i = 0; i < p.count; i++) { out.pos.push(p.getX(i), p.getY(i), p.getZ(i)); out.uv.push(uvU, 0); out.part.push(part); out.idx.push(base + i); }
}

function latheInto(out, mtx, profile, seg, part) {
  const g = new THREE.LatheGeometry(profile.map(([rr, yy]) => new THREE.Vector2(Math.max(rr, 1e-4), yy)), seg);
  g.applyMatrix4(mtx);
  const p = g.attributes.position, uvA = g.attributes.uv;
  const base = out.pos.length / 3;
  for (let i = 0; i < p.count; i++) { out.pos.push(p.getX(i), p.getY(i), p.getZ(i)); out.uv.push(uvA.getX(i), uvA.getY(i)); out.part.push(part); }
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i++) out.idx.push(base + ix[i]);
}

function finishGeo(out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(out.part, 1));
  g.setIndex(out.idx);
  g.computeVertexNormals();
  return g;
}

function lilyFlowerGeometry(r, { size = 1.0, pink = false }) {
  const out = { pos: [], uv: [], part: [], idx: [] };
  const m = new THREE.Matrix4();
  const S = size;
  const part = pink ? 7 : 6;
  const whorls = [
    { n: 8, L: 0.045, W: 0.017, tilt: 0.5, off: 0 },
    { n: 8, L: 0.055, W: 0.019, tilt: 0.95, off: 0.5 },
    { n: 8, L: 0.06, W: 0.021, tilt: 1.3, off: 0.25 },
  ];
  // centre
  latheInto(out, m.identity(), [[0.012 * S, 0], [0.014 * S, 0.012 * S], [0.008 * S, 0.016 * S], [0.0001, 0.017 * S]], 12, 1);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    const pos = new THREE.Vector3(Math.cos(a) * 0.011 * S, 0.012 * S, Math.sin(a) * 0.011 * S);
    const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.4));
    m.compose(pos.add(new THREE.Vector3(0, 0.006 * S, 0)), qq, new THREE.Vector3(1, 1, 1));
    boxInto(out, m, 0.0012 * S, 0.012 * S, 0.0012 * S, 4, 0.5);
  }
  whorls.forEach((wh) => {
    for (let k = 0; k < wh.n; k++) {
      const a = ((k + wh.off) / wh.n) * TAU + r.range(-0.08, 0.08);
      const pos = new THREE.Vector3(Math.cos(a) * 0.008 * S, 0.002 * S, Math.sin(a) * 0.008 * S);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a - Math.PI / 2);
      const qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -wh.tilt - r.range(-0.08, 0.08));
      m.compose(pos, qy.multiply(qt), new THREE.Vector3(1, 1, 1));
      petalInto(out, m, { L: wh.L * S, W: wh.W * S, cup: 0.6, bend: -0.25, nu: 6, nv: 3, part, shape: 0.9 });
    }
  });
  return finishGeo(out);
}

// tube along a polyline of points with per-point radius; appends to stem arrays
function stemInto(S, pts, radii, radial, aStem) {
  const n = pts.length;
  const base = S.pos.length / 3;
  const up = new THREE.Vector3(0, 1, 0);
  let prevN = null;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const t = new THREE.Vector3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    let nn = prevN ? prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize() : new THREE.Vector3().crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    prevN = nn;
    const bn = new THREE.Vector3().crossVectors(t, nn).normalize();
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const dx = nn.x * Math.cos(a) + bn.x * Math.sin(a), dy = nn.y * Math.cos(a) + bn.y * Math.sin(a), dz = nn.z * Math.cos(a) + bn.z * Math.sin(a);
      S.pos.push(p.x + dx * radii[i], p.y + dy * radii[i], p.z + dz * radii[i]);
      S.nrm.push(dx, dy, dz);
      S.uv.push(i / (n - 1), j / radial);
      S.aStem.push(aStem[0], aStem[1], aStem[2], aStem[3]);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = base + i * row + j, b = a + 1, c = a + row, d = c + 1;
    S.idx.push(a, c, b, b, c, d);
  }
}

export { planLotus } from './pond-lotusplan.js';

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
function leafMaterial(ctx, U, { floating = false, lily = false } = {}) {
  const uni = { ...U, uWaterYV: U.uWaterY, uLeak: LEAK_UNIFORM, uLeakCov: LEAK_COV, uLeakShot: LEAK_SHOT };
  const hooks = {
    uniforms: uni,
    vertexHead: /* glsl */ `
      attribute vec4 aInst;
      varying vec2 vLeafUv;
      varying vec4 vInst;
      ${SWAY_GLSL}
    `,
    vertexWorld: /* glsl */ `
      vLeafUv = uv; vInst = aInst;
      {
        #ifdef USE_INSTANCING
          vec3 org = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 org = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float hh = max(org.y - uWaterYV, 0.0);
        ${floating ? `
          wPos4.xz += vec2(sin(uTime * 0.11 + aInst.x * 30.0), cos(uTime * 0.09 + aInst.x * 17.0)) * 0.012;
          wPos4.y += sin(uTime * 0.7 + aInst.x * 50.0 + dot(org.xz, vec2(1.3, 0.7))) * 0.0015 * uv.x;
        ` : `
          wPos4.xyz += lotusSway(org.xz, hh, aInst.x);
          float rr = uv.x;
          wPos4.y += sin(uTime * 2.3 + aInst.x * 40.0 + uv.y * 12.566) * 0.0045 * rr * rr * uWindStrength;
        `}
      }
    `,
    fragHead: /* glsl */ `
      varying vec2 vLeafUv;
      varying vec4 vInst;
      float g_vein; float g_navel; float g_h; float g_top; float g_drop = 0.0;
      ${POND_GLSL}
      ${LEAK_GLSL}
    `,
    fragColor: lily ? /* glsl */ `
      {
        float rr = vLeafUv.x; float a = vLeafUv.y * 6.28318;
        float seed = vInst.x;
        vec2 lp = vec2(cos(a), sin(a)) * rr;
        bool top = gl_FrontFacing;
        g_top = top ? 1.0 : 0.0;
        // veins: radiating from the centre, palmate
        float va = a * 14.0 / 6.28318 + seed * 5.0;
        float dv = abs(fract(va) - 0.5) * 6.28318 / 14.0 * rr;
        // anti-aliased: widen by the pixel footprint, fade contrast (and the bump
        // below) once the vein is sub-pixel -> no dotted glints along the veins
        float fpxL = max(length(fwidth(lp)), 1e-5);
        float vAA = clamp(0.008 / fpxL, 0.0, 1.0);
        float vein = (1.0 - smoothstep(0.006 - fpxL * 0.5, 0.014 + fpxL, dv)) * smoothstep(0.05, 0.2, rr) * mix(0.3, 1.0, vAA);
        vec3 c0 = mix(vec3(0.050, 0.125, 0.032), vec3(0.100, 0.175, 0.042), vInst.y);
        // young reddish pads
        c0 = mix(c0, vec3(0.13, 0.05, 0.03), step(0.92, vInst.z) * 0.7);
        c0 *= 0.85 + 0.3 * (n_snoise(lp * 4.0 + seed * 9.0) * 0.5 + 0.5);
        vec3 cb = vec3(0.16, 0.05, 0.05);
        vec3 col = top ? c0 : cb;
        col = mix(col, col * 1.35 + vec3(0.01, 0.015, 0.0), vein * 0.4);
        // rim browning / reddish margin
        col = mix(col, vec3(0.13, 0.05, 0.02), smoothstep(0.9, 1.0, rr) * 0.5);
        // damage spots
        col = mix(col, vec3(0.10, 0.07, 0.02), smoothstep(0.75, 0.82, n_fbm(lp * 7.0 + seed * 3.0, 3) * 0.5 + 0.5) * vInst.y * 0.8);
        diffuseColor.rgb = col;
        g_vein = vein; g_navel = 0.0;
        g_h = -vein * 0.00028 * vAA * vAA;
      }
    ` : /* glsl */ `
      {
        float rr = vLeafUv.x; float a = vLeafUv.y * 6.28318;
        float seed = vInst.x; float age = vInst.y;
        vec2 lp = vec2(cos(a), sin(a)) * rr;
        bool top = gl_FrontFacing;
        g_top = top ? 1.0 : 0.0;
        const float NV = 21.0;
        // leaf-unit -> pixel footprint for anti-aliasing the fine veins
        float fpx = max(length(fwidth(lp)), 1e-5);
        float va = a * NV / 6.28318;
        float dv = abs(fract(va) - 0.5) * 6.28318 / NV * rr;
        float vw = 0.003 + 0.0035 * (1.0 - rr);
        float aa = clamp(vw / fpx, 0.0, 1.0);
        float vein = (1.0 - smoothstep(vw - fpx * 0.5, vw * 1.7 + fpx, dv)) * smoothstep(0.04, 0.09, rr) * mix(0.35, 1.0, aa);
        // dichotomous forks toward the margin
        float va2 = a * NV * 2.0 / 6.28318 + 0.5;
        float dv2 = abs(fract(va2) - 0.5) * 6.28318 / (NV * 2.0) * rr;
        float fork = smoothstep(0.45, 0.62, rr + n_snoise(lp * 3.0 + seed) * 0.05);
        float vein2 = (1.0 - smoothstep(vw * 0.55 - fpx * 0.5, vw * 1.3 + fpx, dv2)) * fork * mix(0.2, 1.0, clamp(vw * 0.6 / fpx, 0.0, 1.0));
        // areole network (faded when sub-pixel)
        vec2 wv = n_worley(lp * 46.0 + seed * 11.0);
        float netAA = 1.0 - smoothstep(0.004, 0.012, fpx);
        float net = (1.0 - smoothstep(0.0, 0.1, wv.y - wv.x)) * netAA;
        float navel = 1.0 - smoothstep(0.035, 0.06, rr);
        float halo = 1.0 - smoothstep(0.05, 0.22, rr);
        float ring = smoothstep(0.05, 0.065, rr) * (1.0 - smoothstep(0.07, 0.1, rr));
        float mott = n_fbm(lp * 2.5 + seed * 13.0, 3);
        // torn leaves: a ragged radial split widening toward the margin
        float tearM = 0.0;
        if (fract(seed * 7.31) > 0.8) {
          float a0 = fract(seed * 3.7) * 6.28318;
          float da = abs(mod(a - a0 + 3.14159, 6.28318) - 3.14159) * rr;
          float r0 = 0.3 + 0.45 * fract(seed * 11.3);
          float wdt = (rr - r0) * 0.2 + 0.012 * n_snoise(vec2(rr * 37.0, seed * 9.0));
          if (rr > r0 && da < wdt) discard;
          tearM = (1.0 - smoothstep(0.0, 0.035, da - wdt)) * step(r0 - 0.02, rr);
        }
        // insect bites / small holes on older leaves (ragged, browned rims)
        float holeM = 0.0;
        if (age > 0.25 && fract(seed * 5.13) > 0.55) {
          vec2 hw = n_worley(lp * 7.0 + seed * 19.0);
          float hr = 0.045 * age * (0.6 + 0.4 * n_snoise(lp * 31.0 + seed));
          if (hw.x < hr && rr > 0.15) discard;
          holeM = 1.0 - smoothstep(hr, hr + 0.06, hw.x);
        }
        // fine veinlets inside the areoles: only where they resolve (macro lens)
        vec2 wv2 = n_worley(lp * 140.0 + seed * 7.0);
        float net2 = (1.0 - smoothstep(0.0, 0.14, wv2.y - wv2.x)) * (1.0 - smoothstep(0.0015, 0.004, fpx));
        // waxy glaucous blue-green; the pale bloom keeps saturation low
        vec3 topCol = mix(vec3(0.044, 0.120, 0.056), vec3(0.068, 0.162, 0.068), mott * 0.5 + 0.5);
        topCol = mix(topCol, vec3(0.150, 0.150, 0.050), age * 0.6);
        vec3 botCol = mix(vec3(0.105, 0.160, 0.072), vec3(0.135, 0.190, 0.085), mott * 0.5 + 0.5);
        botCol = mix(botCol, vec3(0.17, 0.16, 0.06), age * 0.5);
        vec3 col = top ? topCol : botCol;
        col *= vInst.zzz * 0.25 + 0.85;
        if (top) {
          col = mix(col, col * 1.3 + vec3(0.03, 0.04, 0.025), vein * 0.55 + vein2 * 0.35);
          col *= 1.0 - net * 0.04 - net2 * 0.02;
          col = mix(col, col * 1.15 + vec3(0.02, 0.025, 0.01), halo * 0.6);
        } else {
          col = mix(col, vec3(0.22, 0.27, 0.13), vein * 0.75 + vein2 * 0.45);
          col *= 1.0 - net * 0.08;
        }
        col = mix(col, vec3(0.30, 0.31, 0.13), navel * 0.85);
        col *= 1.0 - ring * 0.25;
        // glaucous wax bloom on the upper side: a thin, neutral-white scattering
        // layer (papillae + wax crystals) that lifts and desaturates the green
        if (top) col += vec3(0.026, 0.033, 0.037) * (1.0 - age * 0.55) * (0.8 + 0.4 * (mott * 0.5 + 0.5)) * (1.0 - vein * 0.4);
        col = mix(col, vec3(0.16, 0.11, 0.04), max(tearM, holeM) * 0.7);
        // margin: yellow-brown on older leaves, slightly torn tone
        float rim = smoothstep(0.95 - age * 0.12, 1.0, rr + n_snoise(lp * 9.0 + seed) * 0.025);
        col = mix(col, vec3(0.20, 0.15, 0.045), rim * (0.25 + age * 0.75));
        // necrotic spots on older leaves
        float sp = smoothstep(0.74, 0.8, n_fbm(lp * 5.5 + seed * 5.0, 3) * 0.5 + 0.5) * age;
        col = mix(col, vec3(0.11, 0.075, 0.03), sp * 0.85);
        // water beads (lotus effect) + a puddle in the cup of some leaves
        g_drop = 0.0; float dh = 0.0;
        // (leaves with geometric beads, aInst.w = 0.5, skip the painted ones)
        if (top && abs(vInst.w - 0.5) > 0.2) {
          vec2 q = lp * 16.0 + seed * 7.3;
          vec2 cell = floor(q), f = fract(q);
          vec2 cc = n_hash22(cell) * 0.6 + 0.2;
          float dd = length(f - cc);
          float has = step(0.9, n_hash12(cell + 3.1)) * smoothstep(0.12, 0.2, rr) * (1.0 - smoothstep(0.85, 0.95, rr));
          float rad = 0.07 + 0.13 * n_hash12(cell + 7.7);
          float bead = has * (1.0 - smoothstep(rad * 0.8, rad, dd));
          dh = has * sqrt(max(rad * rad - dd * dd, 0.0)) / 16.0;
          float pud = step(0.62, fract(seed * 13.7)) * (1.0 - smoothstep(0.07, 0.1, rr + n_snoise(lp * 20.0 + seed) * 0.02));
          g_drop = max(bead, pud) * netAA;
          dh = max(dh, pud * 0.006);
          col *= 1.0 - g_drop * 0.25;
        }
        diffuseColor.rgb = col;
        g_vein = vein + vein2 * 0.6;
        g_navel = navel;
        g_h = dh * 0.3 * netAA + ((top ? -0.4 : 1.3) * (vein * 0.0009 + vein2 * 0.00045) + (net * 0.000015) * (top ? 1.0 : -1.0)) * clamp(0.004 / max(fpx, 1e-5), 0.0, 1.0);
      }
    `,
    fragRough: lily ? `roughnessFactor = mix(0.22, 0.5, vInst.y) + (1.0 - g_top) * 0.3;` : `roughnessFactor = mix(mix(0.52, 0.42, g_vein) + (1.0 - g_top) * 0.12, 0.08, g_drop);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 1.0);`,
    fragLight: /* glsl */ `
      #if NUM_DIR_LIGHTS > 0
      {
        vec3 Ld = directLight.direction;
        float shf = clamp(dot(directLight.color, vec3(1.0)) / max(dot(uSunColor, vec3(1.0)), 1e-4), 0.0, 1.0);
        float lk = ${lily ? '0.0' : '0.95'} * uLeak.w * lotusDapple(vWPos) * (1.0 - shf);
        if (lk > 0.002) {
          IncidentLight lkL = directLight;
          lkL.color = uSunColor * lk;
          PhysicalMaterial mLk = material;
          mLk.roughness = max(mLk.roughness, 0.34);
          RE_Direct(lkL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, mLk, reflectedLight);
        }
        vec3 sunC = directLight.color + uSunColor * lk;
        float back = max(dot(-normal, Ld), 0.0);
        float fwdS = pow(max(dot(-geometryViewDir, Ld), 0.0), 4.0);
        // smooth thickness variation (thinner toward the margin), veins and navel block light
        float tm = (0.8 + 0.25 * smoothstep(0.3, 1.0, vLeafUv.x)) * (0.92 + 0.08 * n_snoise(vec2(vLeafUv.x * 3.0, vLeafUv.y * 6.0) + vInst.x * 17.0));
        vec3 tcol = ${lily ? 'vec3(0.10, 0.16, 0.02)' : 'vec3(0.16, 0.30, 0.05)'} * (1.0 - g_vein * 0.7) * (1.0 - g_navel * 0.5) * tm;
        reflectedLight.directDiffuse += sunC * tcol * back * (0.25 + 1.3 * fwdS) * 0.28;
        // sky light diffusing through
        reflectedLight.indirectDiffuse += iblIrradiance * tcol * 0.06;
        // droplets: sun sparkle + sky sheen
        if (g_drop > 0.01) {
          float fr = 0.03 + 0.97 * pow(1.0 - max(dot(normal, geometryViewDir), 0.0), 5.0);
          reflectedLight.indirectSpecular += iblIrradiance * 0.12 * g_drop * (0.05 + fr);
        }
      }
      #endif
    `,
    fragEnd: UW_FRAGEND,
  };
  const m = ctx.mat.phys({
    color: 0xffffff, roughness: 0.5, metalness: 0, side: THREE.DoubleSide,
    sheen: lily ? 0.15 : (floating ? 0.35 : 0.55), sheenColor: new THREE.Color().setRGB(0.20, 0.27, 0.32), sheenRoughness: 0.42,
    specularIntensity: lily ? 0.8 : 0.45,
  }, hooks);
  const dm = ctx.mat.depthMaterialFor({ vertexHead: hooks.vertexHead + DEPTH_FIX, vertexWorld: hooks.vertexWorld });
  dm.side = THREE.DoubleSide;
  // depth material needs the shared uniforms too
  const prev = dm.onBeforeCompile;
  dm.onBeforeCompile = (sh, rr) => { prev(sh, rr); sh.uniforms.uWaterYV = uni.uWaterYV; };
  return { mat: m, depth: dm };
}

function flowerMaterial(ctx, U, { merged = false, macro = false } = {}) {
  const uni = { ...U, uWaterYV: U.uWaterY, uLeak: LEAK_UNIFORM, uLeakCov: LEAK_COV, uLeakShot: LEAK_SHOT };
  const defs = `${merged ? '#define LOTUS_MERGED\n' : ''}${macro ? '#define LOTUS_MACRO\n' : ''}`;
  const hooks = {
    uniforms: uni,
    vertexHead: /* glsl */ `
      ${defs}
      #ifdef LOTUS_MERGED
      attribute vec3 aOrg;
      #endif
      attribute vec4 aInst;
      attribute float aPart;
      attribute float aSeed;
      varying vec2 vPUv;
      varying vec4 vInst;
      varying float vPart;
      varying float vSeed;
      varying vec3 vLocal;
      ${SWAY_GLSL}
    `,
    vertexWorld: /* glsl */ `
      vPUv = uv; vInst = aInst; vPart = aPart; vSeed = aSeed; vLocal = position;
      {
        #if defined(LOTUS_MERGED)
          vec3 org = aOrg;
        #elif defined(USE_INSTANCING)
          vec3 org = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 org = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float hh = max(org.y - uWaterYV, 0.0);
        if (aInst.w > 0.5) {
          wPos4.xz += vec2(sin(uTime * 0.11 + aInst.x * 30.0), cos(uTime * 0.09 + aInst.x * 17.0)) * 0.012;
        } else {
          vec3 sw = lotusSway(org.xz, hh, aInst.x);
          #ifdef LOTUS_MACRO
            sw *= 0.35; // the macro flower sits in a sheltered pocket: barely breathing
          #endif
          wPos4.xyz += sw;
          // petals tremble very slightly (slow, sub-millimetre)
          float tip = (aPart < 0.5) ? uv.x * uv.x : 0.0;
          wPos4.xyz += vec3(sin(uTime * 1.3 + aInst.x * 20.0 + aSeed * 9.0), sin(uTime * 1.1 + aSeed * 13.0), cos(uTime * 1.2 + aInst.x * 9.0 + aSeed * 5.0)) * 0.0007 * tip * uWindStrength;
        }
      }
    `,
    fragHead: /* glsl */ `
      ${defs}
      varying vec2 vPUv;
      varying vec4 vInst;
      varying float vPart;
      varying float vSeed;
      varying vec3 vLocal;
      float g_trans; vec3 g_tcol; float g_h; float g_wet; float g_rough;
      ${POND_GLSL}
      ${LEAK_GLSL}
      ${DROP_GLSL}
      // anti-aliased periodic line: 1 on lines at integer x, width w (in periods)
      float f_lines(float x, float w){
        float fw = max(fwidth(x), 1e-4);
        float d = abs(fract(x + 0.5) - 0.5);
        float l = 1.0 - smoothstep(w - fw, w + fw, d);
        return mix(l, w * 2.0, smoothstep(0.18, 0.45, fw)); // sub-pixel: fade to the mean
      }
    `,
    fragColor: /* glsl */ `
      {
        float part = floor(vPart + 0.5);
        float u = vPUv.x, v = vPUv.y;
        vec3 col; g_trans = 0.0; g_tcol = vec3(0.0); g_h = 0.0; g_wet = 0.0; g_rough = 0.5;
        float seed = vInst.x;
        if (part < 0.5) {
          // ---- lotus petal --------------------------------------------------
          float hue = vInst.z;           // 0 pale .. 1 deep
          float ps = fract(vSeed);       // per-petal random
          float whorl = floor(vSeed);
          float edge = abs(v);
          float tpos = clamp(u * 0.9 + edge * edge * 0.28 * u, 0.0, 1.0);
          float hp = clamp(hue + (ps - 0.5) * 0.18 - whorl * 0.04, 0.0, 1.0);
          vec3 baseC = vec3(0.78, 0.78, 0.46);
          vec3 bodyC = mix(vec3(0.93, 0.90, 0.89), vec3(0.91, 0.70, 0.79), hp);
          vec3 tipC = mix(vec3(0.89, 0.42, 0.62), vec3(0.72, 0.11, 0.38), hp);
          // ~34 fine longitudinal veins converging at base and tip (v is width-normalised),
          // a finer anastomosing set between them
          float wob = n_snoise(vec2(u * 3.0, ps * 17.0 + seed * 5.0)) * 0.35;
          float vx = v * 17.0 + wob + ps * 3.0;
          // each vein has its own strength that drifts along its length (some fade out,
          // some run strong to the tip): breaks the regular corduroy look up close
          float vStr = smoothstep(-0.7, 0.75, n_snoise(vec2(floor(vx + 0.5) * 0.73 + ps * 13.0, u * 1.8 + seed * 3.0)));
          float veins = f_lines(vx, 0.1) * smoothstep(0.04, 0.22, u) * (0.3 + 0.7 * vStr);
          float vx2 = v * 34.0 + wob * 2.3 + n_snoise(vec2(u * 9.0, v * 3.0 + ps * 9.0)) * 0.45;
          float vStr2 = smoothstep(-0.5, 0.9, n_snoise(vec2(floor(vx2 + 0.5) * 0.61 + ps * 7.0, u * 2.6 - seed)));
          float veins2 = f_lines(vx2, 0.07) * smoothstep(0.1, 0.4, u) * 0.6 * vStr2;
          float pink = smoothstep(0.48 - 0.26 * hp, 1.06, tpos) * (0.72 + 0.28 * hp);
          // pigment concentrates along the veins and the margin as the flush fades out
          float flush = smoothstep(0.12, 0.62, tpos) * (1.0 - pink);
          float pinkV = clamp(pink + flush * (veins * 0.55 + veins2 * 0.3) * (0.4 + 0.6 * hp) + smoothstep(0.7, 1.0, edge) * smoothstep(0.25, 0.8, u) * 0.22, 0.0, 1.0);
          col = mix(baseC, bodyC, smoothstep(0.02, 0.28, tpos));
          col = mix(col, tipC, pinkV);
          // soft blotchy pigment variation (cell clusters), mid-frequency
          float bl = n_fbm(vec2(u * 6.0, v * 2.4) + ps * 11.0 + seed * 3.0, 3);
          col *= 0.94 + 0.1 * bl;
          col = mix(col, col * vec3(0.96, 0.86, 0.9), smoothstep(0.2, 0.6, bl) * pink * 0.4);
          // faint greenish blush on the outer whorl near the base, browning at the very tip
          col = mix(col, vec3(0.62, 0.72, 0.42), (1.0 - smoothstep(0.0, 0.35, u)) * step(whorl, 0.5) * 0.35);
          col = mix(col, col * vec3(0.7, 0.55, 0.5), smoothstep(0.955, 1.0, u) * (0.3 + 0.3 * ps));
          g_trans = 1.0;
          g_tcol = mix(vec3(1.0, 0.87, 0.64), vec3(1.0, 0.45, 0.64), smoothstep(0.15, 0.9, tpos)) * (1.0 - veins * 0.18);
          g_h = (veins * 0.00005 + veins2 * 0.00002);
          g_rough = 0.46 - 0.06 * pink;
        } else if (part < 1.5) {
          // receptacle top: yellow-green disc
          col = mix(vec3(0.60, 0.62, 0.13), vec3(0.42, 0.54, 0.09), vInst.y);
          #ifdef LOTUS_MACRO
            col = mix(vec3(0.74, 0.72, 0.18), vec3(0.56, 0.64, 0.13), vInst.y); // fresh, pollen-dusted disc
            float rr = length(vLocal.xz);
            col *= 0.9 + 0.12 * n_snoise(vLocal.xz * 900.0 + seed * 3.0);
            col = mix(col, col * 0.78, smoothstep(0.012, 0.018, rr));
            g_h = n_snoise(vLocal.xz * 700.0) * 0.00004;
          #else
            vec2 wv = n_worley(vLocal.xz * 240.0 + seed * 3.0);
            float carpel = 1.0 - smoothstep(0.16, 0.27, wv.x);
            float pit = 1.0 - smoothstep(0.04, 0.09, wv.x);
            col = mix(col, vec3(0.80, 0.66, 0.14), carpel * 0.55);
            col = mix(col, vec3(0.25, 0.22, 0.04), pit * 0.7);
            g_h = carpel * 0.0005 - pit * 0.0004;
          #endif
          g_trans = 0.25; g_tcol = vec3(0.7, 0.75, 0.2);
          g_rough = 0.5;
        } else if (part < 2.5) {
          // receptacle side: green with fine ribbing, yellow rim
          float rib = f_lines(atan(vLocal.z, vLocal.x) * 7.0, 0.15);
          col = mix(vec3(0.60, 0.58, 0.14), vec3(0.25, 0.33, 0.06), smoothstep(0.015, -0.012, vLocal.y));
          col = mix(col, vec3(0.32, 0.40, 0.07), vInst.y * 0.6);
          col *= 1.0 - rib * 0.12;
          g_trans = 0.3; g_tcol = vec3(0.6, 0.7, 0.2);
          g_rough = 0.52;
        } else if (part < 3.5) {
          // filament: cream-yellow, translucent
          col = mix(vec3(0.88, 0.80, 0.46), vec3(0.92, 0.86, 0.6), vSeed);
          g_trans = 0.55; g_tcol = vec3(1.0, 0.88, 0.4);
          g_rough = 0.45;
        } else if (part < 4.5) {
          // anther: golden-orange, two pollen sacs (longitudinal slits), dusty
          float ang = vPUv.y * 6.28318;
          float slit = f_lines(vPUv.y * 2.0, 0.08);
          col = mix(vec3(0.96, 0.63, 0.10), vec3(0.98, 0.74, 0.18), vSeed) * (0.92 + 0.16 * sin(ang * 2.0));
          col = mix(col, vec3(0.62, 0.36, 0.05), slit * 0.5);
          g_trans = 0.45; g_tcol = vec3(1.0, 0.75, 0.2);
          g_rough = 0.62;
        } else if (part < 5.5) {
          col = mix(vec3(0.16, 0.22, 0.06), vec3(0.45, 0.20, 0.22), smoothstep(0.3, 1.0, u));
          g_trans = 0.6; g_tcol = vec3(0.5, 0.6, 0.15);
        } else if (part < 7.5) {
          // water lily petals (white or pink), yellow at the base, fine veins
          vec3 pc = part < 6.5 ? vec3(0.90, 0.90, 0.85) : vec3(0.88, 0.46, 0.63);
          col = mix(vec3(0.86, 0.76, 0.36), pc, smoothstep(0.0, 0.28, u));
          float vv = f_lines(v * 6.0, 0.08) * smoothstep(0.1, 0.4, u);
          col *= 1.0 - vv * 0.08;
          col = mix(col, col * vec3(0.92, 0.95, 0.85), (1.0 - smoothstep(0.0, 0.5, u)) * 0.3);
          g_trans = 1.0; g_tcol = part < 6.5 ? vec3(1.0, 0.95, 0.8) : vec3(1.0, 0.5, 0.65);
          g_h = vv * 0.00003;
          g_rough = 0.4;
        } else if (part < 8.5) {
          // seed pod top: seeds sunk in round pits
          vec2 wv = n_worley(vLocal.xz * 105.0 + seed * 5.0);
          float hole = 1.0 - smoothstep(0.22, 0.32, wv.x);
          float seedC = 1.0 - smoothstep(0.1, 0.17, wv.x);
          col = mix(vec3(0.30, 0.40, 0.09), vec3(0.36, 0.30, 0.10), vInst.y * 0.7);
          col = mix(col, vec3(0.10, 0.12, 0.03), hole * 0.85);
          col = mix(col, vec3(0.20, 0.30, 0.07), seedC * 0.9);
          g_h = -hole * 0.0012 + seedC * 0.0008;
          g_trans = 0.15; g_tcol = vec3(0.6, 0.7, 0.2);
        } else if (part < 9.5) {
          float rib = abs(fract(atan(vLocal.z, vLocal.x) * 3.5) - 0.5);
          col = mix(vec3(0.16, 0.26, 0.06), vec3(0.30, 0.38, 0.09), smoothstep(-0.02, 0.03, vLocal.y));
          col *= 0.9 + 0.2 * smoothstep(0.1, 0.4, rib);
          col = mix(col, vec3(0.28, 0.22, 0.08), vInst.y * 0.4);
          g_trans = 0.2; g_tcol = vec3(0.5, 0.6, 0.15);
        } else if (part < 10.5) {
          col = vec3(0.22, 0.13, 0.05);
          g_trans = 0.2; g_tcol = vec3(0.6, 0.4, 0.15);
        } else if (part < 11.5) {
          // anther appendage: pale cream club
          col = vec3(0.93, 0.91, 0.78);
          g_trans = 0.5; g_tcol = vec3(1.0, 0.95, 0.8);
          g_rough = 0.5;
        } else if (part < 12.5) {
          // stigma nub: yellow, glossy (receptive, slightly wet) tip on a greener base
          col = mix(vec3(0.42, 0.50, 0.10), vec3(0.90, 0.74, 0.18), smoothstep(0.2, 0.85, v));
          g_trans = 0.3; g_tcol = vec3(0.9, 0.8, 0.2);
          g_rough = mix(0.5, 0.22, smoothstep(0.5, 0.95, v));
        } else {
          // dew drop (what lies behind shows through, faintly)
          col = vec3(0.10, 0.09, 0.09);
          g_wet = 1.0; g_rough = 0.04;
        }
        diffuseColor.rgb = col;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = g_rough;`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 1.0);`,
    fragLight: /* glsl */ `
      #if NUM_DIR_LIGHTS > 0
      {
        vec3 Ld = directLight.direction;
        // dappled sun breaking through where the hero bed lies in shadow
        float shf = clamp(dot(directLight.color, vec3(1.0)) / max(dot(uSunColor, vec3(1.0)), 1e-4), 0.0, 1.0);
        #ifdef LOTUS_MERGED
          float lk = uLeak.w * max(lotusDapple(vWPos), 0.9 * lotusLeakOn()) * (1.0 - shf);
        #else
          float lk = uLeak.w * lotusDapple(vWPos) * (1.0 - shf);
        #endif
        if (lk > 0.002) {
          IncidentLight lkL = directLight;
          lkL.color = uSunColor * lk;
          RE_Direct(lkL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
        }
        vec3 sunC = directLight.color + uSunColor * lk;
        float back = max(dot(-normal, Ld), 0.0);
        float wrap = max(dot(normal, Ld) * 0.5 + 0.5, 0.0);
        float fwdS = pow(max(dot(-geometryViewDir, Ld), 0.0), 3.0);
        vec3 c = diffuseColor.rgb;
        reflectedLight.directDiffuse += sunC * c * g_tcol * g_trans * (back * (0.45 + 1.4 * fwdS) + wrap * 0.12) * 0.42;
        reflectedLight.indirectDiffuse += iblIrradiance * c * g_tcol * g_trans * 0.16;
        if (g_wet > 0.5) {
          // drop: sunlight focused onto the side away from the sun (caustic glow)
          float caus = pow(max(dot(normal, -Ld) * 0.5 + 0.5, 0.0), 6.0);
          reflectedLight.directDiffuse += sunC * vec3(1.0, 0.9, 0.85) * caus * 0.5;
          // clear drop: the world behind it, refracted (inverted) through the lens of
          // water, and the sun focused toward the eye when it lies behind the drop
          vec3 Nd = normalize(normal);
          float NoVd = clamp(dot(Nd, geometryViewDir), 0.0, 1.0);
          float Fd = 0.02 + 0.98 * pow(1.0 - NoVd, 5.0);
          float prD = 1.0 / max(length(fwidth(Nd)), 2e-3);
          vec3 T2 = dropExit(Nd, geometryViewDir);
          float bodyD = smoothstep(0.1, 0.45, NoVd);
          #ifdef USE_ENVMAP
            if (dot(T2, T2) > 1e-4) {
              vec3 Tn = normalize(T2);
              reflectedLight.indirectSpecular += getIBLRadiance(Tn, Tn, clamp(1.2 / prD, 0.1, 0.6)) * (1.0 - Fd) * bodyD * 0.75;
            }
          #endif
          reflectedLight.indirectDiffuse += iblIrradiance * 0.08;
          vec3 Lvd = normalize((viewMatrix * vec4(normalize(uSunDir), 0.0)).xyz);
          reflectedLight.directSpecular += sunC * vec3(1.0, 0.95, 0.85) * dropSunThrough(T2, Lvd, prD) * 0.85 * bodyD;
        }
      }
      #endif
    `,
    fragEnd: UW_FRAGEND,
  };
  const m = ctx.mat.phys({ color: 0xffffff, roughness: 0.45, metalness: 0, side: THREE.DoubleSide, sheen: 0.18, sheenColor: new THREE.Color().setRGB(0.55, 0.48, 0.52), sheenRoughness: 0.55, specularIntensity: 0.45 }, hooks);
  const dm = ctx.mat.depthMaterialFor({ vertexHead: hooks.vertexHead + DEPTH_FIX, vertexWorld: hooks.vertexWorld });
  dm.side = THREE.DoubleSide;
  const prev = dm.onBeforeCompile;
  dm.onBeforeCompile = (sh, rr) => { prev(sh, rr); sh.uniforms.uWaterYV = uni.uWaterYV; };
  return { mat: m, depth: dm };
}

function stemMaterial(ctx, U) {
  const uni = { ...U, uWaterYV: U.uWaterY, uLeak: LEAK_UNIFORM, uLeakCov: LEAK_COV, uLeakShot: LEAK_SHOT };
  const hooks = {
    uniforms: uni,
    vertexHead: /* glsl */ `
      attribute vec4 aStem;
      varying vec2 vSUv;
      ${SWAY_GLSL}
    `,
    vertexWorld: /* glsl */ `
      vSUv = uv;
      {
        float t = uv.x;
        float flex = t * t * (3.0 - 2.0 * t);
        wPos4.xyz += lotusSway(aStem.xy, aStem.z, aStem.w) * flex;
      }
    `,
    fragHead: /* glsl */ `
      varying vec2 vSUv;
      float g_h;
      ${POND_GLSL}
      ${LEAK_GLSL}
    `,
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float n = n_snoise3(wp * vec3(40.0, 4.0, 40.0));
        vec3 col = mix(vec3(0.075, 0.125, 0.035), vec3(0.13, 0.165, 0.045), n * 0.5 + 0.5);
        // brownish towards the waterline
        col = mix(vec3(0.07, 0.06, 0.025), col, smoothstep(0.0, 0.2, wp.y - uWaterY));
        // tiny prickles
        float pr = smoothstep(0.75, 0.95, n_snoise3(wp * 260.0));
        col = mix(col, vec3(0.12, 0.08, 0.04), pr * 0.6);
        diffuseColor.rgb = col;
        g_h = pr * 0.0003 + n * 0.00005;
      }
    `,
    fragRough: `roughnessFactor = 0.5;`,
    fragNormal: `normal = n_bumpView(-vViewPosition, normal, g_h, 1.0);`,
    fragLight: /* glsl */ `
      #if NUM_DIR_LIGHTS > 0
      {
        float shf = clamp(dot(directLight.color, vec3(1.0)) / max(dot(uSunColor, vec3(1.0)), 1e-4), 0.0, 1.0);
        float lk = 0.9 * uLeak.w * lotusDapple(vWPos) * (1.0 - shf);
        if (lk > 0.002) {
          IncidentLight lkL = directLight;
          lkL.color = uSunColor * lk;
          RE_Direct(lkL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
        }
        float back = max(dot(-normal, directLight.direction), 0.0);
        reflectedLight.directDiffuse += (directLight.color + uSunColor * lk) * vec3(0.08, 0.11, 0.02) * back * 0.4;
      }
      #endif
    `,
    fragEnd: UW_FRAGEND,
  };
  const m = ctx.mat.phys({ color: 0xffffff, roughness: 0.55, metalness: 0, sheen: 0.15, sheenColor: new THREE.Color().setRGB(0.2, 0.22, 0.2), sheenRoughness: 0.5, specularIntensity: 0.6 }, hooks);
  const dm = ctx.mat.depthMaterialFor({ vertexHead: hooks.vertexHead + DEPTH_FIX, vertexWorld: hooks.vertexWorld });
  const prev = dm.onBeforeCompile;
  dm.onBeforeCompile = (sh, rr) => { prev(sh, rr); sh.uniforms.uWaterYV = uni.uWaterYV; };
  return { mat: m, depth: dm };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
export function buildLotus(ctx, site, U, plan) {
  const r = ctx.rng('pond-lotus-geo');
  const waterY = site.waterY;
  const group = new THREE.Group();
  group.name = 'pondLotus';
  const leafM = leafMaterial(ctx, U, { floating: false });
  const leafFM = leafMaterial(ctx, U, { floating: true });
  const lilyM = leafMaterial(ctx, U, { floating: true, lily: true });
  const flowerM = flowerMaterial(ctx, U);
  const flowerHeroM = flowerMaterial(ctx, U, { merged: true });
  const flowerMacroM = flowerMaterial(ctx, U, { merged: true, macro: true });
  const beads = [];
  const stemM = stemMaterial(ctx, U);

  // ---- leaf variants -------------------------------------------------------
  const eVariants = [
    { cup: 0.33, wave: 0.085, droop: 0.05, ruffle: 0.032, nR: 11, lip: 0.02 },
    { cup: 0.42, wave: 0.065, droop: 0.14, ruffle: 0.026, nR: 9, lip: 0.035 },
    { cup: 0.25, wave: 0.11, droop: 0.06, ruffle: 0.04, nR: 13, lip: 0.0 },
    { cup: 0.3, wave: 0.06, droop: 0.28, ruffle: 0.03, nR: 10, fold: 0.2, lip: 0.02 },
  ];
  const geoHi = eVariants.map((v) => leafGeometry(r, { ...v, seg: 56, rings: 11 }));
  const geoLo = eVariants.map((v) => leafGeometry(r, { ...v, seg: 30, rings: 6 }));
  const geoMacro = eVariants.map((v) => leafGeometry(r, { ...v, seg: 104, rings: 22 }));
  const geoF = [leafGeometry(r, { seg: 30, rings: 4, floating: true, wave: 0.04 }), leafGeometry(r, { seg: 30, rings: 4, floating: true, wave: 0.06 })];
  const geoFHero = leafGeometry(r, { seg: 112, rings: 22, floating: true, wave: 0.05 });
  const geoLily = [lilyPadGeometry(r), lilyPadGeometry(r), lilyPadGeometry(r)];

  const meshes = [];
  const tmpM = new THREE.Matrix4(), tq = new THREE.Quaternion(), tp = new THREE.Vector3(), ts = new THREE.Vector3();
  const qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  function makeInst(geo, mats, list, name, matFn) {
    if (!list.length) return null;
    const g = geo.clone();
    const inst = new Float32Array(list.length * 4);
    const im = new THREE.InstancedMesh(g, mats.mat, list.length);
    list.forEach((p, i) => {
      const m = matFn(p, i, inst);
      im.setMatrixAt(i, m);
    });
    g.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    im.instanceMatrix.needsUpdate = true;
    im.customDepthMaterial = mats.depth;
    im.castShadow = true; im.receiveShadow = true;
    im.name = name;
    im.computeBoundingSphere();
    im.computeBoundingBox && im.computeBoundingBox();
    group.add(im);
    meshes.push(im);
    return im;
  }

  // stems collected for all emergent things
  const S = { pos: [], nrm: [], uv: [], aStem: [], idx: [] };
  const stemTop = (p) => new THREE.Vector3(p.x, waterY + p.h, p.z);
  function addStem(p, top, radius, seed, segs, dir = null, radial = 5) {
    // base under water, offset; gentle S-curve, approach along the head's axis
    const baseOff = r.range(0.08, 0.3), ba = r.range(0, TAU);
    const base = new THREE.Vector3(p.x + Math.cos(ba) * baseOff, waterY - 0.45, p.z + Math.sin(ba) * baseOff);
    const mid = new THREE.Vector3().lerpVectors(base, top, 0.55);
    mid.x += r.range(-0.07, 0.07); mid.z += r.range(-0.07, 0.07);
    const d = dir ? dir.clone().normalize() : new THREE.Vector3(r.range(-0.17, 0.17), 1, r.range(-0.17, 0.17)).normalize();
    const near = top.clone().addScaledVector(d, -0.12);
    const curve = new THREE.CatmullRomCurve3([base, mid, near, top]);
    const pts = curve.getPoints(segs);
    const radii = pts.map((q, i) => radius * (1.12 - 0.25 * (i / segs)));
    // uv.x along the stem gives flex; sway amplitude uses the head's height
    stemInto(S, pts, radii, radial, [p.x, p.z, p.macro ? p.h * 0.35 : p.h, seed]);
  }

  // emergent leaves
  const eLists = { mac: [[], [], [], []], hi: [[], [], [], []], lo: [[], [], [], []] };
  for (const p of plan.leavesE) (p.heroLeaf ? eLists.mac : p.hero ? eLists.hi : eLists.lo)[p.variant % 4].push(p);
  const leafMatrix = (p, i, inst) => {
    const seed = r.float();
    p.seed = seed;
    inst[i * 4] = seed; inst[i * 4 + 1] = p.age ?? 0; inst[i * 4 + 2] = r.range(0.6, 1.4) * 0.5 + 0.25; inst[i * 4 + 3] = p.beads && p.heroLeaf ? 0.5 : 0;
    qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
    const td = p.tiltDir ?? 0;
    qTilt.setFromAxisAngle(new THREE.Vector3(-Math.sin(td), 0, Math.cos(td)), -(p.tilt ?? 0));
    tq.copy(qTilt).multiply(qYaw);
    p._q = tq.clone();
    tp.set(p.x, waterY + p.h, p.z);
    const s = p.rad;
    ts.set(s, s * r.range(0.9, 1.15), s);
    p._m = tmpM.compose(tp, tq, ts).clone();
    return p._m;
  };
  for (let v = 0; v < 4; v++) {
    makeInst(geoMacro[v], leafM, eLists.mac[v], `lotusLeafMacro${v}`, leafMatrix);
    makeInst(geoHi[v], leafM, eLists.hi[v], `lotusLeafHi${v}`, leafMatrix);
    makeInst(geoLo[v], leafM, eLists.lo[v], `lotusLeafLo${v}`, leafMatrix);
  }
  // water beads on the macro leaves
  {
    const rb = ctx.rng('pond-lotus-beads');
    for (let v = 0; v < 4; v++) for (const p of eLists.mac[v]) {
      if (!p.beads || !p._m) continue;
      const list = sampleBeads(rb, geoMacro[v], p._m, { count: rb.int(3, 11), big: rb.chance(0.75) ? 1 : 0, rad: p.rad });
      for (const b of list) beads.push({ ...b, org: [p.x, p.z, p.h, p.seed], floating: false });
    }
  }
  for (const p of plan.leavesE) {
    const top = stemTop(p);
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(p._q).lerp(new THREE.Vector3(0, 1, 0), 0.35);
    addStem(p, top, 0.0058 * (0.8 + p.rad), p.seed, p.heroLeaf ? 12 : (p.hero ? 9 : 6), dir, p.heroLeaf ? 7 : 5);
  }
  // floating leaves
  const fLists = [[], []], fHero = [];
  for (const p of plan.leavesF) (p.heroPad ? fHero : fLists[p.variant % 2]).push(p);
  const floatMatrix = (p, i, inst) => {
    inst[i * 4] = r.float(); inst[i * 4 + 1] = p.age ?? 0; inst[i * 4 + 2] = r.range(0.5, 1.0); inst[i * 4 + 3] = p.heroPad ? 0.5 : 1;
    tq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
    tp.set(p.x, waterY + 0.008, p.z);
    ts.set(p.rad, p.rad, p.rad);
    p.seed = inst[i * 4];
    p._m = tmpM.compose(tp, tq, ts).clone();
    return p._m;
  };
  fLists.forEach((l, k) => makeInst(geoF[k], leafFM, l, `lotusLeafFloat${k}`, floatMatrix));
  makeInst(geoFHero, leafFM, fHero, 'lotusLeafFloatHero', floatMatrix);
  {
    const rb = ctx.rng('pond-pad-beads');
    for (const p of fHero) {
      // hero pad: a heavy rolling drop or two in the shallow cup plus a scatter of beads
      const list = sampleBeads(rb, geoFHero, p._m, { count: 30, big: 2, rad: p.rad * 1.5, floating: true });
      for (const b of list) beads.push({ ...b, org: [p.x, p.z, 0, p.seed], floating: true });
    }
  }
  // lily pads
  const lLists = [[], [], []];
  for (const p of plan.lilies) lLists[p.variant % 3].push(p);
  for (const p of plan.lilyFlowers) lLists[r.int(0, 2)].push({ ...p, rad: p.rad * 1.05 });
  const lilyMatrix = (p, i, inst) => {
    inst[i * 4] = r.float(); inst[i * 4 + 1] = p.age ?? 0; inst[i * 4 + 2] = r.float(); inst[i * 4 + 3] = 1;
    tq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
    tp.set(p.x, waterY + 0.004 + r.range(0, 0.002), p.z);
    ts.set(p.rad, p.rad, p.rad);
    return tmpM.compose(tp, tq, ts).clone();
  };
  lLists.forEach((l, k) => makeInst(geoLily[k], lilyM, l, `lilyPad${k}`, lilyMatrix));

  // ---- flowers -------------------------------------------------------------------
  // instanced variants for the colonies; every hero flower of the macro shot is
  // a unique geometry (merged into one mesh with per-vertex sway origins)
  const HS = 1.3;
  const V = {
    openHi: [lotusFlower(r, { open: 1.0, hi: true, S: HS }), lotusFlower(r, { open: 0.78, hi: true, S: HS }),
      lotusFlower(r, { open: 0.9, hi: true, S: HS, petalScale: 1.05 }), lotusFlower(r, { open: 0.64, hi: true, S: HS, petalScale: 0.96 })],
    openLo: [lotusFlower(r, { open: 0.97, hi: false, S: HS }), lotusFlower(r, { open: 0.72, hi: false, S: HS }),
      lotusFlower(r, { open: 0.86, hi: false, S: HS, petalScale: 1.08 }), lotusFlower(r, { open: 0.6, hi: false, S: HS, petalScale: 0.94 })],
    halfHi: lotusFlower(r, { open: 0.42, hi: true, S: HS }),
    halfHi2: lotusFlower(r, { open: 0.3, hi: true, S: HS, petalScale: 1.04 }),
    halfLo: [lotusFlower(r, { open: 0.42, hi: false, S: HS }), lotusFlower(r, { open: 0.3, hi: false, S: HS, petalScale: 1.05 })],
    budHi: lotusFlower(r, { open: 0.04, hi: true, S: HS * 0.95 }),
    budLo: [lotusFlower(r, { open: 0.04, hi: false, S: HS * 0.95 }), lotusFlower(r, { open: 0.13, hi: false, S: HS * 0.9 })],
    spentHi: lotusSpent(r, { hi: true, S: HS, petalsLeft: 2, age: 0.3 }),
    spentLo: lotusSpent(r, { hi: false, S: HS, petalsLeft: 2, age: 0.3 }),
    podLo: lotusSpent(r, { hi: false, S: HS, petalsLeft: 0, age: 0.9 }),
    lilyW: lilyFlowerGeometry(r, { pink: false }),
    lilyP: lilyFlowerGeometry(r, { pink: true }),
  };
  const fl = { openHi0: [], openHi1: [], openHi2: [], openHi3: [], openLo0: [], openLo1: [], openLo2: [], openLo3: [], halfHi: [], halfHi2: [], halfLo0: [], halfLo1: [], budHi: [], budLo0: [], budLo1: [], spentHi: [], spentLo: [], podLo: [], lilyW: [], lilyP: [] };
  const heroList = [];
  for (const p of [...plan.flowers, ...plan.buds, ...plan.pods]) {
    if (p.isHeroFlower) { heroList.push(p); continue; }
    if (p.kind === 'buds') (p.hero ? fl.budHi : (p.open > 0.07 ? fl.budLo1 : fl.budLo0)).push(p);
    else if (p.kind === 'pods') { if (p.petalsLeft > 0) (p.hero ? fl.spentHi : fl.spentLo).push(p); else fl.podLo.push(p); }
    else if (p.open < 0.55) (p.hero ? (p.open < 0.43 ? fl.halfHi2 : fl.halfHi) : (p.open < 0.45 ? fl.halfLo1 : fl.halfLo0)).push(p);
    else if (p.hero) fl[`openHi${p.open > 0.92 ? 0 : p.open > 0.82 ? 2 : p.open > 0.7 ? 1 : 3}`].push(p);
    else fl[`openLo${p.open > 0.9 ? 0 : p.open > 0.78 ? 2 : p.open > 0.66 ? 1 : 3}`].push(p);
  }
  for (const p of plan.lilyFlowers) (p.pink ? fl.lilyP : fl.lilyW).push(p);

  const AY = new THREE.Vector3(0, 1, 0);
  function flowerPose(p) {
    qYaw.setFromAxisAngle(AY, p.yaw ?? 0);
    let ax;
    if (p.faceTo !== undefined) ax = new THREE.Vector3(Math.sin(p.faceTo), 0, -Math.cos(p.faceTo));
    else { const td = r.range(0, TAU); ax = new THREE.Vector3(Math.cos(td), 0, Math.sin(td)); }
    qTilt.setFromAxisAngle(ax, p.tilt ?? 0);
    const q = new THREE.Quaternion().copy(qTilt).multiply(qYaw);
    const pos = new THREE.Vector3(p.x, waterY + (p.floating ? 0.006 : p.h), p.z);
    const s = p.size ?? 1;
    p._q = q; p._s = s;
    // slight per-plant proportions so instanced variants do not read as clones
    const jx = r.range(-0.07, 0.07), jy = r.range(-0.09, 0.09), jz = r.range(-0.07, 0.07);
    return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s * (1 + jx), s * (1 + jy), s * (1 + jz)));
  }
  const flowerInst = (p) => {
    const seed = r.float(); p.seed = seed;
    return [seed, r.float(), p.hue ?? r.range(0.15, 0.9), p.floating ? 1 : 0];
  };
  const flowerMatrix = (p, i, inst) => {
    const a = flowerInst(p);
    inst.set(a, i * 4);
    return flowerPose(p);
  };
  for (let k = 0; k < 4; k++) makeInst(V.openHi[k], flowerM, fl[`openHi${k}`], `lotusFlowerHi${k}`, flowerMatrix);
  makeInst(V.halfHi2, flowerM, fl.halfHi2, 'lotusHalfHi2', flowerMatrix);
  for (let k = 0; k < 4; k++) makeInst(V.openLo[k], flowerM, fl[`openLo${k}`], `lotusFlowerLo${k}`, flowerMatrix);
  makeInst(V.halfHi, flowerM, fl.halfHi, 'lotusHalfHi', flowerMatrix);
  makeInst(V.halfLo[0], flowerM, fl.halfLo0, 'lotusHalfLo0', flowerMatrix);
  makeInst(V.halfLo[1], flowerM, fl.halfLo1, 'lotusHalfLo1', flowerMatrix);
  makeInst(V.budHi, flowerM, fl.budHi, 'lotusBudHi', flowerMatrix);
  makeInst(V.budLo[0], flowerM, fl.budLo0, 'lotusBudLo0', flowerMatrix);
  makeInst(V.budLo[1], flowerM, fl.budLo1, 'lotusBudLo1', flowerMatrix);
  makeInst(V.spentHi, flowerM, fl.spentHi, 'lotusSpentHi', flowerMatrix);
  makeInst(V.spentLo, flowerM, fl.spentLo, 'lotusSpentLo', flowerMatrix);
  makeInst(V.podLo, flowerM, fl.podLo, 'lotusPod', flowerMatrix);
  makeInst(V.lilyW, flowerM, fl.lilyW, 'lilyFlowerW', flowerMatrix);
  makeInst(V.lilyP, flowerM, fl.lilyP, 'lilyFlowerP', flowerMatrix);

  // hero flowers: unique geometry each, merged
  if (heroList.length) {
    const geos = [];
    for (const p of heroList) {
      const g = p.kind === 'pods'
        ? lotusSpent(r, { hi: true, S: HS, petalsLeft: p.petalsLeft ?? 3, age: 0.45 })
        : lotusFlower(ctx.rng(p.macro ? 'pond-macro-flower' : 'pond-hero-' + heroList.indexOf(p)), { open: p.kind === 'buds' ? (p.open ?? 0.04) : p.open, hi: true, macro: !!p.macro, dew: p.macro ? 9 : 0, S: p.kind === 'buds' ? HS * 0.95 : HS });
      g.applyMatrix4(flowerPose(p));
      const n = g.attributes.position.count;
      const a = flowerInst(p);
      const inst = new Float32Array(n * 4), org = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { inst.set(a, k * 4); org[k * 3] = p.x; org[k * 3 + 1] = waterY + p.h; org[k * 3 + 2] = p.z; }
      g.setAttribute('aInst', new THREE.BufferAttribute(inst, 4));
      g.setAttribute('aOrg', new THREE.BufferAttribute(org, 3));
      if (p.macro) {
        // the macro flower: its own mesh / material (sculpted carpels, dew, calmer sway)
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, flowerMacroM.mat);
        mesh.customDepthMaterial = flowerMacroM.depth;
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.name = 'lotusMacroFlower';
        group.add(mesh);
        continue;
      }
      geos.push(g);
    }
    const merged = geos.length ? mergeGeometries(geos, false) : null;
    if (merged) {
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, flowerHeroM.mat);
      mesh.customDepthMaterial = flowerHeroM.depth;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = 'lotusHeroFlowers';
      group.add(mesh);
    }
    for (const g of geos) g.dispose();
  }
  // water beads (macro leaves + the hero floating leaf)
  {
    const bg = buildBeads(ctx, U, beads, SWAY_GLSL);
    if (bg) group.add(bg);
  }

  // fallen petals floating on the water
  {
    const list = plan.fallen.filter((p) => site.sd(p.x, p.z) > 0.15);
    const gs = [fallenPetal(r, { S: HS }), fallenPetal(r, { S: HS })];
    const lists = [[], []];
    list.forEach((p, i) => lists[i % 2].push(p));
    const fm = (p, i, inst) => {
      inst.set([r.float(), r.float(), p.hue ?? 0.5, 1], i * 4);
      const q = new THREE.Quaternion().setFromAxisAngle(AY, p.yaw);
      const s = p.size ?? 1;
      return new THREE.Matrix4().compose(new THREE.Vector3(p.x, waterY + 0.002, p.z), q, new THREE.Vector3(s, s, s));
    };
    lists.forEach((l, k) => makeInst(gs[k], flowerM, l, `lotusFallen${k}`, fm));
  }

  for (const p of [...plan.flowers, ...plan.buds, ...plan.pods]) {
    const s = p._s ?? 1;
    const q = p._q ?? new THREE.Quaternion();
    const down = new THREE.Vector3(0, -0.017 * HS * s, 0).applyQuaternion(q);
    const top = stemTop(p).add(down);
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    addStem(p, top, p.macro ? 0.0062 : 0.0056, p.seed, p.macro ? 28 : p.isHeroFlower ? 14 : (p.hero ? 10 : 6), dir, p.macro ? 14 : p.isHeroFlower ? 7 : 5);
  }

  // ---- stems mesh ---------------------------------------------------------------
  if (S.pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(S.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(S.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(S.uv, 2));
    g.setAttribute('aStem', new THREE.Float32BufferAttribute(S.aStem, 4));
    g.setIndex(S.idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, stemM.mat);
    mesh.customDepthMaterial = stemM.depth;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = 'lotusStems';
    group.add(mesh);
  }

  let tris = 0;
  group.traverse((o) => { if (o.isMesh) { const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; tris += n * (o.isInstancedMesh ? o.count : 1); } });
  console.log(`[world] pond: lotus meshes=${group.children.length} tris=${Math.round(tris)}`);
  return { object: group };
}
