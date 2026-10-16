// ---------------------------------------------------------------------------
// Drip-line gutters (amaochi-mizo): two lines of granite curb stones with a bed
// of dark river cobbles between them, round the hall and pagoda podiums and
// along both faces of the corridor plinth. Curbs are real stones (merged into
// the paving mesh); the cobble bed is a strip mesh with a procedural, filtered
// cobble shader (relief, gaps, wet sheen, moss and litter caught in it).
// ---------------------------------------------------------------------------
import { TG_GLSL } from './terrain-glsl.js';
import { slabGeometry } from './terrain-stonegeo.js';

// side descriptors of every ring: bands (inner curb / bed / outer curb) and the free intervals
export function gutterSides(F) {
  const { CW, GW } = F.GUT;
  const sides = [];
  for (const g of F.gutterRings) {
    const { cx, cz, X, Z, dir } = g;
    const nsBands = dir > 0
      ? { in: [-X - CW, X + CW], bed: [-X - GW + CW, X + GW - CW], out: [-X - GW, X + GW] }
      : { in: [-X, X], bed: [-X + CW, X - CW], out: [-X + GW - CW, X - GW + CW] };
    const ewBands = dir > 0
      ? { in: [-Z, Z], bed: [-Z - CW, Z + CW], out: [-Z - GW + CW, Z + GW - CW] }
      : { in: [-Z + CW, Z - CW], bed: [-Z + GW - CW, Z - GW + CW], out: [-Z + GW, Z - GW] };
    const defs = [
      { axis: 'x', c: cx, face: cz - Z, sgn: -dir, b: nsBands },
      { axis: 'x', c: cx, face: cz + Z, sgn: dir, b: nsBands },
      { axis: 'z', c: cz, face: cx - X, sgn: -dir, b: ewBands },
      { axis: 'z', c: cz, face: cx + X, sgn: dir, b: ewBands },
    ];
    for (const d of defs) {
      const at = (u, o) => (d.axis === 'x' ? [d.c + u, d.face + d.sgn * o] : [d.face + d.sgn * o, d.c + u]);
      // free intervals along u (sampled across the whole cross section)
      const u0 = Math.min(d.b.in[0], d.b.out[0]), u1 = Math.max(d.b.in[1], d.b.out[1]);
      const free = [];
      let start = null;
      const STEP = 0.05;
      for (let u = u0; u <= u1 + 1e-6; u += STEP) {
        let blocked = false;
        for (const o of [0.04, GW * 0.35, GW * 0.65, GW - 0.04]) { const [x, z] = at(u, o); if (F.gutterBlocked(x, z)) { blocked = true; break; } }
        if (!blocked && start === null) start = u;
        if ((blocked || u + STEP > u1 + 1e-6) && start !== null) {
          const end = blocked ? u - STEP : u1;
          if (end - start > 0.6) free.push([start, end]);
          start = null;
        }
      }
      sides.push({ ...d, ring: g.name, at, free, CW, GW });
    }
  }
  return sides;
}

// curb stones -> emitted through the paving's place() (kind 1 = kerb)
export function gutterCurbs(F, R, rnd, noise, place, stones) {
  const sides = gutterSides(F);
  let n = 0;
  const TOP = 0.1;
  for (const s of sides) {
    const yaw = s.axis === 'x' ? Math.PI / 2 : 0;
    for (const [band, o0, o1] of [['in', 0, s.CW], ['out', s.GW - s.CW, s.GW]]) {
      const [b0, b1] = s.b[band];
      for (const [f0, f1] of s.free) {
        const a = Math.max(b0, f0), b = Math.min(b1, f1);
        if (b - a < 0.25) continue;
        let u = a;
        while (u < b - 0.05) {
          let len = R.range(0.85, 1.55);
          if (b - (u + len) < 0.4) len = b - u;
          const joint = R.range(0.008, 0.016);
          const ua = u + joint / 2, ub = u + len - joint / 2;
          const [x, z] = s.at((ua + ub) / 2, (o0 + o1) / 2);
          const w = o1 - o0 - 0.012;
          const g = slabGeometry(w, ub - ua, 0.26, 0.022, rnd, 1.3, noise);
          const y = F.heightAt(x, z) + TOP + R.range(-0.007, 0.004);
          const M = place(g, x, z, yaw + R.range(-0.004, 0.004), y, 4, 0.006, 0.05);
          stones.push({ x, z, w, d: ub - ua, yaw, kind: 1, gutter: true, m: M, side: 0 });
          n++;
          u += len;
        }
        // end caps across the bed where the gutter stops short of an obstacle
        if (band === 'in') {
          const [c0, c1] = s.b.bed;
          for (const [ue, sg] of [[f0, 1], [f1, -1]]) {
            if (ue <= c0 + 0.01 || ue >= c1 - 0.01) continue;
            const uc = ue + sg * s.CW / 2;
            const [x, z] = s.at(uc, s.GW / 2);
            const g = slabGeometry(s.GW - 2 * s.CW - 0.012, s.CW - 0.01, 0.26, 0.02, rnd, 1.3, noise);
            const M = place(g, x, z, yaw + Math.PI / 2, F.heightAt(x, z) + TOP + R.range(-0.006, 0.003), 4, 0.006, 0.05);
            stones.push({ x, z, w: s.GW - 2 * s.CW, d: s.CW, yaw, kind: 1, gutter: true, m: M, side: 0 });
            n++;
          }
        }
      }
    }
  }
  return n;
}

