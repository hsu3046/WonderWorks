import { cachedAtlas } from '../core/atlas-cache.js';
// ---------------------------------------------------------------------------
// VEGETATION — hero trees (black pine niwaki, Japanese maples green/red,
// cherries), framing canopies for the shots, clipped azalea / boxwood mounds,
// ferns. Everything procedural: recursive branch skeletons meshed as tapered
// tubes with procedural bark; foliage as instanced alpha-tested cards with
// canvas-drawn atlases, wind sway, backlit translucency, crown AO and bent
// canopy normals.
// ---------------------------------------------------------------------------
import { makeMapleAtlas, makeMapleHeroAtlas, makeSamaraTexture, makePineAtlas, makeBlossomAtlas, makeShrubAtlas, makeFernTexture } from './vegetation-tex.js';
import { heroLeafGeo, samaraGeo, buildHeroSpray } from './vegetation-hero.js';
import { CushionAccum, spow } from './vegetation-core.js';
import { SHOTS } from '../shots.js';
import { genMaple, genCherry, genPine, genTiered, padLocal, padNormal, padTopF, BarkAccum, trunkDisp, sampleBranch, envRho, envNormal, randUnit, perpOf, vnoise3 } from './vegetation-tree.js';

const TAU = Math.PI * 2;

// ===========================================================================
// GLSL
// ===========================================================================
// Vegetation wind: same large-scale sway / gusts as the shared windOffset(), but the leaf flutter
// runs at 0.5-0.75 Hz with half the amplitude. At 60 fps the 1.1-1.75 Hz flutter made every
// sunlit spray shimmer frame to frame (read as flicker); slow flutter reads as breeze.
const VEG_WIND = /* glsl */ `
vec3 vegWind(vec3 wp, float flex){
  float t = uTime;
  vec2 wd = uWindDir;
  float gust = 0.55 + 0.45 * sin(t * 0.37 + dot(wp.xz, wd) * 0.05) * sin(t * 0.23 + wp.x * 0.02);
  float sway = sin(t * 1.1 + dot(wp.xz, vec2(0.13, 0.11))) * 0.6 + sin(t * 1.7 + wp.y * 0.4 + wp.x * 0.3) * 0.3;
  float flutter = sin(t * 3.1 + dot(wp, vec3(2.1, 1.7, 2.9))) * 0.25 + sin(t * 4.7 + dot(wp, vec3(3.7, 2.3, 1.9))) * 0.12;
  vec3 o;
  o.xz = wd * (sway * 0.05 + gust * 0.045) * flex;
  o.y = flutter * 0.01 * flex;
  o.xz += vec2(flutter * 0.008, -flutter * 0.006) * flex;
  return o * uWindStrength;
}
`;

// Drifting leaves: positions are a pure function of (uTime, per-instance seeds, current shot), so
// every frame / sub-frame is deterministic. Per shot: a box volume the leaves fall through (wrapping,
// with a scale fade at the box faces), slow fall + breeze, pendulum sway and slow tumbling.
const DRIFT_HEAD = /* glsl */ `
attribute vec4 aSeed; attribute vec4 aSeed2;
uniform vec4 uDC[10]; uniform vec4 uDS[10]; uniform vec4 uDW[10]; uniform vec3 uDA[10]; uniform vec3 uDB[10];
mat3 d_rot(vec3 a, float g){
  float c = cos(g), s = sin(g), t = 1.0 - c;
  return mat3(t*a.x*a.x + c, t*a.x*a.y + s*a.z, t*a.x*a.z - s*a.y,
              t*a.x*a.y - s*a.z, t*a.y*a.y + c, t*a.y*a.z + s*a.x,
              t*a.x*a.z + s*a.y, t*a.y*a.z - s*a.x, t*a.z*a.z + c);
}
`;
const DRIFT_VW = /* glsl */ `
{
  int sh = int(floor(uShot + 0.5));
  vec4 C = vec4(0.0), Sz = vec4(1.0), W = vec4(0.0);
  vec3 cA = vec3(0.3, 0.02, 0.01), cB = cA;
  for (int k = 0; k < 10; k++) if (k == sh) { C = uDC[k]; Sz = uDS[k]; W = uDW[k]; cA = uDA[k]; cB = uDB[k]; }
  if (C.w < 0.5 || float(gl_InstanceID) >= W.w) {
    wPos4 = vec4(0.0, -500.0, 0.0, 1.0);
  } else {
    float t = uTime;
    vec4 sd = aSeed, s2 = aSeed2;
    float vy = W.y * (0.75 + 0.5 * s2.w);
    vec3 p;
    p.y = C.y + Sz.y * (0.5 - fract(sd.y + t * vy / Sz.y));
    p.x = C.x + Sz.x * (fract(sd.x + t * W.x / Sz.x) - 0.5);
    p.z = C.z + Sz.z * (fract(sd.z + t * W.z / Sz.z) - 0.5);
    float w1 = 0.7 + 0.7 * s2.x;
    float amp = 0.1 + 0.14 * s2.y;
    p.x += amp * sin(t * w1 + s2.y * 6.2831);
    p.z += amp * cos(t * w1 * 0.87 + s2.y * 6.2831);
    vec3 q = abs(p - C.xyz) / (Sz.xyz * 0.5);
    float fade = (1.0 - smoothstep(0.72, 1.0, q.x)) * (1.0 - smoothstep(0.72, 1.0, q.y)) * (1.0 - smoothstep(0.72, 1.0, q.z));
    vec3 ax = normalize(vec3(s2.z - 0.5, 0.6, s2.x - 0.5) + vec3(sin(t * 0.5 + sd.w * 6.0), 0.0, cos(t * 0.4 + sd.w * 5.0)) * 0.4);
    float ang = t * (0.8 + 1.1 * sd.w) * (s2.z > 0.5 ? 1.0 : -1.0) + s2.w * 6.2831;
    float sc = Sz.w * (0.8 + 0.4 * sd.w) * fade;
    wPos4.xyz = p + d_rot(ax, ang) * ((transformed - vec3(0.0, 0.5, 0.0)) * sc);
    #if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
      vColor.rgb = mix(cA, cB, s2.x);
    #endif
  }
}
`;
const BARK_HEAD = /* glsl */ `
varying vec4 vBarkA;   // x: around (cells, periodic k), y: along (m), z: radius, w: flex
varying vec3 vBarkB;   // x: k cells around, y: seed, z: cell width (m)
float g_h; float g_r;
// pixel footprint (m) and cell-resolve factor: sub-pixel bark cells / cracks / grain fade to their
// mean (no shimmer at distance, full relief up close)
float g_fp; float g_aa;
float b_aaf(float f){ return 1.0 - smoothstep(0.18, 0.55, g_fp * f); }
vec3 b_worleyP(vec2 p, float per, float seed){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; float id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 c = i + g; c.x = mod(c.x, per);
    vec2 o = n_hash22(c + seed * 0.137);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = n_hash12(c * 1.7 + seed); } else if (d < d2){ d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
float b_moss(vec3 wp, vec3 wn){
  float up = smoothstep(0.2, 0.85, wn.y);
  float base = 1.0 - smoothstep(0.1, 1.1, wp.y);
  float n = n_fbm3(wp * 2.3 + 4.0, 3) * 0.5 + 0.5;
  return clamp(smoothstep(0.5, 0.75, n) * (up * 0.75 + base * 0.9), 0.0, 1.0);
}
`;

const BARK_COLOR = {
  pine: /* glsl */ `
  {
    float k = vBarkB.x, cw = vBarkB.z, r = vBarkA.z;
    vec3 wp = vWPos;
    g_fp = length(fwidth(wp)); g_aa = 1.0 - smoothstep(0.12, 0.45, g_fp / max(cw, 1e-4));
    // tall irregular plates: stretched along the stem + domain warp breaks the cell regularity
    vec2 p = vec2(vBarkA.x, vBarkA.y / (cw * 2.4));
    p += vec2(n_snoise3(wp * 2.3) * 0.32, n_snoise3(wp * 2.3 + 7.1) * 0.45);
    vec3 w = b_worleyP(p, k, vBarkB.y);
    float edge = w.y - w.x;
    float cvar = n_snoise3(wp * 5.0 + 3.0) * 0.5 + 0.5;
    float crack = (1.0 - smoothstep(0.02 + 0.05 * cvar, 0.16 + 0.14 * cvar, edge)) * g_aa;
    // flaky sub-layers inside each plate (smaller, offset cells)
    vec3 w2 = b_worleyP(p * vec2(1.0, 2.2) * 2.0 + w.z * 3.0, k * 2.0, vBarkB.y + 11.0);
    float sub = mix(0.7, smoothstep(0.0, 0.25, w2.y - w2.x), g_aa * g_aa);
    float fine = mix(0.5, n_snoise3(wp * 41.0) * 0.5 + 0.5, b_aaf(41.0));
    float flake = n_fbm3(wp * 7.0, 3) * 0.5 + 0.5;
    float thick = smoothstep(0.035, 0.13, r);
    vec3 plateCol = mix(vec3(0.062, 0.057, 0.053), vec3(0.15, 0.135, 0.12), w.z * 0.7 + cvar * 0.3);
    // freshly shed patches: warm red-brown under the grey outer layer
    float shed = smoothstep(0.55, 0.8, flake + w2.z * 0.25 - sub * 0.15);
    plateCol = mix(plateCol, vec3(0.26, 0.12, 0.065), shed * 0.6);
    plateCol *= 0.8 + 0.25 * sub;
    vec3 youngCol = vec3(0.12, 0.075, 0.05) * (0.75 + 0.5 * flake);
    vec3 col = mix(youngCol, plateCol, thick);
    col *= 0.85 + 0.3 * fine;
    col = mix(col, vec3(0.012, 0.01, 0.009), crack * thick);
    // weathered lichen flecks on the plates
    float lich = smoothstep(0.66, 0.82, n_fbm3(wp * 3.7 + 9.0, 3) * 0.5 + 0.5) * (1.0 - crack);
    col = mix(col, vec3(0.2, 0.21, 0.17), lich * 0.4 * thick);
    float moss = b_moss(wp, normalize(vWNrm)) * 0.8;
    col = mix(col, vec3(0.055, 0.085, 0.02) * (0.7 + 0.6 * fine), moss);
    diffuseColor.rgb *= col;
    float dome = 1.0 - smoothstep(0.0, 0.55, w.x);   // plates are convex
    g_h = ((1.0 - crack) * (0.45 + 0.35 * w.z + 0.25 * dome) - (1.0 - sub) * 0.12) * thick + fine * 0.08 + flake * 0.2 * (1.0 - thick) + moss * 0.2;
    g_r = 0.8 + crack * 0.15;
  }`,
  maple: /* glsl */ `
  {
    float k = vBarkB.x, cw = vBarkB.z, r = vBarkA.z;
    vec2 p = vec2(vBarkA.x, vBarkA.y / (cw * 5.0));
    vec3 w = b_worleyP(p, k, abs(vBarkB.y));
    vec3 wp = vWPos;
    g_fp = length(fwidth(wp)); g_aa = 1.0 - smoothstep(0.12, 0.45, g_fp / max(cw, 1e-4));
    float stri = mix(0.6, smoothstep(0.0, 0.3, w.y - w.x), g_aa);
    float mott = n_fbm3(wp * 3.1, 4) * 0.5 + 0.5;
    float lich = smoothstep(0.6, 0.8, n_fbm3(wp * 4.3 + 3.0, 3) * 0.5 + 0.5);
    vec3 col = mix(vec3(0.034, 0.034, 0.031), vec3(0.085, 0.083, 0.074), mott);
    col = mix(col, vec3(0.19, 0.2, 0.15), lich * 0.5);
    col *= 0.86 + 0.14 * stri;
    vec3 twig = vBarkB.y < 0.0 ? vec3(0.13, 0.022, 0.022) : vec3(0.11, 0.085, 0.04);
    col = mix(twig, col, smoothstep(0.006, 0.035, r));
    float moss = b_moss(wp, normalize(vWNrm)) * 0.6;
    col = mix(col, vec3(0.06, 0.09, 0.022), moss);
    diffuseColor.rgb *= col;
    g_h = stri * 0.35 + mott * 0.35 + lich * 0.3 + moss * 0.3;
    g_r = 0.72 - lich * 0.05 + moss * 0.2;
  }`,
  cherry: /* glsl */ `
  {
    float k = vBarkB.x, cw = vBarkB.z, r = vBarkA.z;
    vec2 p = vec2(vBarkA.x, vBarkA.y / (cw * 0.26));
    vec3 w = b_worleyP(p, k, vBarkB.y);
    vec3 wp = vWPos;
    g_fp = length(fwidth(wp)); g_aa = 1.0 - smoothstep(0.12, 0.45, g_fp / max(cw, 1e-4));
    float lent = (1.0 - smoothstep(0.16, 0.3, w.x)) * (1.0 - smoothstep(0.12, 0.45, g_fp / max(cw * 0.26, 1e-4)));
    float fine = mix(0.5, n_snoise3(wp * 33.0) * 0.5 + 0.5, b_aaf(33.0));
    float big = n_fbm3(wp * 2.2, 3) * 0.5 + 0.5;
    float thick = smoothstep(0.06, 0.22, r);
    vec3 col = mix(vec3(0.058, 0.032, 0.03), vec3(0.11, 0.06, 0.052), w.z * 0.6 + big * 0.4);
    // old rough trunk: vertical fissures, greyer
    vec2 q = vec2(vBarkA.x, vBarkA.y / (cw * 2.5));
    vec3 w2 = b_worleyP(q, k, vBarkB.y + 7.0);
    float fiss = (1.0 - smoothstep(0.02, 0.14, w2.y - w2.x)) * g_aa;
    vec3 oldCol = mix(vec3(0.075, 0.058, 0.05), vec3(0.14, 0.12, 0.1), big);
    col = mix(col, oldCol, thick * 0.55);
    col = mix(col, vec3(0.022, 0.016, 0.014), fiss * thick * 0.85);
    col = mix(col, vec3(0.2, 0.16, 0.13), lent * (1.0 - thick * 0.6) * 0.8);
    col *= 0.85 + 0.3 * fine;
    float moss = b_moss(wp, normalize(vWNrm)) * 0.75;
    col = mix(col, vec3(0.06, 0.09, 0.022), moss);
    diffuseColor.rgb *= col;
    g_h = lent * 0.5 + (1.0 - fiss * thick) * 0.6 + fine * 0.1 + moss * 0.25;
    g_r = mix(0.42, 0.85, max(thick * 0.8, moss)) + lent * 0.1;
  }`,
};

