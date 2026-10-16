// ---------------------------------------------------------------------------
// Backdrop forest: thousands of instanced card trees (cryptomeria / hinoki
// conifers and rounded broadleaf crowns) on the hills outside the corridors.
// Leaf cards use a procedural canvas atlas, bent (crown-radial) normals,
// per-tree sun exposure (neighbours toward the low sun shade the lower crown),
// translucency toward the sun and alpha-coverage sharpening for distance.
// ---------------------------------------------------------------------------
import { leafAtlas } from './terrain-tex.js';
import { smoothstep, clamp, lerp } from './terrain-field.js';
import { CANOPY } from './terrain-land.js';

// ---- template geometry helpers --------------------------------------------
class Tpl {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  vert(p, n, uv, c) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); this.c.push(c[0], c[1], c[2], c[3]); return this.p.length / 3 - 1; }
  quad(v0, v1, v2, v3) { this.i.push(v0, v1, v2, v0, v2, v3); }
  geometry(THREE) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCard', new THREE.Float32BufferAttribute(this.c, 4));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// card: centre-anchored (broadleaf) or base-anchored (sugi spray) quad
function card(T, base, axisU, axisV, w, h, rect, bendTo, bend, cvals, baseAnchored) {
  const [u0, v0, u1, v1] = rect;
  const corners = baseAnchored
    ? [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]
    : [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const pn = norm(cross(axisU, axisV));
  const ids = corners.map(([a, b]) => {
    const p = add(add(base, axisU, a * w), axisV, b * h);
    const rad = norm(bendTo(p));
    const pnOut = rad[0] * pn[0] + rad[1] * pn[1] + rad[2] * pn[2] < 0 ? [-pn[0], -pn[1], -pn[2]] : pn;
    const n = norm(mixv(pnOut, rad, bend));
    return T.vert(p, n, [lerp(u0, u1, a + 0.5), lerp(v0, v1, baseAnchored ? b : b + 0.5)], cvals);
  });
  T.quad(ids[0], ids[1], ids[2], ids[3]);
}

function trunk(T, y0, y1, r0, r1, seg, lean = [0, 0], uvc = [0.25, 0.75], rings = 1) {
  const base = T.p.length / 3;
  for (let k = 0; k <= rings; k++) {
    const t = k / rings, y = lerp(y0, y1, t), r = lerp(r0, r1, t);
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const p = [Math.cos(a) * r + lean[0] * t, y, Math.sin(a) * r + lean[1] * t];
      T.vert(p, [Math.cos(a), 0.15, Math.sin(a)], uvc, [0.5, -0.2 + t * 0.4, 0, 1]);
    }
  }
  for (let k = 0; k < rings; k++) for (let s = 0; s < seg; s++) {
    const a = base + k * seg + s, b = base + k * seg + ((s + 1) % seg);
    T.quad(a, b, b + seg, a + seg);
  }
}

function basisAround(n, roll) {
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = norm(cross(ref, n));
  let v = cross(n, u);
  const c = Math.cos(roll), s = Math.sin(roll);
  return [add([u[0] * c, u[1] * c, u[2] * c], v, s), add([v[0] * c, v[1] * c, v[2] * c], u, -s)];
}

