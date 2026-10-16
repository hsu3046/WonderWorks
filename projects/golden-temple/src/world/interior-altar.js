// ---------------------------------------------------------------------------
// Altar furniture and offerings: shumidan, front table, priest platform,
// cushion, floor lanterns, candlesticks, incense burner, lotus vases (joka),
// flower arrangements, fruit stands.
// All builders take (ctx, B, M, ...) and add merged geometry into Builder B,
// or return extra objects (instanced meshes, lights) to the caller.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { petalGeo, latheGeo, rbox, ringGeo } from './interior-geo.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// panel geometry for the ornament shader: box (w,h,depth) facing +z
export function panelGeo(w, h, depth, id = 0) {
  const g = new THREE.BoxGeometry(w, h, depth);
  const p = g.attributes.position, uv = g.attributes.uv;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, p.getX(i), p.getY(i));
    col[i * 3] = w / 2; col[i * 3 + 1] = h / 2; col[i * 3 + 2] = id / 10;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function mat4(pos, rot = [0, 0, 0], s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const sc = typeof s === 'number' ? V3(s, s, s) : V3(...s);
  return new THREE.Matrix4().compose(V3(...pos), q, sc);
}

// oriented helper: local frame (origin, rotationY)
function frame(ox, oy, oz, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (x, y, z) => [ox + x * c + z * s, oy + y, oz - x * s + z * c];
}

// ============================================================================
// SHUMIDAN: tiered lacquer platform with gold mouldings and carved panels.
// x,z = centre of footprint, y = base. w (x), d (z), h total.
export function buildShumidan(B, M, { x, y, z, w, d, h = 1.0, panels = 6, sidePanels = 2, ry = 0, ids = null }) {
  const P = frame(x, y, z, ry);
  const box = (m, bw, bh, bd, px, py, pz, bev = 0.004) => B.add(rbox(bw, bh, bd, bev, 2), m, mat4(P(px, py, pz), [0, ry, 0]));
  const k = h / 1.0;
  const tiers = [
    // [y0, y1, inset, material]
    [0.0, 0.09, 0.0, M.black],
    [0.09, 0.15, 0.05, M.black],
    [0.15, 0.19, 0.09, M.gold],
    [0.19, 0.23, 0.12, M.black],
    [0.23, 0.70, 0.17, null],   // body
    [0.70, 0.74, 0.12, M.black],
    [0.74, 0.78, 0.09, M.gold],
    [0.78, 0.85, 0.05, M.black],
    [0.85, 0.91, 0.02, M.black],
    [0.91, 1.0, -0.03, M.black],
  ];
  for (const [a, b, ins, m] of tiers) {
    const ty0 = a * k, ty1 = b * k;
    const bw = w - ins * 2, bd = d - ins * 2;
    if (m) box(m, bw, ty1 - ty0, bd, 0, (ty0 + ty1) / 2, 0, m === M.gold ? 0.015 : 0.006);
    else {
      // body core
      box(M.black, bw, ty1 - ty0, bd, 0, (ty0 + ty1) / 2, 0, 0.004);
      // front & back panels between gold posts
      const ph = (ty1 - ty0) - 0.06;
      const pw = (bw - 0.07 * (panels + 1)) / panels;
      for (let side = 0; side < 2; side++) {
        const zf = side === 0 ? bd / 2 : -bd / 2;
        const dir = side === 0 ? 1 : -1;
        for (let i = 0; i < panels; i++) {
          const px = -bw / 2 + 0.07 + pw / 2 + i * (pw + 0.07);
          B.add(panelGeo(pw, ph, 0.02, ids && side === 0 ? ids[i % ids.length] : 0), M.panel, mat4(P(px, (ty0 + ty1) / 2, zf + dir * 0.004), [0, ry + (side ? Math.PI : 0), 0]));
        }
        for (let i = 0; i <= panels; i++) {
          const px = -bw / 2 + 0.035 + i * (pw + 0.07);
          box(M.goldAntique, 0.05, ty1 - ty0, 0.03, px, (ty0 + ty1) / 2, zf + dir * 0.008, 0.008);
          // gold post caps (top and bottom)
          box(M.goldBright, 0.08, 0.04, 0.045, px, ty1 - 0.02, zf + dir * 0.01, 0.01);
          box(M.goldBright, 0.08, 0.04, 0.045, px, ty0 + 0.02, zf + dir * 0.01, 0.01);
        }
      }
      // side panels
      const sw = (bd - 0.07 * (sidePanels + 1)) / sidePanels;
      for (let side = 0; side < 2; side++) {
        const xf = side === 0 ? bw / 2 : -bw / 2;
        const dir = side === 0 ? 1 : -1;
        for (let i = 0; i < sidePanels; i++) {
          const pz = -bd / 2 + 0.07 + sw / 2 + i * (sw + 0.07);
          B.add(panelGeo(sw, ph, 0.02, 0), M.panel, mat4(P(xf + dir * 0.004, (ty0 + ty1) / 2, pz), [0, ry + dir * Math.PI / 2, 0]));
        }
      }
    }
  }
  // gold edge bands on the top board and plinth + corner fittings
  for (const [yy, ins] of [[0.995 * k, -0.03], [0.905 * k, -0.03], [0.085 * k, 0.0]]) {
    const bw = w - ins * 2 + 0.012, bd = d - ins * 2 + 0.012;
    box(M.goldBright, bw, 0.018, 0.02, 0, yy, bd / 2 - 0.009, 0.006);
    box(M.goldBright, bw, 0.018, 0.02, 0, yy, -bd / 2 + 0.009, 0.006);
    box(M.goldBright, 0.02, 0.018, bd, bw / 2 - 0.009, yy, 0, 0.006);
    box(M.goldBright, 0.02, 0.018, bd, -bw / 2 + 0.009, yy, 0, 0.006);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [ya, yb, ins] of [[0.0, 0.09, 0.0], [0.91, 1.0, -0.03], [0.78, 0.85, 0.05]]) {
      const bw = w - ins * 2, bd = d - ins * 2;
      const cxp = sx * (bw / 2 - 0.06), czp = sz * (bd / 2 - 0.06);
      box(M.goldBright, 0.14, (yb - ya) * k + 0.006, 0.14, cxp, (ya + yb) / 2 * k, czp, 0.012);
    }
  }
  // bosses along the plinth front
  const boss = new THREE.SphereGeometry(0.018, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
  const nb = Math.floor(w / 0.25);
  for (let i = 0; i < nb; i++) {
    const px = -w / 2 + 0.125 + i * 0.25;
    B.add(boss, M.goldBright, mat4(P(px, 0.045 * k, d / 2), [0, ry, 0]));
    B.add(boss, M.goldBright, mat4(P(px, 0.955 * k, d / 2 + 0.03), [0, ry, 0]));
  }
}

