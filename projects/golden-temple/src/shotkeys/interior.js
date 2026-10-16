// Shot overrides owned by the interior module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
//
// Shot 6 (inner sanctum): opens 1.55 m from the golden Amida's face, a little to its left
// (camera right), on the half-closed eyes, the crescent brows, the urna and the lips. For ~1.5 s
// the camera breathes back along a slow arc; then it pulls away in one continuous accelerating
// move that swings across the face, sinks under the fringe of the great gilt canopy (the bead
// strands sweep through the top of frame) and glides back over the altar while the lens widens,
// landing low on the worshippers' axis on the whole sanctum.
// The move is one continuous function sampled every 0.25 s with linear easing.
import * as THREE from 'three';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// quintic smootherstep (zero velocity AND acceleration at both ends: no kink where it hands over)
const s5 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * t * (t * (6 * t - 15) + 10); };
const DUR = 7.0;

export function sanctum() {
  const F = V([10, 6.43, -27.1]);          // the eyes (surface)
  const E0 = V([10, 6.4, -27.12]);          // macro aim: curls .. lips in frame, eyes above centre
  const T1 = V([10, 6.2, -27.3]);           // mid aim: head + mandorla
  const TE = V([10, 5.35, -27.4]);          // end aim: the whole altar / Amida
  const D0 = 1.55, DE = 12.1;
  // speed profile in log-distance: a slow breath, a long acceleration, a soft landing
  const v = (t) => 0.035 + sm(1.0, 3.3, t) * (1 - 0.93 * sm(3.7, 7.0, t));
  const N = 700, cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + v(((i - 0.5) / N) * DUR));
  const P = (t) => { const x = Math.min(N, Math.max(0, (t / DUR) * N)); const i = Math.min(N - 1, Math.floor(x)); return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / cum[N]; };
  const gEnd = ((DE - 1.15) ** 2) / (DE - 1.15 + 0.4);
  const yOf = (D) => {
    const x = Math.max(0, D - 1.15);
    const g = (x * x) / (x + 0.4);
    return 6.36 - 3.26 * (1 - Math.exp(-g / 3.2)) / (1 - Math.exp(-gEnd / 3.2));
  };
  const keys = [];
  for (let k = 0; k <= 28; k++) {
    const t = (k / 28) * DUR;
    const D = Math.exp(Math.log(D0) + (Math.log(DE) - Math.log(D0)) * P(t));
    // azimuth about the Amida's axis: starts on the camera-right 3/4, swings across, settles centred
    // opening (t < 2.5 s): starts further round on the 3/4 (the face turned against the warm
    // side light, its far cheek lit, the near side in soft shadow) on a slightly longer lens and
    // hands over to the pull-back with zero velocity/acceleration difference (quintic blend):
    // the keys from t = 2.5 s on are unchanged
    const o = 1 - s5(t / 2.5);
    const phi = 0.36 - 0.14 * sm(0, 2.0, t) - 0.42 * sm(1.4, 4.1, t) + 0.2 * sm(3.9, 7.0, t) + 0.26 * o;
    const pos = V([F.x + Math.sin(phi) * D, yOf(D), F.z + Math.cos(phi) * D]);
    const w1 = sm(1.6, 3.8, t), w2 = sm(3.4, 6.8, t);
    const tgt = E0.clone().lerp(T1, w1).lerp(TE, w2);
    const dir = tgt.clone().sub(pos).normalize();
    const ld = tgt.distanceTo(pos);
    const look = pos.clone().addScaledVector(dir, ld);
    const fp = F.clone().lerp(V([10, 5.9, -27.05]), sm(2.5, 6.5, t)).add(V([0.08 * o, 0, -0.015 * o]));
    const focus = fp.distanceTo(pos);
    const focal = (56 - 36 * sm(1.4, 6.3, t)) * (1 + 0.1 * o);
    const fstop = 5.6 + 2.4 * sm(2.5, 6.5, t);
    const q = (x) => Math.round(x * 1000) / 1000;
    keys.push({ pos: [q(pos.x), q(pos.y), q(pos.z)], look: [q(look.x), q(look.y), q(look.z)], focal: q(focal), focus: q(focus), fstop: q(fstop) });
  }
  return keys;
}

export default {
  6: {
    ease: 'linear',
    keys: sanctum(),
    near: 0.06,
    shadow: { center: [10, 5, -22], radius: 22 },
    noShadow: ['vegetation', 'terrain', 'buildings', 'pagoda'],
    post: { exposure: 1.0, dof: true },
  },
};