// rounded broadleaf crown (oak / zelkova / camphor) — also used (squat, no trunk) for understory shrubs
function broadleafTpl(ctx, atlas, seed, lod, shrub = false) {
  const r = ctx.rng('bltpl' + seed + lod + (shrub ? 's' : ''));
  const T = new Tpl();
  const cell = atlas.cell(seed % 2);
  const cy = shrub ? 0.52 : 0.6, rx = shrub ? 0.5 : 0.31, ry = shrub ? 0.46 : 0.30;
  const crownBot = cy - ry, crownTop = cy + ry;
  if (!shrub) trunk(T, 0, cy, 0.016, 0.008, lod ? 3 : 5, [r.range(-0.02, 0.02), r.range(-0.02, 0.02)]);
  const nl = lod ? 4 : shrub ? 4 : 7;
  const lumps = [];
  for (let i = 0; i < nl; i++) {
    const a = (i / nl) * Math.PI * 2 + r.range(-0.4, 0.4);
    const up = i === 0 ? 0.5 : r.range(-0.45, 0.4);
    const d = i === 0 ? 0.05 : r.range(0.42, 0.6);
    lumps.push({ c: [Math.cos(a) * rx * d, cy + up * ry, Math.sin(a) * rx * d], R: (i === 0 ? 0.2 : r.range(0.14, 0.19)) * (lod ? 1.2 : 1) * (shrub ? 1.5 : 1) });
  }
  if (!lod && !shrub) {
    for (const L of lumps.slice(1, 4)) {
      const b = T.p.length / 3;
      const p0 = [0, cy - 0.14, 0], p1 = [L.c[0] * 0.8, L.c[1] - 0.02, L.c[2] * 0.8];
      for (const [p, rr] of [[p0, 0.007], [p1, 0.003]]) for (let s = 0; s < 3; s++) {
        const a = s / 3 * Math.PI * 2;
        T.vert([p[0] + Math.cos(a) * rr, p[1], p[2] + Math.sin(a) * rr], [Math.cos(a), 0, Math.sin(a)], [0.25, 0.75], [0.4, 0.3, 0, 1]);
      }
      for (let s = 0; s < 3; s++) { const s2 = (s + 1) % 3; T.quad(b + s, b + s2, b + 3 + s2, b + 3 + s); }
    }
  }
  const cc = [0, cy - ry * 0.25, 0];
  const bendTo = (p) => [p[0] - cc[0], (p[1] - cc[1]) * 1.1 + 0.05, p[2] - cc[2]];
  for (const L of lumps) {
    const nc = lod ? 5 : shrub ? 6 : 9;
    for (let k = 0; k < nc; k++) {
      // stratified directions over the lump, biased to the upper/outer side
      const ph = (k + r.range(0.1, 0.9)) / nc * Math.PI * 2;
      const el = r.range(-0.35, 1.0);
      const out = norm([L.c[0], 0, L.c[2]]);
      let d = norm(add([Math.cos(ph) * (1 - Math.abs(el) * 0.6), el, Math.sin(ph) * (1 - Math.abs(el) * 0.6)], out, 0.5));
      const p = add(L.c, d, L.R * r.range(0.55, 0.9));
      const pn = norm(add(d, norm([r.range(-1, 1), r.range(-1, 1), r.range(-1, 1)]), 0.7));
      const [u, v] = basisAround(pn, r.range(0, Math.PI * 2));
      const s = L.R * r.range(1.05, 1.4) * (lod ? 1.15 : 1);
      const outer = clamp(Math.hypot(p[0] / rx, (p[1] - cy) / ry, p[2] / rx), 0, 1);
      const relH = clamp((p[1] - crownBot) / (crownTop - crownBot), 0, 1);
      card(T, p, u, v, s, s, cell, bendTo, 0.8, [outer, relH, r.next(), 0], false);
    }
  }
  for (let k = 0; k < (lod ? 1 : 2); k++) {
    const pn = norm([r.range(-1, 1), r.range(-0.3, 0.3), r.range(-1, 1)]);
    const [u, v] = basisAround(pn, r.range(0, 6.28));
    card(T, [0, cy, 0], u, v, rx * 1.4, ry * 1.5, cell, bendTo, 0.9, [0.1, 0.45, r.next(), 0], false);
  }
  return T;
}

