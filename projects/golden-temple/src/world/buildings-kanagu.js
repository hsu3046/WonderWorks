// ---------------------------------------------------------------------------
// buildings-kanagu.js — hero kazari-kanagu (ornamental gilt-bronze pillar
// sleeves) for the south gate: beaded rolls, engraved border strips, two tiers
// of lobed spear lappets (kenbishi) with domed rivets, and a chased karakusa
// (arabesque vine + spiral tendrils + leaves) field on a punched nanako ground.
// Geometry carries uv in METRES: u = arc length on the field radius, v = height
// from the band centre + PART * partId, so the shader knows which piece it
// shades and has a metric frame for analytic relief normals + sun self-shadow.
//   parts: 0 field (eye band) 6 field (base band) 1 beaded roll 2 border strip
//          3 lappet lower tier 4 lappet upper tier 5 rivet
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const PART = 10;
const ROLL_R = 0.013, ROLL_C = 0.007;     // roll radius + centre offset from the column
const BORDER = 0.0095, FIELD = 0.0075;    // border strip / field offsets from the column
const Y_ROLL = 0.026, Y_FIELD = 0.036;    // roll top, field start (from each band end)

// the lappet outline: half width (m) at fraction t (0 base .. 1 tip). Shared with the shader.
export const lapEnv = (t) => Math.max(0, Math.pow(1 - t, 0.8) * (0.74 + 0.26 * Math.cos(t * Math.PI * 4)));

// band design per type
export const KANAGU = {
  eye: { H: 0.40, nLap: 12, L: 0.118, w: 0.042, part: 0 },
  base: { H: 0.52, nLap: 12, L: 0.16, w: 0.048, part: 6 },
};

function lapGeom(w, L, depth, steps, uvPart) {
  const pts = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push(new THREE.Vector2(w * lapEnv(t), t * L)); }
  const left = pts.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y));
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), ...pts.slice(0, -1), new THREE.Vector2(0, L), ...left]);
  const bev = Math.min(0.0011, depth * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, depth - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, bev); // back face at z = 0
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  const uv = ng.attributes.uv; const p = ng.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i) + uvPart * PART);
  return ng;
}

// bend a local plate (x across = arc, y along = height, z = outward) onto the cylinder
function bendOnto(g, rBase, theta, yBase, flip) {
  const out = g.clone();
  const p = out.attributes.position, n = out.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i); const z = p.getZ(i);
    let nx = n.getX(i), ny = n.getY(i); const nz = n.getZ(i);
    if (flip) { x = -x; y = -y; nx = -nx; ny = -ny; }   // 180 deg in-plane rotation keeps the winding
    const rr = rBase + z;
    const th = theta + x / rBase;
    const s = Math.sin(th), c = Math.cos(th);
    p.setXYZ(i, rr * s, yBase + y, rr * c);
    // local x -> tangent (c, 0, -s), y -> up, z -> radial (s, 0, c)
    n.setXYZ(i, nx * c + nz * s, ny, -nx * s + nz * c);
  }
  return out;
}