// foliage colourisation per kind
const FOL_COLOR = {
  // data texture: r shade/veins, g base->tip gradient, b blotch noise
  maple: /* glsl */ `
  {
    vec4 tx = sampledDiffuseColor;
    float shade = tx.r, grad = tx.g, blotch = tx.b;
    vec3 base = vColor.rgb;
    float acc = clamp(abs(vFol.z) * (smoothstep(0.2, 1.0, grad + (blotch - 0.5) * 0.7) * 1.2), 0.0, 1.0);
    vec3 accC = vFol.z < 0.0 ? uAccent2 : uAccent;
    vec3 col = mix(base, accC * (0.7 + 0.6 * blotch), acc);
    col = mix(uPetiole, col, smoothstep(0.0, 0.07, grad));
    col *= (0.42 + 0.9 * shade) * (0.88 + 0.24 * blotch);
    diffuseColor.rgb = col;
  }`,
  pine: /* glsl */ `
  {
    vec4 tx = sampledDiffuseColor;
    float shade = tx.r, along = tx.g, tint = tx.b;
    vec3 base = vColor.rgb * mix(vec3(0.92, 1.0, 0.86), vec3(1.06, 1.0, 1.2), tint);
    vec3 tipC = base * vec3(1.62, 1.62, 1.05);
    vec3 col = mix(base * 0.3, tipC, smoothstep(0.05, 1.0, along) * (0.45 + 0.55 * vFol.z));
    // sun-bleached tan needle tips (they glow straw-gold when backlit)
    col = mix(col, vec3(0.13, 0.1, 0.042) * (0.8 + 0.4 * tint), smoothstep(0.7, 0.97, along) * (0.1 + 0.28 * vFol.z));
    col *= 0.5 + 0.7 * shade;
    col = mix(vec3(0.045, 0.035, 0.022), col, smoothstep(0.22, 0.36, shade));
    diffuseColor.rgb = col;
  }`,
  rgb: /* glsl */ ``,
  // macro hero blades: crimson lobes with an amber-orange flush around the petiole and along the
  // primaries, yellow-orange vein network, darkened drying tips; the texture petiole is cut away
  // (real petiole tubes carry the blade)
  mapleHero: /* glsl */ `
  {
    // hero atlas: r 0.5 blade / ->1 veins / ->0 margin band, g base->tip, b 0.5 / ->1 veinlet net / ->0 spots
    vec4 tx = sampledDiffuseColor;
    float rv = tx.r, grad = tx.g, bn = tx.b;
    float vein = smoothstep(0.56, 0.92, rv);
    float edge = smoothstep(0.46, 0.08, rv);
    float net = smoothstep(0.54, 0.9, bn);
    float spot = smoothstep(0.45, 0.05, bn);
    // per-leaf, surface-anchored low-frequency blotch (static, far below pixel frequency)
    vec2 bu = vMapUv * 9.0 + vec2(vInstId * 1.37, vInstId * 0.71);
    float blotch = n_vnoise(bu) * 0.65 + n_vnoise(bu * 2.7 + 3.1) * 0.35;
    vec3 base = vColor.rgb;
    // flush: amber-orange around the petiole spreading out along the primaries (negative: green-gold heart)
    float fl = (1.0 - smoothstep(0.03, 0.26 + 0.34 * blotch, grad - vein * 0.1)) * abs(vFol.z);
    vec3 fc = vFol.z < 0.0 ? uFlushB : uAccent;
    vec3 col = mix(base, fc * (0.8 + 0.4 * blotch), clamp(fl, 0.0, 1.0));
    col *= 0.8 + 0.4 * blotch;
    // crimson-brown drying lobe tips and margin band
    col = mix(col, uAccent2, clamp(smoothstep(0.8, 1.0, grad) * 0.55 * (0.35 + 0.65 * (1.0 - blotch)) + edge * 0.3, 0.0, 1.0));
    col = mix(col, vec3(0.035, 0.01, 0.004), spot * 0.85);
    // transmittance: primaries / secondaries carry less anthocyanin -> golden lines; the veinlet
    // net shades the areoles (stained glass); margin and spots are thicker / drier -> darker
    vec3 tr = col * uTransTint;
    tr = mix(tr, tr * vec3(1.1, 2.7, 1.5) + vec3(0.035, 0.016, 0.0), vein * 0.62);
    tr *= (1.0 - 0.42 * net) * (1.0 - 0.4 * edge) * (1.0 - 0.92 * spot);
    fol_TcH = clamp(tr, 0.0, 1.0);
    diffuseColor.rgb = col * (0.86 + 0.22 * vein - 0.1 * net);
  }`,
};

// ===========================================================================
// materials
// ===========================================================================
// Shadow depth material with the same world-space vertex displacement.
// (works around core depthMaterialFor(): MeshDepthMaterial only declares
// objectNormal inside #ifdef USE_DISPLACEMENTMAP, so the patched vertex
// shader references an undeclared identifier)
function depthMat(ctx, hooks, params = {}) {
  const { THREE } = ctx;
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, ...params });
  ctx.mat.patch(dm, { vertexHead: hooks.vertexHead, vertexWorld: hooks.vertexWorld, uniforms: hooks.uniforms });
  const ob = dm.onBeforeCompile;
  dm.onBeforeCompile = (shader, r) => {
    ob(shader, r);
    if (!/vec3\s+objectNormal\s*=\s*vec3\(\s*0\.0,\s*1\.0/.test(shader.vertexShader)) {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#ifndef USE_DISPLACEMENTMAP\n  vec3 objectNormal = vec3(0.0, 1.0, 0.0);\n#endif\n#include <begin_vertex>');
    }
  };
  return dm;
}

function barkMaterial(ctx, kind) {
  const { THREE } = ctx;
  const uBump = { value: kind === 'pine' ? 0.03 : kind === 'cherry' ? 0.008 : 0.005 };
  const vHooks = {
    vertexHead: VEG_WIND + /* glsl */ `attribute vec4 aBarkA; attribute vec3 aBarkB; varying vec4 vBarkA; varying vec3 vBarkB;`,
    vertexWorld: /* glsl */ `vBarkA = aBarkA; vBarkB = aBarkB; wPos4.xyz += vegWind(wPos4.xyz, aBarkA.w);`,
  };
  const hooks = {
    ...vHooks,
    fragHead: BARK_HEAD + '\nuniform float uBump;',
    fragColor: BARK_COLOR[kind],
    fragRough: /* glsl */ `roughnessFactor = clamp(g_r, 0.2, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, uBump * g_aa * (0.2 + 0.8 * smoothstep(0.015, 0.25, vBarkA.z)));`,
    uniforms: { uBump },
  };
  const m = ctx.mat.std({ color: 0xffffff, roughness: 0.8, metalness: 0 }, hooks);
  m.name = 'bark_' + kind;
  const dm = depthMat(ctx, vHooks);
  return { m, dm };
}

