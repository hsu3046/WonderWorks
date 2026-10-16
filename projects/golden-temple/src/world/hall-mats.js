// ---------------------------------------------------------------------------
// hall-mats: hall-specific material variants.
//  - every exterior material gets a baked ambient-occlusion attribute (aAO)
//    that attenuates indirect light only (deep eaves, porch, crawlspace)
//  - "orn": vermilion lacquer with raised gold karakusa / flower relief
//    (kirikane-style ornament for beams, gables, transoms)
//  - "blackOrn": black lacquer with fine gold scroll relief
// ---------------------------------------------------------------------------

// Screen-space footprint filter: hk_aa(f) is 1 while a pattern of spatial
// frequency f (cycles / metre) is well resolved and fades to 0 as its period
// approaches the pixel footprint (kills sub-pixel shimmer in motion).
export const AA_HEAD = /* glsl */ `
#ifndef HK_AA
#define HK_AA
float hk_aa(float f){ return 1.0 - smoothstep(0.12, 0.45, f * length(fwidth(vWPos))); }
vec2 hk_uv(vec3 wp, vec3 wn){ vec3 a = abs(wn); return a.y > max(a.x, a.z) ? wp.xz : (a.x > a.z ? wp.zy : wp.xy); }
#endif`;

export const AO_HOOKS = {
  vertexHead: 'attribute float aAO; varying float vAO;',
  vertexWorld: 'vAO = aAO;',
  fragHead: 'varying float vAO;' + AA_HEAD,
  fragLight: 'reflectedLight.indirectDiffuse *= vAO; reflectedLight.indirectSpecular *= mix(1.0, vAO, 0.75);',
  // specular anti-aliasing: widen the lobe where the (bump-perturbed) normal
  // varies within a pixel, so tiny highlights on gilt studs / bumped lacquer
  // do not sparkle frame to frame (Kaplanyan-style normal variance filter)
  fragPhysical: /* glsl */ `
    {
      vec3 dnx = dFdx(normal), dny = dFdy(normal);
      float kv = min(0.5 * (dot(dnx, dnx) + dot(dny, dny)), 0.18);
      float r2 = material.roughness * material.roughness;
      material.roughness = min(1.0, sqrt(sqrt(r2 * r2 + kv)));
      #ifdef USE_CLEARCOAT
      float c2 = material.clearcoatRoughness * material.clearcoatRoughness;
      material.clearcoatRoughness = min(1.0, sqrt(sqrt(c2 * c2 + kv)));
      #endif
    }`,
};

// fade fine procedural noise terms of the shared material library by the pixel footprint
function filterHF(h) {
  const out = { ...h };
  for (const k of ['fragColor', 'fragNormal']) {
    if (typeof out[k] !== 'string') continue;
    out[k] = out[k]
      .replace(/n_snoise3\((wp|vWPos) \* ([0-9]+\.[0-9]+)( \+ [0-9.]+)?\)/g, (m, v, f) => (+f >= 5 ? '(' + m + ' * hk_aa(' + f + '))' : m))
      .replace('n_snoise3(wp * gs * 2.7)', '(n_snoise3(wp * gs * 2.7) * hk_aa(24.0))')
      .replace('n_snoise3(wp * gs)', '(n_snoise3(wp * gs) * hk_aa(9.0))');
  }
  return out;
}

export function mergeHooks(...hs) {
  const out = {};
  for (const h of hs) {
    if (!h) continue;
    for (const [k, v] of Object.entries(h)) {
      if (k === 'uniforms' || k === 'defines') out[k] = Object.assign(out[k] || {}, v);
      else if (typeof v === 'string') out[k] = (out[k] ? out[k] + '\n' : '') + v;
    }
  }
  return out;
}

export function aoVariant(ctx, base, extra = null, params = null) {
  const v = base.clone();
  if (params) Object.assign(v, params);
  const hooks = filterHF(mergeHooks(base.userData.patch || {}, extra, AO_HOOKS));
  ctx.mat.patch(v, hooks);
  v.name = (base.name || base.type) + '+ao';
  return v;
}

