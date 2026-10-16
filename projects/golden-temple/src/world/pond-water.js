import { RenderGate } from '../core/realtime.js';
// ---------------------------------------------------------------------------
// Pond water: planar mirror reflection (own oblique-clipped mirror camera into
// an MSAA HalfFloat RT with depth + mips), procedural wind ripples with
// cat's-paw gust patches and koi rings, Fresnel blend, analytic shadowed sun
// glints (three's GGX on the rippled normal), murky water body with
// transmittance driven by the pond-floor depth map. Output is linear HDR and
// alpha-blended (One, OneMinusSrcAlpha) over the underwater geometry.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { SKY_UNIFORMS } from '../core/sky.js';

// GLSL shared by the water surface and by every submerged pond material so
// that their water-column maths agree exactly.
export const POND_GLSL = /* glsl */ `
uniform sampler2D tPondMap;
uniform vec4 uPondRect;     // minX, minZ, 1/sizeX, 1/sizeZ
uniform float uWaterY;
uniform float uAbsorbS;     // scalar extinction used by the surface blend (1/m)
uniform vec3 uAbsorbC;      // chromatic extinction applied to light reaching submerged surfaces
uniform vec3 uScatterCol;   // water body single-scatter albedo-ish colour
vec4 pondMap(vec2 xz){ return texture2D(tPondMap, (xz - uPondRect.xy) * uPondRect.zw); }
float pondFloorDepth(vec2 xz){ return pondMap(xz).r * 2.0; }
// view path length factor and transmittance from the surface entry point P down to the floor
float pondFloorT(vec3 P, vec3 camPos, out float cosT, out vec3 Tr){
  vec3 V = normalize(camPos - P);
  Tr = refract(-V, vec3(0.0, 1.0, 0.0), 0.7502);
  cosT = max(-Tr.y, 0.25);
  float d0 = pondFloorDepth(P.xz);
  vec2 pF = P.xz + Tr.xz / cosT * d0 * 0.8;
  float dF = pondFloorDepth(pF);
  return exp(-uAbsorbS * dF / cosT);
}
vec3 pondInscatter(vec3 sunE, vec3 skyIrr){
  return uScatterCol * (sunE * 0.10 + skyIrr * 0.2);
}
// Submerged surface compensation: the surface applies the floor transmittance
// Tf to whatever lies below; a surface at depth dk must only be attenuated by Tk.
vec3 pondUnderwater(vec3 col, vec3 wp, vec3 sunE, vec3 skyIrr){
  if (wp.y >= uWaterY - 0.002 || cameraPosition.y <= uWaterY) return col;
  float dk = uWaterY - wp.y;
  col *= exp(-uAbsorbC * dk * 1.5);           // light travelling down to it
  vec3 C = cameraPosition;
  vec3 P = wp + (C - wp) * (dk / max(C.y - wp.y, 1e-3));
  float cosT; vec3 Tr;
  float Tf = pondFloorT(P, C, cosT, Tr);
  float Tk = exp(-uAbsorbS * dk / cosT);
  col *= exp(-uAbsorbC * dk / cosT * 0.6);     // chromatic tint on the way up
  float ratio = min(Tk / max(Tf, 1e-3), 200.0);
  vec3 insc = pondInscatter(sunE, skyIrr);
  return max(col * ratio - insc * (ratio - 1.0), vec3(0.0));
}
`;

export function pondUniforms(site) {
  return {
    tPondMap: { value: site.mapTex },
    uPondRect: { value: new THREE.Vector4(site.rect.minX, site.rect.minZ, 1 / site.rect.sx, 1 / site.rect.sz) },
    uWaterY: { value: site.waterY },
    uAbsorbS: { value: 2.3 },
    uAbsorbC: { value: new THREE.Vector3(0.95, 0.42, 0.85) },
    uScatterCol: { value: new THREE.Vector3(0.034, 0.060, 0.042) },
  };
}

