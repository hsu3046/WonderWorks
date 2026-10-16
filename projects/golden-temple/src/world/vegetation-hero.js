// ---------------------------------------------------------------------------
// VEGETATION — macro hero spray (finale opening, shot 9).
// A single Acer palmatum shoot system built for a 0.5-1 m camera distance:
// red twigs with lenticel bark, opposite leaf pairs on real petiole tubes,
// pleated / cupped 3D blades (subdivided cards carrying the dedicated macro leaf atlas:
// deeply cut serrate lobes, primary / secondary / veinlet network, margin band, spots),
// hanging samara clusters on long peduncles. The leaves also become analytic
// sun occluders for each other (exact leaf-shaped shadows filtered through the
// red blade), which a 4k shadow map spread over the whole precinct cannot give.
// Everything is laid out in the camera frame of the opening key, so the
// composition is designed, not found.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { makeBranch, arcCurve, sampleBranch, perpOf } from './vegetation-tree.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const LEAF_O = 0.44, LEAF_R = 0.43; // blade attachment point / lobe radius in card units (atlas MAPLE_LEAF)
const LOBES = [0, 39, -39, 79, -79, 118, -118].map((d) => (d * Math.PI) / 180);

// Pleated, cupped leaf card: x in [-0.5, 0.5], y in [0, 1] (petiole end at y = 0), face +Z.
// Each lobe folds up along its midrib (palmate pleats), the blade cups and the lobe tips droop.
export function heroLeafGeo(nx = 22, ny = 22) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = i / nx - 0.5, y = j / ny;
      const dx = x, dy = y - LEAF_O;
      const r = Math.min(1.25, Math.hypot(dx, dy) / LEAF_R);
      const th = Math.atan2(dx, dy);
      let dmin = 9;
      for (const a of LOBES) { let d = Math.abs(th - a); if (d > Math.PI) d = 2 * Math.PI - d; dmin = Math.min(dmin, d); }
      const u = Math.min(1, dmin / 0.34);
      let z = 0.055 * Math.min(r, 1) * Math.pow(u, 1.4);     // pleats (rise toward the sinuses)
      z += 0.07 * r * r;                                       // cup
      z -= 0.1 * Math.pow(Math.max(0, r - 0.55), 2) * 2.2;     // tips roll back down
      if (y < LEAF_O - 0.1) z *= Math.max(0, (y - 0.2) / (LEAF_O - 0.3)); // flat petiole zone
      pos.push(x, y, z);
      uv.push((x + 0.5) * 0.5, (1 - y) * 0.5);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Samara card: hangs from its pivot (y = 0) down to y = -1; single texture (no atlas cells).
export function samaraGeo() {
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], nrm = [], idx = [];
  const nx = 4, ny = 4;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = i / nx - 0.5, y = -j / ny;
      const z = 0.06 * (x * x * 4) - 0.03; // wings slightly propeller-twisted / cupped
      pos.push(x, y, z + 0.04 * x * (j / ny));
      uv.push(x + 0.5, -y);
      nrm.push(0, 0, 1);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}