// ============================================================================
// FRONT TABLE (maejoku) with cat legs, carved apron, red tassels
export function buildFrontTable(B, M, { x, y, z, w = 3.2, d = 0.8, h = 0.85 }) {
  const box = (m, bw, bh, bd, px, py, pz, bev = 0.006, rot = [0, 0, 0]) => B.add(rbox(bw, bh, bd, bev, 2), m, mat4([x + px, y + py, z + pz], rot));
  // top board with gold edge
  box(M.black, w, 0.06, d, 0, h - 0.03, 0, 0.01);
  box(M.goldBright, w + 0.012, 0.016, 0.016, 0, h - 0.008, d / 2, 0.005);
  box(M.goldBright, w + 0.012, 0.016, 0.016, 0, h - 0.008, -d / 2, 0.005);
  box(M.goldBright, 0.016, 0.016, d + 0.012, w / 2, h - 0.008, 0, 0.005);
  box(M.goldBright, 0.016, 0.016, d + 0.012, -w / 2, h - 0.008, 0, 0.005);
  // apron with carved panels
  const ah = 0.2;
  box(M.black, w - 0.12, ah, d - 0.12, 0, h - 0.06 - ah / 2, 0);
  const np = 4, pw = (w - 0.3) / np;
  for (let i = 0; i < np; i++) {
    const px = -w / 2 + 0.15 + pw / 2 + i * pw;
    B.add(panelGeo(pw - 0.05, ah - 0.05, 0.02, i % 2 ? 5 : 4), M.panel, mat4([x + px, y + h - 0.06 - ah / 2, z + (d - 0.12) / 2 + 0.006]));
  }
  // cat legs: bent lathe-ish profile per leg (approximated by a curved tube of boxes)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * (w / 2 - 0.1), lz = sz * (d / 2 - 0.1);
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const out = Math.sin(t * Math.PI * 0.9) * 0.06 - t * t * 0.02;
      pts.push(V3(lx + sx * out, y + h - 0.06 - t * (h - 0.1), lz + sz * out));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 16, 0.035, 8, false);
    B.add(tube, M.black);
    // gold knee cap + foot
    B.add(new THREE.SphereGeometry(0.05, 12, 8), M.goldBright, mat4([lx, y + h - 0.1, lz]));
    B.add(latheGeo([[0, 0], [0.06, 0], [0.065, 0.02], [0.045, 0.05], [0.035, 0.07], [0, 0.07]], 16), M.goldBright, mat4([lx + sx * 0.02, y, lz + sz * 0.02]));
  }
  // low stretcher frame
  box(M.black, w - 0.2, 0.04, 0.05, 0, 0.12, d / 2 - 0.1);
  box(M.black, w - 0.2, 0.04, 0.05, 0, 0.12, -d / 2 + 0.1);
  // red tassels at the front corners
  for (const sx of [-1, 1]) addTassel(B, M, x + sx * (w / 2 - 0.02), y + h - 0.06, z + d / 2 + 0.02, 0.55, M.silkRed);
  // gilt corner fittings over the apron + a row of bosses along the top edge
  for (const sx of [-1, 1]) {
    box(M.goldBright, 0.2, ah + 0.02, 0.014, sx * (w / 2 - 0.16), h - 0.06 - ah / 2, d / 2 - 0.05, 0.005);
    box(M.goldBright, 0.014, ah + 0.02, 0.2, sx * (w / 2 - 0.054), h - 0.06 - ah / 2, d / 2 - 0.16, 0.005);
  }
  for (let i = 0; i < 9; i++) B.add(new THREE.SphereGeometry(0.016, 8, 6), M.goldBright, mat4([x - w / 2 + 0.2 + i * (w - 0.4) / 8, y + h - 0.035, z + d / 2 + 0.008]));
}

