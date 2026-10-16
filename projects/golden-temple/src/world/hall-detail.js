// ---------------------------------------------------------------------------
// hall-detail: secondary / tertiary relief for the hall close-ups.
//  - rafterCap: gilt kibana fitting (wrapping sleeve + rimmed end plate + boss)
//  - tomoeDisc: eave tile end (rimmed disc, bead ring, gilt mitsudomoe)
//  - cornerPlate: scalloped gilt corner fitting with nail heads + engraved rim
//  - hinge: long gilt door strap with cusped end and studs
// Frames: flat ornaments face local +Z and lie in local XY (centred).
// ---------------------------------------------------------------------------
import { cbox, lathe, extrude, sweep, xf, mul, circlePts } from './hall-lib.js';

// Gilt rafter-end fitting. F: frame at the rafter END FACE centre, local +Z =
// outward along the rafter, +Y up, +X across. hw/hh: half width/height.
export function rafterCap(ms, F, hw, hh, opts = {}) {
  const sl = opts.sleeve ?? 0.045;
  const W = hw + 0.007, H = hh + 0.007;
  // sleeve band around the last few cm (reads as a gold collar from below)
  if (sl > 0) cbox(ms, mul(F, xf([0, 0, -sl / 2 + 0.002])), W, H, sl / 2, 0.003, { skip: new Set(['-z']) });
  // raised rim on the end plate
  const outer = [[-W, -H], [W, -H], [W, H], [-W, H]];
  const k = 0.7;
  const inner = [[-W * k, -H * (k + 0.06)], [W * k, -H * (k + 0.06)], [W * k, H * (k + 0.06)], [-W * k, H * (k + 0.06)]];
  extrude(ms, F, outer, [inner], 0.002, 0.008, { back: false });
  // domed boss (nail cover)
  const r = Math.min(W, H) * 0.42;
  if (opts.boss !== false) lathe(ms, mul(F, xf([0, 0, 0.002], 0, Math.PI / 2)), [[r, 0], [r * 0.95, 0.005], [r * 0.62, 0.011], [0, 0.014]], 8);
}

// Comma (tomoe) outline: round head (radius a) centred at distance c from the
// disc centre at angle ang0, tail sweeping clockwise and drifting outward.
function tomoeOutline(a, c, ang0, sweepA = 1.45) {
  const pts = [];
  const N = 10;
  const dir = (t) => [Math.cos(t), Math.sin(t)];
  const hc = [Math.cos(ang0) * c, Math.sin(ang0) * c];
  // head arc on the leading (counter-clockwise) side: outer point -> inner point
  for (let i = 0; i <= N; i++) { const d = dir(ang0 + (i / N) * Math.PI); pts.push([hc[0] + d[0] * a, hc[1] + d[1] * a]); }
  const T = 8;
  const rc = (u) => c + 0.55 * a * u;
  const hw = (u) => a * Math.pow(1 - u, 0.85);
  // inner edge of the tail (head inner point -> tip), then outer edge back
  for (let i = 1; i <= T; i++) { const u = i / T; const d = dir(ang0 - u * sweepA); const r = rc(u) - hw(u) * 0.8; pts.push([d[0] * r, d[1] * r]); }
  for (let i = T - 1; i >= 1; i--) { const u = i / T; const d = dir(ang0 - u * sweepA); const r = rc(u) + hw(u); pts.push([d[0] * r, d[1] * r]); }
  return pts;
}

// Eave tile end disc (axis = local +Y, face toward +Y). Dark rimmed disc with a
// bead ring (renju) and a gilt mitsudomoe in relief.
export function tomoeDisc(msTile, msGold, X, R = 0.122, th = 0.05) {
  lathe(msTile, X, [[0, -th], [R, -th], [R, 0], [R * 0.93, 0.014], [R * 0.84, 0.014], [R * 0.8, 0.004], [0, 0.004]], 16, { hardDeg: 40 });
  // flat frame for planar relief: XY plane = disc face, +Z = disc axis
  const F = mul(X, xf([0, 0.004, 0], 0, -Math.PI / 2));
  // bead ring
  const nb = 12, rb = R * 0.66, br = R * 0.055;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2;
    lathe(msTile, mul(F, xf([Math.cos(a) * rb, Math.sin(a) * rb, 0], 0, Math.PI / 2)), [[br, 0], [br * 0.8, br * 0.7], [0, br * 0.95]], 6);
  }
  {
    const mg = msGold || msTile;
    const a = R * 0.14, c = R * 0.25;
    for (let k = 0; k < 3; k++) extrude(mg, F, tomoeOutline(a, c, (k / 3) * Math.PI * 2 + 0.3), [], 0, 0.011 + k * 0.0006, { back: false });
    lathe(mg, mul(F, xf([0, 0, 0], 0, Math.PI / 2)), [[R * 0.07, 0], [R * 0.06, 0.012], [0, 0.016]], 8);
  }
}

