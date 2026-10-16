// ---------------------------------------------------------------------------
// buildings-mat.js — hero surface shaders for the buildings (pavilion, gate,
// corridor, halls): worn vermilion urushi lacquer (negoro edge wear, brush
// streaks, clearcoat breakup), engraved gilt fittings (kanagu) and an
// anti-aliased lacquered plank floor. Hooks for ctx.mat.patch().
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// Wrap a patched MeshPhysicalMaterial so per-pixel g_cc / g_ccr modulate the
// clearcoat (the engine hooks run before lights_physical_fragment assigns it).
export function withClearcoatMod(mat) {
  const prev = mat.onBeforeCompile;
  mat.userData.ccMod = true;
  mat.defines = Object.assign(mat.defines || {}, { B_CCMOD: '' });
  mat.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat = saturate(material.clearcoat * g_cc);
  material.clearcoatRoughness = clamp(material.clearcoatRoughness + g_ccr, 0.06, 1.0);
#endif`);
    // the urushi coat is a thin film: its surface follows the brush marks / grain
    // telegraphing of the bumped base, so highlights break up instead of reading as plastic
    shader.fragmentShader = shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
#if defined( USE_CLEARCOAT ) && defined( B_CCFOLLOW )
  clearcoatNormal = normalize(mix(clearcoatNormal, normal, B_CCFOLLOW));
#endif`);
  };
  mat.needsUpdate = true;
  return mat;
}

