// Shot overrides owned by the vegetation module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
//
// Shot 9 (finale): opens 0.62 m from a backlit momiji spray hanging over the pond's south-east
// shore, looking west into the low sun (the sun itself peeks out behind one blade; gate, bridge and
// water melt into bokeh behind the glowing leaves). For ~1.8 s the camera breathes sideways around
// the spray (parallax through the layered blades, the sun flickering behind a lobe), then lifts
// straight up over the spray while the focus racks through the leaves onto the pagoda and bridge,
// and cranes up and back over the south-east shore, yawing north-west, to land high above the
// south-east corner on the whole precinct.
// The move is one continuous function (arc-length path + speed profile + look / lens curves)
// sampled every 0.25 s with linear easing, so the speed never jumps at a key.
// The macro spray in world/vegetation-hero.js is laid out in the frame of keys[0].
import * as THREE from 'three';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DUR = 7.0;

export function finale() {
  const C0 = V([36.9, 2.6, 24.6]);
  const SPRAY = V([36.294, 2.6375, 24.725]); // 0.62 m ahead: the sharp leaves
  const D0 = SPRAY.clone().sub(C0).normalize();
  const RT = new THREE.Vector3().crossVectors(D0, new THREE.Vector3(0, 1, 0)).normalize();
  const at = (r, u, b) => C0.clone().addScaledVector(RT, r).addScaledVector(D0, -b).add(new THREE.Vector3(0, u, 0));
  const path = new THREE.CatmullRomCurve3([
    C0, at(0.13, 0.035, 0.07), at(0.5, 0.9, 0.55), at(1.0, 3.1, 2.2), V([43.2, 9.6, 28.2]), V([53, 19.2, 40.4]), V([66, 31, 57]),
  ], false, 'centripetal');
  // speed profile (m/s): a breath on the leaves, a lift over them, the crane, a long soft landing
  const speed = (t) => 0.075 + 0.9 * sm(1.6, 2.6, t) + 15 * sm(2.5, 4.7, t) * (1 - 0.88 * sm(4.7, 7.0, t));
  const N = 700, cum = [0];
  for (let i = 1; i <= N; i++) { const t = ((i - 0.5) / N) * DUR; cum.push(cum[i - 1] + speed(t)); }
  const sAt = (t) => { const x = Math.min(N, Math.max(0, (t / DUR) * N)); const i = Math.min(N - 1, Math.floor(x)); return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / cum[N]; };
  const T1 = V([-30, 8.5, -3]), T2 = V([-14, 1, -10]);
  const p18 = path.getPointAt(sAt(1.8));
  const keys = [];
  for (let k = 0; k <= 28; k++) {
    const t = (k / 28) * DUR;
    const p = path.getPointAt(Math.min(1, sAt(t)));
    // tracks the spray while breathing; once lifting, the aim rides with the camera (no tilt-down)
    const tgt = SPRAY.clone().addScaledVector(p.clone().sub(p18), sm(1.5, 2.3, t));
    const d0 = tgt.clone().sub(p).normalize();
    const d1 = T1.clone().sub(p).normalize();
    const d2 = T2.clone().sub(p).normalize();
    const w1 = sm(1.9, 3.7, t), w2 = sm(3.5, 6.9, t);
    const dir = d0.clone().lerp(d1, w1).normalize().lerp(d2, w2).normalize();
    const ld = Math.exp(Math.log(tgt.distanceTo(p)) * (1 - w1) + Math.log(60) * w1);
    const look = p.clone().addScaledVector(dir, ld);
    const r = sm(2.05, 2.7, t);
    const focus = Math.exp(Math.log(tgt.distanceTo(p)) * (1 - r) + Math.log(30) * r * (1 - sm(3.4, 7, t)) + Math.log(85) * sm(3.4, 7, t));
    const fstop = 2.8 + 2.8 * sm(2.0, 3.0, t) + 4.4 * sm(3.4, 7, t);
    const focal = 45 - 14 * sm(2.1, 4.3, t) - 5 * sm(4.3, 7, t);
    const q = (v) => Math.round(v * 1000) / 1000;
    keys.push({ pos: [q(p.x), q(p.y), q(p.z)], look: [q(look.x), q(look.y), q(look.z)], focal: q(focal), focus: q(focus), fstop: q(fstop) });
  }
  return keys;
}

export default {
  9: {
    ease: 'linear',
    keys: finale(),
    near: 0.05,
    shadow: { center: [12, 0, 8], radius: 78 },
    post: { fog: 0.65, exposure: 0.95, dof: true, bloom: 0.015 },
  },
};