// cobble bed strips
export function buildGutterBed(ctx, F) {
  const { THREE } = ctx;
  const sides = gutterSides(F);
  const P = [], A = [], I = [];
  for (const s of sides) {
    const [b0, b1] = s.b.bed;
    for (const [f0, f1] of s.free) {
      // shorten by the end caps where the gutter stops early
      const a = Math.max(b0, f0 > b0 + 0.01 ? f0 + s.CW : f0), b = Math.min(b1, f1 < b1 - 0.01 ? f1 - s.CW : f1);
      if (b - a < 0.1) continue;
      const nSeg = Math.max(1, Math.ceil((b - a) / 1.5));
      const base = P.length / 3;
      for (let k = 0; k <= nSeg; k++) {
        const u = a + (b - a) * (k / nSeg);
        for (const [o, t] of [[s.CW - 0.01, 0], [s.GW - s.CW + 0.01, 1]]) {
          const [x, z] = s.at(u, o);
          P.push(x, F.heightAt(x, z) + 0.032, z);
          // across 0 (face side) .. 1 (outer side); distance to the strip ends (end-cap shade)
          A.push(t, Math.min(u - a, b - u), s.ring === 'corOut' ? 1 : 0, 0);
        }
      }
      for (let k = 0; k < nSeg; k++) {
        const v = base + k * 2;
        // winding: keep the normal up for both axis orientations
        const p0 = [P[v * 3], P[v * 3 + 2]], p1 = [P[(v + 1) * 3], P[(v + 1) * 3 + 2]], p2 = [P[(v + 2) * 3], P[(v + 2) * 3 + 2]];
        const cr = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
        if (cr < 0) I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); else I.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const N = new Float32Array(P.length); for (let i = 1; i < N.length; i += 3) N[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('aBed', new THREE.Float32BufferAttribute(A, 4));
  geo.setIndex(I);
  geo.computeBoundingSphere(); geo.computeBoundingBox();

  const NT = 20;
  const KIND = { pine: 0, maple: 1, mapleRed: 2, cherry: 3 };
  const trees = [];
  for (let i = 0; i < NT; i++) {
    const t = F.trees[i];
    trees.push(t ? new THREE.Vector4(t.x, t.z, 1.4 + t.h * 0.42, KIND[t.type] ?? 1) : new THREE.Vector4(1e4, 1e4, 0, 0));
  }
  const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.6, metalness: 0 }, bedHooks(trees, NT));
  mat.name = 'gutterBed';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'gutterBed';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function bedHooks(trees, NT) {
  return {
    uniforms: { uGTree: { value: trees } },
    defines: { NGTREE: NT },
    vertexHead: /* glsl */ `attribute vec4 aBed; varying vec4 vBed;`,
    vertexWorld: /* glsl */ `vBed = aBed;`,
    fragHead: /* glsl */ `
      varying vec4 vBed;
      uniform vec4 uGTree[NGTREE];
      float gb_h; float gb_rough; float gb_ao;
      ${TG_GLSL}
    `,
    fragColor: /* glsl */ `
    {
      vec2 p = vWPos.xz;
      vec2 fwp = fwidth(p);
      float fw = max(max(fwp.x, fwp.y), 1e-5);
      // river cobbles ~7 cm (Voronoi cells: rounded polygons), a second, sparser size class
      float sc = 14.5;
      vec2 cid; float f2;
      vec3 w = tg_worley(p * sc, cid, f2);
      float edge = (f2 - w.x);
      vec3 rnd = n_hash33(vec3(cid, 7.7));
      float fade = 1.0 - smoothstep(0.006, 0.03, fw);          // individual cobbles resolved
      float fade2 = 1.0 - smoothstep(0.002, 0.01, fw);          // micro detail resolved
      float body = smoothstep(0.02, 0.16, edge);
      // rounded cobble: height from the relative distance to the cell border
      float rr = 2.0 * w.x / max(w.x + f2, 1e-4);
      float dome = sqrt(max(1.0 - rr * rr, 0.0)) * (0.6 + 0.4 * rnd.y);
      // nachi-guro black stones mixed with dark grey and a few warm brown ones
      vec3 sc0 = vec3(0.050, 0.048, 0.046);
      vec3 sc1 = vec3(0.20, 0.195, 0.185);
      vec3 sc2 = vec3(0.21, 0.16, 0.11);
      vec3 cc = mix(sc0, sc1, smoothstep(0.25, 0.9, rnd.x));
      cc = mix(cc, sc2, step(0.9, rnd.z) * 0.8);
      cc *= 0.85 + 0.3 * rnd.y;
      // pale mineral rings / veins on some stones, fine grain
      float vein = smoothstep(0.82, 0.9, abs(sin(dot(p, normalize(rnd.yz - 0.5 + 1e-3)) * 90.0 + rnd.x * 20.0))) * step(0.75, rnd.y);
      cc = mix(cc, cc * 2.4, vein * 0.35 * fade2);
      cc *= 1.0 + 0.12 * n_snoise(p * 260.0) * fade2;
      // gaps: dark grit, decayed leaves
      vec3 gap = vec3(0.028, 0.024, 0.019);
      cc *= 0.72 + 0.4 * dome;
      vec3 near = mix(gap, cc, body);
      // far: average tone
      vec3 avg = mix(gap, mix(sc0, sc1, 0.35) * 1.05, 0.7);
      vec3 col = mix(avg, near, fade);
      // moss in the joints and silt on the shady (face) side, organic stain toward the curbs
      float across = vBed.x;
      float side = smoothstep(0.32, 0.0, across) + smoothstep(0.68, 1.0, across) * 0.6;
      float mn = n_fbm(p * 1.7 + 4.0, 3);
      float moss = smoothstep(0.1, 0.55, mn + 0.35 * side) * (1.0 - body * 0.85);
      vec3 mossC = mix(vec3(0.03, 0.06, 0.014), vec3(0.08, 0.12, 0.025), n_snoise(p * 11.0) * 0.5 + 0.5);
      col = mix(col, mossC, moss * mix(0.5, 1.0, fade) * 0.8);
      // fallen leaves and petals caught in the gutter under the hero trees
      float acc = 0.0; vec3 lcol = vec3(0.0);
      for (int i = 0; i < NGTREE; i++) {
        vec4 t = uGTree[i];
        float r = length(p - t.xy - vec2(0.85, -0.3) * t.z * 0.22);
        if (r > t.z * 1.8) continue;
        float dens = smoothstep(t.z * 1.75, t.z * 0.3, r);
        vec3 c = t.w < 0.5 ? vec3(0.16, 0.09, 0.045) : t.w < 1.5 ? vec3(0.30, 0.25, 0.07) : t.w < 2.5 ? vec3(0.42, 0.055, 0.022) : vec3(0.80, 0.58, 0.62);
        acc += dens; lcol += c * dens;
      }
      float lt = 0.0;
      if (acc > 0.003) {
        lcol /= acc;
        vec2 lid; float lf2;
        vec3 lw = tg_worley(p * 22.0 + 3.1, lid, lf2);
        vec3 lh = n_hash33(vec3(lid, 2.3));
        float sh = smoothstep(0.3, 0.2, lw.x) * step(lh.x, min(acc, 1.0) * 0.4);
        lt = mix(min(acc, 1.0) * 0.06, sh, fade);
        lcol *= mix(1.0, 0.7 + 0.6 * lh.z, fade);
        col = mix(col, lcol, lt);
      }
      // curb shade: the stones on either side shade the bed under the low sun
      float ao = mix(0.55, 1.0, smoothstep(0.0, 0.2, across)) * mix(0.62, 1.0, smoothstep(1.0, 0.8, across));
      ao *= mix(0.6, 1.0, smoothstep(0.0, 0.18, vBed.y));
      gb_ao = ao;
      diffuseColor.rgb = col;
      // relief (filtered): domes of the cobbles, gaps sunk
      gb_h = (dome * 0.03 + n_snoise(p * 90.0) * 0.0006 * fade2) * fade * (1.0 - lt * 0.7);
      // polished, damp stones: glossy tops, rough gaps and moss
      gb_rough = mix(0.82, mix(0.42, 0.28, rnd.z), body * fade);
      gb_rough = mix(gb_rough, 0.6, 1.0 - fade);
      gb_rough = mix(gb_rough, 0.95, max(moss * 0.8, lt));
    }
    `,
    fragRough: /* glsl */ `roughnessFactor = gb_rough;`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, gb_h, 1.0);`,
    fragLight: /* glsl */ `
      reflectedLight.directDiffuse *= mix(1.0, gb_ao, 0.35);
      reflectedLight.directSpecular *= mix(1.0, gb_ao, 0.35);
      reflectedLight.indirectDiffuse *= gb_ao;
      reflectedLight.indirectSpecular *= mix(0.5, 1.0, gb_ao);
    `,
  };
}