export function addTassel(B, M, x, y, z, len = 0.4, silk = M.silkRed) {
  // cord
  B.add(new THREE.CylinderGeometry(0.006, 0.006, len * 0.35, 6), silk, mat4([x, y - len * 0.175, z]));
  // gold knot cap
  B.add(new THREE.SphereGeometry(0.022, 10, 8), M.goldBright, mat4([x, y - len * 0.36, z]));
  B.add(latheGeo([[0, 0], [0.02, 0], [0.026, -0.02], [0.022, -0.04], [0, -0.045]], 12), M.goldBright, mat4([x, y - len * 0.37, z]));
  // fringe body: flared cylinder with strand bumps (silk shader)
  B.add(latheGeo([[0.001, 0], [0.018, 0], [0.024, -0.05], [0.03, -len * 0.5], [0.036, -len * 0.6], [0.0, -len * 0.6]], 24), silk, mat4([x, y - len * 0.4, z]));
}

// ============================================================================
// PRIEST PLATFORM (raiban) + kneeling cushion
export function buildRaiban(B, M, { x, y, z }) {
  const box = (m, bw, bh, bd, px, py, pz, bev = 0.006) => B.add(rbox(bw, bh, bd, bev, 2), m, mat4([x + px, y + py, z + pz]));
  box(M.black, 1.7, 0.16, 1.7, 0, 0.08, 0, 0.012);
  box(M.goldBright, 1.715, 0.016, 1.715, 0, 0.155, 0, 0.006);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(M.goldBright, 0.12, 0.17, 0.12, sx * 0.8, 0.085, sz * 0.8, 0.01);
  // cushion: soft rounded box with piping
  const cg = new THREE.BoxGeometry(0.84, 0.16, 0.84, 24, 6, 24);
  const p = cg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const ex = Math.abs(px) / 0.42, ez = Math.abs(pz) / 0.42;
    const edge = Math.max(ex, ez);
    const puff = 1 - Math.pow(edge, 6);
    const ny = py > 0 ? py + 0.035 * puff - 0.02 * Math.pow(edge, 3) : py;
    p.setXYZ(i, px * (1 - 0.03 * (py > 0 ? 1 - puff : 0)), ny, pz * (1 - 0.03 * (py > 0 ? 1 - puff : 0)));
  }
  cg.computeVertexNormals();
  B.add(cg, M.brocade, mat4([x, y + 0.16 + 0.08, z + 0.25]));
  // tassels at the cushion corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(new THREE.SphereGeometry(0.02, 8, 6), M.silkGold, mat4([x + sx * 0.42, y + 0.25, z + 0.25 + sz * 0.42]));
}

