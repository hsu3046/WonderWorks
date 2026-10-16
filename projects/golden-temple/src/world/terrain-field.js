// ---------------------------------------------------------------------------
// Terrain fields: pure-JS signed distance fields, region masks and height
// functions shared by the ground mesh, the landscape mesh, the paving and all
// instanced placement. Everything is derived from the site plan (layout.js).
// ---------------------------------------------------------------------------

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
export const smax = (a, b, k) => -smin(-a, -b, k);

// --- seeded 2D simplex noise ---------------------------------------------
export function makeSimplex(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (x, y) {
    const s2 = (x + y) * F2;
    const i = Math.floor(x + s2), j = Math.floor(y + s2);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = perm[ii + perm[jj]] & 7; t0 *= t0; n += t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = perm[ii + i1 + perm[jj + j1]] & 7; t1 *= t1; n += t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = perm[ii + 1 + perm[jj + 1]] & 7; t2 *= t2; n += t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  };
}

export function fbmOf(noise) {
  return (x, y, oct = 4, lac = 2.03, gain = 0.5) => {
    let s = 0, a = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f + i * 17.13, y * f - i * 9.71); norm += a; a *= gain; f *= lac; }
    return s / norm;
  };
}

// --- SDF primitives (2D, x/z) ---------------------------------------------
export function sdPoly(poly, x, z) {
  let d = Infinity, s = 1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    const ex = xj - xi, ez = zj - zi, wx = x - xi, wz = z - zi;
    const t = clamp((wx * ex + wz * ez) / (ex * ex + ez * ez), 0, 1);
    const dx = wx - ex * t, dz = wz - ez * t;
    const dd = dx * dx + dz * dz;
    if (dd < d) d = dd;
    const c1 = z >= zi, c2 = z < zj, c3 = ex * wz > ez * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
export function sdBox(x, z, cx, cz, hx, hz, r = 0) {
  const qx = Math.abs(x - cx) - hx + r, qz = Math.abs(z - cz) - hz + r;
  const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - r;
}
// oriented box along a segment A->B, half width hw (rectangular ends)
export function sdSegBox(x, z, P) {
  const lx = x - P.cx, lz = z - P.cz;
  const u = lx * P.tx + lz * P.tz, v = lx * P.nx + lz * P.nz;
  const qx = Math.abs(u) - P.hl, qz = Math.abs(v) - P.hw;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}
export function segInfo(from, to, width) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const tx = dx / len, tz = dz / len;
  return { ax: from[0], az: from[1], bx: to[0], bz: to[1], cx: (from[0] + to[0]) / 2, cz: (from[1] + to[1]) / 2, tx, tz, nx: -tz, nz: tx, hl: len / 2, hw: width / 2, len, width };
}

