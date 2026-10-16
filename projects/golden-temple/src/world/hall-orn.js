// ---------------------------------------------------------------------------
// hall-orn: ornaments — rosettes (rokuyō), giboshi finials, 5-petal mon crest,
// kaerumata frog-leg struts, gegyo gable pendants, onigawara ridge-end tiles,
// eave tile end discs. All emitted into an Acc in a given local frame X.
// Local frame convention for flat ornaments: the ornament faces local +Z,
// lies in the local XY plane, origin at its centre (or bottom where noted).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { cbox, lathe, extrude, sweep, bar, xf, basis, mul, v3, circlePts, clamp, lerp } from './hall-lib.js';
import { ridge2, scroll, leaf, peony, bead, cloud } from './hall-carve.js';
import { tomoeDisc } from './hall-detail.js';

// Rokuyō / kugikakushi rosette: domed, petal-edged disc facing +Z, radius R.
export function rosette(ms, X, R = 0.12, petals = 6, h = 0.03) {
  ms.begin(X);
  const A = petals * 6, RR = 4;
  const rows = [];
  for (let i = 0; i <= RR; i++) {
    const t = i / RR; const row = [];
    for (let k = 0; k < A; k++) {
      const a = (k / A) * Math.PI * 2;
      const pm = 0.86 + 0.14 * Math.pow(Math.abs(Math.cos((a * petals) / 2)), 0.6);
      const r = R * pm * t;
      // dome: centre boss + petal relief
      const z = h * (0.45 * Math.cos(t * Math.PI * 0.5) + 0.55 * (t < 0.35 ? 1 : Math.max(0, 1 - (t - 0.35) / 0.65) ** 1.5)) + (i === RR ? 0 : 0);
      const dzdr = -h * 2.2 * t;
      const n = v3.norm([Math.cos(a) * -dzdr, Math.sin(a) * -dzdr, 1]);
      row.push(ms.v(r * Math.cos(a), r * Math.sin(a), z, n[0], n[1], n[2]));
    }
    rows.push(row);
  }
  for (let i = 0; i < RR; i++) for (let k = 0; k < A; k++) {
    const k1 = (k + 1) % A;
    if (i === 0) ms.triN(rows[0][k], rows[1][k], rows[1][k1]);
    else ms.quadN(rows[i][k], rows[i][k1], rows[i + 1][k1], rows[i + 1][k]);
  }
  ms.begin(null);
}

// Giboshi (onion finial) standing on local origin, total height H, radius R.
export function giboshi(ms, X, R = 0.12, H = 0.42, seg = 20) {
  const prof = [
    [0, 0], [R * 0.92, 0], [R * 0.92, H * 0.07], [R * 0.78, H * 0.09], [R * 0.78, H * 0.15], [R * 0.9, H * 0.17], [R * 0.9, H * 0.2],
    [R * 0.62, H * 0.24], [R * 0.66, H * 0.3], [R * 0.9, H * 0.38], [R * 1.0, H * 0.48], [R * 0.95, H * 0.58], [R * 0.78, H * 0.68],
    [R * 0.5, H * 0.78], [R * 0.25, H * 0.86], [R * 0.12, H * 0.92], [R * 0.07, H * 0.97], [0, H],
  ];
  lathe(ms, X, prof, seg, { hardDeg: 50 });
}

