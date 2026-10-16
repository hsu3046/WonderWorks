// ---------------------------------------------------------------------------
// Stone paving: cut granite slabs in running bond with kerbs along every path
// (gate -> bridge, bridge -> hall stairs, branches to pagoda & pavilion),
// natural stepping stones through the moss, and the cut-stone revetment of the
// bridgehead peninsula. Every stone is its own bevelled, slightly worn block;
// all merged into one mesh with per-stone attributes for the shader.
// ---------------------------------------------------------------------------
import { TG_GLSL } from './terrain-glsl.js';
import { sdSegBox, segInfo, clamp, lerp, smoothstep } from './terrain-field.js';
import { slabGeometry, stepStoneGeometry } from './terrain-stonegeo.js';
import { gutterCurbs, buildGutterBed } from './terrain-gutter.js';

export function buildPaving(ctx, F) {
  const { THREE } = ctx;
  const R = ctx.rng('terrain-paving');
  const rnd = () => R.next();
  const noise = F.noise.n3;
  const geos = [];
  let stoneId = 0;
  const stones = []; // footprint records for ground cover & petals

  function emit(g, mtx, kind, extra = 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.P, 3));
    const n = g.S.length;
    const st = new Float32Array(n * 4);
    const id = R.next();
    for (let k = 0; k < n; k++) { st[k * 4] = id; st[k * 4 + 1] = g.S[k]; st[k * 4 + 2] = kind; st[k * 4 + 3] = extra; }
    geo.setAttribute('aStone', new THREE.BufferAttribute(st, 4));
    geo.setIndex(g.I);
    geo.computeVertexNormals();
    geo.applyMatrix4(mtx);
    geos.push(geo);
    stoneId++;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  // place a stone: centre (x,z), yaw, top height y, small tilts
  function place(g, x, z, yaw, y, kind, tilt = 0.006, extra = 0) {
    e.set(R.range(-tilt, tilt), yaw, R.range(-tilt, tilt), 'YXZ');
    q.setFromEuler(e);
    m4.compose(v.set(x, y, z), q, one);
    emit(g, m4, kind, extra);
    return m4.clone();
  }

  const main = F.paths[1]; // bridge -> hall stairs (hero)
  const pathTop = 0.055;
  // sandō: the stone approach continuing south from the gate through the wooded forecourt
  const gx = F.L.gate.center[0];
  const sando = segInfo([gx, F.R.maxZ + 3.8], [gx, F.R.maxZ + 46], 3.4);
  sando.sando = true;
  const allPaths = [...F.paths, sando];
  allPaths.forEach((P, pi) => {
    const walk = !!P.walk;
    const W = P.width, kerbW = walk ? 0.24 : 0.30;
    const outside = !!P.sando;
    // slab top: courtyard paths sit on the level bed (y 0); the sandō follows the forecourt ground
    const yBase = (x, z, hw, hd) => {
      if (!outside) return pathTop;
      let m = -1e9;
      for (const [a, b] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) m = Math.max(m, F.heightAt(x + a, z + b));
      return m + 0.06;
    };
    const yaw = Math.atan2(P.tx, P.tz); // local +z along the path
    const inner = W - 2 * kerbW;
    const isBranch = pi >= 2;
    const toWorld = (u, w) => [P.ax + P.tx * u + P.nx * w, P.az + P.tz * u + P.nz * w];
    // kerb = true: a kerb also stops where a secondary walk joins (T-junction opening)
    const clipped = (u0, u1, w0, w1, kerb = false) => {
      for (const [uu, ww] of [[u0, w0], [u1, w0], [u0, w1], [u1, w1], [(u0 + u1) / 2, (w0 + w1) / 2]]) {
        const [x, z] = toWorld(uu, ww);
        if (F.sdPondEff(x, z) < 0.45) return true;
        if (isBranch && !walk && sdSegBox(x, z, main) < 0.03) return true;
        if (pi === 0 && z < L_bridgeS + 0.0) return true;
        if (walk) for (let k = 0; k < pi; k++) if (sdSegBox(x, z, allPaths[k]) < 0.03) return true;
        if (kerb) for (let k = 0; k < allPaths.length; k++) if (k !== pi && allPaths[k].walk && sdSegBox(x, z, allPaths[k]) < -0.01) return true;
      }
      return false;
    };
    const L_bridgeS = F.L.bridge.south[2] - 0.05;
    // uchimizu: the processional paths have just been sprinkled (hero path wettest), branches drier
    const wetBase = pi === 1 ? 0.66 : pi === 0 ? 0.55 : outside ? 0.08 : walk ? 0.05 : 0.22;
    const wetOf = () => clamp(wetBase + R.range(-0.16, 0.12), 0, 1);
    const jMax = isBranch ? 0.034 : 0.044, jMin = isBranch ? 0.014 : 0.02;
    // kerbs on both sides
    for (const side of [-1, 1]) {
      let u = 0;
      while (u < P.len - 0.2) {
        let len = walk ? R.range(0.6, 1.15) : R.range(0.75, 1.35);
        if (P.len - u - len < 0.45) len = P.len - u;
        const joint = R.range(jMin, jMax - 0.008);
        const u0 = u + joint / 2, u1 = u + len - joint / 2;
        const w0 = side * (W / 2 - kerbW + joint / 2), w1 = side * W / 2;
        if (!clipped(u0, u1, Math.min(w0, w1), Math.max(w0, w1), true)) {
          const [cx, cz] = toWorld((u0 + u1) / 2, (w0 + w1) / 2);
          const g = slabGeometry(kerbW - joint, u1 - u0, 0.22, 0.03, rnd, 1.2, noise);
          const M = place(g, cx, cz, yaw, yBase(cx, cz, 0.2, (u1 - u0) / 2) + R.range(-0.008, 0.004), walk ? 1.25 : 1, 0.008, wetOf() * 0.85);
          stones.push({ x: cx, z: cz, w: kerbW - joint, d: u1 - u0, yaw, kind: 1, path: pi, m: M, side });
        }
        u += len;
      }
    }
    // field slabs: rows along the path, running bond across
    let u = 0;
    const rowD = pi === 1 ? [0.7, 1.05] : walk ? [0.48, 0.88] : [0.5, 0.85];
    const slabW = pi === 1 ? [0.75, 1.45] : walk ? [0.42, 1.05] : [0.55, 1.15];
    while (u < P.len - 0.15) {
      let dd = R.range(rowD[0], rowD[1]);
      if (P.len - u - dd < 0.3) dd = P.len - u;
      let w = -inner / 2;
      while (w < inner / 2 - 0.05) {
        let ww = R.range(slabW[0], slabW[1]);
        if (inner / 2 - (w + ww) < 0.32) ww = inner / 2 - w;
        const joint = R.range(jMin, jMax);
        const u0 = u + joint / 2, u1 = u + dd - joint / 2, w0 = w + joint / 2, w1 = w + ww - joint / 2;
        if (!clipped(u0, u1, w0, w1)) {
          const [cx, cz] = toWorld((u0 + u1) / 2, (w0 + w1) / 2);
          const g = slabGeometry(w1 - w0, u1 - u0, 0.2, 0.017, rnd, 1.4, noise);
          const M = place(g, cx, cz, yaw + R.range(-0.009, 0.009), yBase(cx, cz, (w1 - w0) / 2, (u1 - u0) / 2) + R.range(-0.008, 0.008), walk ? 0.25 : 0, 0.005, wetOf());
          stones.push({ x: cx, z: cz, w: w1 - w0, d: u1 - u0, yaw, kind: 0, path: pi, m: M });
        }
        w += ww;
      }
      u += dd;
    }
  });

  // ---- stepping stones through the moss gardens ----
  const trails = [
    [[7.6, 40.5], [3.5, 38.8], [-1, 37.3], [-4.5, 37.6], [-9, 39.5], [-13.5, 39.8]],
    [[12.4, 38.5], [17, 39.6], [21.5, 38.3], [26, 38.6], [31, 40.2], [35.5, 39.5]],
    [[45.5, 23.6], [46.5, 27.5], [49.5, 31], [53.5, 34], [57, 35.2]],
    [[-35, 5.5], [-38.5, 8.5], [-41, 13], [-41.5, 18.5], [-44, 23.5], [-46.5, 27]],
    [[-20, -44.2], [-12, -43.6], [-4, -44.5], [4, -43.8], [12, -44.3], [20, -43.6], [28, -44.4]],
    [[-22.5, 1.5], [-23.5, 4.2]],
  ];
  for (const tr of trails) {
    let carry = 0;
    for (let k = 0; k < tr.length - 1; k++) {
      const [ax, az] = tr[k], [bx, bz] = tr[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      for (let s = carry; s < L; s += R.range(0.68, 0.82)) {
        const zig = (stoneId % 2 ? 1 : -1) * R.range(0.06, 0.16);
        const x = ax + tx * s - tz * zig, z = az + tz * s + tx * zig;
        if (F.sdPondEff(x, z) < 0.6 || F.sdPaths(x, z) < 0.45) continue;
        const inGravel = F.mossAt(x, z) > 0.05 && F.soilAt(x, z) > 0.05;
        const Rr = inGravel ? R.range(0.3, 0.4) : R.range(0.24, 0.36);
        const g = stepStoneGeometry(Rr, 0.16, rnd, noise);
        // follow the local slope of the moss mounds; top 2-4 cm proud of the mean surface
        const hx = (F.heightAt(x + Rr * 0.7, z) - F.heightAt(x - Rr * 0.7, z)) / (1.4 * Rr);
        const hz = (F.heightAt(x, z + Rr * 0.7) - F.heightAt(x, z - Rr * 0.7)) / (1.4 * Rr);
        let gy = F.heightAt(x, z);
        for (let a = 0; a < 6; a++) gy += F.heightAt(x + Math.cos(a) * Rr * 0.7, z + Math.sin(a) * Rr * 0.7);
        gy /= 7;
        e.set(Math.atan(hz) * 0.8, R.range(0, 6.28), -Math.atan(hx) * 0.8, 'XYZ');
        q.setFromEuler(e);
        m4.compose(v.set(x, gy + (inGravel ? R.range(0.02, 0.035) : R.range(0.012, 0.03)), z), q, one);
        emit(g, m4, inGravel ? 5 : 2, R.range(0.0, 0.3));
        const M = m4.clone();
        stones.push({ x, z, w: Rr * 1.4, d: Rr * 1.4, yaw: 0, kind: 2, m: M, r: Rr });
        carry = 0;
      }
    }
  }

  // ---- peninsula revetment (cut stone wall + coping) ----
  {
    const Pn = F.PEN;
    const x0 = Pn.cx - Pn.hx, x1 = Pn.cx + Pn.hx, z0 = Pn.cz - Pn.hz;
    const shoreZ = (x) => { // where the pond outline crosses x (south shore), approx
      let best = 40;
      for (let z = z0; z < 40; z += 0.1) if (F.sdPond(x, z) > 0) { best = z; break; }
      return best;
    };
    const segs = [
      { a: [x0, shoreZ(x0) + 0.4], b: [x0, z0], out: [-1, 0] },
      { a: [x0, z0], b: [x1, z0], out: [0, -1] },
      { a: [x1, z0], b: [x1, shoreZ(x1) + 0.4], out: [1, 0] },
    ];
    for (const sg of segs) {
      const L = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
      const tx = (sg.b[0] - sg.a[0]) / L, tz = (sg.b[1] - sg.a[1]) / L;
      const yaw = Math.atan2(tx, tz);
      const courses = [
        { top: 0.07, h: 0.34, depth: 0.5, inset: 0.0, len: [0.8, 1.25], coping: true },
        { top: -0.29, h: 0.4, depth: 0.45, inset: 0.05, len: [0.55, 0.95] },
        { top: -0.71, h: 0.42, depth: 0.45, inset: 0.1, len: [0.5, 0.9] },
      ];
      for (const c of courses) {
        let s = c.coping ? -0.25 : R.range(-0.3, 0);
        while (s < L + 0.2) {
          let len = R.range(c.len[0], c.len[1]);
          const s0 = Math.max(s, -0.25), s1 = Math.min(s + len, L + 0.25);
          if (s1 - s0 > 0.2) {
            const mid = (s0 + s1) / 2;
            const off = -c.depth / 2 + 0.06 + c.inset; // centre inside the peninsula edge (out = +off along -out)
            const cx = sg.a[0] + tx * mid - sg.out[0] * off, cz = sg.a[1] + tz * mid - sg.out[1] * off;
            const g = slabGeometry(c.depth, s1 - s0 - 0.012, c.h, c.coping ? 0.035 : 0.045, rnd, 1.6, noise);
            place(g, cx, cz, yaw, c.top + R.range(-0.008, 0.008), 3, 0.01, c.coping ? 0.2 : 0);
          }
          s += len;
        }
      }
    }
  }

  // ---- drip-line gutter curbs (round the podiums and along the corridor plinth) ----
  const nGutter = gutterCurbs(F, R, rnd, noise, place, stones);

  // ---- merge ----
  const merged = ctx.geom.mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  const mat = pavingMaterial(ctx);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'paving';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.stones = stones;
  mesh.userData.count = stoneId;
  mesh.userData.gutterStones = nGutter;
  const bed = buildGutterBed(ctx, F);
  mesh.add(bed);
  return mesh;
}

