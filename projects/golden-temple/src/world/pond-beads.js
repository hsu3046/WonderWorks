// ---------------------------------------------------------------------------
// Water beads on lotus leaves (the "lotus effect"): near-spherical drops that
// sit on the waxy, super-hydrophobic surface and look like quicksilver (the air
// cushion under them mirrors the sky), a large rolling drop in the cupped
// centre of some leaves. Instanced spheres that follow their leaf's sway
// exactly (same GLSL as the leaf), shrink away once they become sub-pixel
// (no specular sparkle), and focus the sun into a caustic on their far side.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { POND_GLSL, UW_FRAGEND } from './pond-water.js';

const DEPTH_FIX = '\nvec3 objectNormal = vec3(0.0, 1.0, 0.0);\n';

// Water-drop optics (view space). N = unit sphere normal at the entry point,
// V = toward the eye. dropExit: the eye ray refracted in, crossing the drop and
// refracted out again (zero on total internal reflection). dropSunThrough: the
// sun focused through the drop toward the eye, i.e. the bright point a backlit
// drop shows; pr = drop radius in pixels sets the lobe width so small drops get
// a broad, dim point instead of a flickering sub-pixel sparkle.
export const DROP_GLSL = /* glsl */ `
vec3 dropExit(vec3 N, vec3 V){
  vec3 T1 = refract(-V, N, 0.7519);
  float tt = -2.0 * dot(N, T1);
  vec3 E = normalize(N + tt * T1);
  return refract(T1, -E, 1.33);
}
float dropSunThrough(vec3 T2, vec3 L, float pr){
  if (dot(T2, T2) < 1e-4) return 0.0;
  float k = clamp(pr * pr * 0.5, 6.0, 220.0);
  return pow(max(dot(normalize(T2), L), 0.0), k) * (k + 2.0) / 80.0;
}
`;

// sample bead positions on one leaf: geo = unit leaf geometry, M = its instance matrix
// out: [{ p, n, r, rr, ang }]
export function sampleBeads(r, geo, M, { count = 8, big = 1, rad = 0.3, floating = false } = {}) {
  const P = geo.attributes.position, Nn = geo.attributes.normal, UV = geo.attributes.uv;
  const nm = new THREE.Matrix3().getNormalMatrix(M);
  const res = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const place = (rrMin, rrMax, rMin, rMax) => {
    for (let t = 0; t < 40; t++) {
      const i = Math.floor(r.float() * P.count);
      const rr = UV.getX(i);
      if (rr < rrMin || rr > rrMax) continue;
      p.fromBufferAttribute(P, i).applyMatrix4(M);
      n.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize();
      if (n.y < 0) n.negate();
      if (n.y < 0.55) continue;
      const br = r.range(rMin, rMax);
      if (res.some((o) => o.p.distanceTo(p) < (o.r + br) * 1.6)) continue;
      res.push({ p: p.clone(), n: n.clone(), r: br, rr, ang: UV.getY(i) });
      return;
    }
  };
  // a large drop rolling in the cup (the centre of the leaf is its low point)
  for (let k = 0; k < big; k++) place(floating ? 0.1 : 0.06, floating ? 0.55 : 0.2, 0.0045 * rad / 0.3, 0.008 * rad / 0.3);
  for (let k = 0; k < count; k++) {
    const small = r.chance(0.6);
    place(0.12, 0.88, small ? 0.0009 : 0.0022, small ? 0.002 : 0.0042);
  }
  return res;
}