// Weathering layered on top of any base colour (needs the AO hooks, merged
// after): grime/soot darkening in sheltered joints & under eaves (low baked
// AO), chalky sun-faded up-facing tops, faint vertical rain-wash streaks.
// gr / fd / st scale the three effects.
export function weatherHooks(gr = 1.0, fd = 1.0, st = 1.0) {
  const f = (x) => Number(x).toFixed(3);
  return {
    fragColor: /* glsl */ `
      {
        vec3 wn = normalize(vWNrm);
        vec3 c = diffuseColor.rgb;
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        float gn = n_fbm3(vWPos * vec3(1.1, 2.6, 1.1) + 4.0, 3) * 0.5 + 0.5;
        float sh = smoothstep(0.12, 0.7, 1.0 - vAO);
        vec3 grime = mix(c, vec3(lum) * vec3(1.15, 0.86, 0.66), 0.4) * 0.6;
        c = mix(c, grime, sh * (0.45 + 0.55 * gn) * ${f(gr)});
        float up = smoothstep(0.4, 0.95, wn.y) * smoothstep(0.55, 0.95, vAO);
        vec3 faded = mix(c, vec3(lum), 0.4) * 1.45 + vec3(0.018, 0.012, 0.008);
        c = mix(c, faded, up * (0.55 + 0.45 * gn) * ${f(fd)});
        float vert = 1.0 - abs(wn.y);
        float stk = n_snoise3(vWPos * vec3(9.0, 0.28, 9.0) + 1.7) * 0.5 + 0.5;
        c *= 1.0 - vert * mix(0.12, smoothstep(0.55, 0.95, stk), hk_aa(9.0)) * 0.22 * ${f(st)};
        diffuseColor.rgb = c;
      }`,
  };
}

// Aged gilt: blotchy tarnish (darker, browner, rougher) and soot in recesses.
export function agedGiltHooks(amt = 1.0) {
  const a = Number(amt).toFixed(3);
  return {
    fragHead: 'float g_tarn;',
    fragColor: /* glsl */ `
      {
        float tn = smoothstep(0.42, 0.78, n_fbm3(vWPos * 2.4 + 9.0, 3) * 0.5 + 0.5);
        float fine = n_snoise3(vWPos * 23.0) * 0.5 + 0.5;
        g_tarn = clamp(tn * (0.7 + 0.3 * fine), 0.0, 1.0) * ${a};
        vec3 c = diffuseColor.rgb;
        c = mix(c, c * vec3(0.52, 0.42, 0.30), g_tarn * 0.65);
        c *= mix(0.62, 1.0, smoothstep(0.15, 0.85, vAO));
        // gold-leaf squares (kinpaku, ~10.9 cm) laid with faint overlapping seams,
        // plus fine wiping marks; both filtered by the pixel footprint
        {
          vec2 q = hk_uv(vWPos, normalize(vWNrm)) / 0.109 + vec2(0.37, 0.61);
          vec2 gq = abs(fract(q) - 0.5);
          vec2 px = fwidth(q) + 1e-4;
          vec2 ln = (1.0 - smoothstep(0.5 - 0.02 - px, 0.5 - 0.02 + px, gq)) ;
          ln = 1.0 - ln;
          float seam = max(ln.x, ln.y) * min(1.0, 0.04 / max(px.x, px.y)) * hk_aa(9.0);
          c *= 1.0 - 0.07 * seam;
          g_tarn = clamp(g_tarn + seam * 0.1, 0.0, 1.0);
        }
        diffuseColor.rgb = c;
      }`,
    fragRough: 'roughnessFactor = clamp(roughnessFactor + g_tarn * 0.22, 0.05, 1.0);',
    // hammered / burnished leaf: low-amplitude normal ripple so flat fittings
    // pick up a range of reflections instead of one uniform tint
    fragNormal: 'normal = n_bumpView(-vViewPosition, normal, n_snoise3(vWPos * 11.0) * 0.5 + g_tarn * 0.4, 0.0016);',
    // gilt in shade reflects mostly blue sky, which tints it olive/pale; real
    // leaf in shade reads deep amber (inter-reflection off red lacquer and
    // the gilt itself). Pull the indirect specular toward a warm hue at equal
    // luminance.
    fragLight: /* glsl */ `
      {
        vec3 s = reflectedLight.indirectSpecular;
        float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        reflectedLight.indirectSpecular = mix(s, l * vec3(1.45, 0.92, 0.38), 0.55);
      }`,
  };
}

