import { sdfKey, decodeSDF } from '../core/sdf-cache.js';
// ---------------------------------------------------------------------------
// Narrow-band SDF -> mesh (naive surface nets) with Newton projection, analytic
// gradient normals and a baked per-vertex ambient occlusion / region mask.
// The heavy SDF evaluation runs in a pool of module workers (deterministic:
// every grid point / vertex is computed by the same pure function).
// ---------------------------------------------------------------------------
import { getShape } from './interior-shapes.js';

let POOL = null;
function pool() {
  if (POOL) return POOL;
  const n = Math.max(1, Math.min(12, (navigator.hardwareConcurrency || 4) - 2));
  const workers = [];
  try {
    for (let i = 0; i < n; i++) workers.push(new Worker(new URL('./interior-sdfworker.js', import.meta.url), { type: 'module' }));
  } catch (e) {
    console.warn('[interior] workers unavailable, meshing inline', e);
  }
  let seq = 0;
  const pending = new Map();
  for (const w of workers) {
    w.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } };
    w.onerror = (e) => console.error('[interior] worker error', e.message);
  }
  let rr = 0;
  POOL = {
    size: workers.length,
    run(msg, transfer = []) {
      if (!workers.length) return Promise.resolve(runInline(msg));
      const id = ++seq; msg.id = id;
      const w = workers[rr++ % workers.length];
      return new Promise((res) => { pending.set(id, res); w.postMessage(msg, transfer); });
    },
    dispose() { workers.forEach((w) => w.terminate()); POOL = null; },
  };
  return POOL;
}
export function disposePool() { if (POOL) POOL.dispose(); }

// ---- the work itself (shared with the worker) ------------------------------
export function gridSlab({ shape, params, bmin, h, nx, ny, k0, k1, band }) {
  const S = getShape(shape, params);
  const f = S.f;
  const nzl = k1 - k0;
  const out = new Float32Array(nx * ny * nzl);
  const B = 4;
  const half = Math.sqrt(3) * B * h * 0.5;
  const thr = half * band + h;
  for (let bk = k0; bk < k1; bk += B) {
    const ke = Math.min(bk + B, k1);
    for (let bj = 0; bj < ny; bj += B) {
      const je = Math.min(bj + B, ny);
      for (let bi = 0; bi < nx; bi += B) {
        const ie = Math.min(bi + B, nx);
        const cx = bmin[0] + (bi + B * 0.5) * h, cy = bmin[1] + (bj + B * 0.5) * h, cz = bmin[2] + (bk + B * 0.5) * h;
        const dc = f(cx, cy, cz);
        if (Math.abs(dc) > thr) {
          for (let k = bk; k < ke; k++) for (let j = bj; j < je; j++) {
            const row = (k - k0) * nx * ny + j * nx;
            for (let i = bi; i < ie; i++) out[row + i] = dc;
          }
        } else {
          for (let k = bk; k < ke; k++) {
            const z = bmin[2] + k * h;
            for (let j = bj; j < je; j++) {
              const y = bmin[1] + j * h;
              const row = (k - k0) * nx * ny + j * nx;
              for (let i = bi; i < ie; i++) out[row + i] = f(bmin[0] + i * h, y, z);
            }
          }
        }
      }
    }
  }
  return out;
}

export function refineVerts({ shape, params, pos, h, newton = 1, aoDist = 0.05 }) {
  const S = getShape(shape, params);
  const f = S.f;
  const n = pos.length / 3;
  const nrm = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const e = h * 0.35;
  const g = [0, 0, 0];
  const grad = (x, y, z) => {
    const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
    g[0] = a - b - c + d; g[1] = -a - b + c + d; g[2] = -a + b - c + d;
  };
  for (let v = 0; v < n; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const x0 = x, y0 = y, z0 = z;
    for (let it = 0; it < newton; it++) {
      const d = f(x, y, z);
      grad(x, y, z);
      const gl2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
      if (gl2 < 1e-20) break;
      const s = d * (4 * e) / gl2; // grad estimate is scaled by 4e
      x -= g[0] * s; y -= g[1] * s; z -= g[2] * s;
    }
    // clamp displacement to one cell
    let dx = x - x0, dy = y - y0, dz = z - z0;
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dl > h) { const s = h / dl; x = x0 + dx * s; y = y0 + dy * s; z = z0 + dz * s; }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    grad(x, y, z);
    let gl = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
    const nx = g[0] / gl, ny = g[1] / gl, nz = g[2] / gl;
    nrm[v * 3] = nx; nrm[v * 3 + 1] = ny; nrm[v * 3 + 2] = nz;
    // ambient occlusion along the normal (IQ style), cavity measure
    let occ = 0, w = 1;
    for (let i = 1; i <= 5; i++) {
      const t = aoDist * i / 5;
      const dd = f(x + nx * t, y + ny * t, z + nz * t);
      occ += (t - dd) * w; w *= 0.6;
    }
    const ao = Math.max(0, Math.min(1, 1 - occ * 3.2 / aoDist));
    col[v * 3] = ao;
    if (S.region) { const r = S.region(x, y, z); col[v * 3 + 1] = r[0]; col[v * 3 + 2] = r[1]; }
    else { col[v * 3 + 1] = 0; col[v * 3 + 2] = 0; }
  }
  return { pos, nrm, col };
}

function runInline(msg) {
  if (msg.op === 'grid') return { vals: gridSlab(msg) };
  if (msg.op === 'refine') return refineVerts(msg);
  return null;
}