// ============================================================================
// FLOOR LANTERN (hexagonal, black lacquer + gold, glowing paper)
export function buildFloorLantern(B, M, { x, y, z, s = 1, ry = 0 }) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0], sc = 1) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], [rot[0], rot[1] + ry, rot[2]], sc * s));
  const hex = (prof) => latheGeo(prof, 6, Math.PI / 6).toNonIndexed();
  const hx = (g) => { g.computeVertexNormals(); return g; };
  // base (hexagonal, stepped) + legs
  add(hx(hex([[0, 0], [0.34, 0], [0.34, 0.06], [0.3, 0.08], [0.3, 0.14], [0.22, 0.17], [0, 0.17]])), M.black, 0, 0, 0);
  add(hx(hex([[0.345, 0.055], [0.35, 0.06], [0.35, 0.07], [0.345, 0.075]])), M.goldBright, 0, 0, 0);
  // stem with knobs
  add(latheGeo([[0.0, 0.17], [0.17, 0.17], [0.14, 0.22], [0.18, 0.3], [0.12, 0.38], [0.085, 0.5], [0.135, 0.6], [0.085, 0.7], [0.08, 0.84], [0.16, 0.9], [0.0, 0.92]], 24), M.black, 0, 0, 0);
  for (const [rr, yy] of [[0.18, 0.3], [0.135, 0.6], [0.155, 0.885]]) add(ringGeo(rr, 0.014, yy, 32, 6), M.goldBright, 0, 0, 0);
  // middle platform (chudai)
  add(hx(hex([[0, 0.92], [0.26, 0.92], [0.28, 0.95], [0.28, 0.99], [0.24, 1.0], [0, 1.0]])), M.black, 0, 0, 0);
  add(hx(hex([[0.285, 0.955], [0.29, 0.96], [0.29, 0.985], [0.285, 0.99]])), M.goldBright, 0, 0, 0);
  // fire box: glowing paper prism + black frame + gold corner fittings
  const fbH = 0.44, fbR = 0.2, fy = 1.0;
  add(hx(hex([[0, fy], [fbR - 0.01, fy], [fbR - 0.01, fy + fbH], [0, fy + fbH]])), M.paper, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const cxp = Math.sin(a) * fbR, czp = Math.cos(a) * fbR;
    add(rbox(0.035, fbH, 0.035, 0.006), M.black, cxp, fy + fbH / 2, czp, [0, a, 0]);
    add(rbox(0.045, 0.06, 0.045, 0.008), M.goldBright, cxp, fy + 0.03, czp, [0, a, 0]);
    add(rbox(0.045, 0.06, 0.045, 0.008), M.goldBright, cxp, fy + fbH - 0.03, czp, [0, a, 0]);
    // window lattice (horizontal + vertical bars on each face)
    const a2 = a + Math.PI / 6;
    const fx = Math.sin(a2) * fbR * 0.866, fz = Math.cos(a2) * fbR * 0.866;
    add(rbox(0.012, fbH - 0.04, 0.012, 0.003), M.black, fx * 1.01, fy + fbH / 2, fz * 1.01, [0, a2, 0]);
    for (const yy of [0.12, 0.24, 0.36]) add(rbox(fbR * 1.0, 0.01, 0.012, 0.003), M.black, fx * 1.01, fy + yy, fz * 1.01, [0, a2, 0]);
  }
  add(hx(hex([[0, fy + fbH], [fbR + 0.03, fy + fbH], [fbR + 0.03, fy + fbH + 0.03], [0, fy + fbH + 0.03]])), M.black, 0, 0, 0);
  // roof: hexagonal with concave slopes + upturned corner warabi
  const roof = hex([[0, fy + fbH + 0.03], [0.36, fy + fbH + 0.03], [0.37, fy + fbH + 0.06], [0.3, fy + fbH + 0.08], [0.18, fy + fbH + 0.14], [0.08, fy + fbH + 0.22], [0.04, fy + fbH + 0.26], [0, fy + fbH + 0.27]]);
  add(hx(roof), M.black, 0, 0, 0);
  add(hx(hex([[0.37, fy + fbH + 0.045], [0.38, fy + fbH + 0.05], [0.38, fy + fbH + 0.065], [0.37, fy + fbH + 0.07]])), M.goldBright, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    add(new THREE.TorusGeometry(0.03, 0.01, 6, 12, Math.PI * 1.5), M.goldBright, Math.sin(a) * 0.38, fy + fbH + 0.1, Math.cos(a) * 0.38, [0, a + Math.PI / 2, 0]);
  }
  // finial (hoju)
  add(latheGeo([[0, 0], [0.05, 0], [0.06, 0.03], [0.035, 0.06], [0.05, 0.1], [0.045, 0.14], [0.02, 0.18], [0, 0.2]], 16), M.goldBright, 0, fy + fbH + 0.26, 0);
  return { light: [x, y + (fy + fbH * 0.5) * s, z] };
}

// ============================================================================
// CANDLESTICK (gold) with wax candle and flame. returns flame position
export function buildCandlestick(B, M, { x, y, z, h = 0.7, s = 1 }, flames) {
  const add = (g, m, px, py, pz, sc = 1) => B.add(g, m, mat4([x + px, y + py, z + pz], [0, 0, 0], sc));
  const k = h;
  add(latheGeo([[0, 0], [0.13 * s, 0], [0.14 * s, 0.02], [0.1 * s, 0.05], [0.05 * s, 0.08], [0.035 * s, 0.12],
    [0.03 * s, k * 0.35], [0.055 * s, k * 0.38], [0.03 * s, k * 0.41], [0.025 * s, k * 0.75], [0.05 * s, k * 0.78], [0.025 * s, k * 0.8],
    [0.025 * s, k * 0.9], [0.1 * s, k * 0.92], [0.11 * s, k * 0.95], [0.03 * s, k * 0.96], [0, k * 0.96]], 24), M.goldBright, 0, 0, 0);
  // candle
  const ch = 0.26 * s, cr = 0.026 * s;
  add(new THREE.CylinderGeometry(cr * 0.95, cr, ch, 16, 1), M.whiteWax, 0, k * 0.96 + ch / 2, 0);
  // wick + flame
  add(new THREE.CylinderGeometry(0.002, 0.002, 0.012, 4), M.incense, 0, k * 0.96 + ch + 0.006, 0);
  const fy = k * 0.96 + ch + 0.035 * s;
  flames.push([x, y + fy, z, s]);
  return [x, y + fy, z];
}

