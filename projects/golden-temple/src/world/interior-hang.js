// ---------------------------------------------------------------------------
// Hanging ornaments: tengai canopy with yoraku strands, kanjo-ban banners,
// gilt pendant lanterns. Strand parts are instanced (few draw calls).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { latheGeo, rbox, ringGeo, petalGeo } from './interior-geo.js';
import { panelGeo, addTassel } from './interior-altar.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mat4(pos, rot = [0, 0, 0], s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const sc = typeof s === 'number' ? V3(s, s, s) : V3(...s);
  return new THREE.Matrix4().compose(V3(...pos), q, sc);
}

// instance collector for the strand parts
export function makeStrandKit() {
  return { bead: [], tube: [], leaf: [], bell: [], flower: [] };
}
export function strandGeos() {
  const bead = new THREE.IcosahedronGeometry(0.014, 0);
  const tube = latheGeo([[0, -0.03], [0.009, -0.016], [0.009, 0.016], [0, 0.03]], 4);
  // yoraku leaf pendant: heart shaped plate with a bevel
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.03, 0.0, 0.035, -0.04, 0.0, -0.075);
  s.bezierCurveTo(-0.035, -0.04, -0.03, 0.0, 0, 0);
  const leaf = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
  leaf.translate(0, 0, -0.002);
  const bell = latheGeo([[0, 0.0], [0.007, -0.004], [0.012, -0.02], [0.018, -0.04], [0.02, -0.045], [0.0, -0.045]], 8);
  const flower = new THREE.CylinderGeometry(0.028, 0.022, 0.008, 6, 1);
  return { bead, tube, leaf, bell, flower };
}
// one strand hanging straight down from (x,y,z), length len
export function addStrand(K, x, y, z, len, rnd, style = 0) {
  let yy = y;
  const end = y - len;
  let i = 0;
  const rot = rnd() * Math.PI;
  while (yy > end + 0.06) {
    if (i % 3 === 2) { K.tube.push(mat4([x, yy - 0.035, z], [0, rot, 0])); yy -= 0.07; }
    else { K.bead.push(mat4([x, yy - 0.014, z])); yy -= 0.03; }
    if (i % 9 === 8) { K.flower.push(mat4([x, yy - 0.004, z], [0, rot, 0])); yy -= 0.012; }
    i++;
  }
  if (style === 0) K.leaf.push(mat4([x, yy, z], [0, rot, 0], 1.3));
  else K.bell.push(mat4([x, yy, z], [0, 0, 0], 1.3));
}
export function flushStrands(ctx, K, M, group) {
  const G = strandGeos();
  for (const k of Object.keys(K)) {
    if (!K[k].length) continue;
    const m = k === 'tube' || k === 'flower' ? M.gold : M.goldBright;
    const im = ctx.geom.instanced(G[k], m, K[k], { castShadow: k !== 'bead' || true, receiveShadow: true });
    im.name = 'strand-' + k;
    group.add(im);
  }
}

// keman: pierced gilt pendant plate (pointed fan with a round window), hangs from its top edge
export function kemanGeo(w = 0.3, h = 0.22) {
  const s = new THREE.Shape();
  const a = w / 2;
  s.moveTo(-a, 0);
  s.lineTo(a, 0);
  s.bezierCurveTo(a * 1.05, -h * 0.45, a * 0.5, -h * 0.72, 0.0, -h);
  s.bezierCurveTo(-a * 0.5, -h * 0.72, -a * 1.05, -h * 0.45, -a, 0);
  const hole = new THREE.Path();
  hole.absarc(0, -h * 0.42, Math.min(a, h) * 0.32, 0, Math.PI * 2, true);
  s.holes.push(hole);
  for (const sx of [-1, 1]) {
    const hp = new THREE.Path();
    hp.absellipse(sx * a * 0.58, -h * 0.2, a * 0.16, h * 0.09, 0, Math.PI * 2, true, sx * 0.5);
    s.holes.push(hp);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -0.005);
  return g;
}

