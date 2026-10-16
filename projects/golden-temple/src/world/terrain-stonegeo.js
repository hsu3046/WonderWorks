// ---------------------------------------------------------------------------
// Stone geometry shared by the paving, kerbs, gutters and stepping stones.
// ---------------------------------------------------------------------------
import { smoothstep } from './terrain-field.js';

// Bevelled rectangular stone. Local frame: x across (w), z along (d), top at y=0.
export function slabGeometry(w, d, h, b, rnd, worn, noise) {
  const P = [], S = [], I = [];
  const rows = (len) => {
    const e = [0, 0.1, 0.38, 1.0].map((t) => t * b);
    const a = e.map((v) => -len / 2 + v);
    const inner = Math.max(1, Math.round((len - 2 * b) / 0.24));
    for (let k = 1; k < inner; k++) a.push(-len / 2 + b + (len - 2 * b) * (k / inner));
    for (let k = e.length - 1; k >= 0; k--) a.push(len / 2 - e[k]);
    return a;
  };
  const xs = rows(w), zs = rows(d);
  const nx = xs.length, nz = zs.length;
  const ox = rnd() * 100, oz = rnd() * 100;
  const dish = (rnd() - 0.5) * 0.006;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i], z = zs[j];
      const qx = Math.abs(x) - (w / 2 - b), qz = Math.abs(z) - (d / 2 - b);
      let r;
      if (qx > 0 && qz > 0) r = Math.hypot(qx, qz); else r = Math.max(qx, qz, 0);
      r = Math.min(r, b);
      let y = Math.sqrt(Math.max(b * b - r * r, 0)) - b;
      const edge = r / b;
      // wear: rounded-off arrises, chips along the edges, gentle dish / crown
      const nn = noise(x * 2.3 + ox, z * 2.3 + oz);
      const n2 = noise(x * 9.0 - oz, z * 9.0 + ox);
      y += 0.0025 * nn + 0.0012 * n2;
      y += dish * (1 - (2 * x / w) * (2 * x / w)) * (1 - (2 * z / d) * (2 * z / d));
      const chip = Math.max(0, noise(x * 4.1 + ox * 1.3, z * 4.1 - oz) - 0.35) * worn;
      y -= chip * 0.05 * smoothstep(0.2, 1.0, edge);
      P.push(x, y, z);
      // distance to the stone's outline (m): bevel grime, moss creeping in from the joints, wet rims
      S.push(Math.max(0, Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z))));
    }
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b2 = a + 1, c = a + nx, e = c + 1;
    I.push(a, c, b2, b2, c, e);
  }
  // sides: perimeter ring of the top grid, extruded down
  const ring = [];
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < nz; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((nz - 1) * nx + i);
  for (let j = nz - 2; j >= 1; j--) ring.push(j * nx);
  const base = P.length / 3;
  for (const v of ring) { P.push(P[v * 3], -h, P[v * 3 + 2]); S.push(0); }
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b2 = ring[(k + 1) % ring.length];
    const a2 = base + k, b3 = base + ((k + 1) % ring.length);
    I.push(a, b2, a2, b2, b3, a2);
  }
  return { P, S, I };
}

// Natural stepping stone: noisy rounded outline, domed top.
export function stepStoneGeometry(R, h, rnd, noise) {
  const P = [], S = [], I = [];
  const seg = 16;
  const rings = [0, 0.35, 0.62, 0.82, 0.93, 0.98, 1.0];
  const ph = rnd() * 100;
  const rad = [];
  for (let s = 0; s < seg; s++) {
    const a = (s / seg) * Math.PI * 2;
    rad.push(R * (0.86 + 0.13 * noise(Math.cos(a) * 1.3 + ph, Math.sin(a) * 1.3) + 0.06 * noise(Math.cos(a) * 3.1 - ph, Math.sin(a) * 3.1)) * (1 + 0.18 * Math.cos(2 * a + ph)));
  }
  const b = 0.05;
  P.push(0, 0.012, 0); S.push(R * 0.9);
  for (let k = 1; k < rings.length; k++) {
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const rr = rad[s] * rings[k];
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const e = rad[s] - rr; // distance to rim
      let y = 0.012 * (1 - rings[k] * rings[k]);
      if (e < b) { const r = b - e; y += Math.sqrt(Math.max(b * b - r * r, 0)) - b; }
      y += 0.004 * noise(x * 3 + ph, z * 3);
      P.push(x, y, z); S.push(e);
    }
  }
  for (let s = 0; s < seg; s++) I.push(0, 1 + ((s + 1) % seg), 1 + s);
  for (let k = 1; k < rings.length - 1; k++) for (let s = 0; s < seg; s++) {
    const a = 1 + (k - 1) * seg + s, b2 = 1 + (k - 1) * seg + ((s + 1) % seg);
    const c = a + seg, d = b2 + seg;
    I.push(a, b2, c, b2, d, c);
  }
  const top0 = 1 + (rings.length - 2) * seg;
  const base = P.length / 3;
  for (let s = 0; s < seg; s++) { const v = top0 + s; P.push(P[v * 3] * 1.08, -h, P[v * 3 + 2] * 1.08); S.push(0); }
  for (let s = 0; s < seg; s++) {
    const a = top0 + s, b2 = top0 + ((s + 1) % seg), a2 = base + s, b3 = base + ((s + 1) % seg);
    I.push(a, b2, a2, b2, b3, a2);
  }
  return { P, S, I };
}

