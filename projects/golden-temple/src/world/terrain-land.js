// ---------------------------------------------------------------------------
// Landscape beyond the corridors: a single polar mesh from the edge of the
// courtyard mesh out to 6 km — forest floor, wooded hills, the western valley
// and three layers of mountain ridges. Far forest is a displaced canopy
// surface shaded as individual crowns.
// ---------------------------------------------------------------------------
import { TG_GLSL, MOSS_GLSL, NEAR_GLSL } from './terrain-glsl.js';
import { smoothstep, clamp, lerp } from './terrain-field.js';

export const CANOPY = { start: 400, full: 560, height: 17 };

export function buildLand(ctx, F) {
  const { THREE } = ctx;
  const { DOM, C } = F;
  const DEG = Math.PI / 180;
  const HXd = (DOM.maxX - DOM.minX) / 2, HZd = (DOM.maxZ - DOM.minZ) / 2;
  const Cd = [(DOM.maxX + DOM.minX) / 2, (DOM.maxZ + DOM.minZ) / 2];

  // ---- angular samples (denser in the directions the film looks) ----
  const NA = ctx.quality === 'preview' ? 1024 : 2048;
  const wAz = (adeg) => {
    const a = ((adeg % 360) + 360) % 360;
    // main sector: -30 (ESE) .. 240 (SW) through north
    const inMain = a <= 240 || a >= 330 ? 1 : 0;
    const t = a > 240 && a < 330 ? Math.min(smoothstep(240, 262, a), smoothstep(330, 308, a)) : 0;
    return inMain ? 1 : 1 - 0.62 * t;
  };
  const TAB = 7200;
  const cdf = new Float64Array(TAB + 1);
  for (let i = 0; i < TAB; i++) cdf[i + 1] = cdf[i] + wAz((i + 0.5) / TAB * 360);
  const angles = [];
  let ti = 0;
  for (let k = 0; k < NA; k++) {
    const target = (k / NA) * cdf[TAB];
    while (ti < TAB && cdf[ti + 1] < target) ti++;
    const f = (target - cdf[ti]) / Math.max(cdf[ti + 1] - cdf[ti], 1e-9);
    angles.push(((ti + f) / TAB) * 360);
  }
  // snap the samples nearest to the domain corners onto the exact corner directions
  const cornerA = [[DOM.maxX, DOM.minZ], [DOM.minX, DOM.minZ], [DOM.minX, DOM.maxZ], [DOM.maxX, DOM.maxZ]]
    .map(([x, z]) => ((Math.atan2(-(z - Cd[1]), x - Cd[0]) / DEG) + 360) % 360);
  for (const ca of cornerA) {
    let best = 0, bd = 1e9;
    angles.forEach((a, i) => { const d = Math.abs(a - ca); if (d < bd) { bd = d; best = i; } });
    angles[best] = ca;
  }

  // jittered-grid crowns (~8 m) -> dome height 0..1
  const hsh = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function crownBump(x, z) {
    const S = 8.5, gx = x / S, gz = z / S, ix = Math.floor(gx), iz = Math.floor(gz);
    let best = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cx = ix + a + hsh(ix + a, iz + b), cz = iz + b + hsh(iz + b + 7, ix + a - 3);
      const d = (gx - cx) * (gx - cx) + (gz - cz) * (gz - cz);
      if (d < best) best = d;
    }
    return Math.max(0, 1 - best) - 0.5;
  }

  // ---- rings ----
  const s0 = 1.6, q = 1.027, RMAX = 5900;
  const g = [0];
  while (g[g.length - 1] < RMAX) g.push(s0 * (Math.pow(q, g.length) - 1) / (q - 1));
  const NR = g.length + 1; // + outer skirt
  const nV = NA * NR;
  const pos = new Float32Array(nV * 3);
  const land = new Float32Array(nV * 4);
  const gnd = new Float32Array(nV);
  const bumpA = new Float32Array(nV);
  const CH = new Float32Array(nV), CAPR = new Float32Array(nV);
  for (let i = 0; i < NA; i++) {
    const a = angles[i] * DEG;
    const ca = Math.cos(a), sa = Math.sin(a);
    const dx = ca, dz = -sa;
    const rho0 = Math.min(HXd / Math.max(Math.abs(dx), 1e-9), HZd / Math.max(Math.abs(dz), 1e-9));
    for (let j = 0; j < NR; j++) {
      const rho = j < g.length ? rho0 + g[j] : rho0 + g[g.length - 1];
      let x = Cd[0] + dx * rho, z = Cd[1] + dz * rho;
      if (j === 0) { x = clamp(x, DOM.minX, DOM.maxX); z = clamp(z, DOM.minZ, DOM.maxZ); }
      const ground = j === 0 ? F.heightAt(x, z) : F.landHeight(x, z);
      const r = Math.hypot(x - C[0], z - C[1]);
      const fdNear = F.forestDensity(x, z);
      // height caps (sun / camera clearances) only concern the near forest, not the far mountains
      const cap = r > 720 ? Infinity : F.treeTopCap(x, z) + smoothstep(460, 720, r) * 400;
      const room = smoothstep(4, 12, cap - ground);
      // far forest: almost everything wooded, open patches by noise
      const farF = smoothstep(-0.55, -0.2, F.noise.f2(x / 900, z / 900, 3)) * 0.85 + 0.15;
      const cb = smoothstep(CANOPY.start, CANOPY.full, r);
      const fd = lerp(fdNear, farF, cb) * room;
      let ch = CANOPY.height * cb * fd * (0.85 + 0.3 * F.noise.f4(x / 60, z / 60, 2));
      // individual crown bumps on the canopy surface (silhouettes on far ridges); kept out of the
      // shading normals (the polar mesh is far too anisotropic for per-vertex crown relief)
      // (sampled ~11 m apart radially on the near hills -> ring-aligned ridges that self-shadow as
      // terraces under the low sun: keep them for the far silhouettes only)
      let chb = ch > 0.5 ? ch + cb * fd * 4.5 * crownBump(x, z) * smoothstep(950, 1700, r) : ch;
      if (cap !== Infinity) { ch = Math.max(0, Math.min(ch, cap - ground - 1)); chb = Math.max(0, Math.min(chb, cap - ground - 1)); }
      bumpA[j * NA + i] = j === NR - 1 ? 0 : chb - ch;
      CH[j * NA + i] = ch; CAPR[j * NA + i] = cap === Infinity ? 1e9 : cap - ground - 1;
      let y = ground + ch;
      if (j === NR - 1) y = ground - 400; // skirt
      const k = (j * NA + i) * 3;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      gnd[j * NA + i] = ground;
      const l = (j * NA + i) * 4;
      land[l] = fd; land[l + 1] = cb; land[l + 2] = 0; land[l + 3] = r;
    }
  }
  // Canopy edges: the canopy height (and the density that colours it) jumps from 0 to ~17 m within
  // one radial ring (13-19 m apart out there) -> vertical, dark "walls" on the far hills. Blur both
  // over ~30 m (angular box sized to the ring's arc spacing, radial 1-2-1), then re-apply the caps.
  {
    const wrapI = (i) => ((i % NA) + NA) % NA;
    const FD = new Float32Array(nV);
    for (let v = 0; v < nV; v++) FD[v] = land[v * 4];
    const tmpA = new Float32Array(nV), tmpB = new Float32Array(nV);
    const pre = new Float64Array(NA + 1);
    const blur = (src) => {
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < NR - 1; j++) {
          const r = land[(j * NA) * 4 + 3];
          if (r < 330) { for (let i = 0; i < NA; i++) tmpA[j * NA + i] = src[j * NA + i]; continue; }
          const arc = Math.max(r * (2 * Math.PI / NA), 0.2);
          const kt = clamp(Math.round(14 / arc), 1, 40);
          pre[0] = 0;
          for (let i = 0; i < NA; i++) pre[i + 1] = pre[i] + src[j * NA + i];
          const tot = pre[NA];
          for (let i = 0; i < NA; i++) {
            const a = i - kt, b = i + kt + 1;
            let s = 0;
            if (a < 0) s = pre[b] + (tot - pre[NA + a]);
            else if (b > NA) s = (tot - pre[a]) + pre[b - NA];
            else s = pre[b] - pre[a];
            tmpA[j * NA + i] = s / (2 * kt + 1);
          }
        }
        for (let i = 0; i < NA; i++) tmpA[(NR - 1) * NA + i] = src[(NR - 1) * NA + i];
        for (let j = 0; j < NR; j++) {
          for (let i = 0; i < NA; i++) {
            const v = j * NA + i;
            if (j === 0 || j >= NR - 2 || land[v * 4 + 3] < 330) { tmpB[v] = tmpA[v]; continue; }
            tmpB[v] = 0.25 * tmpA[v - NA] + 0.5 * tmpA[v] + 0.25 * tmpA[v + NA];
          }
        }
        src.set(tmpB);
      }
      void wrapI;
    };
    blur(CH); blur(FD);
    for (let j = 0; j < NR - 1; j++) {
      for (let i = 0; i < NA; i++) {
        const v = j * NA + i;
        if (land[v * 4 + 3] < 330) continue;
        const cbv = land[v * 4 + 1];
        const ch = Math.max(0, Math.min(CH[v], CAPR[v]));
        pos[v * 3 + 1] = gnd[v] + ch;
        land[v * 4] = lerp(land[v * 4], FD[v], cbv);
      }
    }
  }
  const idx = new Uint32Array((NA) * (NR - 1) * 6);
  let p = 0;
  for (let j = 0; j < NR - 1; j++) {
    for (let i = 0; i < NA; i++) {
      const i2 = (i + 1) % NA;
      const a = j * NA + i, b = j * NA + i2, c = (j + 1) * NA + i, d = (j + 1) * NA + i2;
      // angles increase counter-clockwise seen from above (x east, z south => -z north)
      idx[p++] = a; idx[p++] = b; idx[p++] = c;
      idx[p++] = b; idx[p++] = d; idx[p++] = c;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLand', new THREE.BufferAttribute(land, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  // ensure normals point up (winding check)
  const nrm = geo.attributes.normal.array;
  let up = 0;
  for (let k = 1; k < nrm.length; k += 3 * 97) up += nrm[k];
  if (up < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    geo.index.needsUpdate = true;
    geo.computeVertexNormals();
  }
  // rock exposure from slope
  const N = geo.attributes.normal.array;
  // (far mountains: only real crags; their anisotropic polar normals would otherwise streak)
  for (let v = 0; v < nV; v++) {
    const fr = smoothstep(500, 1100, land[v * 4 + 3]);
    land[v * 4 + 2] = smoothstep(0.86 - 0.24 * fr, 0.66 - 0.2 * fr, N[v * 3 + 1]);
  }
  const tb = performance.now();
  geo.setAttribute('aFar', new THREE.BufferAttribute(bakeFar(), 4));
  console.log('[terrain] land verts ' + nV + ' bake ms ' + Math.round(performance.now() - tb));
  for (let v = 0; v < nV; v++) pos[v * 3 + 1] += bumpA[v];
  geo.attributes.position.needsUpdate = true;
  geo.computeBoundingSphere(); geo.computeBoundingBox();

  // ---- baked per-vertex terrain sun visibility (the low sun far beyond the shadow map) and
  // concavity (valleys darker / ridges brighter) ----
  function bakeFar() {
    const far = new Float32Array(nV * 4);
    const wrapI = (i) => ((i % NA) + NA) % NA;
    const Y = (i, j) => pos[(j * NA + wrapI(i)) * 3 + 1];
    const GY = (i, j) => gnd[j * NA + wrapI(i)];
    // angle (deg) -> fractional sample index
    const ATAB = 14400, aIdx = new Float32Array(ATAB + 1);
    let k = 0;
    for (let t = 0; t <= ATAB; t++) {
      const a = (t / ATAB) * 360;
      if (a < angles[0]) { aIdx[t] = NA - 1 + (a + 360 - angles[NA - 1]) / (angles[0] + 360 - angles[NA - 1]); continue; }
      while (k < NA - 1 && angles[k + 1] <= a) k++;
      const a1 = k + 1 < NA ? angles[k + 1] : angles[0] + 360;
      aIdx[t] = k + clamp((a - angles[k]) / Math.max(a1 - angles[k], 1e-6), 0, 1);
    }
    const lnq = Math.log(q), JMAX = g.length - 1.001;
    function hAt(x, z) {
      const dx = x - Cd[0], dz = z - Cd[1];
      const rho = Math.hypot(dx, dz);
      const ux = dx / rho, uz = dz / rho;
      const rho0 = Math.min(HXd / Math.max(Math.abs(ux), 1e-9), HZd / Math.max(Math.abs(uz), 1e-9));
      const gj = rho - rho0;
      if (gj < 0) return F.heightAt(x, z);
      let a = Math.atan2(-dz, dx) / DEG; if (a < 0) a += 360;
      const fi = aIdx[Math.round((a / 360) * ATAB)];
      const fj = Math.min(Math.log(1 + (gj * (q - 1)) / s0) / lnq, JMAX);
      const i0 = Math.floor(fi), j0 = Math.floor(fj), u = fi - i0, w = fj - j0;
      return (Y(i0, j0) * (1 - u) + Y(i0 + 1, j0) * u) * (1 - w) + (Y(i0, j0 + 1) * (1 - u) + Y(i0 + 1, j0 + 1) * u) * w;
    }
    const E = 6.8 * DEG, SX = -0.9404, SZ = 0.3401;
    const LX = SX * Math.cos(E), LY = Math.sin(E), LZ = SZ * Math.cos(E), TANE = Math.tan(E);
    let maxY = 0;
    for (let v = 0; v < nV - NA; v++) if (pos[v * 3 + 1] > maxY) maxY = pos[v * 3 + 1];
    for (let j = 0; j < NR - 1; j++) {
      const sp = g[Math.min(j + 1, g.length - 1)] - g[j] || 1;
      for (let i = 0; i < NA; i++) {
        const v = j * NA + i;
        const x = pos[v * 3], z = pos[v * 3 + 2], y = pos[v * 3 + 1] + 1.2;
        const r = land[v * 4 + 3];
        // sun visibility: horizon march toward the sun with a soft penumbra
        let vis = 1;
        const nl = N[v * 3] * LX + N[v * 3 + 1] * LY + N[v * 3 + 2] * LZ;
        if (r > 200) {
          if (nl < -0.12) vis = 0;
          else {
            let kmin = 1e9;
            for (let t = 16; t < 7000; t *= 1.16) {
              const yr = y + t * TANE;
              if (yr > maxY + 4) break;
              const kk = (yr - hAt(x + SX * t, z + SZ * t)) / (1.5 + 0.026 * t);
              if (kk < kmin) { kmin = kk; if (kmin < -1) break; }
            }
            vis = smoothstep(-1, 1, kmin);
          }
        }
        // concavity at two scales on the bare ground (positive on ridges / spurs, negative in gullies)
        const rho = Math.hypot(x - Cd[0], z - Cd[1]);
        const da = ((i + 1 < NA ? angles[i + 1] : angles[0] + 360) - angles[i]) * DEG;
        const arc = Math.max(rho * da, 0.3);
        let cav = 0;
        for (const [S, wgt] of [[45, 0.55], [180, 0.45]]) {
          const kt = clamp(Math.round(S / arc), 1, 60), kr = clamp(Math.round(S / sp), 1, 40);
          const ja = Math.max(j - kr, 0), jb = Math.min(j + kr, NR - 2);
          const m = 0.25 * (GY(i - kt, j) + GY(i + kt, j) + GY(i, ja) + GY(i, jb));
          cav += wgt * clamp((gnd[v] - m) / (S * 0.12), -1, 1);
        }
        far[v * 4] = vis; far[v * 4 + 1] = cav; far[v * 4 + 2] = nl;
      }
    }
    return far;
  }

  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.92, metalness: 0 }, landHooks());
  mat.name = 'terrainLand';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'landscape';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function landHooks() {
  return {
    vertexHead: /* glsl */ `attribute vec4 aLand; attribute vec4 aFar; varying vec4 vLand; varying vec4 vFar;`,
    vertexWorld: /* glsl */ `vLand = aLand; vFar = aFar;`,
    fragHead: /* glsl */ `
      varying vec4 vLand; varying vec4 vFar;
      float l_dirMul; vec3 l_nW; float l_h; float l_rough; float l_transl; float l_amb; float l_vis;
      ${TG_GLSL}
      ${MOSS_GLSL}
      ${NEAR_GLSL}
    `,
    fragColor: /* glsl */ `
    {
      vec2 p = vWPos.xz;
      vec3 nGeo = normalize(vWNrm);
      vec2 fwp = fwidth(p);
      float fw = max(max(fwp.x, fwp.y), 1e-4);
      float fd = vLand.x, cb = vLand.y, rock = vLand.z;
      float dist = length(vWPos - cameraPosition);
      vec3 L = normalize(uSunDir);
      vec3 col;
      vec2 grad = vec2(0.0);
      l_h = 0.0; l_dirMul = 1.0; l_rough = 0.92; l_transl = 0.0;
      float big = n_fbm(p * 0.004, 4);
      float mid = n_fbm(p * 0.03 + 3.0, 3);

      // ---------- forest floor (under instanced trees) / meadow (open ground) ----------
      float hF, hM;
      vec3 floorC = tg_forestFloor(p, vWPos.y, fw, hF);
      l_h += (1.0 - cb) * hF;
      vec3 meadowC = tg_meadow(p, vWPos.y, fw, hM);
      {
        float farM = smoothstep(150.0, 420.0, vLand.w);
        if (farM > 0.001) {
          vec2 sid; float sf2;
          vec3 sw = tg_worley(p * 0.075 + 9.0, sid, sf2);
          vec3 sh3 = n_hash33(vec3(sid, 2.2));
          float dens = 0.25 + 0.6 * smoothstep(-0.35, 0.45, n_fbm(p * 0.0045 + 5.0, 2) + 0.5 * n_fbm(p * 0.02 - 3.0, 2));
          float rad = 0.2 + 0.16 * sh3.y;
          float clump = smoothstep(rad + 0.06, rad - 0.04, sw.x) * step(sh3.x, dens);
          float sfade = 1.0 - smoothstep(0.9, 3.0, fw * 0.075 * 4.0);
          float cov = mix(dens * 0.17, clump, sfade);
          vec3 tc = mix(vec3(0.022, 0.040, 0.020), vec3(0.06, 0.085, 0.026), sh3.z);
          tc *= mix(1.0, 0.7 + 0.5 * smoothstep(0.0, rad, sw.x), sfade);
          meadowC = mix(meadowC, tc, cov * farM);
        }
      }
      l_h += (1.0 - cb) * (1.0 - fd) * hM;
      // ---------- canopy surface (crowns) ----------
      vec3 canC;
      float crownLight = 1.0;
      float farW = smoothstep(380.0, 900.0, vLand.w);
      float cavR = smoothstep(-0.75, 0.75, vFar.y); // 0 gully .. 1 ridge / spur
      {
        // stands: cryptomeria plantations (dark, crisp-edged patches on the slopes), mixed
        // broadleaf (warmer, lighter), pale young growth along ridges, a few early-turning trees
        float st1 = n_fbm(p * 0.0042 + 11.0, 3);
        float st2 = n_fbm(p * 0.016 - 4.0, 2);
        float plant = smoothstep(0.02, 0.12, st1 + 0.45 * st2 - 0.18 * cavR + 0.08);
        float young = smoothstep(0.25, 0.6, n_fbm(p * 0.009 + 21.0, 2) + 0.35 * cavR - 0.1) * (1.0 - plant);
        vec2 cid; float f2;
        float cs = 1.0 / mix(7.5, 5.2, plant);
        vec3 w = tg_worley(p * cs, cid, f2);
        vec3 r = n_hash33(vec3(cid, 5.1));
        float conifer = max(plant * step(0.08, r.x), step(0.62 + 0.25 * big, r.x));
        vec3 coniferC = mix(vec3(0.016, 0.034, 0.024), vec3(0.030, 0.052, 0.030), r.y);
        vec3 broadC = mix(vec3(0.048, 0.080, 0.022), vec3(0.090, 0.118, 0.030), r.y);
        broadC = mix(broadC, vec3(0.105, 0.125, 0.040), young * 0.7);
        canC = mix(broadC, coniferC, conifer);
        canC = mix(canC, vec3(0.13, 0.085, 0.03), step(0.955, r.z) * (1.0 - conifer) * 0.7); // early-turning
        canC *= 0.85 + 0.3 * mid;
        float fwg = max(sqrt(fwp.x * fwp.y), 1e-4);
        float cfade = 1.0 - smoothstep(0.4, 1.2, fw * cs);
        // crown dome (pointier for conifers)
        float fr = clamp(w.x, 0.0, 1.0);
        float dome = conifer > 0.5 ? (1.0 - fr) : (1.0 - fr * fr);
        float gap = smoothstep(0.0, 0.28, f2 - w.x);
        // dome gradient (toward the crown centre = uphill)
        vec2 gdir = w.yz / max(w.x, 1e-3);
        float slope = (conifer > 0.5 ? 1.3 : 2.0 * fr) * 3.5 * cs;
        grad += cb * gdir * (-slope) * cfade * fd;
        // mean-preserving fade: distant canopy keeps the average darkness of crowns + gaps
        canC *= mix(0.6, mix(0.35, 1.0, gap) * (0.7 + 0.3 * dome), cfade);
        // leaf clusters inside crowns
        float lc = n_snoise(p * 0.9 + r.xy * 50.0);
        canC *= mix(1.0, 0.8 + 0.3 * lc, cfade * smoothstep(0.0, 1.0, 3.0 / max(fw * 10.0, 0.01)));
        crownLight = mix(0.62, 0.55 + 0.45 * smoothstep(0.1, 0.9, dome) * gap, cfade);
        // filtered clump texture (groups of crowns, gaps) that survives far beyond single crowns
        float cl1 = n_snoise(p * 0.075 + r.x * 0.0) * (1.0 - smoothstep(3.0, 11.0, fw));
        float cl2 = n_snoise(p * 0.026 + 3.0) * (1.0 - smoothstep(9.0, 32.0, fw));
        canC *= 1.0 + farW * (0.2 * cl1 + 0.16 * cl2);
        crownLight *= 1.0 + farW * (0.3 * cl1 + 0.18 * cl2);
        l_transl = cb * fd;
        // terrain-scale shading on the far slopes: gullies dark and cool, spurs and crests brighter
        canC *= mix(1.0, mix(0.74, 1.1, cavR) * 1.25, farW);
        canC = mix(canC, canC * vec3(0.85, 0.95, 1.12), farW * (1.0 - cavR) * 0.5);
        // terrain-scale modelling of the far ranges by the low sun (baked smooth-normal N.L): faces
        // turned to the sun warm and bright, averted faces cool -> ranges read as lit 3D forms even
        // when front-lit through the haze
        {
          float tl = smoothstep(-0.04, 0.32, vFar.z);
          float fr2 = smoothstep(700.0, 1600.0, vLand.w);
          canC *= mix(1.0, mix(0.72, 1.28, tl), fr2);
          canC = mix(canC, canC * vec3(1.16, 1.0, 0.78), fr2 * tl * 0.55);
          canC = mix(canC, canC * vec3(0.86, 0.95, 1.14), fr2 * (1.0 - tl) * 0.55);
        }
        // fine relief (sub-gully ribs) for the grazing light
        float relief = n_fbm(p * 0.045 + 7.0, 2);
        l_h += farW * cb * relief * 0.5 * (1.0 - smoothstep(2.0, 8.0, fw));
      }
      // ---------- rock ----------
      vec3 rockC = vec3(0.16, 0.15, 0.135) * (0.75 + 0.4 * n_fbm(p * 0.08, 3));

      vec3 under = mix(meadowC, floorC, fd);
      // forest floor sits in the shade of the canopy
      float floorShade = mix(1.0, 0.22, fd * (1.0 - cb));
      vec3 canopyAll = mix(meadowC, canC, fd);
      col = mix(under, canopyAll, cb);
      col = mix(col, rockC, rock * 0.75);
      // hotspot: with the sun behind the viewer the crown shadows hide behind the crowns
      float hot = smoothstep(0.55, 0.98, dot(normalize(cameraPosition - vWPos), L)) * farW;
      l_dirMul = mix(floorShade, mix(1.0, mix(crownLight, 1.0, hot * 0.7), fd), cb);
      // canopy self-shadowing under the grazing sun: slopes turned to the sun light up whole crowns,
      // level or averted ground only catches crown tops
      float nlG = dot(nGeo, L);
      l_dirMul *= mix(1.0, mix(0.3, 1.0, smoothstep(-0.02, 0.38, nlG)), cb * fd * (1.0 - hot * 0.6));
      // baked terrain shadow (ridges toward the sun), beyond the shadow-map range
      l_vis = mix(1.0, vFar.x, smoothstep(200.0, 380.0, vLand.w));
      l_dirMul *= l_vis;
      l_amb = mix(1.0, mix(0.68, 1.05, cavR), farW);
      l_rough = mix(0.92, 0.85, cb);
      diffuseColor.rgb = col;
      l_nW = normalize(nGeo + vec3(-grad.x, 0.0, -grad.y));
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = l_rough;`,
    fragNormal: /* glsl */ `
      normal = normalize((viewMatrix * vec4(l_nW, 0.0)).xyz);
      normal = n_bumpView(-vViewPosition, normal, l_h, 1.0);
    `,
    fragLight: /* glsl */ `
      reflectedLight.directDiffuse *= l_dirMul;
      reflectedLight.directSpecular *= l_dirMul;
      reflectedLight.indirectDiffuse *= mix(1.0, 0.75, vLand.x * (1.0 - vLand.y)) * l_amb;
      {
        // leaf translucency when looking toward the sun; rim glow on sunlit crests seen against the light
        float vs = clamp(dot(-geometryViewDir, directLight.direction), 0.0, 1.0);
        float rimN = pow(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0), 2.0);
        reflectedLight.directDiffuse += l_transl * l_vis * directLight.color * pow(vs, 6.0) * vec3(0.10, 0.12, 0.02) * (0.6 + 1.6 * rimN);
      }
    `,
    fragEnd: /* glsl */ `
      #ifdef USE_FOG
      {
        // extra aerial perspective with distance so successive ridge layers separate (paler, bluer)
        // (haze tint without the bright forward-scatter glow, so ridges near the sun keep their silhouette)
        vec3 Vd = vWPos - cameraPosition;
        float dd = length(Vd);
        float mu = dot(Vd / max(dd, 1e-3), normalize(uSunDir));
        float toward = pow(max(mu, 0.0) * 0.5 + 0.5, 3.0);
        vec3 hz = mix(fogColor * vec3(0.92, 0.97, 1.08), fogColor * vec3(1.25, 1.04, 0.82), toward);
        hz += vec3(1.0, 0.62, 0.30) * 0.05 * pow(max(mu, 0.0), 8.0);
        // (backlit ridges keep more of their dark silhouette: the engine's aerial pass already
        // adds the forward-scatter glow toward the sun)
        float od = 0.00019 * max(dd - 380.0, 0.0) * (1.0 - 0.25 * smoothstep(0.0, 400.0, vWPos.y)) * (1.0 - 0.45 * toward);
        float Te = exp(-od);
        outgoingLight = outgoingLight * Te + hz * (1.0 - Te);
      }
      #endif
    `,
  };
}