// ============================================================================
// TENGAI (canopy): octagonal gilt crown with carved frieze + strand curtain
export function buildCanopy(B, M, K, { x, y, z, r = 1.35, depth = 0.42, rings = 5, lenOuter = 1.1, lenInner = 2.0 }, rnd) {
  const oct = (prof) => { const g = latheGeo(prof, 8, Math.PI / 8).toNonIndexed(); g.computeVertexNormals(); return g; };
  // suspension rod + top lid (shallow octagonal pyramid)
  B.add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), M.gold, mat4([x, y + 0.25, z]));
  B.add(oct([[0, 0.18], [0.25, 0.16], [r * 0.85, 0.05], [r + 0.08, 0.0], [r + 0.08, -0.03], [0, -0.03]]), M.gold, mat4([x, y, z]));
  B.add(oct([[r + 0.085, -0.035], [r + 0.1, -0.03], [r + 0.1, 0.0], [r + 0.085, 0.005]]), M.goldBright, mat4([x, y, z]));
  // frieze: 8 pierced (openwork) panels framed by projecting gilt mouldings + corner posts,
  // a crest of flame petals on top, curled corner brackets with bells, keman valance below
  const side = 2 * r * Math.tan(Math.PI / 8);
  const apo = r;
  const ks = Math.min(1, Math.sqrt(r / 2.05));
  const pgs = [0.17, 0.25, 0.34].map((len) => petalGeo({ len: len * ks, width: len * ks * 0.62, thick: 0.02, cup: -0.12, bend: 0.12, tip: 0.14, ridge: 0.008, segU: 8, segV: 5, pointy: 1.1 }));
  const keman = kemanGeo(Math.min(0.3, side * 0.24), Math.min(0.22, side * 0.17));
  const hook = new THREE.TorusGeometry(0.07 * ks, 0.016 * ks, 6, 14, Math.PI * 1.4);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = x + Math.sin(a) * apo, pz = z + Math.cos(a) * apo;
    const ox = Math.cos(a), oz = -Math.sin(a);       // along the side
    const at = (u, yy, out = 0) => [px + ox * u + Math.sin(a) * out, yy, pz + oz * u + Math.cos(a) * out];
    B.add(panelGeo(side * 0.98, depth, 0.025, i % 2 ? 5 : 4), M.panel, mat4([px, y - 0.03 - depth / 2, pz], [0, a, 0]));
    // projecting mouldings top / middle bead / bottom
    B.add(rbox(side + 0.04, 0.05, 0.06, 0.012), M.goldBright, mat4(at(0, y - 0.045, 0.02), [0, a, 0]));
    B.add(rbox(side + 0.04, 0.045, 0.06, 0.012), M.goldBright, mat4(at(0, y - depth - 0.02, 0.02), [0, a, 0]));
    for (let k = 0; k < 7; k++) B.add(new THREE.SphereGeometry(0.016, 8, 6), M.goldBright, mat4(at((k - 3) * side * 0.14, y - 0.045, 0.055)));
    // posts at the corners
    const ac = a + Math.PI / 8;
    const rc = r / Math.cos(Math.PI / 8);
    const cpx = x + Math.sin(ac) * rc, cpz = z + Math.cos(ac) * rc;
    B.add(rbox(0.07, depth + 0.1, 0.07, 0.014), M.goldBright, mat4([cpx, y - 0.03 - depth / 2, cpz], [0, ac, 0]));
    // upturned corner finial + curled bracket with a long bell pendant
    B.add(latheGeo([[0, 0], [0.035, 0], [0.045, 0.035], [0.022, 0.08], [0.035, 0.12], [0.012, 0.17], [0, 0.2]], 10), M.goldBright, mat4([x + Math.sin(ac) * (rc + 0.02), y - 0.01, z + Math.cos(ac) * (rc + 0.02)], [0, 0, 0], ks));
    const hx = x + Math.sin(ac) * (rc + 0.1 * ks), hz = z + Math.cos(ac) * (rc + 0.1 * ks);
    B.add(hook, M.goldBright, mat4([hx, y - depth - 0.02, hz], [0, ac + Math.PI / 2, 0]));
    addStrand(K, x + Math.sin(ac) * (rc + 0.17 * ks), y - depth - 0.06, z + Math.cos(ac) * (rc + 0.17 * ks), (0.55 + 0.3 * rnd()) * (0.6 + 0.4 * ks) * 1.6, rnd, 1);
    // flame-petal crest along the top edge: tall at the middle, smaller toward the corners
    const crest = [[-0.36, 0], [-0.18, 1], [0, 2], [0.18, 1], [0.36, 0]];
    for (const [u, kind] of crest) {
      B.add(pgs[kind], kind === 2 ? M.goldBright : M.gold, mat4(at(u * side, y - 0.02, 0.0), [0.2, a, 0]));
    }
    // keman valance: pierced gilt pendant plates under the bottom moulding
    for (let k = 0; k < 3; k++) {
      const u = (k - 1) * side * 0.31;
      B.add(keman, M.goldBright, mat4(at(u, y - depth - 0.045, 0.025), [0, a, 0]));
      K.bell.push(mat4(at(u, y - depth - 0.045 - Math.min(0.22, side * 0.17) - 0.01, 0.025), [0, 0, 0], 1.2));
    }
  }
  // lower rim + inner ceiling with a lotus roundel
  B.add(oct([[r - 0.05, -depth - 0.05], [r + 0.04, -depth - 0.06], [r + 0.04, -depth - 0.02], [r - 0.05, -depth - 0.03]]), M.goldBright, mat4([x, y, z]));
  B.add(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.02, 8, 1, false, Math.PI / 8), M.goldAntique, mat4([x, y - 0.06, z]));
  // bead swags (yoraku net) draped between the outer strands, two tiers
  {
    const rr = r - 0.02;
    const n = Math.max(8, Math.round((2 * Math.PI * rr) / 0.3));
    for (const [drop, sag] of [[0.12, 0.16], [0.42, 0.12]]) {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const kk = (a) => Math.cos(Math.PI / 8) / Math.cos(((a % (Math.PI / 4)) - Math.PI / 8));
        const p0 = [x + Math.sin(a0) * rr * kk(a0) * 1.01, y - depth - 0.06 - drop, z + Math.cos(a0) * rr * kk(a0) * 1.01];
        const p1 = [x + Math.sin(a1) * rr * kk(a1) * 1.01, y - depth - 0.06 - drop, z + Math.cos(a1) * rr * kk(a1) * 1.01];
        const L = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
        const nb = Math.max(4, Math.floor(L / 0.032));
        for (let k = 1; k < nb; k++) {
          const t = k / nb;
          const s = 4 * t * (1 - t);
          K.bead.push(mat4([p0[0] + (p1[0] - p0[0]) * t, p0[1] - sag * s, p0[2] + (p1[2] - p0[2]) * t], [0, 0, 0], 0.85));
        }
        // pendant at the bottom of each swag
        const pm = [(p0[0] + p1[0]) / 2, p0[1] - sag, (p0[2] + p1[2]) / 2];
        K.leaf.push(mat4([pm[0], pm[1] - 0.012, pm[2]], [0, a0 + Math.PI / n, 0], 1.6));
      }
    }
  }
  // strand curtain: concentric rings, longer toward the centre
  for (let ri = 0; ri < rings; ri++) {
    const rr = r * (1 - ri / rings) - 0.02;
    const n = Math.max(6, Math.round((2 * Math.PI * rr) / 0.075));
    const len = lenOuter + (lenInner - lenOuter) * (ri / Math.max(1, rings - 1));
    for (let i = 0; i < n; i++) {
      const a = ((i + (ri % 2) * 0.5) / n) * Math.PI * 2;
      // octagonal outline for the outer ring
      const k = ri === 0 ? Math.cos(Math.PI / 8) / Math.cos(((a % (Math.PI / 4)) - Math.PI / 8)) : 1;
      // three interleaved tiers of pendants + scalloped hem + jitter -> cascading, see-through curtain
      const tier = [1.0, 0.8, 0.64][(i + ri) % 3];
      const l = len * tier * (0.9 + 0.2 * rnd()) * (0.8 + 0.28 * Math.abs(Math.sin(a * 4)));
      addStrand(K, x + Math.sin(a) * rr * k, y - (ri === 0 ? depth + 0.06 : 0.07), z + Math.cos(a) * rr * k, l, rnd, (i + ri) % 4 === 0 ? 1 : 0);
    }
  }
  // tiered look: gilt octagonal hoops part-way down the curtain, each with a bead swag fringe
  // and heart pendants, so the cascade reads in stacked tiers instead of one uniform curtain
  {
    const ap = r + 0.012;
    const sd = 2 * ap * Math.tan(Math.PI / 8);
    const kl = lenOuter / 1.75;
    for (const drop of [0.42, 0.86]) {
      const yh = y - depth - 0.06 - drop * kl;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = x + Math.sin(a) * ap, pz = z + Math.cos(a) * ap;
        const ox = Math.cos(a), oz = -Math.sin(a);
        B.add(rbox(sd + 0.03, 0.03, 0.03, 0.008), M.goldBright, mat4([px, yh, pz], [0, a, 0]));
        const nb = Math.max(6, Math.floor(sd / 0.03));
        const sw = 2;
        for (let s2 = 0; s2 < sw; s2++) {
          const u0 = -sd / 2 + (sd * s2) / sw, u1 = u0 + sd / sw;
          const nn = Math.max(3, Math.floor(nb / sw));
          for (let k = 1; k < nn; k++) {
            const t = k / nn, u = u0 + (u1 - u0) * t;
            K.bead.push(mat4([px + ox * u + Math.sin(a) * 0.012, yh - 0.02 - 0.1 * kl * 4 * t * (1 - t), pz + oz * u + Math.cos(a) * 0.012], [0, 0, 0], 0.8));
          }
          const um = (u0 + u1) / 2;
          K.leaf.push(mat4([px + ox * um + Math.sin(a) * 0.012, yh - 0.035 - 0.1 * kl, pz + oz * um + Math.cos(a) * 0.012], [0, a, 0], 1.5));
        }
        // a little gilt flower boss at every corner of the hoop
        const ac = a + Math.PI / 8, rc = ap / Math.cos(Math.PI / 8);
        K.flower.push(mat4([x + Math.sin(ac) * rc, yh, z + Math.cos(ac) * rc], [Math.PI / 2, ac, 0], 1.3));
      }
    }
  }
  // central pendant: a gilt lotus jewel
  B.add(latheGeo([[0, 0], [0.12, -0.05], [0.16, -0.15], [0.12, -0.26], [0.05, -0.32], [0, -0.38]], 16), M.goldBright, mat4([x, y - 0.08, z]));
}

