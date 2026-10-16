// ---------------------------------------------------------------------------
// props-plaza.js — jōkōro (bronze incense burner with roof), tsukubai
// (stone water basin with bamboo spout & ladle) and stepping stones.
// Builders return Acc's per material in LOCAL coords (origin on the ground).
// Stone tag = [pattern, glowRecv, mossBias, fireY|-100-dark]; metal tag = [pat, type, swing, pivot]
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { Acc, polyStack, petalBand, lathe, roofCap, taperTube, scrollPoints, basis, mat4, fbm3, fixOutward, TAU, lerp } from './props-geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const ST = (pat, moss, dark = 0) => [pat, 0, moss, -100 - dark * 10];
const BR = [0, 0, 0, 0], GD = [0, 1, 0, 0], BLK = [0, 3, 0, 0], INC = [0, 4, 0, 0];

// Natural rock: noisy icosphere, optional flat top/bottom. Returns indexed BufferGeometry.
export function rockGeo(seed, { sx = 1, sy = 1, sz = 1, detail = 3, rough = 0.2, flatTop = null, flatBottom = -0.55, topNoise = 0.012 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = 1 + rough * fbm3(x * 1.3 + seed, y * 1.3, z * 1.3, 3, seed | 0) + rough * 0.3 * fbm3(x * 4 + seed, y * 4, z * 4, 2, (seed | 0) + 5);
    x *= r * sx; y *= r * sy; z *= r * sz;
    if (flatTop !== null && y > flatTop * sy) y = flatTop * sy + (y - flatTop * sy) * 0.08 + topNoise * fbm3(x * 6, 0, z * 6, 2, (seed | 0) + 9);
    if (y < flatBottom * sy) y = flatBottom * sy;
    p.setXYZ(i, x, y - flatBottom * sy, z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// JŌKŌRO — local origin at the ground centre, front +Z. ~2.3 m tall.
// ---------------------------------------------------------------------------
export function buildJokoro(rng) {
  const S = new Acc(), Mt = new Acc(), Ash = new Acc(), Glow = new Acc();
  // granite base: two steps + drum
  polyStack(S, { n: 4, rot: Math.PI / 2, rc: 0.02, sideSeg: 4, profile: [
    { a: 0.72, y: 0.0, tag: ST(0, 0.5), sub: 2 }, { a: 0.72, y: 0.13 }, { a: 0.705, y: 0.145, tag: ST(0, 0.8) }, { a: 0.6, y: 0.145, tag: ST(1, 0.45), sub: 2 },
    { a: 0.6, y: 0.29 }, { a: 0.585, y: 0.305, tag: ST(0, 0.7) }, { a: 0.4, y: 0.305 },
  ] });
  lathe(S, [[0.0, 0.3], [0.46, 0.3], [0.47, 0.315], [0.47, 0.35], [0.455, 0.36], [0.44, 0.36], [0.0, 0.362]], 40, ST(3, 0.4));
  // legs (cabriole) with paw feet
  const y0 = 0.36;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 2;
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const P = (r, y) => new THREE.Vector3(d.x * r, y, d.z * r);
    taperTube(Mt, [P(0.36, y0 + 0.04), P(0.39, y0 + 0.1), P(0.37, y0 + 0.17), P(0.33, y0 + 0.24), P(0.31, y0 + 0.3)], (t) => 0.038 - 0.012 * Math.sin(Math.PI * t), { radial: 10, segs: 14, tag: BR });
    Mt.addGeo(new THREE.SphereGeometry(0.05, 12, 8), mat4([d.x * 0.37, y0 + 0.035, d.z * 0.37], [0, 0, 0], [1, 0.7, 1]), BR);
    for (let c = -1; c <= 1; c++) { const q = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(c * 0.026); Mt.addGeo(new THREE.SphereGeometry(0.017, 8, 6), mat4([d.x * 0.405 + q.x, y0 + 0.02, d.z * 0.405 + q.z]), GD); }
    // lion mask boss at the knee
    Mt.addGeo(new THREE.SphereGeometry(0.055, 14, 10), mat4([d.x * 0.38, y0 + 0.22, d.z * 0.38], [0, -a, 0], [0.6, 1, 1]), GD);
  }
  // bowl (outer -> rim -> inner)
  const yb = y0 + 0.24;
  lathe(Mt, [[0.0, yb], [0.2, yb], [0.34, yb + 0.03], [0.44, yb + 0.1], [0.5, yb + 0.2], [0.515, yb + 0.3], [0.5, yb + 0.38], [0.465, yb + 0.43],
    [0.46, yb + 0.455], [0.5, yb + 0.47], [0.535, yb + 0.485], [0.54, yb + 0.505], [0.52, yb + 0.515], [0.48, yb + 0.51], [0.45, yb + 0.48], [0.43, yb + 0.43], [0.0, yb + 0.43]], 56, BR);
  // lotus petal skirt on the lower belly (gilt edges via bands)
  petalBand(Mt, { profile: [[0.21, yb + 0.004], [0.33, yb + 0.032], [0.43, yb + 0.09], [0.49, yb + 0.17], [0.508, yb + 0.23]], N: 16, depth: 0.028, dir: 1, tipCurl: 0.008, seg: 160, rows: 12, tag: BR });
  for (const [r, y, w] of [[0.515, yb + 0.3, 0.008], [0.468, yb + 0.44, 0.007]]) Mt.addGeo(new THREE.TorusGeometry(r, w, 6, 64), mat4([0, y, 0], [Math.PI / 2, 0, 0]), GD);
  // ring handles from lion bosses (±X)
  for (const sx of [-1, 1]) {
    Mt.addGeo(new THREE.SphereGeometry(0.06, 14, 10), mat4([sx * 0.5, yb + 0.33, 0], [0, 0, 0], [0.45, 1, 1]), GD);
    Mt.addGeo(new THREE.TorusGeometry(0.075, 0.012, 8, 28), mat4([sx * 0.545, yb + 0.26, 0], [0, Math.PI / 2, 0]), GD);
  }
  // ash mound + incense
  lathe(Ash, [[0.452, yb + 0.43], [0.4, yb + 0.44], [0.25, yb + 0.455], [0.0, yb + 0.46]].reverse(), 40, BR);
  const yAsh = yb + 0.452;
  for (let i = 0; i < 34; i++) {
    const cl = i % 3;
    const ca = cl * 2.1 + 0.4, cr = 0.12 + 0.06 * (cl === 1 ? 1 : 0);
    const r = cr + rng.range(-0.05, 0.05), a = ca + rng.range(-0.4, 0.4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const len = rng.range(0.1, 0.22), tx = rng.range(-0.18, 0.18), tz = rng.range(-0.18, 0.18);
    const m = mat4([x, yAsh + len / 2 - 0.02, z], [tx, 0, tz]);
    Mt.addGeo(new THREE.CylinderGeometry(0.0024, 0.0028, len, 5, 1), m, INC);
    const tip = new THREE.Vector3(0, len / 2 - 0.004, 0).applyMatrix4(m);
    Glow.addGeo(new THREE.CylinderGeometry(0.0028, 0.0028, 0.01, 5, 1), mat4([tip.x, tip.y, tip.z], [tx, 0, tz]), [0, 0, 0, 0]);
  }
  // four corner posts carrying the roof
  const yR = yb + 0.5, yTopPost = 1.74;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * TAU) / 4;
    const x = Math.cos(a) * 0.47, z = Math.sin(a) * 0.47;
    polyStack(Mt, { n: 4, rot: -a, rc: 0.005, sideSeg: 1, tag: BR, m: mat4([x, 0, z]), profile: [
      { a: 0.0, y: yR - 0.02 }, { a: 0.054, y: yR - 0.02, tag: GD }, { a: 0.054, y: yR + 0.06, tag: BR }, { a: 0.041, y: yR + 0.078 }, { a: 0.038, y: yTopPost - 0.09, tag: GD }, { a: 0.052, y: yTopPost - 0.072 }, { a: 0.052, y: yTopPost },
    ] });
  }
  // frieze beam ring + roof
  polyStack(Mt, { n: 4, rot: Math.PI / 2, rc: 0.006, sideSeg: 2, profile: [
    { a: 0.0, y: yTopPost - 0.01, tag: BR }, { a: 0.37, y: yTopPost - 0.01, tag: GD }, { a: 0.37, y: yTopPost + 0.005, tag: BR }, { a: 0.35, y: yTopPost + 0.012 }, { a: 0.35, y: yTopPost + 0.075, tag: GD }, { a: 0.38, y: yTopPost + 0.085, tag: BR }, { a: 0.38, y: yTopPost + 0.1 },
  ] });
  const yE = yTopPost + 0.1 + 0.062; // heavier cast roof edge (reads as bronze, not sheet metal)
  const roof = roofCap(Mt, { n: 4, rot: Math.PI / 2, A: 0.78, knobA: 0.08, yEave: yE, H: 0.34, thick: 0.066, lift: 0.12, soffitA: 0.37, segS: 18, segT: 14,
    rise: (t) => Math.pow(1 - t, 1.5), ridge: { h: 0.012, w: 0.016 }, tagTop: BR, tagEdge: GD, tagBottom: BR });
  const cornerBells = [];
  for (let k = 0; k < 4; k++) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const p = roof.hipPoint(k, 0.06 + 0.86 * (i / 10)); p.y += 0.006; pts.push(p); }
    taperTube(Mt, pts, (t) => 0.014 - 0.004 * t, { radial: 7, segs: 16, tag: GD });
    const c = roof.corner(k);
    const st = roof.hipPoint(k, 0.9); st.y -= 0.008;
    taperTube(Mt, scrollPoints(st, c.dir, 0.042, 1.0, 0.4, 18), (t) => 0.016 - 0.008 * t, { radial: 8, segs: 20, tag: GD });
    cornerBells.push({ pos: [c.x * 0.97, c.y - 0.06, c.z * 0.97], scale: 0.55, rotY: 0 });
  }
  const yK = yE + 0.34;
  lathe(Mt, [[0.0, yK - 0.02], [0.08, yK - 0.02], [0.085, yK + 0.0], [0.07, yK + 0.02], [0.0, yK + 0.024]], 24, GD);
  petalBand(Mt, { profile: [[0.04, yK + 0.015], [0.06, yK + 0.025], [0.085, yK + 0.05], [0.092, yK + 0.07]], N: 8, depth: 0.009, dir: 1, tipCurl: 0.004, seg: 72, rows: 8, tag: GD });
  lathe(Mt, [[0.0, yK + 0.045], [0.055, yK + 0.05], [0.07, yK + 0.075], [0.072, yK + 0.1], [0.06, yK + 0.13], [0.035, yK + 0.16], [0.012, yK + 0.185], [0.0, yK + 0.195]], 28, GD);
  S.jitter(0, S.n, 0.004, 3, 77);
  return { stone: S, metal: Mt, ash: Ash, glow: Glow, cornerBells, smokeY: yAsh + 0.02, height: yK + 0.195 };
}