// Five-petal flower crest (mon) as gold relief: ring + petals + centre.
// Faces +Z, centred, outer radius R, relief depth dz.
export function monCrest(ms, X, R = 0.5, dz = 0.035) {
  // outer ring
  const ringO = circlePts(0, 0, R, 64), ringI = circlePts(0, 0, R * 0.88, 64);
  extrude(ms, X, ringO, [ringI], 0, dz);
  // 5 petals (each a rounded petal outline with a notch at the tip -> sakura-like)
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i / 5) * Math.PI * 2;
    const pts = [];
    const L = R * 0.74, W = R * 0.3;
    const N = 22;
    for (let k = 0; k <= N; k++) {
      const t = k / N; // 0..1 around half outline
      const ang = Math.PI * t;
      // petal outline in petal-local coords (x along length, y across)
      let x = L * 0.5 * (1 - Math.cos(ang)) + R * 0.08, y = W * Math.sin(ang) * (0.75 + 0.25 * Math.sin(ang));
      pts.push([x, y]);
    }
    const outline = [];
    for (const [x, y] of pts) outline.push([x, y]);
    // notch at tip
    outline.splice(outline.length - 1, 1, [L + R * 0.08 - 0.06 * R, 0]);
    for (let k = pts.length - 2; k >= 1; k--) outline.push([pts[k][0], -pts[k][1]]);
    const rot = outline.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    extrude(ms, X, rot, [], 0, dz * 0.9);
    // petal vein (raised line)
    const ca = Math.cos(a), sa = Math.sin(a);
    cbox(ms, mul(X, basis([ca * R * 0.42, sa * R * 0.42, dz * 0.9], [ca, sa, 0], [-sa, ca, 0], [0, 0, 1])), R * 0.2, R * 0.018, dz * 0.25, 0.004);
  }
  // centre: stamen disc
  lathe(ms, mul(X, xf([0, 0, 0], 0, Math.PI / 2)), [[0, -0.001], [R * 0.17, -0.001], [R * 0.17, dz * 1.1], [R * 0.1, dz * 1.4], [0, dz * 1.5]], 24);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    lathe(ms, mul(X, xf([Math.cos(a) * R * 0.24, Math.sin(a) * R * 0.24, 0], 0, Math.PI / 2)), [[0, 0], [R * 0.035, 0], [R * 0.035, dz * 0.9], [0, dz * 1.2]], 8);
  }
}

// Mitsudomoe-ish tile disc crest (small): disc with rim + boss. Disc axis = local +Y.
export function tileDisc(msTile, msGold, X, R = 0.115, th = 0.045, gold = true) {
  tomoeDisc(msTile, gold ? msGold : null, X, R, th);
}

// 2D outline helpers -------------------------------------------------------
function bez(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}

// Kaerumata outline (width W, height H), bottom centre at origin. Returns {outer, hole}.
export function kaerumataShape(W = 0.9, H = 0.46) {
  const w = W / 2;
  const outer = [[-w, 0]];
  // left leg outer edge: flare foot then concave sweep to top block
  outer.push(...bez([-w, 0], [-w * 0.55, H * 0.12], [-w * 0.32, H * 0.55], [-w * 0.2, H * 0.82], 10));
  outer.push([-w * 0.22, H * 0.86], [-w * 0.22, H]);
  outer.push([w * 0.22, H], [w * 0.22, H * 0.86], [w * 0.2, H * 0.82]);
  outer.push(...bez([w * 0.2, H * 0.82], [w * 0.32, H * 0.55], [w * 0.55, H * 0.12], [w, 0], 10));
  outer.push([w * 0.6, 0]);
  // inner edge of right leg up to arch apex and down left leg (part of outer contour: open bottom)
  outer.push(...bez([w * 0.6, 0], [w * 0.52, H * 0.28], [w * 0.32, H * 0.6], [0, H * 0.62], 10));
  outer.push(...bez([0, H * 0.62], [-w * 0.32, H * 0.6], [-w * 0.52, H * 0.28], [-w * 0.6, 0], 10));
  return outer;
}

