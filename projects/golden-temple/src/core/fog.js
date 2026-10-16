import * as THREE from 'three';
import { sunDir } from './env.js';

// ---------------------------------------------------------------------------
// Aerial perspective + height fog, applied inside every material's shader
// (so planar water reflections get identical fog). Activated by scene.fog =
// new THREE.FogExp2(color, density); `fogDensity` acts as a runtime multiplier
// and `fogColor` as the ambient haze colour (away from the sun).
// ---------------------------------------------------------------------------

export const FOG_PARAMS = {
  heightFalloff: 22.0,   // metres scale height of the ground haze layer
  groundDensity: 0.0013, // extinction /m at y=0 inside the haze layer
  airDensity: 0.00022,   // extinction /m everywhere (long-distance aerial perspective)
  sunGlowColor: [1.0, 0.62, 0.30],
  sunGlowStrength: 0.9,
  mieG: 0.78,
};

function f(x) { return Number(x).toFixed(6); }

// Ambient (IBL) attenuation volumes: boxes where sky light is mostly blocked
// (hall interior, under deep eaves). {min:[x,y,z], max:[x,y,z], tint:[r,g,b], soft:m}
// Baked as GLSL constants — call setAmbientVolumes() BEFORE the first render.
let AMBIENT_VOLUMES = [];
export function setAmbientVolumes(list) { AMBIENT_VOLUMES = list.slice(0, 48); installFog(); }
function ambientGLSL() {
  const V = AMBIENT_VOLUMES;
  if (!V.length) return 'vec3 ambientVolume(vec3 p){ return vec3(1.0); }';
  const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
  return `
  const int NAV = ${V.length};
  const vec3 AV_MIN[NAV] = vec3[](${V.map((v) => v3(v.min)).join(', ')});
  const vec3 AV_MAX[NAV] = vec3[](${V.map((v) => v3(v.max)).join(', ')});
  const vec4 AV_VAL[NAV] = vec4[](${V.map((v) => `vec4(${f(v.tint[0])}, ${f(v.tint[1])}, ${f(v.tint[2])}, ${f(v.soft ?? 0.5)})`).join(', ')});
  vec3 ambientVolume(vec3 p){
    vec3 r = vec3(1.0);
    for (int i = 0; i < NAV; i++){
      vec3 c = (AV_MIN[i] + AV_MAX[i]) * 0.5;
      vec3 h = (AV_MAX[i] - AV_MIN[i]) * 0.5;
      vec3 q = abs(p - c) - h;
      float sd = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
      float w = 1.0 - smoothstep(-AV_VAL[i].w, AV_VAL[i].w, sd);
      r *= mix(vec3(1.0), AV_VAL[i].rgb, w);
    }
    return r;
  }`;
}

const LIGHTS_MAPS_ORIG = THREE.ShaderChunk.lights_fragment_maps;
// PCF: three rotates its Vogel taps with screen-space noise, which crawls when the camera
// moves (flickering penumbrae). Our soft shadows come from sun-disc jitter across
// sub-frames, so use a fixed rotation instead -> temporally stable shadows.
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment
  .split('float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;').join('float phi = 0.785;');

export function installFog() {
  const s = sunDir;
  const P = FOG_PARAMS;
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif
`;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  {
    vec4 _fw = vec4( transformed, 1.0 );
    #ifdef USE_BATCHING
      _fw = batchingMatrix * _fw;
    #endif
    #ifdef USE_INSTANCING
      _fw = instanceMatrix * _fw;
    #endif
    _fw = modelMatrix * _fw;
    vFogWorldPos = _fw.xyz;
  }
#endif
`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogWorldPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${ambientGLSL()}
  vec3 applyAerial(vec3 col, vec3 wpos, vec3 camPos, float densMul){
    const vec3 SUN = vec3(${f(s.x)}, ${f(s.y)}, ${f(s.z)});
    const float H = ${f(P.heightFalloff)};
    const float D0 = ${f(P.groundDensity)};
    const float DA = ${f(P.airDensity)};
    vec3 V = wpos - camPos;
    float dist = length(V);
    vec3 dir = V / max(dist, 1e-4);
    float y0 = camPos.y;
    float dy = V.y;
    float hfac = abs(dy) > 0.01 ? (exp(-max(y0, -5.0) / H) - exp(-max(y0 + dy, -5.0) / H)) * H / dy : exp(-max(y0, -5.0) / H);
    float od = (D0 * hfac + DA) * dist * densMul;
    float T = exp(-od);
    float mu = dot(dir, SUN);
    const float g = ${f(P.mieG)};
    float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) / 12.566;
    vec3 sunGlow = vec3(${f(P.sunGlowColor[0])}, ${f(P.sunGlowColor[1])}, ${f(P.sunGlowColor[2])}) * ${f(P.sunGlowStrength)};
    // ambient haze: blue-lavender away from sun, warm gold toward it
    float toward = pow(max(mu, 0.0) * 0.5 + 0.5, 3.0);
    vec3 amb = mix(fogColor, fogColor * vec3(1.55, 1.12, 0.72), toward);
    // forward-scatter glow toward the sun, capped so backlit silhouettes keep their outline
    vec3 inscatter = amb + sunGlow * min(hg * 4.0, 1.6) * (0.55 + 0.45 * smoothstep(300.0, 3000.0, dist));
    inscatter *= (ambientVolume(camPos) + ambientVolume(wpos)) * 0.5;
    return col * T + inscatter * (1.0 - T);
  }
#endif
`;
  THREE.ShaderChunk.lights_fragment_maps = LIGHTS_MAPS_ORIG + /* glsl */ `
#ifdef USE_FOG
  {
    vec3 _av = ambientVolume(vFogWorldPos);
    #if defined( RE_IndirectDiffuse )
      iblIrradiance *= _av;
      irradiance *= _av;
    #endif
    #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
      radiance *= _av;
      #ifdef USE_CLEARCOAT
        clearcoatRadiance *= _av;
      #endif
    #endif
  }
#endif
`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, vFogWorldPos, cameraPosition, fogDensity);
  #else
    gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, vFogWorldPos, cameraPosition, 1.0);
  #endif
#endif
`;
}

// GLSL usable in custom ShaderMaterials (sky, water...) – same formula but explicit.
export function aerialGLSL() {
  return THREE.ShaderChunk.fog_pars_fragment;
}
