// CPU-only camera motion check: samples every shot at 60 fps and reports speed,
// acceleration spikes (jerks) and angular speed of the view direction.
// usage: node tools/camcheck.mjs
import { evalShot, SHOTS, SHOT_DUR } from '../src/shots.js';

const fps = 60, dt = 1 / fps;
for (let i = 0; i < SHOTS.length; i++) {
  const n = Math.round(SHOT_DUR * fps);
  const P = [], D = [], F = [];
  for (let f = 0; f <= n; f++) {
    const c = evalShot(i, Math.min(f * dt, SHOT_DUR - 1e-4));
    P.push(c.pos.clone()); D.push(c.look.clone().sub(c.pos).normalize()); F.push(c.focal);
  }
  const v = [], w = [];
  for (let f = 1; f <= n; f++) { v.push(P[f].distanceTo(P[f - 1]) / dt); w.push(Math.acos(Math.min(1, D[f].dot(D[f - 1]))) / dt * 180 / Math.PI); }
  let maxJerk = 0, at = 0, maxWJ = 0, atw = 0;
  for (let f = 1; f < v.length; f++) {
    const a = Math.abs(v[f] - v[f - 1]) / dt; if (a > maxJerk) { maxJerk = a; at = f * dt; }
    const aw = Math.abs(w[f] - w[f - 1]) / dt; if (aw > maxWJ) { maxWJ = aw; atw = f * dt; }
  }
  const vmax = Math.max(...v), wmax = Math.max(...w);
  console.log(`shot ${i}: keys=${SHOTS[i].keys.length} ease=${SHOTS[i].ease || 'inout'} speed max ${vmax.toFixed(2)} m/s | turn max ${wmax.toFixed(1)} deg/s | ` +
    `max accel ${maxJerk.toFixed(1)} m/s2 @${at.toFixed(2)}s | max turn-accel ${maxWJ.toFixed(0)} deg/s2 @${atw.toFixed(2)}s | focal ${F[0].toFixed(0)}->${F[n].toFixed(0)}`);
}