// Aged lacquer micro-detail for close-ups: fine craquelure (elongated cell
// cracks along the member), multi-scale tonal mottling; the cracks are drawn
// with analytic coverage and fade out entirely before they get sub-pixel.
export function lacquerMicroHooks(amt = 1.0) {
  const a = Number(amt).toFixed(3);
  return {
    fragHead: 'float g_crk;',
    fragColor: /* glsl */ `
      {
        vec3 wn = normalize(vWNrm);
        vec2 uv = hk_uv(vWPos, wn);
        float aa = hk_aa(26.0);
        // (no branch: fwidth must run in uniform control flow)
        vec2 w = n_worley(uv * vec2(24.0, 13.0) + 5.3);
        float e = w.y - w.x;
        float px = fwidth(e) + 1e-4;
        float lw = 0.045;
        g_crk = (1.0 - smoothstep(lw - px, lw + px, e)) * min(1.0, lw / px) * aa * ${a};
        float m1 = n_snoise3(vWPos * 0.7 + 3.1);
        float m2 = n_snoise3(vWPos * 3.9 + 7.7) * hk_aa(3.9);
        diffuseColor.rgb *= (1.0 + 0.08 * m1 + 0.05 * m2) * (1.0 - 0.32 * g_crk);
      }`,
    fragRough: 'roughnessFactor = mix(roughnessFactor, 0.95, g_crk);',
  };
}

// Painted bracket members (kumimono saishiki). Uses primitive-local coords
// (aLoc, see Mesher.wantLoc) and a per-primitive code in aTint:
//   0 = plain lacquer, 1 = bracket arm (local y 0..0.19 above its soffit),
//   2 = continuous bracket beam (local y centred, half height 0.095).
// The lower part of each member face gets an ungen-graded band (deep → light
// rokushō green on arms, gunjō blue on beams) capped by a thin white line;
// soffits (down-facing) are painted in the deep colour.
export function paintHooks() {
  return {
    vertexHead: 'attribute float aTint; varying float vTint; attribute vec3 aLoc; varying vec3 vLoc;',
    vertexWorld: 'vTint = aTint; vLoc = aLoc;',
    fragHead: 'varying float vTint; varying vec3 vLoc; float g_paint;',
    fragColor: /* glsl */ `
      g_paint = 0.0;
      if (vTint > 0.5) {
        vec3 wn = normalize(vWNrm);
        bool blue = vTint > 1.5;
        vec3 deep = blue ? vec3(0.022, 0.062, 0.24) : vec3(0.018, 0.13, 0.072);
        vec3 lite = blue ? vec3(0.17, 0.33, 0.62) : vec3(0.19, 0.46, 0.27);
        vec3 wht = vec3(0.72, 0.68, 0.58);
        float y = blue ? vLoc.y + 0.095 : vLoc.y;
        float top = blue ? 0.080 : 0.090;
        float inBand = 1.0 - smoothstep(top - 0.003, top + 0.003, y);
        float line = 1.0 - smoothstep(0.006, 0.0095, abs(y - top - 0.01));
        float down = smoothstep(0.45, 0.8, -wn.y);
        vec3 pc = mix(deep, lite, smoothstep(0.3, 0.95, clamp(y / top, 0.0, 1.0)));
        pc = mix(pc, wht, line);
        pc = mix(pc, deep, down);
        float wear = smoothstep(0.62, 0.92, n_fbm3(vWPos * 3.3 + 2.0, 3) * 0.5 + 0.5);
        pc = mix(pc, diffuseColor.rgb * 0.7, wear * 0.4);
        g_paint = max(max(inBand, line), down);
        diffuseColor.rgb = mix(diffuseColor.rgb, pc, g_paint);
      }`,
    fragRough: 'roughnessFactor = mix(roughnessFactor, 0.8, g_paint);',
  };
}

