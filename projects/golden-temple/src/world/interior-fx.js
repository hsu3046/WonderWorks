// ---------------------------------------------------------------------------
// Interior atmosphere:
//  * volumetric sun shafts: camera-aligned slices restricted to the hall
//    volume; each slice samples the engine's sun shadow map, so the shafts
//    follow the real window/door openings of the hall shell. Depth-tested
//    against the scene -> correct occlusion, additive, HDR linear.
//  * dust motes: drifting specks that sparkle only inside the sun shafts.
//  * incense smoke: thin animated ribbons.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { NOISE } from '../core/glsl.js';

// sunVis: shadow-map visibility, but occluders OUTSIDE the hall shell box (trees, terrain,
// neighbouring buildings far to the west at this 7 deg sun) are ignored, so the window/door
// openings of the hall alone shape the shafts. All points of one sun ray share the same
// shadow-map texel (orthographic light): we compare against the depth of the point where the
// ray leaves the shell box; a stored depth nearer than that belongs to an outside occluder.
const SHADOW_GLSL = /* glsl */ `
uniform sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uHasShadow;
uniform vec3 uShellMin, uShellMax, uSunToward, uHall;
// analytic openings of the hall shell (hall.js layout): west renji windows (bays 1-4,
// diagonal bars every 0.19 m) and the three open front bays. Used only for sun rays whose
// shadow-map occluder lies outside the shell.
float shellOpen(vec3 wp, vec3 d){
  float m = 0.0;
  float tw = (uHall.x - 13.0 - wp.x) / d.x;
  vec3 p = wp + d * tw;
  float zl = p.z - uHall.y;
  if (tw > 0.0 && zl > -5.1 && zl < 8.5 && p.y > 3.14 && p.y < 5.78) {
    float bz = mod(zl + 5.1, 3.4);
    float frame = smoothstep(0.13, 0.16, bz) * smoothstep(3.27, 3.24, bz);
    float bar = abs(fract((bz - 0.24) / 0.19 + 0.5) - 0.5) * 0.19;
    m = frame * smoothstep(0.02, 0.03, bar);
  }
  float tf = (uHall.y + 8.5 - wp.z) / d.z;
  vec3 q = wp + d * tf;
  float xl = q.x - uHall.x;
  if (tf > 0.0 && abs(xl) < 5.5 && q.y > uHall.z && q.y < 5.78) {
    float colm = smoothstep(0.3, 0.36, abs(abs(xl) - 1.857));
    m = max(m, colm * (q.y < 3.41 ? 1.0 : 0.45));
  }
  return m;
}
float sunVis(vec3 wp){
  if (uHasShadow < 0.5) return 0.0;
  vec4 sc = uShadowMatrix * vec4(wp, 1.0);
  vec3 c = sc.xyz / sc.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 0.0;
  float A = texture(uShadowMap, vec3(c.xy, c.z - 0.0008));
  vec3 d = uSunToward; d = sign(d) * max(abs(d), vec3(1e-4));
  vec3 tb = (mix(uShellMin, uShellMax, step(0.0, d)) - wp) / d;
  float te = max(min(min(tb.x, tb.y), tb.z), 0.0);
  vec4 se = uShadowMatrix * vec4(wp + d * te, 1.0);
  float B = texture(uShadowMap, vec3(c.xy, se.z / se.w - 0.0008));
  // B == 1: nothing outside the shell -> exact shadow test A. B == 0: an outside occluder hides
  // what the shell does -> analytic openings instead.
  return mix(shellOpen(wp, d), A, B);
}
`;
const shellUniforms = (S, G) => ({
  uShellMin: { value: new THREE.Vector3(...S.shell.min) }, uShellMax: { value: new THREE.Vector3(...S.shell.max) },
  uSunToward: G.uSunDir, uHall: { value: new THREE.Vector3(S.cx, S.cz, S.Y0) },
});

function findSun(scene) {
  let s = null;
  scene.traverse((o) => { if (!s && o.isDirectionalLight && o.castShadow) s = o; });
  return s;
}

