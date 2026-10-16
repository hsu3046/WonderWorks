// ---------------------------------------------------------------------------
// Signed distance functions of the sculptures (pure JS, used by the workers).
// Local frame: origin = centre of the seat (top of the lotus), +Y up,
// +Z toward the worshipper, +X to the viewer's right. Units: metres.
// ---------------------------------------------------------------------------
const sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, exp = Math.exp;

export function smin(a, b, k) { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { const h = max(k - abs(a - b), 0) / k; return max(a, b) + h * h * k * 0.25; }
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz;
  const k0 = sqrt(a * a + b * b + c * c);
  const a2 = a / rx, b2 = b / ry, c2 = c / rz;
  const k1 = sqrt(a2 * a2 + b2 * b2 + c2 * c2);
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -min(rx, ry, rz);
}
function sph(x, y, z, cx, cy, cz, r) { const a = x - cx, b = y - cy, c = z - cz; return sqrt(a * a + b * b + c * c) - r; }
// round cone (capsule with two radii) between a and b
function rc(x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = x - ax, pay = y - ay, paz = z - az;
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * l2;
  const z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(yy) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
}
// torus around the Y axis at height cy
function torY(x, y, z, cx, cy, cz, R, r, sx = 1, sz = 1) {
  const dx = (x - cx) / sx, dz = (z - cz) / sz;
  const q = sqrt(dx * dx + dz * dz) - R;
  const b = y - cy;
  return sqrt(q * q + b * b) - r;
}
// ellipsoid rotated about Z then X (small rotations of features)
function ellR(x, y, z, cx, cy, cz, rx, ry, rz, rotZ, rotX = 0) {
  let px = x - cx, py = y - cy, pz = z - cz;
  if (rotZ) { const c = cos(-rotZ), s = sin(-rotZ); const t = px * c - py * s; py = px * s + py * c; px = t; }
  if (rotX) { const c = cos(-rotX), s = sin(-rotX); const t = py * c - pz * s; pz = py * s + pz * c; py = t; }
  return ell(px, py, pz, 0, 0, 0, rx, ry, rz);
}
// fold profile: narrow rounded ridges, broad valleys (Heian style)
function fold(u) { const c = 0.5 + 0.5 * cos(u); return c * c * c - 0.18; }
function fold2(u) { const c = 0.5 + 0.5 * cos(u); const s = c * c; return s * s * 1.2 - 0.15 + 0.35 * (0.5 + 0.5 * cos(u * 2.0 + 1.3)) * 0.4; }

// ===========================================================================
// AMIDA NYORAI — seated in full lotus, hands in the meditation mudra.
// Seated height (seat -> top of the ushnisha) ~2.55 m.
// ===========================================================================
const HAIRLINE_FRONT = 2.078;
function hairY(x, z) {
  // hairline height: high at the front, lower at the temples/back
  const ax = abs(x);
  const back = sstep(0.12, -0.2, z);
  const side = sstep(0.12, 0.25, ax);
  return HAIRLINE_FRONT - 0.04 * side * (1 - back) - 0.36 * back - 0.03 * side;
}