// 2D ornament pattern: gold flower medallions with scrolling tendrils.
export const ORN_GLSL = /* glsl */ `
vec2 orn_uv(vec3 wp, vec3 wn){
  vec3 a = abs(wn);
  if (a.y > a.x && a.y > a.z) return wp.xz;
  if (a.x > a.z) return vec2(wp.z, wp.y);
  return vec2(wp.x, wp.y);
}
// karakusa: continuous wavy vines with spiral scrolls at every bend, leaves,
// and 5-petal flower medallions at the cell corners. ~40% coverage.
float orn_pattern(vec2 q, float P){
  vec2 s = q / P;
  vec2 c = floor(s); vec2 f = fract(s) - 0.5;
  float row = mod(c.y, 2.0);
  float m = 0.0;
  // vine (continuous across cells)
  float vy = 0.17 * sin(6.28318 * s.x + row * 3.14159);
  m = max(m, 1.0 - smoothstep(0.03, 0.045, abs(f.y - vy)));
  for (int k = 0; k < 2; k++) {
    float sx = (k == 0) ? -0.25 : 0.25;
    float sgn = ((k == 0) ? 1.0 : -1.0) * (row > 0.5 ? -1.0 : 1.0);
    // scroll curling inside the bend of the vine
    vec2 cc = vec2(sx + 0.03 * sgn, sgn * 0.02);
    vec2 d = f - cc;
    float r = length(d);
    float a = atan(d.y * sgn, d.x * sgn);
    float rs = 0.028 + 0.115 * (a + 3.14159) / 6.28318;
    float sp = abs(r - rs);
    m = max(m, (1.0 - smoothstep(0.022, 0.036, sp)) * step(r, 0.155));
    // curl tip bead
    m = max(m, 1.0 - smoothstep(0.03, 0.042, r));
    // leaf on the outside of the bend
    vec2 lp = f - vec2(sx - 0.1 * sgn, sgn * 0.3);
    vec2 lr = vec2(lp.x * 0.8 + lp.y * 0.6 * sgn, -lp.x * 0.6 * sgn + lp.y * 0.8);
    m = max(m, 1.0 - smoothstep(0.0, 0.012, length(lr * vec2(1.0, 2.3)) - 0.095));
  }
  // flower medallions at cell corners
  vec2 fc = f - sign(f) * 0.5;
  float rc = length(fc); float ac = atan(fc.y, fc.x);
  float pet = rc - (0.125 + 0.05 * cos(5.0 * ac));
  float flower = 1.0 - smoothstep(-0.01, 0.01, pet);
  float hole = 1.0 - smoothstep(0.022, 0.03, abs(rc - 0.04));
  m = max(m, max(flower - hole, 0.0));
  return clamp(m, 0.0, 1.0);
}
`;

export function ornHooks(goldCol = 'vec3(1.0, 0.72, 0.31)', period = '0.36', coverage = '1.0') {
  return {
    fragHead: ORN_GLSL + '\nfloat g_orn;',
    fragColor: /* glsl */ `
      {
        vec3 wn = normalize(vWNrm);
        vec2 q = orn_uv(vWPos, wn);
        float m = orn_pattern(q + vec2(0.11, 0.07), ${period}) * ${coverage};
        // keep a clean frame near member edges: fade by a coarse mask
        g_orn = m;
        vec3 gold = ${goldCol} * (0.78 + 0.12 * n_snoise3(vWPos * 6.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, gold, m);
      }`,
    fragRough: 'roughnessFactor = mix(roughnessFactor, 0.46, g_orn);',
    fragMetal: 'metalnessFactor = mix(metalnessFactor, 1.0, g_orn);',
    fragNormal: 'normal = n_bumpView(-vViewPosition, normal, g_orn, 0.0035);',
  };
}
