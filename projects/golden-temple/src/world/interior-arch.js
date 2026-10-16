// ---------------------------------------------------------------------------
// Interior architecture: lacquered columns with gilt bands, tie beams,
// bracket sets, coffered ceiling (go-tenjo) with gilt cross fittings,
// sanctum back screen.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { latheGeo, rbox } from './interior-geo.js';
import { panelGeo } from './interior-altar.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mat4(pos, rot = [0, 0, 0], s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  const sc = typeof s === 'number' ? V3(s, s, s) : V3(...s);
  return new THREE.Matrix4().compose(V3(...pos), q, sc);
}

// cylindrical band with uv = (arc metres, local y) for the ornament shader
function bandGeo(r, h, id = 2, seg = 48) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true);
  const p = g.attributes.position, uv = g.attributes.uv;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getX(i), p.getZ(i));
    uv.setXY(i, a * r, p.getY(i));
    col[i * 3] = Math.PI * r; col[i * 3 + 1] = h / 2; col[i * 3 + 2] = id / 10;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildColumns(B, M, S, cols) {
  const { Y0 } = S;
  const top = S.beamY;
  for (const c of cols) {
    const r = c.r || 0.34;
    const h = top - Y0;
    // shaft with slight entasis
    B.add(latheGeo([[0, 0], [r * 0.985, 0], [r, h * 0.3], [r * 0.99, h * 0.7], [r * 0.95, h], [0, h]], 40), c.black ? M.black : M.redColumn, mat4([c.x, Y0, c.z]));
    // base: bronze/gold nemaki sheath with carved band + plinth
    B.add(latheGeo([[0, 0], [r + 0.07, 0], [r + 0.07, 0.05], [r + 0.04, 0.07], [0, 0.07]], 40), M.black, mat4([c.x, Y0, c.z]));
    B.add(bandGeo(r + 0.012, 0.3, 2), M.panel, mat4([c.x, Y0 + 0.07 + 0.15, c.z]));
    B.add(new THREE.TorusGeometry(r + 0.014, 0.012, 6, 40).rotateX(Math.PI / 2), M.goldBright, mat4([c.x, Y0 + 0.07, c.z]));
    B.add(new THREE.TorusGeometry(r + 0.014, 0.012, 6, 40).rotateX(Math.PI / 2), M.goldBright, mat4([c.x, Y0 + 0.37, c.z]));
    // upper gilt band (makimono) + capital
    for (const yy of [h - 1.15, h - 0.42]) {
      B.add(bandGeo(r * 0.965 + 0.01, 0.22, 0), M.panel, mat4([c.x, Y0 + yy, c.z]));
      B.add(new THREE.TorusGeometry(r * 0.965 + 0.012, 0.01, 6, 40).rotateX(Math.PI / 2), M.goldBright, mat4([c.x, Y0 + yy + 0.11, c.z]));
      B.add(new THREE.TorusGeometry(r * 0.965 + 0.012, 0.01, 6, 40).rotateX(Math.PI / 2), M.goldBright, mat4([c.x, Y0 + yy - 0.11, c.z]));
    }
  }
}

