import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { G, WIND_GLSL } from './env.js';
import { hashString } from './rng.js';

// ---------------------------------------------------------------------------
// patch(material, opts): inject procedural GLSL into any MeshStandard/Physical
// material (also works for MeshBasic/Lambert for the common hooks).
//
// Always available in BOTH vertex and fragment stages:
//   varying vec3 vWPos;  // world-space position (after vertexWorld displacement)
//   varying vec3 vWNrm;  // world-space geometric normal (unnormalised in frag -> normalize it)
//   uniform float uTime; uniform vec2 uWindDir; uniform float uWindStrength;
//   uniform vec3 uSunDir; uniform vec3 uSunColor;
//   the whole NOISE lib (n_* functions) and windOffset(wp, flex)
// Fragment helpers: n_bumpView(viewPos, viewNormal, height, strength) -> perturbed view normal
//
// Hooks (strings of GLSL statements):
//   vertexHead    : declarations for the vertex shader (attributes, varyings, functions)
//   vertexWorld   : runs with `vec4 wPos4` = world position; may modify wPos4.xyz (wind etc.)
//                   `transformed` (object space) and `objectNormal` are in scope.
//   fragHead      : declarations for the fragment shader (varyings, globals, functions)
//   fragColor     : after <color_fragment>; modify `diffuseColor` (vec4, linear)
//   fragRough     : after <roughnessmap_fragment>; modify `roughnessFactor`
//   fragMetal     : after <metalnessmap_fragment>; modify `metalnessFactor`
//   fragNormal    : after <normal_fragment_maps>; modify `normal` (VIEW space, normalized)
//   fragEmissive  : after <emissivemap_fragment>; modify `totalEmissiveRadiance`
//   fragLight     : after <lights_fragment_end>; may add to reflectedLight.* (e.g. leaf translucency)
//   fragEnd       : right before <opaque_fragment>; modify `outgoingLight`
//   uniforms      : extra uniforms {name: {value}} (shared objects are kept by reference)
//   defines       : extra defines
// ---------------------------------------------------------------------------

const COMMON_HEAD = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uShot;
${NOISE}
`;

const FRAG_UTIL = /* glsl */ `
vec3 n_bumpView(vec3 p, vec3 n, float h, float strength){
  vec3 dpdx = dFdx(p), dpdy = dFdy(p);
  float dhdx = dFdx(h), dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * n - strength * grad);
}
vec3 n_worldNormalFromView(vec3 nv){ return normalize((vec4(nv, 0.0) * viewMatrix).xyz); }
`;

export function patch(mat, o = {}) {
  const parts = [o.vertexHead, o.vertexWorld, o.fragHead, o.fragColor, o.fragRough, o.fragMetal, o.fragNormal, o.fragEmissive, o.fragPhysical, o.fragLight, o.fragEnd, JSON.stringify(o.defines || {})];
  const key = 'p' + hashString(parts.map((s) => s || '').join('|'));
  const prev = mat.onBeforeCompile;
  mat.userData.patch = o;
  if (o.defines) mat.defines = Object.assign(mat.defines || {}, o.defines);
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(shader, renderer);
    shader.uniforms.uTime = G.uTime;
    shader.uniforms.uWindDir = G.uWindDir;
    shader.uniforms.uWindStrength = G.uWindStrength;
    shader.uniforms.uSunDir = G.uSunDir;
    shader.uniforms.uSunColor = G.uSunColor;
    shader.uniforms.uShot = G.uShot;
    if (o.uniforms) Object.assign(shader.uniforms, o.uniforms);

    let vs = shader.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${COMMON_HEAD}\n${WIND_GLSL}\n${o.vertexHead || ''}`);
    vs = vs.replace(
      '#include <project_vertex>',
      /* glsl */ `
      vec4 wPos4 = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        wPos4 = batchingMatrix * wPos4;
      #endif
      #ifdef USE_INSTANCING
        wPos4 = instanceMatrix * wPos4;
      #endif
      wPos4 = modelMatrix * wPos4;
      {
        vec3 _on = objectNormal;
        #ifdef USE_BATCHING
          _on = mat3(batchingMatrix) * _on;
        #endif
        #ifdef USE_INSTANCING
          _on = mat3(instanceMatrix) * _on;
        #endif
        vWNrm = mat3(modelMatrix) * _on;
      }
      ${o.vertexWorld || ''}
      vWPos = wPos4.xyz;
      vec4 mvPosition = viewMatrix * wPos4;
      gl_Position = projectionMatrix * mvPosition;
      `
    );
    vs = vs.replace(
      '#include <worldpos_vertex>',
      /* glsl */ `
      #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
        vec4 worldPosition = wPos4;
      #endif
      `
    );
    // objectNormal is not defined for depth/distance materials -> make sure it exists
    if (!vs.includes('beginnormal_vertex')) {
      vs = vs.replace('#include <begin_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#include <begin_vertex>');
    }
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>\n${COMMON_HEAD}\n${FRAG_UTIL}\n${o.fragHead || ''}`);
    if (o.fragColor) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${o.fragColor}`);
    if (o.fragRough) fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${o.fragRough}`);
    if (o.fragMetal) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${o.fragMetal}`);
    if (o.fragNormal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${o.fragNormal}`);
    if (o.fragEmissive) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${o.fragEmissive}`);
    if (o.fragPhysical) fs = fs.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${o.fragPhysical}`);
    if (o.fragLight) fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${o.fragLight}`);
    if (o.fragEnd) fs = fs.replace('#include <opaque_fragment>', `${o.fragEnd}\n#include <opaque_fragment>`);
    shader.fragmentShader = fs;
  };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => key;
  mat.needsUpdate = true;
  return mat;
}

