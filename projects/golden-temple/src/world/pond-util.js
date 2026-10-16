// ---------------------------------------------------------------------------
// Pond helpers: seeded JS noise, polygon distance fields, the pond map
// (floor depth / shore distance / lotus calm mask) shared by every pond part.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

// ---- seeded simplex noise (2D + 3D) ---------------------------------------
export function makeNoise(rand) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const g3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function n2(xin, yin) {
    let n0 = 0, n1 = 0, n2v = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = g3[perm[ii + perm[jj]] % 12]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = g3[perm[ii + i1 + perm[jj + j1]] % 12]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = g3[perm[ii + 1 + perm[jj + 1]] % 12]; t2 *= t2; n2v = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2v);
  }
  const F3 = 1 / 3, G3 = 1 / 6;
  function n3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    const c = (tt, gi, xx, yy, zz) => { if (tt <= 0) return 0; const g = g3[gi]; tt *= tt; return tt * tt * (g[0] * xx + g[1] * yy + g[2] * zz); };
    n += c(0.6 - x0 * x0 - y0 * y0 - z0 * z0, perm[ii + perm[jj + perm[kk]]] % 12, x0, y0, z0);
    n += c(0.6 - x1 * x1 - y1 * y1 - z1 * z1, perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12, x1, y1, z1);
    n += c(0.6 - x2 * x2 - y2 * y2 - z2 * z2, perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12, x2, y2, z2);
    n += c(0.6 - x3 * x3 - y3 * y3 - z3 * z3, perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12, x3, y3, z3);
    return 32 * n;
  }
  const fbm2 = (x, y, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += a * n2(x * f + o * 17.1, y * f + o * 9.7); f *= 2.03; a *= 0.5; } return s; };
  const fbm3 = (x, y, z, oct = 4) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += a * n3(x * f + o * 17.1, y * f + o * 9.7, z * f + o * 3.3); f *= 2.03; a *= 0.5; } return s; };
  return { n2, n3, fbm2, fbm3 };
}

// ---- polygons --------------------------------------------------------------
export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export function distToPolyEdges(x, z, poly) {
  let best = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// signed distance: + inside, - outside
export function sdPoly(x, z, poly) {
  const d = distToPolyEdges(x, z, poly);
  return pointInPoly(x, z, poly) ? d : -d;
}

// Closed centripetal Catmull-Rom through polygon vertices, resampled at ~spacing metres.
export function smoothClosed(poly, spacing = 0.5) {
  const pts = poly.map((p) => new THREE.Vector3(p[0], 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(8, Math.round(len / spacing));
  const out = [];
  for (let i = 0; i < n; i++) { const p = curve.getPointAt(i / n); out.push([p.x, p.z]); }
  return { pts: out, length: len, curve };
}

// signed area (x,z) > 0 => counter-clockwise in x/z with z down... we only need orientation sign
export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]);
  return a * 0.5;
}

// Inward normal of the polygon at sample i (for a resampled smooth outline)
export function inwardNormals(pts) {
  const area = polyArea(pts);
  const s = area > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    // rotate tangent by +-90deg -> inward
    return [-tz * s, tx * s, tx, tz];
  });
}

// Marching squares on a scalar grid (row-major, j = z rows). Returns polylines
// [[x,z],...] of the iso-contour `level` (closed loops end where they start).
export function contourLines(grid, nx, nz, x0, z0, res, level = 0) {
  const segs = [];
  const v = (i, j) => grid[j * nx + i] - level;
  const lerpP = (xa, za, va, xb, zb, vb) => { const t = va / (va - vb); return [xa + (xb - xa) * t, za + (zb - za) * t]; };
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const xA = x0 + i * res, zA = z0 + j * res, xB = xA + res, zB = zA + res;
      const e0 = () => lerpP(xA, zA, a, xB, zA, b); // bottom
      const e1 = () => lerpP(xB, zA, b, xB, zB, c); // right
      const e2 = () => lerpP(xA, zB, d, xB, zB, c); // top
      const e3 = () => lerpP(xA, zA, a, xA, zB, d); // left
      switch (idx) {
        case 1: case 14: segs.push([e3(), e0()]); break;
        case 2: case 13: segs.push([e0(), e1()]); break;
        case 3: case 12: segs.push([e3(), e1()]); break;
        case 4: case 11: segs.push([e1(), e2()]); break;
        case 5: segs.push([e3(), e2()], [e0(), e1()]); break;
        case 10: segs.push([e3(), e0()], [e1(), e2()]); break;
        case 6: case 9: segs.push([e0(), e2()]); break;
        case 7: case 8: segs.push([e3(), e2()]); break;
      }
    }
  }
  // chain
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const ends = new Map();
  segs.forEach((s, k) => {
    for (const e of [0, 1]) { const kk = key(s[e]); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(k); }
  });
  const used = new Uint8Array(segs.length);
  const lines = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const line = [segs[k][0], segs[k][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0];
        const cand = (ends.get(key(tip)) || []).find((q) => !used[q]);
        if (cand === undefined) break;
        used[cand] = 1;
        const s = segs[cand];
        const nxt = key(s[0]) === key(tip) ? s[1] : s[0];
        if (dir) line.push(nxt); else line.unshift(nxt);
      }
    }
    lines.push(line);
  }
  return lines;
}

// Resample a polyline at fixed spacing
export function resample(line, spacing) {
  const out = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = spacing - carry;
    while (s <= l) { out.push([a[0] + (b[0] - a[0]) * (s / l), a[1] + (b[1] - a[1]) * (s / l)]); s += spacing; }
    carry = l - (s - spacing);
  }
  return out;
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