export function flameGeo() {
  const g = latheGeo([[0, -0.022], [0.007, -0.02], [0.011, -0.01], [0.012, 0.0], [0.009, 0.015], [0.005, 0.03], [0.0015, 0.042], [0, 0.046]], 12);
  return g;
}

// ============================================================================
// INCENSE BURNER (gold, three lion legs, ring handles, openwork lid) + sticks
export function buildIncenseBurner(B, M, { x, y, z, s = 1 }, emb) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0], sc = 1) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], rot, sc * s));
  // bowl
  add(latheGeo([[0, 0.08], [0.16, 0.08], [0.24, 0.12], [0.29, 0.2], [0.3, 0.27], [0.27, 0.32], [0.25, 0.335], [0.27, 0.35], [0.27, 0.365], [0.0, 0.365]], 48), M.goldBright, 0, 0, 0);
  add(ringGeo(0.3, 0.012, 0.27, 48, 8), M.gold, 0, 0, 0);
  // legs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI;
    add(latheGeo([[0, 0], [0.05, 0], [0.05, 0.02], [0.03, 0.05], [0.035, 0.1], [0.02, 0.13], [0, 0.13]], 12), M.gold, Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2);
  }
  // ring handles
  for (const sx of [-1, 1]) add(new THREE.TorusGeometry(0.06, 0.013, 8, 20), M.goldBright, sx * 0.31, 0.33, 0, [0, Math.PI / 2, 0]);
  // ash bed + lid (domed openwork, part open at the front for the sticks)
  add(new THREE.CylinderGeometry(0.25, 0.25, 0.01, 32), M.incense, 0, 0.36, 0);
  add(latheGeo([[0.0, 0.0], [0.26, 0.0], [0.25, 0.06], [0.2, 0.13], [0.1, 0.18], [0.05, 0.2], [0, 0.205]], 32, 0).translate(0, 0, 0), M.gold, 0, 0.37, -0.08, [0, 0, 0], 0.62);
  add(latheGeo([[0, 0], [0.04, 0], [0.05, 0.03], [0.03, 0.06], [0.04, 0.09], [0.0, 0.12]], 12), M.goldBright, 0, 0.49, -0.08);
  // incense sticks
  const n = 7;
  for (let i = 0; i < n; i++) {
    const px = (i - (n - 1) / 2) * 0.03, pz = 0.08 + (i % 2) * 0.02;
    const hh = 0.3 + (i % 3) * 0.02;
    add(new THREE.CylinderGeometry(0.003, 0.003, hh, 5), M.incense, px, 0.36 + hh / 2, pz, [0.03 * (i - 3), 0, 0.04 * (i - 3)]);
    emb.push([x + (px + 0.04 * (i - 3) * hh * -0.5) * s, y + (0.36 + hh) * s, z + pz * s]);
  }
  return [x, y + 0.7 * s, z + 0.08 * s];
}