// Patch a depth material (shadow casting) with the same world-space vertex displacement.
export function depthMaterialFor(o = {}, base = {}) {
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, ...base });
  patch(dm, { vertexHead: o.vertexHead, vertexWorld: o.vertexWorld });
  return dm;
}

// ---------------------------------------------------------------------------
// Convenience factories
// ---------------------------------------------------------------------------
export function std(params = {}, proc = null) {
  const m = new THREE.MeshStandardMaterial(params);
  if (proc) patch(m, proc);
  return m;
}
export function phys(params = {}, proc = null) {
  const m = new THREE.MeshPhysicalMaterial(params);
  if (proc) patch(m, proc);
  return m;
}
// Emissive glow (lantern paper, flames, window light). `color` linear RGB, `intensity` HDR multiplier.
export function glow(color = [1.0, 0.55, 0.22], intensity = 8, params = {}) {
  const c = new THREE.Color().setRGB(color[0], color[1], color[2]).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, ...params });
}

// ---------------------------------------------------------------------------
// Procedural surface GLSL snippets (reuse in custom materials)
// ---------------------------------------------------------------------------
export const PROC = {};

// Vermilion lacquered wood (shu-nuri) with weathering, grime and subtle grain.
PROC.lacquer = (base = 'vec3(0.50, 0.072, 0.028)') => ({
  fragHead: /* glsl */ `float g_h;`,
  fragColor: /* glsl */ `
    {
      vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
      float big = n_fbm3(wp * 0.23, 3);
      float mid = n_fbm3(wp * vec3(1.6, 0.35, 1.6), 3);
      // fine grain, stretched along the dominant member axis guess (vertical for columns)
      float vert = 1.0 - abs(wn.y);
      vec3 gs = mix(vec3(9.0, 9.0, 0.9), vec3(9.0, 0.7, 9.0), vert);
      float grain = n_snoise3(wp * gs) * 0.5 + n_snoise3(wp * gs * 2.7) * 0.25;
      vec3 base = ${base};
      vec3 col = base * (0.88 + 0.16 * big + 0.05 * grain);
      // sun-faded / chalky patches
      float fade = smoothstep(0.25, 0.75, mid * 0.6 + 0.5 + big * 0.3);
      col = mix(col, base * vec3(1.18, 1.5, 1.6) * 0.92, fade * 0.18);
      // worn edges showing dark wood (rare)
      float wear = smoothstep(0.62, 0.8, n_fbm3(wp * 2.6, 3) * 0.5 + 0.5);
      col = mix(col, vec3(0.09, 0.035, 0.02), wear * 0.55);
      // ground grime
      float grime = 1.0 - smoothstep(0.0, 1.4, wp.y - 0.0);
      col *= 1.0 - grime * 0.25 * (0.6 + 0.4 * big);
      diffuseColor.rgb *= col;
      g_h = grain * 0.35 + wear * 0.4 + mid * 0.2;
    }
  `,
  fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor * (0.85 + 0.3 * (g_h + 0.3)), 0.12, 1.0);`,
  fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0025);`,
});