// fragEnd snippet for submerged opaque materials (needs POND_GLSL in fragHead)
export const UW_FRAGEND = /* glsl */ `
  {
    vec3 _sunE = vec3(0.0);
    #if NUM_DIR_LIGHTS > 0
      _sunE = directLight.color;
    #endif
    outgoingLight = pondUnderwater(outgoingLight, vWPos, _sunE, iblIrradiance);
  }
`;

export function buildWater(ctx, site, U) {
  const { renderer, quality } = ctx;
  const waterY = site.waterY;

  // ---- reflection render target ------------------------------------------
  const dbs = renderer.getDrawingBufferSize(new THREE.Vector2());
  const scale = quality === 'final' ? 0.75 : 0.5;
  const rw = Math.max(256, Math.round(dbs.x * scale)), rh = Math.max(144, Math.round(dbs.y * scale));
  const depthTex = new THREE.DepthTexture(rw, rh, THREE.FloatType);
  depthTex.format = THREE.DepthFormat;
  const reflRT = new THREE.WebGLRenderTarget(rw, rh, {
    type: THREE.HalfFloatType, samples: ctx.realtime?.enabled ? 2 : 4, depthBuffer: true, depthTexture: depthTex,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
  });

  const RU = {
    tRefl: { value: reflRT.texture },
    tReflDepth: { value: depthTex },
    uReflVP: { value: new THREE.Matrix4() },
    uReflProjInv: { value: new THREE.Matrix4() },
    uReflCamPos: { value: new THREE.Vector3() },
    uReflOn: { value: 0 },
    uReflRes: { value: new THREE.Vector2(rw, rh) },
    uRings: { value: site.rings.map((r) => new THREE.Vector4(r[0], r[1], r[2], r[3])) },
    // per-ring amplitude; > 1.5 = a hero ring that ignores the calm-water damping
    // sunlit breeze patch of the water-level shot: (x, z, radius, strength), w.r.t. shot uGlitterShot
    uGlitter: { value: new THREE.Vector4(...(site.glitter || [0, 0, 0, 0])) },
    uGlitterShot: { value: site.glitterShot ?? -99 },
    uGlitterT: { value: new THREE.Vector2(...(site.glitterT || [1e9, 1e9 + 1])) }, // gust dies down (shader time)
    uRingAmp: { value: Array.from({ length: 8 }, (_, i) => (site.rings[i] && site.rings[i][4]) || 1) },
    uDbg: { value: (() => { try { return +new URLSearchParams(location.search).get('pondDbg') || 0; } catch (e) { return 0; } })() },
  };

  const hooks = {
    uniforms: { ...U, ...RU },
    fragHead: /* glsl */ `
      ${POND_GLSL}
      uniform sampler2D tRefl;
      uniform sampler2D tReflDepth;
      uniform mat4 uReflVP;
      uniform mat4 uReflProjInv;
      uniform vec3 uReflCamPos;
      uniform float uReflOn;
      uniform vec2 uReflRes;
      uniform vec4 uRings[8];
      uniform float uRingAmp[8];
      uniform vec4 uGlitter;
      uniform float uGlitterShot;
      uniform vec2 uGlitterT;
      uniform float uDbg;
      vec3 w_N; float w_rough; float w_lostVar; vec4 w_map; float w_alpha; float w_scum; vec3 w_reflF = vec3(0.0); float w_F = 0.0;
      float w_duck = 0.0; vec3 w_duckCol = vec3(0.0);
      // duckweed fronds: 2-4 mm discs in clusters of 2-4, in calm water near the banks.
      // Fully resolved close to the lens, an averaged green tint once sub-pixel.
      float w_duckweed(vec2 p, float fp, float dens, out vec3 dcol){
        dcol = vec3(0.0);
        if (dens < 0.01) return 0.0;
        float cellS = 0.012;
        vec2 q = p / cellS;
        vec2 c = floor(q), f = fract(q);
        float cov = 0.0;
        float fpc = fp / cellS;
        if (fpc < 0.6) {
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 h = n_hash22(c + g);
            float on = step(1.0 - dens, n_hash12(c + g + 5.7));
            vec2 o = g + 0.2 + 0.6 * h - f;
            float rr = (0.18 + 0.14 * h.x);
            float d = length(o * vec2(1.0, 1.0 + 0.3 * h.y));
            float m = (1.0 - smoothstep(rr - fpc, rr + fpc, d)) * on;
            if (m > cov) { cov = m; dcol = mix(vec3(0.10, 0.20, 0.03), vec3(0.18, 0.28, 0.05), h.y) * (0.85 + 0.3 * smoothstep(rr * 0.6, 0.0, d)); }
          }
          cov *= 1.0 - smoothstep(0.3, 0.6, fpc);
        }
        float avg = dens * 0.22;
        dcol = mix(vec3(0.13, 0.23, 0.04), dcol, step(0.001, cov));
        return mix(avg, cov, 1.0 - smoothstep(0.3, 0.6, fpc));
      }

      float w_fade(float fpf){ return 1.0 - smoothstep(0.18, 0.7, fpf); }
      // ripple height field (metres). fp = pixel footprint (m). calm = 0..1 damping.
      float w_height(vec2 p, float fp, float calm, out float lost){
        float t = uTime;
        vec2 wd = normalize(uWindDir);
        vec2 wn = vec2(-wd.y, wd.x);
        vec2 q = vec2(dot(p, wd), dot(p, wn));
        // cat's paws: drifting gust patches (ruffled) between glassy calm
        float g = n_fbm(p * 0.05 - wd * t * 0.045 + 3.1, 3) * 0.5 + 0.5;
        float g2 = n_snoise(p * 0.17 - wd * t * 0.09) * 0.5 + 0.5;
        float gust = smoothstep(0.45, 0.78, g) * (0.6 + 0.4 * g2);
        float amp = mix(0.05, 0.7, gust) * calm;
        float h = 0.0; lost = 0.0;
        float w, sl;
        // long, slow undulation (keeps glassy areas alive)
        w = w_fade(fp / 3.2);
        h += 0.0016 * calm * n_snoise(vec2(q.x / 3.2 - t * 0.05, q.y / 5.0 + t * 0.012)) * w;
        // wind ripples, crests across the wind, travelling downwind
        w = w_fade(fp / 1.0); sl = 0.011 * amp;
        h += 0.0015 * amp * n_snoise(vec2(q.x / 1.0 - t * 0.21, q.y / 1.9)) * w;
        lost += (1.0 - w) * sl * sl;
        w = w_fade(fp / 0.42); sl = 0.012 * amp;
        h += 0.0007 * amp * n_snoise(vec2(q.x / 0.42 - t * 0.33, q.y / 0.75 + 4.0)) * w;
        lost += (1.0 - w) * sl * sl;
        w = w_fade(fp / 0.17); sl = 0.012 * amp;
        h += 0.00028 * amp * n_snoise(vec2(q.x / 0.17 - t * 0.5, q.y / 0.26 + 9.0) + vec2(n_snoise(p * 1.3 + t * 0.1)) * 0.6) * w;
        lost += (1.0 - w) * sl * sl;
        w = w_fade(fp / 0.07); sl = 0.011 * amp;
        h += 0.0001 * amp * n_snoise(vec2(q.x / 0.07 - t * 0.8, q.y / 0.09)) * w;
        lost += (1.0 - w) * sl * sl;
        // capillary wavelets: only resolved by the water-level lens
        w = w_fade(fp / 0.028); sl = 0.009 * amp;
        h += 0.000035 * amp * n_snoise(vec2(q.x / 0.028 - t * 1.1, q.y / 0.034) + vec2(n_snoise(p * 4.0 - t * 0.2)) * 0.5) * w;
        lost += (1.0 - w) * sl * sl;
        // sunlit breeze patch (water-level shot facing the low sun): short choppy
        // wavelets, steep enough to break the sun's reflection into glitter. Fades
        // to slope variance (no sparkle) once the wavelets are sub-pixel.
        if (uGlitter.w > 0.0 && (abs(uShot - uGlitterShot) < 0.5 || uShot < -0.5)) {
          float gk = uGlitter.w * (1.0 - smoothstep(uGlitter.z * 0.35, uGlitter.z, length(p - uGlitter.xy))) * (1.0 - smoothstep(uGlitterT.x, uGlitterT.y, t));
          if (gk > 0.001) {
            w = w_fade(fp / 0.11);
            h += 0.0011 * gk * n_snoise(vec2(q.x / 0.11 - t * 0.55, q.y / 0.15) + vec2(n_snoise(p * 2.0 + t * 0.12)) * 0.7) * w;
            lost += (1.0 - w) * 0.0025 * gk * gk;
            w = w_fade(fp / 0.05);
            h += 0.00042 * gk * n_snoise(vec2(q.x / 0.05 - t * 0.8, q.y / 0.065 + 3.0) + vec2(n_snoise(p * 5.0 - t * 0.25)) * 0.5) * w;
            lost += (1.0 - w) * 0.002 * gk * gk;
          }
        }
        // koi / insect rings
        for (int i = 0; i < 8; i++){
          vec4 R = uRings[i];
          if (R.z <= 0.0) continue;
          float age = mod(t + R.w, R.z);
          vec2 d = p - R.xy;
          float r = length(d);
          float front = 0.05 + age * 0.30;
          float env = exp(-age * 0.75) * smoothstep(0.0, 0.25, age) * smoothstep(3.0, 1.0, r);
          float x = r - front;
          float ring = exp(-x * x * 40.0) * cos(x * 48.0) + exp(-pow(x + 0.16, 2.0) * 30.0) * cos((x + 0.16) * 40.0) * 0.6;
          float ra = uRingAmp[i];
          h += 0.0011 * ra * env * ring * w_fade(fp / 0.12) * (ra > 1.5 ? 1.0 : calm);
        }
        return h;
      }
    `,
    fragColor: /* glsl */ `
      {
        w_map = pondMap(vWPos.xz);
        float sd = w_map.g * 8.0 - 2.0;            // shore distance (m), + in water
        if (sd < -1.6) discard;
        float lotus = w_map.b;
        float calm = mix(1.0, 0.25, lotus) * mix(0.35, 1.0, smoothstep(-0.2, 1.6, sd));
        vec2 p = vWPos.xz;
        float fp = max(length(fwidth(vWPos.xz)), 1e-4);
        float e = clamp(fp * 0.6, 0.006, 0.08);
        float l0, l1, l2;
        float h0 = w_height(p, fp, calm, l0);
        float hx = w_height(p + vec2(e, 0.0), fp, calm, l1);
        float hz = w_height(p + vec2(0.0, e), fp, calm, l2);
        w_N = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));
        w_lostVar = l0;
        // floating pollen / dust film in calm corners near the shore
        float sc = n_fbm(p * 0.35 + 7.0, 3) * 0.5 + 0.5;
        w_scum = smoothstep(0.55, 0.85, sc) * (1.0 - smoothstep(0.2, 2.2, sd)) * 0.55
               + smoothstep(0.7, 0.95, n_fbm(p * 1.4 + 2.0, 3) * 0.5 + 0.5) * 0.15 * (1.0 - smoothstep(0.0, 6.0, sd));
        w_scum *= 0.5;
        // duckweed rafts: calm margins, lee of the lotus beds, patchy
        float dk = smoothstep(0.62, 0.8, n_fbm(p * 0.22 + 31.0, 3) * 0.5 + 0.5) * (1.0 - smoothstep(0.4, 2.6, sd))
                 + smoothstep(0.7, 0.85, n_fbm(p * 0.5 - 7.0, 2) * 0.5 + 0.5) * lotus * 0.6;
        dk *= smoothstep(-0.3, 0.2, sd);
        w_duck = w_duckweed(p + vec2(sin(uTime * 0.03), cos(uTime * 0.025)) * 0.05, fp, clamp(dk, 0.0, 0.85), w_duckCol);
        diffuseColor.rgb = vec3(0.0);
      }
    `,
    fragRough: /* glsl */ `
      roughnessFactor = clamp(sqrt(sqrt(0.00015 + w_lostVar) * 1.4), 0.115, 0.4);
    `,
    fragNormal: /* glsl */ `
      normal = normalize((viewMatrix * vec4(w_N, 0.0)).xyz);
    `,
    fragLight: /* glsl */ `
      {
        vec3 Nw = w_N;
        vec3 Vw = normalize(cameraPosition - vWPos);
        float NdV = clamp(dot(Nw, Vw), 1e-3, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
        vec3 refl = vec3(0.0);
        if (uReflOn > 0.5) {
          vec4 c0 = uReflVP * vec4(vWPos, 1.0);
          vec2 uv0 = c0.xy / c0.w * 0.5 + 0.5;
          float dz = texture2D(tReflDepth, uv0).x;
          float D = 300.0;
          if (dz < 0.99995) {
            vec4 vp = uReflProjInv * vec4(uv0 * 2.0 - 1.0, dz * 2.0 - 1.0, 1.0);
            vec3 vpos = vp.xyz / vp.w;
            D = clamp(length(vpos) - length(uReflCamPos - vWPos), 0.05, 300.0);
          }
          vec3 Rp = reflect(-Vw, Nw);
          Rp.y = max(Rp.y, 0.002);
          Rp = normalize(Rp);
          vec3 Q = vWPos + Rp * D;
          vec4 c1 = uReflVP * vec4(Q, 1.0);
          vec2 uv1 = c1.xy / max(c1.w, 1e-4) * 0.5 + 0.5;
          uv1 = clamp(uv1, vec2(0.5 / uReflRes), vec2(1.0 - 0.5 / uReflRes));
          // blur from unresolved micro ripples (angular spread -> pixels in the RT)
          float dist = length(cameraPosition - vWPos);
          float spread = 2.0 * sqrt(0.000008 + w_lostVar) * D / (dist + D);
          float px = spread * uReflRes.y * 1.2;
          // anisotropic: grazing views smear reflections vertically (classic water streaks)
          float pxH = px * clamp(NdV * 2.5, 0.12, 1.0);
          float lod = clamp(log2(max(pxH, 1.0)), 0.0, 4.0);
          float vs = min(px, 64.0) / uReflRes.y;
          vec3 acc = vec3(0.0); float wsum = 0.0;
          for (int k = -3; k <= 3; k++) {
            float o = float(k) / 3.0;
            float wk = exp(-o * o * 2.0);
            vec2 uvk = clamp(uv1 + vec2(0.0, o * vs), vec2(0.5 / uReflRes), vec2(1.0 - 0.5 / uReflRes));
            acc += min(textureLod(tRefl, uvk, lod).rgb, vec3(30000.0)) * wk; wsum += wk;
          }
          refl = acc / wsum;
        }
        vec3 sunE = vec3(0.0);
        #if NUM_DIR_LIGHTS > 0
          sunE = directLight.color;
          // sun glints: Beckmann microfacet lobe (no GGX tails), slope variance from
          // the unresolved ripples + the solar disc, shadowed via directLight
          {
            vec3 Ls = normalize(uSunDir);
            vec3 H = normalize(Ls + Vw);
            float NdH = max(dot(Nw, H), 1e-4);
            float NdL = max(dot(Nw, Ls), 0.0);
            float s2 = 0.00012 + w_lostVar + 0.00003;
            float a2 = 2.0 * s2;
            float c2 = NdH * NdH;
            float tan2 = (1.0 - c2) / c2;
            float Dm = exp(-tan2 / a2) / (3.14159 * a2 * c2 * c2);
            float VdH = max(dot(Vw, H), 0.0);
            float Fh = 0.02 + 0.98 * pow(1.0 - VdH, 5.0);
            float G = min(1.0, min(2.0 * NdH * NdV / VdH, 2.0 * NdH * NdL / VdH));
            vec3 glint = sunE * Fh * Dm * G / (4.0 * NdV) * step(0.0, dot(vec3(0.0, 1.0, 0.0), Ls));
            reflectedLight.directSpecular = min(glint, vec3(40000.0)) * (1.0 - w_scum);
          }
        #endif
        // water body below the surface
        float cosT; vec3 Tr;
        float Tf = pondFloorT(vWPos, cameraPosition, cosT, Tr);
        vec3 insc = pondInscatter(sunE, iblIrradiance);
        reflectedLight.indirectSpecular = refl * F; w_F = F;
        reflectedLight.indirectDiffuse = (1.0 - F) * insc * (1.0 - Tf);
        // pollen film: diffuse, sits on top
        vec3 scumCol = vec3(0.30, 0.27, 0.17);
        float sunN = max(dot(vec3(0.0, 1.0, 0.0), normalize(uSunDir)), 0.0);
        reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, scumCol * (sunE * sunN + iblIrradiance * 0.3) / 3.14159, w_scum);
        // duckweed: opaque green fronds riding on the surface
        reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, w_duckCol * (sunE * (sunN + 0.12) + iblIrradiance * 0.45) / 3.14159, w_duck);
        reflectedLight.directSpecular *= 1.0 - w_duck;
        reflectedLight.indirectSpecular *= (1.0 - w_scum * 0.6) * (1.0 - w_duck * 0.85); w_reflF = reflectedLight.indirectSpecular;
        w_alpha = 1.0 - (1.0 - F) * Tf;
        w_alpha = mix(w_alpha, 1.0, max(w_scum, w_duck));
      }
    `,
    fragEnd: /* glsl */ `
      diffuseColor.a = w_alpha;
      if (uDbg > 0.5) {
        diffuseColor.a = 1.0;
        if (uDbg < 1.5) outgoingLight = w_reflF / max(w_F, 1e-3);
        else if (uDbg < 2.5) outgoingLight = vec3(w_F);
        else if (uDbg < 3.5) outgoingLight = reflectedLight.indirectDiffuse * 20.0;
        else if (uDbg < 4.5) outgoingLight = reflectedLight.directSpecular;
        else outgoingLight = vec3(w_alpha);
      }
      #ifdef USE_FOG
      {
        #ifdef FOG_EXP2
          float _fd = fogDensity;
        #else
          float _fd = 1.0;
        #endif
        vec3 _Z = applyAerial(vec3(0.0), vFogWorldPos, cameraPosition, _fd);
        vec3 _T = applyAerial(vec3(1.0), vFogWorldPos, cameraPosition, _fd) - _Z;
        // the mirrored render already carries fog for the whole path: keep the
        // reflection unfogged, fog only the glint/body part, dst carries its own
        vec3 _Ti = 1.0 / max(_T, vec3(1e-3));
        outgoingLight = outgoingLight - w_reflF + w_reflF * _Ti - _Z * (1.0 - w_alpha + w_F) * _Ti;
      }
      #endif
    `,
  };

  const mat = ctx.mat.phys({
    color: 0x000000, roughness: 0.12, metalness: 0, ior: 1.333, specularIntensity: 0.0,
    transparent: true, depthWrite: true, side: THREE.FrontSide,
  }, hooks);
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneFactor;
  mat.name = 'pondWater';

  const r = site.rect;
  const geo = new THREE.PlaneGeometry(r.sx - 0.4, r.sz - 0.4, 8, 4).rotateX(-Math.PI / 2);
  geo.translate(r.minX + r.sx / 2, waterY, r.minZ + r.sz / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pondWater';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 10;

  // ---- mirror camera ------------------------------------------------------
  const reflCam = new THREE.PerspectiveCamera();
  reflCam.matrixAutoUpdate = true;
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const rot = new THREE.Matrix4();
  const target = new THREE.Vector3();
  const plane = new THREE.Plane();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const normal = new THREE.Vector3(0, 1, 0);
  const planePt = new THREE.Vector3(0, waterY, 0);
  let busy = false;
  const gate = new RenderGate(ctx.realtime?.reflectionMs || 0);
  ctx.resizeTargets?.push((width,height)=>{
    dbs.set(width,height);
    const w=Math.max(256,Math.round(width*scale)),h=Math.max(144,Math.round(height*scale));
    if(reflRT.width===w&&reflRT.height===h)return;
    reflRT.setSize(w,h);RU.uReflRes.value.set(w,h);gate.invalidate();
  });
  const mirPos = new THREE.Vector3();

  mesh.onBeforeRender = (renderer, scene, camera) => {
    if (busy) return;
    camPos.setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y <= waterY + 0.005) { RU.uReflOn.value = 0; return; }
    if(ctx.isInteractiveFrame && ctx.realtime?.enabled) {
      const key=camera.matrixWorld.elements.join(',')+':'+camera.projectionMatrix.elements.join(',');
      if(!gate.needs(performance.now(),ctx.frameTime,key))return;
    }
    busy = true;
    // mirrored position
    mirPos.copy(camPos); mirPos.y = 2 * waterY - camPos.y;
    rot.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.copy(lookAt); target.y = 2 * waterY - lookAt.y;
    reflCam.position.copy(mirPos);
    reflCam.up.set(0, 1, 0).applyMatrix4(rot); reflCam.up.y = -reflCam.up.y;
    reflCam.lookAt(target);
    reflCam.far = camera.far; reflCam.near = camera.near;
    reflCam.updateMatrixWorld();
    reflCam.projectionMatrix.copy(camera.projectionMatrix);
    reflCam.layers.mask = camera.layers.mask;
    // oblique near plane = water plane (Lengyel)
    plane.setFromNormalAndCoplanarPoint(normal, planePt);
    plane.applyMatrix4(reflCam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = reflCam.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + P[8]) / P[0];
    q.y = (Math.sign(clip.y) + P[9]) / P[5];
    q.z = -1.0;
    q.w = (1.0 + P[10]) / P[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1.0 - 0.0005; P[14] = clip.w;
    reflCam.projectionMatrixInverse.copy(reflCam.projectionMatrix).invert();

    RU.uReflVP.value.multiplyMatrices(reflCam.projectionMatrix, reflCam.matrixWorldInverse);
    RU.uReflProjInv.value.copy(reflCam.projectionMatrixInverse);
    RU.uReflCamPos.value.copy(mirPos);

    const prevRT = renderer.getRenderTarget();
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    const prevDisc = SKY_UNIFORMS.uSunDisc.value;
    const prevAutoClear = renderer.autoClear;
    mesh.visible = false;
    renderer.shadowMap.autoUpdate = false;
    SKY_UNIFORMS.uSunDisc.value = 0.0;
    renderer.setRenderTarget(reflRT);
    renderer.state.buffers.depth.setMask(true);
    renderer.autoClear = true;
    renderer.clear(true, true, true);
    try {
      if(ctx.isInteractiveFrame)ctx.updateLOD?.(reflCam,reflRT.height,true);
      renderer.render(scene, reflCam);
    } finally {
    if(ctx.isInteractiveFrame)ctx.updateLOD?.(camera,dbs.y);
    renderer.autoClear = prevAutoClear;
    SKY_UNIFORMS.uSunDisc.value = prevDisc;
    renderer.shadowMap.autoUpdate = prevShadowAuto;
    renderer.setRenderTarget(prevRT);
    mesh.visible = true;
    RU.uReflOn.value = 1;
    busy = false;
    }
  };

  return { mesh, reflRT, material: mat };
}