// cryptomeria / hinoki: dense tiers of foliage sprays on a tall straight stem
function sugiTpl(ctx, atlas, seed, lod) {
  const r = ctx.rng('sgtpl' + seed + lod);
  const T = new Tpl();
  const cell = atlas.cell(2 + (seed % 2));
  const y0 = r.range(0.14, 0.24);
  trunk(T, 0, 0.9, 0.012, 0.0015, lod ? 3 : 5);
  const tiers = lod ? 8 : 13;
  const Rmax = 0.155;
  const bendTo = (p) => [p[0], 0.45 * Math.hypot(p[0], p[2]) + 0.02, p[2]];
  for (let k = 0; k < tiers; k++) {
    const t = (k + r.range(0.2, 0.8)) / tiers;
    const y = lerp(y0, 0.97, t);
    const Rk = Rmax * Math.pow(1 - t, 0.8) * r.range(0.82, 1.18) * (1 - 0.25 * Math.pow(1 - t, 6)) + 0.014;
    const m = lod ? (t < 0.6 ? 5 : 4) : Math.max(3, Math.round(3 + Rk * 34));
    const a0 = r.range(0, 6.28);
    for (let j = 0; j < m; j++) {
      const a = a0 + (j / m) * Math.PI * 2 + r.range(-0.35, 0.35);
      const dir = norm([Math.cos(a), r.range(-0.4, 0.2), Math.sin(a)]);
      const base = [Math.cos(a) * Rk * 0.1, y + r.range(-0.02, 0.02), Math.sin(a) * Rk * 0.1];
      const tang = [-Math.sin(a), 0, Math.cos(a)];
      // spray plane between vertical and lying flat; the far LOD keeps them steep so the cone still
      // reads in side view (flat sprays vanish edge-on and leave 'lollipop' silhouettes)
      const flat = r.range(0.0, lod ? 0.4 : 0.8);
      const upish = norm(cross(tang, dir));
      const U = norm(mixv(upish, tang, flat));
      const len = Rk * r.range(1.25, 1.6) * (lod ? 1.25 : 1);
      const outer = 0.5 + 0.5 * r.next();
      card(T, base, U, dir, len * r.range(0.85, 1.05), len, cell, bendTo, 0.72, [outer, t, r.next(), 0], true);
    }
  }
  for (let j = 0; j < (lod ? 2 : 3); j++) {
    const a = r.range(0, 6.28);
    const U = [Math.cos(a), 0, Math.sin(a)];
    card(T, [0, 0.85, 0], U, norm([Math.cos(a + 1.6) * 0.12, 1, Math.sin(a + 1.6) * 0.12]), 0.075, 0.16, cell, bendTo, 0.6, [1, 1, r.next(), 0], true);
  }
  return T;
}