// Gold leaf / gilt bronze fittings.
PROC.gold = (base = 'vec3(1.0, 0.70, 0.30)') => ({
  fragHead: /* glsl */ `float g_h;`,
  fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      float n = n_fbm3(wp * 3.1, 3);
      float tarnish = smoothstep(0.2, 0.75, n_fbm3(wp * 0.9 + 7.0, 3) * 0.5 + 0.5);
      vec3 base = ${base};
      vec3 col = base * (0.92 + 0.12 * n);
      col = mix(col, base * vec3(0.55, 0.42, 0.25), tarnish * 0.35);
      diffuseColor.rgb *= col;
      g_h = n * 0.5 + tarnish * 0.3;
    }
  `,
  fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_h * 0.12, 0.05, 1.0);`,
  fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0012);`,
});

// Cast bronze (bells, hanging lanterns) with dark patina.
PROC.bronze = () => ({
  fragHead: /* glsl */ `float g_h; float g_pat;`,
  fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      float n = n_fbm3(wp * 4.0, 4);
      g_pat = smoothstep(-0.1, 0.5, n_fbm3(wp * 1.7 + 3.0, 3));
      vec3 bronze = vec3(0.55, 0.36, 0.16) * (0.85 + 0.2 * n);
      vec3 patina = mix(vec3(0.05, 0.045, 0.035), vec3(0.10, 0.16, 0.12), smoothstep(0.3, 0.8, n * 0.5 + 0.5));
      diffuseColor.rgb *= mix(bronze, patina, g_pat * 0.7);
      g_h = n;
    }
  `,
  fragRough: /* glsl */ `roughnessFactor = mix(0.32, 0.75, g_pat * 0.7);`,
  fragMetal: /* glsl */ `metalnessFactor = mix(1.0, 0.25, g_pat * 0.7);`,
  fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.002);`,
});

// Dark ceramic roof tile (ibushi-gawara): blue-grey with silvery sheen, dust and lichen.
PROC.roofTile = () => ({
  fragHead: /* glsl */ `float g_h;`,
  fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      float n = n_fbm3(wp * 0.6, 3);
      float f = n_snoise3(wp * 9.0);
      vec3 col = vec3(0.060, 0.066, 0.078) * (0.85 + 0.25 * n + 0.06 * f);
      float lichen = smoothstep(0.55, 0.85, n_fbm3(wp * 2.3 + 11.0, 4) * 0.5 + 0.5);
      col = mix(col, vec3(0.16, 0.15, 0.11), lichen * 0.35);
      float dust = smoothstep(0.2, 0.9, normalize(vWNrm).y) * (0.5 + 0.5 * n);
      col = mix(col, vec3(0.12, 0.11, 0.10), dust * 0.12);
      diffuseColor.rgb *= col;
      g_h = f * 0.3 + lichen * 0.4;
    }
  `,
  fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_h * 0.25, 0.2, 1.0);`,
  fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.003);`,
});

// White lime plaster with rain streaks and grime.
PROC.plaster = () => ({
  fragHead: /* glsl */ `float g_h;`,
  fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      float n = n_fbm3(wp * 0.8, 4);
      float streak = n_fbm3(wp * vec3(3.0, 0.25, 3.0), 3);
      vec3 col = vec3(0.78, 0.75, 0.68) * (0.92 + 0.08 * n);
      col *= 1.0 - smoothstep(0.1, 0.7, streak) * 0.18;
      diffuseColor.rgb *= col;
      g_h = n_snoise3(wp * 14.0) * 0.5 + n * 0.5;
    }
  `,
  fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0015);`,
});

// Granite with speckles, lichen and moss on up-facing surfaces. mossAmt 0..1
PROC.granite = (mossAmt = '0.6', tint = 'vec3(1.0)') => ({
  fragHead: /* glsl */ `float g_h; float g_moss;`,
  fragColor: /* glsl */ `
    {
      vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
      float big = n_fbm3(wp * 0.45, 4);
      float speck = n_snoise3(wp * 38.0);
      float speck2 = n_snoise3(wp * 61.0 + 5.0);
      vec3 col = vec3(0.34, 0.33, 0.31) * ${tint} * (0.82 + 0.25 * big);
      col = mix(col, vec3(0.06, 0.06, 0.06), smoothstep(0.55, 0.85, speck) * 0.8);
      col = mix(col, vec3(0.62, 0.60, 0.56), smoothstep(0.6, 0.9, speck2) * 0.6);
      // dark weathering streaks + damp base
      float streak = n_fbm3(wp * vec3(2.2, 0.35, 2.2), 3);
      col *= 1.0 - smoothstep(0.0, 0.6, streak) * 0.3;
      // lichen blotches (pale yellow-grey)
      float lich = smoothstep(0.62, 0.78, n_fbm3(wp * 1.9 + 3.3, 4) * 0.5 + 0.5);
      col = mix(col, vec3(0.42, 0.42, 0.30), lich * 0.45);
      // moss: up-facing + crevices noise
      float up = smoothstep(0.15, 0.85, wn.y);
      float mn = n_fbm3(wp * 1.3 + 9.1, 5) * 0.5 + 0.5;
      g_moss = clamp(smoothstep(0.62 - 0.35 * up * ${mossAmt}, 0.82, mn + up * 0.15) * ${mossAmt}, 0.0, 1.0);
      vec3 mossCol = mix(vec3(0.045, 0.075, 0.012), vec3(0.12, 0.16, 0.03), n_snoise3(wp * 7.0) * 0.5 + 0.5);
      col = mix(col, mossCol, g_moss);
      diffuseColor.rgb *= col;
      g_h = big * 0.5 + speck * 0.08 + g_moss * 0.6 + n_snoise3(wp * 12.0) * 0.12;
    }
  `,
  fragRough: /* glsl */ `roughnessFactor = mix(0.72, 0.95, g_moss);`,
  fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.01);`,
});

// Weathered timber (bridge deck, raw wood). grainAxis: 'x' | 'y' | 'z'
PROC.wood = (base = 'vec3(0.24, 0.15, 0.09)', grainAxis = 'x') => {
  const sc = grainAxis === 'x' ? 'vec3(0.4, 14.0, 14.0)' : grainAxis === 'y' ? 'vec3(14.0, 0.4, 14.0)' : 'vec3(14.0, 14.0, 0.4)';
  return {
    fragHead: /* glsl */ `float g_h;`,
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float g = n_fbm3(wp * ${sc}, 4);
        float ringsRaw = sin(g * 18.0) * 0.5 + 0.5;
        float rings = mix(ringsRaw, 0.5, clamp(fwidth(g * 18.0) * 0.6, 0.0, 1.0));
        float big = n_fbm3(wp * 0.5, 3);
        vec3 base = ${base};
        vec3 col = base * (0.75 + 0.35 * rings * (0.6 + 0.4 * big) + 0.15 * big);
        diffuseColor.rgb *= col;
        g_h = rings * 0.5 + g * 0.3;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + (g_h - 0.4) * 0.15, 0.1, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.002);`,
  };
};