// beams + brackets on a rectangular column grid (xs, zs relative to cx,cz)
export function buildBeams(B, M, S, xs, zs) {
  const { cx, cz } = S;
  const yb = S.beamY;          // top of columns
  const beamH = 0.42, beamW = 0.26;
  const X = xs.map((v) => cx + v), Z = zs.map((v) => cz + v);
  const span = (a, b) => [Math.min(a, b), Math.max(a, b)];
  // head tie beams along x (for every z line): side spans at column-head level,
  // the wide centre span (over the sanctum) as a high rainbow beam under the ceiling
  for (const z of Z) {
    for (let i = 0; i < X.length - 1; i++) {
      const x0 = X[i], x1 = X[i + 1];
      const centre = x0 < cx && x1 > cx;
      if (!centre) {
        B.add(rbox(x1 - x0, beamH, beamW, 0.03), M.red, mat4([(x0 + x1) / 2, yb - 0.85, z]));
        B.add(rbox(x1 - x0, 0.28, beamW * 0.9, 0.025), M.red, mat4([(x0 + x1) / 2, yb - 0.1, z]));
      } else {
        // koryo: slightly arched, deep, with gilt end fittings
        const L = x1 - x0;
        let g = rbox(L, 0.36, beamW, 0.04, 2); if (g.index) g = g.toNonIndexed();
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { const u = p.getX(k) / (L / 2); p.setY(k, p.getY(k) + 0.1 * (1 - u * u)); }
        g.computeVertexNormals();
        B.add(g, M.red, mat4([(x0 + x1) / 2, yb + 0.62, z]));
        for (const s of [-1, 1]) B.add(rbox(0.5, 0.38, beamW + 0.02, 0.01), M.panel === undefined ? M.gold : M.goldAntique, mat4([(x0 + x1) / 2 + s * (L / 2 - 0.45), yb + 0.62, z]));
      }
    }
  }
  for (const x of X) {
    const [z0, z1] = span(Z[0], Z[Z.length - 1]);
    B.add(rbox(beamW, beamH, z1 - z0 + 0.5, 0.03), M.red, mat4([x, yb - 0.85 - 0.005, (z0 + z1) / 2]));
    B.add(rbox(beamW * 0.9, 0.28, z1 - z0 + 0.5, 0.025), M.red, mat4([x, yb - 0.1 - 0.005, (z0 + z1) / 2]));
  }
  // gilt nail covers (kugi-kakushi) on beams at every column + beam end caps
  const nail = latheGeo([[0, 0], [0.09, 0], [0.095, 0.01], [0.07, 0.022], [0.03, 0.035], [0, 0.04]], 6, Math.PI / 6);
  for (const x of X) for (const z of Z) {
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      B.add(nail, M.goldBright, mat4([x + dx * (beamW / 2 + 0.19), yb - 0.85, z + dz * (beamW / 2 + 0.19)], [Math.PI / 2, ry, 0]));
    }
    // bracket set: bearing block + crossed arms + small blocks
    B.add(rbox(0.56, 0.22, 0.56, 0.02), M.red, mat4([x, yb + 0.11, z]));
    B.add(rbox(0.6, 0.06, 0.6, 0.01), M.goldAntique, mat4([x, yb + 0.005, z]));
    for (const ry of [0, Math.PI / 2]) {
      B.add(rbox(1.5, 0.2, 0.18, 0.03), M.red, mat4([x, yb + 0.32, z], [0, ry, 0]));
      for (const s of [-1, 1]) {
        const ox = Math.cos(ry) * s * 0.66, oz = -Math.sin(ry) * s * 0.66;
        B.add(rbox(0.26, 0.16, 0.26, 0.015), M.red, mat4([x + ox, yb + 0.5, z + oz]));
        B.add(rbox(0.2, 0.03, 0.2, 0.006), M.goldBright, mat4([x + ox, yb + 0.6, z + oz], [0, ry, 0]));
        // gilt end cap on the arm
        B.add(rbox(0.04, 0.2, 0.2, 0.008), M.goldBright, mat4([x + Math.cos(ry) * s * 0.75, yb + 0.32, z - Math.sin(ry) * s * 0.75], [0, ry, 0]));
      }
    }
    B.add(rbox(0.3, 0.2, 0.3, 0.015), M.red, mat4([x, yb + 0.52, z]));
  }
  // upper ring beams carrying the ceiling (between bracket tops and ceiling)
  for (const z of Z) {
    for (let i = 0; i < X.length - 1; i++) {
      const x0 = X[i], x1 = X[i + 1];
      if (x0 < cx && x1 > cx) continue;
      B.add(rbox(x1 - x0 + (i === 0 || i === X.length - 2 ? 0.8 : 0), 0.24, 0.22, 0.02), M.red, mat4([(x0 + x1) / 2 + (i === 0 ? -0.4 : 0.4), yb + 0.72, z]));
    }
  }
  for (const x of X) {
    const [z0, z1] = span(Z[0], Z[Z.length - 1]);
    B.add(rbox(0.22, 0.24, z1 - z0 + 1.6, 0.02), M.red, mat4([x, yb + 0.72 + 0.002, (z0 + z1) / 2]));
  }
  // carved frieze panels between the tie beams (black + gold), side spans only
  for (let zi = 0; zi < Z.length; zi++) {
    for (let xi = 0; xi < X.length - 1; xi++) {
      if (X[xi] < cx && X[xi + 1] > cx) continue;
      const xm = (X[xi] + X[xi + 1]) / 2, wv = X[xi + 1] - X[xi] - 0.4;
      B.add(panelGeo(wv, 0.38, 0.04, 0), M.panel, mat4([xm, yb - 0.42, Z[zi]]));
    }
  }
  // along-z frieze panels on the x lines
  for (const x of X) for (let zi = 0; zi < Z.length - 1; zi++) {
    const zm = (Z[zi] + Z[zi + 1]) / 2, wv = Math.abs(Z[zi + 1] - Z[zi]) - 0.4;
    B.add(panelGeo(wv, 0.38, 0.04, 0), M.panel, mat4([x, yb - 0.42, zm], [0, Math.PI / 2, 0]));
  }
}