// ---- material ---------------------------------------------------------------
function forestMaterial(ctx, atlas) {
  const { THREE } = ctx;
  const hooks = {
    uniforms: { tLeaf: { value: atlas.tex }, uAtlasSize: { value: atlas.size } },
    vertexHead: /* glsl */ `
      attribute vec4 aCard; attribute vec4 aTree;
      varying vec2 vLUv; varying vec4 vCard; varying vec4 vTree;
    `,
    vertexWorld: /* glsl */ `
      vLUv = uv; vCard = aCard; vTree = aTree;
      {
        float flex = aCard.y * aCard.y * (1.0 - aCard.w) * aTree.w;
        wPos4.xyz += windOffset(wPos4.xyz, flex) * 0.8;
      }
    `,
    fragHead: /* glsl */ `
      uniform sampler2D tLeaf; uniform float uAtlasSize;
      varying vec2 vLUv; varying vec4 vCard; varying vec4 vTree;
      float f_dir; float f_bright; float f_ao;
    `,
    fragColor: /* glsl */ `
    {
      vec4 tx = texture2D(tLeaf, vLUv);
      vec2 ddx = dFdx(vLUv) * uAtlasSize, ddy = dFdy(vLUv) * uAtlasSize;
      float lod = 0.5 * log2(max(max(dot(ddx, ddx), dot(ddy, ddy)), 1.0));
      float cov = tx.g;
      float a = cov * (1.0 + 0.30 * lod);
      float bright = clamp(tx.r / max(cov, 0.04), 0.0, 1.0);
      float outer = clamp(tx.b / max(cov, 0.04), 0.0, 1.0);
      vec3 tint = vColor.rgb;
      vec3 c = tint * (0.35 + 0.95 * bright);
      c = mix(c * vec3(0.86, 0.94, 1.05), c * vec3(1.12, 1.07, 0.80), clamp(outer * 0.5 + vCard.y * 0.4, 0.0, 1.0));
      f_ao = mix(0.30, 1.0, vCard.x) * mix(0.45, 1.0, smoothstep(0.0, 0.85, vCard.y));
      if (vCard.w > 0.5) {
        float bn = n_snoise3(vWPos * vec3(9.0, 0.6, 9.0)) * 0.5 + 0.5;
        c = mix(vec3(0.055, 0.032, 0.022), vec3(0.11, 0.06, 0.035), bn);
        a = 1.0; f_ao = 0.6;
      }
      diffuseColor.rgb = c * f_ao;
      diffuseColor.a = a;
      // direct sun reaches the upper crown; neighbours toward the low sun shade the rest
      float topLit = smoothstep(0.42, 0.98, vCard.y + 0.18 * vCard.x - 0.1);
      f_dir = mix(topLit, 1.0, vTree.x);
      // leaves inside each spray / cluster are shaded by the outer ones
      f_dir *= mix(0.3, 1.0, smoothstep(0.15, 0.85, outer)) * mix(0.55, 1.0, bright);
      diffuseColor.rgb *= mix(0.6, 1.0, outer);
      f_bright = bright;
    }
    `,
    fragNormal: /* glsl */ `
      normal = normalize(vNormal);
      normal = n_bumpView(-vViewPosition, normal, f_bright * 0.03, 1.0);
    `,
    fragLight: /* glsl */ `
      reflectedLight.directDiffuse *= f_dir;
      reflectedLight.directSpecular *= f_dir * 0.5;
      reflectedLight.indirectDiffuse *= mix(0.55, 1.0, vCard.x);
      {
        float vl = clamp(dot(-geometryViewDir, directLight.direction), 0.0, 1.0);
        vec3 trans = vColor.rgb * vec3(1.5, 1.7, 0.55);
        // only the thin outer foliage glows against the light; crown interiors stay dark
        reflectedLight.directDiffuse += directLight.color * f_dir * (pow(vl, 6.0) * 1.25 * mix(0.3, 1.0, smoothstep(0.35, 0.95, vCard.x)) + 0.1) * trans * (0.3 + f_bright) * (1.0 - vCard.w);
      }
    `,
  };
  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 }, hooks);
  mat.name = 'forestCards';
  // NOTE: ctx.mat.depthMaterialFor() fails to compile (objectNormal undeclared in the depth shader),
  // so the shadow caster uses a plain alpha-tested depth material (wind sway is only a few cm).
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: atlas.tex, alphaTest: 0.5 });
  return { mat, depth };
}