// eye + brow relief (head space, ax >= 0). Positive = outward.
// Classical Jocho-style downcast eye: a crisp crescent brow arris, a shallow hollow under it,
// a heavy convex upper lid rolling down to a softly rounded lid margin, a barely recessed
// sliver of eye (a soft crease, never a dark slit) and a gentle lower lid melting into the
// full cheek (no rim under the eye).
function eyeRelief(ax, y, z) {
  if (ax > 0.25 || y < 1.83 || y > 2.04 || z < 0.1) return 0;
  const fr = sstep(0.12, 0.2, z);
  // crescent brow edge: from the nose root, arching over the eye, down to the temple
  const ub = (ax - 0.09) / 0.122;
  const yb = 1.952 + 0.032 * (1 - min(1.4, ub * ub));
  // lid line (margin of the upper lid): long, gently bowed, the outer end lifting to the temple
  const u = (ax - 0.098) / 0.057;
  const uc = max(-1, min(1, u));
  const yl = 1.917 - 0.0085 * (1 - uc * uc) + 0.0048 * uc;
  const p = (y - yl) / max(0.02, yb - yl);
  // hollow under the brow (crisp at the brow edge, fading into the lid, nose root and temple)
  const sx = sstep(0.012, 0.045, ax) * sstep(0.232, 0.178, ax);
  let h = -0.011 * sx * sstep(0.1, 0.6, p) * (1 - sstep(0.7, 1.0, p));
  // heavy upper lid: a convex roll above the margin, fading past the eye corners
  const lidM = sstep(1.3, 0.92, abs(u));
  const roll = exp(-((p - 0.2) * (p - 0.2)) / (0.2 * 0.2));
  const edge = sstep(yl - 0.0082, yl + 0.0036, y);
  h += lidM * 0.0042 * roll * edge * (p < 1 ? 1 : 0);
  // the eye: a thin crescent under the margin, only slightly recessed (soft crease)
  if (abs(u) < 1.15) {
    const w = sqrt(max(0, 1 - min(1, u * u)));
    const hs = 0.0062 * w + 0.0012;
    const ylo = yl - hs;
    const eyeM = sstep(ylo - 0.008, ylo + 0.0025, y) * (1 - sstep(yl - 0.0058, yl + 0.0036, y));
    h -= 0.0019 * eyeM * sstep(1.12, 0.85, abs(u));
    // lower lid: a soft, low swell under the crescent, melting into the cheek
    const ll = y - (ylo - 0.007);
    h += 0.0015 * exp(-(ll * ll) / (0.0075 * 0.0075)) * w;
  }
  return h * fr;
}