// coffered ceiling over rect [x0,x1]x[z0,z1] at height yc (panel plane), cell size
export function buildCeiling(ctx, B, M, S, { x0, x1, z0, z1, yc, cell = 0.9 }) {
  const { THREE: T } = ctx;
  // painted panel plane (faces down)
  const pg = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2);
  B.add(pg, M.ceilingPaint, mat4([(x0 + x1) / 2, yc, (z0 + z1) / 2]));
  M.ceilingPaint.userData.patch.uniforms.uCell.value.set(cell, cell, 0);
  M.ceilingPaint.userData.patch.uniforms.uOrigin.value.set(x0, z0);
  // grid beams (gobuchi), black lacquer with gold edges
  const bw = 0.075, bh = 0.11;
  const nx = Math.round((x1 - x0) / cell), nz = Math.round((z1 - z0) / cell);
  for (let i = 0; i <= nx; i++) {
    const x = x0 + i * cell;
    B.add(rbox(bw, bh, z1 - z0, 0.012), M.black, mat4([x, yc - bh / 2, (z0 + z1) / 2]));
  }
  for (let j = 0; j <= nz; j++) {
    const z = z0 + j * cell;
    B.add(rbox(x1 - x0, bh * 0.98, bw, 0.012), M.black, mat4([(x0 + x1) / 2, yc - bh / 2 - 0.001, z]));
  }
  // gilt cross fittings at the intersections (instanced)
  const fit = new THREE.Group();
  const shape = new THREE.Shape();
  const a = 0.075, b = 0.03;
  shape.moveTo(-a, -b); shape.lineTo(-b, -b); shape.lineTo(-b, -a); shape.lineTo(b, -a); shape.lineTo(b, -b); shape.lineTo(a, -b);
  shape.lineTo(a, b); shape.lineTo(b, b); shape.lineTo(b, a); shape.lineTo(-b, a); shape.lineTo(-b, b); shape.lineTo(-a, b); shape.closePath();
  const fg = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  fg.rotateX(Math.PI / 2);
  const mats = [];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) mats.push(mat4([x0 + i * cell, yc - bh - 0.002, z0 + j * cell]));
  const im = ctx.geom.instanced(fg, M.goldBright, mats, { castShadow: false, receiveShadow: true });
  im.name = 'ceiling-fittings';
  // cove / perimeter moulding
  for (const [px, pz, w, d] of [[(x0 + x1) / 2, z0 + 0.12, x1 - x0, 0.24], [(x0 + x1) / 2, z1 - 0.12, x1 - x0, 0.24], [x0 + 0.12, (z0 + z1) / 2, 0.24, z1 - z0], [x1 - 0.12, (z0 + z1) / 2, 0.24, z1 - z0]]) {
    B.add(rbox(w, 0.22, d, 0.03), M.red, mat4([px, yc - 0.11, pz]));
  }
  return im;
}