// grain: 'v' vertical members (columns), 'h' horizontal members (grain along the
// horizontal tangent of the face). edge: negoro wear on chamfer facets.
export function lacquerHooks({ base = 'vec3(0.50, 0.072, 0.028)', grain = 'h', edge = true, wear = 1.0, fine = false, ccFollow = 0.5 } = {}) {
  const gscale = grain === 'v'
    ? 'vec3(7.0, 0.22, 7.0)'
    : 'mix(vec3(7.0), vec3(0.22), abs(gT))';
  return {
    defines: { B_LAC_EDGE: edge ? 1 : 0, B_LAC_FINE: fine ? 1 : 0, B_CCFOLLOW: ccFollow.toFixed(2) },
    uniforms: fine ? { uLacFloor: { value: 0.5 } } : undefined,
    fragHead: /* glsl */ `float g_h; float g_cc; float g_ccr; float g_rf; float g_hf;
    #if B_LAC_FINE == 1
    uniform float uLacFloor;
    #endif`,
    fragColor: /* glsl */ `
    {
      vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
      vec3 gT = abs(wn.y) > 0.7 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), wn));
      vec3 gs = ${gscale};
      float big = n_fbm3(wp * 0.21, 3);
      float mid = n_fbm3(wp * vec3(1.4, 0.4, 1.4) + 2.0, 3);
      float g1 = n_fbm3(wp * gs, 3);
      float grain = sin(g1 * 9.0 + n_snoise3(wp * gs * 0.5) * 2.0) * 0.5 + 0.5;
      float brush = n_snoise3(wp * gs * vec3(3.2) + 7.0);
      vec3 base = ${base};
      vec3 col = base * (0.86 + 0.15 * big + 0.05 * (grain - 0.5) + 0.03 * brush);
      float vert = 1.0 - abs(wn.y);
      // sun-bleached, slightly chalky lacquer on west-facing / exposed faces
      float sunF = clamp(dot(wn, normalize(vec3(-0.94, 0.3, 0.34))) * 0.7 + 0.3, 0.0, 1.0);
      float fade = smoothstep(0.35, 0.85, mid * 0.5 + 0.5 + big * 0.35) * sunF;
      col = mix(col, base * vec3(1.22, 1.55, 1.65), fade * 0.24 * ${wear.toFixed(2)});
      // rain run-off streaks (darker) on vertical faces
      float streak = n_fbm3(wp * vec3(8.0, 0.55, 8.0) + 3.0, 3);
      col *= 1.0 - smoothstep(0.1, 0.65, streak) * 0.16 * vert * ${wear.toFixed(2)};
      // dust on up-facing surfaces
      float up = smoothstep(0.55, 0.95, wn.y);
      float dust = up * smoothstep(-0.2, 0.6, n_fbm3(wp * 3.0 + 9.0, 3)) * 0.6;
      col = mix(col, vec3(0.20, 0.13, 0.09), dust * 0.35);
      // negoro wear: chamfer facets (diagonal normals) rubbed through to the black undercoat
      float ew = 0.0;
      #if B_LAC_EDGE == 1
      {
        vec3 an = abs(wn);
        float facet = 1.0 - smoothstep(0.88, 0.97, max(an.x, max(an.y, an.z)));
        float wn1 = n_fbm3(wp * 9.0 + 1.7, 3) * 0.5 + 0.5;
        ew = facet * smoothstep(0.42, 0.68, wn1) * ${wear.toFixed(2)};
        float chip = smoothstep(0.72, 0.8, n_fbm3(wp * 23.0, 2) * 0.5 + 0.5) * facet;
        ew = max(ew, chip);
        col = mix(col, mix(vec3(0.035, 0.022, 0.016), base * 1.25, smoothstep(0.55, 0.9, wn1) * 0.5), ew * 0.75);
      }
      #endif
      // ground grime
      float grime = 1.0 - smoothstep(0.0, 1.3, wp.y);
      col *= 1.0 - grime * 0.25 * (0.6 + 0.4 * big);
      g_hf = 0.0;
      float fDust = 0.0, fPol = 0.0, fStr = 0.0, fRub = 0.0, fCrz = 0.0;
      #if B_LAC_FINE == 1
      {
        // hand-rubbed urushi on old timber: the grain telegraphs through the coats as
        // long tonal streaks and faint ridges, lacquer pools darker in the valleys,
        // a fine dust film dulls the untouched parts, hands polish (and rub through)
        // a band at hand height, and sun-weathered coats craze across the grain.
        float sA = n_fbm3(wp * gs * 3.8 + 4.0, 3);
        float sB = n_snoise3(wp * gs * 10.0 + 11.0);
        vec3 fq = wp * gs * 27.0;
        float fAA = 1.0 - smoothstep(0.35, 0.9, length(fwidth(fq)));
        float sC = n_snoise3(fq) * fAA;
        fStr = smoothstep(-0.1, 0.65, sA);
        col *= 1.0 + 0.07 * sA + 0.045 * sB + 0.025 * sC;
        col = mix(col, col * vec3(0.66, 0.55, 0.52), fStr * 0.42);
        // height above the floor this member stands on
        float hy = wp.y - uLacFloor;
        float hand = smoothstep(0.75, 1.0, hy) * (1.0 - smoothstep(1.55, 1.9, hy));
        float pn = n_fbm3(wp * vec3(2.2, 1.1, 2.2) + 31.0, 3) * 0.5 + 0.5;
        fPol = hand * smoothstep(0.3, 0.7, pn);
        col *= 1.0 - fPol * 0.16;
        // rubbed through to the brown-black undercoat in small irregular patches
        float rn = n_fbm3(wp * gs * 1.6 + 7.3, 4) * 0.5 + 0.5;
        fRub = smoothstep(0.66, 0.8, rn) * (0.25 + 0.75 * hand) * smoothstep(0.2, 0.8, pn);
        col = mix(col, vec3(0.055, 0.024, 0.014), fRub * 0.7);
        // dust film: patchy, heavier high up and right at the base, none where hands touch
        float dn = n_fbm3(wp * vec3(3.2, 1.4, 3.2) + 19.0, 3) * 0.5 + 0.5;
        float dz = (1.0 - hand) * (0.45 + 0.55 * smoothstep(1.9, 2.6, hy) + 0.6 * (1.0 - smoothstep(0.0, 0.18, hy)));
        float dSpeck = smoothstep(0.55, 0.85, n_snoise3(wp * 260.0) * 0.5 + 0.5) * fAA;
        fDust = clamp(smoothstep(0.35, 0.75, dn) * dz * 0.85 + dSpeck * 0.25 * dz, 0.0, 1.0);
        col = mix(col, vec3(0.27, 0.215, 0.18), fDust * 0.3);
        // crazing (danmon): fine cracks across the grain on sun-exposed coats
        vec2 wc = n_worley3(wp * ${grain === 'v' ? 'vec3(50.0, 140.0, 50.0)' : 'mix(vec3(50.0), vec3(140.0), abs(gT))'} + 3.0);
        float cAA = 1.0 - smoothstep(0.25, 0.7, length(fwidth(wp)) * 140.0);
        fCrz = (1.0 - smoothstep(0.0, 0.12, wc.y - wc.x)) * cAA * smoothstep(0.35, 0.75, pn + fade) * (1.0 - hand * 0.7);
        col *= 1.0 - fCrz * 0.22;
        // faint ridges (metres): grain telegraphing + crack edges
        g_hf = (sA * 0.00028 + sB * 0.0001 + sC * 0.00001) - fCrz * 0.00003 + fDust * 0.00001;
        ${grain === 'v' ? `
        // drying checks (hiware) of old pillars: a few long, thin vertical splits
        {
          float ck = n_snoise3(wp * vec3(14.0, 0.45, 14.0) + 13.0);
          float ckm = smoothstep(0.5, 0.68, n_fbm3(wp * vec3(5.0, 0.3, 5.0) + 21.0, 2) * 0.5 + 0.5);
          float cw = 0.03 + fwidth(ck) * 1.0;
          float chk = (1.0 - smoothstep(0.0, cw, abs(ck))) * ckm * (1.0 - smoothstep(0.3, 0.9, fwidth(ck)));
          col *= 1.0 - chk * 0.7;
          g_hf -= chk * 0.0002;
          fStr = max(fStr, chk);
        }` : ''}
      }
      #endif
      diffuseColor.rgb *= col;
      g_h = (grain - 0.5) * 0.25 + brush * 0.08 + ew * 0.4 + mid * 0.15;
      g_rf = 0.36 + 0.12 * (big * 0.5 + 0.5) + 0.06 * brush + fade * 0.22 + dust * 0.35 + ew * 0.25;
      g_cc = (1.0 - ew * 0.75) * (1.0 - dust * 0.7) * (1.0 - fade * 0.45) * (0.85 + 0.15 * big);
      g_ccr = 0.05 * brush + fade * 0.18 + dust * 0.3 + 0.04 * (grain - 0.5);
      #if B_LAC_FINE == 1
        g_rf += fStr * 0.1 + fDust * 0.4 + fRub * 0.15 + fCrz * 0.2 - fPol * 0.12;
        g_cc *= (1.0 - fDust * 0.8) * (1.0 - fRub * 0.6) * (0.75 + 0.25 * (1.0 - fStr)) * (1.0 + fPol * 0.3);
        g_ccr += fStr * 0.08 + fDust * 0.35 + fCrz * 0.15 - fPol * 0.08;
      #endif
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(g_rf, 0.18, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0018);
    #if B_LAC_FINE == 1
      normal = n_bumpView(-vViewPosition, normal, g_hf, 1.0);
    #endif`,
  };
}