function buddhaHead(ax, x, y, z, P) {
  // --- cranium and face mass
  let d = ell(ax, y, z, 0, 1.975, -0.05, 0.25, 0.272, 0.275);
  d = smin(d, ell(ax, y, z, 0, 1.845, 0.0, 0.212, 0.205, 0.24), 0.10);
  // full, round cheeks (the moon face of the Fujiwara Amida)
  d = smin(d, ell(ax, y, z, 0.104, 1.822, 0.108, 0.104, 0.112, 0.118), 0.07);
  // full, rounded jaw (no V-shaped taper)
  d = smin(d, ell(ax, y, z, 0, 1.75, 0.07, 0.152, 0.085, 0.14), 0.06);
  // chin + soft double chin
  d = smin(d, ell(ax, y, z, 0, 1.7, 0.162, 0.072, 0.05, 0.06), 0.05);
  d = smin(d, ell(ax, y, z, 0, 1.676, 0.09, 0.12, 0.05, 0.1), 0.06);
  // forehead: slightly flattened front, brow plane, turning away to the temples
  d = smax(d, z - 0.268 - 0.05 * sstep(1.9, 2.25, y) + 0.6 * (ax * ax), 0.08);
  // --- eye region (relief on the face front)
  d -= eyeRelief(ax, y, z);
  // --- nose: straight, narrow bridge rising out of the brows, small rounded tip, soft wings
  d = smin(d, rc(ax, y, z, 0, 1.952, 0.234, 0, 1.849, 0.272, 0.018, 0.0195), 0.038);
  d = smin(d, ell(ax, y, z, 0, 1.837, 0.275, 0.025, 0.0165, 0.0175), 0.028);
  // alae: flat wings blended into the cheeks, nostrils shallow and hidden underneath
  d = smin(d, ellR(ax, y, z, 0.027, 1.829, 0.26, 0.021, 0.0155, 0.02, 0.25), 0.036);
  d = smax(d, -ell(ax, y, z, 0.012, 1.8115, 0.271, 0.0042, 0.0019, 0.0055), 0.005);
  // the full, rounded muzzle the lips sit on (no nasolabial creases)
  d = smin(d, ell(ax, y, z, 0, 1.776, 0.168, 0.072, 0.056, 0.072), 0.045);
  // philtrum
  d = smax(d, -ell(ax, y, z, 0, 1.787, 0.274, 0.009, 0.013, 0.005), 0.008);
  // --- lips: small, full, closed, with the faint archaic smile
  d = smin(d, ellR(ax, y, z, 0.015, 1.7685, 0.24, 0.029, 0.0105, 0.0185, 0.12), 0.034);
  d = smin(d, ell(ax, y, z, 0, 1.7475, 0.235, 0.031, 0.0125, 0.0195), 0.032);
  // mouth line: a soft shallow groove (no slit), the ends turned up into small soft corners
  {
    const ym = 1.7578 + 2.0 * ax * ax;
    const dy = (y - ym) / 0.0026;
    const lat = sstep(0.05, 0.036, ax);
    const corner = exp(-((ax - 0.04) * (ax - 0.04)) / (0.0065 * 0.0065));
    d += (0.002 * lat + 0.0018 * corner) * exp(-dy * dy) * sstep(0.2, 0.235, z);
  }
  // under-lip hollow above the chin
  d = smax(d, -ell(ax, y, z, 0, 1.723, 0.257, 0.04, 0.0095, 0.012), 0.016);
  // urna (byakugo)
  d = smin(d, sph(ax, y, z, 0, 1.996, 0.266, 0.0118), 0.002);
  d = smin(d, torY(ax, z, y, 0, 0.262, 1.996, 0.0135, 0.0028), 0.002);
  // --- long ears with pierced, pendulous lobes
  {
    const ex = 0.25;
    let e = ellR(ax, y, z, ex, 1.905, -0.02, 0.034, 0.16, 0.085, 0.0, -0.18);
    e = smin(e, rc(ax, y, z, ex + 0.004, 1.84, 0.0, ex + 0.008, 1.735, 0.014, 0.022, 0.024), 0.03);
    e = smin(e, ellR(ax, y, z, ex + 0.008, 1.726, 0.018, 0.024, 0.052, 0.04, 0, -0.1), 0.024);
    // concha / inner fold
    e = smax(e, -ellR(ax, y, z, ex + 0.034, 1.93, -0.005, 0.02, 0.105, 0.052, 0, -0.18), 0.012);
    e = smin(e, ellR(ax, y, z, ex + 0.018, 1.92, -0.012, 0.012, 0.07, 0.022, 0, -0.18), 0.008);
    // lobe slit
    e = smax(e, -ell(ax, y, z, ex + 0.015, 1.735, 0.02, 0.06, 0.026, 0.0085), 0.006);
    d = smin(d, e, 0.025);
  }
  // --- neck with the three folds (sanmen-do)
  let nk = rc(ax, y, z, 0, 1.42, -0.075, 0, 1.73, -0.035, 0.152, 0.122);
  for (let i = 0; i < 3; i++) {
    const yy = 1.545 + i * 0.045;
    nk = smax(nk, -torY(ax, y, z, 0, yy, -0.06 + i * 0.012, 0.142 - i * 0.008, 0.0045, 1, 0.95), 0.008);
  }
  d = smin(d, nk, 0.04);
  // --- hair mass + ushnisha (curls are separate instances)
  const hy = hairY(x, z);
  const inHair = sstep(hy - 0.01, hy + 0.02, y);
  d -= 0.012 * inHair;
  d = smin(d, sph(ax, y, z, 0, 2.225, -0.06, 0.152), 0.028);
  return d;
}