function foliageMaterial(ctx, kind, map, P = {}) {
  const { THREE } = ctx;
  const uniforms = {
    uTransTint: { value: new THREE.Vector3(...(P.transTint || [1.6, 1.7, 0.7])) },
    uTransBack: { value: P.transBack ?? 0.9 },
    uTransFwd: { value: P.transFwd ?? 1.6 },
    uTransPow: { value: P.transPow ?? 6.0 },
    uBend: { value: P.bend ?? 0.45 },
    uAOAmt: { value: P.ao ?? 1.0 },
    uAccent: { value: new THREE.Vector3(...(P.accent || [0.55, 0.22, 0.03])) },
    uAccent2: { value: new THREE.Vector3(...(P.accent2 || [0.16, 0.008, 0.03])) },
    uPetiole: { value: new THREE.Vector3(...(P.petiole || [0.22, 0.05, 0.03])) },
    uFlutter: { value: P.flutter ?? 0.02 },
    uTransDepth: { value: P.transDepth ?? 2.5 },
    uShadowRange: SHADOW_RANGE,
    uLeak: { value: P.leak ?? 0.55 },
    uLeakDiffuse: { value: P.leakDiffuse ?? 0.25 },
    uFatten: { value: P.fatten ?? 0.22 },
    uSpec: { value: P.spec ?? 1.0 },
    uSkyTrans: { value: P.skyTrans ?? 0.5 },
    uFwd2: { value: P.fwd2 ?? 0.0 },
  };
  if (P.uniforms) Object.assign(uniforms, P.uniforms);
  if (P.hero) {
    uniforms.uOccA = { value: P.hero.A };
    uniforms.uOccX = { value: P.hero.X };
    uniforms.uOccY = { value: P.hero.Y };
    uniforms.uOccTrans = { value: new THREE.Vector3(...(P.hero.trans || [0.3, 0.035, 0.02])) };
    uniforms.uOccMap = { value: map };
  }
  const hero = !!P.hero;
  const vHooks = {
    vertexHead: VEG_WIND + /* glsl */ `
      attribute vec4 aFol;   // x flex, y ao, z accent, w atlas cell
      attribute vec3 aBend;  // bent (canopy) normal, world
      varying vec4 vFol; varying vec3 vBendW;
      uniform float uFlutter;
      ${hero ? 'varying vec3 vRest; varying float vInstId;' : ''}
      ${P.vertexHead || ''}
    `,
    vertexWorld: /* glsl */ `
      vFol = aFol; vBendW = aBend;
      ${hero ? 'vRest = wPos4.xyz; vInstId = float(gl_InstanceID);' : ''}
      #ifdef USE_MAP
        vMapUv += vec2(mod(aFol.w, 2.0), floor(aFol.w * 0.5 + 0.01)) * 0.5;
      #endif
      ${P.vertexWorld || ''}
      if (${P.vertexWorld ? 'false' : 'true'}) {
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        // per-leaf flutter: slow (0.35-0.7 Hz), random phase; no high-frequency term (temporal shimmer)
        float ph = n_hash13(ip * 3.17) * 6.2831;
        float fl = sin(uTime * (2.2 + 2.2 * fract(ph * 1.7)) + ph) * 0.7 + sin(uTime * 3.3 + ph * 2.0) * 0.3;
        wPos4.xyz += vegWind(wPos4.xyz, aFol.x);
        wPos4.xyz += vec3(0.3, 1.0, -0.2) * fl * uFlutter * clamp(length(transformed), 0.0, 1.0) * uWindStrength * aFol.x;
      }
    `,
  };
  // macro hero leaves: exact leaf-shaped sun occlusion between the hero blades (light filtered
  // through each occluding blade), evaluated in rest space so the wind sway cannot detach it
  const HERO_HEAD = hero ? /* glsl */ `
    #define HERO_N ${P.hero.n}
    uniform vec4 uOccA[HERO_N]; uniform vec4 uOccX[HERO_N]; uniform vec4 uOccY[HERO_N];
    uniform vec3 uOccTrans; uniform sampler2D uOccMap;
    varying vec3 vRest; varying float vInstId;
    vec3 heroOcc(vec3 p, vec3 L) {
      vec3 T = vec3(1.0);
      for (int i = 0; i < HERO_N; i++) {
        if (abs(float(i) - vInstId) < 0.5) continue;
        vec3 o = uOccA[i].xyz, X = uOccX[i].xyz, Y = uOccY[i].xyz;
        vec3 N = cross(X, Y);
        float dn = dot(L, N);
        if (abs(dn) < 1e-12) continue;
        float t = dot(o - p, N) / dn;
        if (t < 0.004 || t > 0.8) continue;
        vec3 h = p + L * t - o;
        float a = dot(h, X) * uOccX[i].w, b = dot(h, Y) * uOccY[i].w;
        if (abs(a) > 0.5 || b < 0.0 || b > 1.0) continue;
        float cell = uOccA[i].w;
        vec2 uv = vec2(a + 0.5, 1.0 - b) * 0.5 + vec2(mod(cell, 2.0), floor(cell * 0.5 + 0.01)) * 0.5;
        vec4 tx = textureLod(uOccMap, uv, 1.5);
        float al = smoothstep(0.3, 0.7, tx.a);
        if (b < 0.4 && tx.g < 0.03) al = 0.0;
        T *= mix(vec3(1.0), uOccTrans, al);
      }
      return T;
    }
  ` : '';
  const hooks = {
    ...vHooks,
    fragHead: /* glsl */ `
      varying vec4 vFol; varying vec3 vBendW;
      uniform vec3 uTransTint; uniform float uTransBack, uTransFwd, uTransPow, uBend, uAOAmt;
      uniform float uTransDepth, uShadowRange, uLeak, uLeakDiffuse, uFatten, uSpec, uSkyTrans, uFwd2;
      uniform vec3 uAccent; uniform vec3 uAccent2; uniform vec3 uPetiole;
      ${kind === 'mapleHero' ? 'uniform vec3 uFlushB;' : ''}
      vec3 fol_faceN; vec3 fol_TcH = vec3(-1.0);
    ` + HERO_HEAD,
    fragColor: FOL_COLOR[kind] || '',
    fragNormal: /* glsl */ `
      ${P.flatNormal ? '{ vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))); if (dot(fn, vViewPosition) < 0.0) fn = -fn; normal = fn; }' : ''}
      fol_faceN = normal;
      {
        vec3 bv = normalize((viewMatrix * vec4(vBendW, 0.0)).xyz);
        normal = normalize(mix(normal, bv, uBend));
      }
    `,
    fragLight: /* glsl */ `
      vec3 fol_sunF = vec3(1.0);
      ${hero ? 'fol_sunF = heroOcc(vRest, normalize(uSunDir)); reflectedLight.directDiffuse *= fol_sunF; reflectedLight.directSpecular *= fol_sunF;' : ''}
      #if NUM_DIR_LIGHTS > 0
      {
        vec3 Ld = directLight.direction;
        float bk = dot(-fol_faceN, Ld);
        float back = max(bk, 0.0);
        float cvl = max(dot(-geometryViewDir, Ld), 0.0);
        float fgate = smoothstep(-0.25, 0.25, bk);
        float fwd = pow(cvl, uTransPow) * fgate;
        // narrow forward lobe around the sun disc: blades in front of the sun burn amber-gold
        // (light crossing the thinnest paths) instead of clipping to pink in the tonemapper
        float fwd2 = uFwd2 * pow(cvl, 56.0) * fgate;
        vec3 Tc = fol_TcH.x >= 0.0 ? fol_TcH : clamp(diffuseColor.rgb * uTransTint, 0.0, 1.0);
        // light leaking through the canopy itself: the shadow map is re-tested with the receiver
        // pulled uTransDepth metres toward the sun, so occluders closer than that (own leaves)
        // are ignored while distant occluders (buildings) still block.
        vec3 sunRaw = directionalLights[0].color;
        float sh = dot(directLight.color, vec3(0.333)) / max(dot(sunRaw, vec3(0.333)), 1e-5);
        float leak = 0.0;
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0 && defined( SHADOWMAP_TYPE_PCF )
        {
          vec4 sc = vDirectionalShadowCoord[0];
          vec3 c3 = sc.xyz / sc.w;
          if (c3.x > 0.0 && c3.x < 1.0 && c3.y > 0.0 && c3.y < 1.0 && c3.z < 1.0) {
            float dz = uTransDepth / max(uShadowRange, 1.0);
            leak = texture(directionalShadowMap[0], vec3(c3.xy, c3.z - dz));
          } else leak = 1.0;
        }
        #else
          leak = 1.0;
        #endif
        float leakVis = max(sh, leak * uLeak * (0.45 + 0.55 * vFol.y));
        vec3 Tc2 = mix(Tc, vec3(Tc.r, Tc.r * 0.45, Tc.r * 0.07), 0.65);
        reflectedLight.directDiffuse += sunRaw * fol_sunF * leakVis * (Tc * (back * uTransBack + fwd * uTransFwd) + Tc2 * fwd2 * uTransFwd) * RECIPROCAL_PI;
        // multiple scattering inside the crown: a little sun reaches shaded inner leaves
        reflectedLight.directDiffuse += sunRaw * fol_sunF * max(leak * uLeak - sh, 0.0) * uLeakDiffuse * max(dot(normal, Ld), 0.0) * diffuseColor.rgb * RECIPROCAL_PI;
      }
      #endif
      {
        float aoF = mix(1.0, vFol.y, uAOAmt);
        reflectedLight.indirectDiffuse *= aoF;
        reflectedLight.indirectSpecular *= aoF * uSpec;
        reflectedLight.directSpecular *= uSpec;
      }
      #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
      {
        // diffuse transmission of sky light arriving on the far side of the blade: canopies seen
        // from below glow green-gold against the sky instead of going black
        vec3 eT = getIBLIrradiance(-fol_faceN);
        float aoT = mix(1.0, vFol.y, uAOAmt * 0.75);
        reflectedLight.indirectDiffuse += eT * (fol_TcH.x >= 0.0 ? fol_TcH : clamp(diffuseColor.rgb * uTransTint, 0.0, 1.0)) * uSkyTrans * aoT * RECIPROCAL_PI;
      }
      #endif
    `,
    uniforms,
  };
  const m = ctx.mat.std({
    color: 0xffffff, map, roughness: P.roughness ?? 0.55, metalness: 0,
    alphaTest: 0.5, alphaToCoverage: !(typeof location !== "undefined" && /vega2c=0/.test(location.search)), side: ctx.THREE.DoubleSide,
  }, hooks);
  m.name = 'fol_' + kind + (P.name || '');
  // Centred alpha-to-coverage: three's default smoothstep(t, t + fwidth) maps alpha == t to zero
  // coverage, which makes distant (1-2 px) leaves vanish. Centre the ramp on the threshold instead
  // (coverage-preserving mips are tuned for a 0.5 threshold).
  {
    const ob = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      ob(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', /* glsl */ `
        #ifdef USE_ALPHATEST
          #ifdef ALPHA_TO_COVERAGE
            // leaf fattening: when a card shrinks to a few pixels, individual leaves are no longer
            // resolved; grow their alpha so the crown keeps its density instead of turning to lace
            {
              vec2 tsz = vMapUv * 1024.0;
              float lod = 0.5 * log2(max(dot(dFdx(tsz), dFdx(tsz)), dot(dFdy(tsz), dFdy(tsz))) + 1e-8);
              diffuseColor.a *= 1.0 + uFatten * clamp(lod - 3.0, 0.0, 3.5);
            }
            diffuseColor.a = clamp((diffuseColor.a - alphaTest) / max(fwidth(diffuseColor.a), 1e-4) + 0.5, 0.0, 1.0);
            if (diffuseColor.a <= 0.0) discard;
          #else
            if (diffuseColor.a < alphaTest) discard;
          #endif
        #endif
      `);
    };
  }
  const dm = depthMat(ctx, { ...vHooks, uniforms: { uFlutter: uniforms.uFlutter } }, { map, alphaTest: 0.5 });
  return { m, dm };
}

// shared: depth range (m) of the sun's shadow camera, refreshed before each draw
const SHADOW_RANGE = { value: 200 };
let _sunLight = null;
function refreshShadowRange(scene) {
  if (!_sunLight || !_sunLight.parent) {
    _sunLight = null;
    scene.traverse((o) => { if (!_sunLight && o.isDirectionalLight && o.castShadow) _sunLight = o; });
  }
  if (_sunLight) { const c = _sunLight.shadow.camera; SHADOW_RANGE.value = Math.max(1, c.far - c.near); }
}

// ===========================================================================
// card geometries
// ===========================================================================
function leafCardGeo(THREE, fold = 0.12) {
  // pivot at petiole end (0,0,0); blade towards +Y; face normal +Z.
  // 2 triangles; the V-fold of the blade is suggested through tilted vertex normals.
  const pos = [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, -0.05, -0.5, 1, -0.05];
  const nrm = [];
  for (let i = 0; i < 4; i++) {
    const x = pos[i * 3];
    const n = new THREE.Vector3(-Math.sign(x) * fold * 2.5, 0.1 * pos[i * 3 + 1], 1).normalize();
    nrm.push(n.x, n.y, n.z);
  }
  const uv = [0, 0.5, 0.5, 0.5, 0.5, 0, 0, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function tuftGeo(THREE) {
  // 3 vertical fan cards (needles bursting up from the base) + 1 tilted radial card
  const pos = [], nrm = [], uv = [], idx = [];
  const c = new THREE.Vector3(0, 0.3, 0);
  const add = (verts, uvs) => {
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const v = verts[i];
      pos.push(v.x, v.y, v.z);
      const n = v.clone().sub(c).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(uvs[i][0], uvs[i][1]);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (let k = 0; k < 2; k++) {
    const a = (k / 2) * Math.PI + 0.3;
    const dx = Math.cos(a) * 0.5, dz = Math.sin(a) * 0.5;
    add([new THREE.Vector3(-dx, 0, -dz), new THREE.Vector3(dx, 0, dz), new THREE.Vector3(dx, 1, dz), new THREE.Vector3(-dx, 1, -dz)],
      [[0, 0.5], [0.5, 0.5], [0.5, 0], [0, 0]]);
  }
  const y = 0.42, s = 0.55;
  add([new THREE.Vector3(-s, y - 0.05, -s), new THREE.Vector3(s, y + 0.05, -s), new THREE.Vector3(s, y + 0.05, s), new THREE.Vector3(-s, y - 0.05, s)],
    [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function clusterGeo(THREE, cards = 3) {
  // crossed cards centred on the origin with spherical normals
  const pos = [], nrm = [], uv = [], idx = [];
  const add = (verts) => {
    const b = pos.length / 3;
    const uvs = [[0, 0.5], [0.5, 0.5], [0.5, 0], [0, 0]];
    for (let i = 0; i < 4; i++) {
      const v = verts[i];
      pos.push(v.x, v.y, v.z);
      const n = v.clone().normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(uvs[i][0], uvs[i][1]);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  add([V(-0.5, -0.5, 0), V(0.5, -0.5, 0), V(0.5, 0.5, 0), V(-0.5, 0.5, 0)]);
  add([V(0, -0.5, -0.5), V(0, -0.5, 0.5), V(0, 0.5, 0.5), V(0, 0.5, -0.5)]);
  if (cards > 2) add([V(-0.5, 0.02, 0.5), V(0.5, -0.02, 0.5), V(0.5, 0.02, -0.5), V(-0.5, -0.02, -0.5)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function shrubCardGeo(THREE) {
  const g = new THREE.BufferGeometry();
  const pos = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
  const nrm = [];
  for (let i = 0; i < 4; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1];
    const n = [x * 0.6, y * 0.6, 1]; const l = Math.hypot(...n);
    nrm.push(n[0] / l, n[1] / l, n[2] / l);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0.5, 0.5, 0.5, 0.5, 0, 0, 0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function frondGeo(THREE, segs = 6) {
  // frond strip from base (0,0,0) up +Y, arching toward +Z; uv: full texture (fern tex, not an atlas)
  const pos = [], nrm = [], uv = [], idx = [];
  let y = 0, z = 0, a = 0.0;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.5;
    const n = new THREE.Vector3(0, -Math.sin(a), Math.cos(a));
    pos.push(-w, y, z, w, y, z);
    nrm.push(n.x, n.y + 0.3, n.z, n.x, n.y + 0.3, n.z);
    uv.push(0, 1 - t, 1, 1 - t);
    const step = 1 / segs;
    a += 0.42 * step * 2.4;
    y += Math.cos(a) * step; z += Math.sin(a) * step;
  }
  for (let i = 0; i < segs; i++) { const b = i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ===========================================================================
// instance accumulator
// ===========================================================================
class InstAccum {
  constructor() { this.m = []; this.fol = []; this.bend = []; this.col = []; this.n = 0; }
  // basis vectors X,Y,Z (THREE.Vector3, already scaled), position p
  push(X, Y, Z, p, fol, bend, col) {
    this.m.push(X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, p.x, p.y, p.z, 1);
    this.fol.push(fol[0], fol[1], fol[2], fol[3]);
    this.bend.push(bend.x, bend.y, bend.z);
    this.col.push(col[0], col[1], col[2]);
    this.n++;
  }
  build(THREE, geo, mat, dm, name, { castShadow = true, receiveShadow = true } = {}) {
    if (!this.n) return null;
    const g = geo.clone();
    g.setAttribute('aFol', new THREE.InstancedBufferAttribute(new Float32Array(this.fol), 4));
    g.setAttribute('aBend', new THREE.InstancedBufferAttribute(new Float32Array(this.bend), 3));
    const im = new THREE.InstancedMesh(g, mat, this.n);
    im.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(this.m), 16);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.col), 3);
    im.castShadow = castShadow; im.receiveShadow = receiveShadow;
    if (dm) im.customDepthMaterial = dm;
    im.computeBoundingSphere();
    im.computeBoundingBox && im.computeBoundingBox();
    im.name = name;
    return im;
  }
}

// ===========================================================================
// placement helpers (site plan awareness)
// ===========================================================================
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function distToSeg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
function distToPoly(x, z, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSeg(x, z, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

function makeSite(L) {
  const rects = [];
  const H = L.hall;
  rects.push({ x0: H.center[0] - H.platform.w / 2, x1: H.center[0] + H.platform.w / 2, z0: H.center[2] - H.platform.d / 2, z1: H.center[2] + H.platform.d / 2, m: 1.2, name: 'hall' });
  // hall front stair zone
  rects.push({ x0: H.center[0] - H.stairs.width / 2 - 1, x1: H.center[0] + H.stairs.width / 2 + 1, z0: H.stairs.frontZ - 1, z1: H.stairs.frontZ + 4.5, m: 0.5, name: 'stairs' });
  const P = L.pagoda;
  rects.push({ x0: P.center[0] - P.platform.w / 2, x1: P.center[0] + P.platform.w / 2, z0: P.center[2] - P.platform.d / 2, z1: P.center[2] + P.platform.d / 2, m: 1.0, name: 'pagoda' });
  for (const s of L.sideHalls) rects.push({ x0: s.center[0] - s.w / 2, x1: s.center[0] + s.w / 2, z0: s.center[2] - s.d / 2, z1: s.center[2] + s.d / 2, m: 2.0, name: 'side' });
  const B = L.bellTower;
  rects.push({ x0: B.center[0] - B.w / 2, x1: B.center[0] + B.w / 2, z0: B.center[2] - B.d / 2, z1: B.center[2] + B.d / 2, m: 2.0, name: 'bell' });
  const V = L.pavilion;
  rects.push({ x0: V.center[0] - V.w / 2 - 3, x1: V.center[0] + V.w / 2, z0: V.center[2] - V.d / 2, z1: V.center[2] + V.d / 2, m: 1.2, name: 'pavilion' });
  const Gt = L.gate;
  rects.push({ x0: Gt.center[0] - Gt.w / 2, x1: Gt.center[0] + Gt.w / 2, z0: Gt.center[2] - Gt.d / 2, z1: Gt.center[2] + Gt.d / 2, m: 1.5, name: 'gate' });
  const C = L.corridor;
  const inner = { x0: C.rect.minX + C.width + 0.6, x1: C.rect.maxX - C.width - 0.6, z0: C.rect.minZ + C.width + 0.6, z1: C.rect.maxZ - C.width - 0.6 };
  const br = L.bridge;
  return {
    rects, inner,
    // returns clearance (m) of a point from all no-plant features (negative = inside)
    clearance(x, z, { pondMargin = 0, pathMargin = 0, lanternR = 1.0 } = {}) {
      let c = Infinity;
      for (const r of rects) {
        const dx = Math.max(r.x0 - r.m - x, 0, x - r.x1 - r.m), dz = Math.max(r.z0 - r.m - z, 0, z - r.z1 - r.m);
        const inside = x > r.x0 - r.m && x < r.x1 + r.m && z > r.z0 - r.m && z < r.z1 + r.m;
        c = Math.min(c, inside ? -1 : Math.hypot(dx, dz));
      }
      for (const p of L.paths) c = Math.min(c, distToSeg(x, z, p.from, p.to) - p.width / 2 - pathMargin);
      c = Math.min(c, distToSeg(x, z, [br.south[0], br.south[2]], [br.north[0], br.north[2]]) - br.width / 2 - 0.8);
      const inPond = pointInPoly(x, z, L.pond.outline) && !pointInPoly(x, z, L.pond.island);
      const dp = distToPoly(x, z, L.pond.outline) - pondMargin;
      c = Math.min(c, inPond ? -1 : dp);
      for (const l of L.stoneLanterns) c = Math.min(c, Math.hypot(x - l[0], z - l[1]) - lanternR);
      if (x < inner.x0 || x > inner.x1 || z < inner.z0 || z > inner.z1) c = Math.min(c, -1);
      return c;
    },
    inPond(x, z) { return pointInPoly(x, z, L.pond.outline) && !pointInPoly(x, z, L.pond.island); },
    onIsland(x, z) { return pointInPoly(x, z, L.pond.island); },
  };
}

// ===========================================================================
// BUILD
// ===========================================================================
export async function build(ctx) {
  const { THREE, L } = ctx;
  const t0 = performance.now();
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const SUN = (ctx.sunDir ? ctx.sunDir.clone() : V3(-0.93, 0.12, 0.34)).normalize();
  const R = ctx.rng('vegetation');
  const site = makeSite(L);
  // keep-out volumes (absolute y): the pavilion box (hero lantern of shot 1) and the east side of the
  // pond island, low enough that the grazing WSW sun reaches the lotus bed of shot 2
  const KEEP = [
    { x0: 40.9, x1: 53.1, z0: 11.9, z1: 24.1, y1: 6.0 },
    { x0: -0.2, x1: 4.0, z0: 16.0, z1: 23.0, y1: 2.7 },
    // finale opening camera (shot 9 keys 0-1): keep the momiji crown out of the lens
    { x0: 35.9, x1: 39.8, z0: 20.5, z1: 25.0, y1: 7.5 },
  ];
  const inKeep = (p, m = 0.1) => {
    for (const B of KEEP) if (p.x > B.x0 - m && p.x < B.x1 + m && p.z > B.z0 - m && p.z < B.z1 + m && p.y < B.y1 + m) return true;
    return false;
  };

  // ground height: prefer the terrain module's height function if it exposes one
  const T = ctx.modules && ctx.modules.terrain;
  const hfn = T && (T.heightAt || T.groundHeight || T.getHeight || (T.object && T.object.userData && T.object.userData.heightAt));
  const groundY = (x, z) => {
    if (typeof hfn === 'function') { try { const v = hfn(x, z); if (Number.isFinite(v)) return v; } catch (e) { /* ignore */ } }
    if (site.onIsland(x, z)) return 0.25;
    return 0;
  };

  // ---------------------------------------------------------------- textures
  const mapleTex = await cachedAtlas('veg-maple-tex', () => makeMapleAtlas(ctx.rng('veg-maple-tex'), 2048), !!ctx.realtime?.enabled);
  const samaraTex = await cachedAtlas('veg-samara-tex', () => makeSamaraTexture(ctx.rng('veg-samara-tex'), 512), !!ctx.realtime?.enabled);
  const pineTex = await cachedAtlas('veg-pine-tex', () => makePineAtlas(ctx.rng('veg-pine-tex'), 1024), !!ctx.realtime?.enabled);
  const blossomTex = await cachedAtlas('veg-blossom-tex', () => makeBlossomAtlas(ctx.rng('veg-blossom-tex'), 1024), !!ctx.realtime?.enabled);
  const shrubTex = await cachedAtlas('veg-shrub-tex', () => makeShrubAtlas(ctx.rng('veg-shrub-tex'), 1024), !!ctx.realtime?.enabled);
  const fernTex = await cachedAtlas('veg-fern-tex', () => makeFernTexture(ctx.rng('veg-fern-tex')), !!ctx.realtime?.enabled);
  const aniso = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy ? ctx.renderer.capabilities.getMaxAnisotropy() : 4);
  for (const t of [mapleTex, samaraTex, pineTex, blossomTex, shrubTex, fernTex]) t.anisotropy = aniso;
  if (typeof location !== 'undefined' && /vegnomip=1/.test(location.search)) for (const t of [mapleTex, pineTex, blossomTex, shrubTex, fernTex]) { t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
  const tTex = performance.now();

  // --------------------------------------------------------------- materials
  const bark = { pine: barkMaterial(ctx, 'pine'), maple: barkMaterial(ctx, 'maple'), cherry: barkMaterial(ctx, 'cherry') };
  const folMaple = foliageMaterial(ctx, 'maple', mapleTex, { transTint: [1.9, 1.9, 0.75], transBack: 1.0, transFwd: 2.2, bend: 0.4, roughness: 0.55, accent: [0.55, 0.2, 0.025], petiole: [0.2, 0.05, 0.025], flutter: 0.03, fatten: 0.38, spec: 0.6 });
  // close-up hero canopies (shot 1 veranda): shallower light leak -> leaves behind leaves stay dark,
  // the sunward layer glows gold-green; little waxy glare
  const folMapleHero = foliageMaterial(ctx, 'maple', mapleTex, { transTint: [1.95, 1.4, 0.55], transBack: 1.15, transFwd: 2.8, transDepth: 0.9, leak: 0.35, leakDiffuse: 0.15, bend: 0.3, roughness: 0.6, accent: [0.55, 0.26, 0.02], petiole: [0.2, 0.05, 0.025], flutter: 0.03, fatten: 0.38, spec: 0.35, ao: 1.0, name: 'hero' });
  // background / aerial maples: light does not leak through whole crowns -> dark interiors and
  // undersides, sunlit outer sprays; canopy-shaped normals so each tier shades as one clean form
  const folMapleFar = foliageMaterial(ctx, 'maple', mapleTex, { transTint: [1.5, 1.5, 0.6], transBack: 0.55, transFwd: 1.6, transDepth: 1.1, leak: 0.25, leakDiffuse: 0.08, bend: 0.62, roughness: 0.6, accent: [0.55, 0.2, 0.025], petiole: [0.2, 0.05, 0.025], flutter: 0.03, fatten: 0.38, spec: 0.45, skyTrans: 0.35, name: 'far' });
  // pine needles: dense, nearly light-tight pads; cushion-shaped normals, low sheen
  const folPine = foliageMaterial(ctx, 'pine', pineTex, { transTint: [1.5, 1.7, 0.8], transBack: 0.4, transFwd: 0.8, transDepth: 1.0, leak: 0.2, leakDiffuse: 0.06, bend: 0.72, roughness: 0.58, spec: 0.55, flutter: 0.008, fatten: 0.18, skyTrans: 0.32 });
  const folBlossom = foliageMaterial(ctx, 'rgb', blossomTex, { transTint: [1.0, 0.85, 0.9], transBack: 0.75, transFwd: 1.3, bend: 0.5, roughness: 0.6, flutter: 0.015, fatten: 0.25, name: 'blossom', skyTrans: 0.35 });
  const folShrub = foliageMaterial(ctx, 'rgb', shrubTex, { transTint: [1.4, 1.5, 0.8], transBack: 0.5, transFwd: 0.7, transDepth: 0.6, leak: 0.2, leakDiffuse: 0.05, bend: 0.85, roughness: 0.6, spec: 0.5, flutter: 0.004, fatten: 0.12, name: 'shrub', skyTrans: 0.3 });
  const folFern = foliageMaterial(ctx, 'rgb', fernTex, { transTint: [1.6, 1.7, 0.8], transBack: 0.9, transFwd: 1.6, bend: 0.3, roughness: 0.55, flutter: 0.02, name: 'fern' });
  // fern texture is not an atlas: neutralise the cell offset by using cell 0 and full-uv geometry
  // (frond uvs are 0..1 so we scale them into the 0..0.5 cell and keep aFol.w = 0)

  // mound base (inner leaf mass of clipped shrubs)
  const moundMat = ctx.mat.std({ color: 0xffffff, roughness: 0.75, metalness: 0 }, {
    vertexHead: /* glsl */ `attribute vec3 aTint; varying vec3 vTint;`,
    vertexWorld: /* glsl */ `vTint = aTint;`,
    fragHead: /* glsl */ `varying vec3 vTint; float g_h;`,
    fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      vec2 w = n_worley3(wp * 38.0);
      float aa = 1.0 - smoothstep(0.15, 0.5, length(fwidth(wp)) * 38.0);
      float leaf = mix(0.55, smoothstep(0.0, 0.35, w.y - w.x), aa);
      float n = n_fbm3(wp * 4.0, 3) * 0.5 + 0.5;
      vec3 col = vTint * (0.45 + 0.75 * leaf) * (0.75 + 0.5 * n);
      diffuseColor.rgb *= col;
      g_h = leaf * 0.7 * aa + n * 0.3;
    }`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.012);`,
  });
  moundMat.name = 'mound';

  // pine pad cores: opaque, dark needle mass under the tufts (crisp pad silhouettes + self-shadowing)
  const coreHooks = {
    vertexHead: VEG_WIND + /* glsl */ `attribute vec3 aTint; attribute float aFlex; varying vec3 vTint;`,
    vertexWorld: /* glsl */ `vTint = aTint; wPos4.xyz += vegWind(wPos4.xyz, aFlex);`,
  };
  const padCoreMat = ctx.mat.std({ color: 0xffffff, roughness: 0.82, metalness: 0 }, {
    ...coreHooks,
    fragHead: /* glsl */ `varying vec3 vTint; float g_h;`,
    fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      vec2 w = n_worley3(wp * vec3(24.0, 30.0, 24.0));
      float aa = 1.0 - smoothstep(0.15, 0.5, length(fwidth(wp)) * 30.0);
      float clump = mix(0.6, smoothstep(0.0, 0.4, w.y - w.x), aa);
      float n = n_fbm3(wp * 2.6, 3) * 0.5 + 0.5;
      diffuseColor.rgb *= vTint * (0.45 + 0.75 * clump) * (0.8 + 0.4 * n);
      g_h = clump * 0.8 * aa + n * 0.2;
    }`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.025);`,
  });
  padCoreMat.name = 'pine_core';
  const padCoreDm = depthMat(ctx, coreHooks);
  const NO_CORE = typeof location !== 'undefined' && /vegcore=0/.test(location.search);

  // -------------------------------------------------------------- accumulators
  const acc = { pine: new BarkAccum(), maple: new BarkAccum(), cherry: new BarkAccum() };
  const cores = new CushionAccum();
  const fol = { maple: new InstAccum(), mapleHero: new InstAccum(), mapleFar: new InstAccum(), pine: new InstAccum(), blossom: new InstAccum(), shrub: new InstAccum(), fern: new InstAccum() };
  const stats = { trees: 0 };
  const showcase = [];

  const tmpX = V3(), tmpY = V3(), tmpZ = V3();
  const orthoBasis = (Y, Zhint) => {
    // returns X,Y,Z orthonormal with Y fixed and Z close to Zhint
    const y = Y.clone().normalize();
    const z = Zhint.clone().addScaledVector(y, -Zhint.dot(y));
    if (z.lengthSq() < 1e-6) z.copy(perpOf(y));
    z.normalize();
    const x = V3().crossVectors(y, z).normalize();
    return [x, y, z];
  };

  // ------------------------------------------------------------- tree builders
  const flexFn = (maxPd, k) => (pd) => k * Math.pow(Math.min(1, pd / Math.max(maxPd, 0.1)), 1.6);
  const maxPdOf = (branches) => { let m = 0; for (const b of branches) m = Math.max(m, b.pd[b.pd.length - 1]); return m; };

  function addBark(kind, branches, rT, seed, opt = {}) {
    const maxPd = maxPdOf(branches);
    const flexOf = flexFn(maxPd, opt.flexK ?? 1.0);
    const sgn = opt.red ? -1 : 1;
    const cellW = kind === 'pine' ? 0.075 : kind === 'cherry' ? 0.05 : 0.06;
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      if (b.rads[0] < 0.0018) continue;
      if (!opt.hero && b.level >= 4 && b.rads[0] < 0.0046) continue; // far trees: fine twigs are hidden by foliage
      const isTrunk = b.level === 0;
      const disp = isTrunk ? trunkDisp({ seed: seed % 97, bump: kind === 'pine' ? 0.07 : 0.05, flare: kind === 'pine' ? 0.5 : kind === 'cherry' ? 0.45 : 0.35, roots: 5, flareH: 0.45, flute: kind === 'maple' ? 0.05 : 0.025, fluteN: kind === 'maple' ? 4 : 7 })
        : b.rads[0] > 0.05 ? trunkDisp({ seed: (seed + i) % 97, bump: 0.05, flare: 0, flute: kind === 'maple' ? 0.035 : 0.01, fluteN: 3 }) : null;
      acc[kind].addBranch(b, {
        flexOf, seed: sgn * (1 + ((seed * 13 + i * 7) % 89)), cellW, disp,
        radial: (r) => (r < 0.006 || (!opt.hero && r < 0.014) ? 3 : r < 0.012 ? 4 : Math.round(4 + r * (opt.hero ? 62 : 48))),
      });
    }
    return flexOf;
  }

  // per-pad colour choice (linear RGB). Red momiji: sun-exposed sprays scarlet/crimson, shaded inner
  // sprays lag behind (orange, amber, yellow-green). Green maples: exposed sprays yellow-green.
  const RED_PAL = [
    { w: 3.0, c: [0.42, 0.022, 0.012], ex: 1 },   // scarlet
    { w: 3.0, c: [0.30, 0.010, 0.018], ex: 1 },   // crimson
    { w: 1.6, c: [0.19, 0.006, 0.012], ex: 0.6 }, // deep crimson
    { w: 2.0, c: [0.46, 0.065, 0.012], ex: 0.5 }, // orange-red
    { w: 1.0, c: [0.44, 0.14, 0.016], ex: 0.15 }, // orange
    { w: 0.7, c: [0.24, 0.17, 0.025], ex: 0.0 },  // amber / yellow-green
    { w: 0.35, c: [0.1, 0.15, 0.025], ex: 0.0 },  // still green
  ];
  // precinct / background maples: deeper, cooler greens (sunlit sprays still turn yellow-green)
  const GREEN_PAL_FAR = [
    { w: 2.0, c: [0.05, 0.125, 0.022], ex: 0.3 },
    { w: 2.5, c: [0.075, 0.165, 0.027], ex: 0.6 },
    { w: 1.6, c: [0.105, 0.195, 0.03], ex: 1 },
    { w: 1.3, c: [0.035, 0.095, 0.02], ex: 0.0 },
    { w: 0.6, c: [0.14, 0.2, 0.034], ex: 1 },
  ];
  const GREEN_PAL = [
    { w: 2.0, c: [0.07, 0.15, 0.02], ex: 0.3 },
    { w: 2.5, c: [0.1, 0.19, 0.027], ex: 0.6 },
    { w: 1.6, c: [0.13, 0.21, 0.03], ex: 1 },
    { w: 1.0, c: [0.055, 0.12, 0.02], ex: 0.0 },
    { w: 0.7, c: [0.17, 0.22, 0.036], ex: 1 },
  ];
  // turning maples (fill trees seen from the aerials): gold, amber, orange, a little green left inside
  const GOLD_PAL = [
    { w: 2.0, c: [0.3, 0.19, 0.02], ex: 1 }, { w: 1.6, c: [0.38, 0.12, 0.012], ex: 0.85 }, { w: 1.4, c: [0.24, 0.21, 0.03], ex: 0.6 },
    { w: 1.0, c: [0.14, 0.17, 0.025], ex: 0.25 }, { w: 0.8, c: [0.09, 0.13, 0.02], ex: 0 },
  ];
  const pickPal = (rng, pal, expo) => {
    let tot = 0;
    const ws = pal.map((e) => { const w = e.w * (0.25 + 1.5 * (1 - Math.abs(e.ex - expo))); tot += w; return w; });
    let r = rng.next() * tot;
    for (let i = 0; i < pal.length; i++) { r -= ws[i]; if (r <= 0) return pal[i].c; }
    return pal[0].c;
  };

  // ---- maple ----
  function buildMaple(spec) {
    const rng = ctx.rng('maple' + spec.id);
    const base = V3(spec.x, groundY(spec.x, spec.z), spec.z);
    const red = spec.type === 'mapleRed';
    const leanV = spec.lean ? V3(spec.lean[0], 0, spec.lean[1]) : V3(rng.range(-0.5, 0.5), 0, rng.range(-0.5, 0.5));
    const tiered = spec.style !== 'shell';
    const tree = tiered
      ? genTiered(rng, { species: 'maple', h: spec.h, base, lean: leanV, spread: spec.spread ?? (red ? 0.8 : 0.68), detail: spec.detail ?? 1, sx: spec.sx, sz: spec.sz, leaders: spec.leaders, crownBase: spec.crownBase ?? (red ? 0.2 : 0.3), padR: spec.padR, gaps: spec.gaps, twigDens: spec.twigDens, keepOut: KEEP, trunkFrac: spec.trunkFrac, widest: spec.widest, droop: spec.droop, squash: spec.squash, lobes: spec.lobes })
      : genMaple(rng, { h: spec.h, base, lean: leanV, spread: spec.spread ?? (red ? 0.7 : 0.62), detail: spec.detail ?? 1, sx: spec.sx, sz: spec.sz, leaders: spec.leaders, shellDensity: spec.shellDensity ?? (red ? 5.0 : 3.8), tiers: red ? 1.1 : 1.6, maxTwig: spec.maxTwig, leafLen: spec.leafLen, twigWobble: spec.twigWobble, keepOut: KEEP });
    const flexOf = addBark('maple', tree.branches, tree.rT, spec.id * 31 + 5, { red, hero: spec.hero, flexK: spec.flexK });
    tree.flexOf = flexOf;
    const env = tree.env;
    const leafS = spec.leafSize ?? (red ? 0.16 : 0.175);
    const nodeSp = spec.nodeSpacing ?? 0.06;
    // colour palettes (linear)
    const pal = red
      ? [[0.3, 0.012, 0.012], [0.4, 0.02, 0.014], [0.22, 0.008, 0.012], [0.45, 0.035, 0.014], [0.34, 0.014, 0.026]]
      : (spec.palette || [[0.075, 0.16, 0.022], [0.1, 0.19, 0.028], [0.06, 0.13, 0.02], [0.13, 0.2, 0.03], [0.085, 0.17, 0.035]]);
    const accentP = red ? 0.45 : (spec.autumn ?? 0.12);
    const treeHue = rng.range(-0.08, 0.08);
    // per-tree tone (green maples): deep green, mid, yellow-green, blue-green -> variety across the precinct
    const TONES = [[0.6, 0.78, 0.8], [1, 1, 1], [1.12, 1.04, 0.82], [0.75, 0.92, 1.0]];
    const tone = red || spec.gpal || spec.frame ? [1, 1, 1] : TONES[rng.int(0, 3)];
    if (tiered) {
      for (const P of tree.pads) {
        const hy = Math.min(1, Math.max(0, (P.c.y - (env.c.y - env.r.y)) / (2 * env.r.y)));
        P.expo = Math.min(1, Math.max(0, P.shade * 0.75 + hy * 0.35 - 0.1));
        P.col = pickPal(rng, red ? RED_PAL : (spec.gpal || (spec.frame ? GREEN_PAL : GREEN_PAL_FAR)), P.expo);
        P.col2 = pickPal(rng, red ? RED_PAL : (spec.gpal || (spec.frame ? GREEN_PAL : GREEN_PAL_FAR)), P.expo);
        P.v = rng.range(0.85, 1.15);
      }
    }
    let curPad = null;
    // leaf face orientation: outward from the crown (light seeking) + up, with strong scatter
    const leafHint = (p) => curPad
      ? padNormal(curPad, p).multiplyScalar(0.7).addScaledVector(UP, 0.75).add(randUnit(rng).multiplyScalar(0.8))
      : envNormal(p, env).multiplyScalar(spec.faceOut ?? 1.0).addScaledVector(UP, 0.5).add(randUnit(rng).multiplyScalar(0.85));
    const pushLeaf = (p, Ydir, Zhint, s, flex) => {
      if (inKeep(p, 0.15)) return;
      if (curPad) {
        const l = padLocal(curPad, p);
        if (l.x * l.x + l.z * l.z > 1.7) return; // keep sprays compact: sky shows between pads
      }
      // face direction dominates; the blade axis is projected into the face plane
      const Z = Zhint.clone().normalize();
      const Y = Ydir.clone(); Y.y -= 0.25; Y.addScaledVector(Z, -Y.dot(Z));
      if (Y.lengthSq() < 1e-5) Y.copy(perpOf(Z));
      Y.normalize();
      const X = V3().crossVectors(Y, Z).normalize();
      // keep the card's geometric normal in the sun hemisphere: the shadow normal-offset then moves
      // toward the sun and backlit leaves are not self-shadowed (translucency survives)
      if (Z.dot(SUN) < 0) { Z.negate(); X.negate(); }
      const hy = (p.y - (env.c.y - env.r.y)) / (2 * env.r.y);
      let ao, bend, col;
      if (curPad) {
        const P = curPad;
        const l = padLocal(P, p);
        // underside of each spray dark, top lit; whole spray darker when buried under upper tiers
        const topF = padTopF(P, p);
        const rim = Math.min(1, Math.hypot(l.x, l.z));
        ao = Math.min(1, Math.max(0.1, (0.22 + 0.78 * topF) * (0.8 + 0.2 * rim) * P.shade));
        bend = padNormal(P, p).lerp(UP, 0.35).lerp(envNormal(p, env), 0.25).normalize();
        const c = rng.chance(0.22) ? P.col2 : P.col;
        const v = P.v * (0.82 + rng.next() * 0.36) * (0.85 + 0.25 * topF);
        col = [c[0] * v * (1 + treeHue) * tone[0], c[1] * v * (red ? 0.8 + 0.4 * rng.next() : 1) * tone[1], c[2] * v * (1 - treeHue) * tone[2]];
      } else {
        const rho = envRho(p, env);
        ao = Math.min(1, Math.max(0.18, (0.3 + 0.75 * Math.min(1, Math.max(0, (rho - 0.35) / 0.65))) * (0.7 + 0.35 * Math.min(1, Math.max(0, hy)))));
        bend = envNormal(p, env).lerp(UP, 0.25).normalize();
        const c = pal[Math.floor(rng.next() * pal.length)];
        const v = 0.82 + rng.next() * 0.36;
        const sunny = Math.max(0, Math.min(1, (hy - 0.5) * 2)) * 0.25; // tops a bit lighter / yellower
        col = [c[0] * v * (1 + treeHue + sunny * 0.6), c[1] * v * (1 + sunny * 0.3), c[2] * v * (1 - treeHue)];
      }
      let accent = rng.chance(accentP) ? rng.range(0.3, 1.0) : rng.range(0, 0.15);
      if (red && rng.chance(0.65)) accent = -accent; // red maples: mostly darker crimson accents, some orange
      (!(spec.forceNear || nearVis(p)) ? fol.mapleFar : spec.heroMat ? fol.mapleHero : fol.maple).push(X.multiplyScalar(s), Y.multiplyScalar(s), Z.multiplyScalar(s), p, [flex + 0.08, ao, accent, rng.int(0, 3)], bend, col);
    };
    for (const tw of tree.twigs) {
      const br = tw.br;
      curPad = tw.pad || null;
      const len = br.pd[br.pd.length - 1] - br.pd[0];
      const span = len * (1 - tw.t0);
      const nn = Math.max(1, Math.round(span / nodeSp));
      for (let k = 0; k < nn; k++) {
        const t = tw.t0 + ((k + 0.5) / nn) * (1 - tw.t0);
        const s = sampleBranch(br, t);
        const flex = flexOf(s.pd);
        const H = V3().crossVectors(s.T, UP);
        if (H.lengthSq() < 1e-4) H.copy(perpOf(s.T));
        H.normalize();
        const outward = V3(s.p.x - env.c.x, 0, s.p.z - env.c.z).normalize();
        if (k % 2 === 0 || rng.chance(0.3)) {
          // opposite pair
          for (const side of [-1, 1]) {
            if (rng.chance(0.08)) continue;
            const pdir = H.clone().multiplyScalar(side).addScaledVector(s.T, rng.range(0.15, 0.6)).add(randUnit(rng).multiplyScalar(0.3));
            pdir.y = pdir.y * 0.3 + rng.range(-0.15, 0.1);
            pdir.normalize();
            const Zh = leafHint(s.p);
            pushLeaf(s.p, pdir, Zh, leafS * rng.range(0.8, 1.15) * (1 - 0.15 * t), flex);
          }
        } else {
          // short spur with a whorl of leaves fanning out
          const side = rng.chance(0.5) ? 1 : -1;
          const spur = H.clone().multiplyScalar(side * 0.8).addScaledVector(UP, 0.5).addScaledVector(s.T, 0.3).normalize();
          const sp = s.p.clone().addScaledVector(spur, rng.range(0.02, 0.06));
          const nw = rng.int(3, 5);
          const a0 = rng.range(0, TAU);
          for (let j = 0; j < nw; j++) {
            const a = a0 + (j / nw) * TAU + rng.range(-0.3, 0.3);
            const Yd = H.clone().multiplyScalar(Math.cos(a)).addScaledVector(s.T, Math.sin(a));
            Yd.y = rng.range(-0.2, 0.15);
            const Zh = leafHint(sp);
            pushLeaf(sp, Yd, Zh, leafS * rng.range(0.75, 1.1), flex + 0.03);
          }
        }
      }
      // terminal fan
      const e = sampleBranch(br, 1);
      const nt = tw.shell ? rng.int(4, 7) : rng.int(2, 4);
      const H = V3().crossVectors(e.T, UP); if (H.lengthSq() < 1e-4) H.copy(perpOf(e.T)); H.normalize();
      for (let j = 0; j < nt; j++) {
        const a = ((j / Math.max(1, nt - 1)) - 0.5) * 1.8 + rng.range(-0.2, 0.2);
        const Yd = e.T.clone().multiplyScalar(Math.cos(a)).addScaledVector(H, Math.sin(a));
        Yd.y = Yd.y * 0.3 + rng.range(-0.1, 0.12);
        pushLeaf(e.p, Yd, leafHint(e.p), leafS * rng.range(0.7, 1.0), flexOf(e.pd));
      }
    }
    stats.trees++;
    return tree;
  }

  // ---- cherry ----
  function buildCherry(spec) {
    const rng = ctx.rng('cherry' + spec.id);
    const base = V3(spec.x, groundY(spec.x, spec.z), spec.z);
    const leanV = spec.lean ? V3(spec.lean[0], 0, spec.lean[1]) : V3(rng.range(-0.4, 0.4), 0, rng.range(-0.4, 0.4));
    const tiered = spec.style !== 'shell';
    const tree = tiered
      ? genTiered(rng, { species: 'cherry', h: spec.h, base, lean: leanV, spread: spec.spread ?? 0.8, detail: spec.detail ?? 1, leaders: spec.leaders, padR: spec.padR, gaps: spec.gaps ?? 0.36, twigDens: spec.twigDens ?? 3.2, keepOut: KEEP })
      : genCherry(rng, { h: spec.h, base, lean: leanV, spread: spec.spread ?? 0.88, detail: spec.detail ?? 1, keepOut: KEEP });
    const flexOf = addBark('cherry', tree.branches, tree.rT, spec.id * 17 + 3, { hero: spec.hero });
    const env = tree.env;
    const cs = spec.clusterSize ?? 0.36;
    const sp = spec.clusterSpacing ?? 0.075;
    // per-spray tint: white / pale pink / pink (sRGB atlas is multiplied by this)
    const TINTS = [[1.0, 0.98, 0.99], [1.0, 0.93, 0.95], [1.0, 0.86, 0.9], [0.98, 0.8, 0.86]];
    if (tiered) for (const P of tree.pads) { P.tint = TINTS[Math.min(3, Math.floor(rng.next() * rng.next() * 4.6))]; P.v = rng.range(0.9, 1.06); }
    const pushCluster = (p, s, P, scale = 1) => {
      if (inKeep(p, 0.2)) return;
      let ao, bend, col;
      if (P) {
        const l = padLocal(P, p);
        const topF = padTopF(P, p);
        ao = Math.min(1, Math.max(0.15, (0.3 + 0.7 * topF) * P.shade));
        bend = padNormal(P, p).lerp(UP, 0.3).lerp(envNormal(p, env), 0.3).normalize();
        const v = P.v * rng.range(0.92, 1.05) * (0.9 + 0.12 * topF);
        col = [P.tint[0] * v, P.tint[1] * v * rng.range(0.97, 1.02), P.tint[2] * v * rng.range(0.97, 1.02)];
      } else {
        const rho = envRho(p, env);
        const hy = (p.y - (env.c.y - env.r.y)) / (2 * env.r.y);
        ao = Math.min(1, Math.max(0.25, (0.35 + 0.7 * Math.min(1, Math.max(0, (rho - 0.3) / 0.7))) * (0.75 + 0.3 * hy)));
        bend = envNormal(p, env).lerp(UP, 0.2).normalize();
        const tint = rng.range(0.9, 1.06);
        col = [tint, tint * rng.range(0.95, 1.0), tint * rng.range(0.96, 1.02)];
      }
      const Yd = randUnit(rng); const Zd = randUnit(rng);
      const [X, Y, Z] = orthoBasis(Yd, Zd);
      const sc = cs * rng.range(0.75, 1.2) * scale;
      fol.blossom.push(X.multiplyScalar(sc), Y.multiplyScalar(sc), Z.multiplyScalar(sc), p, [flexOf(s.pd) + 0.05, ao, 0, rng.int(0, 3)], bend, col);
    };
    for (const tw of tree.twigs) {
      const br = tw.br;
      const len = br.pd[br.pd.length - 1] - br.pd[0];
      const n = Math.max(1, Math.round((len * (1 - tw.t0)) / sp));
      for (let k = 0; k < n; k++) {
        const t = tw.t0 + ((k + rng.range(0.2, 0.8)) / n) * (1 - tw.t0);
        const s = sampleBranch(br, t);
        const off = randUnit(rng); off.y = Math.abs(off.y) * 0.6 - 0.1;
        const p = s.p.clone().addScaledVector(off, cs * 0.25);
        if (tw.pad) { const l = padLocal(tw.pad, p); if (l.x * l.x + l.z * l.z > 1.7) continue; }
        pushCluster(p, s, tw.pad || null);
      }
    }
    // sparse flowers right on the outer limbs (sakura flower along the wood, between the sprays)
    if (tiered) {
      for (const b of tree.branches) {
        if (b.level !== 2 || !b.pad) continue;
        const len = b.pd[b.pd.length - 1] - b.pd[0];
        const n = Math.round(len * 2.2);
        for (let k = 0; k < n; k++) {
          const t = rng.range(0.4, 0.95);
          const s = sampleBranch(b, t);
          if (s.r > 0.05) continue;
          const off = randUnit(rng); off.y = Math.abs(off.y);
          pushCluster(s.p.clone().addScaledVector(off, s.r + 0.03), s, null, 0.6);
        }
      }
    }
    stats.trees++;
    return tree;
  }

  // ---- pine ----
  function buildPine(spec) {
    const rng = ctx.rng('pine' + spec.id);
    const base = V3(spec.x, groundY(spec.x, spec.z), spec.z);
    const tree = genPine(rng, { h: spec.h, base, leanAz: spec.leanAz, lean: spec.lean, nBranches: spec.nBranches, hStart: spec.hStart, padScale: spec.padScale, reach: spec.reach, topBack: spec.topBack, avoid: (spec.avoid || []).concat(PINE_AVOID), keepOut: KEEP });
    const flexOf = addBark('pine', tree.branches, tree.rT, spec.id * 23 + 1, { flexK: 0.45, hero: spec.hero });
    const dens = (spec.tuftDensity ?? 115) * Math.min(1, Math.pow(7.5 / spec.h, 1.3));
    const ts = (spec.tuftSize ?? 0.29) * Math.max(1, Math.sqrt(spec.h / 7.5));
    const greens = [[0.034, 0.062, 0.032], [0.044, 0.072, 0.03], [0.03, 0.055, 0.034], [0.052, 0.078, 0.026]];
    const treeTint = rng.range(0.9, 1.12);
    const gseed = rng.int(0, 9999);
    // A clipped niwaki pad is a flat-topped, lobed cushion built from separate shoot brushes:
    // clusters of upright needle tufts on the top, tufts bristling outward at the rim (spiky
    // silhouette), a sparse dark underside, and noise-driven dark gaps between the brushes.
    const pushTuft = (p, axis, sc, flex, ao, acc, col, bend) => {
      if (inKeep(p, 0.15)) return;
      const [X, Y, Z] = orthoBasis(axis, randUnit(rng));
      fol.pine.push(X.multiplyScalar(sc), Y.multiplyScalar(sc), Z.multiplyScalar(sc), p, [flex, ao, acc, rng.chance(0.5) ? 0 : 2], bend, col);
    };
    for (const pad of tree.pads) {
      const cy = Math.cos(pad.yaw), sy = Math.sin(pad.yaw);
      const lb = pad.lobes || [0.1, 0.06, 0.04, 0, 1, 2];
      const Rf = (th) => 1 + lb[0] * Math.sin(3 * th + lb[3]) + lb[1] * Math.sin(5 * th + lb[4]) + lb[2] * Math.sin(8 * th + lb[5]);
      // normalised cushion profile: flat, gently domed top that rolls over at the rim
      const topY = (q) => (1 - 0.1 * q * q) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(q, 1), 10)));
      const toW = (lx, ly, lz) => V3(pad.c.x + lx * cy - lz * sy, pad.c.y + ly, pad.c.z + lx * sy + lz * cy);
      const area = Math.PI * pad.rx * pad.rz;
      const flex = flexOf(pad.pd) + 0.05;
      const nTuft = area * dens;
      const per = 6;
      const nC = Math.round((nTuft / per) * 1.25);
      const cr = Math.max(0.1, ts * 0.62);
      const gf = 1.5 / Math.max(0.6, Math.sqrt(pad.rx));
      // per-pad tone: some pads olive / yellow-green, others cooler blue-green (reads pad by pad from afar)
      const pv = rng.range(0.8, 1.18), pw = rng.range(-1, 1);
      const padTone = [pv * (1 + 0.2 * pw), pv, pv * (1 - 0.18 * pw)];
      if (!NO_CORE) {
        // opaque core just under the tuft bases: flat super-ellipsoid top, rounded rim, flatter belly
        const topH = Math.max(pad.ry * 0.35, pad.ry * 0.97 - ts * 0.3);
        const botH = pad.ry * 0.55;
        const kx = 0.8;
        const g = greens[Math.floor(rng.next() * greens.length)];
        const cv = 0.5 * treeTint * rng.range(0.9, 1.1);
        const tint = [g[0] * cv * padTone[0], g[1] * cv * padTone[1], g[2] * cv * padTone[2]];
        cores.add(pad.c, pad.yaw, (th, phi) => {
          const s = Math.sin(phi), c = Math.cos(phi);
          const r = spow(s, 0.5) * Rf(th) * kx;
          const y = c >= 0 ? spow(c, 0.42) * topH : spow(c, 0.8) * botH;
          return [Math.cos(th) * r * pad.rx, y, Math.sin(th) * r * pad.rz];
        }, (th, phi) => { const k = 1 - 0.6 * Math.min(1, Math.max(0, (phi / Math.PI - 0.38) / 0.4)); return [tint[0] * k, tint[1] * k, tint[2] * k]; }, flex, pad.rx > 0.8 ? 14 : 10, pad.rx > 0.8 ? 8 : 6);
      }
      for (let ci = 0; ci < nC; ci++) {
        const th = rng.range(0, TAU);
        const R = Rf(th);
        const q = Math.min(1.03, Math.sqrt(rng.next()) * 1.04);
        const rim = q > 0.8;
        const ox = Math.cos(th), oz = Math.sin(th);
        const lx = ox * q * R * pad.rx, lz = oz * q * R * pad.rz;
        const outW = V3(ox * cy - oz * sy, 0, ox * sy + oz * cy);
        const yT = pad.ry * topY(q);
        // dark gaps between the brushes (rarer at the rim so the outline stays a cushion)
        const wc = toW(lx, 0, lz);
        const gn = vnoise3(wc.x * gf, pad.c.y * 0.9 + (pad.sub ? 3.1 : 0), wc.z * gf, gseed) * 0.75 + vnoise3(wc.x * gf * 2.3, pad.c.y, wc.z * gf * 2.3, gseed + 1) * 0.25;
        const gap = gn < (rim ? 0.3 : 0.4);
        const g = greens[Math.floor(rng.next() * greens.length)];
        const cv = rng.range(0.82, 1.18) * treeTint * (gap ? 0.7 : 1);
        if (gap) {
          // deep, shaded needles at the bottom of the gap: dark, not see-through (the core does that)
          if (!rng.chance(NO_CORE ? 0.55 : 0.15)) continue;
          const p = toW(lx, yT - pad.ry * rng.range(0.55, 0.9), lz);
          pushTuft(p, UP.clone().addScaledVector(outW, 0.4 * q).add(randUnit(rng).multiplyScalar(0.3)).normalize(), ts * rng.range(0.8, 1.05), flex, rng.range(0.1, 0.2), 0.05, [g[0] * cv, g[1] * cv, g[2] * cv], UP.clone().lerp(outW, 0.3).normalize());
          continue;
        }
        // cluster frame: centre on the cushion surface, normal n
        let cyl, n;
        if (!rim) {
          cyl = yT - ts * 0.18;
          n = UP.clone().addScaledVector(outW, 0.45 * q).normalize();
        } else {
          const v = rng.range(-0.25, 1.0);           // up the rolled-over side
          cyl = Math.max(-pad.ry * 0.4, yT * v - pad.ry * 0.15);
          n = outW.clone().multiplyScalar(0.9).addScaledVector(UP, 0.35 + 0.4 * Math.max(0, v)).normalize();
        }
        const k = rng.int(per - 2, per + 2);
        const cT = perpOf(n), cB = V3().crossVectors(n, cT);
        const lc = toW(lx, cyl, lz);
        const clusterV = rng.range(0.85, 1.15);
        const hy = Math.min(1, Math.max(0, (cyl / pad.ry + 0.4) / 1.4));
        for (let j = 0; j < k; j++) {
          const a = rng.range(0, TAU), rr = cr * Math.sqrt(rng.next());
          const depth = rng.next();                          // 0 = outer tip of the brush, 1 = deep
          const p = lc.clone().addScaledVector(cT, Math.cos(a) * rr).addScaledVector(cB, Math.sin(a) * rr).addScaledVector(n, -depth * ts * 0.45);
          // needles splay away from the brush centre
          const splay = cT.clone().multiplyScalar(Math.cos(a)).addScaledVector(cB, Math.sin(a)).multiplyScalar(0.55 * rr / cr);
          const axis = n.clone().add(splay).addScaledVector(UP, rim ? 0.15 : 0.25).add(randUnit(rng).multiplyScalar(0.22)).normalize();
          const sc = ts * rng.range(0.85, 1.25) * (rim ? 1.08 : 1);
          const ao = Math.min(1, (rim ? 0.42 + 0.45 * hy : 0.62 + 0.38 * (1 - 0.35 * q)) * (1 - 0.45 * depth));
          const v = cv * clusterV * (1 - 0.25 * depth);
          const col = [g[0] * v * padTone[0], g[1] * v * padTone[1], g[2] * v * padTone[2] * rng.range(0.9, 1.15)];
          const bend = n.clone().lerp(UP, 0.4).normalize();
          pushTuft(p, axis, sc, flex, ao, Math.max(0, rng.range(0.45, 1.0) - depth * 0.5), col, bend);
        }
      }
      // sparse old needles on the underside (dark, hanging out of the bottom of the cushion)
      const nU = Math.round(nTuft * 0.09);
      for (let i = 0; i < nU; i++) {
        const th = rng.range(0, TAU), q = Math.sqrt(rng.next()) * 0.85 * Rf(th);
        const ox = Math.cos(th), oz = Math.sin(th);
        const outW = V3(ox * cy - oz * sy, 0, ox * sy + oz * cy);
        const p = toW(ox * q * pad.rx, -pad.ry * rng.range(0.25, 0.5), oz * q * pad.rz);
        const g = greens[Math.floor(rng.next() * greens.length)];
        const v = rng.range(0.7, 1.0) * treeTint;
        pushTuft(p, outW.clone().multiplyScalar(0.7).addScaledVector(UP, -0.5).add(randUnit(rng).multiplyScalar(0.3)).normalize(), ts * rng.range(0.7, 0.95), flex, rng.range(0.14, 0.24), 0.1, [g[0] * v, g[1] * v, g[2] * v], outW.clone().lerp(UP, 0.2).normalize());
      }
    }
    stats.trees++;
    return tree;
  }

  const perTree = [];
  let heroTree = null;
  const buildTree = (spec) => {
    try {
      const n0 = fol.maple.n + fol.mapleHero.n + fol.mapleFar.n + fol.pine.n + fol.blossom.n, b0 = acc.pine.triCount + acc.maple.triCount + acc.cherry.triCount;
      const r = spec.type === 'pine' ? buildPine(spec) : spec.type === 'cherry' ? buildCherry(spec) : buildMaple(spec);
      if (spec.heroTree) heroTree = r;
      perTree.push(spec.type + '@' + spec.x.toFixed(0) + ',' + spec.z.toFixed(0) + ' h' + spec.h.toFixed(1) + ' fol=' + (fol.maple.n + fol.mapleHero.n + fol.mapleFar.n + fol.pine.n + fol.blossom.n - n0) + ' bark=' + (acc.pine.triCount + acc.maple.triCount + acc.cherry.triCount - b0));
      return r;
    } catch (e) { console.error('[vegetation] tree failed', spec, e.stack || e); return null; }
  };

  // ------------------------------------------------------------ tree list
  // protected screen region of a film camera (pads of framing pines stay out of it)
  const camAvoid = (pos, look, focal, rects, minD = 0) => {
    const P = V3(...pos), f = V3(...look).sub(P).normalize();
    const r = V3().crossVectors(f, UP).normalize(), u = V3().crossVectors(r, f).normalize();
    return { pos: P, f, r, u, tx: 18 / focal, ty: 10.125 / focal, rects, minD };
  };
  // ground-level film cameras: maple leaves they see up close keep the near (translucent, glowing)
  // materials; everything else (aerials, backgrounds) uses the darker, light-tight far material
  const NEAR_CAMS = [];
  for (const i of [1, 2, 3, 4, 5, 7, 8]) {
    const S = SHOTS[i];
    if (!S) continue;
    for (const k of S.keys) { const c = camAvoid(k.pos, k.look, S.focal, null); c.maxD = 30 * Math.max(1, S.focal / 24); NEAR_CAMS.push(c); }
  }
  const nearVis = (p) => {
    for (const c of NEAR_CAMS) {
      const dx = p.x - c.pos.x, dy = p.y - c.pos.y, dz = p.z - c.pos.z;
      const z = dx * c.f.x + dy * c.f.y + dz * c.f.z;
      if (z < 0.2 || z > c.maxD) continue;
      if (Math.abs(dx * c.r.x + dy * c.r.y + dz * c.r.z) < z * c.tx * 1.25 && Math.abs(dx * c.u.x + dy * c.u.y + dz * c.u.z) < z * c.ty * 1.3) return true;
    }
    return false;
  };
  // every pine keeps its pads out of the pagoda-eaves shot (4): only the far left edge may frame
  const S4 = [[-0.62, 1.3, -1.3, 1.3]];
  const PINE_AVOID = [camAvoid([-42.5, 1.8, 4.5], [-33.5, 13, -7], 24, S4, 1.5), camAvoid([-41, 1.8, 5.5], [-33, 13.5, -7.25], 24, S4, 1.5), camAvoid([-39.5, 1.8, 6.5], [-32.5, 14, -7.5], 24, S4, 1.5)];
  const specs = [];
  let id = 0;
  for (const t of L.trees) {
    const s = { id: id++, type: t.type, x: t.at[0], z: t.at[1], h: t.h, hero: true };
    // trees only ever seen from afar (aerials, backgrounds): no hair-fine twigs, coarser sprays
    if ((t.type === 'maple' && t.h >= 9) || (t.type === 'cherry' && t.at[0] !== -46)) Object.assign(s, { hero: false, detail: 0.7, leafSize: 0.21, nodeSpacing: 0.07, twigDens: 3.0 });
    if (t.type === 'maple' && t.at[0] === 52 && t.at[1] === 26) { s.lean = [-0.8, 0.8]; s.spread = 0.58; } // beside the pavilion (keep its roof visible from the finale crane)
    if (t.type === 'pine' && t.h >= 11) { s.reach = 1.1; s.nBranches = 10; }
    // this pine stood on the finale's crane path: moved to the south lawn near the corridor
    if (t.type === 'pine' && t.at[0] === 40 && t.at[1] === 32) Object.assign(s, { x: 30.5, z: 39.8, leanAz: 0.6, lean: 0.3 });
    // finale hero momiji: the south-east shore maple leans far out over the pond (classic ike-no-
    // momiji); the macro spray of shot 9 hangs from the north edge of its crown
    if (t.type === 'mapleRed' && t.at[0] === 36 && t.at[1] === 34) {
      Object.assign(s, { x: 39.0, z: 30.6, h: 5.6, lean: [-3.4, -2.1], spread: 0.6, crownBase: 0.34, flexK: 0.35, forceNear: true, heroMat: true, heroTree: true, gaps: 0.26, padR: 1.15, droop: 1.3 });
    }
    specs.push(s);
  }
  // framing trees for the shots
  // shot 1 (pavilion veranda, looking west): a tall green maple on the north-east shore leans
  // out over the pond; its backlit sprays hang into the top-right of the frame (between the hall
  // roof and the veranda post) and stay above / right of the hero lantern
  specs.push({ id: id++, type: 'maple', x: 41.5, z: 5.0, h: 12, lean: [-4.0, 5.5], crownBase: 0.6, spread: 0.44, sx: 1.1, sz: 1.0, hero: true, frame: 'shot2', heroMat: true,
    gaps: 0.27, padR: 1.25, droop: 1.4, leafSize: 0.19 });
  // shot 5 (looking up at the pagoda eaves): maple branches on the right
  specs.push({ id: id++, type: 'maple', x: -31.5, z: 6.6, h: 7.6, lean: [1.0, -2.4], spread: 0.6, hero: true, frame: 'shot5', gaps: 0.24 });
  // ... and a sun-shot momiji reaching into the top-left: yellow-green with orange tips
  specs.push({ id: id++, type: 'maple', x: -46.2, z: -3.6, h: 10.5, lean: [1.4, 1.6], crownBase: 0.6, spread: 0.5, sx: 0.85, hero: true, frame: 'shot5L', gaps: 0.34, leafSize: 0.23, droop: 1.5, padR: 1.2, autumn: 0.45,
    gpal: [{ w: 2, c: [0.16, 0.22, 0.03], ex: 1 }, { w: 1.5, c: [0.24, 0.24, 0.035], ex: 1 }, { w: 1.5, c: [0.1, 0.18, 0.026], ex: 0.4 }, { w: 1, c: [0.3, 0.16, 0.02], ex: 0.8 }, { w: 0.8, c: [0.07, 0.14, 0.02], ex: 0 }] });
  // shot 8 (through the gate, telephoto north): black pine reaching over the path + red maple
  specs.push({ id: id++, type: 'pine', x: 1.8, z: 40.6, h: 7.2, leanAz: Math.atan2(-0.35, 1.0), lean: 0.38, hStart: 0.52, nBranches: 5, hero: true, frame: 'shot8' });
  specs.push({ id: id++, type: 'mapleRed', x: 17.8, z: 37.8, h: 4.6, lean: [-0.8, -0.5], hero: true });
  // small niwaki pines flanking the hall stair
  specs.push({ id: id++, type: 'pine', x: 1.6, z: -7.0, h: 3.4, lean: 0.35, leanAz: Math.PI * 0.15, padScale: 0.8, hStart: 0.22, nBranches: 5, hero: true });
  specs.push({ id: id++, type: 'pine', x: 18.4, z: -7.0, h: 3.2, lean: 0.35, leanAz: Math.PI * 0.85, padScale: 0.8, hStart: 0.22, nBranches: 5, hero: true });
  // more niwaki pines around the pond & plaza
  specs.push({ id: id++, type: 'pine', x: 27.5, z: 37.5, h: 4.2, padScale: 0.85, hStart: 0.25 });
  specs.push({ id: id++, type: 'pine', x: -30.5, z: 18.5, h: 5.0, padScale: 0.9 });
  specs.push({ id: id++, type: 'pine', x: 47.5, z: 29.5, h: 4.5, padScale: 0.85 });
  specs.push({ id: id++, type: 'mapleRed', x: 36.5, z: -4.2, h: 4.2 });
  specs.push({ id: id++, type: 'mapleRed', x: -21.5, z: -3.2, h: 4.0 });

  // debug: ?vegov=shot5L:x,z,h,leanX,leanZ  -> move a framing tree
  {
    const m = typeof location !== 'undefined' && /vegov=([^&]+)/.exec(location.search);
    if (m) for (const it of decodeURIComponent(m[1]).split(';')) {
      const [name, vals] = it.split(':'); const v = vals.split(',').map(Number);
      const s = specs.find((q) => q.frame === name);
      if (s) { s.x = v[0]; s.z = v[1]; if (v[2]) s.h = v[2]; if (v.length > 4) s.lean = [v[3], v[4]]; if (v.length > 5) s.crownBase = v[5]; }
    }
  }
  // fill trees along the inside of the corridors
  const placed = specs.map((s) => ({ x: s.x, z: s.z, r: s.h * 0.45 }));
  const inner = site.inner;
  const bandPts = [];
  const pushBand = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; bandPts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); } };
  pushBand(inner.x0 + 3.2, inner.z0 + 4, inner.x0 + 3.2, inner.z1 - 4, 11); // west
  pushBand(inner.x1 - 3.2, inner.z0 + 4, inner.x1 - 3.2, inner.z1 - 4, 11); // east
  pushBand(inner.x0 + 6, inner.z0 + 3.2, inner.x1 - 6, inner.z0 + 3.2, 13); // north
  pushBand(inner.x0 + 6, inner.z1 - 3.0, inner.x1 - 6, inner.z1 - 3.0, 13); // south
  const fillTypes = ['maple', 'maple', 'pine', 'pine', 'pine', 'mapleRed', 'cherry', 'cherry', 'maple', 'pine'];
  const FR = ctx.rng('veg-fill');
  for (const [bx, bz] of bandPts) {
    const x = bx + FR.range(-1.6, 1.6), z = bz + FR.range(-1.6, 1.6);
    const type = FR.pick(fillTypes);
    const h = type === 'pine' ? FR.range(6, 9.5) : type === 'mapleRed' ? FR.range(4.5, 6) : type === 'cherry' ? FR.range(6, 7.5) : FR.range(7, 10);
    const r = h * 0.42;
    if (site.clearance(x, z, { pondMargin: 2.5, pathMargin: 1.5, lanternR: 2.0 }) < 1.0) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.r + r) * 0.75)) continue;
    placed.push({ x, z, r });
    // every third green fill maple is turning: amber-gold crowns with orange tips (aerial palette)
    const turning = type === 'maple' && ((Math.floor(x * 7.3) + Math.floor(z * 3.1)) % 3 + 3) % 3 === 0;
    specs.push({ id: id++, type, x, z, h, detail: 0.6, ...(turning ? { autumn: 0.5, gpal: GOLD_PAL } : {}), leafSize: type === 'maple' ? 0.26 : type === 'mapleRed' ? 0.22 : undefined, shellDensity: type === 'maple' ? 2.4 : 3.0, nodeSpacing: 0.075, tuftSize: 0.42, tuftDensity: 50, clusterSize: 0.42, nBranches: type === 'pine' ? Math.round(2.5 + h * 0.3) : undefined, hStart: type === 'pine' ? 0.36 : undefined, reach: type === 'pine' ? 1.12 : undefined, padScale: type === 'pine' ? 0.86 : undefined });
  }

  // debug: ?vegsolo=maple:10,pine:7 -> only these trees, in a row along x at z=0, no shrubs
  const soloM = typeof location !== 'undefined' && /vegsolo=([^&]+)/.exec(location.search);
  if (soloM) {
    specs.length = 0;
    decodeURIComponent(soloM[1]).split(',').forEach((t, i) => {
      const [type, hh, det] = t.split(':');
      specs.push({ id: 500 + i, type, x: i * 14, z: 0, h: +hh || 8, hero: true, detail: det ? +det : 1 });
    });
  }
  for (const s of specs) buildTree(s);

  // ------------------------------------------------------------ macro hero spray (shot 9 opening)
  const heroParts = [];
  {
    const S9 = SHOTS[9];
    const k0 = S9 && S9.keys && S9.keys[0];
    const off = typeof location !== 'undefined' && /veghero=0/.test(location.search);
    if (k0 && heroTree && !soloM && !off) {
      let anchorPd = 0;
      // the shoot starts on the momiji limb closest to its designed entry point (upper left, behind)
      const anchorFn = (want) => {
        let best = null, bd = Infinity;
        for (const b of heroTree.branches) {
          if (b.level < 1) continue;
          for (let i = 0; i < b.pts.length; i++) {
            if (b.rads[i] < 0.007) continue;
            const d = b.pts[i].distanceTo(want);
            if (d < bd) { bd = d; best = b.pts[i]; anchorPd = b.pd[i]; }
          }
        }
        return best && bd < 1.5 ? best.clone() : want;
      };
      const flexBase = Math.min(0.2, heroTree.flexOf ? heroTree.flexOf(anchorPd) : 0.12);
      const hs = buildHeroSpray(ctx.rng('veg-hero'), { cam: k0.pos, look: k0.look, focus: k0.focus ?? 0.62, sun: SUN, anchor: anchorFn, flexBase });
      hs.branches.forEach((b, bi) => acc.maple.addBranch(b, { flexOf: hs.flexAt, seed: -(3 + ((bi * 7) % 80)), cellW: 0.03, radial: (r) => (r < 0.0016 ? 5 : r < 0.004 ? 7 : 9) }));
      const HN = Math.max(1, Math.min(96, hs.leaves.length));
      const occA = [], occX = [], occY = [];
      const leafAcc = new InstAccum(), samAcc = new InstAccum();
      hs.leaves.forEach((Lf, i) => {
        leafAcc.push(Lf.X.clone(), Lf.Y.clone(), Lf.Z.clone(), Lf.p, [Lf.flex, 1.0, Lf.acc, Lf.cell], Lf.Z.clone().normalize(), Lf.col);
        if (i < HN) {
          occA.push(new THREE.Vector4(Lf.p.x, Lf.p.y, Lf.p.z, Lf.cell));
          occX.push(new THREE.Vector4(Lf.X.x, Lf.X.y, Lf.X.z, 1 / Lf.X.lengthSq()));
          occY.push(new THREE.Vector4(Lf.Y.x, Lf.Y.y, Lf.Y.z, 1 / Lf.Y.lengthSq()));
        }
      });
      while (occA.length < HN) { occA.push(new THREE.Vector4()); occX.push(new THREE.Vector4()); occY.push(new THREE.Vector4()); }
      for (const Sm of hs.samaras) samAcc.push(Sm.X.clone(), Sm.Y.clone(), Sm.Z.clone(), Sm.p, [Sm.flex, 1.0, Sm.acc, 0], Sm.Z.clone().normalize(), Sm.col);
      const tHT = performance.now();
      const heroTex = await cachedAtlas('veg-maple-hero-tex', () => makeMapleHeroAtlas(ctx.rng('veg-maple-hero-tex'), 1536), !!ctx.realtime?.enabled);
      const heroTexMs = performance.now() - tHT;
      heroTex.anisotropy = mapleTex.anisotropy;
      const folMacro = foliageMaterial(ctx, 'mapleHero', heroTex, {
        hero: { n: HN, A: occA, X: occX, Y: occY, trans: [0.3, 0.032, 0.016] },
        uniforms: { uFlushB: { value: new THREE.Vector3(0.25, 0.2, 0.008) } },
        transTint: [1.75, 1.2, 0.75], transBack: 1.1, transFwd: 2.0, transPow: 5.0, transDepth: 0.4, leak: 0.25, leakDiffuse: 0.1,
        bend: 0.12, roughness: 0.5, accent: [0.62, 0.17, 0.018], accent2: [0.085, 0.01, 0.006], petiole: [0.2, 0.04, 0.02],
        flutter: 0.0, fatten: 0.0, spec: 0.45, ao: 0.0, skyTrans: 0.55, fwd2: 0.6, name: 'macro',
      });
      const folSamara = foliageMaterial(ctx, 'maple', samaraTex, {
        transTint: [1.35, 0.8, 0.5], transBack: 0.65, transFwd: 1.1, transDepth: 0.4, leak: 0.25, bend: 0.1, roughness: 0.55,
        accent: [0.42, 0.1, 0.02], accent2: [0.2, 0.03, 0.01], petiole: [0.25, 0.06, 0.03], flutter: 0.0, fatten: 0.0, spec: 0.4, ao: 0.0, name: 'samara',
      });
      const lm = leafAcc.build(THREE, heroLeafGeo(), folMacro.m, folMacro.dm, 'leaves_maple_macro', { castShadow: false });
      const sm = samAcc.build(THREE, samaraGeo(), folSamara.m, folSamara.dm, 'samaras_macro', { castShadow: false });
      if (lm) heroParts.push(lm);
      if (sm) heroParts.push(sm);
      stats.hero = `heroTex=${heroTexMs.toFixed(0)}ms heroLeaves=${hs.leaves.length} samaras=${hs.samaras.length} twigs=${hs.branches.length}`;
    }
  }

  // ------------------------------------------------------------ drifting leaves (per-shot volumes)
  if (!soloM && !(typeof location !== 'undefined' && /vegdrift=0/.test(location.search))) {
    const NMAX = 48;
    const DR = ctx.rng('veg-drift');
    const U = { uDC: [], uDS: [], uDW: [], uDA: [], uDB: [] };
    for (let i = 0; i < 10; i++) {
      U.uDC.push(new THREE.Vector4()); U.uDS.push(new THREE.Vector4(1, 1, 1, 0.09)); U.uDW.push(new THREE.Vector4());
      U.uDA.push(new THREE.Vector3(0.3, 0.02, 0.01)); U.uDB.push(new THREE.Vector3(0.45, 0.08, 0.01));
    }
    const set = (i, c, size, vel, n, scale, ca, cb) => {
      U.uDC[i].set(c[0], c[1], c[2], 1); U.uDS[i].set(size[0], size[1], size[2], scale); U.uDW[i].set(vel[0], vel[1], vel[2], Math.min(n, NMAX));
      U.uDA[i].set(ca[0], ca[1], ca[2]); U.uDB[i].set(cb[0], cb[1], cb[2]);
    };
    // shot 9: crimson leaves falling past the macro spray (from 0.5 m to ~3.6 m in front of the lens)
    const k9 = SHOTS[9] && SHOTS[9].keys && SHOTS[9].keys[0];
    if (k9) {
      const C = V3(...k9.pos), D = V3(...k9.look).sub(C).normalize();
      const c = C.clone().addScaledVector(D, 2.1);
      // (tall box: leaves keep falling past the lens while the camera lifts over the spray)
      set(9, [c.x, c.y + 1.7, c.z], [3.6, 6.6, 4.0], [0.08, 0.36, 0.05], 34, 0.085, [0.34, 0.015, 0.01], [0.5, 0.1, 0.012]);
    }
    // shot 3: yellow-green / orange momiji leaves across the pagoda corner
    set(3, [-42.5, 4.4, 2.0], [9, 7, 9], [0.16, 0.4, 0.1], 40, 0.09, [0.2, 0.17, 0.025], [0.42, 0.13, 0.015]);
    // shot 5: red leaves from the stair-side maple drifting past the hall eave corner
    set(5, [-8.0, 4.6, -5.5], [8, 7, 8], [0.14, 0.38, 0.1], 36, 0.085, [0.34, 0.015, 0.01], [0.48, 0.09, 0.012]);
    // shot 0: green-gold leaves drifting over the water beyond the lantern
    // (box ends at x = 40.4: no leaves inside the pavilion around the lantern camera)
    set(0, [36.4, 4.2, 18.5], [8, 7, 9], [0.12, 0.34, 0.08], 26, 0.1, [0.12, 0.17, 0.025], [0.36, 0.2, 0.03]);
    const g = leafCardGeo(THREE).clone();
    const seeds = new Float32Array(NMAX * 4), seeds2 = new Float32Array(NMAX * 4), folA = new Float32Array(NMAX * 4), bendA = new Float32Array(NMAX * 3), colA = new Float32Array(NMAX * 3);
    for (let i = 0; i < NMAX; i++) {
      for (let k = 0; k < 4; k++) { seeds[i * 4 + k] = DR.next(); seeds2[i * 4 + k] = DR.next(); }
      folA.set([0, 1, DR.range(0.15, 0.85), DR.int(0, 3)], i * 4);
      bendA.set([0, 1, 0], i * 3);
      colA.set([1, 1, 1], i * 3);
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(seeds2, 4));
    g.setAttribute('aFol', new THREE.InstancedBufferAttribute(folA, 4));
    g.setAttribute('aBend', new THREE.InstancedBufferAttribute(bendA, 3));
    const uni = {}; for (const k in U) uni[k] = { value: U[k] };
    const dmat = foliageMaterial(ctx, 'maple', mapleTex, {
      vertexHead: DRIFT_HEAD, vertexWorld: DRIFT_VW, flatNormal: true, uniforms: uni,
      transTint: [2.1, 1.8, 1.0], transBack: 1.2, transFwd: 2.4, transDepth: 0.5, leak: 0.4, bend: 0.0, roughness: 0.55,
      accent: [0.55, 0.2, 0.025], accent2: [0.16, 0.008, 0.03], petiole: [0.2, 0.05, 0.025], flutter: 0.0, fatten: 0.15, spec: 0.4, ao: 0.0, name: 'drift',
    });
    const im = new THREE.InstancedMesh(g, dmat.m, NMAX);
    im.instanceColor = new THREE.InstancedBufferAttribute(colA, 3);
    im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
    im.name = 'leaves_drift';
    heroParts.push(im);
  }
  const tTrees = performance.now();

  // ------------------------------------------------------------ shrubs
  const moundGeoBase = new THREE.IcosahedronGeometry(1, 2);
  const mounds = [];
  const SR = ctx.rng('veg-shrubs');
  const addMound = (x, z, r, kind = 'azalea', hRatio = 0.62) => {
    if (soloM) return false;
    if (site.clearance(x, z, { pondMargin: 0.4, pathMargin: 0.25, lanternR: 0.5 }) < r * 0.6) return false;
    if (inKeep({ x, y: groundY(x, z) + 0.3, z }, r)) return false;
    if (mounds.some((m) => Math.hypot(m.x - x, m.z - z) < (m.r + r) * 0.72)) return false;
    mounds.push({ x, z, r, kind, hRatio: hRatio * SR.range(0.72, 1.08), y: groundY(x, z) });
    return true;
  };
  // hall front planting strip (both sides of the stair)
  const hz = L.hall.stairs.frontZ + 1.4;
  for (const [x0, x1] of [[-6.5, 2.2], [17.8, 26.5]]) {
    for (let x = x0; x <= x1; x += SR.range(1.3, 1.9)) addMound(x, hz + SR.range(-0.4, 0.5), SR.range(0.55, 0.9), SR.chance(0.4) ? 'azaleaPink' : 'azalea');
  }
  // pagoda platform corners
  {
    const P = L.pagoda, hw = P.platform.w / 2 + 1.6;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      for (let k = 0; k < 3; k++) addMound(P.center[0] + sx * hw + SR.range(-1.2, 1.2), P.center[2] + sz * hw + SR.range(-1.2, 1.2), SR.range(0.5, 0.9), SR.pick(['azalea', 'azalea', 'boxwood', 'azaleaPink']));
    }
  }
  // pond shore groups
  {
    const outline = L.pond.outline;
    let per = 0;
    const segs = [];
    for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l }); per += l; }
    const N = 46;
    for (let k = 0; k < N; k++) {
      let d = ((k + SR.range(0, 0.8)) / N) * per;
      let sgi = 0; while (d > segs[sgi].l) { d -= segs[sgi].l; sgi++; }
      const { a, b, l } = segs[sgi];
      const t = d / l;
      const px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
      // outward normal (outline is clockwise in x,z with +z south -> compute via centroid)
      const cx = 9, cz = 20;
      let nx = px - cx, nz = pz - cz; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
      const off = SR.range(1.6, 3.4);
      const r = SR.range(0.45, 1.0);
      const kind = SR.pick(['azalea', 'azalea', 'azaleaPink', 'boxwood', 'azaleaRed', 'azalea']);
      addMound(px + nx * off, pz + nz * off, r, kind);
      if (SR.chance(0.5)) addMound(px + nx * (off + r * 1.3) + SR.range(-0.8, 0.8), pz + nz * (off + r * 1.3) + SR.range(-0.8, 0.8), r * 0.7, kind);
    }
  }
  // near lanterns
  for (const l of L.stoneLanterns) {
    const a = SR.range(0, TAU);
    addMound(l[0] + Math.cos(a) * 1.5, l[1] + Math.sin(a) * 1.5, SR.range(0.45, 0.75), SR.pick(['azalea', 'boxwood', 'azaleaPink']));
  }
  // island
  for (let k = 0; k < 4; k++) {
    const isl = L.pond.island;
    const c = isl[k % isl.length];
    const x = c[0] * 0.6 + -2 * 0.4 + SR.range(-0.5, 0.5), z = c[1] * 0.6 + 20 * 0.4 + SR.range(-0.5, 0.5);
    // (the east tip stays bare: the low sun crosses it on the way to the lotus bed)
    if (site.onIsland(x, z) && !inKeep({ x, y: 0.5, z }, 0.7)) mounds.push({ x, z, r: SR.range(0.4, 0.65), kind: SR.pick(['azalea', 'azaleaPink']), hRatio: 0.6, y: groundY(x, z) });
  }
  // garden (south) and corridor edges
  for (let k = 0; k < 40; k++) {
    const x = SR.range(inner.x0 + 1.5, inner.x1 - 1.5);
    const z = SR.chance(0.5) ? SR.range(inner.z1 - 7, inner.z1 - 1) : SR.range(inner.z0 + 1, inner.z0 + 6);
    addMound(x, z, SR.range(0.5, 1.1), SR.pick(['azalea', 'azalea', 'boxwood', 'azaleaPink', 'azaleaRed']));
  }
  for (let k = 0; k < 24; k++) {
    const x = SR.chance(0.5) ? SR.range(inner.x0 + 1, inner.x0 + 5) : SR.range(inner.x1 - 5, inner.x1 - 1);
    const z = SR.range(inner.z0 + 2, inner.z1 - 2);
    addMound(x, z, SR.range(0.5, 1.0), SR.pick(['azalea', 'boxwood', 'azaleaPink']));
  }

  // build mound base meshes + leaf cards
  const mpos = [], mnrm = [], mtint = [], midx = [];
  const bp = moundGeoBase.attributes.position;
  const bIdx = moundGeoBase.index ? moundGeoBase.index.array : null;
  const tints = {
    azalea: [0.04, 0.066, 0.018], azaleaPink: [0.04, 0.066, 0.018], azaleaRed: [0.04, 0.063, 0.018], boxwood: [0.058, 0.08, 0.02],
  };
  let mvc = 0;
  for (const m of mounds) {
    const seed = Math.floor(SR.range(0, 999));
    const tint = tints[m.kind];
    // a clipped mound is a cluster of overlapping domes (karikomi)
    const lobes = [{ x: m.x, z: m.z, r: m.r, ry: m.r * m.hRatio }];
    const nl = m.r > 0.6 ? SR.int(2, 4) : SR.int(1, 3);
    for (let k = 0; k < nl; k++) {
      const a = SR.range(0, TAU), d = m.r * SR.range(0.5, 0.95);
      const rr = m.r * SR.range(0.5, 0.75);
      lobes.push({ x: m.x + Math.cos(a) * d, z: m.z + Math.sin(a) * d, r: rr, ry: rr * m.hRatio * SR.range(0.85, 1.15) });
    }
    const flowering = m.kind === 'azaleaPink' || m.kind === 'azaleaRed';
    const card = m.kind === 'boxwood' ? 0.15 : 0.2;
    const dens = m.kind === 'boxwood' ? 230 : 190;
    const shapeN = (lx, ly, lz) => 1 + 0.2 * (vnoise3(lx * 1.6 + seed, ly * 1.6, lz * 1.6, seed) - 0.5) * 2 + 0.06 * (vnoise3(lx * 4 + seed, ly * 4, lz * 4, seed + 3) - 0.5) * 2;
    for (const lb of lobes) {
      const ry = lb.ry;
      const vStart = mvc;
      for (let i = 0; i < bp.count; i++) {
        const vx = bp.getX(i), vy = bp.getY(i), vz = bp.getZ(i);
        const nse = shapeN(vx, vy, vz);
        let x = vx * lb.r * nse, y = vy * ry * nse, z = vz * lb.r * nse;
        if (y < -ry * 0.25) y = -ry * 0.25 + (y + ry * 0.25) * 0.15;
        mpos.push(lb.x + x, m.y + y + ry * 0.22, lb.z + z);
        mtint.push(tint[0], tint[1], tint[2]);
        mnrm.push(0, 1, 0);
      }
      if (bIdx) for (let i = 0; i < bIdx.length; i++) midx.push(vStart + bIdx[i]);
      mvc += bp.count;

      // leaf cards on the surface
      const area = 2 * Math.PI * lb.r * lb.r * 0.8;
      const N = Math.round(area * dens);
      for (let i = 0; i < N; i++) {
        const th = Math.acos(1 - SR.next() * (1 - Math.cos(1.95)));
        const ph = SR.range(0, TAU);
        const f = SR.range(0.95, 1.06);
        const lx = Math.sin(th) * Math.cos(ph), ly = Math.cos(th), lz = Math.sin(th) * Math.sin(ph);
        const nse = shapeN(lx, ly, lz);
        let py = ly * ry * nse * f;
        if (py < -ry * 0.25) py = -ry * 0.25 + (py + ry * 0.25) * 0.15;
        const p = V3(lb.x + lx * lb.r * nse * f, m.y + py + ry * 0.22, lb.z + lz * lb.r * nse * f);
        // skip cards buried inside a neighbouring lobe
        let buried = false;
        for (const o of lobes) {
          if (o === lb) continue;
          const q = ((p.x - o.x) / o.r) ** 2 + ((p.y - m.y - o.ry * 0.22) / o.ry) ** 2 + ((p.z - o.z) / o.r) ** 2;
          if (q < 0.7) { buried = true; break; }
        }
        if (buried) continue;
        const n = V3(lx / lb.r, ly / ry, lz / lb.r).normalize();
        const Z = n.clone().add(randUnit(SR).multiplyScalar(0.38)).normalize();
        const [X, Y, Zb] = orthoBasis(perpOf(Z).applyAxisAngle(Z, SR.range(0, TAU)), Z);
        const sc = card * SR.range(0.8, 1.2);
        let cell = 0;
        if (m.kind === 'boxwood') cell = 2;
        else if (flowering && SR.chance(th < 1.3 ? 0.72 : 0.4)) cell = m.kind === 'azaleaPink' ? 1 : 3;
        const ao = Math.min(1, (0.3 + 0.7 * Math.max(0, ly * 0.6 + 0.4)) * (0.7 + 0.3 * (f - 0.95) / 0.11));
        const v = SR.range(0.82, 1.15);
        fol.shrub.push(X.multiplyScalar(sc), Y.multiplyScalar(sc), Zb.multiplyScalar(sc), p, [0.12, ao, 0, cell], n, [v, v, v * SR.range(0.92, 1.05)]);
      }
    }
  }

  // ferns near pond rocks / building bases
  const FN = ctx.rng('veg-ferns');
  const ferns = [];
  {
    const outline = L.pond.outline;
    for (let k = 0; k < 34; k++) {
      const i = FN.int(0, outline.length - 1);
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const t = FN.next();
      const px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
      let nx = px - 9, nz = pz - 20; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
      const off = FN.range(1.0, 2.6);
      const x = px + nx * off, z = pz + nz * off;
      if (site.clearance(x, z, { pondMargin: 0.3, pathMargin: 0.2, lanternR: 0.6 }) < 0.3) continue;
      if (mounds.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + 0.3)) continue;
      if (inKeep({ x, y: 0.3, z }, 0.8)) continue;
      ferns.push([x, z, FN.range(0.45, 0.85)]);
    }
  }
  for (const [x, z, s] of ferns) {
    const y = groundY(x, z);
    const n = FN.int(9, 15);
    const a0 = FN.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const az = a0 + (i / n) * TAU + FN.range(-0.25, 0.25);
      const out = V3(Math.cos(az), 0, Math.sin(az));
      const elev = FN.range(0.6, 1.15);
      const Y = out.clone().multiplyScalar(Math.cos(elev)).addScaledVector(UP, Math.sin(elev)).normalize();
      // Z = arch direction: outward/down
      const Zh = out.clone().multiplyScalar(Math.sin(elev)).addScaledVector(UP, -Math.cos(elev));
      const [X, Yb, Zb] = orthoBasis(Y, Zh);
      const L0 = s * FN.range(0.75, 1.1);
      const w = L0 * 0.32;
      const p = V3(x + out.x * 0.04, y, z + out.z * 0.04);
      const v = FN.range(0.85, 1.1);
      fol.fern.push(X.multiplyScalar(w), Yb.multiplyScalar(L0), Zb.multiplyScalar(L0), p, [0.25, 0.75, 0, 0], Y.clone().lerp(UP, 0.5).normalize(), [v, v, v]);
    }
  }

  const tShrubs = performance.now();

  // ------------------------------------------------------------ assemble
  const group = new THREE.Group();
  group.name = 'vegetation';
  for (const k of ['pine', 'maple', 'cherry']) {
    if (!acc[k].vc) continue;
    const g = acc[k].toGeometry();
    const mesh = new THREE.Mesh(g, bark[k].m);
    mesh.customDepthMaterial = bark[k].dm;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = 'bark_' + k;
    group.add(mesh);
  }
  const leafGeo = leafCardGeo(THREE);
  const tGeo = tuftGeo(THREE);
  const cGeo = clusterGeo(THREE, 3);
  const sGeo = shrubCardGeo(THREE);
  const fGeo = frondGeo(THREE);
  // (fern texture is a single image: frond uvs span 0..1 and aFol.w = 0 adds no cell offset)
  const parts = [
    fol.maple.build(THREE, leafGeo, folMaple.m, folMaple.dm, 'leaves_maple'),
    fol.mapleHero.build(THREE, leafGeo, folMapleHero.m, folMapleHero.dm, 'leaves_maple_hero'),
    fol.mapleFar.build(THREE, leafGeo, folMapleFar.m, folMapleFar.dm, 'leaves_maple_far'),
    fol.pine.build(THREE, tGeo, folPine.m, folPine.dm, 'needles_pine'),
    fol.blossom.build(THREE, cGeo, folBlossom.m, folBlossom.dm, 'blossom_cherry'),
    fol.shrub.build(THREE, sGeo, folShrub.m, folShrub.dm, 'leaves_shrub'),
    fol.fern.build(THREE, fGeo, folFern.m, folFern.dm, 'fronds_fern'),
  ];
  for (const p of parts.concat(heroParts)) if (p) { p.onBeforeRender = (r, scene) => refreshShadowRange(scene); group.add(p); }
  {
    const cg = cores.toGeometry(THREE);
    if (cg) {
      const cm = new THREE.Mesh(cg, padCoreMat);
      cm.customDepthMaterial = padCoreDm;
      cm.castShadow = true; cm.receiveShadow = true; cm.name = 'pine_pad_cores';
      group.add(cm);
    }
  }
  if (mvc) {
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mpos, 3));
    mg.setAttribute('normal', new THREE.Float32BufferAttribute(mnrm, 3));
    mg.setAttribute('aTint', new THREE.Float32BufferAttribute(mtint, 3));
    mg.setIndex(mvc > 65535 ? new THREE.Uint32BufferAttribute(midx, 1) : new THREE.Uint16BufferAttribute(midx, 1));
    mg.computeVertexNormals();
    mg.computeBoundingSphere();
    const mm = new THREE.Mesh(mg, moundMat);
    mm.castShadow = true; mm.receiveShadow = true; mm.name = 'shrub_mounds';
    group.add(mm);
  }

  // debug: show the atlases on panels at the origin (?vegatlas=1, view cam=0,2,6&look=0,2,0)
  if (typeof location !== 'undefined' && /vegatlas=1/.test(location.search)) {
    const texs = [mapleTex, pineTex, blossomTex, shrubTex];
    texs.forEach((t, i) => {
      const pm = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pm);
      pl.geometry.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 1) arr[k] = 1 - v; });
      pl.position.set(-3.3 + i * 2.2, 2, 0);
      group.add(pl);
    });
  }

  const tris = acc.pine.triCount + acc.maple.triCount + acc.cherry.triCount;
  if (typeof location !== 'undefined' && /vegstats=1/.test(location.search)) console.warn('[vegetation] per tree: ' + perTree.join(' | '));
  console.warn(`[vegetation] trees=${stats.trees} barkTris=${tris} leaves=${fol.maple.n}+${fol.mapleHero.n}+${fol.mapleFar.n} tufts=${fol.pine.n} blossoms=${fol.blossom.n} shrubCards=${fol.shrub.n} mounds=${mounds.length} coreTris=${cores.tris} fronds=${fol.fern.n} ${stats.hero || ""} | tex ${(tTex - t0).toFixed(0)}ms trees ${(tTrees - tTex).toFixed(0)}ms shrubs ${(tShrubs - tTrees).toFixed(0)}ms total ${(performance.now() - t0).toFixed(0)}ms`);

  return {
    object: group,
    showcase: [
      { cam: [49.5, 2.75, 18.5], look: [-30, 12, -3], focal: 24 },
      { cam: [-25.5, 2.0, -0.5], look: [-31.5, 14.5, -8], focal: 22 },
      { cam: [10, 1.8, 50], look: [-12, 10, -12], focal: 70 },
    ],
  };
}