// smoke ribbons (local, rising from the ash). aRel = (u, h, seed, 0)
export function smokeGeo(n = 5, height = 1.15, width = 0.42) {
  const P = [], R = [], I = [];
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI;
    const ox = Math.cos(k * 2.3) * 0.08, oz = Math.sin(k * 1.7) * 0.08;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const rows = 28, base = P.length / 3;
    for (let j = 0; j <= rows; j++) {
      const h = j / rows;
      for (let s = 0; s <= 1; s++) {
        const u = s;
        const w = width * (0.25 + 0.75 * h);
        P.push(ox + dx * (u - 0.5) * w, h * height, oz + dz * (u - 0.5) * w);
        R.push(u, h, k * 1.37 + 0.3, ang);
      }
    }
    for (let j = 0; j < rows; j++) { const a = base + j * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aRel', new THREE.Float32BufferAttribute(R, 4));
  g.setIndex(I);
  g.computeBoundingSphere();
  g.boundingSphere.radius += 1.0;
  return g;
}

// ---------------------------------------------------------------------------
// TSUKUBAI — local origin at the basin centre on the ground, front (+Z) faces the path.
// ---------------------------------------------------------------------------
function bambooTube(B, a, b, r, nodes = [], cutEnd = false) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const dir = Bv.clone().sub(A); const len = dir.length(); dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const mid = A.clone().add(Bv).multiplyScalar(0.5);
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  B.addGeo(new THREE.CylinderGeometry(r, r, len, 14, 1, true), m, [0, 0, 0, 0], (p, n, uv) => [uv[0], (p.y + len / 2), r, len]);
  for (const t of nodes) {
    const p = A.clone().addScaledVector(dir, t * len);
    B.addGeo(new THREE.TorusGeometry(r * 1.0, r * 0.12, 5, 14), new THREE.Matrix4().compose(p, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), new THREE.Vector3(1, 1, 1)), [0, 0, 0, 0]);
  }
  // end caps (node at A, open hollow at B shown as a dark disc slightly inset)
  B.addGeo(new THREE.CircleGeometry(r, 14), new THREE.Matrix4().compose(A, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)), new THREE.Vector3(1, 1, 1)), [0, 0, 0, 0]);
  return { A, B: Bv, dir, len, q };
}