// ---------------------------------------------------------------------------
// The shared material library. Use these instances (they are shared so the
// renderer compiles each program once). Create variants with std()/phys()+PROC.
// ---------------------------------------------------------------------------
let _lib = null;
export function materials() {
  if (_lib) return _lib;
  const M = {};
  M.lacquerRed = phys({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }, PROC.lacquer());
  M.lacquerRedDark = phys({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }, PROC.lacquer('vec3(0.30, 0.040, 0.020)'));
  M.lacquerOrange = phys({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }, PROC.lacquer('vec3(0.62, 0.13, 0.035)'));
  M.gold = std({ color: 0xffffff, roughness: 0.24, metalness: 1.0 }, PROC.gold());
  M.goldBright = std({ color: 0xffffff, roughness: 0.16, metalness: 1.0 }, PROC.gold('vec3(1.0, 0.76, 0.36)'));
  M.goldLeaf = std({ color: 0xffffff, roughness: 0.32, metalness: 1.0 }, PROC.gold('vec3(1.0, 0.72, 0.32)'));
  M.bronze = std({ color: 0xffffff, roughness: 0.4, metalness: 1.0 }, PROC.bronze());
  M.blackLacquer = phys({ color: new THREE.Color().setRGB(0.018, 0.016, 0.014), roughness: 0.3, metalness: 0, clearcoat: 1.0, clearcoatRoughness: 0.12 });
  M.roofTile = std({ color: 0xffffff, roughness: 0.42, metalness: 0.12 }, PROC.roofTile());
  M.plaster = std({ color: 0xffffff, roughness: 0.93, metalness: 0 }, PROC.plaster());
  M.granite = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.granite('0.55'));
  M.graniteMossy = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.granite('1.0', 'vec3(0.92, 0.95, 0.9)'));
  M.graniteClean = std({ color: 0xffffff, roughness: 0.75, metalness: 0 }, PROC.granite('0.12', 'vec3(1.08, 1.06, 1.03)'));
  M.woodRaw = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.wood('vec3(0.24, 0.16, 0.10)', 'x'));
  M.woodRawZ = std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, PROC.wood('vec3(0.24, 0.16, 0.10)', 'z'));
  M.woodFloorX = phys({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }, PROC.wood('vec3(0.16, 0.075, 0.04)', 'x'));
  M.woodFloorZ = phys({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 }, PROC.wood('vec3(0.16, 0.075, 0.04)', 'z'));
  M.woodDark = std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, PROC.wood('vec3(0.07, 0.04, 0.025)', 'y'));
  M.latticeGreen = std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, PROC.lacquer('vec3(0.05, 0.16, 0.11)'));
  M.whitePaint = std({ color: new THREE.Color().setRGB(0.80, 0.78, 0.72), roughness: 0.75 });
  M.lanternGlow = glow([1.0, 0.58, 0.24], 9);
  M.lanternGlowSoft = glow([1.0, 0.62, 0.30], 4);
  M.flame = glow([1.0, 0.62, 0.25], 40);
  _lib = M;
  return M;
}