// Scalloped gilt corner plate (w x h), faces +Z, centred, with an engraved
// (raised) inner rim, nail heads along the border and a central rosette boss.
export function cornerPlate(ms, X, w, h, t = 0.008, nails = 3) {
  const hw = w / 2, hh = h / 2;
  const cusp = Math.min(hw, hh) * 0.16;
  const pts = [[-hw, -hh]];
  // right edge: cusped (ogee-like) outline
  const NC = 5;
  pts.push([hw - cusp, -hh]);
  for (let i = 1; i < NC; i++) { const s = i / NC; pts.push([hw - cusp + (i % 2 ? cusp * 1.0 : 0), -hh + h * s]); }
  pts.push([hw - cusp, hh], [-hw, hh]);
  extrude(ms, X, pts, [], 0, t, { back: false });
  const ib = [[-hw + 0.012, -hh + 0.012], [hw - cusp - 0.012, -hh + 0.012], [hw - cusp - 0.012, hh - 0.012], [-hw + 0.012, hh - 0.012]];
  const ib2 = ib.map(([x, y]) => [x * 0.9 - (hw - cusp) * 0.0, y * 0.82]);
  extrude(ms, X, ib, [ib2], t, t + 0.004, { back: false });
  const nr = Math.min(w, h) * 0.06;
  for (let i = 0; i < nails; i++) {
    const u = -hw + 0.03 + ((w - cusp - 0.06) * (i + 0.5)) / nails;
    for (const sy of [-1, 1]) lathe(ms, mul(X, xf([u, sy * (hh - 0.03), t], 0, Math.PI / 2)), [[nr, 0], [nr * 0.7, nr * 0.6], [0, nr * 0.8]], 6);
  }
  const rr = Math.min(w, h) * 0.2;
  lathe(ms, mul(X, xf([-hw * 0.05, 0, t], 0, Math.PI / 2)), [[rr, 0], [rr * 0.9, rr * 0.25], [rr * 0.55, rr * 0.3], [rr * 0.4, rr * 0.5], [0, rr * 0.55]], 10);
}

// Long gilt hinge strap along local X (length L, height h), faces +Z, origin at
// the hinge end. Cusped fleur end, two nail rows.
export function hinge(ms, X, L = 0.6, h = 0.09, t = 0.007) {
  const hh = h / 2;
  const pts = [[0, -hh], [L - 0.07, -hh]];
  // cusped tip
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI; const r = hh * (1.25 + 0.35 * Math.cos(3 * a)); pts.push([L - 0.07 + Math.cos(a) * r * 0.9 + 0.02, Math.sin(a) * r]); }
  pts.push([L - 0.07, hh], [0, hh]);
  extrude(ms, X, pts, [], 0, t, { back: false });
  const nr = h * 0.13;
  for (let u = 0.06; u < L - 0.08; u += 0.11) lathe(ms, mul(X, xf([u, 0, t], 0, Math.PI / 2)), [[nr, 0], [nr * 0.7, nr * 0.6], [0, nr * 0.8]], 6);
  lathe(ms, mul(X, xf([L - 0.03, 0, t], 0, Math.PI / 2)), [[hh * 0.5, 0], [hh * 0.42, hh * 0.25], [0, hh * 0.38]], 8);
}

export { circlePts };

// Gilt column band (kazari-kanagu) with rolled rims and a ring of nail heads,
// wrapped around a round column of radius r, bottom at y0 (frame X at the axis).
export function columnBand(ms, X, r, H = 0.2, nails = 12) {
  const e = r + 0.004;
  lathe(ms, X, [[e, 0], [e + 0.012, 0.004], [e + 0.014, 0.018], [e + 0.008, 0.024], [e + 0.006, H - 0.024], [e + 0.012, H - 0.018], [e + 0.012, H - 0.004], [e, H]], 32, { hardDeg: 40 });
  for (let i = 0; i < nails; i++) {
    const a = (i / nails) * Math.PI * 2 + 0.13;
    const c = Math.cos(a), s = Math.sin(a);
    const F = mul(X, xf([c * (e + 0.006), H / 2, s * (e + 0.006)], Math.atan2(c, s)));
    lathe(ms, mul(F, xf([0, 0, 0], 0, Math.PI / 2)), [[0.016, 0], [0.012, 0.007], [0, 0.011]], 6);
  }
}

// Gilt pull ring (kan) on a rosette boss, in the local XY plane facing +Z.
export function pullRing(ms, X, R = 0.055, tube = 0.008) {
  lathe(ms, mul(X, xf([0, 0, 0], 0, Math.PI / 2)), [[0.04, 0], [0.036, 0.008], [0.022, 0.014], [0.012, 0.024], [0, 0.026]], 10);
  const path = [];
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI * 2; path.push([Math.cos(a) * R, -R + 0.01 + Math.sin(a) * R, 0.022]); }
  const prof = circlePts(0, 0, tube, 6);
  sweep(ms, path, prof, { closed: true, smooth: true, X, up: [0, 0, 1] });
}