// ---------------------------------------------------------------------------
// createField(L): everything the terrain needs to know about the site.
// ---------------------------------------------------------------------------
export function createField(L) {
  const R = L.corridor.rect;
  const C = [(R.minX + R.maxX) / 2, (R.minZ + R.maxZ) / 2];
  const HX = (R.maxX - R.minX) / 2, HZ = (R.maxZ - R.minZ) / 2;
  const APRON = 10;
  const DOM = { minX: R.minX - APRON, maxX: R.maxX + APRON, minZ: R.minZ - APRON, maxZ: R.maxZ + APRON };

  const n1 = makeSimplex(1337), n2 = makeSimplex(4242), n3 = makeSimplex(777), n4 = makeSimplex(9001);
  const f1 = fbmOf(n1), f2 = fbmOf(n2), f3 = fbmOf(n3), f4 = fbmOf(n4);

  const pond = L.pond.outline, island = L.pond.island;
  // peninsula carrying the south bridgehead (bridge south foot + its two lanterns) into the pond
  const bS = L.bridge.south;
  const PEN = { cx: bS[0], cz: bS[2] + 4.55, hx: 6.4, hz: 4.75, r: 0.9 }; // x 3.6..16.4, z 26.8..36.3
  const paths = L.paths.map((p) => segInfo(p.from, p.to, p.width));
  // secondary stone walks (terrain's own): they tie the side buildings into the plan and break the
  // big gravel fields of the north half into raked panels, the way temple grounds read from the air
  for (const [a, b, w] of [
    [[37, 7.35], [37, -21.5], 2.1],          // east walk: plaza -> east sub-hall -> bell tower
    [[38.05, -6.0], [46.75, -6.0], 1.9],     // spur to the east sub-hall front steps
    [[38.05, -21.5], [45.1, -21.5], 1.9],    // turn toward the bell tower
    [[44.0, -22.45], [44.0, -24.6], 2.2],    // up to the bell tower's south steps
    [[-32, -15.45], [-32, -36.0], 2.1],      // west walk: pagoda north stair -> west sub-hall
    [[-33.05, -36.0], [-34.55, -36.0], 1.9], // spur to the west sub-hall front steps
  ]) paths.push(Object.assign(segInfo(a, b, w), { walk: true }));
  const lanterns = L.stoneLanterns.map(([x, z, h]) => ({ x, z, h, r: 0.36 + h * 0.07 }));
  const trees = L.trees.map((t) => ({ ...t, x: t.at[0], z: t.at[1] }));
  const shoreLanterns = lanterns.filter((l) => Math.abs(sdPoly(pond, l.x, l.z)) < 2.4);

  const hall = L.hall, pag = L.pagoda, pav = L.pavilion;
  const hallP = { cx: hall.center[0], cz: hall.center[2], hx: hall.platform.w / 2, hz: hall.platform.d / 2 };
  const pagP = { cx: pag.center[0], cz: pag.center[2], h: pag.platform.w / 2 };
  const plaza = L.plaza;

  // ---- elementary fields --------------------------------------------------
  const sdRect = (x, z) => sdBox(x, z, C[0], C[1], HX, HZ);
  const sdPen = (x, z) => sdBox(x, z, PEN.cx, PEN.cz, PEN.hx, PEN.hz, PEN.r);
  function sdPondEff(x, z) {
    let s = sdPoly(pond, x, z);
    if (s < 8) {
      s = Math.max(s, -sdPen(x, z));
      for (const l of shoreLanterns) s = Math.max(s, 1.15 - Math.hypot(x - l.x, z - l.z));
    }
    return s;
  }
  function sdPaths(x, z) {
    let d = Infinity;
    for (const p of paths) d = Math.min(d, sdSegBox(x, z, p));
    return d;
  }
  function sdLanterns(x, z) {
    let d = Infinity;
    for (const l of lanterns) d = Math.min(d, Math.hypot(x - l.x, z - l.z) - l.r);
    return d;
  }
  // building pads (where other modules put platforms): gravel stays clean around them
  const pads = [
    { cx: hallP.cx, cz: hallP.cz, hx: hallP.hx, hz: hallP.hz },
    { cx: pagP.cx, cz: pagP.cz, hx: pagP.h, hz: pagP.h },
    // a hall facing +-x has its long front (w) running along z
    ...L.sideHalls.map((s) => { const fx = Math.abs(s.facing[0]) > 0.5; return { cx: s.center[0], cz: s.center[2], hx: (fx ? s.d : s.w) / 2 + 0.8, hz: (fx ? s.w : s.d) / 2 + 0.8 }; }),
    { cx: L.bellTower.center[0], cz: L.bellTower.center[2], hx: L.bellTower.w / 2 + 1.2, hz: L.bellTower.d / 2 + 1.2 },
  ];
  function sdPads(x, z) {
    let d = Infinity;
    for (const p of pads) d = Math.min(d, sdBox(x, z, p.cx, p.cz, p.hx, p.hz, 0.2));
    // hall stair apron
    d = Math.min(d, sdBox(x, z, hallP.cx, hallP.cz + hallP.hz + 1.6, L.hall.stairs.width / 2 + 0.6, 1.6));
    return d;
  }

  // moss region (negative inside)
  const VEG_TREES = [[41.5, 5.0, 12], [-31.5, 6.6, 7.6], [-46.2, -3.6, 10.5], [17.8, 37.8, 4.6], [39.0, 30.6, 5.6]];
  function sdTreeMoss(x, z) {
    let d = Infinity;
    for (const [tx, tz, th] of VEG_TREES) {
      const dx = x - tx, dz = z - tz;
      const r0 = 1.5 + th * 0.12;
      if (Math.abs(dx) > r0 + 4 || Math.abs(dz) > r0 + 4) { d = Math.min(d, Math.hypot(dx, dz) - r0 * 1.2); continue; }
      const a = Math.atan2(dz, dx);
      d = Math.min(d, Math.hypot(dx, dz) - r0 * (1 + 0.2 * n3(Math.cos(a) * 0.9 + tx * 0.37, Math.sin(a) * 0.9 + tz * 0.37)));
    }
    for (const t of trees) {
      const dx = x - t.x, dz = z - t.z;
      const r0 = 1.9 + t.h * 0.24;
      if (Math.abs(dx) > r0 * 1.6 + 6 || Math.abs(dz) > r0 * 1.6 + 6) { d = Math.min(d, Math.hypot(dx, dz) - r0 * 1.35); continue; }
      const a = Math.atan2(dz, dx);
      const wob = 1 + 0.22 * n3(Math.cos(a) * 0.9 + t.x * 0.37, Math.sin(a) * 0.9 + t.z * 0.37) + 0.08 * n3(Math.cos(a) * 2.5 + t.x, Math.sin(a) * 2.5 - t.z);
      d = Math.min(d, Math.hypot(dx, dz) - r0 * wob);
    }
    return d;
  }
  function bandWidth(x, z) {
    // moss band around the pond: wide on the south / west / east, narrow on the plaza shore
    const w = 3.6 + 2.6 * f1(x * 0.07, z * 0.07, 3);
    const plazaShore = smoothstep(9.5, 5.0, z) * smoothstep(-26, -20, x) * smoothstep(48, 42, x);
    return lerp(w, 0.55 + 0.35 * f1(x * 0.3, z * 0.3, 2), plazaShore);
  }
  const ISLES = [
    { x: 51.5, z: -39.6, ax: 4.2, az: 2.0 },
    { x: -21.5, z: -33.2, ax: 4.6, az: 2.2 },
  ];
  function sdMossRaw(x, z, spIn) {
    const sp = spIn === undefined ? sdPondEff(x, z) : spIn;
    const bw = bandWidth(x, z);
    let m = sp - bw;
    const e1 = 0.9 * f2(x * 0.11, z * 0.11, 3);
    // south garden (between pond and south corridor)
    m = Math.min(m, sdBox(x, z, C[0], 40.5, HX + 2, 6.5) + e1);
    // east garden around the pavilion and the big maple
    m = Math.min(m, sdBox(x, z, 56, 25, 12, 21) + e1);
    // west garden (big pine, cherry)
    m = Math.min(m, sdBox(x, z, -45, 26, 9, 21) + e1);
    // north strip behind the hall
    m = Math.min(m, sdBox(x, z, C[0], -45.5, HX + 2, 3.6) + 1.2 * f2(x * 0.08 + 4, z * 0.08, 3));
    // karesansui islands: low moss hillocks with set rocks in the open gravel fields of the north half
    for (const I of ISLES) {
      const dx = (x - I.x) / I.ax, dz = (z - I.z) / I.az;
      if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
      const a = Math.atan2(dz, dx);
      const wob = 0.16 * n3(Math.cos(a) * 1.1 + I.x * 0.31, Math.sin(a) * 1.1 + I.z * 0.31) + 0.06 * n3(Math.cos(a) * 2.6 - I.x, Math.sin(a) * 2.6 + I.z);
      m = Math.min(m, (Math.hypot(dx, dz) - 1 - wob) * Math.min(I.ax, I.az));
    }
    // island & peninsula tops
    m = Math.min(m, sdPoly(island, x, z) + 0.25);
    m = Math.min(m, sdPen(x, z) + 0.15);
    // gravel zones carve the moss out
    const gz = Math.min(
      sdBox(x, z, (plaza.minX + plaza.maxX) / 2, (plaza.minZ + plaza.maxZ) / 2 - 0.5, (plaza.maxX - plaza.minX) / 2, (plaza.maxZ - plaza.minZ) / 2 + 0.5),
      sdBox(x, z, pagP.cx, pagP.cz, pagP.h + 5.2, pagP.h + 5.2, 2.5),
      sdBox(x, z, hallP.cx, hallP.cz, hallP.hx + 5.5, hallP.hz + 5.0),
      sdPads(x, z) - 3.0,
    );
    m = Math.max(m, -gz);
    // ...except for the narrow shore band and tree islands inside gravel zones
    m = Math.min(m, Math.max(sp - bw, sp - 1.4));
    m = Math.min(m, sdTreeMoss(x, z));
    return m;
  }
  function sdSoil(x, z, spIn) {
    const sp = spIn === undefined ? sdPondEff(x, z) : spIn;
    let s = sp - 0.32 - 0.12 * f3(x * 0.6, z * 0.6, 2);
    s = Math.max(s, -(sdPoly(island, x, z) + 0.35)); // island top is moss
    // forest floor outside the corridor, beyond a raked gravel walk along the outer drip gutter
    s = Math.min(s, 5.4 + 0.45 * f3(x * 0.22 + 3.3, z * 0.22, 2) - sdRect(x, z));
    s = Math.min(s, sdPaths(x, z) - 0.035); // bedding soil + joints under the paving
    return s;
  }
  function sdMoss(x, z, spIn, soilIn) {
    let m = sdMossRaw(x, z, spIn);
    m = Math.max(m, -(sdPaths(x, z) - 0.02));
    m = Math.max(m, -(sdPads(x, z) + 0.0));
    m = Math.max(m, -(soilIn === undefined ? sdSoil(x, z, spIn) : soilIn)); // soil wins at the shore
    m = Math.max(m, sdRect(x, z) - 0.2); // inside corridor only
    return m;
  }
  // ---- drip-line gutters (amaochi-mizo) --------------------------------------
  // a granite curb on each side of a bed of dark river cobbles, running round the hall podium,
  // the pagoda podium and both faces of the corridor plinth (eave drip lines). A ring hugs a
  // rectangular face (half sizes X, Z) and extends outward (dir +1) or inward (dir -1).
  const GUT = { CW: 0.15, GW: 0.74 };
  const gutterRings = [
    { name: 'hall', cx: hallP.cx, cz: hallP.cz, X: hallP.hx + 0.09, Z: hallP.hz + 0.09, dir: 1 },
    { name: 'pagoda', cx: pagP.cx, cz: pagP.cz, X: pagP.h + 0.12, Z: pagP.h + 0.12, dir: 1 },
    { name: 'corIn', cx: C[0], cz: C[1], X: HX - 2.17, Z: HZ - 2.17, dir: -1 },
    { name: 'corOut', cx: C[0], cz: C[1], X: HX + 2.17, Z: HZ + 2.17, dir: 1 },
  ];
  // side halls and the bell tower (podium sizes as built by the buildings module: bays across x
  // 2.2 / 2.35 m, three bays deep, coping overhang 1.15 m); the front steps break the ring
  for (const s of L.sideHalls) {
    const nb = s.w >= 13 ? 5 : 4, bw = s.w >= 13 ? 2.2 : 2.35, bd = s.d >= 9 ? 2.1 : 1.95;
    const hw = (nb * bw) / 2 + 1.15, hd = 1.5 * bd + 1.15;
    const fx = Math.abs(s.facing[0]) > 0.5;
    gutterRings.push({ name: 'side', cx: s.center[0], cz: s.center[2], X: (fx ? hd : hw) + 0.09, Z: (fx ? hw : hd) + 0.09, dir: 1,
      stair: { fx: s.facing[0], fz: s.facing[2], hw: bw * 0.8 + 0.3, d0: hd - 0.3, d1: hd + 2.5 } });
  }
  {
    const b = L.bellTower;
    gutterRings.push({ name: 'bell', cx: b.center[0], cz: b.center[2], X: 3.44, Z: 3.44, dir: 1, stair: { fx: 0, fz: 1, hw: 1.4, d0: 3.05, d1: 5.6 } });
  }
  function sdGutter(x, z) {
    let d = Infinity;
    for (const g of gutterRings) {
      const s = sdBox(x, z, g.cx, g.cz, g.X, g.Z);
      d = Math.min(d, g.dir > 0 ? Math.max(-s, s - GUT.GW) : Math.max(s, -s - GUT.GW));
    }
    return d;
  }
  // where the gutter has to stop (stairs, paths, lanterns, the gate, the pond, tree trunks)
  function gutterBlocked(x, z) {
    if (sdPaths(x, z) < 0.1) return true;
    if (sdLanterns(x, z) < 0.22) return true;
    if (sdPondEff(x, z) < 0.4) return true;
    if (Math.abs(x - hallP.cx) < L.hall.stairs.width / 2 + 0.95 && z > hallP.cz + hallP.hz - 0.2 && z < hallP.cz + hallP.hz + 3.4) return true;
    {
      const dx = x - pagP.cx, dz = z - pagP.cz;
      if ((Math.abs(dx) < 1.98 && Math.abs(dz) > pagP.h - 0.3 && Math.abs(dz) < pagP.h + 1.9) || (Math.abs(dz) < 1.98 && Math.abs(dx) > pagP.h - 0.3 && Math.abs(dx) < pagP.h + 1.9)) return true;
    }
    const gc = L.gate.center;
    if (Math.abs(x - gc[0]) < L.gate.w / 2 + 0.6 && Math.abs(z - gc[2]) < 5.5) return true;
    for (const g of gutterRings) {
      const S = g.stair;
      if (!S) continue;
      const dx = x - g.cx, dz = z - g.cz;
      const along = dx * S.fx + dz * S.fz, across = Math.abs(-dx * S.fz + dz * S.fx);
      if (across < S.hw && along > S.d0 && along < S.d1) return true;
    }
    for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < 0.55) return true;
    return false;
  }

  // distance from gravel to anything the rake has to go around
  function rakeDist(x, z, sM, sS) {
    return Math.max(Math.min(sM, sS, sdPaths(x, z) - 0.06, sdPads(x, z) + 0.15, Math.abs(sdRect(x, z)) - 2.95, sdGutter(x, z) - 0.03), 0);
  }

  // ---- outer landscape --------------------------------------------------------
  const SUN = [-0.9404, 0.3401];
  const SUN_SLOPE = 0.094;
  function sunUpwind(x, z) {
    // distance travelled toward ENE (shadow direction) before entering the courtyard rectangle
    const dx = -SUN[0], dz = -SUN[1];
    let t0 = -Infinity, t1 = Infinity;
    for (const [p, d, lo, hi] of [[x, dx, R.minX - 2, R.maxX + 2], [z, dz, R.minZ - 2, R.maxZ + 2]]) {
      if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return Infinity; continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t1 < Math.max(t0, 0)) return Infinity;
    return Math.max(t0, 0);
  }
  // The sun valley (land cut down so the low sun reaches the courtyard) and the matching tree-top
  // cap used to end abruptly at the edges of the band of rays that hit the courtyard -> vertical
  // cliffs / canopy walls along the sun direction on the western hills. Beyond the band the cut now
  // continues with sloping sides: D is taken at the nearest point of the band edge, dl is the
  // lateral distance out of the band.
  const SD = [-SUN[0], -SUN[1]], SNn = [-SD[1], SD[0]];
  let latMin = Infinity, latMax = -Infinity;
  for (const [cx, cz] of [[R.minX - 2, R.minZ - 2], [R.maxX + 2, R.minZ - 2], [R.minX - 2, R.maxZ + 2], [R.maxX + 2, R.maxZ + 2]]) {
    const l = cx * SNn[0] + cz * SNn[1]; latMin = Math.min(latMin, l); latMax = Math.max(latMax, l);
  }
  function sunBand(x, z) {
    const lat = x * SNn[0] + z * SNn[1];
    const lc = clamp(lat, latMin + 0.5, latMax - 0.5);
    const s = lc - lat;
    return [sunUpwind(x + SNn[0] * s, z + SNn[1] * s), Math.abs(s)];
  }
  const SIDE = 0.42;
  const sunCap = (x, z) => { const D = sunUpwind(x, z); return D === Infinity ? Infinity : -2.5 + SUN_SLOPE * D; };

  // azimuth-keyed tables: a = atan2(-(z-C.z), x-C.x) in degrees (0 = E, 90 = N, 180 = W, 270 = S)
  const AZ = [0, 45, 90, 135, 160, 180, 200, 225, 270, 315, 360];
  const NEAR_A = [18, 27, 52, 46, 20, -26, -34, -26, -4, 10, 18];   // near hills amplitude (m)
  // typical ridge-crest elevations (deg, seen from the courtyard). The backlit west (az 150..225) stays
  // low so the 6.8 deg sun hangs ~3-4 deg above the farthest crest; the front-lit east/north rises higher.
  const E1 = [3.4, 4.2, 4.0, 3.7, 3.4, 2.9, 2.4, 2.2, 1.8, 2.4, 3.4];
  const E2 = [4.8, 5.8, 5.6, 4.4, 3.7, 3.2, 2.8, 2.8, 2.4, 3.2, 4.8];
  const E3 = [5.6, 6.2, 6.0, 5.4, 4.5, 3.9, 3.4, 3.4, 3.0, 4.2, 5.6];
  const E4 = [6.4, 7.0, 6.8, 6.3, 5.4, 4.6, 3.9, 4.0, 3.6, 5.0, 6.4];
  function azInterp(tab, adeg) {
    let a = ((adeg % 360) + 360) % 360;
    for (let i = 0; i < AZ.length - 1; i++) {
      if (a <= AZ[i + 1]) { const t = (a - AZ[i]) / (AZ[i + 1] - AZ[i]); const s = t * t * (3 - 2 * t); return lerp(tab[i], tab[i + 1], s); }
    }
    return tab[0];
  }
  const DEG = Math.PI / 180;
  // four ridge layers; each is a ring of crests with peaks & saddles along the azimuth and
  // radially-running spurs / V-gullies on its slopes (polar, radially elongated ridged noise)
  const LAYERS = [
    { R: 820, Wf: 250, Wb: 380, E: E1, seed: 0, gully: 0.42 },
    { R: 1550, Wf: 420, Wb: 600, E: E2, seed: 1, gully: 0.40 },
    { R: 2650, Wf: 760, Wb: 950, E: E3, seed: 2, gully: 0.32 },
    { R: 4200, Wf: 1150, Wb: 1400, E: E4, seed: 3, gully: 0.26 },
  ];
  // noise sampled on a circle (seamless in azimuth); lam = wavelength along the arc at radius R
  const circ = (nf, ca, sa, R, lam, k) => { const rho = R / lam; return nf(ca * rho + k, sa * rho - k * 0.7); };
  function mountains(x, z, r, adeg) {
    const ca = Math.cos(adeg * DEG), sa = Math.sin(adeg * DEG);
    // arc coordinate seam placed in the never-filmed south (az 270)
    const aS = (((adeg - 270) % 360) + 360) % 360;
    const seamFade = smoothstep(0, 12, Math.min(aS, 360 - aS));
    const wx = 140 * n3(x / 900 + 3.1, z / 900 - 1.7), wz = 140 * n3(x / 900 - 5.3, z / 900 + 2.9);
    let m = -1e9;
    for (const Ly of LAYERS) {
      const k = Ly.seed * 13.7 + 2.3;
      const Rr = Ly.R * (1 + 0.11 * circ(n2, ca, sa, Ly.R, 1700, k) + 0.04 * circ(n1, ca, sa, Ly.R, 520, k + 5));
      const dr = r - Rr;
      const W = dr < 0 ? Ly.Wf : Ly.Wb;
      const u = Math.abs(dr) / W;
      if (u > 3.2) continue;
      // peaks and saddles along the crest: broad rounded summits (relative), rolling detail (absolute m)
      const pk = 0.5 + 0.5 * circ(n2, ca, sa, Ly.R, 1600, k + 11);
      const P = 0.6 * pk * pk * (3 - 2 * pk) + 0.4 * (0.5 + 0.5 * circ(n3, ca, sa, Ly.R, 1000, k + 17));
      const base = Ly.R * Math.tan(azInterp(Ly.E, adeg) * DEG);
      const det = Math.min(1, base / 140);
      const crest = base * (0.76 + 0.32 * P) + det * (20 * circ(n4, ca, sa, Ly.R, 460, k + 3) + 6 * circ(n3, ca, sa, Ly.R, 160, k + 7));
      let h = crest * Math.exp(-u * u * 1.15);
      // radial spurs / V-gullies: zero lines of radially stretched noise become valley floors
      const s = aS * DEG * Ly.R + wx * 0.8;
      const d = dr + wz;
      const g1 = 1 - Math.abs(n4(s / 230 + k, d / 700 - k));
      const g2 = 1 - Math.abs(n1(s / 95 - k, d / 300 + k));
      const cr = smoothstep(0.05, 0.6, u); // gullies head just below the (rounded, forested) crest
      const valley = 0.72 * g1 * g1 * g1 + 0.28 * g2 * g2 * g2 * cr;
      const depth = Ly.gully * (0.06 + 0.94 * cr) * seamFade;
      h *= 1 - depth * valley;
      // broad shoulders / benches
      h *= 0.9 + 0.1 * n2(x / 380 + k, z / 380 - k);
      if (h > m) m = h;
    }
    return m;
  }

  // near-field + mountains, before the sun cap (ground level, no canopy)
  function landRaw(x, z) {
    const d = sdRect(x, z);
    const dx = x - C[0], dz = z - C[1];
    const r = Math.hypot(dx, dz);
    const adeg = Math.atan2(-dz, dx) / DEG;
    const A = azInterp(NEAR_A, adeg);
    const s = clamp((d - 11) / (A < 0 ? 210 : 430), 0, 1);
    let h = A * s * s * (3 - 2 * s);
    h += 26 * f1(x / 260, z / 260, 4) * smoothstep(25, 320, d);
    // 55 m swells near the precinct; beyond ~300 m the land mesh's rings are 8-16 m apart, too coarse
    // for them (they alias into ring-aligned 'dune' terraces under the grazing sun) -> broader swells
    const farSw = smoothstep(240, 560, r);
    h += 5 * f3(x / 55, z / 55, 3) * smoothstep(14, 110, d) * (1 - 0.85 * farSw);
    h += 8 * f3(x / 160 + 7.7, z / 160 - 2.1, 2) * farSw;
    h += 0.12 * f3(x / 7, z / 7, 2) * smoothstep(1, 6, d);
    if (r > 380) h = smax(h, mountains(x, z, r, adeg) + Math.min(h, 0) * 0.3, 60);
    // keep the forecourt south of the gate & the SE camera clearing low and open
    const gate = L.gate.center;
    const fc = sdBox(x, z, gate[0], R.maxZ + 18, 18, 18, 6);
    h = lerp(h, Math.min(h, 0.3 + 0.03 * Math.max(fc, 0)), smoothstep(14, 0, fc));
    return h;
  }
  function landHeight(x, z) {
    let h = landRaw(x, z);
    const [D, dl] = sunBand(x, z);
    if (D !== Infinity) h = smin(h, 0.25 + SUN_SLOPE * D + SIDE * dl, 6);
    return h;
  }

  // forest density (0..1) for instanced trees & canopy shading
  function forestDensity(x, z) {
    const d = sdRect(x, z);
    if (d < 6) return 0;
    let f = smoothstep(6, 16, d);
    // clearings
    const cl = f3(x / 140 + 3.3, z / 140 - 1.1, 3);
    f *= smoothstep(-0.42, -0.18, cl);
    // gate approach (sandō) lane kept open for the telephoto through the gate; wooded on both sides
    const gate = L.gate.center;
    f *= smoothstep(1.5, 7, sdBox(x, z, gate[0], R.maxZ + 45, 7, 45));
    // SE camera clearing (tree tops are additionally capped under the crane path)
    f *= smoothstep(2, 12, sdBox(x, z, 76, 64, 14, 14, 6));
    return f;
  }
  // max tree-top height above y=0 allowed at x,z (sun shadow + camera clearances)
  function treeTopCap(x, z) {
    // the corridor roof (~5-6 m) already shades the courtyard edge, so vegetation upwind only adds
    // shade when it rises above the corridor's own shadow line: top < ~4 m + tan(6.8 deg) * D
    const [D, dl] = sunBand(x, z);
    // ...and below ~2 deg as seen from the courtyard so the sunset ridges stay visible above them
    let cap = D === Infinity ? Infinity : Math.min(4.0 + 0.105 * D, 5.0 + 0.04 * D) + SIDE * dl;
    // SE crane / arrival cameras: keep tree tops well below the camera paths
    const segs = [[70, 26, 62, 58, 19, 48], [55, 6, 40, 80, 38, 72]];
    for (const [ax, ay, az, bx, by, bz] of segs) {
      const ex = bx - ax, ez = bz - az;
      const t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1);
      const dd = Math.hypot(x - (ax + ex * t), z - (az + ez * t));
      if (dd < 40) cap = Math.min(cap, lerp(ay, by, t) - 7 + dd * 0.35);
    }
    // backlit pond-side cameras (shots 1, 8, 9) look WNW: keep the forest beyond the west corridor
    // under the corridor roofline so the ridges behind the pagoda stay visible under the low sun
    {
      const dx = x - 38, dz = z - 22;
      const az = Math.atan2(-dz, dx) / DEG;
      if (az > 120 && az < 230) {
        const w = smoothstep(120, 138, az) * smoothstep(230, 212, az);
        const vc = 2.0 + Math.hypot(dx, dz) * Math.tan(2.6 * DEG);
        cap = Math.min(cap, vc + (1 - w) * 60);
      }
    }
    return cap;
  }

  // ---- courtyard ground height ----------------------------------------------
  function moundAmp(x, z) {
    let a = 0.22;
    a = Math.max(a, 0.42 * smoothstep(30, 37, z));            // south garden
    a = Math.max(a, 0.36 * smoothstep(42, 48, x) * smoothstep(0, 8, z)); // east garden
    a = Math.max(a, 0.34 * smoothstep(-36, -42, x) * smoothstep(2, 9, z)); // west garden
    return a;
  }
  function groundHeight(x, z, sM = null, spIn) {
    let h = 0;
    const sp = spIn === undefined ? sdPondEff(x, z) : spIn;
    if (sp < 0) {
      const t = -sp;
      h = -0.82 * smoothstep(0, 1.05, t) - 0.88 * smoothstep(0.6, 5.5, t);
      h += 0.12 * f2(x * 0.15, z * 0.15, 3) * smoothstep(1.5, 4, t);
    }
    const si = sdPoly(island, x, z);
    if (si < 2.8) {
      const hi = si < 0 ? -0.5 + 0.78 * smoothstep(0, 1.9, -si) + 0.08 * f3(x * 0.8, z * 0.8, 2) : -0.5 - 1.2 * smoothstep(0, 2.6, si);
      h = Math.max(h, hi);
    }
    const m = sM === null ? sdMoss(x, z) : sM;
    if (m < 0) {
      const mn = f4(x * 0.11, z * 0.11, 3) * 0.85 + 0.15 * f1(x * 0.3, z * 0.3, 2);
      let mound = smoothstep(-0.35, 0.65, mn);
      mound = mound * mound * (3 - 2 * mound);
      let amp = moundAmp(x, z) * smoothstep(0.1, 2.0, -m);
      // keep stone lantern / tree bases level
      amp *= smoothstep(0.4, 1.6, sdLanterns(x, z));
      let tb = Infinity;
      for (const t of trees) tb = Math.min(tb, Math.hypot(x - t.x, z - t.z));
      amp *= 0.35 + 0.65 * smoothstep(0.6, 2.2, tb);
      amp *= smoothstep(0.5, 2.0, sdPaths(x, z));
      amp *= smoothstep(-0.2, 1.4, sp); // not inside the pond
      const gq = smoothstep(0.25, 1.8, sdGutter(x, z));
      amp *= gq;
      // small cushions and hollows (1.5 - 3 m) on top of the big mounds: the grazing sun models them
      const cu = f2(x * 0.42 + 13.1, z * 0.42 - 7.7, 3);
      const cush = smoothstep(-0.45, 0.55, cu);
      const small = 0.085 * (cush * cush * (3 - 2 * cush) - 0.45) * smoothstep(0.15, 1.2, -m) * smoothstep(0.3, 1.3, sdLanterns(x, z)) * smoothstep(0.3, 1.4, sdPaths(x, z)) * smoothstep(0.0, 1.2, sp) * gq;
      h += amp * mound + small + 0.025 * f3(x * 2.1, z * 2.1, 2) * smoothstep(0.05, 0.5, -m) * gq;
    }
    // paving bed: bedding soil / moss in the joints comes up to ~1.5 cm under the slab tops so the
    // mossy joint lines read between the stones
    if (sp > 0.3) {
      const sPath = sdPaths(x, z);
      if (sPath < 0.3) h = Math.max(h, 0.04 * smoothstep(0.25, -0.1, sPath));
    }
    const dOut = sdRect(x, z);
    // the corridor plinth and its outer drip gutter sit on level ground; the land takes over beyond
    if (dOut > 0) h = lerp(h, landHeight(x, z), smoothstep(3.1, 6.5, dOut));
    return h;
  }

  // ---- gridded fields for fast sampling + GPU mask -----------------------
  const CELL = 0.2;
  const NX = Math.round((DOM.maxX - DOM.minX) / CELL) + 1, NZ = Math.round((DOM.maxZ - DOM.minZ) / CELL) + 1;
  const gPath = new Float32Array(NX * NZ), gPond = new Float32Array(NX * NZ), gMoss = new Float32Array(NX * NZ), gSoil = new Float32Array(NX * NZ), gRake = new Float32Array(NX * NZ), gH = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    const z = DOM.minZ + j * CELL;
    for (let i = 0; i < NX; i++) {
      const x = DOM.minX + i * CELL;
      const k = j * NX + i;
      const sp = sdPondEff(x, z);
      gPond[k] = sp;
      gPath[k] = sdPaths(x, z);
      const sS = sdSoil(x, z, sp);
      const sM = sdMoss(x, z, sp, sS);
      gMoss[k] = sM; gSoil[k] = sS;
      gRake[k] = rakeDist(x, z, sM, sS);
    }
  }
  function sampleGrid(g, x, z) {
    const fx = clamp((x - DOM.minX) / CELL, 0, NX - 1.001), fz = clamp((z - DOM.minZ) / CELL, 0, NZ - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const k = j * NX + i;
    return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + NX] * (1 - u) + g[k + NX + 1] * u) * v;
  }
  const inDom = (x, z) => x >= DOM.minX && x <= DOM.maxX && z >= DOM.minZ && z <= DOM.maxZ;
  const mossAt = (x, z) => (inDom(x, z) ? sampleGrid(gMoss, x, z) : sdMoss(x, z));
  const soilAt = (x, z) => (inDom(x, z) ? sampleGrid(gSoil, x, z) : sdSoil(x, z));
  for (let j = 0; j < NZ; j++) {
    const z = DOM.minZ + j * CELL;
    for (let i = 0; i < NX; i++) { const x = DOM.minX + i * CELL; gH[j * NX + i] = groundHeight(x, z, gMoss[j * NX + i], gPond[j * NX + i]); }
  }
  // height anywhere: courtyard grid inside the domain, landscape outside
  function heightAt(x, z) {
    if (inDom(x, z)) return sampleGrid(gH, x, z);
    return landHeight(x, z);
  }

  return {
    L, R, C, HX, HZ, DOM, APRON, PEN, paths, lanterns, trees, pads, hallP, pagP, ISLES,
    noise: { n1, n2, n3, n4, f1, f2, f3, f4 },
    sdRect, sdPen, sdPondEff, sdPaths, sdLanterns, sdPads, sdMoss, sdSoil, sdTreeMoss, sdGutter, gutterBlocked, gutterRings, GUT,
    mossAt, soilAt, groundHeight, heightAt, landHeight, landRaw, sunCap, sunUpwind, treeTopCap, forestDensity, mountains,
    grid: { CELL, NX, NZ, gMoss, gSoil, gRake, gH, gPath, gPond, sample: sampleGrid },
    sdPond: (x, z) => sdPoly(pond, x, z), sdIsland: (x, z) => sdPoly(island, x, z),
  };
}
