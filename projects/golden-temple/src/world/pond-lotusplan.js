// ---------------------------------------------------------------------------
// Lotus / water-lily planting plan. Everything that depends on the film's
// camera paths lives here:
//  - shot "flower" (lotus macro): one hand-placed macro flower exactly at the
//    first key's focus point, bokeh flowers behind it, a composed bed for the
//    glide and the final bridge/hall frame, a clear lane for the lens.
//  - shot "pad" (water-level mirror): a hero water-lily pad at the first key's
//    focus point + a white lily beside it, clumps framing the reflections.
//  - colonies with irregular (noise-warped) outlines, water-lily patches.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { makeNoise, clamp, smooth } from './pond-util.js';

const TAU = Math.PI * 2;

// Dappled sun "leak" for the lotus shot (see pond-lotus.js LEAK_GLSL).
// uLeak = (centre x, centre z, radius, strength); uLeakCov shifts dapple coverage;
// uLeakShot = the film shot index where it is active
export const LEAK_UNIFORM = { value: new THREE.Vector4(6.0, 13.0, 0.0, 1.0) };
export const LEAK_COV = { value: 0.0 };
export const LEAK_SHOT = { value: 1.0 };

export function planLotus(ctx, site) {
  const r = ctx.rng('pond-lotus-plan');
  const noise = makeNoise(() => r.float());
  const L = site.L;
  const waterY = site.waterY;
  const bx = L.bridge ? L.bridge.north[0] : 10;
  const bz0 = L.bridge ? Math.min(L.bridge.north[2], L.bridge.south[2]) : 5;
  const bz1 = L.bridge ? Math.max(L.bridge.north[2], L.bridge.south[2]) : 27;
  const bhw = L.bridge ? L.bridge.width / 2 + 0.55 : 2.35;
  const pav = L.pavilion;

  const plan = { leavesE: [], leavesF: [], flowers: [], buds: [], pods: [], lilies: [], lilyFlowers: [], fallen: [] };
  const keepClear = []; // sight lines camera -> hero flower that leaves must not block
  const cell = 0.5;
  const hash = new Map();
  const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  function near(x, z, rad) {
    const res = [];
    const k0 = Math.floor((x - rad) / cell), k1 = Math.floor((x + rad) / cell);
    const l0 = Math.floor((z - rad) / cell), l1 = Math.floor((z + rad) / cell);
    for (let i = k0; i <= k1; i++) for (let j = l0; j <= l1; j++) {
      const a = hash.get(`${i},${j}`); if (a) res.push(...a);
    }
    return res;
  }
  function reg(p) { const k = key(p.x, p.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(p); }
  function spaceOK(x, z, rad, h, floating) {
    for (const o of near(x, z, rad + 0.6)) {
      const d = Math.hypot(o.x - x, o.z - z);
      const dh = Math.abs((o.h ?? 0) - h);
      const need = floating && o.floating ? (rad + o.rad) * 0.92 : (dh > 0.22 ? (rad + o.rad) * 0.45 : (rad + o.rad) * 0.78);
      if (d < need) return false;
    }
    return true;
  }

  const sd3 = ctx.sunDir || { x: -0.94, z: 0.34 };
  const SUN_AZ = Math.atan2(sd3.z, sd3.x);
  const paths = site.camPaths || [];
  const heroPath = paths.find((p) => p.kind === 'flower') || null;
  const padPath = paths.find((p) => p.kind === 'pad') || null;

  function excluded(x, z, rad) {
    if (site.sd(x, z) < rad * 0.6 + 0.25) return true;
    if (Math.abs(x - bx) < bhw + rad * 0.6 && z > bz0 - 1.0 && z < bz1 + 1.0) return true;
    if (site.landing && x > site.landing.minX - 0.6 - rad && x < site.landing.maxX + 0.6 + rad && z > site.landing.minZ - 0.6 - rad) return true;
    if (pav && x > pav.center[0] - pav.d / 2 - 2.6 && Math.abs(z - pav.center[2]) < pav.w / 2 + 0.8) return true;
    return false;
  }
  // camera clearance against every pond-skimming path (per sampled camera)
  function camOK(x, z, rad, h, floating, isHero) {
    if (!floating && !isHero) {
      for (const s of keepClear) {
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const l2 = dx * dx + dz * dz || 1;
        const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / l2, 0, 1);
        const d = Math.hypot(s.ax + dx * t - x, s.az + dz * t - z);
        if (d > rad + 0.08 || t > 0.97) continue;
        const lh = s.ah + (s.bh - s.ah) * t;
        if (h > lh - 0.24 && h < lh + 0.14) return false;
      }
    }
    for (const p of paths) {
      for (let k = 0; k < p.pts.length; k++) {
        const pt = p.pts[k];
        const c = pt.pos, lk = pt.look;
        let fx = lk[0] - c[0], fz = lk[2] - c[2];
        const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
        const vx = x - c[0], vz = z - c[2];
        const d = Math.hypot(vx, vz);
        const camH = c[1] - waterY;
        if (d < rad + 0.1) return false;
        if (!floating && d < rad + 0.4 && h > camH - 0.55) return false;
        const fwd = vx * fx + vz * fz, lat = Math.abs(-vx * fz + vz * fx);
        const wide = (pt.focal ?? 35) < 30;
        if (p.kind === 'pad') {
          if (wide) { if (fwd > 0 && fwd < 9.5 && lat < fwd * 0.42 + 0.4) { if (!floating || r.chance(0.8)) return false; } }
          else if (!floating && !isHero && fwd > -0.3 && fwd < 4.0 && lat < fwd * 0.55 + 0.4) return false;
        } else if (!isHero && !floating) {
          // lotus glide: a lane ahead of the lens stays below the eye line
          if (fwd > 0.2 && fwd < 7.5 && lat < fwd * 0.13 + 0.32 && h + rad * 0.4 > camH - 0.26) return false;
          // the final 26 mm frame keeps the bridge / hall view open
          if (wide && fwd > 0.5 && fwd < 11 && lat < fwd * 0.3 + 0.3 && h > camH - 0.1) return false;
        }
      }
    }
    return true;
  }
  const heroDist = (x, z) => {
    if (!heroPath) return 1e9;
    let best = 1e9;
    for (const pt of heroPath.pts) best = Math.min(best, Math.hypot(pt.pos[0] - x, pt.pos[2] - z));
    return best;
  };
  // closest approach of the lens to (x, z) with the lens height at that moment
  const lensPass = (x, z) => {
    let best = 1e9, hh = 0;
    for (const p of paths) for (const pt of p.pts) {
      const d = Math.hypot(pt.pos[0] - x, pt.pos[2] - z);
      if (d < best) { best = d; hh = pt.pos[1] - waterY; }
    }
    return { d: best, camH: hh };
  };

  function addPlant(kind, x, z, opts) {
    const p = { kind, x, z, ...opts };
    p.hero = p.hero || heroDist(x, z) < 3.6;
    reg(p);
    plan[kind].push(p);
    return p;
  }

  // ---- shot "flower": macro hero + composed bed -------------------------------
  if (heroPath) {
    const pts = heroPath.pts;
    const P0 = pts[0], PN = pts[pts.length - 1];
    const H = heroPath.hero;
    const dir2 = (pt) => { let x = pt.look[0] - pt.pos[0], z = pt.look[2] - pt.pos[2]; const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
    const leakC = H ? [H.at[0] + H.dir[0] * 2.6, H.at[2] + H.dir[2] * 2.6] : [P0.pos[0], P0.pos[2]];
    let leakR = 7.0, leakK = 1.0, leakC0 = 0.25;
    try {
      const sp = new URLSearchParams(location.search);
      if (sp.get('pondLeak') !== null) leakR = +sp.get('pondLeak');
      if (sp.get('pondLeakK') !== null) leakK = +sp.get('pondLeakK');
      if (sp.get('pondLeakC') !== null) leakC0 = +sp.get('pondLeakC');
    } catch (e) { /* no location */ }
    LEAK_UNIFORM.value.set(leakC[0], leakC[1], leakR, leakK);
    LEAK_COV.value = leakC0;
    LEAK_SHOT.value = heroPath.shot ?? 1;

    const placeHero = (kind, x, z, h, o) => {
      const tcam = o.camAt || P0.pos;
      const tc = Math.atan2(tcam[2] - z, tcam[0] - x);
      const p = addPlant(kind, x, z, {
        h, rad: 0.13, size: o.size ?? r.range(0.92, 1.08), open: o.open ?? 0.9, isHeroFlower: true,
        yaw: o.yaw ?? r.range(0, TAU),
        tilt: o.tilt ?? (kind === 'pods' ? r.range(0.35, 0.6) : (kind === 'buds' ? r.range(0.05, 0.16) : r.range(0.3, 0.5))),
        faceTo: kind === 'pods' ? tc + r.range(1.0, 2.0) : tc + (o.face ?? r.range(-0.35, 0.35)),
        hue: o.hue ?? (kind === 'buds' ? r.range(0.65, 0.95) : r.range(0.35, 0.8)),
        petalsLeft: 3, macro: !!o.macro,
      });
      p.hero = true;
      keepClear.push({ ax: tcam[0], az: tcam[2], ah: tcam[1] - waterY, bx: x, bz: z, bh: h });
      return p;
    };

    if (H) {
      // the macro flower: receptacle top exactly at the focus point, face turned to the lens
      const S = (H.size ?? 1.08) * 1.3;
      const tilt = 0.4;
      const tc = Math.atan2(H.cam[2] - H.at[2], H.cam[0] - H.at[0]) + 0.12;
      const topY = 0.0236 * S * Math.cos(tilt);
      const shift = 0.0236 * S * Math.sin(tilt);
      const fx = H.at[0] - Math.cos(tc) * shift, fz = H.at[2] - Math.sin(tc) * shift;
      const p = addPlant('flowers', fx, fz, {
        h: H.at[1] - waterY - topY, rad: 0.15, size: H.size ?? 1.08, open: H.open ?? 0.9,
        isHeroFlower: true, macro: true, yaw: 0.7, tilt, faceTo: tc, hue: 0.58, petalsLeft: 3,
      });
      p.hero = true;
      plan.macro = p;
      // bokeh behind the macro flower: pinks at 1-5 m along the opening view
      const [dx, dz] = [H.dir[0], H.dir[2]];
      const nl = Math.hypot(dx, dz) || 1;
      const ux = dx / nl, uz = dz / nl, rx = -uz, rz = ux;
      const hF = H.at[1] - waterY;
      const bokeh = [
        [0.95, 0.3, -0.06, 'buds', 0.06], [1.35, -0.42, 0.04, 'flowers', 0.62], [1.9, 0.62, 0.1, 'flowers', 0.88],
        [2.6, -0.85, 0.16, 'flowers', 0.95], [3.2, 0.1, 0.22, 'buds', 0.1], [3.9, 1.05, 0.2, 'flowers', 0.8],
        [4.6, -1.35, 0.3, 'pods', 0], [5.4, 0.6, 0.3, 'flowers', 0.9],
      ];
      for (const [s, lat, dy, kind, op] of bokeh) {
        let x = H.at[0] + ux * s + rx * lat, z = H.at[2] + uz * s + rz * lat;
        let h = clamp(hF + dy, 0.25, 1.25);
        // push away from the lens path where the lens would hit it
        for (let it = 0; it < 6; it++) {
          const lp = lensPass(x, z);
          if (lp.d > 0.42 || h < lp.camH - 0.45) break;
          x += rx * Math.sign(lat || 1) * 0.2; z += rz * Math.sign(lat || 1) * 0.2;
        }
        if (site.sd(x, z) < 0.5) continue;
        placeHero(kind, x, z, h, { open: op, camAt: H.cam });
      }
    }
    // final frame: foreground flowers below the eye line, framing the bridge
    {
      const C = PN.pos;
      const [ux, uz] = dir2(PN);
      const rx = -uz, rz = ux;
      const camH = C[1] - waterY;
      const fin = [
        [1.5, -0.85, -0.3, 'flowers', 0.85], [2.3, 1.0, -0.18, 'buds', 0.05], [3.1, -1.75, -0.1, 'flowers', 0.95],
        [3.7, 1.75, -0.14, 'flowers', 0.6], [4.6, -0.6, -0.25, 'flowers', 0.9], [5.6, 2.4, 0.0, 'buds', 0.1],
        [6.4, -2.5, 0.0, 'flowers', 0.8], [7.2, 1.1, -0.15, 'pods', 0], [8.2, -1.2, -0.05, 'flowers', 0.75],
        [2.0, -2.2, 0.06, 'flowers', 0.7], [4.2, 2.9, 0.08, 'buds', 0.08],
      ];
      for (const [s, lat, dy, kind, op] of fin) {
        const x = C[0] + ux * s + rx * lat, z = C[2] + uz * s + rz * lat;
        if (excluded(x, z, 0.2)) continue;
        const lp = lensPass(x, z);
        const h = clamp(camH + dy, 0.3, 1.25);
        if (lp.d < 0.45 && h > lp.camH - 0.45) continue;
        if (!spaceOK(x, z, 0.1, h, false)) continue;
        placeHero(kind, x, z, h, { open: op, camAt: C });
      }
    }
    // fallen petals near the spent flowers
    for (const p of plan.pods.filter((q) => q.isHeroFlower)) {
      for (let k = 0; k < 5; k++) {
        const a = r.range(0, TAU), d = r.range(0.12, 0.6);
        plan.fallen.push({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, yaw: r.range(0, TAU), size: r.range(0.9, 1.1), hue: r.range(0.3, 0.8) });
      }
    }
    // leaves around the macro flower: a broad backdrop leaf behind/below it, one
    // to the side at flower height, low cups in front (soft foreground)
    if (H) {
      const [ux, uz] = [H.dir[0] / (Math.hypot(H.dir[0], H.dir[2]) || 1), H.dir[2] / (Math.hypot(H.dir[0], H.dir[2]) || 1)];
      const rx = -uz, rz = ux;
      const hF = H.at[1] - waterY;
      const around = [
        // [fwd from flower, lat, dh, rad, tilt]
        [0.42, -0.08, -0.2, 0.36, 0.22], [0.25, 0.42, -0.06, 0.3, 0.3], [-0.12, -0.42, -0.24, 0.3, 0.18],
        [0.95, -0.55, -0.1, 0.34, 0.25], [1.2, 0.75, -0.02, 0.36, 0.3], [0.6, 0.95, 0.06, 0.33, 0.4],
        [1.7, -1.05, 0.05, 0.38, 0.35], [-0.3, 0.45, -0.3, 0.28, 0.15],
      ];
      for (const [f, lat, dh, rad, tilt] of around) {
        const x = H.at[0] + ux * f + rx * lat, z = H.at[2] + uz * f + rz * lat;
        const h = clamp(hF + dh, 0.12, 1.2);
        if (excluded(x, z, rad)) continue;
        const lp = lensPass(x, z);
        if (lp.d < rad + 0.25 && h > lp.camH - 0.4) continue;
        if (!spaceOK(x, z, rad * 0.7, h, false)) continue;
        addPlant('leavesE', x, z, { h, rad, yaw: r.range(0, TAU), tilt, tiltDir: SUN_AZ + r.range(-0.7, 0.7), age: r.range(0, 0.18), variant: r.int(0, 3), heroLeaf: true, beads: true });
      }
    }
    // framing canopy along the glide: leaves at the sides, some above the lens
    for (let t = 0; t < 900; t++) {
      const pi = r.int(0, pts.length - 1);
      const pt = pts[pi];
      const [ux, uz] = dir2(pt);
      const side = r.chance(0.5) ? 1 : -1;
      const lat = side * r.range(0.45, 3.4);
      const fw = r.range(-0.6, 5.5);
      const x = pt.pos[0] + ux * fw - uz * lat, z = pt.pos[2] + uz * fw + ux * lat;
      const rad = r.range(0.2, 0.4);
      const camH = pt.pos[1] - waterY;
      const al = Math.abs(lat);
      const tallOK = al > 1.4 || fw > 3.5;
      const h = tallOK && r.chance(0.4) ? r.range(camH - 0.2, camH + 0.4) : r.range(0.1, Math.max(0.15, camH - 0.25));
      if (excluded(x, z, rad)) continue;
      if (!camOK(x, z, rad, h, false, false)) continue;
      if (!spaceOK(x, z, rad, h, false)) continue;
      const close = Math.hypot(x - pts[0].pos[0], z - pts[0].pos[2]) < 3.0;
      addPlant('leavesE', x, z, { h, rad, yaw: r.range(0, TAU), tilt: 0.06 + Math.abs(r.gauss()) * 0.3, tiltDir: SUN_AZ + r.range(-1, 1) * 0.75, age: r.chance(0.2) ? r.range(0.4, 1) : r.range(0, 0.3), variant: r.int(0, 3), heroLeaf: close, beads: close && r.chance(0.6) });
    }
  }

  // ---- shot "pad": hero water-lily pad + lotus framing the lower corners -------
  if (padPath) {
    const H = padPath.hero;
    const rp = ctx.rng('pond-lotus-pad');
    if (H) {
      const [dx, dz] = [H.dir[0], H.dir[2]];
      const nl = Math.hypot(dx, dz) || 1;
      const ux = dx / nl, uz = dz / nl, rx = -uz, rz = ux;
      const camYaw = Math.atan2(-uz, -ux); // pointing back to the lens
      const pad = addPlant('leavesF', H.at[0], H.at[2], { h: 0, rad: 0.19, floating: true, heroPad: true, beads: true, yaw: camYaw + Math.PI + 0.5, variant: 0, age: 0.08 });
      pad.hero = true;
      plan.heroPad = pad;
      const lf = addPlant('lilyFlowers', H.at[0] + rx * 0.27 + ux * 0.16, H.at[2] + rz * 0.27 + uz * 0.16, { h: 0, rad: 0.15, floating: true, heroLily: true, yaw: rp.range(0, TAU), variant: 1, age: 0.1, pink: false, size: 1.3 });
      lf.hero = true;
      // fallen lotus petals drifting near the pad (pink accents in the backlit glitter)
      for (const [f, lat, yaw] of [[0.42, 0.02, 0.8], [1.15, 0.05, 2.6], [0.7, -0.7, 4.1]]) {
        const x = H.at[0] + ux * f + rx * lat, z = H.at[2] + uz * f + rz * lat;
        if (site.sd(x, z) > 0.3) plan.fallen.push({ x, z, yaw: camYaw + yaw, size: 1.05, hue: 0.55 + lat * 0.2 });
      }
      // a few more pads trailing into the background for depth
      const more = [[0.55, -0.32, 0.15], [0.9, 0.42, 0.13], [1.35, -0.1, 0.16], [1.9, 0.7, 0.14], [2.4, -0.75, 0.17], [-0.15, -0.38, 0.12], [3.0, 0.25, 0.15]];
      for (const [f, lat, rad] of more) {
        const x = H.at[0] + ux * f + rx * lat, z = H.at[2] + uz * f + rz * lat;
        if (site.sd(x, z) < rad + 0.15) continue;
        if (!spaceOK(x, z, rad, 0, true)) continue;
        const q = addPlant('lilies', x, z, { h: 0, rad, floating: true, yaw: rp.range(0, TAU), variant: rp.int(0, 2), age: rp.range(0, 0.6), pink: false, size: 1, padNear: true });
        q.hero = true;
      }
    }
    // lotus clumps framing the edges of the rising mirror view
    const frames = [padPath.pts[padPath.pts.length - 1], padPath.pts[Math.floor(padPath.pts.length * 0.6)]];
    const tanH = 18 / 24;
    const clumps = [
      [0, 3.0, -0.78, 6, 2], [0, 3.8, 0.76, 7, 1], [0, 5.6, -0.68, 4, 1], [0, 6.4, 0.68, 4, 1],
      [1, 3.1, -0.82, 5, 1], [1, 3.7, 0.82, 5, 2],
    ];
    for (const [fi, fw, lf, nL, nF] of clumps) {
      const C = frames[fi];
      let fx = C.look[0] - C.pos[0], fz = C.look[2] - C.pos[2];
      const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const camH = C.pos[1] - waterY;
      const cx = C.pos[0] + fx * fw - fz * lf * tanH * fw, cz = C.pos[2] + fz * fw + fx * lf * tanH * fw;
      const farOK = (x, z, rad, h) => {
        for (const q of padPath.pts) {
          const d = Math.hypot(q.pos[0] - x, q.pos[2] - z);
          if (d < rad + 0.9) return false;
          if (d < rad + 2.0 && h > q.pos[1] - waterY - 0.35) return false;
        }
        return true;
      };
      const items = [];
      for (let k = 0; k < nF; k++) items.push(k === 1 ? 'buds' : 'flowers');
      for (let k = 0; k < nL; k++) items.push(k % 3 === 2 ? 'leavesF' : 'leavesE');
      for (const kind of items) {
        for (let t = 0; t < 14; t++) {
          const a = rp.range(0, TAU), d = Math.sqrt(rp.float()) * (kind === 'leavesE' || kind === 'leavesF' ? 0.95 : 0.45);
          const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
          let rad, h;
          if (kind === 'leavesE') { rad = rp.range(0.24, 0.36); h = rp.range(0.08, Math.max(0.12, camH * 0.5)); }
          else if (kind === 'leavesF') { rad = rp.range(0.2, 0.3); h = 0; }
          else { rad = 0.13; h = rp.range(0.5, Math.min(0.95, camH - 0.12)); }
          if (excluded(x, z, rad)) continue;
          if (!farOK(x, z, rad, h)) continue;
          if (!spaceOK(x, z, rad, h, kind === 'leavesF')) continue;
          const opts = { h, rad, yaw: rp.range(0, TAU) };
          if (kind === 'leavesE') {
            opts.tilt = Math.abs(rp.gauss()) * 0.22; opts.tiltDir = rp.range(0, TAU);
            opts.age = rp.chance(0.2) ? rp.range(0.35, 0.7) : rp.range(0, 0.25); opts.variant = rp.int(0, 3);
          } else if (kind === 'leavesF') { opts.age = rp.range(0, 0.5); opts.variant = rp.int(0, 1); opts.floating = true; }
          else {
            opts.size = rp.range(0.95, 1.12);
            opts.open = kind === 'buds' ? rp.range(0.0, 0.1) : rp.range(0.6, 1.0);
            opts.tilt = rp.range(0.05, 0.3);
            opts.faceTo = Math.atan2(C.pos[2] - z, C.pos[0] - x) + rp.range(-0.5, 0.5);
            opts.hue = kind === 'buds' ? rp.range(0.65, 0.95) : rp.range(0.3, 0.8);
          }
          const pl = addPlant(kind, x, z, opts);
          pl.hero = true;
          break;
        }
      }
    }
  }

  // ---- colonies (noise-warped irregular outlines, ragged edges, outliers) ------
  const colonies = [
    { x: bx - 4.0, z: 12.5, rx: 2.2, rz: 5.5, d: 1.0 },
    { x: bx - 4.2, z: 23.0, rx: 2.0, rz: 3.0, d: 0.9 },
    { x: bx + 4.1, z: 10.5, rx: 2.4, rz: 4.0, d: 1.0 },
    { x: bx + 4.0, z: 21.0, rx: 2.3, rz: 3.4, d: 0.85 },
    { x: 19.6, z: 18.3, rx: 3.9, rz: 3.6, d: 1.05 },
    { x: 15.8, z: 14.6, rx: 2.6, rz: 2.4, d: 0.9 },
    { x: 21.2, z: 25.6, rx: 2.0, rz: 1.8, d: 0.9 },
    { x: -18.5, z: 10.0, rx: 4.5, rz: 2.8, d: 0.95 },
    { x: -22.5, z: 21.0, rx: 2.8, rz: 5.0, d: 0.85 },
    { x: -12.0, z: 30.3, rx: 5.0, rz: 2.3, d: 0.85 },
    { x: 1.5, z: 30.6, rx: 3.0, rz: 2.0, d: 0.7 },
    { x: 22.5, z: 31.0, rx: 3.6, rz: 1.9, d: 0.75 },
    { x: 38.5, z: 27.0, rx: 3.0, rz: 2.6, d: 0.8 },
    { x: 37.5, z: 11.0, rx: 3.0, rz: 2.4, d: 0.85 },
    { x: 27.0, z: 9.6, rx: 4.0, rz: 1.9, d: 0.8 },
    { x: -5.5, z: 9.2, rx: 3.5, rz: 1.9, d: 0.6 },
    { x: -3.0, z: 24.6, rx: 2.6, rz: 1.5, d: 0.55 },
  ];
  for (const c of colonies) {
    const area = Math.PI * c.rx * c.rz * 1.7;
    const tries = Math.round(area * c.d * 16);
    const so = r.range(0, 100);
    for (let t = 0; t < tries; t++) {
      const gx = r.range(-1.35, 1.35), gz = r.range(-1.35, 1.35);
      const x = c.x + gx * c.rx, z = c.z + gz * c.rz;
      // warped radial distance: lobes and bays along the margin
      const ang = Math.atan2(gz, gx);
      const warp = 0.32 * noise.fbm2(Math.cos(ang) * 1.3 + so, Math.sin(ang) * 1.3 - so, 3) + 0.18 * noise.n2(x * 0.45 + so, z * 0.45);
      const u = Math.hypot(gx, gz) / Math.max(0.4, 1 + warp);
      // density thins toward the edge; isolated outliers beyond it
      const keep = u < 0.75 ? 1 : (u < 1.08 ? 1 - smooth(0.75, 1.08, u) * 0.75 : (u < 1.3 ? 0.07 : 0));
      if (r.float() > keep) continue;
      const edge = clamp(u, 0, 1);
      const roll = r.float();
      let kind;
      if (roll < 0.66) kind = 'leavesE';
      else if (roll < 0.86) kind = 'leavesF';
      else if (roll < 0.93) kind = 'flowers';
      else if (roll < 0.972) kind = 'buds';
      else kind = 'pods';
      if (kind === 'leavesE' && edge > 0.8 && r.chance(0.5)) kind = 'leavesF';
      let rad, h;
      const hd = heroDist(x, z);
      const hmax = hd < 5.5 ? THREE.MathUtils.lerp(0.32, 1.0, smooth(1.0, 5.5, hd)) : 1.05;
      if (kind === 'leavesE') {
        // young leaves small, mature leaves broad
        const young = r.chance(0.18);
        rad = young ? r.range(0.12, 0.2) : r.range(0.2, 0.38);
        h = 0.12 + (hmax - 0.12) * (1 - edge * edge * 0.8) * Math.pow(r.float(), 0.8) * (young ? 0.7 : 1);
      } else if (kind === 'leavesF') { rad = r.range(0.13, 0.3); h = 0.0; }
      else { rad = 0.13; h = 0.3 + (hmax + 0.15 - 0.3) * (1 - edge * edge * 0.7) * r.range(0.35, 1.0); }
      if (excluded(x, z, rad)) continue;
      if (!camOK(x, z, rad, h, kind === 'leavesF', false)) continue;
      if (!spaceOK(x, z, rad, h, kind === 'leavesF')) continue;
      const opts = { h, rad, yaw: r.range(0, TAU) };
      if (kind === 'leavesE') {
        opts.tilt = Math.min(Math.abs(r.gauss()) * 0.28, 0.9) + (r.chance(0.08) ? r.range(0.4, 0.9) : 0);
        opts.tiltDir = hd < 5.5 ? SUN_AZ + r.range(-1.2, 1.2) * 0.6 : Math.atan2(z - c.z, x - c.x) + r.range(-1.2, 1.2);
        opts.age = r.chance(0.2) ? r.range(0.4, 1) : r.range(0, 0.35);
        opts.variant = r.int(0, 3);
      } else if (kind === 'leavesF') {
        opts.age = r.range(0, 0.6);
        opts.variant = r.int(0, 1);
      } else {
        opts.size = r.range(0.85, 1.15);
        opts.open = kind === 'buds' ? r.range(0, 0.12) : r.range(0.3, 0.97);
        opts.tilt = kind === 'pods' ? r.range(0.2, 0.7) : r.range(0, 0.3);
        opts.hue = kind === 'buds' ? r.range(0.6, 1.0) : r.range(0.2, 0.85);
        opts.petalsLeft = r.int(0, 3);
      }
      const pl = addPlant(kind, x, z, opts);
      if (kind === 'pods' && pl.petalsLeft < 2) {
        for (let k = 0; k < 2 - pl.petalsLeft; k++) {
          const a = r.range(0, TAU), d = r.range(0.1, 0.5);
          plan.fallen.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, yaw: r.range(0, TAU), size: r.range(0.9, 1.1), hue: r.range(0.3, 0.8) });
        }
      }
    }
  }
  // ---- water lily patches -----------------------------------------------------
  const lilyPatches = [
    { x: 37.0, z: 17.8, rx: 3.0, rz: 5.0, d: 1.0 },
    { x: -13.5, z: 18.5, rx: 2.6, rz: 3.2, d: 0.8 },
    { x: -5.0, z: 13.0, rx: 2.0, rz: 1.6, d: 0.7 },
    { x: 26.5, z: 23.5, rx: 2.4, rz: 1.8, d: 0.8 },
    { x: 31.0, z: 14.0, rx: 2.2, rz: 1.8, d: 0.7 },
    { x: -19.0, z: 27.5, rx: 2.4, rz: 2.0, d: 0.8 },
    { x: 4.5, z: 18.0, rx: 1.4, rz: 3.2, d: 0.6 },
    { x: 30.0, z: 26.4, rx: 1.6, rz: 1.1, d: 0.55 },
  ];
  for (const c of lilyPatches) {
    const area = Math.PI * c.rx * c.rz;
    const tries = Math.round(area * c.d * 14);
    const so = r.range(0, 100);
    for (let t = 0; t < tries; t++) {
      const [gx, gz] = r.disc();
      const x = c.x + gx * c.rx * 1.2, z = c.z + gz * c.rz * 1.2;
      const u = Math.hypot(gx, gz) * 1.2 / Math.max(0.4, 1 + 0.35 * noise.fbm2(x * 0.6 + so, z * 0.6, 2));
      if (u > 1 && !r.chance(0.08)) continue;
      const rad = r.range(0.1, 0.2);
      if (site.sd(x, z) < rad + 0.15) continue;
      if (Math.abs(x - bx) < bhw && z > bz0 - 0.5 && z < bz1 + 0.5) continue;
      if (site.landing && x > site.landing.minX - 0.5 && x < site.landing.maxX + 0.5 && z > site.landing.minZ - 0.5) continue;
      if (!camOK(x, z, rad, 0, true, false)) continue;
      if (!spaceOK(x, z, rad, 0, true)) continue;
      const kind = r.chance(0.12) ? 'lilyFlowers' : 'lilies';
      addPlant(kind, x, z, { h: 0, rad, floating: true, yaw: r.range(0, TAU), variant: r.int(0, 2), age: r.range(0, 1), pink: r.chance(0.45), size: r.range(0.85, 1.2) });
    }
  }
  for (const p of plan.leavesF) p.floating = true;

  // lotus mask into the site grid (for calm water)
  const { nx, nz, RES, lotusGrid } = site;
  const minX = site.rect.minX, minZ = site.rect.minZ;
  const splat = (p, rad, w) => {
    const i0 = Math.max(0, Math.floor((p.x - rad - minX) / RES)), i1 = Math.min(nx - 1, Math.ceil((p.x + rad - minX) / RES));
    const j0 = Math.max(0, Math.floor((p.z - rad - minZ) / RES)), j1 = Math.min(nz - 1, Math.ceil((p.z + rad - minZ) / RES));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(minX + i * RES - p.x, minZ + j * RES - p.z);
      if (d < rad) lotusGrid[j * nx + i] = Math.max(lotusGrid[j * nx + i], w * (1 - d / rad));
    }
  };
  for (const k of Object.keys(plan)) if (Array.isArray(plan[k])) for (const p of plan[k]) splat(p, (p.rad || 0.2) + 0.7, 1.0);
  plan.counts = Object.fromEntries(Object.entries(plan).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
  console.log('[world] pond: lotus plan', JSON.stringify(plan.counts));
  return plan;
}
