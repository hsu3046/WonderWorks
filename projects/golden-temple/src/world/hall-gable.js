// ---------------------------------------------------------------------------
// hall-gable: placement of the real-geometry gilt carvings (hall-carve.js) on
// the karahafu gable field, the karahafu rainbow beam (koryo), the chidori
// gable and the irimoya side gables. Fields are bilaterally symmetric: the
// right half is carved in a frame and mirrored for the left half.
// ---------------------------------------------------------------------------
import { xf, mul, basis } from './hall-lib.js';
import { karakusaBand, beamMotif, peony, scroll, leaf, ridge2, bead, cloud } from './hall-carve.js';

const goldOf = (acc, mats) => acc.m(mats.goldC || mats.goldL || mats.gold);

// mirrored pair of frames: plane z = zp (local +Z = out of the panel)
const pair = (X0) => [X0, mul(X0, xf([0, 0, 0], 0, 0, 0, [-1, 1, 1]))];

// Karahafu gable field under the cusped bargeboard (panel front plane at zp).
// Struts at |x| = 2.4 (w 0.16), kaerumata at 0 (W 1.8) and |x| = 3.9 (W 1.2),
// horizontal beam at colTop + 1.3 (h 0.24), gegyo hanging in front at the centre.
export function carveKaraGable(acc, mats, K, zp) {
  const g = goldOf(acc, mats);
  const top = (x) => Math.max(K.f(x) - 0.62, K.colTop + 0.1) - 0.07;
  const yB0 = K.colTop + 0.1, yB1 = K.colTop + 1.3 - 0.17;
  const yU0 = K.colTop + 1.3 + 0.17;
  const o = { maxRowH: 0.62, minH: 0.2, scale: 1.45 };
  for (const X of pair(xf([0, 0, zp]))) {
    // lower zone (between koryo and the horizontal beam)
    karakusaBand(g, X, 0.98, 2.27, () => yB0, () => yB1, { ...o, phase: 0.0 });
    karakusaBand(g, X, 2.53, 3.27, () => yB0, () => yB1, { ...o, phase: 0.5, flowers: false });
    karakusaBand(g, X, 4.53, 6.05, () => yB0, (x) => Math.min(yB1, top(x)), { ...o, phase: 0.25 });
    // above the side kaerumata (they are only 0.62 high)
    karakusaBand(g, X, 3.33, 4.47, () => K.colTop + 0.72, () => yB1, { ...o, phase: 0.75, flowers: false, minH: 0.14 });
    // upper zone under the curved bargeboard
    karakusaBand(g, X, 1.14, 2.27, () => yU0, top, { ...o, phase: 0.3 });
    karakusaBand(g, X, 2.53, 4.9, () => yU0, top, { ...o, phase: 0.8, minH: 0.16 });
  }
}

// Rainbow beam (koryo) face: discrete carved gilt motifs instead of an
// all-over pattern. yOf(x) gives the beam centre line, zf the front face.
export function carveKoryo(acc, mats, yOf, zf, xe) {
  const g = goldOf(acc, mats);
  const Hh = 0.43;
  // centre: long symmetric peony-and-scroll motif
  beamMotif(g, xf([0, yOf(0) + 0.005, zf]), 0, 0, 1.45, Hh, 1.45);
  // flanking motifs (mirrored pair, each symmetric in itself)
  for (const s of [-1, 1]) {
    const cx = s * 3.3;
    beamMotif(g, xf([cx, yOf(cx) + 0.005, zf]), 0, 0, 1.05, Hh * 0.92, 1.4);
  }
  // kibana ends: a cloud scroll near each end
  for (const X of pair(xf([0, 0, zf]))) {
    const cx = xe - 0.5;
    cloud(g, X, cx, yOf(cx) - 0.02, 0.42, 0.022, -1);
  }
}

// Chidori gable: carved gilt band across the field between the lower beams.
export function carveChidori(acc, mats, C, Q, zp, base) {
  const g = goldOf(acc, mats);
  const o = { maxRowH: 1.1, minH: 0.2, scale: 1.25 };
  const top = (x) => Q(x) - 0.58;
  for (const X of pair(xf([0, 0, zp]))) {
    karakusaBand(g, X, 0.66, C.W - 0.3, () => base + 0.47, (x) => Math.min(base + 1.2, top(x)), { ...o, phase: 0.2 });
  }
}

// Irimoya side gable (field plane x = xw, faces +sx). Carved bands between
// the horizontal beams; struts at z = 0, +-zg*0.62.
export function carveSideGable(acc, mats, xw, sx, zg, beamsY, topAt) {
  const g = goldOf(acc, mats);
  // local frame: shape x -> world z, shape y -> world y, out -> world +sx*x
  const X0 = basis([xw + sx * 0.002, 0, 0], [0, 0, sx], [0, 1, 0], [sx, 0, 0]);
  const o = { maxRowH: 1.5, minH: 0.25, scale: 1.6 };
  const hb = 0.13 + 0.06;
  for (const X of pair(X0)) {
    // between beam 0 and beam 1 (kaerumata stand at 0 and +-0.31 zg)
    const lo1 = beamsY[0] + hb, hi1 = beamsY[1] - hb;
    karakusaBand(g, X, zg * 0.62 + 0.18, zg - 0.4, () => lo1, (z) => Math.min(hi1, topAt(z)), { ...o, phase: 0.1 });
    // between the kaerumata (at 0 and +-0.31 zg) and the strut at 0.62 zg
    karakusaBand(g, X, 0.78, zg * 0.31 - 0.62, () => lo1 + 0.06, () => hi1 - 0.04, { ...o, phase: 0.45, flowers: false, minH: 0.2 });
    karakusaBand(g, X, zg * 0.31 + 0.62, zg * 0.62 - 0.17, () => lo1 + 0.06, () => hi1 - 0.04, { ...o, phase: 0.15 });
    // between beam 1 and beam 2
    const lo2 = beamsY[1] + hb, hi2 = beamsY[2] - hb;
    karakusaBand(g, X, 0.18, zg * 0.62 - 0.18, () => lo2, (z) => Math.min(hi2, topAt(z)), { ...o, phase: 0.6 });
    karakusaBand(g, X, zg * 0.62 + 0.18, zg - 0.4, () => lo2, (z) => Math.min(hi2, topAt(z)), { ...o, phase: 0.35, minH: 0.3 });
    // above beam 2 (apex triangle)
    karakusaBand(g, X, 0.18, zg * 0.62 - 0.18, () => beamsY[2] + hb, topAt, { ...o, phase: 0.85, minH: 0.3 });
  }
}

export { peony, scroll, leaf, ridge2, bead };