export function buildShafts(ctx, S, { slices = 56, near = 0.4, far = 34, density = 0.055 } = {}) {
  const { scene, G } = ctx;
  const pos = [], idx = [];
  for (let i = 0; i < slices; i++) {
    const b = pos.length / 3;
    pos.push(-1, -1, i, 1, -1, i, 1, 1, i, -1, 1, i);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const box = S.volume;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uHasShadow: { value: 0 }, ...shellUniforms(S, G),
      uSunDir: G.uSunDir, uSunColor: G.uSunColor, uTime: G.uTime,
      uNear: { value: near }, uFar: { value: far }, uN: { value: slices }, uJit: { value: 0 },
      uTan: { value: new THREE.Vector2(1, 1) },
      uBoxMin: { value: new THREE.Vector3(...box.min) }, uBoxMax: { value: new THREE.Vector3(...box.max) },
      uDensity: { value: density },
      uPL: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, -100, 0, 0)) },
      uPLColor: { value: new THREE.Color().setRGB(1.0, 0.62, 0.3) },
      uAmb: { value: new THREE.Color().setRGB(0.5, 0.33, 0.17).multiplyScalar(S.hazeAmb ?? 0.0035) },
      uHaloK: { value: S.haloK ?? 0.035 },
      uKOut: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uNear, uFar, uN, uJit; uniform vec2 uTan;
      varying vec3 vW; varying float vThick; varying vec3 vView;
      void main(){
        float t = clamp((position.z + uJit) / uN, 0.0, 1.0);
        float k = log(uFar / uNear);
        float d = uNear * exp(k * t);
        vec3 vp = vec3(position.x * uTan.x * d * 1.02, position.y * uTan.y * d * 1.02, -d);
        mat4 camW = inverse(viewMatrix);
        vW = (camW * vec4(vp, 1.0)).xyz;
        vView = normalize(vW - cameraPosition);
        vThick = d * k / uN;
        gl_Position = projectionMatrix * vec4(vp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp sampler2DShadow;
      ${NOISE}
      ${SHADOW_GLSL}
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime; uniform float uDensity;
      uniform vec3 uBoxMin, uBoxMax;
      uniform vec4 uPL[6]; uniform vec3 uPLColor; uniform vec3 uAmb; uniform float uHaloK; uniform float uKOut;
      varying vec3 vW; varying float vThick; varying vec3 vView;
      void main(){
        vec3 w = vW;
        if (any(lessThan(w, uBoxMin)) || any(greaterThan(w, uBoxMax))) discard;
        // soft fade near the volume boundary
        vec3 e = min(w - uBoxMin, uBoxMax - w);
        float edge = smoothstep(0.0, 0.6, min(min(e.x, e.y), e.z));
        // dusty, slowly drifting density
        vec3 q = w * vec3(0.55, 0.9, 0.55) + vec3(0.0, -uTime * 0.03, uTime * 0.012);
        float n = n_vnoise3(q) * 0.65 + n_vnoise3(q * 2.7 + 3.1) * 0.35;
        float dn = (0.22 + 1.45 * n * n) * edge;
        // sun: forward-scattering HG blended with isotropic, shadowed
        float vis = sunVis(w);
        float mu = dot(vView, uSunDir);
        float g = 0.62;
        float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
        float phase = 0.6 + 0.4 * hg * 0.25;
        vec3 col = uSunColor * vis * uDensity * dn * phase * 0.08;
        // lantern / candle halos (unshadowed point-light in-scattering)
        vec3 pl = vec3(0.0);
        for (int i = 0; i < 6; i++) {
          vec3 d = uPL[i].xyz - w;
          float d2 = dot(d, d);
          float mu2 = dot(vView, normalize(d));
          float ph = 0.3 + 0.7 * pow(max(mu2, 0.0), 6.0);
          pl += uPL[i].w * ph / (d2 + 0.04);
        }
        col += uPLColor * pl * uHaloK * dn * 0.1;
        // warm ambient incense haze
        col += uAmb * dn;
        col *= vThick * uKOut;
        if (dot(col, vec3(1.0)) < 1e-6) discard;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'interior-shafts';
  // cull with the hall volume (vertex positions are generated in the shader)
  { const c = new THREE.Vector3().addVectors(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max)).multiplyScalar(0.5);
    geo.boundingSphere = new THREE.Sphere(c, c.distanceTo(new THREE.Vector3(...box.max))); }
  mesh.frustumCulled = true;
  mesh.renderOrder = 10;
  mesh.castShadow = false; mesh.receiveShadow = false;
  let sun = null;
  let frame = 0;
  mesh.onBeforeRender = (renderer, sc, camera) => {
    if (!sun) sun = findSun(scene);
    const u = mat.uniforms;
    if (sun && sun.shadow && sun.shadow.map && sun.shadow.map.depthTexture) {
      u.uShadowMap.value = sun.shadow.map.depthTexture;
      u.uShadowMatrix.value.copy(sun.shadow.matrix);
      u.uHasShadow.value = 1;
    } else u.uHasShadow.value = 0;
    if (camera.isPerspectiveCamera) {
      const th = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      u.uTan.value.set(th * camera.aspect, th);
    }
    // seen from outside (exterior shots glimpsing the sanctum through the doors) the long
    // sideways path through the shafts reads as a milky veil: keep only a hint of it
    { const p = camera.position, a = box.min, b = box.max;
      const inside = p.x > a[0] && p.x < b[0] && p.y > a[1] - 1 && p.y < b[1] && p.z > a[2] && p.z < b[2];
      u.uKOut.value = inside ? 1.0 : 0.38; }
    const PL = S.pointLights || [];
    for (let i = 0; i < 6; i++) {
      const l = PL[i];
      if (l && l.visible && !l.userData.noHalo) u.uPL.value[i].set(l.position.x, l.position.y, l.position.z, l.intensity);
      else u.uPL.value[i].set(0, -100, 0, 0);
    }
    // per-subframe jitter of the slice positions (accumulation removes banding)
    frame++;
    // derived from the sub-frame AA offset (a function of the sub-frame index only), so every
    // frame uses the identical stratified set of slice offsets: static haze never flickers
    { const rt = renderer.getRenderTarget(); const wd = rt ? rt.width : renderer.domElement.width;
      const jx = camera.projectionMatrix.elements[8] * wd * 0.5;
      u.uJit.value = Math.max(-0.5, Math.min(0.5, jx * 0.5)); }
  };
  return mesh;
}

// ---------------------------------------------------------------------------
export function buildDust(ctx, S, { count = 700 } = {}) {
  const { G, scene } = ctx;
  const r = ctx.rng('interior-dust');
  const box = S.dustBox;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = r.range(box.min[0], box.max[0]);
    pos[i * 3 + 1] = r.range(box.min[1], box.max[1]);
    pos[i * 3 + 2] = r.range(box.min[2], box.max[2]);
    seed[i * 4] = r.float(); seed[i * 4 + 1] = r.float(); seed[i * 4 + 2] = r.float(); seed[i * 4 + 3] = r.float();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uHasShadow: { value: 0 }, ...shellUniforms(S, G),
      uTime: G.uTime, uSunColor: G.uSunColor, uSize: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      precision highp sampler2DShadow;
      ${SHADOW_GLSL}
      attribute vec4 seed; uniform float uTime; uniform float uSize;
      varying float vB; varying float vTw;
      void main(){
        vec3 p = position;
        float t = uTime;
        p += vec3(sin(t * (0.07 + seed.x * 0.05) + seed.y * 6.28) * 0.35, sin(t * (0.05 + seed.z * 0.04) + seed.w * 6.28) * 0.25, cos(t * (0.06 + seed.w * 0.05) + seed.x * 6.28) * 0.35);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float vis = sunVis(p);
        vB = vis * (0.4 + 0.6 * seed.z);
        vTw = 0.78 + 0.22 * sin(t * (0.9 + seed.y * 1.4) + seed.x * 30.0);
        gl_PointSize = clamp(uSize * (0.012 + 0.02 * seed.w) * 900.0 / -mv.z, 1.6, 6.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor; varying float vB; varying float vTw;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = dot(c, c) * 4.0;
        float a = exp(-r * 3.0);
        vec3 col = uSunColor * (0.015 + vB * 1.2) * vTw * a * 0.5;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'interior-dust';
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 1.0;
  pts.frustumCulled = true;
  let sun = null;
  pts.onBeforeRender = (renderer, sc, camera) => {
    if (!sun) sun = findSun(scene);
    const u = mat.uniforms;
    if (sun && sun.shadow && sun.shadow.map && sun.shadow.map.depthTexture) {
      u.uShadowMap.value = sun.shadow.map.depthTexture; u.uShadowMatrix.value.copy(sun.shadow.matrix); u.uHasShadow.value = 1;
    } else u.uHasShadow.value = 0;
    u.uSize.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / 1080;
  };
  return pts;
}

// ---------------------------------------------------------------------------
// incense smoke ribbons rising from src points
export function buildSmoke(ctx, sources, { height = 1.4, perSource = 3, width = 0.16 } = {}) {
  const { G } = ctx;
  // one merged mesh: every ribbon is a vertical strip; attributes carry the
  // source point (aBase), the ribbon's side axis (aSide) and a seed.
  const SEG = 48;
  const P = [], UV = [], BASE = [], SIDE = [], SEED = [], I = [];
  let v = 0;
  sources.forEach((s, i) => {
    for (let k = 0; k < perSource; k++) {
      const a = (k / perSource) * Math.PI + i * 0.7;
      const sx = Math.cos(a), sz = Math.sin(a);
      const seed = i * 3.1 + k * 1.7;
      for (let j = 0; j <= SEG; j++) {
        const t = j / SEG;
        for (let e = 0; e < 2; e++) {
          P.push(s[0], s[1], s[2]); UV.push(e, t); BASE.push(s[0] + (k - 1) * 0.012, s[1], s[2]);
          SIDE.push(sx * width, 0, sz * width); SEED.push(seed);
        }
        if (j < SEG) { const b = v + j * 2; I.push(b, b + 1, b + 3, b, b + 3, b + 2); }
      }
      v += (SEG + 1) * 2;
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setAttribute('aBase', new THREE.Float32BufferAttribute(BASE, 3));
  geo.setAttribute('aSide', new THREE.Float32BufferAttribute(SIDE, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(SEED, 1));
  geo.setIndex(I);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uSunColor: G.uSunColor, uH: { value: height } },
    vertexShader: /* glsl */ `
      ${NOISE}
      attribute vec3 aBase; attribute vec3 aSide; attribute float aSeed;
      uniform float uTime; uniform float uH;
      varying vec2 vUv; varying float vH; varying float vSeed;
      void main(){
        vUv = uv; vSeed = aSeed;
        float h = uv.y * uH;
        vH = h;
        float t = uTime * 0.6 + aSeed * 17.0;
        float k = h * 0.6 + h * h * 0.5;
        vec3 p = aBase + vec3(0.0, h, 0.0);
        p += aSide * (uv.x - 0.5) * (0.035 + 1.3 * smoothstep(0.0, 1.3, h));
        p.x += (n_snoise(vec2(h * 2.2 - t * 1.1, aSeed)) * 0.09 + sin(h * 7.0 - t * 2.6 + aSeed) * 0.025) * k;
        p.z += (n_snoise(vec2(h * 1.9 - t * 0.9, aSeed + 7.0)) * 0.08 + cos(h * 6.0 - t * 2.2 + aSeed) * 0.02) * k;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime; uniform vec3 uSunColor; uniform float uH;
      varying vec2 vUv; varying float vH; varying float vSeed;
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0;
        float t = uTime * 0.6 + vSeed * 17.0;
        float n = n_snoise(vec2(vUv.x * 3.0 + vSeed, vH * 3.0 - t * 1.2)) * 0.5 + 0.5;
        float strands = smoothstep(0.35, 0.95, n_snoise(vec2(vUv.x * 7.0, vH * 1.5 - t * 0.8 + vSeed)) * 0.5 + 0.5);
        float a = (1.0 - x * x) * smoothstep(0.0, 0.05, vH) * (1.0 - smoothstep(uH * 0.35, uH * 0.97, vH));
        a *= (0.15 + 0.85 * strands * n) * (0.45 + 0.55 * smoothstep(0.05, 0.5, vH));
        vec3 col = vec3(1.0, 0.88, 0.74) * 0.16 + uSunColor * 0.003;
        gl_FragColor = vec4(col * a * 0.5, 1.0);
      }
    `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'interior-smoke';
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 1.5;
  mesh.frustumCulled = true;
  mesh.renderOrder = 11;
  return mesh;
}
