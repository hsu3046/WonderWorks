// ---------------------------------------------------------------------------
// hall-stair: vermilion balustrades flanking the main stair (bridge-style):
// stout square posts on gilt socks, every post crowned
// by a gilt-bronze giboshi, round top rail, mid and bottom rails with short
// struts, and a heavy newel post at the foot of the stair carrying black
// lacquer plaques with carved gilt crests. Hall-local coordinates.
// ---------------------------------------------------------------------------
import { cbox, bar, beam, xf, basis, mul, v3 } from './hall-lib.js';
import { giboshi, rosette } from './hall-orn.js';
import { peony, scroll, ridge2 } from './hall-carve.js';

// posts: [[x, yBase, z], ...]; newel: index of the heavy foot post
export function stairBalustrade(acc, mats, posts, newel = -1, opts = {}) {
  const red = acc.m(mats.red), gold = acc.m(mats.gold), goldB = acc.m(mats.goldB || mats.gold);
  const black = acc.m(mats.black), goldC = acc.m(mats.goldC || mats.gold);
  const H = opts.h || 0.95;
  const outX = opts.outX || 1; // side the balustrade's outer face looks to (+-x)
  posts.forEach((p, i) => {
    const isN = i === newel;
    const pw = isN ? 0.27 : 0.19;
    const h = isN ? H + 0.32 : H + 0.12;
    const top = p[1] + h;
    const d = p[3] || 0; // optional extension of the post below its rail base
    cbox(red, xf([p[0], p[1] + (h - d) / 2, p[2]]), pw / 2, (h + d) / 2, pw / 2, 0.016);
    // gilt sock, collar and cap plate
    cbox(gold, xf([p[0], p[1] - d + (isN ? 0.11 : 0.075), p[2]]), pw / 2 + 0.012, isN ? 0.11 : 0.075, pw / 2 + 0.012, 0.006);
    cbox(gold, xf([p[0], top - 0.065, p[2]]), pw / 2 + 0.013, 0.065, pw / 2 + 0.013, 0.006);
    cbox(red, xf([p[0], top + 0.03, p[2]]), pw / 2 + 0.035, 0.03, pw / 2 + 0.035, 0.01);
    cbox(gold, xf([p[0], top + 0.066, p[2]]), pw / 2 + 0.02, 0.006, pw / 2 + 0.02, 0.003);
    giboshi(goldB, xf([p[0], top + 0.072, p[2]]), pw * 0.64, pw * 2.35, 22);
    if (isN) {
      // plaques on the front (+z) face and the outer side face
      const faces = [
        { o: [p[0], 0, p[2] + pw / 2], ax: [1, 0, 0], az: [0, 0, 1] },
        { o: [p[0] + outX * pw / 2, 0, p[2]], ax: [0, 0, -outX], az: [outX, 0, 0] },
      ];
      for (const F of faces) {
        const yc = p[1] + 0.27 + (h - 0.45) / 2;
        const X = basis([F.o[0], yc, F.o[2]], F.ax, [0, 1, 0], F.az);
        cbox(gold, mul(X, xf([0, 0, 0.005])), 0.085, 0.215, 0.005, 0.002);
        cbox(black, mul(X, xf([0, 0, 0.011])), 0.07, 0.2, 0.004, 0.002);
        const Xc = mul(X, xf([0, 0, 0.015]));
        peony(goldC, Xc, 0, 0.06, 0.045, 0.006, 8);
        for (const s of [-1, 1]) scroll(goldC, mul(Xc, xf([0, 0, 0], 0, 0, 0, [s, 1, 1])), 0.02, -0.06, 0.03, Math.PI * 0.5, -1, 1.1, 0.006, 0.006);
        ridge2(goldC, Xc, [[0, -0.02], [0, -0.16]], 0.006, 0.006);
      }
    }
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    const dir = v3.norm(v3.sub(b, a));
    const side = v3.cross(dir, [0, 1, 0]);
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    // top rail (round, thick), mid rail, bottom rail
    bar(red, [a[0], a[1] + H, a[2]], [b[0], b[1] + H, b[2]], 0.06, 12, true);
    beam(red, [a[0], a[1] + H * 0.52, a[2]], [b[0], b[1] + H * 0.52, b[2]], 0.08, 0.12, 0.012);
    beam(red, [a[0], a[1] + 0.1, a[2]], [b[0], b[1] + 0.1, b[2]], 0.11, 0.11, 0.012);
    // gilt sleeves where the rails meet the posts
    for (const [p, s, pw] of [[a, 1, i === newel ? 0.27 : 0.19], [b, -1, i + 1 === newel ? 0.27 : 0.19]]) {
      const c = v3.add(p, v3.scale(dir, s * (pw / 2 + 0.055)));
      cbox(gold, basis([c[0], c[1] + H, c[2]], dir, [0, 1, 0], side), 0.05, 0.068, 0.068, 0.006);
      cbox(gold, basis([c[0], c[1] + H * 0.52, c[2]], dir, [0, 1, 0], side), 0.05, 0.068, 0.05, 0.005);
    }
    // struts (vertical, sheared to the slope)
    const n = Math.max(1, Math.round(L / 0.5));
    for (let k = 1; k < n; k++) {
      const t = k / n; const p = v3.lerp(a, b, t);
      cbox(red, basis([p[0], p[1] + H * 0.76, p[2]], dir, [0, 1, 0], side), 0.032, H * 0.23, 0.032, 0.006);
      cbox(red, basis([p[0], p[1] + H * 0.31, p[2]], dir, [0, 1, 0], side), 0.028, H * 0.16, 0.028, 0.005);
    }
  }
  void rosette;
}