function buddhaBody(ax, x, y, z, P) {
  // --- torso
  let d = ell(ax, y, z, 0, 1.12, -0.085, 0.455, 0.33, 0.265);
  d = smin(d, ell(ax, y, z, 0, 0.75, -0.06, 0.405, 0.35, 0.29), 0.16);
  d = smin(d, ell(ax, y, z, 0, 0.36, -0.14, 0.5, 0.3, 0.36), 0.16);
  // soft, sloping shoulders
  d = smin(d, sph(ax, y, z, 0.455, 1.27, -0.1, 0.17), 0.14);
  d = smin(d, rc(ax, y, z, 0.08, 1.43, -0.1, 0.43, 1.335, -0.1, 0.12, 0.13), 0.12);
  // --- arms
  d = smin(d, rc(ax, y, z, 0.52, 1.24, -0.085, 0.625, 0.82, 0.015, 0.145, 0.13), 0.07);
  d = smin(d, rc(ax, y, z, 0.625, 0.82, 0.015, 0.2, 0.545, 0.305, 0.125, 0.085), 0.06);
  // sleeve hanging from the forearm, merging into the lap
  d = smin(d, ell(ax, y, z, 0.5, 0.57, 0.15, 0.17, 0.16, 0.2), 0.1);
  d = smin(d, ell(ax, y, z, 0.69, 0.63, -0.03, 0.14, 0.27, 0.15), 0.1);
  // --- legs in full lotus, all under the robe
  // thighs from the hips to broad knees
  let lg = rc(ax, y, z, 0.2, 0.2, -0.1, 0.8, 0.16, 0.3, 0.22, 0.165);
  lg = smin(lg, ell(ax, y, z, 0.84, 0.155, 0.33, 0.21, 0.155, 0.21), 0.1);
  lg = smin(lg, ell(ax, y, z, 0, 0.16, 0.0, 0.62, 0.16, 0.44), 0.16);
  // shins crossing in front (right over left) toward the opposite thighs
  lg = smin(lg, rc(x, y, z, 0.8, 0.21, 0.43, -0.24, 0.29, 0.41, 0.135, 0.11), 0.13);
  lg = smin(lg, rc(x, y, z, -0.8, 0.17, 0.45, 0.26, 0.17, 0.53, 0.125, 0.1), 0.13);
  d = smin(d, lg, 0.12);
  // robe hem lying over the shins (soft lip)
  {
    const hemZ = 0.5 + 0.08 * (1 - sstep(0.0, 0.7, ax));
    const hm = exp(-((z - hemZ) * (z - hemZ)) / (0.02 * 0.02)) * sstep(0.12, 0.2, y) * (1 - sstep(0.36, 0.44, y)) * (1 - sstep(0.75, 0.9, ax));
    d -= 0.013 * hm;
  }
  // --- robe: thickness, neckline hem and folds
  const front = sstep(-0.05, 0.12, z);
  // broad U-shaped opening: bare chest above, the pleated sash below
  const hw = 0.165 + 0.135 * sstep(0.85, 1.42, y);
  const inOpen = front * sstep(0.6, 0.66, y) * (1 - sstep(1.48, 1.56, y)) * sstep(hw + 0.008, hw - 0.008, ax);
  d -= 0.014 * (1 - inOpen);
  // rolled hem along the opening edge
  const hem = exp(-((ax - hw - 0.008) * (ax - hw - 0.008)) / (0.018 * 0.018)) * front * sstep(0.62, 0.7, y) * (1 - sstep(1.45, 1.55, y));
  d -= 0.016 * hem;
  // undergarment (sash): a stack of plump horizontal rolls from the hands up to the chest
  const sashM = front * sstep(0.58, 0.62, y) * (1 - sstep(0.95, 0.99, y)) * sstep(hw + 0.004, hw - 0.012, ax);
  if (sashM > 0.001) {
    const yy = (y - 0.6 - 0.1 * ax * ax) / 0.056;
    const f = yy - Math.floor(yy);
    const roll = 1 - (2 * f - 1) * (2 * f - 1);
    d -= sashM * (0.004 + 0.013 * roll);
  }
  // chest folds: a few soft U-shaped catenaries following the neckline
  const torsoM = front * sstep(0.6, 0.72, y) * (1 - sstep(1.32, 1.46, y)) * (1 - inOpen) * (1 - sashM) * sstep(0.86, 0.66, ax);
  if (torsoM > 0.001) {
    const u = (y - 0.85 * ax * ax - 0.5 * ax + 0.025 * sin(ax * 9.0)) * 2 * Math.PI / 0.12;
    d -= 0.021 * torsoM * fold(u) * (0.75 + 0.25 * sin(u * 0.41 + ax * 6.0));
  }
  // sleeve folds on the upper arms, falling diagonally
  const armM = sstep(0.38, 0.52, ax) * sstep(0.64, 0.8, y) * (1 - sstep(1.26, 1.4, y));
  if (armM > 0.001) {
    const u = (y * 0.85 - z * 0.45 + ax * 0.35 + 0.02 * sin(z * 14.0)) * 2 * Math.PI / 0.13;
    d -= 0.025 * armM * fold(u) * (0.72 + 0.28 * sin(u * 0.53 + 1.0));
  }
  // sleeve hanging folds below the forearm
  const slM = sstep(0.3, 0.42, ax) * (1 - sstep(0.6, 0.7, y)) * sstep(0.3, 0.38, y) * sstep(-0.05, 0.08, z);
  if (slM > 0.001) d -= 0.017 * slM * fold((ax * 0.9 + z * 0.4 + 0.03 * sin(y * 11.0)) * 2 * Math.PI / 0.1);
  // lap folds: soft arcs spreading toward the knees
  const lapM = (1 - sstep(0.34, 0.46, y)) * sstep(0.24, 0.34, sqrt(x * x + (z - 0.38) * (z - 0.38)));
  if (lapM > 0.001) {
    const r = sqrt(x * x * 0.55 + (z - 0.02) * (z - 0.02) * 1.6);
    const ang = atan2(z - 0.1, x);
    const u = r * 2 * Math.PI / 0.15 + 0.7 * sin(ang * 3.0) + 0.4 * sin(x * 5.0);
    d -= 0.028 * lapM * fold(u) * (0.7 + 0.3 * sin(u * 0.47 + ang));
  }
  // knee folds: sickle-shaped arcs wrapping each knee + the robe sagging between the shins
  {
    const kM = sstep(0.42, 0.6, ax) * (1 - sstep(0.3, 0.38, y)) * sstep(0.05, 0.2, z);
    if (kM > 0.001) {
      const kx = ax - 0.84, kz = z - 0.33;
      const r = sqrt(kx * kx * 1.0 + kz * kz * 2.2);
      const u = r * 2 * Math.PI / 0.11 + 0.9 * sin(atan2(kz, kx) * 2.0);
      d -= 0.022 * kM * fold(u) * sstep(0.08, 0.16, r);
    }
    const sag = exp(-(x * x) / (0.14 * 0.14)) * sstep(0.36, 0.5, z) * (1 - sstep(0.3, 0.4, y));
    d += 0.03 * sag;
  }
  // --- right sole (turned up, on the left thigh)
  d = smin(d, ellR(x, y, z, -0.42, 0.395, 0.3, 0.21, 0.055, 0.095, 0.1, 0.0), 0.04);
  for (let i = 0; i < 5; i++) {
    const tx = -0.62 - i * 0.004, tz = 0.255 + i * 0.025;
    d = smin(d, sph(x, y, z, tx, 0.405 - i * 0.004, tz, 0.022 - i * 0.002), 0.012);
  }
  // --- hands: meditation mudra (dhyana): palms up, right over left,
  //     fingers overlapping, thumb tips meeting in an arch above them
  const ellY = (px, py, pz, cx, cy, cz, rx, ry, rz, yaw) => {
    const c = cos(-yaw), s2 = sin(-yaw); const dx = px - cx, dz = pz - cz;
    return ell(dx * c - dz * s2, py, dx * s2 + dz * c, 0, cy, 0, rx, ry, rz);
  };
  let hd = 1e9;
  // hands are sculpted at 1.25x about the lap centre (they read too small otherwise)
  const HS = 1.4;
  { const ox = x, oy = y, oz = z;
  x = ox / HS; y = 0.5 + (oy - 0.575) / HS; z = 0.385 + (oz - 0.43) / HS;
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    const up = sgn > 0 ? 0.027 : 0;   // right hand rests on the left
    const hy = 0.484 + up;
    // wrist -> palm heel
    hd = smin(hd, rc(x, y, z, sgn * 0.143, 0.479, 0.297, sgn * 0.11, hy + 0.012, 0.35, 0.04, 0.036), 0.03);
    // palm
    hd = smin(hd, ellY(x, y, z, sgn * 0.07, hy, 0.37, 0.074, 0.026, 0.062, -sgn * 0.22), 0.02);
    // thenar pad + thumb rising to meet the other thumb
    hd = smin(hd, ell(x, y, z, sgn * 0.075, hy + 0.012, 0.41, 0.03, 0.02, 0.026), 0.015);
    hd = smin(hd, rc(x, y, z, sgn * 0.062, hy + 0.016, 0.425, sgn * 0.042, 0.553, 0.43, 0.017, 0.0155), 0.012);
    hd = smin(hd, rc(x, y, z, sgn * 0.042, 0.553, 0.43, sgn * 0.006, 0.564, 0.433, 0.0155, 0.0135), 0.012);
    // four fingers pointing across to the other side
    for (let i = 0; i < 4; i++) {
      const zz = 0.333 + i * 0.024;
      const rr = i === 3 ? 0.012 : 0.0145;
      const len = i === 3 ? 0.085 : (i === 1 ? 0.118 : 0.108);
      hd = smin(hd, rc(x, y, z, sgn * 0.0, hy + 0.002, zz, -sgn * len, hy - 0.004, zz + 0.01, rr * 1.1, rr), 0.007);
    }
  }
  x = ox; y = oy; z = oz; hd *= HS; }
  d = smin(d, hd, 0.035);
  return d;
}