// ============================================================================
// GOLD LOTUS VASE (joka): vase + stems + blossoms/buds/leaves, all gilt
export function buildJoka(B, M, { x, y, z, s = 1, seed = 1 }, rnd) {
  const add = (g, m, mtx) => B.add(g, m, mtx);
  const T = (px, py, pz) => [x + px * s, y + py * s, z + pz * s];
  // vase (wide-shouldered)
  add(latheGeo([[0, 0], [0.14, 0], [0.15, 0.03], [0.1, 0.06], [0.09, 0.1], [0.17, 0.2], [0.22, 0.3], [0.2, 0.4], [0.1, 0.48], [0.08, 0.56], [0.13, 0.62], [0.14, 0.64], [0.0, 0.64]], 32), M.goldBright, mat4(T(0, 0, 0), [0, 0, 0], s));
  add(ringGeo(0.205, 0.012, 0.3, 32, 6), M.gold, mat4(T(0, 0, 0), [0, 0, 0], s));
  const blossomPetal = petalGeo({ len: 0.12, width: 0.1, thick: 0.012, cup: 0.4, bend: -0.04, tip: 0.05, ridge: 0.004, segU: 8, segV: 6, pointy: 1.35, wpow: 0.45 });
  const leafG = new THREE.CircleGeometry(0.16, 20);
  {
    const p = leafG.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i); const r = Math.hypot(px, py); p.setZ(i, -r * r * 1.2 + 0.01 * Math.sin(Math.atan2(py, px) * 9) * r / 0.16); }
    leafG.computeVertexNormals();
  }
  const stems = [
    { to: [0, 1.12, 0.02], kind: 'flower', size: 1.5 },
    { to: [-0.22, 0.95, 0.08], kind: 'flower', size: 1.25 },
    { to: [0.24, 0.92, 0.05], kind: 'flower', size: 1.25 },
    { to: [-0.12, 0.8, 0.22], kind: 'flower', size: 1.05 },
    { to: [0.14, 0.78, 0.2], kind: 'flower', size: 1.05 },
    { to: [-0.34, 0.78, -0.04], kind: 'flower', size: 0.95 },
    { to: [0.36, 0.8, -0.06], kind: 'flower', size: 0.95 },
    { to: [-0.08, 1.02, -0.14], kind: 'bud', size: 1.1 },
    { to: [0.12, 1.06, -0.12], kind: 'bud', size: 1.1 },
    { to: [0.0, 0.88, 0.3], kind: 'bud', size: 1 },
    { to: [-0.42, 0.62, 0.06], kind: 'leaf', size: 1.2 },
    { to: [0.44, 0.64, 0.08], kind: 'leaf', size: 1.2 },
    { to: [0.05, 0.62, 0.36], kind: 'leaf', size: 1.0 },
    { to: [-0.3, 1.12, -0.16], kind: 'leaf', size: 0.9 },
    { to: [0.3, 1.16, -0.18], kind: 'leaf', size: 0.9 },
    { to: [-0.2, 0.68, -0.3], kind: 'leaf', size: 1.0 },
    { to: [0.22, 0.7, -0.3], kind: 'leaf', size: 1.0 },
    { to: [0.4, 1.0, 0.1], kind: 'bud', size: 0.9 },
    { to: [-0.4, 0.98, 0.12], kind: 'bud', size: 0.9 },
  ];
  for (const st of stems) {
    const a = V3(...T(0, 0.62, 0)), b = V3(...T(st.to[0], st.to[1], st.to[2]));
    const mid = a.clone().lerp(b, 0.5).add(V3(st.to[0] * 0.15 * s, 0, st.to[2] * 0.15 * s));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    add(new THREE.TubeGeometry(curve, 10, 0.008 * s, 6, false), M.gold, null);
    const dir = b.clone().sub(mid).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
    if (st.kind === 'flower') {
      const k = st.size;
      // receptacle
      add(new THREE.SphereGeometry(0.035, 12, 8), M.goldBright, new THREE.Matrix4().compose(b, q, V3(s * k, s * k, s * k)));
      for (let r = 0; r < 2; r++) {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const th = ((i + r * 0.5) / n) * Math.PI * 2;
          const lm = mat4([0, 0, 0], [0.62 - r * 0.32, th, 0], 1.0 - r * 0.12);
          const pm = new THREE.Matrix4().compose(b, q, V3(s * k, s * k, s * k)).multiply(new THREE.Matrix4().makeTranslation(Math.sin(th) * 0.02, -0.01, Math.cos(th) * 0.02)).multiply(lm);
          add(blossomPetal, r === 0 ? M.gold : M.goldBright, pm);
        }
      }
    } else if (st.kind === 'bud') {
      const bud = latheGeo([[0, 0], [0.03, 0.02], [0.04, 0.06], [0.03, 0.1], [0.012, 0.13], [0, 0.145]], 12);
      add(bud, M.goldBright, new THREE.Matrix4().compose(b, q, V3(s * st.size, s * st.size, s * st.size)));
    } else {
      const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.3 * (rnd() - 0.5), rnd() * 6, 0.3 * (rnd() - 0.5)));
      add(leafG, M.goldAntique, new THREE.Matrix4().compose(b, lq, V3(s * st.size, s * st.size, s * st.size)));
    }
  }
}