// back screen behind the sanctum: lacquered frame with gilt-ornament panels
export function buildBackScreen(B, M, S, { x0, x1, z, y0, y1 }) {
  const w = x1 - x0, h = y1 - y0;
  B.add(rbox(w, h, 0.12, 0.01), M.black, mat4([(x0 + x1) / 2, (y0 + y1) / 2, z]));
  const nx = 5, ny = 3;
  const pw = (w - 0.16 * (nx + 1)) / nx, ph = (h - 0.16 * (ny + 1)) / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const px = x0 + 0.16 + pw / 2 + i * (pw + 0.16);
    const py = y0 + 0.16 + ph / 2 + j * (ph + 0.16);
    B.add(panelGeo(pw, ph, 0.02, j === ny - 1 ? 0 : 3), M.panel, mat4([px, py, z + 0.065]));
  }
  for (let i = 0; i <= nx; i++) B.add(rbox(0.1, h, 0.05, 0.01), M.goldAntique, mat4([x0 + 0.08 + i * (pw + 0.16), (y0 + y1) / 2, z + 0.08]));
  for (let j = 0; j <= ny; j++) B.add(rbox(w, 0.1, 0.05, 0.01), M.goldAntique, mat4([(x0 + x1) / 2, y0 + 0.08 + j * (ph + 0.16), z + 0.081]));
}

// side screens of the inner sanctum: lacquered frame, kick panel, black
// lattice (koshi) over glowing shoji paper, carved transom (ranma)
export function buildSideScreen(B, M, S, { x, z0, z1, y0, y1, facing = 1 }) {
  const len = z1 - z0, zc = (z0 + z1) / 2;
  const rot = [0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0];
  const P = (u, v, w = 0) => [x + w * facing, v, zc + u];   // u along z, v height, w toward the sanctum
  const h = y1 - y0;
  // frame posts + rails
  const nb = Math.max(2, Math.round(len / 1.9));
  const bw = len / nb;
  for (let i = 0; i <= nb; i++) B.add(rbox(0.16, h, 0.16, 0.02), M.black, mat4(P(-len / 2 + i * bw, y0 + h / 2), rot));
  for (const vv of [y0 + 0.05, y0 + 0.95, y1 - 1.05, y1 - 0.06]) B.add(rbox(0.12, 0.1, len, 0.015), M.black, mat4(P(0, vv), [0, 0, 0]));
  // gold fittings on the posts
  for (let i = 0; i <= nb; i++) for (const vv of [y0 + 0.95, y1 - 1.05]) B.add(rbox(0.19, 0.13, 0.19, 0.012), M.goldBright, mat4(P(-len / 2 + i * bw, vv), rot));
  for (let i = 0; i < nb; i++) {
    const uc = -len / 2 + (i + 0.5) * bw, pw = bw - 0.16;
    // kick panel with carved diaper
    B.add(panelGeo(pw, 0.82, 0.03, 2), M.panel, mat4(P(uc, y0 + 0.5, 0.0), rot));
    // shoji paper (glowing) + black lattice in front
    const lh = (y1 - 1.05) - (y0 + 0.95) - 0.1;
    const lc = (y1 - 1.05 + y0 + 0.95) / 2;
    B.add(new THREE.PlaneGeometry(pw, lh), M.shoji, mat4(P(uc, lc, -0.02), [0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0]));
    for (let k = 1; k < Math.round(pw / 0.11); k++) B.add(new THREE.BoxGeometry(0.035, lh, 0.04), M.black, mat4(P(uc - pw / 2 + k * (pw / Math.round(pw / 0.11)), lc, 0.01), rot));
    for (let k = 1; k < Math.round(lh / 0.42); k++) B.add(new THREE.BoxGeometry(pw, 0.03, 0.035), M.black, mat4(P(uc, lc - lh / 2 + k * (lh / Math.round(lh / 0.42)), 0.015), rot));
    // carved transom
    B.add(panelGeo(pw, 0.85, 0.04, 0), M.panel, mat4(P(uc, y1 - 0.55, 0.0), rot));
  }
}
