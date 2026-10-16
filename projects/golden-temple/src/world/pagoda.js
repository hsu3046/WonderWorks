// ---------------------------------------------------------------------------
// Five-storey pagoda (goju-no-to) — fully procedural.
//
// Side-local frame: every side j (0..3) is generated in a local frame
// (x = lateral along the wall, y = up, p = outward distance from the centre)
// and rotated by j*90deg about the pagoda axis. Corner elements belong to the
// side's -x corner so nothing is generated twice.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as PP from './pagoda-parts.js';
import { woodProc, capGoldProc, goldProc, tileProc } from './pagoda-mat.js';

const { V3 } = PP;

// eave section constants (metres)
const TH = 0.32; // tile surface -> top of flying rafters (outer soffit)
const JD = 0.13; // flying rafter top -> base rafter top (inner soffit)
const RH = 0.11; // rafter height
const RW = 0.106; // rafter width (rafters nearly as wide as the gaps)

export function makeStoreys(L) {
  const P = L.pagoda;
  const NS = P.stories || 5;
  const S = [];
  const kk = [1, 0.95, 0.91, 0.875, 0.85];
  let F = P.platform.h + 0.16;
  for (let i = 0; i < NS; i++) {
    const k = kk[i] ?? 0.85;
    const s = { i, k, top: i === NS - 1 };
    s.kv = 0.85 * k; // vertical scale of the bracket tiers
    s.a = (P.baseWidth * Math.pow(P.shrink, i)) / 2;
    s.F = F;
    s.Hc = i === 0 ? 2.7 : 1.4 - 0.02 * (i - 1);
    s.T = F + s.Hc;
    s.p1 = s.a + 0.46 * k; s.p2 = s.a + 0.92 * k; s.p3 = s.a + 1.38 * k;
    s.gh = 0.22 * s.kv; // gangyo (eave purlin) height
    s.yG = s.T + 1.64 * s.kv; // gangyo top at mid-side
    s.O = (P.eaveOverhang + 0.3) * Math.pow(k, 0.5);
    s.flare = 0.6 * k;
    s.lift = (s.top ? 1.0 : 0.95) * k;
    s.liftExp = 1.65;
    s.Xc = s.a + s.O + s.flare;
    s.Rt = s.top ? 0.42 : (P.baseWidth * Math.pow(P.shrink, i + 1)) / 2 + 0.12;
    s.qa = s.top ? 0.28 : 0.42;
    const run = s.a + s.O - s.Rt;
    const rise = (s.top ? 0.6 : 0.44) * run;
    const t3 = (s.a + s.O - s.p3) / run;
    const Q3 = s.qa * t3 + (1 - s.qa) * t3 * t3;
    s.Ye = s.yG + RH + JD + TH - rise * Q3;
    s.Yt = s.Ye + rise;
    F = s.Yt + 0.32;
    S.push(s);
  }
  return S;
}

// --- roof surface ---------------------------------------------------------
const AX = (s, x) => Math.min(Math.abs(x) / s.Xc, 1);
export function pTip(s, x) { const A = AX(s, x); return s.a + s.O + s.flare * A * A * A; }
export function roofY(s, x, p) {
  const A = AX(s, x);
  const pt = s.a + s.O + s.flare * A * A * A;
  const t = (pt - p) / (pt - s.Rt);
  const tc = Math.max(t, -0.4);
  const Q = s.qa * tc + (1 - s.qa) * tc * tc;
  const l = 1 - Math.min(Math.max(t, 0), 1);
  return s.Ye + (s.Yt - s.Ye) * Q + s.lift * Math.pow(A, s.liftExp) * l * l;
}
// fixed point x = f(x) (corner on the diagonal)
const fixX = (f, x0) => { let x = x0; for (let i = 0; i < 40; i++) x = f(x); return x; };

