// ---------------------------------------------------------------------------
// Pond basin: natural granite boulders along the shore (mossy tops, wet band,
// algae below the waterline), cut-stone retaining walls on the plaza side and
// around the bridge landing, mud floor, small rocky island mound.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { POND_GLSL, UW_FRAGEND } from './pond-water.js';
import { makeNoise, smooth, clamp, pointInPoly, contourLines, resample } from './pond-util.js';

// ---- boulder generator ------------------------------------------------------
// Faceted granite boulder: a random convex polyhedron (plane cuts) blended with
// a noisy ellipsoid so faces read as weathered flats with rounded arrises,
// plus ridged noise for fissures. Unit size (radius ~1).
export function rockGeometry(noise, r, { detail = 10, flat = 0.62, cuts = 7, lumpy = 1.0, elong = 1.0, round = 0.3 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position;
  const o1 = [r.range(-50, 50), r.range(-50, 50), r.range(-50, 50)];
  const o2 = [r.range(-50, 50), r.range(-50, 50), r.range(-50, 50)];
  const planes = [];
  // top face + ring of side faces + a few random
  planes.push({ n: new THREE.Vector3(r.range(-0.25, 0.25), 1, r.range(-0.25, 0.25)).normalize(), d: r.range(0.55, 0.8) });
  for (let k = 0; k < cuts; k++) {
    const a = (k / cuts) * Math.PI * 2 + r.range(-0.4, 0.4);
    const el = r.range(-0.35, 0.75);
    planes.push({ n: new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).normalize(), d: r.range(0.66, 0.95) });
    if (r.chance(0.6)) { const a2 = r.range(0, 6.283), e2 = r.range(-0.2, 1.0); planes.push({ n: new THREE.Vector3(Math.cos(a2) * Math.cos(e2), Math.sin(e2), Math.sin(a2) * Math.cos(e2)).normalize(), d: r.range(0.75, 0.98) }); }
  }
  planes.push({ n: new THREE.Vector3(0, -1, 0), d: 0.55 });
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    // distance to the polyhedron along v
    let t = 1.25;
    for (const pl of planes) { const c = v.dot(pl.n); if (c > 1e-3) t = Math.min(t, pl.d / c); }
    const n1 = noise.fbm3(v.x * 1.2 + o1[0], v.y * 1.2 + o1[1], v.z * 1.2 + o1[2], 3);
    const ell = 0.95 + 0.18 * lumpy * n1;
    let d = THREE.MathUtils.lerp(t, ell, round);
    // facet undulation + fissures
    d += 0.06 * noise.fbm3(v.x * 2.6 + o2[0], v.y * 2.6 + o2[1], v.z * 2.6 + o2[2], 3);
    // chips / pits
    const pit = noise.n3(v.x * 5.5 + o2[1], v.y * 5.5 + o1[2], v.z * 5.5 + o2[0]);
    d -= 0.03 * Math.max(0, pit - 0.45) / 0.55;
    const rid = 1 - Math.abs(noise.n3(v.x * 2.3 + o1[1], v.y * 2.3 + o2[2], v.z * 2.3 + o1[0]));
    d -= 0.02 * Math.pow(Math.max(0, rid - 0.86) / 0.14, 2);
    d += 0.016 * noise.fbm3(v.x * 9 + o1[2], v.y * 9 + o2[0], v.z * 9 + o1[1], 2);
    w.copy(v).multiplyScalar(d);
    w.x *= elong; w.y *= flat;
    pos.setXYZ(i, w.x, w.y, w.z);
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return g;
}