// Gilt bronze fittings (kanagu): matte punched ground with polished raised
// karakusa scroll, tarnish in the recesses. amp scales the relief.
export function giltHooks({ base = 'vec3(1.0, 0.70, 0.30)', period = 0.05, amp = 1.0 } = {}) {
  return {
    fragHead: /* glsl */ `
      float g_h; float g_rel; float g_tar;
      float bk_scroll(vec2 p, float P){
        vec2 q = p / P;
        vec2 id = floor(q); vec2 f = fract(q) - 0.5;
        float fl = mod(id.x + id.y, 2.0) * 2.0 - 1.0;
        f.y *= fl;
        float vine = abs(f.y - 0.17 * sin(f.x * 6.2831853));
        float curl = abs(length(f - vec2(0.2, 0.2)) - 0.13);
        float leaf = length((f - vec2(-0.22, -0.2)) * vec2(1.0, 1.8)) - 0.07;
        float d = min(vine, curl);
        float aa = max(fwidth(q.x) + fwidth(q.y), 1e-4);
        float r = smoothstep(0.075 + aa, 0.075 - aa, d);
        r = max(r, smoothstep(aa, -aa, leaf));
        // fade out when the pattern drops below a few pixels
        return r * (1.0 - smoothstep(0.06, 0.16, aa));
      }
    `,
    fragColor: /* glsl */ `
    {
      vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
      vec3 w = pow(abs(wn), vec3(6.0)); w /= (w.x + w.y + w.z + 1e-5);
      float P = ${period.toFixed(4)};
      g_rel = bk_scroll(wp.zy, P) * w.x + bk_scroll(wp.xz, P) * w.y + bk_scroll(wp.xy, P) * w.z;
      g_rel *= ${amp.toFixed(2)};
      float n = n_fbm3(wp * 3.1, 3);
      g_tar = smoothstep(0.15, 0.8, n_fbm3(wp * 0.9 + 7.0, 3) * 0.5 + 0.5);
      vec3 base = ${base};
      vec3 col = base * (0.92 + 0.12 * n);
      col = mix(col, base * vec3(0.52, 0.40, 0.24), g_tar * 0.32);
      // punched (nanako) ground reads darker & warmer, relief polished bright
      col = mix(col * vec3(0.80, 0.74, 0.62), col * 1.04, g_rel);
      // grime in the ground on lower / sheltered fittings
      col *= 1.0 - (1.0 - g_rel) * smoothstep(0.2, 0.9, -wn.y + 0.3) * 0.15;
      diffuseColor.rgb *= col;
      g_h = n * 0.25 + g_tar * 0.2;
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(mix(0.40, 0.15, g_rel) + g_tar * 0.12 + g_h * 0.05, 0.08, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_rel * 0.0007 + g_h * 0.0008, 1.0);`,
  };
}