// the head is sculpted in its own space and scaled up about the neck pivot
const HK = 1.17, HPY = 1.56, HPZ = -0.05, HD = 0.06;   // HD: head lowered by 6 cm (shorter neck)
function headSpace(x, y, z) { return [x / HK, HPY + (y + HD - HPY) / HK, HPZ + (z - HPZ) / HK]; }
function buddhaF(x, y, z, P) {
  const ax = abs(x);
  let d = 1e9;
  if (y > 1.33) {
    const hy = HPY + (y + HD - HPY) / HK, hz = HPZ + (z - HPZ) / HK;
    d = HK * buddhaHead(ax / HK, x / HK, hy, hz, P);
  }
  if (y < 1.78) d = smin(d, buddhaBody(ax, x, y, z, P), 0.05);
  // flat underside resting on the lotus
  d = smax(d, -y - 0.02, 0.02);
  return d;
}

function buddhaRegion(x, y, z) {
  // r[0]: skin (polished) 0..1 ; r[1]: hair (dark) 0..1
  const ax = abs(x);
  let skin = 0, hair = 0;
  if (y > 1.4) {
    const h = headSpace(x, y, z);
    const hy = hairY(h[0], h[2]);
    hair = sstep(hy - 0.005, hy + 0.012, h[1]);
    skin = 1 - hair;
  }
  const front = sstep(-0.05, 0.12, z);
  const hw = 0.165 + 0.135 * sstep(0.85, 1.42, y);
  const inO = front * sstep(hw - 0.004, hw - 0.02, ax) * (1 - sstep(1.4, 1.5, y));
  const open = inO * sstep(0.93, 0.98, y);
  const sash = inO * sstep(0.6, 0.64, y) * (1 - sstep(0.93, 0.98, y));
  skin = max(skin, max(open, sash * 0.65));
  // hands + sole
  if (y > 0.4 && y < 0.74 && z > 0.28 && ax < 0.28) skin = max(skin, sstep(0.72, 0.67, y) * sstep(0.28, 0.22, ax) * sstep(0.28, 0.33, z));
  if (y > 0.33 && y < 0.46 && x < -0.2 && x > -0.68 && z > 0.18) skin = max(skin, 0.8);
  return [skin, hair];
}

