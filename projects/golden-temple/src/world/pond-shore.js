// ---------------------------------------------------------------------------
// Pond margin detail: pebbles and gravel in the shallows along the waterline,
// clumps of rush / iris foliage standing in the shallow water (swaying blades
// with translucent, sun-catching tips).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { POND_GLSL, UW_FRAGEND } from './pond-water.js';
import { makeNoise, clamp, smooth, contourLines, resample } from './pond-util.js';
import { rockGeometry, stoneMaterial } from './pond-stone.js';

const TAU = Math.PI * 2;
const DEPTH_FIX = `
vec3 objectNormal = vec3(0.0, 1.0, 0.0);
`;

// a single blade: strip along +Y with a forward arch, keeled cross-section (3 verts across)
function bladeGeometry(r, { seg = 9, arch = 0.35, twist = 0.6, w0 = 0.016 } = {}) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const y = t;
    const z = arch * t * t;               // arches forward
    const w = w0 * (1 - Math.pow(t, 2.2) * 0.92) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(t * 3, 1)));
    const tw = twist * t * t;
    for (let j = 0; j <= 2; j++) {
      const v = j / 2 * 2 - 1;
      const x = v * w;
      const keel = (1 - Math.abs(v)) * w * 0.35;   // midrib ridge
      pos.push(x * Math.cos(tw) - keel * Math.sin(tw), y, z + x * Math.sin(tw) + keel * Math.cos(tw));
      uv.push(j / 2, t);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j, b = a + 1, c = a + 3, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildShore(ctx, site, U, plan) {
  const r = ctx.rng('pond-shore');
  const noise = makeNoise(() => r.float());
  const group = new THREE.Group();
  group.name = 'pondShore';
  const waterY = site.waterY;
  const paths = site.camPaths || [];
  const L = site.L;
  const bridgeX = L.bridge ? L.bridge.north[0] : 10;
  const nearLens = (x, z, rad) => {
    for (const p of paths) for (const pt of p.pts) if (Math.hypot(pt.pos[0] - x, pt.pos[2] - z) < rad + 0.6) return true;
    return false;
  };
  // waterlines (depth 0 contours of the basin)
  const { nx, nz, RES } = site;
  const depthGrid = new Float32Array(nx * nz);
  for (let k = 0; k < nx * nz; k++) depthGrid[k] = waterY - site.floorGrid[k];
  const lines = contourLines(depthGrid, nx, nz, site.gx0, site.gz0, RES, 0.0).filter((l) => l.length > 6).map((l) => resample(l, 0.2));
  const grad = (x, z) => {
    const e = 0.25;
    const gx = site.sd(x + e, z) - site.sd(x - e, z), gz = site.sd(x, z + e) - site.sd(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    return [gx / l, gz / l];
  };
  const wall = (x, z) => site.wallZone && site.wallZone(x, z);

  // ---- pebbles: drifts of small rounded stones in and just above the shallows ---
  {
    const protos = [];
    for (let k = 0; k < 4; k++) protos.push(rockGeometry(noise, r, { detail: 3, flat: r.range(0.45, 0.7), cuts: r.int(4, 6), lumpy: 0.7, elong: r.range(1.0, 1.5), round: r.range(0.55, 0.8) }));
    const lists = protos.map(() => []);
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const [x0, z0] = line[i];
        if (wall(x0, z0)) continue;
        // drift density: patchy along the shore
        const dn = noise.fbm2(x0 * 0.35, z0 * 0.35, 2) * 0.5 + 0.5;
        const n = Math.round(dn * dn * 5);
        const [gx, gz] = grad(x0, z0);
        for (let k = 0; k < n; k++) {
          const off = r.range(-0.25, 0.75);
          const x = x0 + gx * off + r.range(-0.12, 0.12), z = z0 + gz * off + r.range(-0.12, 0.12);
          if (wall(x, z)) continue;
          const s = r.range(0.025, 0.09) * (r.chance(0.12) ? 1.7 : 1);
          if (nearLens(x, z, s)) continue;
          const fy = site.floorY(x, z);
          lists[r.int(0, protos.length - 1)].push({ x, y: fy + s * 0.18, z, s, yaw: r.range(0, TAU) });
        }
      }
    }
    const mat = stoneMaterial(ctx, U, '0.25', 'vec3(1.05, 1.03, 0.98)', { pebble: true });
    mat.name = 'pondPebble';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    lists.forEach((list, k) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(protos[k], mat, list.length);
      list.forEach((p, i) => {
        q.setFromEuler(e.set(r.range(-0.2, 0.2), p.yaw, r.range(-0.2, 0.2), 'YXZ'));
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s * r.range(0.6, 0.9), p.s * r.range(0.8, 1.1)));
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = true;
      im.name = `pondPebbles${k}`;
      im.computeBoundingSphere();
      group.add(im);
    });
  }

  // ---- rush / iris clumps standing in the shallows -----------------------------
  {
    const protos = [bladeGeometry(r, { arch: 0.22, twist: 0.4 }), bladeGeometry(r, { arch: 0.42, twist: 0.8, w0: 0.019 }), bladeGeometry(r, { arch: 0.12, twist: 0.25, w0: 0.012 })];
    const lists = protos.map(() => []);
    const spots = [];
    for (const line of lines) {
      for (let i = 0; i < line.length; i += 6) {
        const [x0, z0] = line[i];
        if (wall(x0, z0)) continue;
        const dn = noise.fbm2(x0 * 0.12 + 40, z0 * 0.12, 2);
        if (dn < 0.18 || !r.chance(0.55)) continue;
        const [gx, gz] = grad(x0, z0);
        const x = x0 + gx * r.range(0.25, 0.7), z = z0 + gz * r.range(0.25, 0.7);
        if (Math.abs(x - bridgeX) < 4 && z > 3 && z < 30) continue;
        if (nearLens(x, z, 1.2)) continue;
        if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 2.2)) continue;
        spots.push([x, z]);
      }
    }
    for (const [cx, cz] of spots) {
      const nb = r.int(14, 34);
      const hgt = r.range(0.45, 1.0);
      for (let k = 0; k < nb; k++) {
        const a = r.range(0, TAU), d = Math.sqrt(r.float()) * r.range(0.08, 0.28);
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const fy = Math.min(site.floorY(x, z), waterY - 0.05);
        const len = hgt * r.range(0.55, 1.15) + (waterY - fy);
        // blades fan outward from the clump centre
        lists[r.int(0, protos.length - 1)].push({ x, y: fy, z, len, yaw: Math.atan2(Math.sin(a), Math.cos(a)) + r.range(-0.6, 0.6), lean: r.range(0.0, 0.3) + d * 0.6, seed: r.float(), cx, cz });
      }
    }
    const hooks = {
      uniforms: { ...U },
      vertexHead: /* glsl */ `
        attribute vec4 aBlade; // clump x, z, seed, length
        varying vec2 vBUv;
        varying vec4 vBlade;
      `,
      vertexWorld: /* glsl */ `
        vBUv = uv; vBlade = aBlade;
        {
          float t = uv.y;
          float flex = t * t;
          float ph = aBlade.z * 6.2831;
          vec2 wd = normalize(uWindDir);
          float gust = 0.55 + 0.45 * sin(uTime * 0.33 + dot(aBlade.xy, wd) * 0.21 + 1.3);
          vec2 o = wd * (0.5 + 0.5 * sin(uTime * (0.9 + aBlade.z * 0.4) + ph)) * gust * 0.05 + vec2(-wd.y, wd.x) * sin(uTime * 1.6 + ph * 1.7) * 0.015;
          wPos4.xz += o * flex * aBlade.w * uWindStrength;
        }
      `,
      fragHead: /* glsl */ `
        varying vec2 vBUv;
        varying vec4 vBlade;
        float g_tr;
        ${POND_GLSL}
      `,
      fragColor: /* glsl */ `
        {
          float t = vBUv.y;
          float sd = vBlade.z;
          vec3 c = mix(vec3(0.05, 0.10, 0.025), vec3(0.11, 0.17, 0.04), smoothstep(0.0, 0.5, t));
          c = mix(c, vec3(0.20, 0.20, 0.07), smoothstep(0.75, 1.0, t) * (0.4 + 0.6 * fract(sd * 7.1)));
          // brown, dry tips on some blades; faint parallel venation
          c = mix(c, vec3(0.20, 0.13, 0.06), smoothstep(0.88, 0.98, t) * step(0.6, fract(sd * 3.3)));
          float midrib = 1.0 - smoothstep(0.0, 0.25 + fwidth(vBUv.x) * 2.0, abs(vBUv.x - 0.5));
          c *= 0.92 + 0.12 * midrib;
          c *= 0.85 + 0.3 * fract(sd * 13.7);
          // waterline: wet, dark, a little algae
          float above = vWPos.y - uWaterY;
          c = mix(c * 0.45, c, smoothstep(-0.02, 0.06, above));
          diffuseColor.rgb = c;
          g_tr = smoothstep(0.0, 0.3, t);
        }
      `,
      fragRough: `roughnessFactor = 0.48;`,
      fragLight: /* glsl */ `
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 Ld = directLight.direction;
          float back = max(dot(-normal, Ld), 0.0);
          float fwdS = pow(max(dot(-geometryViewDir, Ld), 0.0), 4.0);
          reflectedLight.directDiffuse += directLight.color * vec3(0.16, 0.28, 0.05) * back * (0.3 + 1.2 * fwdS) * 0.3 * g_tr;
          reflectedLight.indirectDiffuse += iblIrradiance * vec3(0.16, 0.28, 0.05) * 0.05 * g_tr;
        }
        #endif
      `,
      fragEnd: UW_FRAGEND,
    };
    const mat = ctx.mat.phys({ color: 0xffffff, roughness: 0.5, metalness: 0, side: THREE.DoubleSide, sheen: 0.2, sheenColor: new THREE.Color(0.2, 0.25, 0.2), sheenRoughness: 0.5 }, hooks);
    mat.name = 'pondRush';
    const dm = ctx.mat.depthMaterialFor({ vertexHead: hooks.vertexHead + DEPTH_FIX, vertexWorld: hooks.vertexWorld });
    dm.side = THREE.DoubleSide;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    lists.forEach((list, k) => {
      if (!list.length) return;
      const g = protos[k].clone();
      const im = new THREE.InstancedMesh(g, mat, list.length);
      const ab = new Float32Array(list.length * 4);
      list.forEach((p, i) => {
        q.setFromEuler(e.set(p.lean, p.yaw, 0, 'YXZ'));
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, p.len, p.len));
        im.setMatrixAt(i, m);
        ab.set([p.cx, p.cz, p.seed, Math.min(p.len, 1.2)], i * 4);
      });
      g.setAttribute('aBlade', new THREE.InstancedBufferAttribute(ab, 4));
      im.instanceMatrix.needsUpdate = true;
      im.customDepthMaterial = dm;
      im.castShadow = true; im.receiveShadow = true;
      im.name = `pondRush${k}`;
      im.computeBoundingSphere();
      group.add(im);
    });
  }
  return { object: group };
}