export function kaerumata(msRed, msGold, X, W = 0.9, H = 0.46, T = 0.16) {
  const sh = kaerumataShape(W, H);
  extrude(msRed, X, sh, [], -T / 2, T / 2);
  // inner carving: gilt peony (petal lobes around a domed centre) with curling leaves
  const g = mul(X, xf([0, H * 0.3, 0]));
  const pr = Math.min(W * 0.11, H * 0.17);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * Math.PI * 2;
    extrude(msGold, g, circlePts(Math.cos(a) * pr * 0.95, Math.sin(a) * pr * 0.95, pr * 0.62, 10), [], -T * 0.22, T * 0.28);
  }
  lathe(msGold, mul(g, xf([0, 0, T * 0.28], 0, Math.PI / 2)), [[0, 0], [pr * 0.7, 0], [pr * 0.6, pr * 0.25], [pr * 0.3, pr * 0.4], [0, pr * 0.45]], 14);
  for (const s of [-1, 1]) {
    const pts = bez([s * pr * 0.9, -pr * 0.9], [s * W * 0.26, -H * 0.3], [s * W * 0.36, -H * 0.02], [s * W * 0.24, H * 0.1], 7);
    const back = bez([s * W * 0.24, H * 0.1], [s * W * 0.22, -H * 0.04], [s * W * 0.14, -H * 0.18], [s * pr * 0.5, -pr * 1.1], 7);
    const loop = [[s * pr * 0.5, -pr * 1.1], ...pts, ...back.slice(0, -1)];
    extrude(msGold, g, s > 0 ? loop : loop.slice().reverse(), [], -T * 0.2, T * 0.2);
  }
  // carved peony leaves fanning out of the flower and curled tendrils at the
  // feet, on both faces (real relief, reads in the eave close-ups)
  for (const zf of [1, -1]) {
    const F = mul(X, xf([0, 0, 0], 0, 0, 0, [1, 1, zf]));
    for (const s of [-1, 1]) {
      leaf(msGold, F, s * pr * 0.7, H * 0.3 - pr * 0.35, s > 0 ? -0.25 : Math.PI + 0.25, W * 0.17, pr * 0.32, T * 0.09, -s * 0.7, T * 0.2);
      leaf(msGold, F, s * pr * 0.55, H * 0.3 + pr * 0.5, s > 0 ? 0.55 : Math.PI - 0.55, W * 0.12, pr * 0.26, T * 0.08, -s * 0.6, T * 0.2);
      scroll(msGold, F, s * W * 0.385, H * 0.12, W * 0.045, s > 0 ? Math.PI : 0, s, 1.1, W * 0.011, T * 0.07, { z0: T / 2 });
    }
  }
  // gold cap on top block
  cbox(msGold, mul(X, xf([0, H + 0.005, 0])), W * 0.24, 0.008, T * 0.55, 0.003);
}