// ============================================================================
// FLOWER ARRANGEMENT (white / pink chrysanthemums + lilies + greens)
// returns instance lists to the caller: {flowers:[{m, color}], leaves:[m]}
export function buildFlowerVase(B, M, { x, y, z, s = 1, h = 0.9, spread = 0.45, n = 26, vase = true, pink = 0.35 }, rnd, inst) {
  const T = (px, py, pz) => [x + px * s, y + py * s, z + pz * s];
  if (vase) {
    B.add(latheGeo([[0, 0], [0.11, 0], [0.12, 0.02], [0.08, 0.05], [0.12, 0.15], [0.15, 0.26], [0.12, 0.36], [0.06, 0.42], [0.06, 0.48], [0.1, 0.52], [0.0, 0.52]], 28), M.goldAntique, mat4(T(0, 0, 0), [0, 0, 0], s));
  }
  const top = V3(...T(0, 0.5, 0));
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.6) * spread;
    const hh = 0.5 + h * (0.45 + 0.55 * rnd()) * (1 - 0.4 * r / spread);
    const end = V3(...T(Math.cos(a) * r, hh, Math.sin(a) * r * 0.7));
    const mid = top.clone().lerp(end, 0.5).add(V3(Math.cos(a) * r * 0.25 * s, 0.05 * s, Math.sin(a) * r * 0.2 * s));
    const curve = new THREE.QuadraticBezierCurve3(top, mid, end);
    B.add(new THREE.TubeGeometry(curve, 6, 0.005 * s, 4, false), M.leaf);
    // leaves along the stem
    for (let k = 0; k < 3; k++) {
      const p = curve.getPoint(0.3 + 0.2 * k);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 1.5 - 0.3, rnd() * 6.28, rnd() - 0.5));
      inst.leaves.push(new THREE.Matrix4().compose(p, q, V3(s * (0.8 + 0.4 * rnd()), s, s)));
    }
    const isPink = rnd() < pink;
    // spray: a main head plus 2-5 smaller heads around it
    const nh = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < nh; k++) {
      const o = k === 0 ? V3(0, 0, 0) : V3((rnd() - 0.5) * 0.16 * s, (rnd() - 0.6) * 0.12 * s, (rnd() - 0.5) * 0.14 * s);
      const outward = V3(Math.cos(a), 0.9, Math.sin(a)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), outward.add(V3((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8)).normalize());
      const fs = s * (k === 0 ? 1.0 + 0.5 * rnd() : 0.55 + 0.4 * rnd());
      inst.flowers.push({ m: new THREE.Matrix4().compose(end.clone().add(o), q, V3(fs, fs, fs)), pink: k === 0 ? isPink : rnd() < pink * 0.7 });
      if (k > 0) {
        const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 1.5 - 0.3, rnd() * 6.28, rnd() - 0.5));
        inst.leaves.push(new THREE.Matrix4().compose(end.clone().add(o).add(V3(0, -0.04 * s, 0)), lq, V3(s * 1.2, s * 1.2, s * 1.2)));
      }
    }
  }
}

// chrysanthemum-like flower head geometry (2 rows of thin petals + centre)
export function flowerHeadGeo() {
  // low-poly chrysanthemum: two rings of cupped kite petals + domed centre
  const P = [];
  const push = (a, b, c) => P.push(...a, ...b, ...c);
  const rings = [[18, 0.012, 0.068, 0.012, 0.22], [13, 0.008, 0.048, 0.011, 0.6]];
  for (const [n, r0, r1, hw, lift] of rings) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + lift;
      const c = Math.cos(a), s = Math.sin(a);
      const px = -s, pz = c;
      const rm = (r0 + r1) * 0.55;
      const base = [c * r0, 0.004, s * r0];
      const tip = [c * r1, (r1 - r0) * lift, s * r1];
      const ym = (r1 - r0) * lift * 0.45 + 0.004;
      const L = [c * rm + px * hw, ym + 0.003, s * rm + pz * hw];
      const R = [c * rm - px * hw, ym + 0.003, s * rm - pz * hw];
      push(base, R, tip); push(base, tip, L);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.computeVertexNormals();
  const centre = new THREE.ConeGeometry(0.014, 0.012, 7, 1).translate(0, 0.008, 0).toNonIndexed();
  centre.deleteAttribute('uv');
  const m = new THREE.BufferGeometry();
  const a1 = out.attributes.position.array, a2 = centre.attributes.position.array;
  const n1 = out.attributes.normal.array, n2 = centre.attributes.normal.array;
  const pos = new Float32Array(a1.length + a2.length); pos.set(a1); pos.set(a2, a1.length);
  const nrm = new Float32Array(n1.length + n2.length); nrm.set(n1); nrm.set(n2, n1.length);
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return m;
}
export function flowerHeadGeoOld() {
  const parts = [];
  const pet = petalGeo({ len: 0.062, width: 0.017, thick: 0.003, cup: 0.3, bend: -0.01, tip: 0.0, ridge: 0.0, segU: 4, segV: 3, pointy: 1.0, wpow: 0.6 });
  for (let r = 0; r < 2; r++) {
    const n = r === 0 ? 16 : 12;
    for (let i = 0; i < n; i++) {
      const th = ((i + r * 0.5) / n) * Math.PI * 2;
      const g = pet.clone().applyMatrix4(mat4([0, 0, 0], [1.25 - r * 0.45, th, 0], 1 - r * 0.25));
      parts.push(g);
    }
  }
  const c = new THREE.SphereGeometry(0.012, 8, 6);
  parts.push(c);
  const gs = parts.map((g) => { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; });
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return out;
}
export function leafGeo() {
  const g = new THREE.PlaneGeometry(0.035, 0.09, 2, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i);
    const t = (py + 0.045) / 0.09;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.9 + 0.1;
    p.setXYZ(i, px * w, py + 0.045, -Math.abs(px) * 0.4 - t * t * 0.02);
  }
  g.computeVertexNormals();
  return g;
}