export function buildBeads(ctx, U, beads, SWAY_GLSL) {
  if (!beads.length) return null;
  const group = new THREE.Group();
  group.name = 'lotusBeads';
  const hooks = {
    uniforms: { ...U, uWaterYV: U.uWaterY },
    vertexHead: /* glsl */ `
      attribute vec4 aB0;   // leaf origin x, z, height above water, leaf seed
      attribute vec4 aB1;   // radial pos on the leaf, angle fraction, floating, bead radius
      attribute vec3 aBC;   // bead centre (world, rest)
      varying vec3 vBN;
      varying float vBR;
      varying float vBPx;
      ${SWAY_GLSL}
    `,
    vertexWorld: /* glsl */ `
      {
        vec3 off;
        if (aB1.z > 0.5) {
          off = vec3(vec2(sin(uTime * 0.11 + aB0.w * 30.0), cos(uTime * 0.09 + aB0.w * 17.0)) * 0.012, 0.0).xzy;
          off.y = sin(uTime * 0.7 + aB0.w * 50.0 + dot(aB0.xy, vec2(1.3, 0.7))) * 0.0015 * aB1.x;
        } else {
          off = lotusSway(aB0.xy, aB0.z, aB0.w);
          off.y += sin(uTime * 2.3 + aB0.w * 40.0 + aB1.y * 12.566) * 0.0045 * aB1.x * aB1.x * uWindStrength;
        }
        // shrink beads that would be sub-pixel (no specular sparkle at distance)
        float dist = length(cameraPosition - aBC);
        float pxr = aB1.w * projectionMatrix[1][1] * 540.0 / max(dist, 0.01);
        float k = smoothstep(0.7, 1.6, pxr);
        wPos4.xyz = aBC + (wPos4.xyz - aBC) * k + off;
        vBN = normalize(wPos4.xyz - aBC);
        vBR = aB1.w;
        vBPx = pxr;
      }
    `,
    fragHead: /* glsl */ `
      varying vec3 vBN;
      varying float vBR;
      varying float vBPx;
      ${POND_GLSL}
      ${DROP_GLSL}
    `,
    fragColor: /* glsl */ `
      // seen through the drop: the glaucous leaf below, magnified and darkened
      diffuseColor.rgb = vec3(0.035, 0.06, 0.04);
    `,
    // glint width follows the drop's pixel size: tiny drops get a broader, dimmer
    // highlight instead of a sub-pixel sparkle (temporal stability)
    fragRough: `roughnessFactor = clamp(1.6 / max(vBPx, 0.5), 0.045, 0.6);`,
    fragLight: /* glsl */ `
      {
        vec3 nW = normalize(vBN);
        vec3 Nv = normalize(normal);
        vec3 Vv = geometryViewDir;
        vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float NoV = clamp(dot(Nv, Vv), 0.0, 1.0);
        float Fr = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
        // lotus effect: the drop rests on an air cushion. The view ray refracts in,
        // is totally reflected by the cushion and leaves upward, so the drop shows
        // a small inverted mirror image of the bright sky (quicksilver look)
        vec3 Tv = refract(-Vv, Nv, 0.75);
        vec3 Mv = normalize(reflect(Tv, upV) + upV * 0.35);
        float roughM = clamp(0.9 / max(vBPx, 0.5), 0.08, 0.6);
        #ifdef USE_ENVMAP
          vec3 envM = getIBLRadiance(Mv, Mv, roughM);
        #else
          vec3 envM = iblIrradiance * 0.35;
        #endif
        // silver body; a dark refraction ring just inside the silhouette
        float body = smoothstep(0.1, 0.45, NoV);
        reflectedLight.indirectSpecular += envM * (1.0 - Fr) * body * 0.9 * vec3(0.93, 0.97, 1.0);
        reflectedLight.indirectDiffuse *= 0.6;
        #if NUM_DIR_LIGHTS > 0
          vec3 Ls = normalize(uSunDir);
          // sunlight refracted through the drop gathers on its far side (caustic crescent)
          float caus = pow(clamp(dot(nW, -Ls) * 0.6 + 0.4, 0.0, 1.0), 7.0) * body;
          reflectedLight.directDiffuse += directLight.color * vec3(1.0, 0.9, 0.7) * caus * 0.7;
          // backlit: the sun focused through the bead toward the lens
          vec3 Lv = normalize((viewMatrix * vec4(Ls, 0.0)).xyz);
          float thr = dropSunThrough(dropExit(Nv, Vv), Lv, vBPx);
          reflectedLight.directSpecular += directLight.color * vec3(1.0, 0.95, 0.85) * thr * 0.85 * body;
        #endif
      }
    `,
    fragEnd: UW_FRAGEND,
  };
  const mat = ctx.mat.phys({ color: 0xffffff, roughness: 0.04, metalness: 0, ior: 1.33, specularIntensity: 1.0, clearcoat: 0 }, hooks);
  mat.name = 'lotusBead';
  const make = (list, detail, name) => {
    if (!list.length) return;
    const g = new THREE.IcosahedronGeometry(1, detail);
    const n = list.length;
    const b0 = new Float32Array(n * 4), b1 = new Float32Array(n * 4), bc = new Float32Array(n * 3);
    const im = new THREE.InstancedMesh(g, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach((b, i) => {
      // big drops slump under their weight; small ones stay round
      const flat = 1 - 0.32 * THREE.MathUtils.smoothstep(b.r, 0.0025, 0.008);
      q.setFromUnitVectors(up, b.n);
      const c = b.p.clone().addScaledVector(b.n, b.r * flat * 0.92);
      m.compose(c, q, new THREE.Vector3(b.r, b.r * flat, b.r));
      im.setMatrixAt(i, m);
      b0.set([b.org[0], b.org[1], b.org[2], b.org[3]], i * 4);
      b1.set([b.rr, b.ang, b.floating ? 1 : 0, b.r], i * 4);
      bc.set([c.x, c.y, c.z], i * 3);
    });
    g.setAttribute('aB0', new THREE.InstancedBufferAttribute(b0, 4));
    g.setAttribute('aB1', new THREE.InstancedBufferAttribute(b1, 4));
    g.setAttribute('aBC', new THREE.InstancedBufferAttribute(bc, 3));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false; im.receiveShadow = true;
    im.name = name;
    im.frustumCulled = false;
    group.add(im);
  };
  make(beads.filter((b) => b.r >= 0.003), 4, 'lotusBeadsBig');
  make(beads.filter((b) => b.r < 0.003), 2, 'lotusBeadsSmall');
  return group;
}
