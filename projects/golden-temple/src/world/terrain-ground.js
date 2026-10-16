// ---------------------------------------------------------------------------
// Courtyard ground: one high resolution height-field mesh (gravel / moss /
// soil / pond bed) with a single procedural material driven by a signed
// distance mask texture (moss edge, soil edge, rake obstacle distance).
// ---------------------------------------------------------------------------
import { TG_GLSL, MOSS_GLSL, NEAR_GLSL } from './terrain-glsl.js';

export function buildGround(ctx, F) {
  const { THREE } = ctx;
  const { DOM, grid } = F;
  const { CELL, NX, NZ, gMoss, gSoil, gRake, gH, gPath } = grid;

  // ---- mesh (vertices on every 2nd mask cell) ----
  const STEP = 2;
  const nx = Math.floor((NX - 1) / STEP) + 1, nz = Math.floor((NZ - 1) / STEP) + 1;
  const dx = CELL * STEP;
  const skirt = 1;
  const vx = nx, vz = nz;
  const count = vx * vz + 2 * (vx + vz) * 2;
  const pos = new Float32Array(vx * vz * 3);
  const nrm = new Float32Array(vx * vz * 3);
  const H = (i, j) => gH[Math.min(j * STEP, NZ - 1) * NX + Math.min(i * STEP, NX - 1)];
  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const k = (j * vx + i) * 3;
      pos[k] = DOM.minX + i * dx; pos[k + 1] = H(i, j); pos[k + 2] = DOM.minZ + j * dx;
      const hl = H(Math.max(i - 1, 0), j), hr = H(Math.min(i + 1, vx - 1), j);
      const hd = H(i, Math.max(j - 1, 0)), hu = H(i, Math.min(j + 1, vz - 1));
      let gx = (hr - hl) / (2 * dx), gz = (hu - hd) / (2 * dx);
      const l = Math.hypot(gx, 1, gz);
      nrm[k] = -gx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -gz / l;
    }
  }
  const idx = [];
  for (let j = 0; j < vz - 1; j++) {
    for (let i = 0; i < vx - 1; i++) {
      const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
      // pick the diagonal that follows the surface better
      const ha = pos[a * 3 + 1], hb = pos[b * 3 + 1], hc = pos[c * 3 + 1], hd = pos[d * 3 + 1];
      if (Math.abs(ha - hd) < Math.abs(hb - hc)) { idx.push(a, c, d, a, d, b); } else { idx.push(a, c, b, b, c, d); }
    }
  }
  // skirt: duplicate border ring 1.5 m lower
  const border = [];
  for (let i = 0; i < vx; i++) border.push(i);
  for (let j = 1; j < vz; j++) border.push(j * vx + vx - 1);
  for (let i = vx - 2; i >= 0; i--) border.push((vz - 1) * vx + i);
  for (let j = vz - 2; j >= 1; j--) border.push(j * vx);
  const P2 = new Float32Array(pos.length + border.length * 3);
  const N2 = new Float32Array(nrm.length + border.length * 3);
  P2.set(pos); N2.set(nrm);
  const base = vx * vz;
  border.forEach((v, n) => {
    const k = (base + n) * 3;
    P2[k] = pos[v * 3]; P2[k + 1] = pos[v * 3 + 1] - 1.5; P2[k + 2] = pos[v * 3 + 2];
    N2[k] = nrm[v * 3]; N2[k + 1] = nrm[v * 3 + 1]; N2[k + 2] = nrm[v * 3 + 2];
  });
  for (let n = 0; n < border.length; n++) {
    const a = border[n], b = border[(n + 1) % border.length];
    const a2 = base + n, b2 = base + ((n + 1) % border.length);
    idx.push(a, b, a2, b, b2, a2);
  }
  // forest density of the land just outside (same field the land mesh uses) so the apron's outer
  // rim can take on the land's ground and canopy shade and the two meshes meet without a seam
  const FD = new Float32Array(P2.length / 3);
  for (let v = 0; v < FD.length; v++) FD[v] = F.forestDensity(P2[v * 3], P2[v * 3 + 2]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aFd', new THREE.BufferAttribute(FD, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N2, 3));
  geo.setIndex(P2.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();

  // ---- mask texture ----
  const toHalf = THREE.DataUtils.toHalfFloat;
  const data = new Uint16Array(NX * NZ * 4);
  for (let k = 0; k < NX * NZ; k++) {
    data[k * 4] = toHalf(Math.max(-40, Math.min(40, gMoss[k])));
    data[k * 4 + 1] = toHalf(Math.max(-40, Math.min(40, gSoil[k])));
    data[k * 4 + 2] = toHalf(Math.min(gRake[k], 8));
    data[k * 4 + 3] = toHalf(Math.max(-40, Math.min(40, gPath[k])));
  }
  const tex = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;

  const NL = 16;
  const lant = [];
  for (let i = 0; i < NL; i++) {
    const l = F.lanterns[i];
    lant.push(l ? new THREE.Vector3(l.x, l.z, l.r) : new THREE.Vector3(1e4, 1e4, 0));
  }
  // hero trees -> leaf / petal / needle litter on gravel and moss (x, z, crown radius, kind)
  const NT = 20;
  const KIND = { pine: 0, maple: 1, mapleRed: 2, cherry: 3 };
  const trees = [];
  for (let i = 0; i < NT; i++) {
    const t = F.trees[i];
    trees.push(t ? new THREE.Vector4(t.x, t.z, 1.4 + t.h * 0.42, KIND[t.type] ?? 1) : new THREE.Vector4(1e4, 1e4, 0, 0));
  }
  const uniforms = {
    uTree: { value: trees },
    tMask: { value: tex },
    uMaskX: { value: new THREE.Vector4(DOM.minX, DOM.minZ, 1 / CELL, 1 / CELL) },
    uMaskN: { value: new THREE.Vector2(NX, NZ) },
    uLant: { value: lant },
    uPag: { value: new THREE.Vector3(F.pagP.cx, F.pagP.cz, F.pagP.h) },
    uRect: { value: new THREE.Vector4(F.R.minX, F.R.minZ, F.R.maxX, F.R.maxZ) },
  };

  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.9, metalness: 0 }, groundHooks(uniforms, NL, NT));
  mat.name = 'terrainGround';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'courtyardGround';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return { mesh, uniforms, maskTex: tex };
}