// ============================================================================
// BAN (gilt banner): crown + linked plates with roundels + streamers/tassels
export function buildBanner(B, M, K, { x, y, z, w = 0.62, plates = 6, plateH = 0.6, ry = 0 }, rnd) {
  const P = (px, py, pz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + px * c + pz * s, y + py, z - px * s + pz * c]; };
  // crown: a broad gilt canopy (wider than the plates) with an arched flame crest
  const cw = w + 0.34;
  B.add(rbox(cw + 0.06, 0.06, 0.4, 0.015), M.goldBright, mat4(P(0, -0.03, 0), [0, ry, 0]));
  B.add(panelGeo(cw, 0.3, 0.34, 5), M.panel, mat4(P(0, -0.21, 0), [0, ry, 0]));
  B.add(rbox(cw + 0.06, 0.045, 0.4, 0.012), M.goldBright, mat4(P(0, -0.38, 0), [0, ry, 0]));
  const kem = kemanGeo(cw / 4.2, 0.16);
  for (let k = 0; k < 4; k++) B.add(kem, M.goldBright, mat4(P((k - 1.5) * cw / 4, -0.4, 0.2), [0, ry, 0]));
  const pgs = [0.18, 0.26, 0.4].map((len) => petalGeo({ len, width: len * 0.62, thick: 0.02, cup: -0.12, bend: 0.1, tip: 0.12, ridge: 0.008, segU: 8, segV: 5, pointy: 1.1 }));
  for (const [u, kind] of [[-0.5, 0], [-0.3, 1], [0, 2], [0.3, 1], [0.5, 0]]) B.add(pgs[kind], kind === 2 ? M.goldBright : M.gold, mat4(P(u * cw, 0.0, 0.18), [0.25, ry, 0]));
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) addStrand(K, ...P(sx * (cw / 2 + 0.03), -0.4, (k - 1.5) * 0.1), 0.6 + 0.15 * rnd(), rnd, 1);
  }
  B.add(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), M.gold, mat4(P(0, 0.5, 0), [0, ry, 0]));
  // plates: tall roundel plates (alternating peony / hosoge) joined by short scroll plates
  let yy = -0.46;
  for (let i = 0; i < plates; i++) {
    const link = i % 2 === 1;
    const ph = link ? plateH * 0.42 : plateH;
    const cyy = yy - ph / 2;
    B.add(panelGeo(w, ph, 0.02, link ? 6 : (i % 4 === 0 ? 4 : 5)), M.panel, mat4(P(0, cyy, 0), [0, ry, 0]));
    // raised gold frame (heavier on the roundel plates)
    const fr = link ? 0.02 : 0.03;
    for (const sy of [-1, 1]) B.add(rbox(w + 0.04, fr, 0.04, 0.008), M.goldBright, mat4(P(0, cyy + sy * ph / 2, 0), [0, ry, 0]));
    for (const sx of [-1, 1]) B.add(rbox(fr, ph + 0.02, 0.04, 0.008), M.goldBright, mat4(P(sx * w / 2, cyy, 0), [0, ry, 0]));
    if (!link) for (const sx of [-1, 1]) for (const sy of [-1, 1]) B.add(new THREE.SphereGeometry(0.022, 10, 8), M.goldBright, mat4(P(sx * w / 2, cyy + sy * ph / 2, 0.02)));
    // pendants at the joints
    for (const sx of [-1, 1]) addStrand(K, ...P(sx * (w / 2 + 0.02), cyy - ph / 2, 0), link ? 0.3 : 0.18, rnd, link ? 0 : 1);
    // link rings
    if (i < plates - 1) for (const sx of [-0.25, 0.25]) B.add(new THREE.TorusGeometry(0.018, 0.005, 6, 12), M.goldBright, mat4(P(sx * w, cyy - ph / 2 - 0.03, 0), [0, ry + Math.PI / 2, 0]));
    yy -= ph + 0.06;
  }
  // bottom: valance + long streamers of chains and red tassels
  B.add(rbox(w + 0.06, 0.05, 0.05, 0.01), M.goldBright, mat4(P(0, yy + 0.02, 0), [0, ry, 0]));
  const ns = 11;
  for (let i = 0; i < ns; i++) {
    const px = -w / 2 + (w * (i + 0.5)) / ns;
    const p = P(px, yy, 0);
    const c = 1 - Math.abs(i - (ns - 1) / 2) / ns;   // longer toward the middle
    if (i % 2 === 0) addTassel(B, M, p[0], p[1], p[2], (0.8 + 0.45 * c) * (0.92 + 0.16 * rnd()), M.silkRed);
    else { addStrand(K, p[0], p[1], p[2], (0.75 + 0.5 * c) * (0.92 + 0.16 * rnd()), rnd, 0); }
  }
  // gilt valance pendants (small keman plates) along the bottom bar
  for (let i = 0; i < 4; i++) {
    const p = P(-w / 2 + (w * (i + 0.5)) / 4, yy - 0.02, 0.03);
    B.add(panelGeo(w / 5, 0.12, 0.012, 4), M.panel, mat4([p[0], p[1] - 0.06, p[2]], [0, ry, 0]));
  }
}