export function buildTsukubai(rng) {
  const S = new Acc(), Bam = new Acc(), Water = new Acc();
  // basin: a hewn round stone with a carved bowl (profile with organic noise)
  const prof = [[0.0, 0.0], [0.32, 0.0], [0.44, 0.05], [0.49, 0.15], [0.49, 0.26], [0.47, 0.34], [0.43, 0.39], [0.35, 0.415], [0.27, 0.42], [0.232, 0.405], [0.222, 0.37], [0.2, 0.335], [0.11, 0.315], [0.0, 0.31]];
  const seg = 72, rows = prof.length - 1;
  const basin = new THREE.BufferGeometry();
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU; const [r0, y] = prof[j];
    const outer = j <= 8 ? 1 : 0.15;
    const nr = r0 * (1 + outer * (0.07 * fbm3(Math.cos(a) * 1.4, y * 2.2, Math.sin(a) * 1.4, 3, 11) + 0.025 * fbm3(Math.cos(a) * 5, y * 6, Math.sin(a) * 5, 2, 12)));
    const ny = y + (j >= 6 && j <= 9 ? 0.012 * fbm3(Math.cos(a) * 3, 1, Math.sin(a) * 3, 2, 13) : 0);
    pos.push(Math.cos(a) * nr, ny, Math.sin(a) * nr);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) {
    const i1 = (i + 1) % seg; const a = j * seg + i, b = j * seg + i1, c = (j + 1) * seg + i1, d = (j + 1) * seg + i;
    idx.push(a, c, b, a, d, c);
  }
  basin.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); basin.setIndex(idx); basin.computeVertexNormals();
  fixOutward(basin);
  S.addGeo(basin, null, (p, n) => ST(0, p.y > 0.4 && Math.hypot(p.x, p.z) > 0.3 ? 0.75 : (p.y < 0.45 && Math.hypot(p.x, p.z) < 0.25 ? 0.15 : 0.5)));
  // water in the bowl
  Water.addGeo(new THREE.CircleGeometry(0.228, 40), mat4([0, 0.39, 0], [-Math.PI / 2, 0, 0]), [0, 0, 0, 0]);
  // kakei: bamboo post behind the basin + horizontal spout
  bambooTube(Bam, [-0.02, 0.0, -0.6], [-0.02, 0.76, -0.6], 0.04, [0.3, 0.62, 0.97]);
  const sp = bambooTube(Bam, [-0.02, 0.64, -0.64], [-0.02, 0.61, -0.15], 0.022, [0.45]);
  bambooTube(Bam, [0.17, 0.0, -0.58], [0.17, 0.52, -0.58], 0.028, [0.4, 0.95]);
  // water stream from the spout
  const s0 = new THREE.Vector3(-0.02, 0.596, -0.14);
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(-0.02, s0.y - t * t * 0.21, s0.z + t * 0.06)); }
  taperTube(Water, pts, (t) => 0.0045 - 0.0015 * t, { radial: 8, segs: 16, capStart: false, capEnd: false });
  // hishaku (ladle) resting across the rim
  const lad = new Acc();
  lad.addGeo(new THREE.CylinderGeometry(0.036, 0.034, 0.065, 16, 1, true), mat4([0, 0, 0]), [0, 1, 0, 0]);
  lad.addGeo(new THREE.CircleGeometry(0.034, 16), mat4([0, -0.032, 0], [Math.PI / 2, 0, 0]), [0, 1, 0, 0]);
  lad.addGeo(new THREE.CylinderGeometry(0.006, 0.007, 0.46, 6, 1), mat4([0.0, -0.005, 0.25], [Math.PI / 2 - 0.05, 0, 0]), [0, 1, 0, 0]);
  Bam.addAcc(lad, mat4([0.17, 0.465, -0.12], [0.05, -0.85, 0.0]));
  // stones: maeishi (front), teshokuishi (left, tall), yuokeishi (right)
  const rk = (seed, o, pos, rot) => S.addGeo(rockGeo(seed, o), mat4(pos, rot), (p) => ST(0, 0.7));
  rk(3.1, { sx: 0.36, sy: 0.12, sz: 0.26, flatTop: 0.4, flatBottom: -0.5, rough: 0.24, detail: 3 }, [0.0, -0.02, 0.72], [0, 0.2, 0]);
  rk(4.7, { sx: 0.21, sy: 0.3, sz: 0.19, flatTop: 0.62, flatBottom: -0.4, rough: 0.3, detail: 3 }, [-0.66, -0.04, 0.12], [0, 0.6, 0.04]);
  rk(5.3, { sx: 0.25, sy: 0.17, sz: 0.2, flatTop: 0.55, flatBottom: -0.45, rough: 0.3, detail: 3 }, [0.68, -0.03, 0.2], [0, -0.4, 0]);
  // pebbles in the "sea" in front of the basin
  for (let i = 0; i < 70; i++) {
    const a = rng.range(-0.2, Math.PI + 0.2), r = rng.range(0.5, 0.9);
    const x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r * 0.75 + 0.05;
    if (Math.hypot(x, z - 0.72) < 0.33 || Math.hypot(x + 0.66, z - 0.12) < 0.24 || Math.hypot(x - 0.68, z - 0.2) < 0.27) continue;
    const s = rng.range(0.025, 0.05);
    S.addGeo(rockGeo(i * 0.37, { sx: s, sy: s * 0.55, sz: s * rng.range(0.7, 1.1), detail: 1, rough: 0.12, flatBottom: -0.3 }), mat4([x, -0.008, z], [0, rng.range(0, 6.28), 0]), ST(0, 0.0, 0.85));
  }
  S.jitter(0, S.n, 0.003, 6, 21);
  return { stone: S, bamboo: Bam, water: Water, drip: [-0.02, 0.39, -0.08] };
}

// Stepping stones: list of {x, z, rot, s}; returns Acc (world coords given ground fn)
export function buildSteppingStones(list, ground) {
  const S = new Acc();
  list.forEach((e, i) => {
    const g = rockGeo(10 + i * 1.91, { sx: 0.3 * e.s, sy: 0.09, sz: 0.24 * e.s, detail: 3, rough: 0.14, flatTop: 0.42, flatBottom: -0.6, topNoise: 0.006 });
    S.addGeo(g, mat4([e.x, ground(e.x, e.z) - 0.05, e.z], [0, e.rot, 0]), ST(0, 0.55));
  });
  return S;
}