// ===========================================================================
// BODHISATTVA — slimmer, seated (half lotus), hands in gassho, high topknot.
// Seated height ~1.55 m (to the top of the topknot). Crown/jewellery are
// added as separate geometry.
// ===========================================================================
function bodhiF(x, y, z, P) {
  const ax = abs(x);
  let d = 1e9;
  if (y > 0.86) {
    // head
    let h = ell(ax, y, z, 0, 1.2, -0.03, 0.14, 0.165, 0.155);
    h = smin(h, ell(ax, y, z, 0, 1.12, 0.0, 0.122, 0.12, 0.14), 0.06);
    h = smin(h, ell(ax, y, z, 0.06, 1.105, 0.06, 0.062, 0.06, 0.062), 0.04);
    h = smax(h, z - 0.152 - 0.03 * sstep(1.15, 1.35, y) + 0.15 * ax * ax, 0.03);
    // eyes / brows / nose / lips (scaled from the Buddha)
    h = smax(h, -ell(ax, y, z, 0.05, 1.163, 0.158, 0.042, 0.02, 0.03), 0.012);
    h = smin(h, ellR(ax, y, z, 0.05, 1.163, 0.132, 0.037, 0.015, 0.018, -0.12, 0.25), 0.007);
    h = smax(h, -ellR(ax, y, z, 0.052, 1.157, 0.153, 0.032, 0.0026, 0.02, -0.14), 0.0025);
    h = smin(h, rc(ax, y, z, 0.006, 1.178, 0.152, 0.09, 1.181, 0.125, 0.006, 0.006), 0.012);
    h = smin(h, rc(ax, y, z, 0, 1.18, 0.152, 0, 1.105, 0.178, 0.008, 0.014), 0.012);
    h = smin(h, sph(ax, y, z, 0.017, 1.1, 0.163, 0.012), 0.008);
    h = smin(h, ellR(ax, y, z, 0.012, 1.063, 0.159, 0.02, 0.007, 0.011, 0.12), 0.007);
    h = smin(h, ell(ax, y, z, 0, 1.049, 0.155, 0.025, 0.008, 0.011), 0.007);
    h = smax(h, -ell(ax, y, z, 0, 1.0565, 0.167, 0.03, 0.0016, 0.02), 0.002);
    h = smin(h, sph(ax, y, z, 0, 1.19, 0.156, 0.007), 0.002);
    // ears with long lobes
    let e = ellR(ax, y, z, 0.142, 1.13, -0.01, 0.02, 0.09, 0.05, 0, -0.18);
    e = smin(e, rc(ax, y, z, 0.146, 1.08, 0.0, 0.152, 1.0, 0.012, 0.018, 0.022), 0.02);
    e = smax(e, -ellR(ax, y, z, 0.162, 1.145, -0.003, 0.012, 0.06, 0.03, 0, -0.18), 0.007);
    h = smin(h, e, 0.015);
    // neck
    let nk = rc(ax, y, z, 0, 0.86, -0.045, 0, 1.06, -0.02, 0.085, 0.07);
    for (let i = 0; i < 3; i++) nk = smax(nk, -torY(ax, y, z, 0, 0.94 + i * 0.026, -0.035, 0.08 - i * 0.004, 0.0028), 0.005);
    h = smin(h, nk, 0.025);
    // hair: swept up, combed grooves, tall topknot
    const hairM = sstep(1.24, 1.26, y + 0.12 * sstep(0.05, -0.1, z) + 0.02 * sstep(0.06, 0.12, ax));
    h -= 0.012 * hairM;
    if (hairM > 0.01) h += 0.0035 * hairM * (0.5 + 0.5 * cos(atan2(x, z + 0.03) * 34));
    let knot = rc(ax, y, z, 0, 1.3, -0.04, 0, 1.47, -0.045, 0.085, 0.06);
    knot = smin(knot, sph(ax, y, z, 0, 1.47, -0.045, 0.068), 0.03);
    knot += 0.004 * (0.5 + 0.5 * cos(y * 2 * Math.PI / 0.035));
    h = smin(h, knot, 0.04);
    d = h;
  }
  if (y < 1.0) {
    // slender torso, bare chest with scarf (tenne)
    let b = ell(ax, y, z, 0, 0.66, -0.05, 0.25, 0.2, 0.15);
    b = smin(b, ell(ax, y, z, 0, 0.43, -0.04, 0.21, 0.2, 0.16), 0.1);
    b = smin(b, ell(ax, y, z, 0, 0.2, -0.08, 0.28, 0.18, 0.2), 0.1);
    b = smin(b, sph(ax, y, z, 0.25, 0.77, -0.06, 0.09), 0.08);
    b = smin(b, rc(ax, y, z, 0.05, 0.84, -0.06, 0.24, 0.79, -0.06, 0.07, 0.075), 0.07);
    // upper arms down, forearms up to gassho at the chest
    b = smin(b, rc(ax, y, z, 0.29, 0.74, -0.05, 0.31, 0.47, 0.03, 0.075, 0.065), 0.04);
    b = smin(b, rc(ax, y, z, 0.31, 0.47, 0.03, 0.06, 0.6, 0.19, 0.06, 0.045), 0.035);
    // joined hands (palms together, fingers up)
    let hd = ellR(ax, y, z, 0.022, 0.67, 0.2, 0.02, 0.085, 0.05, 0.0, -0.25);
    hd = smin(hd, rc(ax, y, z, 0.02, 0.69, 0.21, 0.008, 0.78, 0.235, 0.02, 0.012), 0.02);
    b = smin(b, hd, 0.025);
    // legs: half lotus, robe (skirt) over them
    let lg = ell(ax, y, z, 0, 0.11, 0.06, 0.56, 0.12, 0.3);
    lg = smin(lg, sph(ax, y, z, 0.5, 0.1, 0.2, 0.11), 0.08);
    lg = smin(lg, rc(x, y, z, 0.5, 0.13, 0.24, -0.2, 0.18, 0.25, 0.08, 0.075), 0.06);
    b = smin(b, lg, 0.08);
    // skirt folds radiating on the lap
    const lapM = (1 - sstep(0.2, 0.3, y));
    b -= 0.008 * lapM * fold(sqrt(x * x * 0.5 + (z + 0.05) * (z + 0.05) * 1.8) * 2 * Math.PI / 0.07 + 0.5 * sin(atan2(z, x) * 3));
    // skirt waistband
    b = smin(b, torY(ax, y, z, 0, 0.32, -0.045, 0.2, 0.014, 1, 0.78), 0.02);
    // scarf across the chest (diagonal sash)
    const sd = abs((y - 0.62) - (x * 0.55)) - 0.055;
    const sashD = max(sd, b - 0.016);
    b = smin(b, sashD, 0.008);
    // stole over the shoulders and down the arms
    const st = rc(ax, y, z, 0.2, 0.84, -0.02, 0.36, 0.55, 0.06, 0.035, 0.03);
    b = smin(b, st, 0.03);
    d = smin(d, b, 0.035);
  }
  d = smax(d, -y - 0.01, 0.015);
  return d;
}
function bodhiRegion(x, y, z) {
  const ax = abs(x);
  let skin = 0, hair = 0;
  if (y > 0.86) {
    const hy = 1.25 - 0.12 * sstep(0.05, -0.1, z) - 0.02 * sstep(0.06, 0.12, ax);
    hair = sstep(hy - 0.01, hy + 0.01, y);
    skin = 1 - hair;
  } else if (y > 0.36) skin = 0.8;
  return [skin, hair];
}

// ===========================================================================
const SHAPES = {
  buddha: { f: (x, y, z) => buddhaF(x, y, z), region: buddhaRegion },
  bodhi: { f: (x, y, z) => bodhiF(x, y, z), region: bodhiRegion },
};
export function getShape(name) { return SHAPES[name]; }
export const HAIR = { hairY, headSpace, HK, HPY, HPZ, HD };