// Gegyo: ornamental pendant under a gable apex (faces +Z), width W, height H.
// Origin at the top centre (apex). Heart/cloud shape with curling wings.
export function gegyo(msGold, msRed, X, W = 1.6, H = 1.3, T = 0.12, msCarve = null) {
  const w = W / 2;
  const right = [];
  right.push(...bez([0, 0], [w * 0.35, -H * 0.02], [w * 0.75, -H * 0.05], [w, -H * 0.18], 8));
  right.push(...bez([w, -H * 0.18], [w * 1.05, -H * 0.38], [w * 0.7, -H * 0.42], [w * 0.62, -H * 0.3], 8));
  right.push(...bez([w * 0.62, -H * 0.3], [w * 0.55, -H * 0.22], [w * 0.4, -H * 0.3], [w * 0.5, -H * 0.45], 6));
  right.push(...bez([w * 0.5, -H * 0.45], [w * 0.6, -H * 0.62], [w * 0.38, -H * 0.8], [w * 0.2, -H * 0.72], 8));
  right.push(...bez([w * 0.2, -H * 0.72], [w * 0.12, -H * 0.82], [w * 0.08, -H * 0.92], [0, -H], 6));
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  const outline = [[0, 0], ...right, ...left];
  // recessed ground plate (keeps the silhouette); the visible gilt is carved
  // relief on top of it: a beaded rim, wing scrolls, stems, leaves and a
  // central peony, so the piece reads as openwork carving, not a flat slab.
  extrude(msGold, X, outline, [], -T / 2, T / 2);
  const mc = msCarve || msGold;
  const z0 = T / 2;
  const sw = Math.max(0.012, W * 0.017);
  const rim = outline.map(([x, y]) => [x * 0.955, (y + H * 0.5) * 0.955 - H * 0.5]);
  rim.push(rim[0], rim[1]);
  ridge2(mc, X, rim, sw * 0.95, sw * 0.9, 5, { z0 });
  for (const Xs of [X, mul(X, xf([0, 0, 0], 0, 0, 0, [-1, 1, 1]))]) {
    // upper wing: big scroll curling inward
    scroll(mc, Xs, w * 0.7, -H * 0.235, Math.min(w * 0.2, H * 0.12), Math.PI * 1.05, -1, 1.35, sw * 1.05, sw, { z0 });
    // stem from the centre flower to the wing scroll
    const st = bez([w * 0.1, -H * 0.36], [w * 0.25, -H * 0.2], [w * 0.38, -H * 0.12], [w * 0.52, -H * 0.2], 10);
    ridge2(mc, Xs, st, (t) => sw * (1 - 0.35 * t), sw * 0.85, 5, { z0 });
    // lower lobe scroll
    scroll(mc, Xs, w * 0.3, -H * 0.62, Math.min(w * 0.13, H * 0.08), Math.PI * 0.1, 1, 1.25, sw * 0.85, sw * 0.85, { z0 });
    // leaves fanning up and out from the flower
    leaf(mc, Xs, w * 0.06, -H * 0.3, Math.PI * 0.42, H * 0.2, W * 0.035, sw * 0.9, -0.5, z0);
    leaf(mc, Xs, w * 0.14, -H * 0.5, -Math.PI * 0.15, H * 0.18, W * 0.03, sw * 0.8, -0.7, z0);
  }
  // centre peony and pendant drop
  peony(mc, mul(X, xf([0, 0, z0])), 0, -H * 0.42, W * 0.12, sw * 1.15, 8);
  bead(mc, X, 0, -H * 0.86, W * 0.045, W * 0.05, 12, z0);
  if (msRed) {
    // red backing plate showing as an outline
    const back = outline.map(([x, y]) => [x * 1.06, y * 1.05 + H * 0.02]);
    extrude(msRed, X, back, [], -T / 2 - 0.03, -T / 2 + 0.01);
  }
}