function groundHooks(uniforms, NL, NT) {
  return {
    uniforms,
    defines: { NLANT: NL, NTREE: NT },
    vertexHead: /* glsl */ `attribute float aFd; varying float vFd;`,
    vertexWorld: /* glsl */ `vFd = aFd;`,
    fragHead: /* glsl */ `
      varying float vFd;
      uniform vec4 uTree[NTREE];
      uniform sampler2D tMask;
      uniform vec4 uMaskX;
      uniform vec2 uMaskN;
      uniform vec3 uLant[NLANT];
      uniform vec3 uPag;
      uniform vec4 uRect;
      float g_landShade; float g_landAmb; float g_h; float g_wM; float g_wS; float g_wG; float g_rough; float g_dirMul; vec3 g_nW; float g_sheen; float g_ao;
      ${TG_GLSL}
      ${MOSS_GLSL}
      ${NEAR_GLSL}
      vec4 tg_mask(vec2 p){
        vec2 uv = ((p - uMaskX.xy) * uMaskX.zw + 0.5) / uMaskN;
        return texture2D(tMask, uv);
      }
      // fallen maple leaves / cherry petals / pine needles under the hero trees, drifted a little
      // downwind (east). Returns coverage (filtered by the pixel footprint) and the litter colour.
      float tg_litter(vec2 p, float fw, out vec3 lc){
        float acc = 0.0; vec3 cacc = vec3(0.0);
        for (int i = 0; i < NTREE; i++){
          vec4 t = uTree[i];
          vec2 d = p - t.xy - vec2(0.85, -0.3) * t.z * 0.22;
          float r = length(d);
          if (r > t.z * 1.7) continue;
          float dens = smoothstep(t.z * 1.65, t.z * 0.3, r);
          vec3 c;
          if (t.w < 0.5) { c = vec3(0.17, 0.095, 0.045); dens *= 0.45; }
          else if (t.w < 1.5) { c = vec3(0.30, 0.25, 0.07); dens *= 0.3; }
          else if (t.w < 2.5) { c = vec3(0.40, 0.05, 0.022); }
          else { c = vec3(0.80, 0.58, 0.62); dens *= 0.45; }
          acc += dens; cacc += c * dens;
        }
        lc = vec3(0.0);
        if (acc < 0.003) return 0.0;
        lc = cacc / acc;
        float clump = smoothstep(-0.4, 0.5, n_fbm(p * 0.9 + 13.0, 2));
        float dens = min(acc, 1.0) * (0.2 + 0.8 * clump) * 0.95;
        vec2 cid; float f2;
        vec3 w = tg_worley(p * 24.0, cid, f2);
        vec3 h = n_hash33(vec3(cid, 9.1));
        float fade = 1.0 - smoothstep(0.01, 0.03, fw);
        // leaf outline: lobed (maple), oval (petal / needle tuft), random size and rotation
        float ang = atan(w.z, w.y) + h.z * 6.2831;
        float rad = (0.22 + 0.16 * h.y) * (0.78 + 0.22 * cos(5.0 * ang)) * (1.0 - 0.3 * abs(sin(ang)));
        float shape = smoothstep(rad + 0.04, rad - 0.03, w.x) * step(h.x, dens);
        lc *= mix(1.0, 0.65 + 0.7 * h.z, fade);
        lc = mix(lc, lc * vec3(1.2, 1.5, 0.7), step(0.8, h.y) * fade * 0.5);
        return mix(dens * 0.16, shape, fade);
      }
      // rake profile: rounded furrows
      float tg_rake(float u, float P){ float c = 0.5 + 0.5 * cos(6.2831853 * u / P); return c * c * (3.0 - 2.0 * c); }
      // unresolved furrows: mean direct light of the raked profile relative to flat ground (lambert on
      // the furrow flanks x self shadow). Under the grazing sun, furrows running across the light read
      // much brighter than flat ground, furrows along it slightly darker -> the rake pattern stays
      // visible from the air as a tone pattern instead of turning into flat grey
      float tg_rakeAvg(float lu, float ly, float P, float A);
      // mean radiance of the furrow profile as seen from direction (vu, vy): lambert x sun shadow,
      // weighted by each facet's projected area toward the viewer and masked by the ridges in front
      float tg_rakeView(float lu, float ly, float vu, float vy, float P, float A){
        float acc = 0.0, ws = 0.0;
        for (int i = 0; i < 12; i++){
          float u = (float(i) + 0.5) / 12.0 * P;
          float s = A * (tg_rake(u + 0.002, P) - tg_rake(u - 0.002, P)) / 0.004;
          float hr = A * tg_rake(u, P);
          float nl = (ly - s * lu) * inversesqrt(1.0 + s * s);
          float w = max(vy - s * vu, 0.0);
          float occ = 0.0, mo = 0.0;
          if (abs(lu) > 0.02) for (int k = 1; k <= 5; k++){ float t = float(k) / 5.0 * P * 0.95 / abs(lu); occ = max(occ, A * tg_rake(u + t * lu, P) - (hr + t * ly)); }
          if (abs(vu) > 0.02) for (int k = 1; k <= 5; k++){ float t = float(k) / 5.0 * P * 0.95 / abs(vu); mo = max(mo, A * tg_rake(u + t * vu, P) - (hr + t * vy)); }
          w *= 1.0 - smoothstep(0.0, A * 0.18, mo);
          acc += w * max(nl, 0.0) * (1.0 - smoothstep(0.0, A * 0.18, occ));
          ws += w;
        }
        return acc / max(ws, 1e-4) / max(ly, 0.03);
      }
      float tg_rakeAvg(float lu, float ly, float P, float A){
        float acc = 0.0;
        for (int i = 0; i < 8; i++){
          float u = (float(i) + 0.5) / 8.0 * P;
          float s = A * (tg_rake(u + 0.002, P) - tg_rake(u - 0.002, P)) / 0.004;
          float nl = (ly - s * lu) * inversesqrt(1.0 + s * s);
          float hr = A * tg_rake(u, P);
          float occ = 0.0;
          if (abs(lu) > 0.02) for (int k = 1; k <= 5; k++){ float t = float(k) / 5.0 * P * 0.95 / abs(lu); occ = max(occ, A * tg_rake(u + t * lu, P) - (hr + t * ly)); }
          acc += max(nl, 0.0) * (1.0 - smoothstep(0.0, A * 0.18, occ));
        }
        return acc / 8.0 / max(ly, 0.03);
      }
    `,
    fragColor: /* glsl */ `
    {
      vec2 p = vWPos.xz;
      vec3 nGeo = normalize(vWNrm);
      vec2 fwp = fwidth(p);
      float fw = max(sqrt(fwp.x * fwp.y), 1e-5);
      vec4 mk = tg_mask(p);
      // rake-obstacle field gradient (two extra taps)
      float eps = 0.08;
      float rB = mk.b;
      vec2 rGrad = vec2(tg_mask(p + vec2(eps, 0.0)).b - rB, tg_mask(p + vec2(0.0, eps)).b - rB);
      float eb = n_snoise(p * 6.0) * 0.05 + n_snoise(p * 21.0) * 0.018;
      float sM = mk.r + eb;
      float sS = mk.g + eb * 0.8;
      float aaM = max(fw * 1.2, 0.01);
      g_wM = smoothstep(aaM, -aaM, sM);
      g_wS = smoothstep(aaM, -aaM, sS) * (1.0 - g_wM);
      g_wG = max(1.0 - g_wM - g_wS, 0.0);
      vec3 col = vec3(0.0);
      vec2 grad = vec2(0.0);
      g_landShade = 1.0; g_landAmb = 1.0; g_h = 0.0; g_dirMul = 1.0; g_rough = 0.0; g_sheen = 0.0; g_ao = 1.0;
      vec3 L = normalize(uSunDir);

      // ---------------- gravel ----------------
      if (g_wG > 0.001) {
        // pebbles (warm granite chips ~1.7 cm) with finer grit in the gaps
        vec2 cid; float f2;
        float sc = 58.0;
        vec3 w = tg_worley(p * sc, cid, f2);
        float edge = f2 - w.x;
        vec3 rnd = n_hash33(vec3(cid, 3.7));
        float fade = 1.0 - smoothstep(0.005, 0.026, fw);
        vec3 pc;
        if (rnd.x < 0.40) pc = vec3(0.68, 0.655, 0.61);
        else if (rnd.x < 0.66) pc = vec3(0.76, 0.725, 0.665);
        else if (rnd.x < 0.82) pc = vec3(0.53, 0.515, 0.49);
        else if (rnd.x < 0.94) pc = vec3(0.72, 0.62, 0.56);
        else pc = vec3(0.22, 0.21, 0.20);
        pc *= 0.9 + 0.3 * rnd.y;
        float speck = smoothstep(0.55, 0.9, n_snoise(p * 520.0 + rnd.z * 40.0));
        pc = mix(pc, pc * 0.35, speck * 0.5 * fade);
        // facet shading inside each chip (angular, not domed)
        float facet = dot(normalize(w.yz + 1e-4), normalize(rnd.yz - 0.5));
        pc *= 1.0 + 0.10 * facet * fade;
        float dome = smoothstep(0.0, 0.30, edge) * (1.0 - 0.4 * w.x * w.x);
        float grit = n_snoise(p * 300.0) * 0.5 + 0.5;
        vec3 gapC = vec3(0.40, 0.385, 0.36) * (0.7 + 0.5 * grit);
        vec3 chip = mix(gapC, pc, smoothstep(0.02, 0.16, edge));
        vec3 avg = vec3(0.64, 0.615, 0.57) * 0.98;
        // mid scale: density / colour drift of the gravel bed so distance keeps texture
        float m1 = n_snoise(p * 7.0), m2 = n_snoise(p * 18.0 + 3.0);
        vec3 farC = avg * (0.94 + 0.07 * m1 + 0.05 * m2 * (1.0 - smoothstep(0.02, 0.06, fw)));
        vec3 gcol = mix(farC, chip, fade);
        // large scale: freshly raked clean areas vs settled / weathered grit (dust, organic film,
        // iron staining) -> soft warm/cool mottling that survives from the air
        float big = n_fbm(p * 0.45, 3);
        float mid = n_fbm(p * 2.2 + 7.0, 2);
        float huge = n_fbm(p * 0.075 + 21.0, 3);
        float settle = smoothstep(-0.25, 0.45, n_fbm(p * 0.19 - 4.0, 3));
        gcol *= 0.95 + 0.05 * big + 0.03 * mid + 0.06 * huge;
        gcol = mix(gcol, gcol * vec3(0.86, 0.84, 0.78), settle * 0.35);
        gcol = mix(gcol, gcol * vec3(1.05, 0.97, 0.88), smoothstep(0.3, 0.7, n_fbm(p * 0.33 + 40.0, 2)) * 0.35);
        float nearMoss = smoothstep(1.1, 0.0, mk.r) * smoothstep(-0.3, 0.25, n_fbm(p * 3.0 + 2.0, 2));
        gcol = mix(gcol, gcol * vec3(0.70, 0.69, 0.56), nearMoss * 0.55);
        // grit kicked onto the gravel along the path kerbs and building bases: darker, dusty
        float nearPath = smoothstep(0.7, 0.05, mk.a) * (0.6 + 0.4 * n_snoise(p * 2.5));
        gcol = mix(gcol, gcol * vec3(0.82, 0.80, 0.76), nearPath * 0.5);
        // rake pattern
        float P = 0.12, A = 0.025;
        float u; vec2 ud;
        float dl = 1e3; vec2 dlv = vec2(0.0, 1.0);
        for (int i = 0; i < NLANT; i++) { vec2 d = p - uLant[i].xy; float l = length(d) - uLant[i].z; if (l < dl) { dl = l; dlv = d; } }
        vec2 pq = p - uPag.xy;
        vec2 pqq = abs(pq) - vec2(uPag.z + 0.9);
        float sdPag = length(max(pqq, 0.0)) + min(max(pqq.x, pqq.y), 0.0);
        bool inPagZone = (max(abs(pq.x), abs(pq.y)) < uPag.z + 5.0);
        float ringW = 10.0 * P;
        // raking fields: E-W lines on the front plaza west of the axis and behind the hall, N-S
        // lines along the hall flanks, a slow sea-wave pattern east of the axis. Where two fields
        // meet the rake leaves a clean seam.
        bool flank = p.y < -8.6 && p.y > -37.0 && (p.x < -9.0 || p.x > 29.0);
        bool waves = p.x > 12.5 && p.y >= -8.6 && p.y < 9.0;
        float seamD = 1e3;
        if (p.x < -9.0 || p.x > 29.0) seamD = min(abs(p.y + 8.6), abs(p.y + 37.0));
        bool fieldMode = !(dl < 18.0 * P && dl < rB + 0.02) && !(rB < ringW) && !inPagZone;
        bool outsideR = p.x < uRect.x || p.y < uRect.y || p.x > uRect.z || p.y > uRect.w;
        if (outsideR) {
          // the walk round the outside of the corridor: lines parallel to the plinth
          fieldMode = false;
          vec2 rc = (uRect.xy + uRect.zw) * 0.5;
          vec2 q = max(max(uRect.xy - p, p - uRect.zw), 0.0);
          u = length(q) + 0.04 * n_snoise(p * 0.18);
          ud = normalize(q * sign(p - rc) + 1e-6);
        }
        else if (dl < 18.0 * P && dl < rB + 0.02) { u = dl; ud = normalize(dlv); }
        else if (rB < ringW) { u = rB; ud = normalize(rGrad + 1e-6); }
        else if (inPagZone) { u = sdPag; vec2 s = sign(pq); ud = pqq.x > pqq.y ? vec2(s.x, 0.0) : vec2(0.0, s.y); if (pqq.x > 0.0 && pqq.y > 0.0) ud = normalize(max(pqq, 0.0) * s); }
        else if (flank) {
          u = p.x + 0.055 * n_snoise(vec2(p.y * 0.21, 3.1)) + 0.014 * n_snoise(vec2(p.y * 0.9, 5.2));
          ud = vec2(1.0, 0.0);
        }
        else if (waves) {
          float k = 6.2831853 / 2.9;
          float amp = 0.17 + 0.03 * n_snoise(vec2(p.y * 0.13, 7.0));
          u = p.y + amp * sin(p.x * k + 0.6) + 0.02 * n_snoise(vec2(p.x * 0.5, 2.0));
          ud = normalize(vec2(amp * k * cos(p.x * k + 0.6), 1.0));
        }
        else {
          // hand-raked straight lines: never ruler straight, the line drifts a few cm over metres
          u = p.y + 0.055 * n_snoise(vec2(p.x * 0.21, 1.7)) + 0.014 * n_snoise(vec2(p.x * 0.9, 4.2));
          ud = vec2(0.0, 1.0);
        }
        float fu = fwidth(u);
        float rfade = 1.0 - smoothstep(0.25, 0.5, fu / P);
        float rk = tg_rake(u, P);
        float hr = A * rk;
        float du = 0.002;
        float slope = A * (tg_rake(u + du, P) - tg_rake(u - du, P)) / (2.0 * du);
        grad += g_wG * slope * ud * rfade;
        // rake passes (~63 cm): where the tines of neighbouring passes meet they leave a deeper,
        // messier groove and each pass sits a touch deeper or shallower -> soft lines that read
        // from the air. The groove is a filtered line (width grows with the pixel footprint, its
        // strength drops accordingly) so it fades into an average tone instead of aliasing.
        float Pb = 6.0 * P;
        // passes are never exactly equal in width: the pass grid drifts a few cm
        float ub = u + 0.07 * n_snoise(p * 0.31 + 5.0);
        float bi = floor(ub / Pb + 0.5);
        float ds = ub - bi * Pb;
        float sw = 0.035;
        float nfade = 1.0 - smoothstep(0.35, 1.0, fu / (2.0 * sw));   // groove relief: only while resolved
        float bfade = 1.0 - smoothstep(0.3, 0.65, fu / Pb);           // pass bands: readable far away
        float swA = 0.075;
        float wEff = max(swA, fu * 0.75);
        float seamL = exp(-ds * ds / (wEff * wEff)) * (swA / wEff);
        float seamH = -0.010 * exp(-ds * ds / (sw * sw));
        grad += g_wG * (-2.0 * ds / (sw * sw) * seamH) * ud * nfade;
        float bandV = n_hash12(vec2(bi, 7.3)) - 0.5;
        float bw = smoothstep(0.0, 0.12, abs(ds));
        gcol *= 1.0 + (0.3 * bandV * bw) * bfade;
        gcol *= 1.0 - 0.34 * seamL * bfade;
        // seam where two raking fields meet: a clean, slightly deeper line
        if (fieldMode && seamD < 0.5) {
          float swS = 0.045;
          float wS = max(swS, max(fwp.x, fwp.y) * 0.8);
          float sL = exp(-seamD * seamD / (wS * wS)) * (swS / wS);
          gcol *= 1.0 - 0.25 * sL;
        }
        // raking sessions: groups of four passes laid a little thicker / thinner -> broad soft
        // stripes along the rake direction that still read where single passes no longer resolve
        float Ps = 4.0 * Pb;
        float si = floor(ub / Ps);
        float sf = fract(ub / Ps);
        float sv = mix(n_hash12(vec2(si, 2.1)), n_hash12(vec2(si + 1.0, 2.1)), smoothstep(0.8, 1.0, sf)) - 0.5;
        gcol *= 1.0 + 0.2 * sv * (1.0 - smoothstep(0.3, 0.6, fu / Ps));
        // analytic self-shadow of the furrows under the grazing sun
        float lu = dot(L.xz, ud);
        float ly = L.y;
        float occ = 0.0;
        if (abs(lu) > 0.02) {
          for (int k = 1; k <= 7; k++) {
            float t = float(k) / 7.0 * P * 0.95 / abs(lu);
            float hh = A * tg_rake(u + t * lu, P) - (hr + t * ly);
            occ = max(occ, hh);
          }
        }
        float sh = 1.0 - smoothstep(0.0, A * 0.18, occ);
        // unresolved furrows: analytic mean of lit flanks / shadowed troughs, pass to pass a touch
        // deeper or shallower
        // Seen from a distance the furrow flanks facing the camera fill the pixel: with the sun
        // behind the camera the lit flanks dominate (bright), looking into the sun the shadowed
        // ones do (dark). This view-dependent mean is what makes raked patterns read from the air:
        // fields raked in different directions and the contour rings get distinct tones.
        vec3 Vw = normalize(cameraPosition - vWPos);
        float vu = dot(Vw.xz, ud), vy = Vw.y;
        float Ab = A * (1.0 + 0.55 * bandV * bfade);
        float rv = tg_rakeView(lu, ly, vu, vy, P, Ab);
        float farM = clamp(mix(1.0, rv, 0.6), 0.4, 1.9);
        if (rfade < 0.999) {
          float shFar = mix(1.0, tg_rakeAvg(lu, ly, P, Ab), 0.85);
          // resolved furrows keep their per-pixel light/shadow, rescaled toward the view-dependent
          // mean so that there is no tone step where the furrows dissolve
          float wN = smoothstep(0.1, 0.32, fu / P);
          sh = mix(farM, sh * mix(1.0, farM / max(shFar, 0.2), wN), rfade);
        }
        // furrows below pixel size: the box-filtered first harmonic of the lit / shadowed flanks keeps
        // the raked lines visible as fine stripes down to ~2 px per furrow, then fades out (no moire)
        {
          float rr = fu / P;
          float att = rr < 1.0 ? sin(3.14159265 * rr) / (3.14159265 * max(rr, 1e-3)) : 0.0;
          att *= 1.0 - smoothstep(0.5, 0.85, rr);
          float mS = clamp(0.5 * lu / max(ly, 0.05), -0.5, 0.5);
          sh *= 1.0 + (1.0 - rfade) * att * mS * sin(6.2831853 * u / P);
        }
        // the deeper groove between passes falls into shadow first under the low sun
        sh *= 1.0 - 0.25 * seamL * bfade * smoothstep(0.15, 0.6, abs(lu));
        // pebbles poking above the furrow line catch light even in the troughs
        sh = max(sh, dome * 0.55 * fade * step(0.6, rnd.z));
        g_dirMul = mix(1.0, sh, g_wG);
        // sky light: troughs and the pass grooves see less of the sky
        float aoG = mix(0.93, 0.8 + 0.2 * rk, rfade) * (1.0 - 0.12 * seamL * bfade);
        g_ao = mix(1.0, aoG, g_wG);
        // pebble micro relief
        g_h += g_wG * (dome * 0.004 * fade + (m1 * 0.0015 + m2 * 0.001) * (1.0 - fade));
        // furrow bottoms collect finer, darker grit
        gcol *= mix(1.0, 0.86 + 0.14 * rk, rfade);
        col += g_wG * gcol;
        g_rough += g_wG * mix(0.8, 0.9, fade * edge);
      }
      // ---------------- moss ----------------
      if (g_wM > 0.001) {
        vec3 mcol; float mh; float mr;
        tg_moss(p, vWPos.y, fw, mcol, mh, mr);
        // lawn scale variation: sunny yellow-green cushion fields vs deep emerald hollows, so the
        // moss beds keep colour structure from the air
        float lw = n_fbm(p * 0.12 + 50.0, 3);
        float lw2 = n_fbm(p * 0.6 - 20.0, 2);
        mcol *= 1.6 * vec3(0.93, 1.05, 0.84);
        mcol = mix(mcol, mcol * vec3(1.4, 1.28, 0.72), smoothstep(0.02, 0.45, lw) * 0.6);
        mcol = mix(mcol, mcol * vec3(0.68, 0.84, 0.95), smoothstep(-0.05, -0.45, lw) * 0.55);
        mcol *= 0.88 + 0.24 * smoothstep(-0.5, 0.5, lw2);
        // half-metre cushions and hollows: tone + gentle relief that the grazing sun picks out
        float mm = n_fbm(p * 1.8 + 70.0, 2);
        mcol *= 0.8 + 0.38 * smoothstep(-0.5, 0.5, mm);
        mcol = mix(mcol, mcol * vec3(1.25, 1.12, 0.7), smoothstep(0.25, 0.6, n_fbm(p * 1.1 - 33.0, 2)) * 0.45);
        mh += 0.010 * mm;
        // edge of the carpet: just inside it the moss thins and browns; the trimmed rim stands a few
        // cm proud of the gravel and its cut, stemmy flank reads as a dark line
        float rim = smoothstep(-0.5, 0.0, sM);
        mcol = mix(mcol, mcol * vec3(1.12, 0.92, 0.6), rim * 0.3);
        float lip = smoothstep(-0.12, -0.015, sM);
        mcol *= 1.0 - 0.42 * lip;
        g_ao = mix(g_ao, 1.0 - 0.3 * lip, g_wM);
        col += g_wM * mcol;
        g_h += g_wM * mh;
        g_rough += g_wM * mr;
        g_sheen += g_wM;
      }

      // ---------------- fallen leaves / petals / needles ----------------
      if (g_wG + g_wM > 0.01) {
        vec3 lc;
        float lt = tg_litter(p, fw, lc);
        float wGM = g_wG + g_wM;
        col = col * (1.0 - lt) + lc * lt * wGM;
        g_rough = mix(g_rough, 0.8 * wGM, lt);
        g_dirMul = mix(g_dirMul, 1.0, lt * 0.7);
        g_ao = mix(g_ao, 1.0, lt * 0.5);
      }

      // ---------------- soil / pond bed / forest floor ----------------
      if (g_wS > 0.001) {
        float big = n_fbm(p * 0.5, 3);
        float fine = n_snoise(p * 40.0) * 0.5 + n_snoise(p * 110.0) * 0.25;
        float fineF = 1.0 - smoothstep(0.004, 0.03, fw);
        vec3 scol = vec3(0.085, 0.064, 0.045) * (0.8 + 0.25 * big + 0.12 * fine * fineF);
        float under = smoothstep(-0.15, -0.65, vWPos.y);
        // pond bed: dark silt with algae
        vec3 silt = mix(vec3(0.045, 0.042, 0.030), vec3(0.05, 0.065, 0.03), smoothstep(-0.2, 0.5, big));
        scol = mix(scol, silt, under);
        // shore: damp dark band just above the water line
        float damp = smoothstep(0.25, -0.45, vWPos.y);
        scol *= 1.0 - damp * 0.35;
        // paving bed / joints: dark soil, moss and grit
        float inPath = smoothstep(0.06, -0.01, mk.a);
        if (inPath > 0.001) {
          vec3 jm; float jmh; float jmr;
          tg_moss(p, vWPos.y, fw, jm, jmh, jmr);
          // joints mostly grown in with moss (a few bare, dark, gritty stretches)
          vec3 jc = mix(vec3(0.040, 0.033, 0.025), jm * 1.45 + vec3(0.008, 0.016, 0.0), 0.2 + 0.8 * smoothstep(-0.5, 0.1, n_fbm(p * 3.0 + 5.0, 2)));
          scol = mix(scol, jc, inPath);
        }
        // forest floor outside: needles + leaf litter
        vec2 rq = p - uRect.xy; vec2 rq2 = uRect.zw - p;
        float outside = 1.0 - step(0.0, min(min(rq.x, rq.y), min(rq2.x, rq2.y)));
        if (outside > 0.5) {
          float lit = n_fbm(p * 1.3 + 4.0, 3);
          vec3 needles = vec3(0.13, 0.075, 0.04) * (0.8 + 0.3 * fine * fineF);
          vec3 fm; float fmh; float fmr;
          tg_moss(p, vWPos.y, fw, fm, fmh, fmr);
          // temple grounds outside the cloister: moss and fine grass with bare, needle-strewn
          // patches; patchy at several scales so it keeps structure from the air
          float o1 = n_fbm(p * 0.09 + 3.0, 3), o2 = n_fbm(p * 0.45 - 6.0, 3), o3 = n_snoise(p * 2.2);
          vec3 grassC = mix(vec3(0.055, 0.080, 0.020), vec3(0.115, 0.115, 0.038), smoothstep(-0.4, 0.5, o1 + 0.4 * o2));
          grassC *= 0.8 + 0.25 * o2 + 0.12 * o3 * (1.0 - smoothstep(0.05, 0.2, fw));
          // tussocks: ~30 cm clumps with dark bases and pale tips (filtered)
          vec2 tid; float tf2;
          vec3 tw = tg_worley(p * 3.2 + 1.7, tid, tf2);
          float tF = 1.0 - smoothstep(0.025, 0.1, fw);
          float tus = smoothstep(0.6, 0.05, tw.x) * (0.6 + 0.4 * n_hash12(tid));
          grassC *= mix(0.92, 0.62 + 0.62 * tus, tF);
          grassC = mix(grassC, grassC * vec3(1.3, 1.15, 0.7), tus * tF * smoothstep(0.0, 0.5, o2) * 0.5);
          g_h += g_wS * tus * 0.022 * tF;
          float mp = smoothstep(-0.25, 0.35, n_fbm(p * 0.35 + 9.0, 3));
          vec3 oc = mix(grassC, fm * 1.15, mp * 0.75);
          oc = mix(oc, needles, smoothstep(0.1, 0.6, lit) * 0.55);
          // drifts of last autumn's leaves and bare, trodden earth
          float o5 = n_fbm(p * 0.16 + 17.0, 3);
          tg_leafDrift(p, fw, smoothstep(0.15, 0.55, o5) * 0.7, oc);
          oc = mix(oc, vec3(0.13, 0.095, 0.06) * (0.85 + 0.25 * o3), smoothstep(0.3, 0.6, n_fbm(p * 0.07 - 9.0, 2)) * 0.35);
          vec3 olc; float olt = tg_litter(p, fw, olc);
          oc = mix(oc, olc, olt);
          // outer rim of the apron: hand over to the land's meadow / forest floor and its canopy shade
          vec2 qd = max(max(uRect.xy - p, p - uRect.zw), 0.0);
          oc *= 1.3;
          { float hs = 0.0; tg_sando(p, fw, oc, hs); g_h += g_wS * hs; }
          float toLand = smoothstep(7.0, 9.8, length(qd));
          if (toLand > 0.001) {
            float hM, hF;
            vec3 landC = mix(tg_meadow(p, vWPos.y, fw, hM), tg_forestFloor(p, vWPos.y, fw, hF), vFd);
            oc = mix(oc, landC, toLand);
            g_landShade = mix(1.0, mix(1.0, 0.22, vFd), toLand);
            g_landAmb = mix(1.0, mix(1.0, 0.75, vFd), toLand);
          }
          scol = oc;
        }
        col += g_wS * scol;
        g_dirMul *= mix(1.0, g_landShade, g_wS);
        g_ao *= mix(1.0, g_landAmb, g_wS);
        g_h += g_wS * (0.004 * fine * fineF);
        g_rough += g_wS * mix(0.92, 0.45, damp * (1.0 - under * 0.5));
      }
      diffuseColor.rgb = col;
      g_nW = normalize(nGeo + vec3(-grad.x, 0.0, -grad.y));
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(g_rough, 0.08, 1.0);`,
    fragNormal: /* glsl */ `
      normal = normalize((viewMatrix * vec4(g_nW, 0.0)).xyz);
      normal = n_bumpView(-vViewPosition, normal, g_h, 1.0);
    `,
    fragLight: /* glsl */ `
      reflectedLight.directDiffuse *= g_dirMul;
      reflectedLight.directSpecular *= g_dirMul;
      reflectedLight.indirectDiffuse *= g_ao;
      {
        float nv = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
        float nl = dot(geometryNormal, directLight.direction);
        float rim = pow(1.0 - nv, 3.0);
        reflectedLight.directDiffuse += g_sheen * directLight.color * rim * clamp(nl + 0.3, 0.0, 1.0) * vec3(0.10, 0.18, 0.06) * 0.22 * g_dirMul;
      }
    `,
  };
}