// ---- placement ----------------------------------------------------------------
export function buildForest(ctx, F) {
  const { THREE } = ctx;
  const atlas = leafAtlas(ctx);
  const { mat, depth } = forestMaterial(ctx, atlas);
  const R = ctx.rng('terrain-forest');
  const { C } = F;
  const SUNX = -0.9404, SUNZ = 0.3401;

  const trees = [];
  function tryTree(x, z, kind) {
    const d = F.sdRect(x, z);
    if (d < (kind === 'shrub' ? 7 : 8.5)) return;
    // the corridor (outer wall at d ~2.3, eaves ~3.3) must stay readable from the aerial cameras:
    // crowns keep >= 3.5 m clear of it and the forest rises gradually away from it
    const crownRoom = d - 3.8;
    const edgeH = kind === 'shrub' ? 1.6 + 0.55 * (d - 7) : 5.0 + 1.05 * (d - 8.5);
    const r = Math.hypot(x - C[0], z - C[1]);
    if (r > CANOPY.full - 40) return;
    let fd = F.forestDensity(x, z);
    if (kind === 'mid') {
      // never-filmed south-east sector: thinner (the canopy surface still covers it)
      const az = ((Math.atan2(-(z - C[1]), x - C[0]) * 180 / Math.PI) + 360) % 360;
      if (az > 248 && az < 335) fd *= 0.45;
    }
    // small canopy gaps (windthrow, rock, wet hollows) so the forest is not an even carpet
    if (kind !== 'shrub') fd *= 0.55 + 0.45 * smoothstep(-0.5, 0.05, F.noise.f3(x / 26 + 9.3, z / 26 - 4.1, 2));
    if (R.next() > fd * 0.98) return;
    const ground = F.landHeight(x, z);
    const cap = F.treeTopCap(x, z) - ground;
    if (cap < 2.6) return;
    if (kind === 'shrub') {
      const wf = R.range(0.9, 1.4);
      const H = Math.min(R.range(2.5, 6.5), cap, edgeH, crownRoom / (0.6 * wf));
      if (H < 1.2) return;
      trees.push({ x, z, y: ground - 0.1, H, wf, conifer: false, kind, rot: R.range(0, 6.283), v: R.int(0, 1), rnd: R.next(), exp: 1 });
      return;
    }
    // groves: cryptomeria / hinoki stands and broadleaf groves of a few dozen metres, mixed edges
    const grove = F.noise.f2(x / 34 + 5.1, z / 34 - 2.7, 2);
    const coniferP = clamp(0.42 + 0.45 * F.noise.f3(x / 110, z / 110, 3) + 0.9 * grove + (ground > 25 ? 0.12 : 0), 0.04, 0.94);
    const conifer = R.next() < coniferP;
    let H = conifer ? R.range(19, 31) : R.range(10, 20);
    if (R.chance(0.07)) H *= conifer ? 1.2 : 1.3; // emergents
    H *= lerp(0.8, 1, smoothstep(6, 40, d));
    if (H > cap) H = cap * R.range(0.9, 1.0);
    let wf = conifer ? R.range(0.9, 1.2) : R.range(0.95, 1.4);
    // where the sun / view caps keep the canopy low it becomes a dense coppice of wide, bushy
    // crowns instead of a thin park of stunted trees over bare floor
    if (!conifer) wf *= lerp(1.45, 1.0, smoothstep(5, 12, cap));
    const cr = (conifer ? 0.26 : 0.40) * (kind === 'mid' ? 1.12 : 1); // card reach / (H * wf)
    H = Math.min(H, edgeH, crownRoom / (cr * wf));
    if (H < 2.6) return;
    // species within the grove: broadleaf 0 zelkova, 1 evergreen oak / shii, 2 camphor, 3 maple, 4 turning;
    // conifer 0 sugi, 1 hinoki, 2 red pine
    const sv = F.noise.f4(x / 46 - 3.3, z / 46 + 8.1, 2) + R.range(-0.35, 0.35);
    let sp;
    if (conifer) sp = sv < -0.25 ? 2 : sv < 0.12 ? 0 : 1;
    else sp = R.chance(0.035) ? 4 : sv < -0.3 ? 1 : sv < 0.0 ? 0 : sv < 0.25 ? 3 : 2;
    trees.push({ x, z, y: ground - 0.15, H, wf, conifer, sp, kind, rot: R.range(0, Math.PI * 2), v: R.int(0, 1), rnd: R.next(), exp: 1, gb: F.noise.f1(x / 26, z / 26, 2) });
  }
  // near ring: dense jittered grid
  const S1 = 5.0, NEAR = 105;
  for (let x = F.R.minX - NEAR; x <= F.R.maxX + NEAR; x += S1) {
    for (let z = F.R.minZ - NEAR; z <= F.R.maxZ + NEAR; z += S1) {
      const px = x + R.range(-0.45, 0.45) * S1, pz = z + R.range(-0.45, 0.45) * S1;
      if (F.sdRect(px, pz) > NEAR) continue;
      tryTree(px, pz, 'near');
    }
  }
  // understory / forest-edge shrubs
  const S0 = 4.2;
  for (let x = F.R.minX - 65; x <= F.R.maxX + 65; x += S0) {
    for (let z = F.R.minZ - 65; z <= F.R.maxZ + 65; z += S0) {
      const px = x + R.range(-0.45, 0.45) * S0, pz = z + R.range(-0.45, 0.45) * S0;
      const d = F.sdRect(px, pz);
      if (d > 60 || d < 7) continue;
      const open = F.sunUpwind(px, pz) < 400 ? 1 : 0;
      if (R.next() > lerp(0.95, open ? 0.7 : 0.25, smoothstep(10, 40, d))) continue;
      tryTree(px, pz, 'shrub');
    }
  }
  // low evergreen belt (azalea / sasa / pieris clumps) along the outside of the corridor, just
  // beyond the gravel walk: gives the ground round the cloister texture and relief from the air
  {
    const S3 = 1.7, gx = F.L.gate.center[0];
    for (let x = F.R.minX - 11; x <= F.R.maxX + 11; x += S3) {
      for (let z = F.R.minZ - 11; z <= F.R.maxZ + 11; z += S3) {
        const px = x + R.range(-0.45, 0.45) * S3, pz = z + R.range(-0.45, 0.45) * S3;
        const d = F.sdRect(px, pz);
        if (d < 6.3 || d > 10.5) continue;
        if (Math.abs(px - gx) < 11 && pz > F.R.maxZ) continue; // gate forecourt stays open
        const p = 0.62 * smoothstep(-0.4, 0.2, F.noise.f2(px * 0.07 + 2.3, pz * 0.07 - 1.1, 2));
        if (R.next() > p) continue;
        const H = R.range(0.55, 1.35) * (0.65 + 0.35 * smoothstep(6.3, 9.5, d));
        trees.push({ x: px, z: pz, y: F.heightAt(px, pz) - 0.06, H, wf: R.range(1.15, 1.7), conifer: false, kind: 'shrub', belt: true, rot: R.range(0, 6.283), v: 0, rnd: R.next(), exp: 1 });
      }
    }
  }
  // mid ring
  const S2 = 10.5, RM = CANOPY.full - 40;
  for (let x = C[0] - RM; x <= C[0] + RM; x += S2) {
    for (let z = C[1] - RM; z <= C[1] + RM; z += S2) {
      const px = x + R.range(-0.45, 0.45) * S2, pz = z + R.range(-0.45, 0.45) * S2;
      if (F.sdRect(px, pz) <= NEAR) continue;
      tryTree(px, pz, 'mid');
    }
  }

  // ---- sun exposure: neighbours toward the sun that are taller shade the crown ----
  const cellSz = 16;
  const hash = new Map();
  const key = (i, j) => i * 100003 + j;
  trees.forEach((t, k) => { const kk = key(Math.floor(t.x / cellSz), Math.floor(t.z / cellSz)); if (!hash.has(kk)) hash.set(kk, []); hash.get(kk).push(k); });
  const TAN = Math.tan(6.8 * Math.PI / 180);
  for (const t of trees) {
    const ci = Math.floor(t.x / cellSz), cj = Math.floor(t.z / cellSz);
    const mid = t.y + t.H * 0.62;
    const myR = (t.conifer ? 0.17 : 0.3) * t.H * t.wf;
    let block = 0;
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
      const lst = hash.get(key(ci + di, cj + dj));
      if (!lst) continue;
      for (const k of lst) {
        const o = trees[k];
        if (o === t) continue;
        const dx = o.x - t.x, dz = o.z - t.z;
        const along = dx * SUNX + dz * SUNZ;
        if (along <= 0.5) continue;
        const perp = Math.abs(dx * SUNZ - dz * SUNX);
        const oR = (o.conifer ? 0.17 : 0.3) * o.H * o.wf;
        if (perp > (myR + oR) * 0.85) continue;
        const top = o.y + o.H;
        const b = clamp((top - (mid + along * TAN)) / (t.H * 0.45), 0, 1);
        if (b > block) block = b;
      }
    }
    // terrain toward the sun (hill shading)
    const gx = t.x + SUNX * 60, gz = t.z + SUNZ * 60;
    const gh = F.landHeight(gx, gz);
    const tb = clamp((gh - (mid + 60 * TAN)) / (t.H * 0.5), 0, 1);
    t.exp = 1 - Math.max(block, tb);
  }

  // ---- templates ----
  const tpls = {
    bn: [broadleafTpl(ctx, atlas, 0, 0).geometry(THREE), broadleafTpl(ctx, atlas, 1, 0).geometry(THREE)],
    cn: [sugiTpl(ctx, atlas, 0, 0).geometry(THREE), sugiTpl(ctx, atlas, 1, 0).geometry(THREE)],
    bm: [broadleafTpl(ctx, atlas, 2, 1).geometry(THREE)],
    cm: [sugiTpl(ctx, atlas, 3, 1).geometry(THREE)],
    sh: [broadleafTpl(ctx, atlas, 1, 0, true).geometry(THREE)],
  };
  const buckets = new Map();
  for (const t of trees) {
    const k = t.kind === 'shrub' ? 'sh0' : (t.conifer ? 'c' : 'b') + (t.kind === 'mid' ? 'm0' : 'n' + t.v);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(t);
  }
  const group = new THREE.Group();
  group.name = 'forest';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let tris = 0;
  for (const [k, list] of buckets) {
    const geo = tpls[k.slice(0, 2)][+k[2]];
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const aTree = new Float32Array(list.length * 4);
    list.forEach((t, i) => {
      const wsc = t.H * t.wf * (t.kind === 'mid' ? 1.12 : 1);
      p.set(t.x, t.y, t.z);
      e.set(R.range(-0.03, 0.03), t.rot, R.range(-0.03, 0.03));
      q.setFromEuler(e);
      s.set(wsc * (R.chance(0.5) ? -1 : 1), t.H, wsc);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
      const h = R.next();
      if (t.conifer) {
        const P = [[0.020, 0.040, 0.030, 0.026, 0.047, 0.028], [0.026, 0.050, 0.030, 0.034, 0.060, 0.030], [0.040, 0.054, 0.026, 0.050, 0.062, 0.028]][t.sp || 0];
        col.setRGB(lerp(P[0], P[3], h), lerp(P[1], P[4], h), lerp(P[2], P[5], h));
      } else if (t.belt) {
        // clipped azalea (green), enkianthus / dodan-tsutsuji turning scarlet, a few amber
        const k = F.noise.f1(t.x * 0.09 + 4.0, t.z * 0.09, 2) + (h - 0.5) * 0.6;
        if (k > 0.22) col.setRGB(lerp(0.30, 0.42, h), lerp(0.035, 0.06, h), 0.018);
        else if (k > 0.12) col.setRGB(lerp(0.32, 0.40, h), lerp(0.12, 0.17, h), 0.02);
        else col.setRGB(lerp(0.034, 0.055, h), lerp(0.060, 0.085, h), 0.018);
      } else if (t.kind === 'shrub') {
        col.setRGB(lerp(0.030, 0.050, h), lerp(0.050, 0.068, h), 0.016);
      } else {
        const P = [[0.052, 0.088, 0.024, 0.070, 0.100, 0.028], [0.026, 0.050, 0.018, 0.036, 0.062, 0.022],
          [0.070, 0.094, 0.026, 0.088, 0.108, 0.034], [0.056, 0.096, 0.026, 0.074, 0.112, 0.030],
          [0.120, 0.070, 0.022, 0.150, 0.050, 0.018]][t.sp || 0];
        col.setRGB(lerp(P[0], P[3], h), lerp(P[1], P[4], h), lerp(P[2], P[5], h));
      }
      col.multiplyScalar(R.range(0.78, 1.22) * (1 + 0.22 * (t.gb || 0)));
      if (!t.conifer && !t.belt) { const hs = R.range(-1, 1); col.r *= 1 + 0.12 * hs; col.b *= 1 - 0.1 * hs; }
      im.setColorAt(i, col);
      aTree[i * 4] = t.exp; aTree[i * 4 + 1] = t.rnd; aTree[i * 4 + 2] = t.conifer ? 1 : 0; aTree[i * 4 + 3] = clamp(t.H / 22, 0.3, 1.5);
    });
    geo.setAttribute('aTree', new THREE.InstancedBufferAttribute(aTree, 4));
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = k[1] !== 'm';
    im.receiveShadow = true;
    im.customDepthMaterial = depth;
    im.name = 'forest_' + k;
    im.frustumCulled = true;
    group.add(im);
    tris += (geo.index.count / 3) * list.length;
  }
  group.userData.stats = { trees: trees.length, tris: Math.round(tris), meshes: buckets.size };
  return group;
}
