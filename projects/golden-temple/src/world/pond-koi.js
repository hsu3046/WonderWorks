// ---------------------------------------------------------------------------
// Koi (Nishikigoi) swimming slowly just under the surface — deterministic in
// time (closed loops, body undulation in the vertex shader), procedural
// varieties (kohaku, sanke, showa, ogon, chagoi, orange, asagi) with scales.
// Floating debris: red/orange maple leaves and a few cherry petals.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { POND_GLSL, UW_FRAGEND } from './pond-water.js';
import { clamp, smooth } from './pond-util.js';

const TAU = Math.PI * 2;

// Body along +X (nose at x = 0, tail toward -x), length 1, y up, z lateral.
// Parts: 0 body | 1 fin membrane | 2 eye | 3 barbel
function koiGeometry() {
  const pos = [], uv = [], part = [], idx = [];
  const NU = 72, NV = 30;
  // torpedo body: blunt rounded snout, deep shoulders, tapering caudal peduncle
  const hgt = (s) => {
    const head = s < 0.1 ? 0.45 + 0.55 * Math.sqrt(Math.sin((s / 0.1) * Math.PI * 0.5)) : 1;
    const body = Math.pow(Math.sin(Math.PI * Math.min(s / 0.74, 1) * 0.5 + 0.0001), 0.62) * (1 - smooth(0.36, 0.93, s) * 0.74);
    return 0.012 + 0.2 * body * head;
  };
  const wid = (s) => {
    const head = s < 0.08 ? 0.5 + 0.5 * Math.sqrt(Math.sin((s / 0.08) * Math.PI * 0.5)) : 1;
    return 0.010 + 0.155 * Math.pow(Math.sin(Math.PI * Math.min(s / 0.6, 1) * 0.5 + 0.0001), 0.6) * (1 - smooth(0.3, 0.94, s) * 0.82) * head;
  };
  const back = (s) => 0.022 * Math.sin(Math.PI * Math.min(s * 1.15, 1)); // dorsal hump
  for (let i = 0; i <= NU; i++) {
    const s = Math.pow(i / NU, 1.08);
    const x = -s;
    const h = hgt(s) * 0.5, w = wid(s) * 0.5;
    for (let j = 0; j <= NV; j++) {
      const a = (j / NV) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      // flatter belly, slightly squarer cross-section (superellipse)
      const se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.86);
      let yy = sa > 0 ? se(sa) * h * 1.05 + back(s) * sa : se(sa) * h * 0.86;
      let zz = se(ca) * w;
      // mouth: a small notch at the snout tip, slightly below centre
      if (s < 0.025) { const m = 1 - s / 0.025; yy -= 0.004 * m; zz *= 1 - 0.25 * m * Math.exp(-sa * sa * 8); }
      pos.push(x, yy, zz);
      uv.push(s, j / NV);
      part.push(0);
    }
  }
  const row = NV + 1;
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const addTri = (verts, faces, uvs, p) => {
    const base = pos.length / 3;
    verts.forEach((v, k) => { pos.push(v[0], v[1], v[2]); uv.push(uvs[k][0], uvs[k][1]); part.push(p); });
    faces.forEach((f) => idx.push(base + f[0], base + f[1], base + f[2]));
  };
  // fin: a fan of rays from a root polyline; pleated (alternate rays lifted) so it
  // catches light like a real ray-finned membrane. uv = (along ray 0..1, across 0..1)
  const fan = (root, tips, pleat, nAlong = 6) => {
    const verts = [], uvs = [], faces = [];
    const N = root.length - 1;
    for (let k = 0; k <= N; k++) {
      const [r0, t0] = [root[k], tips[k]];
      for (let a = 0; a <= nAlong; a++) {
        const t = a / nAlong;
        verts.push([r0[0] + (t0[0] - r0[0]) * t, r0[1] + (t0[1] - r0[1]) * t, r0[2] + (t0[2] - r0[2]) * t]);
        uvs.push([t, k / N]);
      }
    }
    for (let k = 0; k < N; k++) for (let a = 0; a < nAlong; a++) {
      const i0 = k * (nAlong + 1) + a, i1 = i0 + 1, j0 = i0 + nAlong + 1, j1 = j0 + 1;
      faces.push([i0, j0, i1], [i1, j0, j1]);
    }
    return { verts, faces, uvs };
  };
  const pleatFan = (root, tips, axis, amp, nAlong = 6) => {
    const F = fan(root, tips, 0, nAlong);
    const N = root.length - 1;
    for (let k = 0; k <= N; k++) for (let a = 0; a <= nAlong; a++) {
      const t = a / nAlong;
      const v = F.verts[k * (nAlong + 1) + a];
      const lift = (k % 2 ? 1 : -1) * amp * Math.sin(Math.PI * Math.min(t * 1.15, 1)) * Math.pow(t, 0.7);
      v[0] += axis[0] * lift; v[1] += axis[1] * lift; v[2] += axis[2] * lift;
    }
    return F;
  };
  // caudal fin (forked, vertical plane at the tail)
  {
    const N = 22, root = [], tips = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const yv = t * 2 - 1;
      const len = 0.17 + 0.17 * Math.pow(Math.abs(yv), 1.15) - 0.07 * (1 - Math.abs(yv)) * (1 - Math.abs(yv));
      root.push([-0.965, yv * 0.032, 0]);
      tips.push([-0.965 - len, yv * 0.15 + yv * Math.abs(yv) * 0.02, 0]);
    }
    const F = pleatFan(root, tips, [0, 0, 1], 0.004, 7);
    addTri(F.verts, F.faces, F.uvs, 1);
  }
  // dorsal fin (long, along the back)
  {
    const N = 18, root = [], tips = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const x = -0.34 - t * 0.36;
      const s = -x;
      const yb = 0.5 * hgt(s) * 1.05 + back(s) - 0.004;
      const fh = 0.08 * Math.sin(Math.PI * Math.pow(t, 0.55)) * (1 - 0.35 * t) + 0.006;
      root.push([x, yb, 0]);
      tips.push([x - 0.045 - 0.02 * t, yb + fh, 0]);
    }
    const F = pleatFan(root, tips, [0, 0, 1], 0.0025, 5);
    addTri(F.verts, F.faces, F.uvs, 1);
  }
  // paired fins: pectoral (large, rounded), pelvic; single anal fin
  const paired = (x0, y0, z0, len, spread, yaw, droop, side, nR) => {
    const root = [], tips = [];
    for (let k = 0; k <= nR; k++) {
      const t = k / nR;
      const a = (t - 0.5) * spread;
      const L = len * (0.55 + 0.45 * Math.cos(a * 1.9));
      const dx = -Math.cos(yaw + a), dz = Math.sin(yaw + a) * side;
      root.push([x0 - t * 0.03, y0, z0]);
      tips.push([x0 + dx * L * 0.75, y0 - droop * L, z0 + dz * L]);
    }
    const F = pleatFan(root, tips, [0, 1, 0], 0.003, 6);
    addTri(F.verts, F.faces, F.uvs, 1);
  };
  for (const side of [1, -1]) {
    paired(-0.19, -0.052, side * 0.056, 0.16, 1.1, 0.95, 0.22, side, 14);
    paired(-0.47, -0.07, side * 0.03, 0.085, 0.9, 0.55, 0.35, side, 10);
  }
  {
    const N = 10, root = [], tips = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, x = -0.72 - t * 0.08;
      const yb = -0.5 * hgt(-x) * 0.86 + 0.003;
      root.push([x, yb, 0]);
      tips.push([x - 0.04, yb - 0.05 * Math.sin(Math.PI * Math.pow(t, 0.6)) - 0.004, 0]);
    }
    const F = pleatFan(root, tips, [0, 0, 1], 0.0015, 4);
    addTri(F.verts, F.faces, F.uvs, 1);
  }
  // eyes: small domes on both sides (part 2)
  for (const side of [1, -1]) {
    const e = new THREE.SphereGeometry(0.0125, 14, 10);
    e.scale(1, 1, 0.55);
    const s0 = 0.072;
    e.translate(-s0, 0.012, side * (wid(s0) * 0.5 - 0.0015));
    const p = e.attributes.position, u = e.attributes.uv;
    const base = pos.length / 3;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); part.push(2); }
    const ix = e.index.array;
    for (let i = 0; i < ix.length; i += 3) idx.push(base + ix[i], base + ix[i + 1], base + ix[i + 2]);
  }
  // barbels: two pairs of short whiskers at the corners of the mouth (part 3)
  const tube = (pts, r0, r1, sides = 5) => {
    const base = pos.length / 3;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, n - 1)], o = pts[Math.max(i - 1, 0)];
      const t = new THREE.Vector3(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
      const nn = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
      const bb = new THREE.Vector3().crossVectors(t, nn).normalize();
      const rr = r0 + (r1 - r0) * (i / (n - 1));
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * TAU;
        pos.push(p[0] + (nn.x * Math.cos(a) + bb.x * Math.sin(a)) * rr, p[1] + (nn.y * Math.cos(a) + bb.y * Math.sin(a)) * rr, p[2] + (nn.z * Math.cos(a) + bb.z * Math.sin(a)) * rr);
        uv.push(i / (n - 1), j / sides); part.push(3);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
      const a = base + i * (sides + 1) + j, b = a + 1, c = a + sides + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  };
  for (const side of [1, -1]) {
    tube([[-0.012, -0.012, side * 0.012], [-0.006, -0.026, side * 0.022], [-0.004, -0.038, side * 0.03]], 0.0022, 0.0008);
    tube([[-0.03, -0.018, side * 0.02], [-0.026, -0.032, side * 0.034], [-0.026, -0.044, side * 0.041]], 0.0026, 0.001);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildKoi(ctx, site, U, plan) {
  const r = ctx.rng('pond-koi');
  const waterY = site.waterY;
  const geo = koiGeometry();
  // swim loops in open-ish water; several shoals so the crane / top views see colour
  const fish = [];
  const groups = [
    { x: 7.0, z: 17.5, n: 4 },   // under / beside the bridge
    { x: 24.0, z: 24.5, n: 4 },  // mirror-shot foreground
    { x: -8.0, z: 15.0, n: 4 },  // west open water
    { x: 30.0, z: 17.0, n: 4 },  // east
    { x: -16.0, z: 25.0, n: 3 }, // south-west bay
    { x: 2.0, z: 26.0, n: 3 },   // south of the island
  ];
  // colour types: 0 kohaku, 1 taisho sanke, 2 showa, 3 yamabuki ogon, 4 chagoi, 5 orange ogon, 6 asagi, 7 platinum ogon, 8 tancho
  const types = [0, 1, 0, 2, 3, 0, 5, 1, 4, 6, 0, 8, 7, 2, 5, 0, 1, 3, 6, 0, 2, 8];
  let fi = 0;
  for (const gr of groups) {
    for (let k = 0; k < gr.n; k++, fi++) {
      const cx = gr.x + r.range(-1.5, 1.5), cz = gr.z + r.range(-1.5, 1.5);
      let ax = r.range(2.0, 4.5), az = r.range(1.4, 3.0);
      for (let it = 0; it < 12; it++) {
        let ok = true;
        for (let a = 0; a < TAU; a += 0.3) if (site.sd(cx + Math.cos(a) * ax, cz + Math.sin(a) * az) < 1.0) { ok = false; break; }
        if (ok) break;
        ax *= 0.82; az *= 0.82;
      }
      const len = r.range(0.42, 0.72);
      const speed = r.range(0.12, 0.24);
      const perim = Math.PI * (3 * (ax + az) - Math.sqrt((3 * ax + az) * (ax + 3 * az)));
      fish.push({
        cx, cz, ax, az, rot: r.range(0, TAU), dir: r.chance(0.5) ? 1 : -1,
        w: (speed / perim) * TAU, th0: r.range(0, TAU),
        depth: r.range(0.08, 0.3), dph: r.range(0, TAU), len, speed,
        wob: r.range(0.2, 0.5), wph: r.range(0, TAU), type: types[fi % types.length], seed: r.float(),
      });
    }
  }
  // hero koi of the water-level shot: glides across the frame beyond the hero
  // pad, just under the surface, during the first seconds of that shot
  const padPath = (site.camPaths || []).find((p) => p.kind === 'pad');
  if (padPath && padPath.hero) {
    const H = padPath.hero;
    const ux = H.dir[0], uz = H.dir[2], nl = Math.hypot(ux, uz) || 1;
    const fx = ux / nl, fz = uz / nl;
    const T0 = (padPath.shot ?? 8) * 7.0;
    // crossing point 2 m beyond the pad, moving right -> left across the opening
    // view; it has left the lens path before the camera skims over that water
    const cx = H.at[0] + fx * 2.0, cz = H.at[2] + fz * 2.0;
    fish.push({ hero: true, cx, cz, vx: fz, vz: -fx, T0: T0 + 1.2, speed: 0.26, depth: 0.08, len: 0.62, type: 0, seed: 0.37, dph: 0, wob: 0.3, wph: 0 });
  }
  const N = fish.length;
  const inst = new Float32Array(N * 4);
  fish.forEach((f, i) => { inst[i * 4] = f.seed; inst[i * 4 + 1] = f.type; inst[i * 4 + 2] = f.speed / f.len; inst[i * 4 + 3] = 0; });
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));

  const hooks = {
    uniforms: { ...U },
    vertexHead: /* glsl */ `
      attribute vec4 aInst;
      attribute float aPart;
      varying vec4 vInst;
      varying vec3 vLocal;
      varying vec2 vKUv;
      varying float vPart;
    `,
    vertexWorld: /* glsl */ `
      vInst = aInst; vLocal = position; vKUv = uv; vPart = aPart;
      {
        float s = clamp(-position.x, 0.0, 1.4);
        float beat = 1.6 + aInst.z * 3.0;
        float ph = aInst.x * 6.2831;
        float amp = (0.008 + 0.06 * s * s);
        float lat = amp * sin(s * 4.6 - uTime * beat + ph);
        // pectoral fins paddle slowly; the caudal fin trails the body wave
        float pect = (aPart > 0.5 && aPart < 1.5 && position.x > -0.42 && position.x < -0.1) ? sin(uTime * 1.4 + ph) * 0.025 * (abs(position.z) - 0.05) * 10.0 : 0.0;
        vec3 off = vec3(0.0, pect, lat);
        #ifdef USE_INSTANCING
          wPos4.xyz += mat3(modelMatrix * instanceMatrix) * off;
        #else
          wPos4.xyz += mat3(modelMatrix) * off;
        #endif
      }
    `,
    fragHead: /* glsl */ `
      varying vec4 vInst;
      varying vec3 vLocal;
      varying vec2 vKUv;
      varying float vPart;
      float g_h; float g_metal; float g_fin; float g_rough;
      ${POND_GLSL}
    `,
    fragColor: /* glsl */ `
      {
        float type = floor(vInst.y + 0.5);
        float seed = vInst.x * 37.0;
        vec3 lp = vLocal;
        float s = -lp.x;
        float part = floor(vPart + 0.5);
        vec2 pp = vec2(lp.x * 7.0, lp.z * 9.0 + lp.y * 3.0);
        float n1 = n_fbm(pp + seed, 3);
        float n2 = n_fbm(pp * 1.7 + seed * 2.1 + 5.0, 3);
        float n3 = n_snoise(pp * 3.2 + seed * 3.3);
        vec3 white = vec3(0.82, 0.81, 0.77);
        vec3 red = vec3(0.80, 0.10, 0.022);
        vec3 orange = vec3(0.95, 0.33, 0.04);
        vec3 black = vec3(0.012, 0.012, 0.014);
        float topF = smoothstep(-0.02, 0.03, lp.y);
        // pattern patches have soft, slightly ragged edges (scale-sized steps)
        float hi = smoothstep(0.02, 0.1, n1 + 0.1 * topF + 0.04 * n3);
        float sumi = smoothstep(0.35, 0.48, n3) * topF;
        vec3 col;
        g_metal = 0.0; g_rough = 0.32;
        if (type < 0.5) { col = mix(white, red, hi * topF); }
        else if (type < 1.5) { col = mix(white, red, hi * topF); col = mix(col, black, sumi * 0.95); }
        else if (type < 2.5) { col = mix(black, red, smoothstep(0.05, 0.2, n1) * topF); col = mix(col, white, smoothstep(0.15, 0.3, n2) * (1.0 - topF * 0.5)); }
        else if (type < 3.5) { col = vec3(0.95, 0.66, 0.18); g_metal = 0.8; g_rough = 0.26; }
        else if (type < 4.5) { col = vec3(0.30, 0.17, 0.07) * (0.9 + 0.2 * n2); }
        else if (type < 5.5) { col = orange * (0.92 + 0.12 * n2); g_metal = 0.5; }
        else if (type < 6.5) { col = mix(vec3(0.20, 0.27, 0.33), orange, 1.0 - smoothstep(-0.05, 0.02, lp.y)); }
        else if (type < 7.5) { col = vec3(0.86, 0.87, 0.86); g_metal = 0.85; g_rough = 0.24; }
        else { col = white; float hd = length(vec2(s - 0.06, lp.y - 0.03) * vec2(1.0, 1.3)); col = mix(col, red, (1.0 - smoothstep(0.03, 0.04, hd)) * topF); }
        // head is usually clean (white/orange) for kohaku-likes
        if (type < 1.5) col = mix(col, mix(white, red, smoothstep(0.0, 0.1, n2)), smoothstep(0.16, 0.05, s) * topF);
        // gill cover (operculum) line and the darker lateral line
        float fwS = max(fwidth(s), 1e-4);
        float gill = 1.0 - smoothstep(0.0, 0.004 + fwS, abs(s - 0.17 - 0.02 * abs(lp.y) * 10.0));
        float latLine = (1.0 - smoothstep(0.0, 0.0035 + fwidth(lp.y), abs(lp.y - 0.005))) * smoothstep(0.2, 0.3, s) * (1.0 - smoothstep(0.85, 0.95, s));
        // scales: staggered rows, darker reticulated margins, lighter centres; fade when sub-pixel
        float ang = vKUv.y * 6.2831;
        vec2 sc = vec2(s * 44.0, ang * 4.6);
        sc.y += floor(sc.x) * 0.5;
        vec2 f = fract(sc) - 0.5;
        float fwSc = max(length(fwidth(sc)), 1e-4);
        float scAA = 1.0 - smoothstep(0.25, 0.6, fwSc);
        float rr = length((f + vec2(0.18, 0.0)) * vec2(1.0, 1.15));
        float edge = smoothstep(0.34, 0.5, rr) * scAA;
        float body = step(part, 0.5) * smoothstep(0.17, 0.22, s) * (1.0 - smoothstep(0.88, 0.96, s));
        float ret = (type > 3.5 && type < 4.5) || (type > 5.5 && type < 6.5) ? 0.4 : 0.14;
        col *= 1.0 - edge * body * ret;
        col *= 1.0 + (1.0 - rr) * body * scAA * 0.08;
        col *= 1.0 - gill * step(part, 0.5) * 0.18;
        col *= 1.0 - latLine * step(part, 0.5) * 0.08;
        g_h = (edge * body * 0.0004 + gill * 0.0005) * scAA;
        // fins: translucent, paler, with rays (geometry pleats + fine ray lines)
        g_fin = step(0.5, part) * step(part, 1.5);
        if (part > 0.5 && part < 1.5) {
          float rays = f_rays(vKUv.y * 22.0);
          col = mix(col, white * 0.92, 0.4) * (0.86 + 0.14 * rays);
          if (type > 4.5 && type < 5.5) col = orange * 0.9;
          if (type > 1.5 && type < 2.5) col = mix(black, white, 0.45);
          if (type > 2.5 && type < 3.5) col = vec3(0.9, 0.62, 0.2);
          if (type > 6.5 && type < 7.5) col = vec3(0.85);
          col = mix(col, col * 0.75, smoothstep(0.7, 1.0, vKUv.x) * 0.3);
          g_rough = 0.45;
        } else if (part > 1.5 && part < 2.5) {
          // eye: dark pupil, gold iris ring, glossy
          vec2 ep = vKUv - vec2(0.25, 0.5);
          col = mix(vec3(0.005), vec3(0.6, 0.45, 0.12), smoothstep(0.07, 0.12, length(ep * vec2(1.0, 2.0))));
          g_rough = 0.08;
        } else if (part > 2.5) {
          col = mix(white, vec3(0.85, 0.55, 0.4), 0.3);
          g_rough = 0.5;
        }
        diffuseColor.rgb = col;
      }
    `,
    fragRough: `roughnessFactor = g_rough;`,
    fragMetal: `metalnessFactor = g_metal * (1.0 - g_fin);`,
    fragNormal: `normal = n_bumpView(-vViewPosition, normal, g_h, 1.0);`,
    fragLight: /* glsl */ `
      #if NUM_DIR_LIGHTS > 0
        reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * g_fin * max(dot(-normal, directLight.direction), 0.0) * 0.45;
      #endif
      reflectedLight.indirectDiffuse += iblIrradiance * diffuseColor.rgb * g_fin * 0.12;
    `,
    fragEnd: UW_FRAGEND,
  };
  hooks.fragHead += /* glsl */ `
    float f_rays(float x){
      float fw = max(fwidth(x), 1e-4);
      float d = abs(fract(x + 0.5) - 0.5);
      return mix(1.0 - smoothstep(0.12 - fw, 0.12 + fw, d), 0.24, smoothstep(0.2, 0.45, fw));
    }
  `;
  const mat = ctx.mat.phys({ color: 0xffffff, roughness: 0.35, metalness: 0, side: THREE.DoubleSide, clearcoat: 0.55, clearcoatRoughness: 0.22 }, hooks);
  const im = new THREE.InstancedMesh(geo, mat, fish.length);
  im.name = 'koi';
  im.castShadow = false; im.receiveShadow = true;
  im.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  function pose(f, T) {
    if (f.hero) {
      // slow straight glide with a gentle S, ease in / out of the crossing
      const t = T - f.T0;
      const d = f.speed * t;
      const sx = Math.sin(t * 0.5) * 0.12;
      return [f.cx + f.vx * d - f.vz * sx, f.cz + f.vz * d + f.vx * sx];
    }
    const th = f.th0 + f.dir * f.w * T;
    const c = Math.cos(f.rot), sn = Math.sin(f.rot);
    const ex = Math.cos(th) * f.ax, ez = Math.sin(th) * f.az;
    const wob = Math.sin(T * f.wob + f.wph) * 0.35;
    const x = f.cx + ex * c - ez * sn + Math.sin(th * 3 + f.wph) * wob * 0.3;
    const z = f.cz + ex * sn + ez * c + Math.cos(th * 2 + f.wph) * wob * 0.3;
    return [x, z];
  }
  const fwd = new THREE.Vector3();
  function update(T) {
    fish.forEach((f, i) => {
      const [x, z] = pose(f, T);
      const [x2, z2] = pose(f, T + 0.25);
      const yaw = Math.atan2(-(z2 - z), x2 - x);
      const y = waterY - f.depth - Math.sin(T * 0.13 + f.dph) * (f.hero ? 0.01 : 0.06);
      q.setFromAxisAngle(up, yaw);
      p.set(x, y, z);
      sc.set(f.len, f.len, f.len);
      fwd.set(1, 0, 0).applyQuaternion(q).multiplyScalar(f.len * 0.45);
      p.add(fwd);
      m.compose(p, q, sc);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { mesh: im, update: (T) => update(T) };
}

// ---------------------------------------------------------------------------
// Floating maple leaves and cherry petals
// ---------------------------------------------------------------------------
function mapleLeafGeometry() {
  // Acer palmatum: 7 deeply cut, finely serrated lobes; a short petiole; the
  // margin curls up a little as it dries (floating leaves keep a dry cup)
  const pts = [];
  const lobes = 7;
  const N = lobes * 24;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const a = -Math.PI / 2 + (t - 0.5) * 1.82 * Math.PI;
    const lobeT = (t * lobes) % 1;
    const li = Math.floor(t * lobes);
    const lobeLen = [0.5, 0.78, 0.95, 1.0, 0.95, 0.78, 0.5][li];
    const tipness = Math.pow(1 - Math.abs(lobeT - 0.5) * 2, 1.25);
    const serr = (i % 3 === 0 ? 0.045 : 0.0) * (0.3 + tipness);
    const rr = (0.22 + (lobeLen - 0.22) * tipness) - serr;
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  const shape = new THREE.Shape(pts);
  const g = new THREE.ShapeGeometry(shape, 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const rr = Math.hypot(x, z);
    p.setY(i, rr * rr * 0.1 + Math.pow(Math.max(0, rr - 0.55), 2) * 0.35);
    uv[i * 2] = rr; uv[i * 2 + 1] = Math.atan2(z, x) / TAU + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function petalGeometry() {
  const pts = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let rr = 1;
    const notch = Math.max(0, Math.cos(a)) ** 30 * 0.35;
    rr -= notch;
    pts.push(new THREE.Vector2(Math.cos(a) * rr * 0.6, Math.sin(a) * rr * 0.45));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, (x * x + z * z) * 0.25); }
  g.computeVertexNormals();
  return g;
}

export function buildDebris(ctx, site, U) {
  const r = ctx.rng('pond-debris');
  const waterY = site.waterY;
  const group = new THREE.Group();
  group.name = 'pondDebris';
  const L = site.L;
  // anchor spots: near red maples / shore corners
  const spots = [];
  for (const t of L.trees || []) {
    if (t.type !== 'mapleRed' && t.type !== 'maple' && t.type !== 'cherry') continue;
    const d = -site.sd(t.at[0], t.at[1]);
    if (d > 12) continue;
    spots.push({ x: t.at[0], z: t.at[1], kind: t.type === 'cherry' ? 'petal' : 'leaf', n: t.type === 'cherry' ? 90 : 55 });
  }
  spots.push({ x: 41, z: 29, kind: 'leaf', n: 30 }, { x: -24, z: 24, kind: 'leaf', n: 25 }, { x: 18, z: 31.5, kind: 'leaf', n: 20 }, { x: 6, z: 9, kind: 'petal', n: 60 }, { x: 20, z: 10, kind: 'leaf', n: 20 });
  const leaves = [], petals = [];
  for (const s of spots) {
    for (let k = 0; k < s.n; k++) {
      let x, z, ok = false;
      for (let t = 0; t < 12; t++) {
        const a = r.range(0, TAU), d = Math.abs(r.gauss(0, s.kind === 'petal' ? 2.5 : 3.5));
        x = s.x + Math.cos(a) * d; z = s.z + Math.sin(a) * d;
        const sd = site.sd(x, z);
        if (sd > 0.25 && sd < 6) { ok = true; break; }
      }
      if (!ok) continue;
      if (s.kind === 'petal') {
        // petals gather in rafts
        const n2 = r.int(1, 4);
        for (let j = 0; j < n2; j++) petals.push({ x: x + r.range(-0.08, 0.08), z: z + r.range(-0.08, 0.08), s: r.range(0.012, 0.016), yaw: r.range(0, TAU) });
      } else leaves.push({ x, z, s: r.range(0.045, 0.075), yaw: r.range(0, TAU) });
    }
  }
  const mk = (geo, list, color, name) => {
    if (!list.length) return;
    const inst = new Float32Array(list.length * 4);
    const im = new THREE.InstancedMesh(geo, null, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach((o, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw);
      p.set(o.x, waterY + 0.0035 + r.range(0, 0.002), o.z);
      sc.set(o.s, o.s, o.s);
      im.setMatrixAt(i, m.compose(p, q, sc));
      inst[i * 4] = r.float(); inst[i * 4 + 1] = r.float(); inst[i * 4 + 2] = r.float(); inst[i * 4 + 3] = 0;
    });
    geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    im.material = ctx.mat.phys({ color: 0xffffff, roughness: 0.45, metalness: 0, side: THREE.DoubleSide, sheen: 0.3, sheenColor: new THREE.Color(0.3, 0.25, 0.2) }, {
      uniforms: { ...U },
      vertexHead: 'attribute vec4 aInst; varying vec4 vInst; varying vec2 vUv2;',
      vertexWorld: /* glsl */ `
        vInst = aInst; vUv2 = uv;
        wPos4.xz += vec2(sin(uTime * 0.05 + aInst.x * 30.0), cos(uTime * 0.043 + aInst.y * 20.0)) * 0.06 + uWindDir * uTime * 0.0006;
      `,
      fragHead: 'varying vec4 vInst; varying vec2 vUv2; float g_t;\n' + POND_GLSL,
      fragColor: color,
      fragLight: /* glsl */ `
        #if NUM_DIR_LIGHTS > 0
          reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * max(dot(-normal, directLight.direction), 0.0) * 0.5;
        #endif
      `,
      fragEnd: UW_FRAGEND,
    });
    im.castShadow = false; im.receiveShadow = true;
    im.name = name;
    im.computeBoundingSphere();
    group.add(im);
  };
  mk(mapleLeafGeometry(), leaves, /* glsl */ `
    {
      float k = vInst.x;
      vec3 c = k < 0.45 ? vec3(0.62, 0.06, 0.02) : (k < 0.75 ? vec3(0.80, 0.22, 0.03) : (k < 0.9 ? vec3(0.75, 0.48, 0.06) : vec3(0.28, 0.08, 0.03)));
      // palmate veins: from the petiole to each lobe tip (7 lobes over the fan)
      vec2 lu = vec2(vUv2.x, vUv2.y);
      float fan = (lu.y - 0.5) / 0.91 + 0.5;
      float lv = abs(fract(fan * 7.0) - 0.5);
      float fwv = max(fwidth(fan * 7.0), 1e-4);
      float vein = (1.0 - smoothstep(0.03, 0.03 + fwv * 1.5, lv)) * smoothstep(0.05, 0.15, lu.x) * (1.0 - smoothstep(0.25, 0.5, fwv));
      c = mix(c, c * vec3(1.25, 1.1, 0.7) + 0.02, vein * 0.5);
      // colour drifts from the centre to the lobe tips, brown spots, darker wet rim
      c = mix(c, c * vec3(1.15, 1.25, 0.6), smoothstep(0.2, 0.9, lu.x) * vInst.y * 0.5);
      float spot = smoothstep(0.62, 0.72, n_snoise(vWPos.xz * 140.0 + k * 31.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.002, 0.006, length(fwidth(vWPos.xz))));
      c = mix(c, vec3(0.16, 0.06, 0.02), spot * 0.6);
      c *= 0.85 + 0.3 * n_snoise(vWPos.xz * 60.0 + k * 10.0) * 0.5;
      diffuseColor.rgb = c;
    }
  `, 'mapleLeaves');
  mk(petalGeometry(), petals, /* glsl */ `
    diffuseColor.rgb = mix(vec3(0.92, 0.70, 0.74), vec3(0.95, 0.88, 0.86), vInst.x);
  `, 'cherryPetals');
  return { object: group };
}