// Build the spray. cam/look: opening key; focus: distance of the sharp plane (m).
// Returns { branches (bark), leaves:[{X,Y,Z,p,cell,col,acc,flex}] (sorted: sharpest first),
//           samaras:[...], flexAt(pd) }
export function buildHeroSpray(rng, { cam, look, focus = 0.62, anchor = null, sun, flexBase = 0.12 }) {
  const C = V3(...cam);
  const D = V3(...look).sub(C).normalize();
  const Rt = V3().crossVectors(D, UP).normalize();
  const Up = V3().crossVectors(Rt, D).normalize();
  const L = (x, y, z) => C.clone().addScaledVector(Rt, x).addScaledVector(Up, y).addScaledVector(D, z);
  const branches = [], leaves = [], samaras = [];
  const f = focus;
  void sun;
  const flexAt = (pd) => flexBase + 0.1 * Math.min(1, pd / 1.5); // calm macro: small sway, no flutter

  // a shoot through local control points; zig-zags a little at each node (sympodial maple twig)
  const shoot = (ctrl, r0, r1, pd0, anchorPt = null) => {
    const pts = ctrl.map((c) => L(...c));
    if (anchorPt) pts[0] = anchorPt;
    const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const n = Math.max(4, Math.ceil(cv.getLength() / 0.012));
    const sp = cv.getSpacedPoints(n);
    // node kinks
    for (let i = 1; i < sp.length - 1; i++) {
      const k = Math.sin(i * 0.9 + rng.next() * 0.3) * 0.0025;
      sp[i].addScaledVector(Up, k).addScaledVector(Rt, k * 0.5);
    }
    const br = makeBranch({ pts: sp, rads: sp.map((_, i) => r1 + (r0 - r1) * Math.pow(1 - i / (sp.length - 1), 0.9)) }, 3, pd0);
    branches.push(br);
    return br;
  };

  // ---- leaves ---------------------------------------------------------------
  // per-leaf palette (linear): crimson .. scarlet .. orange-red
  const PAL = [[0.3, 0.008, 0.008], [0.4, 0.016, 0.01], [0.24, 0.005, 0.01], [0.44, 0.04, 0.01], [0.36, 0.012, 0.016], [0.48, 0.07, 0.008], [0.42, 0.028, 0.006], [0.5, 0.12, 0.01]];
  const placed = [];
  const addLeaf = (node, dir0, size, opts = {}) => {
    // try a few petiole directions (rotating about the twig) to avoid blade collisions
    for (let attempt = 0; attempt < 5; attempt++) {
      const dir = dir0.clone();
      if (attempt) dir.applyAxisAngle(node.T, (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 0.5).normalize();
      const pl = size * (opts.pl ?? (0.3 + rng.next() * 0.16));
      const pEnd = node.p.clone().addScaledVector(dir, pl);
      pEnd.y -= pl * 0.15;
      // blade axis continues the petiole, drooping under its weight
      const Y = dir.clone(); Y.y -= 0.25 + rng.next() * 0.3; Y.normalize();
      const Oc = pEnd.clone().addScaledVector(Y, size * 0.12); // blade centre (lobes radiate from O)
      if (placed.some((q) => q.c.distanceTo(Oc) < (opts.sep ?? 0.42) * (size + q.s))) continue;
      placed.push({ c: Oc, s: size });
      const pc = arcCurve(rng, node.p, pEnd, 0.00105, 0.0008, { lift: 0.08, sag: 0.04, wander: 0.04, seg: 0.008, nc: 1 });
      const pet = makeBranch(pc, 4, node.pd);
      branches.push(pet);
      const toCam = C.clone().sub(pEnd).normalize();
      const wc = opts.faceCam ?? rng.range(0.45, 1.0);
      const Zh = toCam.multiplyScalar(wc).addScaledVector(UP, rng.range(0.3, 0.75)).add(V3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).multiplyScalar(opts.scatter ?? 0.3));
      const Z = Zh.addScaledVector(Y, -Zh.dot(Y)).normalize();
      const X = V3().crossVectors(Y, Z).normalize();
      // card origin so that the blade attachment point (y = LEAF_O) sits on the petiole end
      const p = pEnd.clone().addScaledVector(Y, -LEAF_O * size);
      const zf = rng.range(0.6, 1.4);
      const c = opts.col || PAL[Math.floor(rng.next() * PAL.length)];
      const v = rng.range(0.85, 1.12);
      // flush around the petiole: mostly amber-orange, a few leaves still green-gold at heart (negative)
      const acc = rng.chance(0.14) ? -rng.range(0.5, 0.9) : rng.range(0.1, 0.75);
      const depth = Oc.clone().sub(C).dot(D);
      leaves.push({ X: X.multiplyScalar(size), Y: Y.multiplyScalar(size), Z: Z.multiplyScalar(size * zf), p, cell: opts.cell ?? rng.int(0, 3), col: [c[0] * v, c[1] * v, c[2] * v], acc, flex: flexAt(pet.pd[pet.pd.length - 1]), sharp: Math.abs(depth - f) });
      return true;
    }
    return false;
  };
  const samaraCluster = (node, n) => {
    const H = V3().crossVectors(node.T, D).normalize();
    for (let q = 0; q < n; q++) {
      const pdl = rng.range(0.045, 0.075);
      const d2 = H.clone().multiplyScalar(rng.range(-0.45, 0.45)).addScaledVector(D, rng.range(-0.3, 0.2)).addScaledVector(UP, -1).normalize();
      const e = node.p.clone().addScaledVector(d2, pdl);
      const pc = arcCurve(rng, node.p, e, 0.0009, 0.0007, { lift: 0.18, wander: 0.08, seg: 0.008, nc: 1 });
      const ped = makeBranch(pc, 4, node.pd);
      branches.push(ped);
      const Zh = C.clone().sub(e).normalize().add(V3(rng.range(-0.6, 0.6), 0, rng.range(-0.6, 0.6)));
      Zh.y = 0;
      const Z = Zh.normalize();
      const X0 = V3().crossVectors(UP, Z).normalize();
      const roll = rng.range(-0.38, 0.38);
      const Yd = UP.clone().multiplyScalar(Math.cos(roll)).addScaledVector(X0, Math.sin(roll));
      const X = V3().crossVectors(Yd, Z).normalize();
      const s = rng.range(0.036, 0.044);
      const tint = rng.chance(0.6) ? [0.44, 0.03, 0.016] : [0.4, 0.075, 0.025];
      samaras.push({ X: X.multiplyScalar(s), Y: Yd.multiplyScalar(s), Z: Z.multiplyScalar(s), p: e, col: tint, acc: 0.25, flex: flexAt(ped.pd[ped.pd.length - 1]) });
    }
  };
  // leaves along a shoot: decussate pairs every 5-8 cm, crowded toward the tip; terminal fan
  const dress = (br, { size = 0.09, from = 0.0, sam = [], tipFan = 3, faceCam, gap = 0.05, sep } = {}) => {
    const len = br.pd[br.pd.length - 1] - br.pd[0];
    let k = 0;
    for (let s = len - 0.012; s > len * from; s -= (gap + rng.next() * gap * 0.6) * (k < 2 ? 0.8 : 1.0), k++) {
      const t = s / len;
      const sb = sampleBranch(br, t);
      const node = { p: sb.p, pd: sb.pd, T: sb.T };
      const H = V3().crossVectors(sb.T, D);
      if (H.lengthSq() < 1e-6) H.copy(perpOf(sb.T));
      H.normalize();
      const sz = size * (k === 0 ? 0.72 : k === 1 ? 0.86 : 1.0) * rng.range(0.9, 1.1);
      if (k === 0) {
        // terminal fan: young leaves spread around the shoot tip
        for (let j = 0; j < tipFan; j++) {
          const a = ((j / Math.max(1, tipFan - 1)) - 0.5) * (tipFan > 3 ? 3.0 : 2.4);
          const dir = sb.T.clone().multiplyScalar(Math.cos(a)).addScaledVector(H, Math.sin(a)).addScaledVector(UP, -0.1).normalize();
          addLeaf(node, dir, sz * (j === Math.floor(tipFan / 2) ? 1.0 : 0.88), { faceCam, sep });
        }
        continue;
      }
      const rot = k % 2;
      for (const side of [-1, 1]) {
        if (rng.chance(0.06)) continue;
        const dir = (rot ? D.clone().multiplyScalar(side * 0.75).addScaledVector(H, rng.range(-0.4, 0.4)) : H.clone().multiplyScalar(side))
          .addScaledVector(sb.T, 0.45).addScaledVector(UP, rng.range(-0.25, 0.1)).normalize();
        addLeaf(node, dir, sz, { faceCam, sep });
      }
      if (sam.includes(k)) samaraCluster(node, 3);
    }
  };

  // ---- skeleton -----------------------------------------------------------
  // main shoot: from the momiji limb (upper left, behind the focal plane) arcing across the frame
  const want = L(-0.95, 0.55, f + 1.3);
  const A0 = typeof anchor === 'function' ? anchor(want) : anchor ? anchor.clone() : want;
  const main = shoot([[-0.95, 0.55, f + 1.3], [-0.5, 0.25, f + 0.45], [-0.24, 0.12, f + 0.1], [-0.08, 0.07, f + 0.01], [0.04, 0.035, f - 0.01], [0.1, 0.005, f - 0.02]], 0.0065, 0.0022, 0, A0);
  dress(main, { size: 0.09, from: 0.3, sam: [2, 5], tipFan: 5, gap: 0.038, sep: 0.36 });
  // lower shoot from the left: a cluster below the main shoot, slightly behind it
  {
    const sb = sampleBranch(main, 0.42);
    const b = shoot([[0, 0, 0], [-0.3, -0.08, f + 0.28], [-0.14, -0.1, f + 0.08], [-0.03, -0.095, f + 0.02]], 0.0034, 0.0016, sb.pd, sb.p);
    dress(b, { size: 0.088, from: 0.3, sam: [3], tipFan: 3 });
  }
  // right shoot hanging in from the upper right (fills the right third, a touch behind focus)
  {
    const b = shoot([[0.62, 0.3, f + 0.4], [0.36, 0.15, f + 0.12], [0.22, 0.09, f + 0.03], [0.16, 0.07, f + 0.01]], 0.0042, 0.0017, 1.1);
    dress(b, { size: 0.085, from: 0.1, tipFan: 4, gap: 0.04, sep: 0.38 });
  }
  // a second shoot well behind (depth ~ f + 0.5 .. 1.0): soft glowing shapes in the background
  {
    const b = shoot([[0.8, 0.5, f + 1.3], [0.3, 0.22, f + 0.75], [0.05, 0.12, f + 0.55], [-0.12, 0.13, f + 0.48]], 0.004, 0.002, 1.0);
    dress(b, { size: 0.1, from: 0.0, tipFan: 3, faceCam: 0.7 });
  }
  {
    const b = shoot([[-0.7, -0.1, f + 1.4], [-0.35, -0.2, f + 0.9], [-0.12, -0.24, f + 0.7]], 0.004, 0.002, 1.3);
    dress(b, { size: 0.1, from: 0.0, tipFan: 2, faceCam: 0.7 });
  }
  // two blurred foreground leaves at the bottom-right edge (depth ~0.32 m): depth and framing
  {
    const b = shoot([[0.4, -0.3, f - 0.02], [0.22, -0.16, f - 0.22], [0.13, -0.1, f - 0.3]], 0.0025, 0.0015, 1.2);
    const e = sampleBranch(b, 1), m = sampleBranch(b, 0.55);
    addLeaf({ p: e.p, pd: e.pd, T: e.T }, e.T.clone().addScaledVector(UP, 0.1).normalize(), 0.085, { faceCam: 1.0, scatter: 0.2 });
    addLeaf({ p: m.p, pd: m.pd, T: m.T }, V3().crossVectors(m.T, D).normalize().addScaledVector(UP, -0.3).normalize(), 0.08, { faceCam: 1.0, scatter: 0.2 });
  }
  // sharpest leaves first: they are the analytic occluders (uniform array is capped)
  leaves.sort((a, b) => a.sharp - b.sharp);
  return { branches, leaves, samaras, flexAt };
}