// ---- main entry --------------------------------------------------------------
// returns THREE.BufferGeometry (indexed) with position, normal, color(ao, region0, region1)
export async function meshSDF(THREE, shape, params, bmin, bmax, h, { band = 2.0, newton = 1, aoDist = 0.05, cached = false } = {}) {
  if(cached) {
    const key=sdfKey(shape,params,bmin,bmax,h,{band,newton,aoDist});
    try {
      const response=await fetch(`${import.meta.env.BASE_URL}generated/sdf/${key}.bin`,{signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const geometry=decodeSDF(THREE,await response.arrayBuffer());
      console.log('[cache] sdf hit',key);return geometry;
    }catch(error){console.warn('[cache] SDF unavailable; generating locally:',error.message);}
  }
  const t0 = performance.now();
  const P = pool();
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
  const sxy = nx * ny;
  const V = new Float32Array(sxy * nz);
  // ---- phase 1: grid values in z slabs
  const nSlabs = Math.max(1, Math.min(nz, (P.size || 1) * 3));
  const per = Math.ceil(nz / nSlabs / 4) * 4;
  const jobs = [];
  for (let k0 = 0; k0 < nz; k0 += per) {
    const k1 = Math.min(nz, k0 + per);
    jobs.push(P.run({ op: 'grid', shape, params, bmin, h, nx, ny, k0, k1, band }).then((r) => V.set(r.vals, k0 * sxy)));
  }
  await Promise.all(jobs);
  const t1 = performance.now();

  // ---- phase 2: surface nets
  const cell = new Int32Array(sxy * nz).fill(-1);
  const pos = [];
  const off = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1];
  const cb = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const idx = i + j * nx + k * sxy;
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = V[idx + off[c]]; val[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (let q = 0; q < 12; q++) {
      const a = E[q][0], b = E[q][1];
      const va = val[a], vb = val[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += cb[a][0] + (cb[b][0] - cb[a][0]) * t;
      sy += cb[a][1] + (cb[b][1] - cb[a][1]) * t;
      sz += cb[a][2] + (cb[b][2] - cb[a][2]) * t;
      cnt++;
    }
    cell[idx] = pos.length / 3;
    pos.push(bmin[0] + (i + sx / cnt) * h, bmin[1] + (j + sy / cnt) * h, bmin[2] + (k + sz / cnt) * h);
  }
  const idxs = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    idxs.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = i + j * nx + k * sxy;
    const inside = V[idx] < 0;
    // x edge
    if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
      if (inside !== (V[idx + 1] < 0)) quad(cell[idx - nx - sxy], cell[idx - sxy], cell[idx], cell[idx - nx], !inside);
    }
    if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
      if (inside !== (V[idx + nx] < 0)) quad(cell[idx - 1 - sxy], cell[idx - 1], cell[idx], cell[idx - sxy], !inside);
    }
    if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
      if (inside !== (V[idx + sxy] < 0)) quad(cell[idx - 1 - nx], cell[idx - nx], cell[idx], cell[idx - 1], !inside);
    }
  }
  const t2 = performance.now();

  // ---- phase 3: refine vertices in parallel
  const nv = pos.length / 3;
  const P3 = new Float32Array(pos);
  const N3 = new Float32Array(nv * 3), C3 = new Float32Array(nv * 3);
  const chunks = Math.max(1, (P.size || 1) * 2);
  const cs = Math.ceil(nv / chunks);
  const rj = [];
  for (let s = 0; s < nv; s += cs) {
    const e = Math.min(nv, s + cs);
    const sub = P3.slice(s * 3, e * 3);
    rj.push(P.run({ op: 'refine', shape, params, pos: sub, h, newton, aoDist }, [sub.buffer]).then((r) => {
      P3.set(r.pos, s * 3); N3.set(r.nrm, s * 3); C3.set(r.col, s * 3);
    }));
  }
  await Promise.all(rj);
  // fix winding against the normals (robust regardless of quad orientation)
  const I = nv > 65535 ? new Uint32Array(idxs) : new Uint16Array(idxs);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P3[b] - P3[a], uy = P3[b + 1] - P3[a + 1], uz = P3[b + 2] - P3[a + 2];
    const vx = P3[c] - P3[a], vy = P3[c + 1] - P3[a + 1], vz = P3[c + 2] - P3[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nn = (N3[a] + N3[b] + N3[c]) * fx + (N3[a + 1] + N3[b + 1] + N3[c + 1]) * fy + (N3[a + 2] + N3[b + 2] + N3[c + 2]) * fz;
    if (nn < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P3, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N3, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C3, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  const t3 = performance.now();
  console.log(`[interior] sdf ${shape}: grid ${nx}x${ny}x${nz} ${(t1 - t0).toFixed(0)}ms, nets ${(t2 - t1).toFixed(0)}ms, refine ${(t3 - t2).toFixed(0)}ms, ${nv} verts ${I.length / 3} tris`);
  return geo;
}

// Find surface points: march from `from` along dir until the sign flips, bisection.
export function surfacePoint(f, ox, oy, oz, dx, dy, dz, tMax = 1, steps = 64) {
  let tPrev = 0, dPrev = f(ox, oy, oz);
  for (let s = 1; s <= steps; s++) {
    const t = (tMax * s) / steps;
    const d = f(ox + dx * t, oy + dy * t, oz + dz * t);
    if ((d < 0) !== (dPrev < 0)) {
      let a = tPrev, b = t, da = dPrev;
      for (let it = 0; it < 20; it++) {
        const m = (a + b) * 0.5;
        const dm = f(ox + dx * m, oy + dy * m, oz + dz * m);
        if ((dm < 0) === (da < 0)) { a = m; da = dm; } else b = m;
      }
      const t2 = (a + b) * 0.5;
      return [ox + dx * t2, oy + dy * t2, oz + dz * t2];
    }
    tPrev = t; dPrev = d;
  }
  return null;
}
export function sdfNormal(f, x, y, z, e = 0.002) {
  const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