// lathe strip with custom uv. prof: [[dr, y], ...] (smooth normals inside the strip)
function strip(r, prof, seg, rField, H, part, vLocal = false) {
  const nP = prof.length;
  const pos = [], nrm = [], uv = [], idx = [];
  const nr = prof.map((_, j) => {
    const a = prof[Math.max(j - 1, 0)], b = prof[Math.min(j + 1, nP - 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1;
    return [ty / l, -tx / l];
  });
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * TAU, s = Math.sin(th), c = Math.cos(th);
    for (let j = 0; j < nP; j++) {
      const [dr, y] = prof[j]; const rr = r + dr;
      pos.push(rr * s, y, rr * c);
      nrm.push(nr[j][0] * s, nr[j][1], nr[j][0] * c);
      uv.push(th * rField, (vLocal ? y - prof[0][1] : y - H / 2) + part * PART);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < nP - 1; j++) {
    const a = i * nP + j, b = (i + 1) * nP + j, c2 = (i + 1) * nP + j + 1, d = i * nP + j + 1;
    idx.push(a, b, c2, a, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g.toNonIndexed();
}

function rivetGeo(rad, h, seg) {
  const P = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; P.push(new THREE.Vector2(rad * Math.cos(a) * (i === 0 ? 1.12 : 1), h * Math.sin(a))); }
  P.unshift(new THREE.Vector2(rad * 1.12, -0.0006));
  const g = new THREE.LatheGeometry(P, seg).rotateX(Math.PI / 2); // axis +Z (outward)
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  const p = ng.attributes.position, uv = ng.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, Math.hypot(p.getX(i), p.getY(i)) / rad, 5 * PART + Math.max(p.getZ(i), 0) / h * 0.01);
  return ng;
}

const _cache = new Map();
// ornate sleeve of type 'eye' | 'base' on a column of radius r; origin at the band bottom
export function kanaguBand(r, type = 'eye', hero = true) {
  const key = `${r},${type},${hero}`;
  if (_cache.has(key)) return _cache.get(key);
  const D = KANAGU[type];
  const { H, nLap, L, w } = D;
  const seg = hero ? 192 : 96;
  const rField = r + FIELD;
  const parts = [];
  const half = (top) => {
    // roll (beads) + border strip, mirrored for the top end
    const m = (p) => (top ? [p[0], H - p[1]] : p);
    const roll = [];
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; roll.push([ROLL_C + ROLL_R * Math.cos(a), Y_ROLL / 2 + (Y_ROLL / 2) * Math.sin(a)]); }
    roll[0] = [0, 0];
    const border = [[BORDER - 0.0012, Y_ROLL], [BORDER, Y_ROLL + 0.0012], [BORDER, Y_FIELD - 0.0012], [BORDER - 0.0012, Y_FIELD], [FIELD, Y_FIELD + 0.0002]];
    let rp = roll.map(m), bp = border.map(m);
    if (top) { rp = rp.reverse(); bp = bp.reverse(); }
    parts.push(strip(r, rp, seg, rField, H, 1));
    parts.push(strip(r, bp, seg, rField, H, 2, true));
  };
  half(false); half(true);
  // field with a slight convex swell
  const fp = [];
  const nF = 9;
  for (let j = 0; j <= nF; j++) { const t = j / nF; fp.push([FIELD + 0.0016 * Math.sin(Math.PI * t), Y_FIELD + 0.0002 + t * (H - 2 * Y_FIELD - 0.0004)]); }
  parts.push(strip(r, fp, seg, rField, H, D.part));
  // lappets: two tiers, bottom row pointing up, top row pointing down (offset half a pitch)
  const steps = hero ? 18 : 8;
  const lo = lapGeom(w, L, 0.0026, steps, 3);
  const up = lapGeom(w * 0.7, L * 0.8, 0.0016, steps, 4).translate(0, L * 0.06, 0.0024);
  const lapAll = mergeGeometries([lo, up]);
  const riv = rivetGeo(0.0046, 0.0034, hero ? 12 : 6).translate(0, L * 0.3, 0.0038);
  const rimRiv = rivetGeo(0.0036, 0.0028, hero ? 10 : 6);
  for (let k = 0; k < nLap; k++) {
    for (const top of [false, true]) {
      const th = ((k + (top ? 0.5 : 0)) / nLap) * TAU;
      const yb = top ? H - Y_FIELD + 0.0004 : Y_FIELD - 0.0004;
      parts.push(bendOnto(lapAll, rField + 0.0012, th, yb, top));
      parts.push(bendOnto(riv, rField + 0.0012, th, yb, top));
      // rim rivets between the lappets on the border strip
      const thr = th + Math.PI / nLap;
      parts.push(bendOnto(rimRiv, r + BORDER, thr, top ? H - (Y_ROLL + Y_FIELD) / 2 : (Y_ROLL + Y_FIELD) / 2, top));
    }
  }
  const g = mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k); return p; }));
  g.computeBoundingSphere();
  _cache.set(key, g);
  return g;
}