// Onigawara ridge-end tile. Local: origin at bottom centre of the ridge end,
// faces +Z (outward along the ridge), width W, height H.
export function onigawara(msTile, msGold, X, W = 0.9, H = 1.2, T = 0.22, opts = {}) {
  const w = W / 2;
  // silhouette: wide flared foot, two side lobes ("hire"), rounded crown with peak
  const right = [[w * 0.98, 0]];
  right.push(...bez([w * 0.98, 0], [w * 1.16, H * 0.1], [w * 1.18, H * 0.22], [w * 1.0, H * 0.3], 6));
  right.push(...bez([w * 1.0, H * 0.3], [w * 0.86, H * 0.36], [w * 0.88, H * 0.4], [w * 1.04, H * 0.46], 5));
  right.push(...bez([w * 1.04, H * 0.46], [w * 1.12, H * 0.58], [w * 0.98, H * 0.7], [w * 0.74, H * 0.74], 6));
  right.push(...bez([w * 0.74, H * 0.74], [w * 0.7, H * 0.88], [w * 0.4, H * 0.96], [w * 0.14, H * 0.95], 8));
  right.push(...bez([w * 0.14, H * 0.95], [w * 0.08, H * 0.99], [w * 0.04, H * 1.0], [0, H * 1.04], 3));
  const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  const outline = [...right, ...left];
  extrude(msTile, X, outline, [], -T, 0);
  // raised border band (front relief) + recessed field
  const band = outline.map(([x, y]) => [x * 0.84, y * 0.84 + H * 0.06]);
  extrude(msTile, X, outline, [band], 0, 0.04);
  const field = outline.map(([x, y]) => [x * 0.62, y * 0.6 + H * 0.16]);
  extrude(msTile, X, field, [], 0, 0.025);
  // crest
  const crestY = H * 0.47, cr = W * 0.17;
  // moulded relief in the field: rolling clouds below the crest, curled scrolls
  // in the upper lobes, and a bead string (renju) along the raised border band
  if (opts.relief !== false) {
    const hz = Math.max(0.008, W * 0.016);
    for (const s of [-1, 1]) {
      cloud(msTile, X, s * W * 0.25, H * 0.27, W * 0.34, hz, s, 0.025);
      scroll(msTile, X, s * W * 0.2, H * 0.67, W * 0.07, s > 0 ? Math.PI : 0, s, 1.15, W * 0.016, hz, { z0: 0.025 });
    }
    const nb = 18;
    const mid = outline.map(([x, y]) => [x * 0.92, y * 0.92 + H * 0.03]);
    // resample the band midline by arc length
    const seg = []; let tot = 0;
    for (let i = 0; i < mid.length; i++) { const a = mid[i], b = mid[(i + 1) % mid.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); tot += l; }
    for (let k = 0; k < nb; k++) {
      let d = ((k + 0.5) / nb) * tot, i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      const a = mid[i], b = mid[(i + 1) % mid.length], t = seg[i] > 0 ? d / seg[i] : 0;
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      if (py < H * 0.05) continue;
      bead(msTile, X, px, py, W * 0.022, W * 0.02, 8, 0.04);
    }
  }
  lathe(msTile, mul(X, xf([0, crestY, 0.02], 0, Math.PI / 2)), [[0, 0], [cr * 1.25, 0], [cr * 1.25, 0.03], [cr * 1.12, 0.05], [0, 0.05]], 28);
  if (msGold) {
    lathe(msGold, mul(X, xf([0, crestY, 0.07], 0, Math.PI / 2)), [[0, 0], [cr, 0], [cr, 0.012], [cr * 0.85, 0.025], [cr * 0.35, 0.04], [0, 0.045]], 28);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      lathe(msGold, mul(X, xf([Math.cos(a) * cr * 0.5, crestY + Math.sin(a) * cr * 0.5, 0.08], 0, Math.PI / 2)), [[0, 0], [cr * 0.28, 0], [cr * 0.22, 0.02], [0, 0.03]], 10);
    }
  }
  // toribusuma: thick tile horn projecting forward from the crown, curling up
  if (opts.horn === true) {
    // projects forward over the face, low, curling gently upward at the tip
    const hr = opts.hornR || W * 0.12;
    const Lh = (opts.hornLen || W * 0.5) * 0.9;
    const path = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      path.push([0, H * 0.8 + Lh * (0.2 * t + 0.3 * t * t), -T * 0.45 + Lh * (1.0 * t - 0.12 * t * t)]);
    }
    // round tile tube: flattened oval section
    const prof = circlePts(0, 0, hr, 14).map(([a, b]) => [a, b * 0.82]).reverse();
    sweep(msTile, path, prof, { closed: true, smooth: true, X, caps: false });
    const end = path[path.length - 1], prev = path[path.length - 2];
    const dir = v3.norm(v3.sub(end, prev));
    const Xe = mul(X, basis(end, [1, 0, 0], dir, v3.cross([1, 0, 0], dir)));
    lathe(msTile, Xe, [[0, -0.02], [hr * 1.25, -0.02], [hr * 1.25, 0.03], [hr * 1.1, 0.045], [0, 0.045]], 16);
    if (msGold) {
      // gilt end cap (tomoe disc) + a gilt collar where the horn leaves the crown
      lathe(msGold, mul(Xe, xf([0, 0.045, 0])), [[0, 0], [hr * 1.12, 0], [hr * 1.05, 0.02], [hr * 0.55, 0.04], [0, 0.048]], 16);
      const c0 = path[2], c1 = path[3];
      const d0 = v3.norm(v3.sub(c1, c0));
      lathe(msGold, mul(X, basis(c0, [1, 0, 0], d0, v3.cross([1, 0, 0], d0))), [[hr * 1.08, -0.03], [hr * 1.12, 0], [hr * 1.08, 0.03]], 16);
    }
  }
  if (opts.goldEdge && msGold) {
    const inner = outline.map(([x, y]) => [x * 0.955, y * 0.955 + H * 0.016]);
    extrude(msGold, X, outline, [inner], 0.0, 0.055);
  }
  // shibi (ridge-end fin) in the plane of the ridge: a broad dark-tile fish-tail
  // fin with a stepped (scaled) inner edge, its outer tip curling outward, and
  // gilt edging + scale ribs (dark ridge-end ornaments with gold accents,
  // not a gold horn)
  if (opts.shibi && msGold) {
    const S = opts.shibi;
    const outer = [[0.26, 0], [0.3, 0.38], [0.36, 0.76], [0.46, 1.06], [0.6, 1.3], [0.72, 1.42]];
    const inner = [[0.58, 1.38], [0.44, 1.3], [0.38, 1.2], [0.22, 1.1], [0.16, 0.98], [0.0, 0.84], [-0.05, 0.71], [-0.2, 0.52], [-0.25, 0.38], [-0.38, 0.14], [-0.42, 0]];
    const pts = [...outer, ...inner].map(([s, y]) => [s * S, y * S]);
    const Xs = mul(X, basis([0, H * 0.9, -T * 0.55], [0, 0, 1], [0, 1, 0], [-1, 0, 0]));
    const th = 0.1 * S;
    extrude(msTile, Xs, pts, [], -th, th);
    // gilt edging on both faces: outer edge strand and stepped inner edge
    const edgeO = outer.map(([s, y]) => [(s - 0.035) * S, y * S]);
    const edgeI = [[0.6, 1.36], ...inner.slice(1, -1)].map(([s, y]) => [(s + 0.04) * S, (y - 0.015) * S]);
    for (const zf of [1, -1]) {
      const Xf = mul(Xs, xf([0, 0, 0], 0, 0, 0, [1, 1, zf]));
      ridge2(msGold, Xf, edgeO, 0.026 * S, 0.02 * S, 5, { z0: th });
      ridge2(msGold, Xf, edgeI, 0.022 * S, 0.018 * S, 5, { z0: th });
      // scale ribs: arcs spanning the fin from the stepped inner edge to the outer edge
      const at = (poly, y) => { for (let i = 0; i < poly.length - 1; i++) { const [s0, y0] = poly[i], [s1, y1] = poly[i + 1]; if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return s0 + ((s1 - s0) * (y - y0)) / (y1 - y0); } return poly[0][0]; };
      for (const yk of [0.3, 0.56, 0.8, 1.02]) {
        const sa = at(inner, yk) + 0.06, sb = at(outer, yk + 0.1) - 0.06;
        const arc = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; arc.push([(sa + (sb - sa) * t) * S, (yk + 0.1 * t + 0.07 * Math.sin(Math.PI * t)) * S]); }
        ridge2(msGold, Xf, arc, 0.012 * S, 0.012 * S, 5, { z0: th });
      }
    }
    // rounded tile spine along the outer edge (body when seen end-on)
    const spine = [[0.2, 0.0], [0.24, 0.38], [0.3, 0.76], [0.4, 1.06], [0.54, 1.3], [0.66, 1.4]].map(([s, y]) => [s * S, y * S, 0]);
    for (let i = 0; i < spine.length - 1; i++) {
      const a = spine[i], b = spine[i + 1];
      const ra = 0.14 * S * (1 - i / (spine.length - 1)) ** 1.1 + 0.03, rb = 0.14 * S * (1 - (i + 1) / (spine.length - 1)) ** 1.1 + 0.03;
      const d = v3.sub(b, a), L = v3.len(d), ay = v3.scale(d, 1 / L);
      const ax = v3.norm(v3.cross(ay, [0, 0, 1])), az = v3.cross(ax, ay);
      lathe(msTile, mul(Xs, basis(a, ax, ay, az)), [[ra, -0.02], [rb, L + 0.02]], 12);
    }
    // gilt collar at the foot and a gilt bead at the tip
    lathe(msGold, mul(Xs, xf([-0.08 * S, 0, 0])), [[0, -0.05], [0.4 * S, -0.05], [0.4 * S, 0.02], [0.36 * S, 0.06], [0, 0.06]], 16);
    lathe(msGold, mul(Xs, xf([0.72 * S, 1.42 * S, 0])), [[0, -0.07 * S], [0.06 * S, -0.03 * S], [0.06 * S, 0.02 * S], [0, 0.07 * S]], 10);
  }
  // gold flame finial on top (hōju-like kaen) for the main ridge ends
  if (opts.flame && msGold) {
    const F = opts.flame;
    const fl = [];
    fl.push(...bez([0, 0], [F * 0.45, F * 0.1], [F * 0.42, F * 0.5], [F * 0.12, F * 0.72], 8));
    fl.push(...bez([F * 0.12, F * 0.72], [F * 0.24, F * 0.84], [F * 0.1, F * 0.95], [0, F * 1.12], 6));
    const lf = fl.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
    const outlineF = [[0, 0], ...fl, ...lf];
    extrude(msGold, mul(X, xf([0, H * 0.98, -T * 0.5])), outlineF, [], -0.06, 0.06);
    lathe(msGold, mul(X, xf([0, H * 0.98 + F * 0.38, -T * 0.5])), [[0, -F * 0.2], [F * 0.2, -F * 0.12], [F * 0.24, 0], [F * 0.18, F * 0.14], [F * 0.06, F * 0.3], [0, F * 0.36]], 18);
  }
}