// Weathered granite with speckle, iron staining, fissures, crustose lichen,
// clumpy moss on up-facing areas; wet band, tide line and algae at the water.
export function stoneMaterial(ctx, U, mossAmt, tint, { cut = false, pebble = false } = {}) {
  const hooks = {
    uniforms: { ...U },
    fragHead: POND_GLSL + 'float g_wet; float g_moss; float g_h;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        float fpx = length(fwidth(wp));
        float big = n_fbm3(wp * 0.55, 4);
        float med = n_fbm3(wp * 2.3 + 3.0, 3);
        float aaS = 1.0 - smoothstep(0.006, 0.02, fpx);
        float speck = n_snoise3(wp * 42.0) * aaS;
        float speck2 = n_snoise3(wp * 77.0 + 7.0) * aaS;
        vec3 col = vec3(0.20, 0.195, 0.185) * ${tint} * (0.72 + 0.4 * big);
        col = mix(col, vec3(0.035, 0.035, 0.035), mix(0.12, smoothstep(0.5, 0.85, speck) * 0.75, aaS));
        col = mix(col, vec3(0.52, 0.50, 0.47), smoothstep(0.55, 0.9, speck2) * 0.5);
        // iron staining & dark weathering streaks running down
        col = mix(col, col * vec3(1.18, 0.98, 0.78), smoothstep(0.15, 0.7, med) * 0.35);
        float streak = n_fbm3(wp * vec3(3.0, 0.4, 3.0) + 2.0, 3);
        col *= 1.0 - smoothstep(0.1, 0.6, streak) * 0.28 * (1.0 - abs(wn.y));
        // fissures
        float cr = 1.0 - abs(n_snoise3(wp * vec3(1.1, 1.8, 1.1) + 11.0));
        float crack = smoothstep(0.975, 0.999, cr) * 0.6 * smoothstep(0.2, 0.6, n_fbm3(wp * 0.9 + 4.0, 2) * 0.5 + 0.5) * ${cut ? '0.4' : '1.0'};
        
        // crustose lichen: pale grey-green and rusty orange rosettes
        float lich = smoothstep(0.63, 0.7, n_fbm3(wp * 3.2 + 5.0, 3) * 0.5 + 0.5);
        col = mix(col, vec3(0.33, 0.34, 0.29), lich * 0.4 * (0.6 + 0.4 * n_snoise3(wp * 14.0)));
        float lichO = smoothstep(0.72, 0.77, n_fbm3(wp * 5.5 + 9.0, 2) * 0.5 + 0.5);
        col = mix(col, vec3(0.42, 0.24, 0.07), lichO * 0.35);
        // moss on up-facing, clumpy edge
        float up = wn.y;
        float mn = n_fbm3(wp * 1.5 + 2.0, 4) * 0.5 + 0.5;
        float mclump = n_fbm3(wp * 7.0 + 1.0, 2);
        g_moss = smoothstep(0.6, 0.66, mn + (up - 0.55) * 0.6 + mclump * 0.08) * smoothstep(0.35, 0.75, up) * ${mossAmt};
        vec3 mossCol = mix(vec3(0.028, 0.052, 0.010), vec3(0.095, 0.135, 0.022), n_snoise3(wp * 11.0) * 0.5 + 0.5);
        mossCol = mix(mossCol, vec3(0.13, 0.12, 0.04), smoothstep(0.3, 0.8, mclump) * 0.3);
        // cushion texture: tufts with sunlit yellow-green tips (only where resolved)
        float mAA = 1.0 - smoothstep(0.003, 0.009, fpx);
        float mfine = n_snoise3(wp * 55.0) * mAA;
        mossCol *= 0.86 + 0.28 * (mfine * 0.5 + 0.5);
        mossCol = mix(mossCol, vec3(0.16, 0.19, 0.05), smoothstep(0.55, 0.95, mfine) * 0.35);
        col = mix(col, mossCol, g_moss);
        diffuseColor.rgb *= col;
        g_h = big * 0.5 + med * 0.25 + speck * 0.03 + smoothstep(0.4, 0.75, mn + (up - 0.55) * 0.6) * smoothstep(0.35, 0.75, up) * 0.3 + g_moss * 0.06 * n_snoise3(wp * 28.0) * aaS + g_moss * mfine * 0.025;

        float above = vWPos.y - uWaterY;
        // capillary rise: an irregular, fingered top edge to the wet band
        float wl = 0.06 + 0.05 * (n_snoise(vWPos.xz * 2.7) * 0.5 + 0.5) + 0.025 * n_fbm3(vWPos * vec3(9.0, 3.0, 9.0), 2) * aaS;
        float wet = 1.0 - smoothstep(wl * 0.6, wl, above);
        float damp = 1.0 - smoothstep(wl, wl + 0.08, above);
        float sub = 1.0 - smoothstep(-0.03, 0.005, above);
        float tide = smoothstep(wl - 0.008, wl + 0.004, above) * (1.0 - smoothstep(wl + 0.004, wl + 0.03, above));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.1, 1.02) + 0.014, tide * 0.55);
        diffuseColor.rgb *= 1.0 - damp * 0.18;
        // slimy green-brown biofilm straddling the waterline, darker deeper down
        float film = (1.0 - smoothstep(0.0, 0.035, above)) * smoothstep(-0.12, -0.01, above);
        vec3 algae = mix(vec3(0.026, 0.038, 0.014), vec3(0.07, 0.08, 0.028), n_snoise3(vWPos * 5.0) * 0.5 + 0.5);
        vec3 slime = mix(vec3(0.045, 0.07, 0.02), vec3(0.09, 0.10, 0.03), n_snoise3(vWPos * 14.0) * 0.5 + 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.48, wet * (1.0 - sub));
        diffuseColor.rgb = mix(diffuseColor.rgb, algae, sub * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, slime, film * 0.75 * (0.6 + 0.4 * n_snoise3(vWPos * 3.0)));
        g_wet = max(max(wet, sub), film);
      }
    `,
    fragRough: `roughnessFactor = mix(mix(${pebble ? '0.55' : '0.74'}, 0.95, g_moss), 0.22, g_wet * (1.0 - g_moss * 0.6));`,
    fragNormal: `normal = n_bumpView(-vViewPosition, normal, g_h ${cut ? '+ n_fbm3(vWPos * 6.0, 3) * 0.6' : ''}, 0.012);`,
    fragEnd: UW_FRAGEND,
  };
  return ctx.mat.std({ color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: !!cut }, hooks);
}

export function buildStone(ctx, site, U) {
  const { geom } = ctx;
  const group = new THREE.Group();
  group.name = 'pondStone';
  const r = ctx.rng('pond-stone');
  const noise = makeNoise(() => r.float());
  const waterY = site.waterY;

  const rockMat = stoneMaterial(ctx, U, '0.75', 'vec3(0.96, 0.97, 0.93)');
  const wallMat = stoneMaterial(ctx, U, '0.3', 'vec3(1.12, 1.1, 1.06)', { cut: true });
  rockMat.name = 'pondRock'; wallMat.name = 'pondWall';

  // ---- rock prototypes ------------------------------------------------------
  const protos = [];
  for (let k = 0; k < 16; k++) {
    protos.push(rockGeometry(noise, r, {
      detail: k < 6 ? 10 : 7, flat: r.range(0.62, 0.95), cuts: r.int(7, 11), lumpy: r.range(0.8, 1.3), elong: r.range(0.9, 1.45), round: r.range(0.06, 0.2),
    }));
  }
  const b = new geom.Builder();
  const placed = [];
  const L = site.L;
  const bridgeX = L.bridge ? L.bridge.north[0] : 10;
  const bridgeHW = L.bridge ? L.bridge.width / 2 + 0.95 : 2.75;
  const wallX0 = -15.5, wallX1 = 36.5;
  const Lg = site.landing;
  const inPen = (x, z, m = 1.6) => Lg && x > Lg.minX - m && x < Lg.maxX + m && z > Lg.minZ - m && z < Lg.maxZ + 0.5;
  const inNorth = (x, z) => z < 10.8 && x > wallX0 && x < wallX1;
  site.wallZone = (x, z) => inNorth(x, z) || inPen(x, z);

  // gradient of the waterline distance (points into the water)
  const grad = (x, z) => {
    const e = 0.25;
    let gx = site.sd(x + e, z) - site.sd(x - e, z), gz = site.sd(x, z + e) - site.sd(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    return [gx / l, gz / l];
  };

  function addRock(x, z, size, sink, yaw, protoIdx = -1) {
    const g = protos[protoIdx >= 0 ? protoIdx : r.int(0, protos.length - 1)];
    const sy = size * r.range(0.85, 1.15);
    const fy = site.floorY(x, z);
    const top = Math.max(waterY, fy);
    const y = top + size * (0.62 * (1 - sink) - 0.3);
    b.add(g, rockMat, geom.mat4([x, Math.max(y, fy + size * 0.15), z], [r.range(-0.18, 0.18), yaw, r.range(-0.18, 0.18)], [size, sy, size * r.range(0.85, 1.1)]));
    placed.push([x, z, size]);
  }

  // ---- waterline contours ---------------------------------------------------
  const { nx, nz, RES } = site;
  const depthGrid = new Float32Array(nx * nz);
  for (let k = 0; k < nx * nz; k++) depthGrid[k] = waterY - site.floorGrid[k];
  const waterlines = contourLines(depthGrid, nx, nz, site.gx0, site.gz0, RES, 0.0)
    .filter((l) => l.length > 6)
    .map((l) => resample(l, 0.25));

  // ---- shore boulders -----------------------------------------------------
  for (const line of waterlines) {
    let acc = r.range(0, 0.6);
    for (let i = 0; i < line.length; i++) {
      const [x, z] = line[i];
      acc += 0.25;
      if (site.wallZone(x, z)) { acc = Math.min(acc, 0.2); continue; }
      if (acc < 0) continue;
      const big = r.chance(0.13);
      const size = big ? r.range(0.95, 1.55) : r.range(0.4, 0.92);
      const [gx, gz] = grad(x, z);
      const off = r.range(-0.3, 0.25) * size;
      const rx = x + gx * off + r.range(-0.12, 0.12), rz = z + gz * off + r.range(-0.12, 0.12);
      addRock(rx, rz, size, r.range(0.25, 0.55), r.range(0, Math.PI * 2));
      if (r.chance(0.3)) {
        const s2 = size * r.range(0.28, 0.5);
        addRock(rx + gx * (size * 0.75 + s2 * 0.4) + r.range(-0.3, 0.3), rz + gz * (size * 0.75 + s2 * 0.4) + r.range(-0.3, 0.3), s2, r.range(0.35, 0.75), r.range(0, 6.28));
      }
      if (r.chance(0.32)) {
        const s3 = r.range(0.32, 0.75);
        addRock(rx - gx * (size * 0.7 + 0.25), rz - gz * (size * 0.7 + 0.25), s3, r.range(0.05, 0.25), r.range(0, 6.28));
      }
      acc = -size * r.range(0.5, 0.82);
    }
  }
  // accent stones on the island
  {
    const isl = L.pond.island;
    const cx = isl.reduce((s, p) => s + p[0], 0) / isl.length, cz = isl.reduce((s, p) => s + p[1], 0) / isl.length;
    for (let k = 0; k < 7; k++) {
      const a = r.range(0, 6.28), d = r.range(1.0, 2.6);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!pointInPoly(x, z, isl)) continue;
      const s = r.range(0.45, 0.95);
      b.add(protos[r.int(0, protos.length - 1)], rockMat, geom.mat4([x, site.floorY(x, z) + s * 0.1, z], [0, r.range(0, 6.28), 0], [s, s * 0.8, s]));
    }
  }
  // scattered stones in the open water near shores (accent / koi hides)
  for (let k = 0; k < 9; k++) {
    for (let t = 0; t < 40; t++) {
      const x = r.range(site.rect.minX + 3, site.rect.maxX - 3), z = r.range(site.rect.minZ + 3, site.rect.maxZ - 3);
      const sd = site.sd(x, z);
      if (sd < 1.0 || sd > 2.6 || site.wallZone(x, z)) continue;
      if (Math.abs(x - bridgeX) < 3 && z < 29) continue;
      addRock(x, z, r.range(0.5, 1.0), r.range(0.45, 0.7), r.range(0, 6.28));
      break;
    }
  }

  // ---- cut-stone retaining walls -----------------------------------------------
  const wb = new geom.Builder();
  const tintGeo = (g) => {
    const n = g.attributes.position.count;
    const t = r.range(0.78, 1.14), cr = t * r.range(0.97, 1.04), cg = t * r.range(0.97, 1.02), cb = t * r.range(0.93, 1.02);
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = cr; c[i * 3 + 1] = cg; c[i * 3 + 2] = cb; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  function wallRun(path) {
    const courses = [
      { y0: -1.3, y1: waterY - 0.1, len: [1.0, 1.6], depth: 0.55 },
      { y0: waterY - 0.1, y1: -0.205, len: [0.75, 1.3], depth: 0.5 },
    ];
    const seg = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], c = path[i + 1];
      const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (l < 1e-4) continue;
      seg.push({ a, c, l, s0: total }); total += l;
    }
    if (total < 0.5) return;
    const at = (s) => {
      s = clamp(s, 0, total - 1e-6);
      let sg = seg[0];
      for (const q of seg) { if (s >= q.s0 && s <= q.s0 + q.l) { sg = q; break; } }
      const t = (s - sg.s0) / sg.l;
      const x = sg.a[0] + (sg.c[0] - sg.a[0]) * t, z = sg.a[1] + (sg.c[1] - sg.a[1]) * t;
      let tx = (sg.c[0] - sg.a[0]) / sg.l, tz = (sg.c[1] - sg.a[1]) / sg.l;
      // water side from the distance field
      const [gx, gz] = grad(x, z);
      let nxx = -tz, nzz = tx;
      if (nxx * gx + nzz * gz < 0) { nxx = -nxx; nzz = -nzz; }
      return { x, z, tx, tz, nx: nxx, nz: nzz };
    };
    for (const c of courses) {
      let s = r.range(-0.4, 0);
      while (s < total) {
        const len = r.range(c.len[0], c.len[1]);
        const s0 = Math.max(s, 0), s1 = Math.min(s + len, total);
        if (s1 - s0 > 0.2) {
          const m = at((s0 + s1) / 2);
          const h = c.y1 - c.y0;
          const jitter = r.range(-0.015, 0.015);
          const d = c.depth;
          const cx = m.x - m.nx * (d / 2 - 0.02) + m.nx * jitter, cz = m.z - m.nz * (d / 2 - 0.02) + m.nz * jitter;
          const yaw = Math.atan2(-m.tz, m.tx) + r.range(-0.015, 0.015);
          const geo = tintGeo(new RoundedBoxGeometry(s1 - s0 - 0.014, h - 0.014, d, 2, r.range(0.03, 0.055)));
          wb.add(geo, wallMat, ctx.geom.mat4([cx, c.y0 + h / 2 + r.range(-0.01, 0.01), cz], [0, yaw, r.range(-0.008, 0.008)]));
        }
        s += len;
      }
    }
    // coping stones: thick slabs overhanging 4 cm, top just above the ground
    let s = r.range(-0.6, 0);
    while (s < total) {
      const len = r.range(1.1, 1.9);
      const s0 = Math.max(s, 0), s1 = Math.min(s + len, total);
      if (s1 - s0 > 0.25) {
        const m = at((s0 + s1) / 2);
        const d = r.range(0.6, 0.7), h = r.range(0.21, 0.27);
        const cx = m.x - m.nx * (d / 2 - 0.06), cz = m.z - m.nz * (d / 2 - 0.06);
        const yaw = Math.atan2(-m.tz, m.tx) + r.range(-0.012, 0.012);
        const geo = tintGeo(new RoundedBoxGeometry(s1 - s0 - 0.016, h, d, 3, r.range(0.035, 0.06)));
        wb.add(geo, wallMat, ctx.geom.mat4([cx, 0.04 - h / 2 + r.range(-0.008, 0.008), cz], [0, yaw, r.range(-0.006, 0.006)]));
      }
      s += len;
    }
  }
  // the wall face sits ~0.1 m into the water from the natural waterline
  {
    const faceLines = contourLines(site.sdGrid, nx, nz, site.gx0, site.gz0, RES, 0.1).filter((l) => l.length > 4);
    const runs = [];
    for (const line of faceLines) {
      const rs = resample(line, 0.4);
      // light smoothing (moving average)
      const sm = rs.map((p, i) => {
        let sx = 0, sz = 0, n = 0;
        for (let k = -3; k <= 3; k++) { const q = rs[clamp(i + k, 0, rs.length - 1)]; sx += q[0]; sz += q[1]; n++; }
        return [sx / n, sz / n];
      });
      let cur = [];
      for (const p of sm) {
        const [x, z] = p;
        const gap = Math.abs(x - bridgeX) < bridgeHW && (z < 9.5 || (Lg && z > Lg.minZ - 2.2 && z < Lg.minZ + 0.5));
        if (site.wallZone(x, z) && !gap) cur.push(p);
        else { if (cur.length > 2) runs.push(cur); cur = []; }
      }
      if (cur.length > 2) runs.push(cur);
    }
    for (const run of runs) wallRun(run);
  }

  const rocks = b.build({ name: 'pondRocks' });
  const walls = wb.build({ name: 'pondWalls' });
  group.add(rocks, walls);

  // floor / island only when the terrain module is not providing the basin
  if (!site.terrainLoaded) {
    group.add(buildFloor(ctx, site, U));
    if (!site.F) group.add(buildIsland(ctx, site, U, noise));
  }

  return { object: group };
}

function islandHeight(site, x, z) {
  const d = -site.sdExact(x, z); // + inside island (near island); but sdExact mixes outline, so use island polygon distance
  const isl = site.L.pond.island;
  const cx = isl.reduce((s, p) => s + p[0], 0) / isl.length, cz = isl.reduce((s, p) => s + p[1], 0) / isl.length;
  const inside = Math.max(0, d);
  return site.waterY + 0.12 + Math.min(inside, 3.0) * 0.28 - Math.max(0, Math.hypot(x - cx, z - cz) - 2.5) * 0.02;
}

function buildIsland(ctx, site, U, noise) {
  const isl = site.L.pond.island;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [x, z] of isl) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  minX -= 1; maxX += 1; minZ -= 1; maxZ += 1;
  const res = 0.18;
  const nx = Math.ceil((maxX - minX) / res), nz = Math.ceil((maxZ - minZ) / res);
  const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, nx, nz).rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const inside = -site.sdExact(x, z); // >0 on the island
    let y = site.waterY - 0.25 + smooth(-0.6, 0.6, inside) * 0.35 + Math.max(0, inside) * 0.22;
    y = Math.min(y, site.waterY + 0.95);
    y += noise.fbm2(x * 0.7, z * 0.7, 3) * 0.08 * smooth(0, 1.0, inside);
    pos.setY(i, y);
  }
  geo.computeVertexNormals();
  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.95, metalness: 0 }, {
    uniforms: { ...U },
    fragHead: POND_GLSL + 'float g_h;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float n = n_fbm(wp.xz * 1.3, 4);
        float m = n_fbm(wp.xz * 4.0 + 3.0, 3);
        vec3 moss = mix(vec3(0.040, 0.070, 0.012), vec3(0.11, 0.15, 0.030), smoothstep(-0.4, 0.6, m));
        vec3 soil = mix(vec3(0.050, 0.038, 0.025), vec3(0.09, 0.075, 0.05), n * 0.5 + 0.5);
        float mossAmt = smoothstep(-0.3, 0.3, n + (wp.y - uWaterY - 0.2) * 1.5);
        vec3 col = mix(soil, moss, mossAmt);
        // needles from the island pine
        float needles = smoothstep(0.5, 0.8, n_snoise(wp.xz * 9.0) * 0.5 + 0.5) * 0.4;
        col = mix(col, vec3(0.12, 0.07, 0.03), needles);
        float wet = 1.0 - smoothstep(0.0, 0.12, wp.y - uWaterY);
        col *= 1.0 - wet * 0.45;
        diffuseColor.rgb *= col;
        g_h = n * 0.3 + m * 0.4 + n_snoise(wp.xz * 22.0) * 0.08;
      }
    `,
    fragNormal: 'normal = n_bumpView(-vViewPosition, normal, g_h, 0.02);',
    fragEnd: UW_FRAGEND,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pondIsland';
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function buildFloor(ctx, site, U) {
  // grid over the basin rect, only cells near/in the water
  const { rect } = site;
  const res = 0.35;
  const nx = Math.ceil(rect.sx / res), nz = Math.ceil(rect.sz / res);
  const verts = [], idx = [];
  const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const keep = (x, z) => site.sd(x, z) > -1.4 || (site.F && site.F.sdIsland(x, z) < 0.8);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = rect.minX + i * res, z = rect.minZ + j * res;
    if (!keep(x, z)) continue;
    vid[j * (nx + 1) + i] = verts.length / 3;
    verts.push(x, site.floorY(x, z), z);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = vid[j * (nx + 1) + i], b = vid[j * (nx + 1) + i + 1], c = vid[(j + 1) * (nx + 1) + i], d = vid[(j + 1) * (nx + 1) + i + 1];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.9, metalness: 0 }, {
    uniforms: { ...U },
    fragHead: POND_GLSL + 'float g_h;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float n = n_fbm(wp.xz * 0.55, 4);
        float sd = pondMap(wp.xz).g * 8.0 - 2.0;
        vec3 mud = mix(vec3(0.040, 0.034, 0.022), vec3(0.085, 0.075, 0.050), n * 0.5 + 0.5);
        // silt lighter in the shallows
        mud = mix(vec3(0.12, 0.105, 0.075), mud, smoothstep(0.0, 1.6, sd));
        // pebbles in the shallows
        vec2 cell = floor(wp.xz * 9.0);
        vec2 wv = n_worley(wp.xz * 9.0);
        float peb = (1.0 - smoothstep(0.30, 0.42, wv.x)) * smoothstep(1.8, 0.2, sd) * step(0.35, n_hash12(cell));
        vec3 pc = vec3(0.20, 0.19, 0.17) * (0.6 + 0.8 * n_hash12(cell + 3.0));
        vec3 col = mix(mud, pc, peb * 0.9);
        // decayed leaves
        float lv = smoothstep(0.62, 0.78, n_fbm(wp.xz * 3.0 + 9.0, 3) * 0.5 + 0.5);
        col = mix(col, vec3(0.07, 0.035, 0.015), lv * 0.7);
        // green algae film
        col = mix(col, vec3(0.04, 0.06, 0.02), smoothstep(0.3, 0.8, n_fbm(wp.xz * 0.9 + 4.0, 3) * 0.5 + 0.5) * 0.5);
        diffuseColor.rgb *= col;
        g_h = peb * (1.0 - wv.x) * 0.6 + n * 0.1 + lv * 0.1;
      }
    `,
    fragNormal: 'normal = n_bumpView(-vViewPosition, normal, g_h, 0.03);',
    fragEnd: UW_FRAGEND,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pondFloor';
  mesh.receiveShadow = true; mesh.castShadow = false;
  return mesh;
}