// ============================================================================
// FRUIT STAND (takatsuki) with a pyramid of mikan
export function buildFruitStand(B, M, { x, y, z, s = 1 }) {
  B.add(latheGeo([[0, 0], [0.12, 0], [0.13, 0.015], [0.06, 0.04], [0.035, 0.08], [0.03, 0.2], [0.05, 0.23], [0.16, 0.25], [0.17, 0.27], [0, 0.27]], 24), M.black, mat4([x, y, z], [0, 0, 0], s));
  B.add(ringGeo(0.165, 0.008, 0.265, 32, 6), M.goldBright, mat4([x, y, z], [0, 0, 0], s));
  const fr = new THREE.SphereGeometry(0.035, 14, 10).scale(1, 0.85, 1);
  const layers = [[6, 0.075], [3, 0.042], [1, 0]];
  let yy = 0.27 + 0.03;
  for (const [n, r] of layers) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + yy * 10;
      B.add(fr, M.fruit, mat4([x + Math.cos(a) * r * s, y + yy * s, z + Math.sin(a) * r * s], [0, a, 0], s));
    }
    yy += 0.05;
  }
}

// ============================================================================
// KIN (bronze singing bowl) on a red silk cushion and black stand
export function buildKin(B, M, { x, y, z, s = 1 }) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0]) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], rot, s));
  add(rbox(0.46, 0.28, 0.46, 0.02), M.black, 0, 0.14, 0);
  add(rbox(0.47, 0.02, 0.47, 0.006), M.goldBright, 0, 0.27, 0);
  // cushion
  const cg = new THREE.SphereGeometry(0.2, 20, 10);
  cg.scale(1, 0.32, 1);
  add(cg, M.silkRed, 0, 0.33, 0);
  // bowl
  add(latheGeo([[0, 0], [0.09, 0], [0.15, 0.03], [0.18, 0.08], [0.19, 0.14], [0.185, 0.165], [0.175, 0.165], [0.17, 0.14], [0.16, 0.08], [0.12, 0.04], [0, 0.03]], 40), M.goldAntique, 0, 0.36, 0);
  add(ringGeo(0.185, 0.006, 0.165, 40, 6), M.goldBright, 0, 0.36, 0);
  // striker (bai) lying beside
  add(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 8), M.black, 0.16, 0.29, 0.2, [0, 0.4, Math.PI / 2]);
}

// MOKUGYO (wooden fish drum) on a cushion
export function buildMokugyo(B, M, { x, y, z, s = 1 }) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0], sc = 1) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], rot, sc * s));
  add(rbox(0.46, 0.28, 0.46, 0.02), M.black, 0, 0.14, 0);
  add(rbox(0.47, 0.02, 0.47, 0.006), M.goldBright, 0, 0.27, 0);
  const cg = new THREE.SphereGeometry(0.21, 20, 10); cg.scale(1, 0.3, 1);
  add(cg, M.silkGold, 0, 0.33, 0);
  // body: slightly flattened sphere with a slit mouth and fish-scale grooves (red lacquer)
  const g = new THREE.SphereGeometry(0.17, 32, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    py *= 0.82;
    const slit = Math.exp(-Math.pow((py + 0.0) / 0.012, 2)) * Math.max(0, pz) / 0.17;
    const sc = 1 - 0.07 * slit + 0.006 * Math.sin(Math.atan2(px, pz) * 14) * (1 - Math.abs(py) / 0.15);
    p.setXYZ(i, px * sc, py * sc, pz * sc);
  }
  g.computeVertexNormals();
  add(g, M.red, 0, 0.48, 0);
  add(new THREE.CylinderGeometry(0.014, 0.016, 0.3, 8), M.silkRed, -0.17, 0.3, 0.2, [0, -0.4, Math.PI / 2]);
}

// low sutra desk (kyozukue) with an open folding sutra
export function buildSutraDesk(B, M, { x, y, z, s = 1 }) {
  const add = (g, m, px, py, pz, rot = [0, 0, 0]) => B.add(g, m, mat4([x + px * s, y + py * s, z + pz * s], rot, s));
  add(rbox(0.72, 0.035, 0.34, 0.008), M.black, 0, 0.3, 0);
  add(rbox(0.735, 0.012, 0.355, 0.004), M.goldBright, 0, 0.32, 0);
  for (const sx of [-1, 1]) {
    // scrolled side panels (legs)
    add(rbox(0.035, 0.28, 0.3, 0.01), M.black, sx * 0.31, 0.14, 0);
    add(rbox(0.05, 0.03, 0.34, 0.008), M.goldBright, sx * 0.31, 0.015, 0);
    add(new THREE.TorusGeometry(0.035, 0.008, 6, 14, Math.PI), M.goldBright, sx * 0.33, 0.28, 0.17, [0, Math.PI / 2, 0]);
  }
  // open accordion sutra: two cream panels with fine text lines (white paint) on a gold cloth
  add(rbox(0.36, 0.01, 0.24, 0.003), M.silkGold, 0, 0.325, 0);
  for (const sx of [-1, 1]) add(rbox(0.16, 0.012, 0.2, 0.002), M.whiteWax, sx * 0.085, 0.335, 0, [0, 0, sx * -0.06]);
}