export async function build(ctx) {
  const { M, geom, L, mat } = ctx;
  const PG = L.pagoda;
  const C = PG.center;
  const S = makeStoreys(L);
  const root = new THREE.Group();
  root.name = 'pagoda';
  root.position.set(C[0], C[1], C[2]);
  const B = new geom.Builder();
  const I = new PP.InstSet();
  const R = [0, 1, 2, 3].map((j) => new THREE.Matrix4().makeRotationY((j * Math.PI) / 2));
  const anchors = { bells: [], hangingLanterns: [] };

  // ---------------------------------------------------------------- materials
  // Backlight rig: when the camera looks toward the low sun across the pagoda (shots 1/8/9)
  // the shadow side picks up warm bounce from the sunlit ground/water and the golden sky, gilt
  // fittings glint, and sunlit grazing edges read as a warm rim. Weight pgB is constant over the
  // building (camera->pagoda azimuth vs sun azimuth), ~0 in front-lit shots (0, 4) and side-lit 7.
  const QP = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const qv = (k, d) => (QP.has(k) ? QP.get(k).split(',').map(Number) : d);
  const g3 = (a) => `vec3(${a.map((v) => (+v).toFixed(4)).join(', ')})`;
  const RIG = {
    fill: qv('pgfill', [1.1, 0.7, 0.32]), // indirect diffuse boost (shadow side)
    rim: qv('pgrim', [0.0, -0.15, -0.3]), // direct diffuse change of sunlit grazing wood (keeps the sunlit undersides from blowing out)
    gold: qv('pggold', [2.2, 1.6, 0.7]), // indirect specular boost of gilt metal
    tile: qv('pgtile', [1.4, 1.3, 1.2]), // indirect specular boost of the tiles (sky glints on tile rows)
    wall: qv('pgwall', [0.55, 0.42, 0.25]), // plaster fill
    wallSun: qv('pgwsun', [-0.3, -0.33, -0.38]), // plaster direct (grazing sun on the south walls -> no white blow-out)
  };
  // Sun glare cap: in the backlit views the south faces sit in the mirror direction between the
  // low sun and the camera, so glossy lacquer/gilt end faces flare to pure white. They should read
  // as warm gold glints -> soft-cap the direct (sun) specular, preserving hue.
  const CAP = { gold: qv('pgcapg', [2.2])[0], wood: qv('pgcapw', [0.45])[0] };
  const capGLSL = (v, cap) => `{ float _m = max(max(${v}.r, ${v}.g), max(${v}.b, 1e-5)); float _c = mix(1e5, ${cap.toFixed(3)}, pgB); ${v} *= _c / max(_m, _c); }`;
  const rigGLSL = (kind) => /* glsl */ `
    {
      vec2 pgV = normalize(vec2(${C[0].toFixed(3)}, ${C[2].toFixed(3)}) - cameraPosition.xz);
      float pgB = smoothstep(0.15, 0.55, dot(pgV, normalize(uSunDir.xz)));
      ${kind === 'gold' ? `reflectedLight.indirectSpecular *= 1.0 + pgB * ${g3(RIG.gold)};
      ${capGLSL('reflectedLight.directSpecular', CAP.gold)}` : ''}
      ${kind === 'wood' ? `reflectedLight.indirectDiffuse *= 1.0 + pgB * ${g3(RIG.fill)};
      reflectedLight.directDiffuse *= 1.0 + pgB * ${g3(RIG.rim)};
      ${capGLSL('reflectedLight.directSpecular', CAP.wood)}
      #ifdef USE_CLEARCOAT
      ${capGLSL('clearcoatSpecularDirect', CAP.wood * 2.0)}
      #endif` : ''}
      ${kind === 'tile' ? `reflectedLight.indirectSpecular *= 1.0 + pgB * ${g3(RIG.tile)};
      reflectedLight.indirectDiffuse *= 1.0 + pgB * ${g3(RIG.fill)} * 0.5;` : ''}
      ${kind === 'wall' ? `reflectedLight.indirectDiffuse *= 1.0 + pgB * ${g3(RIG.wall)};
      reflectedLight.directDiffuse *= 1.0 + pgB * ${g3(RIG.wallSun)};` : ''}
    }`;
  const rig = (proc, kind) => ({ ...proc, fragLight: (proc.fragLight || '') + rigGLSL(kind) });
  const P = mat.PROC;
  const MT = {
    red: mat.phys({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }, rig(woodProc('vec3(0.50, 0.072, 0.028)', C, { wear: 0.8 }), 'wood')),
    redDark: mat.phys({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }, rig(woodProc('vec3(0.30, 0.040, 0.020)', C, { wear: 0.6 }), 'wood')),
    gold: mat.std({ color: 0xffffff, roughness: 0.24, metalness: 1.0 }, rig(goldProc(), 'gold')),
    capGold: mat.std({ color: 0xffffff, roughness: 0.26, metalness: 1.0 }, rig(capGoldProc(), 'gold')),
    capSatin: mat.std({ color: 0xffffff, roughness: 0.38, metalness: 1.0 }, rig(capGoldProc('vec3(1.0, 0.68, 0.28)'), 'gold')),
    tile: mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12 }, rig(P.roofTile(), 'tile')),
    tileRound: mat.std({ color: 0xffffff, roughness: 0.42, metalness: 0.12 }, rig(tileProc('round'), 'tile')),
    tileFlat: mat.std({ color: 0xffffff, roughness: 0.45, metalness: 0.1 }, rig(tileProc('flat'), 'tile')),
    plaster: mat.std({ color: 0xffffff, roughness: 0.93, metalness: 0 }, rig(P.plaster(), 'wall')),
    green: mat.std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, rig(P.lacquer('vec3(0.05, 0.16, 0.11)'), 'wood')),
    dark: M.woodDark,
    granite: M.granite,
    graniteC: M.graniteClean,
    soffit: mat.std({ color: 0xffffff, roughness: 0.66, metalness: 0 }, rig(woodProc('vec3(0.25, 0.065, 0.03)', C, { wear: 0.0, grime: 0.6, planks: true }), 'wood')),
    // stained red-brown wood of the eave structure (brackets, rafters, purlins)
    wood: mat.phys({ color: 0xffffff, roughness: 0.58, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5 }, rig(woodProc('vec3(0.40, 0.105, 0.048)', C), 'wood')),
    goldSatin: mat.std({ color: 0xffffff, roughness: 0.42, metalness: 1.0 }, rig(goldProc('vec3(1.0, 0.68, 0.28)'), 'gold')),
    spireGold: mat.std({ color: 0xffffff, roughness: 0.3, metalness: 1.0 }, rig(goldProc('vec3(1.0, 0.62, 0.24)'), 'gold')),
  };

  // ---------------------------------------------------------------- helpers
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const m4 = (j, x, y, p, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().compose(_p.set(x, y, p), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    if (j !== null && j !== undefined) m.premultiply(R[j]);
    return m;
  };
  const basisM = (j, pos, xA, yA, zA, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Matrix4().makeBasis(xA.clone().multiplyScalar(sx), yA.clone().multiplyScalar(sy), zA.clone().multiplyScalar(sz));
    m.setPosition(pos);
    if (j !== null && j !== undefined) m.premultiply(R[j]);
    return m;
  };
  const box = (j, mt, w, h, d, x, y, p, ry = 0, c = 0.012, rx = 0) => B.add(PP.chamferBox(w, h, d, c), mt, m4(j, x, y, p, rx, ry));
  const addG = (j, g, mt) => B.add(g, mt, j === null || j === undefined ? null : R[j]);
  const UP = V3(0, 1, 0);
  // gold cap on a member end. pos = centre of end face, dir = outward axis.
  const capAt = (j, pos, dir, w, h, up = UP) => {
    const z = dir.clone().normalize();
    let x = V3().crossVectors(up, z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = V3().crossVectors(z, x).normalize();
    I.add(w * h > 0.03 ? 'capBig' : 'cap', basisM(j, pos.clone().addScaledVector(z, -0.012), x, y, z, w * 1.08, h * 1.08, 1));
  };
  // carved scroll eye on a side face: pos on the face, n = outward face normal
  const eyeAt = (j, pos, n, sc) => {
    const z = n.clone().normalize();
    const xA = V3().crossVectors(UP, z).normalize();
    I.add('armEye', basisM(j, pos, xA, UP, z, sc, sc, sc));
  };
  // projecting arm along +p, bottom y0
  const armP = (j, x, y0, pA, pB, h, w, cap = true) => {
    I.add('arm', m4(j, x, y0, (pA + pB) / 2, 0, -Math.PI / 2, 0, pB - pA, h / 0.24, w / 0.14));
    if (cap) {
      capAt(j, V3(x, y0 + h * 0.72, pB), V3(0, 0, 1), w, h * 0.5);
      const sc = h / 0.24;
      for (const sx of [-1, 1]) eyeAt(j, V3(x + sx * (w / 2 - 0.002), y0 + h * 0.56, pB - 0.13 * sc), V3(sx, 0, 0), sc);
    }
  };
  const toWorld = (j, v) => v.clone().applyMatrix4(R[j]).add(new THREE.Vector3(C[0], C[1], C[2]));

  // ---------------------------------------------------------------- instanced parts
  I.def('daito', PP.masuCoveGeo(0.58, 0.34, { c: 0.016 }), MT.wood, { jitter: 0.07, tint: [0.1, -0.05, -0.1] });
  I.def('makito', PP.masuCoveGeo(0.30, 0.18), MT.wood, { jitter: 0.08, tint: [0.1, -0.05, -0.1] });
  I.def('arm', PP.armGeo(0.24, 0.14, 1), MT.wood, { jitter: 0.06, tint: [0.1, -0.05, -0.1] });
  I.def('armEye', PP.armEyeGeo(), MT.wood, { jitter: 0.06, tint: [0.1, -0.05, -0.1] });
  I.def('rafter', PP.chamferBox(RW, RH, 1, 0.012), MT.wood, { jitter: 0.09, tint: [0.12, -0.04, -0.12] });
  I.def('cap', PP.capGeo(), MT.capGold);
  I.def('capBig', PP.capGeo(), MT.capSatin);
  const tj = { jitter: 0.14, tint: [-0.12, -0.04, 0.14] };
  I.def('tileR', PP.roundTileGeo(), MT.tileRound, tj);
  I.def('tileRs', PP.roundTileGeo(6, true), MT.tileRound, tj);
  I.def('discS', PP.discGeo(0.104, 0), MT.tile, tj);
  I.def('tileF', PP.flatTileGeo(), MT.tileFlat, tj);
  I.def('disc', PP.discGeo(), MT.tile, tj);
  I.def('lip', PP.lipGeo(), MT.tile, tj);
  I.def('noshi', PP.chamferBox(1, 0.048, 0.3, 0.008), MT.tile, { jitter: 0.12, tint: [-0.1, -0.03, 0.12] });
  const nrng = ctx.rng('pagoda-noshi');
  I.def('stud', PP.studGeo(), MT.gold);
  I.def('rosette', PP.rosetteGeo(), MT.gold);
  I.def('giboshi', PP.giboshiGeo(), MT.gold);

  // =====================================================================
  // PODIUM (kidan): granite, steps on four sides
  // =====================================================================
  function podium() {
    const H = PG.platform.h, hw = PG.platform.w / 2;
    const stW = 1.45; // stair half width
    const nSt = 5, rise = H / nSt, run = 0.31;
    const rowBlocks = (j, mt, x0, x1, seg, h, d, y0, pc, c = 0.02, skip = null) => {
      const n = Math.max(1, Math.round((x1 - x0) / seg));
      const L1 = (x1 - x0) / n;
      for (let q = 0; q < n; q++) {
        const a0 = x0 + q * L1, a1 = a0 + L1;
        const cx = (a0 + a1) / 2;
        if (skip && skip(cx)) continue;
        box(j, mt, L1 - 0.004, h, d, cx, y0 + h / 2, pc, 0, c);
      }
    };
    for (let j = 0; j < 4; j++) {
      // plinth course
      rowBlocks(j, MT.granite, -(hw + 0.1), hw + 0.1 - 0.5, 1.7, 0.18, 0.5, 0, hw + 0.1 - 0.25, 0.025);
      // wall: corner post, posts flanking the stair, panels
      const posts = [-hw + 0.18, -(stW + 0.55), stW + 0.55];
      for (const x of posts) box(j, MT.granite, 0.36, 0.8, 0.36, x, 0.18 + 0.4, hw - 0.17, 0, 0.03);
      // panels between posts (recessed)
      const spans = [[-hw + 0.36, -(stW + 0.73)], [stW + 0.73, hw - 0.36]];
      for (const [x0, x1] of spans) rowBlocks(j, MT.granite, x0, x1, 1.45, 0.8, 0.3, 0.18, hw - 0.17, 0.02);
      // coping
      rowBlocks(j, MT.granite, -(hw + 0.07), hw + 0.07 - 0.62, 1.5, 0.22, 0.62, 0.98, hw + 0.07 - 0.31, 0.03);
      // stairs
      for (let n = 1; n <= nSt; n++) {
        const yt = H - rise * n;
        const pf = hw + 0.07 + run * n;
        const p0 = hw - 0.2;
        box(j, MT.graniteC, 2 * stW + 0.06, yt, pf - p0, 0, yt / 2, (pf + p0) / 2, 0, 0.02);
      }
      // side parapets (sode-ishi)
      for (const sx of [-1, 1]) {
        const xi = sx * stW, xo = sx * (stW + 0.34);
        const pe = hw + 0.07 + run * nSt + 0.08;
        const pts = [];
        for (const x of [xi, xo]) {
          pts.push(V3(x, 0, hw - 0.3), V3(x, H + 0.16, hw - 0.3), V3(x, H + 0.16, hw + 0.25), V3(x, 0.34, pe - 0.12), V3(x, 0.34, pe), V3(x, 0, pe));
        }
        B.add(new PP.ConvexGeometry(pts), MT.granite, R[j]);
      }
    }
    // paving
    const pv = hw - 0.55;
    const rg = ctx.rng('pagoda-paving');
    for (let rI = 0, z = -pv; z < pv - 0.01; rI++) {
      const dz = Math.min(0.78, pv - z);
      let x = -pv + (rI % 2 ? 0.45 : 0);
      if (rI % 2) box(null, MT.graniteC, 0.45 - 0.006, 0.1, dz - 0.006, -pv + 0.225, H - 0.05, z + dz / 2, 0, 0.012);
      while (x < pv - 0.01) {
        const dx = Math.min(rg.range(0.85, 1.15), pv - x);
        box(null, MT.graniteC, dx - 0.006, 0.1 + rg.range(-0.004, 0.004), dz - 0.006, x + dx / 2, H - 0.05, z + dz / 2, 0, 0.012);
        x += dx;
      }
      z += dz;
    }
    // core fill
    B.add(new THREE.BoxGeometry(2 * hw - 0.2, H - 0.12, 2 * hw - 0.2), MT.granite, m4(null, 0, (H - 0.12) / 2, 0));
  }

  // =====================================================================
  // WALLS: columns, nageshi, plaster, doors with gold studs, lattice windows
  // =====================================================================
  function walls(s) {
    const { a, F, Hc, k, i } = s;
    const rc = i === 0 ? 0.27 : 0.215 * k;
    const hj = i === 0 ? 0.24 : 0.12;
    const hw0 = i === 0 ? 0.78 : 0.36;
    const hn = i === 0 ? 0.2 : 0.16;
    const hL = i === 0 ? 1.95 : Hc - 0.27 * k - hn;
    const kb = Hc - 0.27 * k, kt = Hc - 0.04;
    const bay = (2 * a) / 3;
    const pN = a + rc - 0.015;
    for (let j = 0; j < 4; j++) {
      const jy = (j % 2) * 0.01;
      for (const x of [-a, -a / 3, a / 3]) {
        B.add(new THREE.CylinderGeometry(rc * 0.97, rc, Hc, 24, 1), MT.red, m4(j, x, F + Hc / 2, a));
        B.add(new THREE.CylinderGeometry(rc + 0.014, rc + 0.016, 0.1, 24, 1), MT.gold, m4(j, x, F + 0.05, a));
        if (i === 0) {
          B.add(new THREE.CylinderGeometry(0.42, 0.46, 0.16, 24, 1), MT.granite, m4(j, x, F - 0.08, a));
        }
      }
      if (i === 0) box(j, MT.granite, 2 * a + 0.2, 0.16, 0.3, 0, F - 0.08, a, 0, 0.02);
      // nageshi (wrap the outside of the columns)
      const nx0 = -(a + rc + 0.035), nx1 = a + rc - 0.065;
      const nb = (y0, h) => box(j, MT.red, nx1 - nx0, h, 0.1, (nx0 + nx1) / 2, y0 + h / 2, pN, 0, 0.014);
      nb(F, hj);
      nb(F + hL, hn);
      // head tie (kashiranuki), projecting past the corners with gilt ends
      const kx = a + 0.32 * k;
      box(j, MT.red, 2 * kx, kt - kb + jy * 2, 0.15 * k, 0, F + (kb + kt) / 2, a, 0, 0.012);
      for (const sx of [-1, 1]) capAt(j, V3(sx * kx, F + (kb + kt) / 2, a), V3(sx, 0, 0), 0.15 * k, kt - kb);
      // gilt rosettes on the lintel at every column
      for (const x of [-a, -a / 3, a / 3, a]) {
        I.add('rosette', m4(j, x, F + hL + hn / 2, pN + 0.05, 0, 0, 0, k * (i === 0 ? 1.15 : 1), k * (i === 0 ? 1.15 : 1), 1));
        I.add('rosette', m4(j, x, F + hj / 2, pN + 0.05, 0, 0, 0, k * 0.8, k * 0.8, 1));
      }
      // bays
      for (let b = 0; b < 3; b++) {
        const xb0 = -a + b * bay, xb1 = xb0 + bay;
        const x0 = xb0 + rc * 0.7, x1 = xb1 - rc * 0.7, cx = (x0 + x1) / 2, w = x1 - x0;
        // upper plaster (kokabe)
        const yk0 = F + hL + hn, yk1 = F + kb;
        if (yk1 - yk0 > 0.03) box(j, MT.plaster, w, yk1 - yk0, 0.07, cx, (yk0 + yk1) / 2, a - 0.005, 0, 0.006);
        if (b === 1) {
          // doors
          const cl = a / 3 - rc; // clear half span
          const dh = hL - hj;
          for (const sx of [-1, 1]) box(j, MT.red, 0.13, dh, 0.17, sx * (cl - 0.065), F + hj + dh / 2, a + 0.03, 0, 0.012);
          const wl = cl - 0.13;
          const nr = i === 0 ? 6 : 3, nc = i === 0 ? 4 : 3;
          for (const sx of [-1, 1]) {
            const lx = sx * wl / 2;
            box(j, MT.redDark, wl - 0.012, dh - 0.01, 0.07, lx, F + hj + dh / 2, a + 0.0, 0, 0.01);
            // stiles/rails relief
            box(j, MT.red, wl - 0.02, 0.07, 0.03, lx, F + hj + dh * 0.5, a + 0.045, 0, 0.008);
            // studs
            for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
              const yy = F + hj + dh * (0.12 + (0.76 * r) / (nr - 1));
              const xx = lx + (wl - 0.02) * (-0.5 + (c + 0.5) / nc);
              I.add('stud', m4(j, xx, yy, a + 0.035, 0, 0, 0, i === 0 ? 1 : 0.8, i === 0 ? 1 : 0.8, 1));
            }
            // gilt hinge bands
            for (const fy of [0.06, 0.94]) box(j, MT.gold, wl - 0.03, 0.05 * (i === 0 ? 1 : 0.8), 0.012, lx, F + hj + dh * fy, a + 0.04, 0, 0.004);
            // ring pull
            B.add(new THREE.TorusGeometry(0.04 * k, 0.007, 6, 16), MT.gold, m4(j, sx * 0.06, F + hj + dh * 0.47, a + 0.05));
          }
        } else {
          // lower plaster, sill, renji lattice window
          box(j, MT.plaster, w, hw0 - hj, 0.07, cx, F + (hj + hw0) / 2, a - 0.005, 0, 0.006);
          const wy0 = F + hw0, wy1 = F + hL;
          box(j, MT.green, w, 0.075, 0.16, cx, wy0 + 0.0375, a + 0.02, 0, 0.01);
          for (const sx of [-1, 1]) box(j, MT.green, 0.075, wy1 - wy0, 0.15, cx + sx * (w / 2 - 0.0375), (wy0 + wy1) / 2, a + 0.02, 0, 0.01);
          const inner = w - 0.15;
          const nbar = Math.max(5, Math.round(inner / 0.105));
          const bh = wy1 - wy0 - 0.075;
          for (let q = 0; q < nbar; q++) {
            const xx = cx - inner / 2 + (inner * (q + 0.5)) / nbar;
            box(j, MT.green, 0.042, bh, 0.042, xx, wy0 + 0.075 + bh / 2, a + 0.02, Math.PI / 4, 0.006);
          }
          box(j, MT.green, inner, 0.035, 0.05, cx, wy0 + 0.075 + bh * 0.5, a + 0.02, 0, 0.006);
          box(j, i === 0 ? MT.dark : MT.plaster, w, wy1 - wy0, 0.03, cx, (wy0 + wy1) / 2, a - 0.05, 0, 0.004);
        }
      }
      // plaster behind the bracket zone
      box(j, MT.plaster, 2 * a, 1.3 * s.kv + 0.05, 0.06, 0, s.T - 0.04 + (1.3 * s.kv + 0.05) / 2, a - 0.045, 0, 0.005);
    }
  }

  // =====================================================================
  // BRACKET COMPLEXES (three-stepped mitesaki)
  // =====================================================================
  function brackets(s) {
    const { a, k, kv, T, p1, p2, p3 } = s;
    const bh = 0.24 * kv, bd = 0.13 * k;
    const yA1 = T + 0.22 * kv, yA2 = T + 0.64 * kv, yA3 = T + 1.06 * kv;
    const yM1 = T + 0.46 * kv, yM2 = T + 0.88 * kv, yM3 = T + 1.24 * kv;
    const ky = kv / k;
    const midX = [-2 * a / 3, 0, (2 * a) / 3];
    const setX = [-a / 3, a / 3, ...midX];
    const jTop = (x, p) => roofY(s, x, p) - TH - JD;
    const gB = (x) => jTop(x, p3) - RH - s.gh; // gangyo bottom
    const sq2 = Math.SQRT2;
    const mk = (j, x, y, p, sc = 1, syMul = 1) => I.add('makito', m4(j, x, y, p, 0, 0, 0, k * sc, kv * sc * syMul, k * sc));
    // block with a gilt plate on its outward face
    const mkc = (j, x, y, p, sc = 1, syMul = 1) => {
      mk(j, x, y, p, sc, syMul);
      const hh = 0.18 * kv * sc * syMul;
      capAt(j, V3(x, y + hh * 0.71, p + 0.15 * k * sc + 0.012), V3(0, 0, 1), 0.22 * k * sc, hh * 0.5);
    };
    for (let j = 0; j < 4; j++) {
      const jy = (j % 2) * 0.012 * k;
      for (const x of [-a, -a / 3, a / 3]) I.add('daito', m4(j, x, T, a, 0, 0, 0, k, kv, k));
      for (const x of midX) {
        box(j, MT.wood, 0.17 * k, 0.085 * kv + 0.04, 0.15 * k, x, T - 0.04 + (0.085 * kv + 0.04) / 2, a, 0, 0.01);
        I.add('daito', m4(j, x, T + 0.085 * kv, a, 0, 0, 0, 0.75 * k, 0.75 * kv, 0.75 * k));
      }
      // continuous beams (toshi-hijiki)
      const beamX = (p, y0, X, capEnds = true) => {
        box(j, MT.wood, 2 * X, bh + 2 * jy, bd, 0, y0 + bh / 2, p, 0, 0.012);
        if (capEnds) for (const sx of [-1, 1]) capAt(j, V3(sx * X, y0 + bh * 0.62, p), V3(sx, 0, 0), bd, bh * 0.6);
      };
      beamX(a, yA1, a + 0.46 * k + 0.22 * k);
      beamX(a, yA2, a + 0.92 * k + 0.22 * k);
      beamX(a, yA3, a + 0.3 * k);
      beamX(p1, yA2, p1 + 0.26 * k);
      beamX(p1, yA3, p1 + 0.26 * k);
      beamX(p2, yA3, p2 + 0.26 * k);
      // projecting sets
      for (const x of setX) {
        const big = Math.abs(Math.abs(x) - a / 3) < 1e-3;
        armP(j, x, yA1 - 0.01 * kv, a - 0.28 * k, p1 + 0.22 * k, bh + 0.02 * kv, 0.15 * k);
        armP(j, x, yA2 - 0.01 * kv, a - 0.28 * k, p2 + 0.22 * k, bh + 0.02 * kv, 0.15 * k);
        // odaruki (tail rafter) sloping down & out, carrying the third block
        const pa = a - 0.4 * k, pb = p3 + 0.34 * k;
        const ow = (big ? 0.17 : 0.15) * k, oh = 0.27 * kv;
        const ytop = (p) => yM3 + 0.12 * (p3 - p);
        const A = V3(x, ytop(pa) - oh / 2, pa), Bv = V3(x, ytop(pb) - oh / 2, pb);
        const d = V3().subVectors(Bv, A); const len = d.length(); d.normalize();
        const mid = V3().addVectors(A, Bv).multiplyScalar(0.5);
        box(j, MT.wood, ow, oh, len, mid.x, mid.y, mid.z, 0, 0.014, -Math.atan2(d.y, d.z));
        capAt(j, Bv, d, ow, oh);
        mkc(j, x, yM1, p1);
        mkc(j, x, yM2, p2);
        const g0 = gB(x);
        mkc(j, x, yM3, p3, 1, (g0 - yM3) / (0.18 * kv));
      }
      // makito rows on the wall plane and on the p1 beam
      const wallX = [];
      for (const xc of [-a, -a / 3, a / 3, a]) {
        wallX.push(xc - 0.46 * k, xc + 0.46 * k);
        if (xc !== a) wallX.push(xc);
      }
      wallX.push(...midX);
      for (const x of wallX) { mkc(j, x, yM1, a); mkc(j, x, yM2, a); }
      for (const sx of [-1, 1]) mk(j, sx * (a + 0.92 * k), yM2, a);
      const p1X = [-a, a, -a / 3, a / 3, -a / 3 - 0.46 * k, -a / 3 + 0.46 * k, a / 3 - 0.46 * k, a / 3 + 0.46 * k, ...midX];
      for (const x of p1X) mk(j, x, yM2, p1);
      // ---- corner (diagonal) set at the -x corner
      const dpos = (t) => [-a - t / sq2, a + t / sq2];
      const ryD = (-3 * Math.PI) / 4;
      const diagArm = (y0, tEnd, h, w) => {
        const t0 = -0.2 * k;
        const [cx, cp] = dpos((t0 + tEnd) / 2);
        I.add('arm', m4(j, cx, y0, cp, 0, ryD, 0, tEnd - t0, h / 0.24, w / 0.14));
        const [ex, ep] = dpos(tEnd);
        capAt(j, V3(ex, y0 + h * 0.72, ep), V3(-1 / sq2, 0, 1 / sq2), w, h * 0.5);
        const sc = h / 0.24;
        const [qx, qp] = dpos(tEnd - 0.13 * sc);
        for (const sg of [-1, 1]) eyeAt(j, V3(qx + sg * (w / 2 - 0.002) / sq2, y0 + h * 0.56, qp + sg * (w / 2 - 0.002) / sq2), V3(sg / sq2, 0, sg / sq2), sc);
      };
      diagArm(yA1 - 0.025 * kv, 0.46 * k * sq2 + 0.24 * k, bh + 0.05 * kv, 0.16 * k);
      diagArm(yA2 - 0.025 * kv, 0.92 * k * sq2 + 0.24 * k, bh + 0.05 * kv, 0.16 * k);
      mk(j, -p1, yM1, p1);
      mk(j, -p1, yM2, p1);
      mk(j, -p2, yM2, p2);
      {
        const t0 = -0.5 * k, t1 = 1.38 * k * sq2 + 0.52 * k;
        const ow = 0.2 * k, oh = 0.31 * kv;
        const tp3 = 1.38 * k * sq2;
        const ytop = (t) => yM3 + 0.085 * (tp3 - t);
        const [ax0, ap0] = dpos(t0), [bx0, bp0] = dpos(t1);
        const A = V3(ax0, ytop(t0) - oh / 2, ap0), Bv = V3(bx0, ytop(t1) - oh / 2, bp0);
        const d = V3().subVectors(Bv, A); const len = d.length(); d.normalize();
        const mid = V3().addVectors(A, Bv).multiplyScalar(0.5);
        // orient: yaw toward diagonal, pitch down
        const yaw = Math.atan2(d.x, d.z);
        const pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
        B.add(PP.chamferBox(ow, oh, len, 0.016), MT.wood, m4(j, mid.x, mid.y, mid.z, pitch, yaw, 0));
        capAt(j, Bv, d, ow, oh);
        const gc = gB(p3);
        mk(j, -p3, yM3, p3, 1.25, (gc - yM3) / (0.18 * kv * 1.25));
      }
      // gangyo (eave purlin): follows the slight corner rise of the rafters
      {
        const X = p3 + 0.3 * k;
        const pts = [], N = 28;
        for (let q = 0; q <= N; q++) {
          const x = -X + (2 * X * q) / N;
          pts.push(V3(x, gB(x) + s.gh / 2 - jy, p3));
        }
        addG(j, PP.sweep(pts, PP.rectProfile(0.17 * k, s.gh + 2 * jy, 0.014)), MT.wood);
        for (const sx of [-1, 1]) capAt(j, V3(sx * X, gB(sx * X) + s.gh * 0.55, p3), V3(sx, 0, 0), 0.17 * k, s.gh * 0.7);
      }
      // ceiling boards between the steps (noki-tenjo), facing down
      {
        const y1 = T + 1.3 * kv + 0.004;
        const quad = (pA, pB, yA, yB) => PP.gridSurface((u, v) => {
          const p = pA + (pB - pA) * v; const X = p;
          return V3(-X + 2 * X * u, yA + (yB - yA) * v, p);
        }, 1, 1, V3(0, -1, 0));
        addG(j, quad(a - 0.06, p2, y1, y1), MT.soffit);
        addG(j, quad(p2, p3, y1, gB(0) + 0.002), MT.soffit);
      }
    }
  }

  // =====================================================================
  // EAVES: double rafters, soffits, fascia, hip rafters, bells
  // =====================================================================
  function eaves(s) {
    const { a, k, p3 } = s;
    const pr = (x) => pTip(s, x) - 0.17;
    const pj = (x) => p3 + 0.55 * (pTip(s, x) - p3);
    const hTop = (x, p) => roofY(s, x, p) - TH;
    const jTop = (x, p) => roofY(s, x, p) - TH - JD;
    const sp = 0.25 * k;
    const N = Math.floor(s.Xc / sp);
    const rafter = (j, x, pA, pB, top) => {
      const A = V3(x, top(x, pA) - RH / 2, pA), Bv = V3(x, top(x, pB) - RH / 2, pB);
      const d = V3().subVectors(Bv, A); const len = d.length(); d.normalize();
      I.add('rafter', m4(j, x, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2, -Math.atan2(d.y, d.z), 0, 0, 1, 1, len));
      capAt(j, Bv, d, RW, RH);
    };
    const Xo = fixX((x) => pr(x) - 0.07, s.Xc);
    const Xi = fixX((x) => pj(x), s.Xc);
    const Xf = fixX((x) => pr(x) - 0.018, s.Xc), Xb = fixX((x) => pr(x) - 0.15, s.Xc);
    const pT2 = (x) => pTip(s, x) - 0.035;
    const X2 = fixX(pT2, s.Xc);
    for (let j = 0; j < 4; j++) {
      for (let r = -N; r <= N; r++) {
        const x = r * sp, X = Math.abs(x);
        const pjx = pj(x), prx = pr(x);
        const a0 = Math.max(p3 - 0.15 * k, X + 0.16 * k), a1 = pjx + 0.045;
        if (a1 - a0 > 0.14) rafter(j, x, a0, a1, jTop);
        const h0 = Math.max(pjx - 0.5, X + 0.16 * k), h1 = prx;
        if (h1 - h0 > 0.14) rafter(j, x, h0, h1, hTop);
      }
      // soffit boards (facing down)
      addG(j, PP.gridSurface((u, v) => {
        const x = -Xo + 2 * Xo * u, X = Math.abs(x);
        const lo = Math.min(Math.max(pj(x) - 0.01, X), pr(x) - 0.07);
        const hi = pr(x) - 0.07;
        const p = lo + (hi - lo) * v;
        return V3(x, hTop(x, p) - 0.001, p);
      }, 64, 4, V3(0, -1, 0)), MT.soffit);
      addG(j, PP.gridSurface((u, v) => {
        const x = -Xi + 2 * Xi * u, X = Math.abs(x);
        const hi = pj(x);
        const lo = Math.min(Math.max(p3 - 0.12 * k, X), hi);
        const p = lo + (hi - lo) * v;
        return V3(x, jTop(x, p) - 0.001, p);
      }, 64, 3, V3(0, -1, 0)), MT.soffit);
      // step band where the flying rafters start (facing out)
      addG(j, PP.gridSurface((u, v) => {
        const x = -Xi + 2 * Xi * u; const p = pj(x);
        return V3(x, jTop(x, p) - 0.002 + v * (JD + 0.004), p);
      }, 64, 1, V3(0, 0, 1)), MT.soffit);
      // fascia (kayaoi), mitred on the diagonals
      {
        const secs = [];
        const NS = 72;
        for (let q = 0; q <= NS; q++) {
          const u = -1 + (2 * q) / NS;
          const xf = u * Xf, xb = u * Xb;
          const pf = pr(xf) - 0.018, pb = pr(xb) - 0.15;
          secs.push([
            V3(xf, hTop(xf, pf) + 0.002, pf), V3(xf, roofY(s, xf, pf) - 0.05, pf),
            V3(xb, roofY(s, xb, pb) - 0.05, pb), V3(xb, hTop(xb, pb) + 0.002, pb),
          ]);
        }
        addG(j, PP.loft(secs), MT.red);
        // gilt edge strip along the top of the fascia (catches the low sun)
        const secsG = [];
        for (let q = 0; q <= NS; q++) {
          const u = -1 + (2 * q) / NS;
          const xa = u * fixX((x) => pr(x) - 0.006, s.Xc), xb2 = u * fixX((x) => pr(x) - 0.04, s.Xc);
          const pa = pr(xa) - 0.006, pb2 = pr(xb2) - 0.04;
          const ya = roofY(s, xa, pa) - 0.05, yb = roofY(s, xb2, pb2) - 0.05;
          secsG.push([V3(xa, ya - 0.035, pa), V3(xa, ya + 0.004, pa), V3(xb2, yb + 0.004, pb2), V3(xb2, yb - 0.035, pb2)]);
        }
        addG(j, PP.loft(secsG), MT.gold);
        // tile bed underside between fascia and disc row
        const secs2 = [];
        for (let q = 0; q <= NS; q++) {
          const u = -1 + (2 * q) / NS;
          const xf = u * Xf, x2 = u * X2;
          const pf = pr(xf) - 0.018, p2 = pT2(x2);
          const y1 = roofY(s, xf, pf) - 0.05, y2 = roofY(s, x2, p2) - 0.08;
          secs2.push([V3(xf, y1, pf), V3(x2, y2, p2), V3(x2, y2 + 0.04, p2), V3(xf, y1 + 0.04, pf)]);
        }
        addG(j, PP.loft(secs2), MT.tile);
      }
      // hip rafters (ji-sumigi + hien-sumigi) at the -x corner
      {
        const dJ = Xi, dR = fixX(pr, s.Xc);
        const mkSumi = (d0, d1, top, w, h, n = 10) => {
          const pts = [];
          for (let q = 0; q <= n; q++) {
            const d = d0 + ((d1 - d0) * q) / n;
            pts.push(V3(-d, top(d, d) - h / 2, d));
          }
          addG(j, PP.sweep(pts, PP.rectProfile(w, h, 0.02)), MT.wood);
          const E = pts[n], t = V3().subVectors(pts[n], pts[n - 1]).normalize();
          capAt(j, E, t, w, h);
          // engraved gilt sleeve plates wrapping the rafter end (sides + underside)
          {
            const sd = V3().crossVectors(t, UP).normalize();
            const u = V3().crossVectors(sd, t).normalize();
            const len = 0.34 * k;
            const c0 = E.clone().addScaledVector(t, -len / 2 - 0.006);
            for (const [nrm, half, wid] of [[sd, w / 2, h], [sd.clone().negate(), w / 2, h], [u.clone().negate(), h / 2, w]]) {
              const z = nrm.clone();
              const y = V3().crossVectors(z, t).normalize();
              I.add('capBig', basisM(j, c0.clone().addScaledVector(z, half - 0.012), t, y, z, len, wid * 1.06, 1));
            }
          }
          return { E, t };
        };
        mkSumi(a + 0.15, dJ + 0.06, jTop, 0.21 * k, 0.27 * k);
        const { E, t } = mkSumi(dJ - 0.5, dR + 0.08, hTop, 0.2 * k, 0.25 * k);
        // bell hook under the hien-sumigi tip
        const side = V3().crossVectors(t, UP).normalize();
        const u2 = V3().crossVectors(side, t).normalize();
        const hook = E.clone().addScaledVector(t, -0.12).addScaledVector(u2, -0.125 * k - 0.05);
        {
          // gilt hanger: plate on the rafter underside, bolt heads, and the eye the bell hangs from
          const pl = E.clone().addScaledVector(t, -0.14).addScaledVector(u2, -0.125 * k - 0.024);
          B.add(PP.chamferBox(0.13 * k, 0.012, 0.26, 0.004), MT.gold, basisM(j, pl, side, u2, t.clone().negate()));
          for (const f of [-0.09, 0.09]) B.add(new THREE.SphereGeometry(0.013, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), MT.gold, basisM(j, pl.clone().addScaledVector(t, f).addScaledVector(u2, -0.005), side, u2.clone().negate(), t));
          const eyeR = new THREE.TorusGeometry(0.026, 0.0075, 6, 14);
          const th = V3(t.x, 0, t.z).normalize();
          B.add(eyeR, MT.gold, basisM(j, hook.clone().addScaledVector(u2, 0.024), th, UP, V3().crossVectors(th, UP).normalize()));
        }
        const wp = toWorld(j, hook);
        // sails turned ~25deg off the hip diagonal: a sail facing straight down the diagonal mirrors the low
        // WSW sun into every camera on that diagonal (blown-out white plate)
        anchors.bells.push({ pos: [wp.x, wp.y, wp.z], scale: 1.9 - 0.1 * s.i, rotY: (-j * Math.PI) / 2 - Math.PI / 4 + 0.44 });
      }
      // smaller bell at the middle of each side, hung from a gilt eye under the flying rafters
      {
        const pm = pr(0) - 0.32;
        const yh = hTop(0, pm) - RH;
        B.add(new THREE.TorusGeometry(0.03, 0.008, 5, 12), MT.gold, m4(j, 0, yh - 0.02, pm, 0, Math.PI / 2, 0));
        const wp = toWorld(j, V3(0, yh - 0.045, pm));
        anchors.bells.push({ pos: [wp.x, wp.y, wp.z], scale: 1.3 - 0.06 * s.i, rotY: (-j * Math.PI) / 2 });
      }
    }
  }

  // =====================================================================
  // ROOF: hongawara tiling, disc eave tiles, hip ridges with onigawara
  // =====================================================================
  function roof(s) {
    const tp = 0.29, Ls = 0.295;
    const n = Math.floor((s.Xc - 0.14) / tp);
    const e = 0.02;
    const nrm = (x, p) => {
      const dx = (roofY(s, x + e, p) - roofY(s, x - e, p)) / (2 * e);
      const dp = (roofY(s, x, p + e) - roofY(s, x, p - e)) / (2 * e);
      return V3(-dx, 1, -dp).normalize();
    };
    for (let j = 0; j < 4; j++) {
      const place = (key, x, f, b, sc = 1) => {
        const A = V3(x, roofY(s, x, f), f), Bp = V3(x, roofY(s, x, b), b);
        const z = V3().subVectors(A, Bp); const len = z.length(); z.normalize();
        const nn = nrm(x, (f + b) / 2);
        const y = nn.addScaledVector(z, -nn.dot(z)).normalize();
        const xA = V3().crossVectors(y, z).normalize();
        const Lt = len + 0.035;
        I.add(key, basisM(j, A.clone().addScaledVector(z, -Lt / 2), xA, y, z, sc, sc, Lt / PP.TILE.L));
        return { A, xA, y, z };
      };
      const lod = s.i >= 3;
      const row = (x, key) => {
        const X = Math.abs(x);
        const pt = pTip(s, x);
        const pEnd = s.top ? Math.max(0.6, X + 0.16) : Math.max(s.Rt - 0.05, X + 0.16);
        if (pt - pEnd < 0.05) return;
        let f = pt, first = true;
        while (f > pEnd) {
          const b = f - Ls;
          const fr = place(key === 'tileR' && lod ? 'tileRs' : key, x, f, b);
          if (first) {
            if (key === 'tileR') I.add(lod ? 'discS' : 'disc', basisM(j, fr.A.clone().addScaledVector(fr.y, 0.03).addScaledVector(fr.z, 0.004), fr.xA, fr.y, fr.z));
            else I.add('lip', basisM(j, fr.A.clone().addScaledVector(fr.y, 0.004), fr.xA, fr.y, fr.z));
          }
          f = b; first = false;
        }
      };
      for (let r = -n; r <= n; r++) row(r * tp, 'tileR');
      for (let r = -n - 1; r <= n; r++) { const x = (r + 0.5) * tp; if (Math.abs(x) < s.Xc - 0.12) row(x, 'tileF'); }

      // hip ridge (kudarimune) at the -x corner
      const dTip = s.Xc - 0.1;
      const dTop = s.top ? 0.25 : s.Rt - 0.15;
      const NR = 22;
      const pts = [];
      for (let q = 0; q <= NR; q++) {
        const d = dTip + ((dTop - dTip) * q) / NR;
        pts.push(V3(-d, roofY(s, d, d) - 0.02, d));
      }
      const kr = 1.38 * Math.min(1, 0.85 + 0.15 * s.k);
      // hidden core (the visible body is made of individual noshi tiles below)
      const prof = [[-0.17, -0.07], [0.17, -0.07], [0.17, 0.2], [-0.17, 0.2]].map(([u, v]) => [u * kr, v * kr]);
      // stacked, staggered noshi-gawara: individual tiles with joints that break up the sunlit sides
      {
        const cum = [0];
        for (let q = 1; q <= NR; q++) cum.push(cum[q - 1] + pts[q].distanceTo(pts[q - 1]));
        const total = cum[NR];
        const frameAt = (sa) => {
          let q = 1;
          while (q < NR && cum[q] < sa) q++;
          const f = (sa - cum[q - 1]) / Math.max(1e-6, cum[q] - cum[q - 1]);
          const P = V3().lerpVectors(pts[q - 1], pts[q], Math.min(Math.max(f, 0), 1));
          const t = V3().subVectors(pts[q], pts[q - 1]).normalize();
          const side = V3().crossVectors(t, UP).normalize();
          const u2 = V3().crossVectors(side, t).normalize();
          return { P, t, side, u2 };
        };
        const TL = 0.31;
        for (let m = 0; m < 4; m++) {
          const w = (0.44 - 0.026 * m) * kr, vC = (0.017 + 0.054 * m) * kr;
          for (let sa = 0.05 + (m % 2) * TL * 0.5; sa < total - 0.05; sa += TL) {
            const { P, t, side, u2 } = frameAt(sa + TL / 2);
            const pos = P.clone().addScaledVector(u2, vC).addScaledVector(side, nrng.range(-0.006, 0.006));
            const z = t.clone().applyAxisAngle(u2, nrng.range(-0.012, 0.012));
            const xA = V3().crossVectors(u2, z).normalize();
            I.add('noshi', basisM(j, pos, xA, u2, z, w, kr, 1));
          }
        }
      }
      // custom loft with a low reference point so step faces orient correctly
      {
        const secs = [], refs = [];
        for (let q = 0; q <= NR; q++) {
          const t = V3().subVectors(pts[Math.min(q + 1, NR)], pts[Math.max(q - 1, 0)]).normalize();
          const side = V3().crossVectors(t, UP).normalize();
          const u2 = V3().crossVectors(side, t).normalize();
          secs.push(prof.map(([u, v]) => pts[q].clone().addScaledVector(side, u).addScaledVector(u2, v)));
          refs.push(pts[q].clone().addScaledVector(u2, -0.6));
        }
        addG(j, PP.loft(secs, { refs }), MT.tile);
        // cap tiles along the ridge top
        let acc = 0;
        for (let q = NR; q > 0; q--) {
          const P0 = pts[q], P1 = pts[q - 1];
          const seg = P0.distanceTo(P1);
          acc += seg;
          if (acc < 0.27 && q > 1) continue;
          acc = 0;
          const z = V3().subVectors(P1, P0).normalize(); // toward the eave tip
          const side = V3().crossVectors(z, UP).normalize();
          const y = V3().crossVectors(side, z).normalize();
          const xA = V3().crossVectors(y, z).normalize();
          const pos = P1.clone().addScaledVector(y, 0.215 * kr - 0.01).addScaledVector(z, -0.17);
          I.add(lod ? 'tileRs' : 'tileR', basisM(j, pos, xA, y, z, 1.3 * kr, 1.3 * kr, 1));
        }
        // end disc of the cap line + onigawara
        const P0 = pts[0], P1 = pts[1];
        const z = V3().subVectors(P0, P1).normalize();
        const side = V3().crossVectors(z, UP).normalize();
        const y = V3().crossVectors(side, z).normalize();
        const xA = V3().crossVectors(y, z).normalize();
        I.add('disc', basisM(j, P0.clone().addScaledVector(y, 0.215 * kr + 0.03).addScaledVector(z, 0.05), xA, y, z, 1.25 * kr, 1.25 * kr, 1.25 * kr));
        const og = PP.onigawaraGeo();
        B.add(og, MT.tile, m4(j, P0.x + 0.03, P0.y + 0.05, P0.z - 0.03, 0.06, -Math.PI / 4, 0, 0.7 * kr, 0.7 * kr, 0.7 * kr));
        // toribusuma: an upturned round tile with its own mon disc, riding over the onigawara crown
        {
          const h = V3(z.x, 0, z.z).normalize();
          const zU = h.clone().multiplyScalar(Math.cos(0.55)).addScaledVector(UP, Math.sin(0.55)).normalize();
          const xU = V3().crossVectors(UP, zU).normalize();
          const yU = V3().crossVectors(zU, xU).normalize();
          const sc = 0.82 * kr, Lt = PP.TILE.L * sc * 1.15;
          const base = P0.clone().addScaledVector(h, -0.3 * kr).addScaledVector(UP, 0.42 * kr);
          I.add(lod ? 'tileRs' : 'tileR', basisM(j, base.clone().addScaledVector(zU, Lt / 2), xU, yU, zU, sc, sc, 1.15 * sc));
          I.add(lod ? 'discS' : 'disc', basisM(j, base.clone().addScaledVector(zU, Lt + 0.004).addScaledVector(yU, 0.03 * sc), xU, yU, zU, sc, sc, sc));
        }
      }
    }
  }

  // =====================================================================
  // BALCONY (koshi) with railing and gilt giboshi (storeys 2..5)
  // =====================================================================
  function balcony(s, below) {
    const { a, F, k } = s;
    const bw = 0.8 * k, pb = a + bw;
    const eb = 0.19 * k; // edge beam height
    B.add(PP.chamferBox(2 * pb - 0.02, 0.1, 2 * pb - 0.02, 0.01), MT.soffit, m4(null, 0, F - 0.05, 0));
    const pS = pb - 0.3 * k;
    for (let j = 0; j < 4; j++) {
      const jy = (j % 2) * 0.012;
      // edge beam
      box(j, MT.red, 2 * pb - 0.09, eb + jy, 0.09, -0.045, F - eb / 2 + 0.005, pb - 0.045, 0, 0.012);
      // small brackets under the overhang
      const yArm = F - eb - 0.1 * k, yMk = yArm - 0.126 * k;
      const nM = Math.max(3, Math.round((2 * pS) / (0.48 * k)));
      for (let q = 0; q <= nM; q++) {
        const x = -pS + (2 * pS * q) / nM;
        if (q === nM) continue; // next side's corner
        I.add('makito', m4(j, x, yMk, pS, 0, 0, 0, 0.7 * k, 0.7 * k, 0.7 * k));
        if (q > 0) armP(j, x, yArm, pS - 0.12 * k, pb - 0.05, 0.1 * k, 0.08 * k, false);
      }
      // skirt board down to the roof below
      {
        const secs = [];
        const NS = 36;
        const XF = pS + 0.03, XB = pS - 0.03;
        for (let q = 0; q <= NS; q++) {
          const u = -1 + (2 * q) / NS;
          const xf = u * XF, xb = u * XB;
          const yt = yMk;
          secs.push([
            V3(xf, roofY(below, xf, pS + 0.03) - 0.06, pS + 0.03), V3(xf, yt, pS + 0.03),
            V3(xb, yt, pS - 0.03), V3(xb, roofY(below, xb, pS - 0.03) - 0.06, pS - 0.03),
          ]);
        }
        addG(j, PP.loft(secs), MT.red);
      }
      // railing (koran)
      const pr = pb - 0.07;
      const yH = F + 0.74 * k, yM = F + 0.44 * k, yB = F + 0.05 * k;
      const mainX = [-pr, -a, -a / 3, a / 3, a];
      for (const x of mainX) {
        box(j, MT.red, 0.12 * k, 0.86 * k, 0.12 * k, x, F + 0.43 * k, pr, 0, 0.014);
        I.add('giboshi', m4(j, x, F + 0.86 * k, pr, 0, 0, 0, 0.85 * k, 0.85 * k, 0.85 * k));
        box(j, MT.gold, 0.135 * k, 0.035 * k, 0.135 * k, x, F + 0.86 * k - 0.018, pr, 0, 0.005);
        box(j, MT.gold, 0.135 * k, 0.03 * k, 0.135 * k, x, yH - 0.065 * k, pr, 0, 0.005);
      }
      const RX = pr + 0.13;
      B.add(new THREE.CylinderGeometry(0.044 * k, 0.044 * k, 2 * RX, 12, 1), MT.red, m4(j, 0, yH + jy, pr, 0, 0, Math.PI / 2));
      for (const sx of [-1, 1]) B.add(new THREE.CylinderGeometry(0.049 * k, 0.049 * k, 0.08, 12, 1), MT.gold, m4(j, sx * (RX - 0.035), yH + jy, pr, 0, 0, Math.PI / 2));
      box(j, MT.red, 2 * (pr + 0.08), 0.075 * k + jy, 0.065 * k, 0, yM, pr, 0, 0.01);
      box(j, MT.red, 2 * (pr + 0.06), 0.09 * k + jy, 0.085 * k, 0, yB, pr, 0, 0.01);
      // short struts
      const nT = Math.round((2 * pr) / 0.42);
      for (let q = 0; q < nT; q++) {
        const x = -pr + (2 * pr * (q + 0.5)) / nT;
        if (mainX.some((m) => Math.abs(m - x) < 0.1)) continue;
        box(j, MT.red, 0.06 * k, yH - yM, 0.05 * k, x, (yH + yM) / 2, pr, 0, 0.008);
        box(j, MT.red, 0.05 * k, yM - yB, 0.045 * k, x, (yM + yB) / 2, pr, 0, 0.006);
      }
    }
  }

  // =====================================================================
  // SORIN (spire) + chains with bells
  // =====================================================================
  function spire() {
    const s4 = S[S.length - 1];
    const Yp = roofY(s4, 0, s4.Rt) - 0.02;
    const G = MT.spireGold, G2 = MT.gold;
    // roban (dew basin): stepped square base with gilt panels
    B.add(PP.chamferBox(1.62, 0.26, 1.62, 0.03), G, m4(null, 0, Yp - 0.08, 0));
    B.add(PP.chamferBox(1.48, 0.08, 1.48, 0.02), G2, m4(null, 0, Yp + 0.09, 0));
    B.add(PP.chamferBox(1.24, 0.4, 1.24, 0.02), M.bronze, m4(null, 0, Yp + 0.33, 0));
    for (let j = 0; j < 4; j++) {
      box(j, G2, 0.9, 0.26, 0.03, 0, Yp + 0.33, 0.62, 0, 0.008);
      B.add(PP.rosetteGeo(), G2, m4(j, 0, Yp + 0.33, 0.64, 0, 0, 0, 1.4, 1.4, 1.4));
    }
    B.add(PP.chamferBox(1.44, 0.1, 1.44, 0.02), G2, m4(null, 0, Yp + 0.58, 0));
    // fukubachi (inverted bowl) with a beaded band
    const yb = Yp + 0.63;
    B.add(PP.lathe([[0.0001, 0], [0.54, 0], [0.57, 0.04], [0.56, 0.14], [0.5, 0.28], [0.38, 0.4], [0.22, 0.47], [0.13, 0.5], [0.0001, 0.51]], 40), G2, m4(null, 0, yb, 0));
    B.add(new THREE.TorusGeometry(0.555, 0.028, 6, 40), G, m4(null, 0, yb + 0.08, 0, Math.PI / 2));
    // ukebana (lotus) — two whorls of petals
    const yu = yb + 0.52;
    B.add(PP.lathe([[0.0001, -0.04], [0.15, -0.04], [0.17, 0.06], [0.26, 0.14], [0.0001, 0.15]], 24), G, m4(null, 0, yu - 0.02, 0));
    for (let r = 0; r < 2; r++) for (let q = 0; q < 12; q++) {
      const ang = ((q + r * 0.5) / 12) * Math.PI * 2;
      const pet = new THREE.SphereGeometry(1, 8, 6);
      pet.scale(0.12, 0.26, 0.045);
      pet.translate(0, 0.21, 0);
      pet.rotateX(0.62 - r * 0.28);
      pet.translate(0, 0, 0.14 + r * 0.05);
      B.add(pet, r ? G : G2, m4(null, 0, yu + r * 0.05, 0, 0, ang, 0, 1 - r * 0.12, 1 - r * 0.1, 1 - r * 0.12));
    }
    // mast
    const y0 = yu + 0.42;
    const ringStep = 0.47;
    B.add(new THREE.CylinderGeometry(0.1, 0.12, 8 * ringStep + 0.9, 16, 1), G, m4(null, 0, y0 + 4 * ringStep, 0));
    // kurin: nine thick torus rings (close-stacked) with small bells at the diagonals
    for (let n = 0; n < 9; n++) {
      const yr = y0 + n * ringStep;
      const Rr = 0.58 - 0.014 * n;
      const tr = 0.12 - 0.002 * n; // tube radius
      const prof = [];
      for (let q = 0; q <= 14; q++) {
        const th = -Math.PI / 2 + (q / 14) * Math.PI * 2;
        prof.push([Rr - tr + tr * Math.cos(th), tr * 0.92 * Math.sin(th)]);
      }
      B.add(PP.lathe(prof, 44), G2, m4(null, 0, yr, 0));
      // web + collar to the mast
      B.add(PP.lathe([[0.12, -0.035], [Rr - tr * 1.4, -0.035], [Rr - tr * 1.4, 0.035], [0.12, 0.035]], 24), G, m4(null, 0, yr, 0));
      B.add(PP.lathe([[0.125, -0.12], [0.16, -0.08], [0.16, 0.08], [0.125, 0.12]], 16), G, m4(null, 0, yr, 0));
      for (let q = 0; q < 4; q++) {
        const ang = (q / 4) * Math.PI * 2 + Math.PI / 4;
        const bx = Math.cos(ang) * (Rr - tr * 0.7), bz = Math.sin(ang) * (Rr - tr * 0.7);
        B.add(new THREE.TorusGeometry(0.013, 0.004, 4, 8), G, m4(null, bx, yr - tr * 0.95, bz, 0, ang, 0));
        B.add(PP.smallBellGeo(1.05), G, m4(null, bx, yr - tr * 0.95 - 0.012, bz));
      }
    }
    const yTopRing = y0 + 8 * ringStep;
    // suien (water flame) openwork: a cross of flame panels + diagonal half-size flames
    const ys = yTopRing + 0.3;
    B.add(PP.lathe([[0.0001, -0.12], [0.17, -0.12], [0.21, -0.03], [0.14, 0.07], [0.0001, 0.09]], 20), G, m4(null, 0, ys - 0.06, 0));
    for (const ang of [0, Math.PI / 2]) B.add(PP.suienGeo(2.0, 0.7), G2, m4(null, 0, ys, 0, 0, ang, 0));
    for (const ang of [Math.PI / 4, -Math.PI / 4]) B.add(PP.suienGeo(1.3, 0.48), G2, m4(null, 0, ys + 0.05, 0, 0, ang, 0));
    // ryusha + hoju
    const yr = ys + 2.02;
    B.add(PP.lathe([[0.0001, 0], [0.09, 0], [0.12, 0.04], [0.16, 0.13], [0.15, 0.23], [0.1, 0.29], [0.06, 0.31], [0.1, 0.35], [0.0001, 0.37]], 24), G, m4(null, 0, yr, 0));
    B.add(PP.lathe([[0.0001, 0], [0.08, 0], [0.15, 0.07], [0.19, 0.18], [0.18, 0.3], [0.13, 0.41], [0.07, 0.5], [0.03, 0.57], [0.012, 0.64], [0.0001, 0.68]], 28), G2, m4(null, 0, yr + 0.36, 0));
    const spireTop = yr + 1.04;
    // chains (kusari) from the top ring to the four roof corners
    const yc = yTopRing + 0.12;
    for (let c = 0; c < 4; c++) {
      const ang = (c / 4) * Math.PI * 2 + Math.PI / 4;
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const A = V3(dx * 0.2, yc, dz * 0.2);
      const dE = s4.Xc - 0.8;
      const Bp = V3(dx * dE * Math.SQRT2, roofY(s4, dE, dE) + 0.3, dz * dE * Math.SQRT2);
      const sag = 0.42;
      const cp = [];
      for (let q = 0; q <= 40; q++) {
        const t = q / 40;
        cp.push(V3().lerpVectors(A, Bp, t).add(V3(0, -sag * 4 * t * (1 - t), 0)));
      }
      const curve = new THREE.CatmullRomCurve3(cp);
      // interlocking oval links, alternating 90 degrees (kusari)
      const linkG = new THREE.TorusGeometry(0.03, 0.0085, 4, 10);
      const clen = curve.getLength();
      const NL = Math.round(clen / 0.062);
      for (let q = 0; q <= NL; q++) {
        const u = q / NL;
        const p = curve.getPointAt(u);
        const T = curve.getTangentAt(u).normalize();
        const n1 = V3().crossVectors(T, UP).normalize();
        const n = q % 2 ? V3().crossVectors(T, n1).normalize() : n1;
        const y = V3().crossVectors(n, T).normalize();
        B.add(linkG, G2, basisM(null, p, T, y, n, 1.45, 1, 1));
      }
      for (const t of [0.22, 0.42, 0.62, 0.8]) {
        const p = curve.getPoint(t);
        B.add(PP.smallBellGeo(1.25), G2, m4(null, p.x, p.y - 0.01, p.z));
      }
      // anchor ring on the ridge
      B.add(new THREE.TorusGeometry(0.06, 0.015, 6, 12), G2, m4(null, Bp.x, Bp.y, Bp.z, Math.PI / 2, ang, 0));
    }
    return spireTop;
  }

  // =====================================================================
  // BUILD
  // =====================================================================
  podium();
  for (const s of S) {
    walls(s);
    brackets(s);
    eaves(s);
    roof(s);
    if (s.i > 0) balcony(s, S[s.i - 1]);
  }
  const spireTop = spire();

  const merged = B.build({ name: 'pagoda_merged', castShadow: true, receiveShadow: true });
  root.add(merged);
  I.build(root, ctx.rng('pagoda-instance-colors'));

  const c = (x, y, z) => [C[0] + x, C[1] + y, C[2] + z];
  const showcase = [
    { cam: c(-10.5, 1.8, 12.5), look: c(-1.5, 13, 1), focal: 24, note: 'hero: low angle up the sunlit SW corner (onigawara, bells, brackets, disc tiles)' },
    { cam: c(10.5, 1.8, 9.0), look: c(0.5, 13, 0), focal: 24, note: 'shot-5 replacement: SE corner cascade of eaves (shade side), outside the eave line' },
    { cam: c(-28, 13, 22), look: c(0, 13, 0), focal: 30, note: 'west elevation, fully sunlit, all five storeys' },
    { cam: c(52, 6, 38), look: c(0, 17, 0), focal: 50, note: 'backlit telephoto from the ESE' },
    { cam: c(-13, 16, 12), look: c(-6.5, 13.3, 6.5), focal: 35, note: 'roof level: hip ridge, onigawara, balcony, corner bell' },
    { cam: c(10, 25, 12), look: c(0, 30.5, 0), focal: 45, note: 'sorin: nine rings, suien, hoju, chains with bells' },
  ];
  const mname = new Map(Object.entries(MT).map(([kk, v]) => [v, kk]));
  const stats = [];
  let tot = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const n = ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
    tot += n;
    stats.push(`${o.isInstancedMesh ? o.name.replace('pagoda_', '') + '[' + o.count + ']' : mname.get(o.material)}=${Math.round(n / 1000)}k`);
  });
  console.log(`[world] pagoda stats: ${Math.round(tot / 1000)}k tris, ${stats.length} meshes: ${stats.join(' ')}`);
  console.log(`[world] pagoda storeys F=${S.map((s) => s.F.toFixed(2)).join(',')} eaves=${S.map((s) => s.Ye.toFixed(2)).join(',')} peak=${S[S.length - 1].Yt.toFixed(2)} spireTop=${spireTop.toFixed(2)} bells=${anchors.bells.length}`);
  // sky-light attenuation under each storey's eaves (engine ambient volumes)
  const ambientVolumes = S.map((s) => {
    const h = s.a + s.O * 0.55;
    const y0 = s.i === 0 ? s.F - 0.3 : s.F + 0.55; // keep clear of the roof below (no blotches near the hips)
    return { min: [C[0] - h, C[1] + y0, C[2] - h], max: [C[0] + h, C[1] + s.yG + 0.3, C[2] + h], tint: [0.34, 0.27, 0.22], soft: s.i === 0 ? 0.8 : 0.6 };
  });
  return { object: root, anchors, showcase, ambientVolumes };
}