function pavingMaterial(ctx) {
  const hooks = {
    vertexHead: /* glsl */ `attribute vec4 aStone; varying vec4 vStone;`,
    vertexWorld: /* glsl */ `vStone = aStone;`,
    fragHead: /* glsl */ `
      varying vec4 vStone;
      float p_h; float p_rough; float p_ao;
      ${TG_GLSL}
    `,
    fragColor: /* glsl */ `
    {
      vec3 wp = vWPos;
      vec2 fwp = fwidth(wp.xz);
      float fw = max(max(fwp.x, fwp.y), 1e-5);
      float id = vStone.x, dEdge = vStone.y, kind = vStone.z;
      float wetA = vStone.w;
      // bevel band (rounded, grimy arris) from the distance to the stone outline
      float bevW = kind < 0.5 ? 0.02 : kind < 1.5 ? 0.03 : kind < 2.5 ? 0.05 : kind < 3.5 ? 0.045 : kind < 4.5 ? 0.022 : 0.04;
      bool gutterK = kind > 3.5 && kind < 4.5;
      bool stepG = kind > 4.5;
      bool walkK = kind < 1.5 && fract(kind) > 0.2;
      float edge = 1.0 - smoothstep(0.0, bevW, dEdge);
      vec3 wn = normalize(vWNrm);
      float up = smoothstep(0.5, 0.95, wn.y);
      vec3 h3 = n_hash33(vec3(id * 113.0, id * 71.0, 3.0));
      // granite family: cool grey -> warm beige, light/dark members
      vec3 base = mix(vec3(0.345, 0.352, 0.352), vec3(0.44, 0.425, 0.39), h3.x * h3.x);
      base *= 0.74 + 0.42 * h3.y;
      if (h3.z > 0.92) base *= vec3(1.05, 0.98, 0.9);           // iron-stained
      else if (h3.z > 0.7) base *= vec3(1.07, 0.985, 0.94);     // pink feldspar granite
      else if (h3.z < 0.12) base *= vec3(0.9, 0.94, 0.98);      // blue-grey, finer grained
      if (kind > 1.5 && kind < 2.5) base = mix(vec3(0.30, 0.295, 0.28), vec3(0.42, 0.39, 0.35), h3.x); // river stone
      if (kind > 2.5 && kind < 3.5) base *= 0.88;
      if (gutterK) base = mix(base, vec3(0.40, 0.395, 0.38), 0.4) * 1.05;
      if (stepG) base = mix(vec3(0.43, 0.42, 0.40), vec3(0.55, 0.52, 0.475), h3.x) * (0.9 + 0.2 * h3.y);
      if (walkK) base = mix(base, vec3(0.47, 0.455, 0.425), 0.35) * 1.08;
      float fineF = 1.0 - smoothstep(0.0025, 0.012, fw);
      float fineF2 = 1.0 - smoothstep(0.0012, 0.006, fw);
      float mot = n_fbm3(wp * 2.2 + id * 7.0, 4);
      float mot2 = n_fbm3(wp * 6.5 - id * 3.0, 3);
      vec3 col = base * (0.86 + 0.2 * mot + 0.08 * mot2);
      // crystals: biotite specks, feldspar flecks
      float s1 = n_snoise3(wp * 95.0 + id * 9.0);
      float s2 = n_snoise3(wp * 230.0 - id * 5.0);
      col = mix(col, vec3(0.045), smoothstep(0.62, 0.86, s1) * 0.55 * fineF);
      col = mix(col, col * 1.38, smoothstep(0.66, 0.9, s2) * 0.4 * fineF2);
      // soft water / organic stains
      float stain = smoothstep(0.05, 0.6, n_fbm3(wp * 0.85 + id * 17.0, 3));
      col *= 1.0 - stain * 0.22;
      // hairline cracks across some slabs (Voronoi cell borders at the slab scale), dirt-filled
      float crack = 0.0;
      if (kind < 1.5 && fract(id * 7.31) < 0.22) {
        vec2 kid; float kf2;
        vec3 kw = tg_worley(wp.xz * 1.6 + vec2(id * 37.0, id * 11.0) + 0.04 * vec2(n_snoise(wp.xz * 9.0), n_snoise(wp.xz * 9.0 + 5.0)), kid, kf2);
        float kd = (kf2 - kw.x) / 1.6;
        float kwid = 0.0018 + 0.0012 * n_snoise(wp.xz * 4.0);
        crack = (1.0 - smoothstep(kwid, kwid + fw * 1.2, kd)) * min(1.0, kwid / max(fw * 0.6, 1e-4)) * up;
        col = mix(col, vec3(0.03, 0.028, 0.022), crack * 0.85);
      }
      // bush-hammered / chisel-dressed face: fine pitting (filtered)
      float pit = n_snoise3(wp * 140.0 + id) * fineF2;
      col *= 1.0 - 0.07 * smoothstep(0.3, 0.9, pit);
      // crustose lichen rosettes (pale) and black dots
      vec2 cid; float f2;
      vec3 wl = tg_worley(wp.xz * 5.5 + id * 31.0, cid, f2);
      float lh = n_hash12(cid + id * 7.0);
      float lich = step(0.80, lh) * smoothstep(0.42, 0.22, wl.x + 0.1 * n_snoise(wp.xz * 40.0));
      col = mix(col, vec3(0.50, 0.50, 0.41), lich * 0.5 * up);
      float bl = step(0.90, n_hash12(cid * 1.7 + 3.0)) * smoothstep(0.18, 0.08, wl.x);
      col = mix(col, vec3(0.035, 0.04, 0.03), bl * 0.55 * up);
      // grime in the arrises + moss creeping in from the joints
      float rim = smoothstep(0.25, 1.0, edge);
      if (gutterK) rim *= mix(0.3, 1.0, up);
      if (stepG) rim *= 0.6;
      if (walkK) rim *= 0.7;
      col *= 1.0 - rim * 0.42;
      float mossN = n_fbm3(wp * 5.0 + id * 3.0, 3) * 0.5 + 0.5;
      float mossAmt = gutterK ? 0.22 : stepG ? 0.1 : (kind > 1.5 && kind < 2.5) ? 0.4 : kind > 1.5 ? 0.75 : 0.5;
      float moss = smoothstep(0.5, 0.85, rim * 0.8 + mossN * 0.55 - 0.12) * mossAmt;
      moss = max(moss, smoothstep(0.78, 0.95, mossN) * 0.25 * up * mossAmt);
      // moss creeping a few cm in from the joints (irregular, cushion-edged), more at the corners
      float mossJ = n_fbm3(wp * 14.0 + id * 5.0, 2);
      float creepD = dEdge - 0.035 * (mossN - 0.35) - 0.012 * mossJ;
      float creep = (1.0 - smoothstep(0.0, walkK ? 0.035 : 0.055, creepD)) * up * (gutterK ? 0.12 : stepG ? 0.2 : walkK ? 0.6 : kind < 2.5 ? 0.95 : 0.6);
      moss = max(moss, creep * smoothstep(0.25, 0.55, mossN + 0.15 * mossJ));
      vec3 mossC = mix(vec3(0.035, 0.075, 0.016), vec3(0.10, 0.165, 0.03), n_snoise3(wp * 9.0) * 0.5 + 0.5);
      mossC *= 0.85 + 0.3 * smoothstep(-0.4, 0.6, n_snoise3(wp * 60.0)) * fineF;
      // revetment: algae + water stain below the waterline
      float wet = (kind > 2.5 && kind < 3.5) ? smoothstep(-0.25, -0.6, wp.y) : 0.0;
      col = mix(col, col * vec3(0.45, 0.5, 0.42), wet);
      col = mix(col, mossC, moss);
      // shallow damp dishes -> darker, glossy
      float damp = smoothstep(0.3, 0.72, n_fbm3(wp * 0.6 + 3.0 + id, 3) * 0.5 + 0.5) * up * (1.0 - moss) * (1.0 - rim * 0.5);
      col *= 1.0 - damp * 0.3;
      // sprinkled water (uchimizu): wet patches darken the granite and turn it glossy, thin films
      // stand in the worn dishes and along the joints; moss soaks up and stays matte-ish
      float wn1 = n_fbm3(vec3(wp.xz * 0.75, id * 3.0), 3);
      float wn2 = n_fbm3(vec3(wp.xz * 2.6 + 7.0, id * 5.0), 2);
      float wetM = smoothstep(0.38, 0.7, wetA + 0.6 * wn1 + 0.15 * wn2) * up;
      wetM = max(wetM, (1.0 - smoothstep(0.0, 0.05, dEdge)) * wetA * up * 0.8);
      float film = smoothstep(0.7, 0.9, wetA * 0.75 + 0.5 * wn1 + 0.35 * wn2 + 0.12 * smoothstep(0.08, 0.3, dEdge)) * up * (1.0 - moss);
      col *= mix(1.0, mix(0.68, 0.85, moss), wetM);
      col = mix(col, col * vec3(0.82, 0.84, 0.86), film);
      diffuseColor.rgb = col;
      float worn = (1.0 - rim) * up * (kind < 0.5 ? 1.0 : 0.5);
      p_rough = mix(0.66, 0.42, worn * (0.5 + 0.5 * h3.y));
      p_rough = mix(p_rough, 0.14, damp * 0.85);
      p_rough = mix(p_rough, 0.95, moss);
      p_rough = mix(p_rough, 0.3, wet);
      p_rough = mix(p_rough, mix(0.24, 0.55, moss), wetM);
      p_rough = mix(p_rough, 0.035, film);
      p_h = (mot2 * 0.0018 + mot * 0.0015 + n_snoise3(wp * 34.0) * 0.0005 * fineF + s1 * 0.00025 * fineF) + moss * 0.0025 + lich * 0.0004 - crack * 0.0012 - pit * 0.00012;
      p_h *= 1.0 - 0.3 * wetM - 0.65 * film;
      p_ao = 1.0 - rim * 0.3;
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = p_rough;`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, p_h, 1.0);`,
    fragLight: /* glsl */ `reflectedLight.indirectDiffuse *= p_ao;`,
  };
  const m = ctx.mat.std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, hooks);
  m.name = 'paving';
  return m;
}
