// TEST ONLY: a crude hall shell (walls with doors/windows, ceiling) so the
// interior can be lit realistically before the hall module exists.
// Enabled only with ?ishell=1 in the page URL.
import * as THREE from 'three';

export function buildTestShell(ctx, S) {
  const { geom, M } = ctx;
  const B = new geom.Builder();
  const { cx, cz, Y0 } = S;
  const x0 = cx - 12.5, x1 = cx + 12.5, z0 = cz - 8, z1 = cz + 8, yT = 9.2;
  const wallM = M.woodDark || M.plaster;
  const t = 0.25;
  // wall along an axis with openings: [{a,b,y0,y1}] in wall-local coordinate u
  function wall(axis, fixed, u0, u1, openings) {
    const pts = [u0, u1];
    for (const o of openings) pts.push(o.a, o.b);
    pts.sort((a, b) => a - b);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (b - a < 1e-3) continue;
      const mid = (a + b) / 2;
      const op = openings.find((o) => mid > o.a && mid < o.b);
      const segs = op ? [[Y0 - 0.05, op.y0], [op.y1, yT]] : [[Y0 - 0.05, yT]];
      for (const [ya, yb] of segs) {
        if (yb - ya < 1e-3) continue;
        const pos = axis === 'x' ? [mid, (ya + yb) / 2, fixed] : [fixed, (ya + yb) / 2, mid];
        const size = axis === 'x' ? [b - a, yb - ya, t] : [t, yb - ya, b - a];
        B.box(wallM, size[0], size[1], size[2], pos);
      }
      if (op) {
        // lattice bars
        for (let u = a + 0.12; u < b - 0.05; u += 0.14) {
          const pos = axis === 'x' ? [u, (op.y0 + op.y1) / 2, fixed] : [fixed, (op.y0 + op.y1) / 2, u];
          if (op.lattice) B.box(M.woodDark || wallM, axis === 'x' ? 0.035 : 0.06, op.y1 - op.y0, axis === 'x' ? 0.06 : 0.035, pos);
        }
      }
    }
  }
  const bay = 26 / 7;
  // front (south) wall: three open central bays, lattice windows in the side bays
  const front = [];
  for (let i = 0; i < 7; i++) {
    const a = cx - 13 + i * bay + 0.25, b = a + bay - 0.5;
    if (i >= 2 && i <= 4) front.push({ a, b, y0: Y0, y1: 7.1 });
    else front.push({ a, b, y0: Y0 + 0.9, y1: 6.2, lattice: true });
  }
  wall('x', z1 + t / 2, x0, x1, front);
  wall('x', z0 - t / 2, x0, x1, []);
  // west wall: high lattice windows (sunlit), east wall solid
  const west = [];
  for (const zz of [-5.1, -1.7, 1.7, 5.1]) west.push({ a: cz + zz - 1.2, b: cz + zz + 1.2, y0: 4.4, y1: 6.6, lattice: true });
  wall('z', x0 - t / 2, z0, z1, west);
  wall('z', x1 + t / 2, z0, z1, []);
  B.box(wallM, x1 - x0 + 1, 0.3, z1 - z0 + 1, [cx, yT + 0.15, cz]);
  // podium under the floor
  B.box(M.granite, 36, Y0 - 0.02, 27, [cx, (Y0 - 0.02) / 2, cz]);
  return B.build({ name: 'interior-testshell' });
}