// ---------------------------------------------------------------------------
// Material: gilt bronze, polished relief, matte nanako ground, tarnish and
// verdigris in the recesses, gilding rubbed through to bronze on the high spots.
// Relief normals are analytic (finite differences of the height field in metres)
// and fade out with the pixel footprint; the sun self-shadows the chased relief
// and the lappets cast contact shadows onto the field.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Karakusa relief, baked once into a mip-mapped RG16F tile (r = height in mm,
// g = relief mask): the shader then needs only a few filtered fetches, mips
// give free anti-aliasing and the program compiles fast.
// Tile = 1 cell wide x 2 rows (odd rows mirrored), nanako punch grid included.
// ---------------------------------------------------------------------------
const kProf = (d, w) => { const x = Math.min(Math.max(d / w, 0), 1); return 1 - x * x; };
function kSpiral(px, py, b, t0, t1) {
  const r = Math.hypot(px, py), a = Math.atan2(py, px);
  const k = Math.floor((r / b - a) / TAU);
  const th0 = Math.min(Math.max(a + TAU * k, t0), t1), th1 = Math.min(Math.max(a + TAU * (k + 1), t0), t1);
  const d0 = Math.hypot(px - b * th0 * Math.cos(th0), py - b * th0 * Math.sin(th0));
  const d1 = Math.hypot(px - b * th1 * Math.cos(th1), py - b * th1 * Math.sin(th1));
  return d0 < d1 ? [d0, (th0 - t0) / (t1 - t0)] : [d1, (th1 - t0) / (t1 - t0)];
}
function kSeg(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.min(Math.max((pax * bax + pay * bay) / (bax * bax + bay * bay), 0), 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}
function kLeaf(px, py, bx, by, dx, dy, len, wid, bend) {
  const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
  const qx = px - bx, qy = py - by;
  const s = qx * dx + qy * dy; let t = -qx * dy + qy * dx;
  const u = s / len;
  if (u <= 0 || u >= 1) return 0;
  t -= bend * len * Math.sin(Math.PI * u);
  const hw = wid * Math.pow(Math.sin(Math.PI * u), 0.7) * (1 - 0.3 * u) + 1e-4;
  const x = Math.abs(t) / hw;
  if (x >= 1) return 0;
  let h = 1 - x * x;
  h *= 1 - 0.5 * (1 - sstep(0, 0.14, x));
  const fr = u * 4.5 - x * 0.9; const sv = Math.abs(fr - Math.floor(fr) - 0.5);
  h *= 1 - 0.25 * (1 - sstep(0.03, 0.1, sv)) * sstep(0.15, 0.3, x);
  return h;
}
function sstep(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }
function kFlower(px, py, cx, cy, R) {
  const qx = px - cx, qy = py - cy, r = Math.hypot(qx, qy);
  if (r > R) return 0;
  const a = Math.atan2(qy, qx);
  const pc = Math.abs(Math.cos(4 * a));
  const rp = R * (0.58 + 0.42 * Math.pow(pc, 0.6));
  let pet = r < rp ? 1 - Math.pow(r / rp, 2) * 0.55 : 0;
  pet *= sstep(0, 0.025, rp - r);
  const split = 1 - 0.4 * (1 - sstep(0, 0.12, pc)) * (r > R * 0.3 ? 1 : 0);
  const boss = kProf(r, R * 0.26) * 1.1;
  const ring = 1 - sstep(0, R * 0.05, Math.abs(r - R * 0.3));
  return Math.max(pet * split * (1 - 0.45 * ring), boss);
}
// half motif in cell coordinates; the glide copy (x + 0.5, 1 - y) completes the cell
function kMotif(x, y) {
  const yv = 0.5 + 0.16 * Math.sin(TAU * x);
  const sl = 0.16 * TAU * Math.cos(TAU * x);
  let h = kProf(Math.abs(y - yv) / Math.sqrt(1 + sl * sl), 0.036) * 0.9;
  // big scroll wrapping a blossom (hosoge karakusa)
  if (y > 0.55 && x > 0.2 && x < 0.62) {
    const [sd, sf] = kSpiral(x - 0.42, y - 0.78, 0.0148, 1.7 * Math.PI, 3 * Math.PI);
    h = Math.max(h, kProf(sd, 0.022 + 0.012 * sf) * (0.85 + 0.15 * sf));
    h = Math.max(h, kFlower(x, y, 0.42, 0.78, 0.07));
  }
  h = Math.max(h, kProf(kSeg(x, y, 0.281, 0.78, 0.27, 0.66), 0.032) * 0.95);
  h = Math.max(h, kLeaf(x, y, 0.10, 0.585, 0.5, -0.866, 0.30, 0.085, 0.12));
  h = Math.max(h, kLeaf(x, y, 0.31, 0.655, -0.8, 0.6, 0.2, 0.055, -0.15));
  // small tendril curl springing from the opposite leaf tip
  if (y > 0.6 && x > 0.68) {
    const [cd, cf] = kSpiral(x - 0.84, y - 0.81, 0.00868, 1.3 * Math.PI, 3.3 * Math.PI);
    h = Math.max(h, kProf(cd, 0.014 + 0.012 * cf) * (0.8 + 0.2 * cf));
    h = Math.max(h, kProf(Math.hypot(x - (0.84 + 0.035 * Math.cos(1.3 * Math.PI)), y - (0.81 + 0.035 * Math.sin(1.3 * Math.PI))), 0.022));
  }
  h = Math.max(h, kProf(kSeg(x, y, 0.787, 0.737, 0.752, 0.672), 0.02) * 0.85);
  return h;
}
let _ktex = null;
export function karakusaTexture(Pu, Pv, W = 768, Hh = 1536) {
  if (_ktex) return _ktex;
  const data = new Uint16Array(W * Hh * 2);
  const nX = Math.round(Pu / 0.0013), nR = 2 * Math.round(Pv / 0.00113);   // nanako grid tiling the tile
  const toH = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < Hh; j++) {
    const y2 = ((j + 0.5) / Hh) * 2;
    const row = Math.floor(y2), y = y2 - row;
    for (let i = 0; i < W; i++) {
      let x = (i + 0.5) / W;
      if (row % 2) { x = 0.37 - x; x -= Math.floor(x); }
      let x2 = x + 0.5; x2 -= Math.floor(x2);
      const rel = Math.min(1.1, Math.max(kMotif(x, y), kMotif(x2, 1 - y)));
      // nanako: punched rings with raised rims on the ground
      const qy = ((j + 0.5) / Hh) * nR;
      const qx = ((i + 0.5) / W) * nX + 0.5 * (Math.floor(qy) % 2);
      const gx = qx - Math.floor(qx) - 0.5, gy = qy - Math.floor(qy) - 0.5, rr = Math.hypot(gx, gy * 0.87);
      const nan = (1 - sstep(0, 0.13, Math.abs(rr - 0.33))) * 0.6 - (1 - sstep(0.17, 0.3, rr));
      const hmm = 1.2 * rel + 0.05 * nan * (1 - sstep(0, 0.12, rel));
      const k = (j * W + i) * 2;
      data[k] = toH(hmm); data[k + 1] = toH(rel);
    }
  }
  const tex = new THREE.DataTexture(data, W, Hh, THREE.RGFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 8;
  tex.needsUpdate = true;
  _ktex = tex;
  return tex;
}

export function kanaguHooks(r) {
  const rField = r + FIELD;
  const C = TAU * rField;
  const Pu = C / Math.round(C / 0.08), Pv = 0.08;
  const Pb = C / Math.round(C / 0.0105);
  const f = (x) => x.toFixed(6);
  const lapConst = (D) => `vec4(${f(C / D.nLap)}, ${f(D.H / 2 - Y_FIELD + 0.0004)}, ${f(D.L)}, ${f(D.w)})`;
  const uniforms = { uKTex: { value: karakusaTexture(Pu, Pv) } };
  return {
    uniforms,
    fragHead: /* glsl */ `
      varying vec2 vKUv;
      uniform sampler2D uKTex;
      float g_kh; float g_krel; float g_kcav; float g_kpol; float g_kver; float g_kwear; float g_ksh; float g_kao;
      vec2 kk_uv; float kk_part; float kk_fw; bool kk_field;
      const float KK_PI = 3.14159265;
      float kk_prof(float d, float w){ float x = clamp(d / w, 0.0, 1.0); return 1.0 - x * x; }
      // lappet outline (matches lapEnv in JS)
      float kk_env(float t){ return max(0.0, pow(max(1.0 - t, 0.0), 0.8) * (0.74 + 0.26 * cos(t * KK_PI * 4.0))); }
      // distance-ish (m) to the nearest lappet outline (< 0 inside); lp = (pitch, base |v|, L, w)
      float kk_lapD1(vec2 m, vec4 lp, float off, float y){
        float x = (fract(m.x / lp.x - off + 0.5) - 0.5) * lp.x;
        float t = y / lp.z;
        if (t < 0.0) return -0.001;
        if (t > 1.0) return length(vec2(x, y - lp.z));
        return abs(x) - lp.w * kk_env(t);
      }
      float kk_lapD(vec2 m, vec4 lp){
        return min(kk_lapD1(m, lp, 0.0, m.y + lp.y), kk_lapD1(m, lp, 0.5, lp.y - m.y));
      }
      float kk_nanako(vec2 m, float fw){
        const float P = 0.0011;
        vec2 q = m / P; q.x += 0.5 * mod(floor(q.y), 2.0);
        vec2 g = fract(q) - 0.5; float r = length(g);
        float ring = 1.0 - smoothstep(0.0, 0.12, abs(r - 0.33));
        float pit = 1.0 - smoothstep(0.18, 0.3, r);
        return (ring * 0.6 - pit) * (1.0 - smoothstep(0.25, 0.6, fw / P));
      }
      // field relief height (m) + relief mask from the baked karakusa tile
      float kk_fieldH(vec2 m, out float rel){
        vec2 t = texture(uKTex, m * vec2(${f(1 / Pu)}, ${f(0.5 / Pv)})).rg;
        rel = t.y;
        return 0.001 * t.x;
      }
      // relief of the small parts (beads, engraved border, lappet tiers, rivets)
      float kk_partH(float part, vec2 m, float fw, out float rel){
        rel = 1.0;
        if (part < 1.5) {
          float x = (fract(m.x / ${f(Pb)}) - 0.5) * 2.0;
          rel = 1.0 - x * x;
          return 0.0011 * (rel - 0.66) * (1.0 - smoothstep(0.12, 0.3, fw / ${f(Pb)}));
        }
        if (part < 2.5) {
          float zz = 0.005 + 0.0016 * (abs(fract(m.x / 0.0042) - 0.5) * 4.0 - 1.0);
          float l1 = 1.0 - smoothstep(0.0002, 0.00045, abs(m.y - 0.0022));
          float l2 = 1.0 - smoothstep(0.0002, 0.00045, abs(m.y - 0.0078));
          float l3 = 1.0 - smoothstep(0.00018, 0.0004, abs(m.y - zz));
          rel = 1.0 - max(max(l1, l2), l3);
          return -0.00018 * (1.0 - rel) * (1.0 - smoothstep(0.0002, 0.0006, fw));
        }
        if (part < 3.5) { rel = 0.0; return 0.00005 * kk_nanako(m, fw); }
        if (part < 4.5) {
          float ax = abs(m.x);
          float mid = 1.0 - smoothstep(0.00025, 0.0006, ax);
          float side = 1.0 - smoothstep(0.0002, 0.0005, abs(fract((m.y - ax * 1.3) / 0.0085) - 0.5) * 0.0085);
          side *= smoothstep(0.0015, 0.003, ax);
          return -0.0002 * max(mid, side * 0.8) * (1.0 - smoothstep(0.00025, 0.0007, fw));
        }
        return 0.0;
      }
    `,
    fragColor: /* glsl */ `
    {
      kk_part = floor((vKUv.y + 5.0) / ${PART.toFixed(1)});
      kk_uv = vec2(vKUv.x, vKUv.y - kk_part * ${PART.toFixed(1)});
      kk_fw = max(length(fwidth(kk_uv)), 1e-6);
      kk_field = kk_part < 0.5 || (kk_part > 5.5 && kk_part < 6.5);
      float rel;
      if (kk_field) g_kh = kk_fieldH(kk_uv, rel); else g_kh = kk_partH(kk_part, kk_uv, kk_fw, rel);
      g_krel = rel;
      vec3 wp = vWPos;
      float nB = n_fbm3(wp * 2.6, 3);
      float nS = n_fbm3(wp * 17.0 + 3.0, 2);
      float aaS = 1.0 - smoothstep(0.004, 0.012, kk_fw);
      g_kao = 1.0; g_ksh = 1.0;
      float lapEdge = 0.0;
      if (kk_field) {
        vec4 lp = kk_part < 0.5 ? ${lapConst(KANAGU.eye)} : ${lapConst(KANAGU.base)};
        float dl = kk_lapD(kk_uv, lp);
        lapEdge = 1.0 - smoothstep(0.0, 0.006, dl);
        g_kao = mix(0.5, 1.0, smoothstep(0.0, 0.005, dl));
        // lappet contact shadow toward the low sun (the plates are too thin for the shadow map)
        vec3 S = normalize(uSunDir);
        vec3 Nw = normalize(vWNrm);
        vec3 Tt = normalize(cross(vec3(0.0, 1.0, 0.0), Nw));
        vec3 Bb = cross(Nw, Tt);
        float sn = dot(S, Nw);
        if (sn > 0.0) {
          vec2 st = vec2(dot(S, Tt), dot(S, Bb)) / max(sn, 0.08);
          float occ = 0.0;
          for (int k = 1; k <= 4; k++) occ = max(occ, smoothstep(0.0003, -0.0003, kk_lapD(kk_uv + st * (0.0012 * float(k)), lp)));
          g_ksh = 1.0 - occ;
        }
      }
      // masks: cavities, polish, verdigris, rubbed-through gilding
      float cav = kk_field ? 1.0 - smoothstep(0.0, 0.35, rel) : (kk_part < 1.5 ? 1.0 - rel : (kk_part < 2.5 ? (1.0 - rel) * 0.8 : (kk_part < 3.5 ? 0.8 : 0.15)));
      cav = max(cav, 1.0 - g_kao);
      g_kcav = cav;
      float lowV = 1.0 - smoothstep(-0.2, 0.05, kk_uv.y);
      float vn = n_fbm3(wp * vec3(11.0, 5.0, 11.0) + 11.0, 3) * 0.5 + 0.5;
      g_kver = smoothstep(0.62, 0.9, vn + lowV * 0.12 + lapEdge * 0.22) * cav * (kk_field ? 0.75 : (kk_part > 2.5 && kk_part < 3.5 ? 0.5 : 0.2));
      g_kver *= smoothstep(-0.1, 0.35, nB);
      g_kpol = kk_field ? smoothstep(0.2, 0.85, rel) : (kk_part > 3.5 ? 1.0 : (kk_part < 1.5 ? 0.35 + 0.65 * rel : (kk_part < 2.5 ? 0.8 * rel : 0.3)));
      g_kwear = smoothstep(0.8, 0.98, rel * (0.7 + 0.45 * (nS * 0.5 + 0.5))) * smoothstep(0.35, 0.75, nB * 0.5 + 0.5);
      if (kk_part > 4.5 && kk_part < 5.5) g_kwear = smoothstep(0.75, 1.0, kk_uv.y * 100.0) * smoothstep(0.3, 0.8, nS * 0.5 + 0.5) * 0.6;
      vec3 gilt = vec3(1.0, 0.69, 0.29) * (0.92 + 0.10 * nB + 0.05 * nS * aaS);
      vec3 col = mix(gilt * vec3(0.70, 0.57, 0.40), gilt * 1.05, g_kpol);
      col = mix(col, vec3(0.50, 0.26, 0.10), g_kwear * 0.7);
      float tar = cav * (0.45 + 0.4 * smoothstep(-0.3, 0.6, nB));
      col = mix(col, vec3(0.16, 0.095, 0.04), tar * (kk_field ? 0.5 : 0.35));
      col *= mix(1.0, g_kao, 0.7);
      col = mix(col, vec3(0.035, 0.10, 0.075) * (0.8 + 0.4 * vn), g_kver);
      diffuseColor.rgb *= col;
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(mix(0.48, 0.15, g_kpol) + g_kcav * 0.1 + g_kwear * 0.12, 0.1, 1.0); roughnessFactor = mix(roughnessFactor, 0.9, g_kver);`,
    fragMetal: /* glsl */ `metalnessFactor = 1.0 - g_kver * 0.95;`,
    fragNormal: /* glsl */ `
    {
      vec3 Nw = n_worldNormalFromView(normal);
      vec3 dpx = dFdx(vWPos), dpy = dFdy(vWPos);
      vec2 dtx = dFdx(kk_uv), dty = dFdy(kk_uv);
      float det = dtx.x * dty.y - dtx.y * dty.x;
      if (abs(det) > 1e-16) {
        vec3 T = (dpx * dty.y - dpy * dtx.y) / det;
        vec3 B = (dpy * dtx.x - dpx * dty.x) / det;
        T = normalize(T - Nw * dot(Nw, T)); B = normalize(B - Nw * dot(Nw, B));
        float e = max(kk_fw * 0.5, 0.00012);
        float r0, hx, hy;
        if (kk_field) { hx = kk_fieldH(kk_uv + vec2(e, 0.0), r0); hy = kk_fieldH(kk_uv + vec2(0.0, e), r0); }
        else { hx = kk_partH(kk_part, kk_uv + vec2(e, 0.0), kk_fw, r0); hy = kk_partH(kk_part, kk_uv + vec2(0.0, e), kk_fw, r0); }
        vec2 gr = vec2(hx - g_kh, hy - g_kh) / e;
        vec3 nW = normalize(Nw - gr.x * T - gr.y * B);
        // chased relief self shadow under the raking sun
        if (kk_field && kk_fw < 0.0012) {
          vec3 S = normalize(uSunDir);
          float sn = dot(S, Nw);
          vec2 st = vec2(dot(S, T), dot(S, B));
          float lt = length(st);
          if (sn > 0.0 && lt > 1e-3) {
            vec2 dir = st / lt; float rise = sn / lt;
            float occ = 0.0;
            for (int k = 1; k <= 4; k++) {
              float s = 0.0009 * float(k);
              float hq = kk_fieldH(kk_uv + dir * s, r0);
              occ = max(occ, smoothstep(0.0, 0.00012, hq - (g_kh + s * rise)));
            }
            g_ksh *= 1.0 - occ * 0.85 * (1.0 - smoothstep(0.0005, 0.0012, kk_fw));
          }
        }
        // specular anti-aliasing: widen the lobe where the normal varies inside a pixel
        vec3 dn = fwidth(nW);
        roughnessFactor = sqrt(roughnessFactor * roughnessFactor + min(dot(dn, dn) * 2.0, 0.3));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
      }
    }
    `,
    fragLight: /* glsl */ `
      reflectedLight.directDiffuse *= g_ksh;
      reflectedLight.directSpecular *= g_ksh;
      reflectedLight.indirectDiffuse *= mix(1.0, g_kao, 0.7);
      reflectedLight.indirectSpecular *= mix(1.0, g_kao, 0.8);
    `,
    vertexHead: /* glsl */ `varying vec2 vKUv;`,
    vertexWorld: /* glsl */ `vKUv = uv;`,
  };
}