// ============================================================================
// PENDANT LANTERN (gilt openwork, hexagonal) with glow core + tassels
export function buildPendantLantern(B, M, K, { x, y, z, s = 1, chain = 1.2 }, rnd) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0], sc = 1) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], rot, sc * s));
  const hex = (prof) => { const g = latheGeo(prof, 6, Math.PI / 6).toNonIndexed(); g.computeVertexNormals(); return g; };
  // chain
  addStrand(K, x, y, z, chain, rnd, 2);
  const y0 = -chain / s;
  // roof (hexagonal, curved) with corner curls
  add(hex([[0, y0 - 0.0], [0.04, y0 - 0.02], [0.1, y0 - 0.08], [0.2, y0 - 0.13], [0.26, y0 - 0.15], [0.26, y0 - 0.17], [0, y0 - 0.17]]), M.goldBright, 0, 0, 0);
  add(latheGeo([[0, 0], [0.03, 0], [0.04, 0.03], [0.02, 0.06], [0, 0.09]], 10), M.goldBright, 0, y0 - 0.02, 0);
  // fire box: glow core + gilt openwork panels (panel shader) + posts
  const fb = 0.32, rr = 0.17;
  add(hex([[0, y0 - 0.17], [rr - 0.02, y0 - 0.17], [rr - 0.02, y0 - 0.17 - fb], [0, y0 - 0.17 - fb]]), M.paper, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fx = Math.sin(a) * rr * 0.866, fz = Math.cos(a) * rr * 0.866;
    B.add(panelGeo(rr * 0.9 * s, fb * 0.9 * s, 0.012 * s, 2), M.panel, mat4([x + fx * s, y + (y0 - 0.17 - fb / 2) * s, z + fz * s], [0, a, 0]));
    const ac = a + Math.PI / 6;
    add(rbox(0.025, fb, 0.025, 0.006), M.goldBright, Math.sin(ac) * rr, y0 - 0.17 - fb / 2, Math.cos(ac) * rr, [0, ac, 0]);
  }
  // base + hanging fringe (red tassels and short gold strands)
  add(hex([[0, y0 - 0.17 - fb], [rr + 0.03, y0 - 0.17 - fb], [rr + 0.03, y0 - 0.2 - fb], [0.08, y0 - 0.26 - fb], [0, y0 - 0.28 - fb]]), M.goldBright, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = x + Math.sin(a) * (rr + 0.02) * s, pz = z + Math.cos(a) * (rr + 0.02) * s, py = y + (y0 - 0.2 - fb) * s;
    if (i % 2 === 0) addTassel(B, M, px, py, pz, 0.42 * s, M.silkRed);
    else addStrand(K, px, py, pz, 0.35 * s, rnd, 0);
  }
  addTassel(B, M, x, y + (y0 - 0.28 - fb) * s, z, 0.5 * s, M.silkRed);
  return [x, y + (y0 - 0.17 - fb / 2) * s, z];
}