// Kazari-kanagu: scalloped gilt plate with domed studs. Faces +Z, centred.
export function kanagu(ms, X, w = 0.3, h = 0.25, t = 0.012, studs = true) {
  const hw = w / 2, hh = h / 2;
  const pts = [];
  // scalloped rectangle: cusps on the short sides
  const N = 6;
  pts.push([-hw, -hh], [hw, -hh]);
  for (let i = 1; i < N; i++) { const s = i / N; const y = -hh + h * s; pts.push([hw + (i % 2 ? -0.025 : 0.0) * (w / 0.3), y]); }
  pts.push([hw, hh], [-hw, hh]);
  for (let i = N - 1; i >= 1; i--) { const s = i / N; const y = -hh + h * s; pts.push([-hw - (i % 2 ? -0.025 : 0.0) * (w / 0.3), y]); }
  extrude(ms, X, pts, [], 0, t);
  // raised inner border line
  const ib = [[-hw * 0.82, -hh * 0.78], [hw * 0.82, -hh * 0.78], [hw * 0.82, hh * 0.78], [-hw * 0.82, hh * 0.78]];
  const ib2 = ib.map(([x, y]) => [x * 0.88, y * 0.84]);
  extrude(ms, X, ib, [ib2], t, t + 0.006);
  if (studs) for (const [sx, sy] of [[-0.62, -0.55], [0.62, -0.55], [0.62, 0.55], [-0.62, 0.55]]) {
    lathe(ms, mul(X, xf([sx * hw, sy * hh, t], 0, Math.PI / 2)), [[0, 0], [Math.min(w, h) * 0.075, 0], [Math.min(w, h) * 0.06, 0.008], [0, 0.013]], 8);
  }
  rosette(ms, mul(X, xf([0, 0, t])), Math.min(w, h) * 0.26, 6, 0.018);
}

// Square gold sleeve fitting (kazari-kanagu) around a beam end. Frame: beam
// along local X, section w x h centred; sleeve length L starting at origin.
export function sleeve(ms, X, w, h, L = 0.25, t = 0.012) {
  cbox(ms, mul(X, xf([L / 2, 0, 0])), L / 2, h / 2 + t, w / 2 + t, 0.006);
}

// Simple bracket "makito" style block with gold face plate.
export function goldPlate(ms, X, hw, hh, t = 0.006) {
  cbox(ms, X, hw, hh, t, Math.min(t, 0.004));
}

export { bez };