// Lacquered plank floor, anti-aliased grain. axis: 'x' | 'z' (plank direction)
export function floorHooks({ axis = 'z', plank = 0.242, base = 'vec3(0.105, 0.046, 0.026)' } = {}) {
  const along = axis === 'z' ? 'wp.z' : 'wp.x';
  const across = axis === 'z' ? 'wp.x' : 'wp.z';
  return {
    fragHead: /* glsl */ `float g_h; float g_wr; float g_cc; float g_ccr;`,
    fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      float a = ${along}, c = ${across};
      float pid = floor(c / ${plank.toFixed(4)});
      float ph = fract(sin(pid * 91.7 + 3.1) * 43758.5453);
      float seg = floor((a + ph * 3.0) / 2.6);
      float ph2 = fract(sin(pid * 17.3 + seg * 41.9) * 23421.631);
      vec2 gp = vec2(a * 0.6 + ph * 13.0, c * 30.0 + ph2 * 5.0);
      float g = n_fbm(vec2(gp.x * 0.5, gp.y * 0.18), 3) * 2.2;
      float ringsRaw = sin((gp.y + g * 3.0) * 1.9);
      float fw = fwidth(gp.y + g * 3.0) * 1.9;
      float rings = mix(ringsRaw, 0.0, smoothstep(0.6, 2.0, fw)) * 0.5 + 0.5;
      float big = n_fbm3(wp * 0.6, 3);
      vec3 base = ${base};
      vec3 col = base * (0.78 + 0.32 * ph2 + 0.18 * big) * (0.86 + 0.22 * rings);
      col *= mix(vec3(1.0), vec3(1.15, 0.95, 0.85), ph);
      // foot traffic: polished paler path, dull lacquer near the edges
      float wear = smoothstep(0.1, 0.7, n_fbm3(wp * vec3(0.8, 1.0, 0.8) + 5.0, 3) * 0.5 + 0.5);
      col = mix(col, col * vec3(1.35, 1.18, 1.05), wear * 0.35);
      diffuseColor.rgb *= col;
      g_h = rings * 0.4 + big * 0.2;
      g_wr = wear;
      g_cc = 0.75 - wear * 0.45;
      g_ccr = wear * 0.25 + big * 0.05;
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(0.30 + g_wr * 0.25 + g_h * 0.08, 0.12, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0006);`,
  };
}

export function makeHeroMats(ctx) {
  const { mat } = ctx;
  const lac = (o, cc = 0.4, ccr = 0.22, rough = 0.42) => {
    const m = mat.phys({ color: 0xffffff, roughness: rough, metalness: 0, clearcoat: cc, clearcoatRoughness: ccr }, lacquerHooks(o));
    return withClearcoatMod(m);
  };
  const H = {};
  H.col = lac({ grain: 'v', edge: false, fine: true, base: 'vec3(0.46, 0.064, 0.026)', ccFollow: 0.85 }, 0.2, 0.3);
  H.red = lac({ grain: 'h', edge: true, fine: true, ccFollow: 0.7 });
  H.rafter = lac({ grain: 'h', edge: false, wear: 0.7 });
  H.redDark = lac({ base: 'vec3(0.30, 0.040, 0.020)', grain: 'h', edge: true, wear: 0.8 }, 0.3, 0.3, 0.5);
  H.gold = mat.std({ color: 0xffffff, roughness: 0.25, metalness: 1.0 }, giltHooks({}));
  H.cap = mat.std({ color: 0xffffff, roughness: 0.3, metalness: 1.0 }, giltHooks({ base: 'vec3(1.0, 0.72, 0.32)', period: 0.04, amp: 0.8 }));
  const fl = (axis) => withClearcoatMod(mat.phys({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.12 }, floorHooks({ axis })));
  H.floorX = fl('x');
  H.floorZ = fl('z');
  for (const [k, v] of Object.entries(H)) v.name = 'bk.' + k;
  return H;
}
