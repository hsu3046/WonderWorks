// ---------------------------------------------------------------------------
// Ground cover: moss cushions along bed edges and stones, fern rosettes,
// sedge / grass tufts, pebbles spilling from the gravel, fallen cherry petals
// and maple leaves. All instanced, all placed from the terrain fields.
// ---------------------------------------------------------------------------
import { MOSS_GLSL, TG_GLSL } from './terrain-glsl.js';
import { fernTexture } from './terrain-tex.js';
import { clamp, lerp, smoothstep } from './terrain-field.js';

export function buildCover(ctx, F, stones) {
  const { THREE } = ctx;
  const R = ctx.rng('terrain-cover');
  const group = new THREE.Group();
  group.name = 'groundCover';
  const DOM = F.DOM;
  const rx = () => R.range(DOM.minX + 1, DOM.maxX - 1), rz = () => R.range(DOM.minZ + 1, DOM.maxZ - 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const col = new THREE.Color();
  const inst = (list, geo, mat, name, cast = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(pv.set(o.x, o.y, o.z), q, sv.set(o.sx, o.sy, o.sz));
      im.setMatrixAt(i, m4);
      if (o.c) { col.setRGB(o.c[0], o.c[1], o.c[2]); im.setColorAt(i, col); }
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast; im.receiveShadow = true;
    im.name = name;
    group.add(im);
    return im;
  };
  const trees = F.trees;
  const cherries = trees.filter((t) => t.type === 'cherry');
  const maples = trees.filter((t) => t.type === 'mapleRed');
  const nearTree = (x, z, list, r) => { let d = 1e9; for (const t of list) d = Math.min(d, Math.hypot(x - t.x, z - t.z) - r); return d; };
  const inPond = (x, z, m = 0.25) => F.sdPondEff(x, z) < m;
  const onPath = (x, z, m = 0.05) => F.sdPaths(x, z) < m;
  const free = (x, z) => F.sdLanterns(x, z) > 0.15 && F.sdPads(x, z) > 0.3 && F.sdGutter(x, z) > 0.12 && !(Math.abs(x - F.L.gate.center[0]) < 3.3 && z > F.R.maxZ);

  // =========================================================================
  // 1. moss cushions
  // =========================================================================
  const moss = [];
  const addMoss = (x, z, r) => {
    if (inPond(x, z, 0.1) || onPath(x, z, r * 0.4) || !free(x, z)) return;
    const y = F.heightAt(x, z);
    moss.push({ x, y: y - r * 0.18, z, ry: R.range(0, 6.28), sx: r * R.range(0.9, 1.25), sy: r * R.range(0.32, 0.55), sz: r * R.range(0.8, 1.1) });
  };
  for (let i = 0; i < 26000 && moss.length < 1500; i++) {
    const x = rx(), z = rz();
    if (F.sdRect(x, z) > -0.5) continue;
    const m = F.mossAt(x, z);
    if (m > 0.03 || m < -0.5) continue;
    if (R.next() > 0.55) continue;
    addMoss(x, z, R.range(0.06, 0.2));
  }
  // broad, low cushions inside the moss beds (relief that the grazing sun models from the air)
  for (let i = 0; i < 40000 && moss.length < 2900; i++) {
    const x = rx(), z = rz();
    if (F.sdRect(x, z) > -3.2) continue;
    const m = F.mossAt(x, z);
    if (m > -0.45) continue;
    if (R.next() > 0.3) continue;
    const r = R.range(0.22, 0.6);
    if (F.mossAt(x, z) > -r * 0.8) continue;
    addMoss(x, z, r);
  }
  // hugging the kerbs and stepping stones
  for (const s of stones) {
    if (s.gutter) continue;
    if (s.kind === 1) {
      const ox = -Math.cos(s.yaw) * s.side, oz = Math.sin(s.yaw) * s.side;
      const along = [Math.sin(s.yaw), Math.cos(s.yaw)];
      for (let k = 0; k < 3; k++) {
        const t = R.range(-0.5, 0.5) * s.d;
        const x = s.x + along[0] * t + ox * R.range(0.2, 0.32), z = s.z + along[1] * t + oz * R.range(0.2, 0.32);
        if (F.mossAt(x, z) < 0.12) addMoss(x, z, R.range(0.07, 0.16));
      }
    } else if (s.kind === 2) {
      const n = R.int(1, 3);
      for (let k = 0; k < n; k++) {
        const a = R.range(0, 6.28), rr = (s.r || 0.3) * R.range(0.95, 1.15);
        addMoss(s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr, R.range(0.06, 0.13));
      }
    }
  }
  {
    const geo = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const pa = geo.attributes.position;
    const rr = ctx.rng('mossgeo');
    const ph = [rr.range(0, 6), rr.range(0, 6), rr.range(0, 6)];
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.12 * Math.sin(a * 3 + ph[0]) + 0.08 * Math.sin(a * 5 + ph[1]) + 0.06 * Math.sin(y * 6 + ph[2]);
      pa.setXYZ(i, x * k, y * (0.9 + 0.15 * Math.sin(a * 2 + ph[1])), z * k);
    }
    geo.computeVertexNormals();
    const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.95 }, {
      fragHead: `float c_h; ${TG_GLSL} ${MOSS_GLSL}`,
      fragColor: /* glsl */ `
      {
        vec2 fwp = fwidth(vWPos.xz); float fw = max(sqrt(fwp.x * fwp.y), 1e-5);
        vec3 mc; float mh; float mr;
        tg_moss(vWPos.xz + vWPos.y * 3.0, vWPos.y, fw, mc, mh, mr);
        float up = normalize(vWNrm).y;
        // same lawn grading as the moss carpet (cushions read as raised moss, not dark lumps):
        // sunny yellow-green tops, deeper green flanks, cushion to cushion tint
        mc *= 1.5 * vec3(0.93, 1.05, 0.84);
        float tv = n_snoise(floor(vWPos.xz * 1.7) * 0.37 + 3.0);
        mc = mix(mc, mc * vec3(1.3, 1.2, 0.72), smoothstep(0.0, 0.8, tv) * 0.5);
        mc = mix(mc, mc * vec3(0.75, 0.9, 0.95), smoothstep(0.0, -0.8, tv) * 0.4);
        mc *= mix(0.62, 1.1, smoothstep(-0.2, 0.9, up));
        diffuseColor.rgb = mc;
        float fF = 1.0 - smoothstep(0.004, 0.012, fw);
        c_h = mh + n_snoise3(vWPos * 70.0) * 0.0015 * fF;
      }`,
      fragNormal: `normal = n_bumpView(-vViewPosition, normal, c_h, 1.0);`,
      fragLight: /* glsl */ `
      {
        float nv = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
        float nl = dot(geometryNormal, directLight.direction);
        reflectedLight.directDiffuse += directLight.color * pow(1.0 - nv, 3.0) * clamp(nl + 0.3, 0.0, 1.0) * vec3(0.10, 0.20, 0.06) * 0.4;
      }`,
    });
    mat.name = 'mossClumps';
    inst(moss, geo, mat, 'mossClumps', true);
  }

  // =========================================================================
  // 2. ferns
  // =========================================================================
  const ferns = [];
  const addFern = (x, z, s) => {
    if (inPond(x, z, 0.5) || onPath(x, z, 0.35) || !free(x, z)) return;
    ferns.push({ x, y: F.heightAt(x, z) - 0.02, z, ry: R.range(0, 6.28), rx: R.range(-0.08, 0.08), rz: R.range(-0.08, 0.08), sx: s, sy: s * R.range(0.85, 1.1), sz: s });
  };
  for (let i = 0; i < 40000 && ferns.length < 760; i++) {
    const x = rx(), z = rz();
    const d = F.sdRect(x, z);
    let p = 0;
    if (d > 5.6) p = 0.6 * smoothstep(5.6, 7.5, d) * (0.4 + 0.6 * smoothstep(-0.2, 0.3, F.noise.f2(x * 0.15, z * 0.15, 2))); // forest edge beyond the gravel walk
    else if (d > -0.5) continue;
    else {
      const m = F.mossAt(x, z);
      if (m > -0.4) continue;
      const nt = nearTree(x, z, trees, 0);
      p = 0.5 * smoothstep(5.5, 1.2, nt);
      const sp = F.sdPondEff(x, z);
      p = Math.max(p, 0.22 * smoothstep(3.5, 1.0, sp) * smoothstep(0.4, 0.9, sp));
      p = Math.max(p, 0.12 * smoothstep(-2.5, -3.5, d)); // shady strip along the corridors
    }
    if (R.next() > p) continue;
    addFern(x, z, R.range(0.32, 0.75));
  }
  {
    const fronds = 8;
    const P = [], N = [], U = [], I = [];
    const rr = ctx.rng('ferngeo');
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + rr.range(-0.25, 0.25);
      const rise = rr.range(0.7, 1.05), L = rr.range(0.8, 1.0), wdt = rr.range(0.32, 0.4) * L;
      const ca = Math.cos(a), sa = Math.sin(a);
      const segs = 6;
      const base = P.length / 3;
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        // arching frond: up then out and down
        const r = L * t;
        const h = Math.sin(t * Math.PI * 0.75) * 0.55 * L * rise - t * t * 0.2 * L;
        const cx = ca * r * 0.92, cz = sa * r * 0.92;
        const tw = 0.25 * t; // twist
        const px = -sa * Math.cos(tw), pz = ca * Math.cos(tw), py = Math.sin(tw);
        for (const side of [-0.5, 0.5]) {
          P.push(cx + px * side * wdt, h + py * side * wdt, cz + pz * side * wdt);
          N.push(ca * 0.3, 0.9, sa * 0.3);
          U.push(side + 0.5, t);
        }
      }
      for (let k = 0; k < segs; k++) {
        const a0 = base + k * 2;
        I.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setIndex(I);
    const ft = fernTexture(ctx);
    const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide, alphaTest: 0.5 }, {
      uniforms: { tFern: { value: ft.tex } },
      vertexHead: `varying vec2 vFUv; varying float vFh;`,
      vertexWorld: `vFUv = uv; vFh = uv.y; wPos4.xyz += windOffset(wPos4.xyz, uv.y * 0.8) * 0.5;`,
      fragHead: `uniform sampler2D tFern; varying vec2 vFUv; varying float vFh; float fe_b;`,
      fragColor: /* glsl */ `
      {
        vec4 tx = texture2D(tFern, vFUv);
        vec2 dd = fwidth(vFUv) * 512.0;
        float lod = log2(max(max(dd.x, dd.y), 1.0));
        float a = tx.g * (1.0 + 0.3 * lod);
        float b = clamp(tx.r / max(tx.g, 0.04), 0.0, 1.0);
        vec3 c = mix(vec3(0.030, 0.070, 0.014), vec3(0.075, 0.13, 0.022), b);
        c = mix(c, c * vec3(1.25, 1.1, 0.6), vFh * 0.5);
        diffuseColor.rgb = c * mix(0.55, 1.0, vFh);
        diffuseColor.a = a;
        fe_b = b;
      }`,
      fragNormal: `normal = normalize(vNormal); normal = n_bumpView(-vViewPosition, normal, fe_b * 0.004, 1.0);`,
      fragLight: /* glsl */ `
      {
        float vl = clamp(dot(-geometryViewDir, directLight.direction), 0.0, 1.0);
        reflectedLight.directDiffuse += directLight.color * (pow(vl, 4.0) * 1.2 + 0.15) * vec3(0.10, 0.16, 0.025) * (0.5 + fe_b);
      }`,
    });
    mat.name = 'ferns';
    const im = inst(ferns, geo, mat, 'ferns', true);
    if (im) im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: ft.tex, alphaTest: 0.5 });
  }

  // =========================================================================
  // 3. sedge / grass tufts (pond shore, bed edges, forest edge)
  // =========================================================================
  const grass = [];
  for (let i = 0; i < 70000 && grass.length < 3400; i++) {
    const x = rx(), z = rz();
    if (onPath(x, z, 0.12) || !free(x, z)) continue;
    const sp = F.sdPondEff(x, z);
    const d = F.sdRect(x, z);
    let p = 0;
    if (sp > 0.05 && sp < 1.4) p = 0.75 * smoothstep(1.4, 0.4, sp);
    const m = F.mossAt(x, z);
    if (m < 0 && m > -0.35) p = Math.max(p, 0.12);
    if (d > 5.5) p = Math.max(p, 0.16 * (0.3 + 0.7 * smoothstep(-0.3, 0.4, F.noise.f3(x * 0.2 + 7.0, z * 0.2, 2))));
    else if (d > -0.3 && d < 4) continue;
    // tufts lining the edge of the gravel walk outside
    const so = F.soilAt(x, z);
    if (d > 4 && so < 0.15 && so > -0.35) p = Math.max(p, 0.5);
    if (R.next() > p) continue;
    const s = R.range(0.18, 0.45) * (sp < 1.4 ? 1.3 : 1);
    grass.push({ x, y: F.heightAt(x, z) - 0.01, z, ry: R.range(0, 6.28), sx: s * R.range(0.8, 1.2), sy: s, sz: s * R.range(0.8, 1.2), c: [R.range(0.85, 1.15), R.range(0.85, 1.1), R.range(0.8, 1.1)] });
  }
  {
    const P = [], N = [], U = [], I = [];
    const rr = ctx.rng('grassgeo');
    const blades = 18;
    for (let b = 0; b < blades; b++) {
      const a = rr.range(0, 6.28), lean = rr.range(0.2, 0.75), L = rr.range(0.5, 1.0), w = rr.range(0.01, 0.017);
      const ox = rr.range(-0.05, 0.05), oz = rr.range(-0.05, 0.05);
      const ca = Math.cos(a), sa = Math.sin(a);
      const base = P.length / 3;
      const segs = 3;
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const r = lean * t * t * L, h = L * t * (1 - 0.25 * lean * t);
        const ww = w * (1 - t * 0.92);
        for (const sd of [-1, 1]) {
          P.push(ox + ca * r - sa * ww * sd, h, oz + sa * r + ca * ww * sd);
          N.push(ca * 0.4, 0.8, sa * 0.4);
          U.push(sd * 0.5 + 0.5, t);
        }
      }
      for (let k = 0; k < segs; k++) { const a0 = base + k * 2; I.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setIndex(I);
    const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }, {
      vertexHead: `varying float vGh;`,
      vertexWorld: `vGh = uv.y; wPos4.xyz += windOffset(wPos4.xyz, uv.y * uv.y) * 0.8;`,
      fragHead: `varying float vGh;`,
      fragColor: /* glsl */ `
      {
        vec3 c = mix(vec3(0.035, 0.07, 0.015), vec3(0.11, 0.13, 0.03), vGh);
        c = mix(c, vec3(0.17, 0.13, 0.06), smoothstep(0.75, 1.0, vGh) * 0.6);
        diffuseColor.rgb = c * vColor.rgb * mix(0.5, 1.0, vGh);
      }`,
      fragNormal: `normal = normalize(vNormal);`,
      fragLight: /* glsl */ `
      {
        float vl = clamp(dot(-geometryViewDir, directLight.direction), 0.0, 1.0);
        reflectedLight.directDiffuse += directLight.color * (pow(vl, 5.0) * 1.4 + 0.12) * vec3(0.14, 0.17, 0.03) * vGh;
      }`,
    });
    mat.name = 'grassTufts';
    inst(grass, geo, mat, 'grassTufts', true);
    // tiny tufts of grass and moss sprouting from the paving joints
    const jt = [];
    const fieldSlabs = stones.filter((s) => (s.kind === 0 || s.kind === 1) && !s.gutter && s.m);
    const v4 = new THREE.Vector3();
    for (let i = 0; i < 9000 && jt.length < 1900 && fieldSlabs.length; i++) {
      const s = fieldSlabs[R.int(0, fieldSlabs.length - 1)];
      // a point on the slab outline (local frame: x across, z along), just outside the arris
      let lx, lz;
      if (R.chance(0.5)) { lx = R.sign() * (s.w / 2 + 0.006); lz = R.range(-0.5, 0.5) * s.d; } else { lz = R.sign() * (s.d / 2 + 0.006); lx = R.range(-0.5, 0.5) * s.w; }
      v4.set(lx, -0.03, lz).applyMatrix4(s.m);
      if (F.sdPondEff(v4.x, v4.z) < 0.4) continue;
      const k = F.noise.f2(v4.x * 0.6, v4.z * 0.6, 2);
      if (R.next() > 0.25 + 0.75 * smoothstep(-0.2, 0.3, k)) continue;
      const sc = R.range(0.05, 0.12);
      jt.push({ x: v4.x, y: v4.y, z: v4.z, ry: R.range(0, 6.28), sx: sc * R.range(0.8, 1.3), sy: sc, sz: sc * R.range(0.8, 1.3), c: [R.range(0.85, 1.2), R.range(0.9, 1.2), R.range(0.75, 1.0)] });
    }
    inst(jt, geo, mat, 'jointTufts', false);
  }

  // =========================================================================
  // 4. pebbles (gravel spill at bed edges, along kerbs, on the shore)
  // =========================================================================
  const peb = [];
  const addPeb = (x, z, s, dark) => {
    if (onPath(x, z, -0.02) || inPond(x, z, -0.2) || !free(x, z)) return;
    const y = F.heightAt(x, z);
    const g = dark ? R.range(0.08, 0.16) : R.range(0.22, 0.36);
    const warm = R.range(0.95, 1.08);
    peb.push({ x, y: y + s * 0.05, z, ry: R.range(0, 6.28), rx: R.range(-0.2, 0.2), rz: R.range(-0.2, 0.2), sx: s * R.range(0.9, 1.5), sy: s * R.range(0.35, 0.6), sz: s, c: [g * warm, g, g / warm] });
  };
  for (let i = 0; i < 60000 && peb.length < 2600; i++) {
    const x = rx(), z = rz();
    const dR = F.sdRect(x, z);
    if (dR > -0.2 && dR < 3.0) continue;
    if (dR >= 3.0) { const so = F.soilAt(x, z); if (so > -0.25 && so < 0.12 && R.chance(0.7)) addPeb(x, z, R.range(0.02, 0.06), R.chance(0.4)); continue; }
    const m = F.mossAt(x, z);
    const sp = F.sdPondEff(x, z);
    let p = 0, dark = false;
    if (m > -0.12 && m < 0.35) p = 0.6 * smoothstep(-0.12, 0.05, m);
    if (sp > -0.3 && sp < 0.6) { p = 0.7; dark = R.chance(0.6); }
    const pd = F.sdPaths(x, z);
    if (pd > 0 && pd < 0.18) { p = 0.8; dark = R.chance(0.3); }
    if (R.next() > p) continue;
    addPeb(x, z, R.range(0.018, 0.055) * (sp < 0.6 ? 1.6 : 1), dark);
  }
  {
    let geo = new THREE.IcosahedronGeometry(1, 1);
    geo = ctx.geom.mergeVertices(geo);
    const pa = geo.attributes.position;
    const rr = ctx.rng('pebgeo');
    for (let i = 0; i < pa.count; i++) { const k = 1 + rr.range(-0.12, 0.12); pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k); }
    geo.computeVertexNormals();
    const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.55 }, {
      fragHead: `float pb_h;`,
      fragColor: /* glsl */ `
      {
        float n = n_snoise3(vWPos * 60.0);
        diffuseColor.rgb = vColor.rgb * (0.85 + 0.2 * n) * (0.9 + 0.2 * n_snoise3(vWPos * 9.0));
        pb_h = n * 0.0008;
      }`,
      fragNormal: `normal = n_bumpView(-vViewPosition, normal, pb_h, 1.0);`,
    });
    mat.name = 'pebbles';
    inst(peb, geo, mat, 'pebbles', true);
  }

  // =========================================================================
  // 4b. garden rocks: set in groups (ishigumi) in the moss gardens, single
  //     mossy boulders on the forest floor outside the corridor
  // =========================================================================
  const rocks = [];
  {
    const stepStones = stones.filter((s) => s.kind === 2);
    const nearStep = (x, z, r) => { for (const s of stepStones) if (Math.hypot(s.x - x, s.z - z) < r + (s.r || 0.3)) return true; return false; };
    const okRock = (x, z, r, inside) => {
      if (inside) {
        if (F.mossAt(x, z) > -0.25 - r * 0.5) return false;
        if (F.sdPondEff(x, z) < 0.9 + r) return false;
      } else if (F.sdRect(x, z) < 6.2 + r) return false;
      if (F.sdPaths(x, z) < 0.6 + r || F.sdLanterns(x, z) < 0.7 + r || F.sdPads(x, z) < 1.0 + r || F.sdGutter(x, z) < 0.5 + r) return false;
      for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < 1.0 + r) return false;
      for (const o of rocks) if (Math.hypot(x - o.x, z - o.z) < (o.r + r) * 0.92) return false;
      if (nearStep(x, z, r + 0.15)) return false;
      return true;
    };
    const addRock = (x, z, r, tall, inside, dry = false) => {
      if (!okRock(x, z, r, inside)) return false;
      let gy = F.heightAt(x, z);
      for (let a = 0; a < 6; a++) gy = Math.min(gy, F.heightAt(x + Math.cos(a) * r * 0.8, z + Math.sin(a) * r * 0.8));
      const v = R.range(0.92, 1.08) * (inside ? 1 : R.range(0.66, 0.8)), warm = R.range(0.96, 1.05);
      const sy = r * tall;
      const k = dry ? 2 : 1;
      rocks.push({ x, y: gy - sy * R.range(0.22, 0.36), z, r, ry: R.range(0, 6.28), rx: R.range(-0.08, 0.08), rz: R.range(-0.08, 0.08), sx: r * R.range(0.9, 1.15), sy, sz: r * R.range(0.75, 1.0), c: [v * warm * k, v * k, (v / warm) * k], t: R.int(0, 2) });
      return true;
    };
    // karesansui islands in the gravel fields: a set triad (main stone + two attendants) and low
    // flat companions
    for (const I of F.ISLES || []) {
      for (const [ox, oz, r, tall] of [[0.1, -0.12, 0.78, 1.45], [-0.3, 0.1, 0.55, 0.85], [0.4, 0.2, 0.46, 0.7], [-0.58, -0.22, 0.36, 0.45], [0.62, -0.3, 0.28, 0.4], [-0.1, 0.45, 0.3, 0.35]]) {
        addRock(I.x + ox * I.ax + R.range(-0.15, 0.15), I.z + oz * I.az + R.range(-0.1, 0.1), r, tall, true, true);
      }
    }
    // groups in the courtyard gardens: one main stone, two to four companions
    let groups = 0;
    for (let i = 0; i < 9000 && groups < 46; i++) {
      const x = rx(), z = rz();
      if (F.sdRect(x, z) > -3) continue;
      const m = F.mossAt(x, z);
      if (m > -1.2) continue;
      const r0 = R.range(0.38, 0.85);
      if (!addRock(x, z, r0, R.range(0.55, 0.95), true)) continue;
      groups++;
      const n = R.int(1, 4);
      for (let k = 0; k < n; k++) {
        const a = R.range(0, 6.28), d = r0 * R.range(1.1, 2.4);
        addRock(x + Math.cos(a) * d, z + Math.sin(a) * d, r0 * R.range(0.3, 0.7), R.range(0.45, 0.85), true);
      }
    }
    // forest floor outside: scattered mossy boulders, a few pairs
    for (let i = 0; i < 6000 && rocks.length < 230; i++) {
      const x = rx(), z = rz();
      const d = F.sdRect(x, z);
      if (d < 6.5) continue;
      const gc = F.L.gate.center;
      if (Math.abs(x - gc[0]) < 9 && z > F.R.maxZ) continue; // keep the gate forecourt clear
      if (R.next() > 0.35) continue;
      const r0 = R.range(0.3, 0.95);
      if (addRock(x, z, r0, R.range(0.45, 0.8), false) && R.chance(0.4)) {
        const a = R.range(0, 6.28);
        addRock(x + Math.cos(a) * r0 * 1.6, z + Math.sin(a) * r0 * 1.6, r0 * R.range(0.35, 0.6), R.range(0.5, 0.8), false);
      }
    }
    // three template shapes: lumpy ellipsoid with planar cleavage faces and a flattened base
    const hash3 = (x, y, z) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1; };
    const vnoise = (x, y, z) => {
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      const fx = x - ix, fy = y - iy, fz = z - iz;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
      let acc = 0;
      for (let k = 0; k < 8; k++) {
        const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
        acc += hash3(ix + dx, iy + dy, iz + dz) * (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz);
      }
      return acc;
    };
    const tplGeo = (seed) => {
      const rr = ctx.rng('rockgeo' + seed);
      let g = new THREE.IcosahedronGeometry(1, 3);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      g = ctx.geom.mergeVertices(g);
      const pa = g.attributes.position;
      const off = [rr.range(0, 50), rr.range(0, 50), rr.range(0, 50)];
      const planes = [];
      for (let k = 0; k < 9; k++) {
        const th = rr.range(0, 6.28), ph = rr.range(-0.25, 1.2);
        planes.push([Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph), rr.range(0.7, 0.9)]);
      }
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        let r = 1 + 0.2 * vnoise(x * 1.4 + off[0], y * 1.4 + off[1], z * 1.4 + off[2]) + 0.08 * vnoise(x * 3.3 - off[1], y * 3.3 + off[2], z * 3.3) + 0.025 * vnoise(x * 8 + off[2], y * 8, z * 8 - off[0]);
        for (const [nx, ny, nz, o] of planes) { const dd = x * nx + y * ny + z * nz; if (dd > 0.05) r = Math.min(r, o / dd + 0.03 * (r - o / dd)); }
        let px = x * r, py = y * r, pz = z * r;
        if (py < -0.35) py = -0.35 + (py + 0.35) * 0.25;
        pa.setXYZ(i, px, py + 0.2, pz);
      }
      g.computeVertexNormals();
      return g;
    };
    const tpls = [tplGeo(0), tplGeo(1), tplGeo(2)];
    const mat = ctx.mat.std({ color: 0xffffff, roughness: 0.85, metalness: 0 }, {
      vertexHead: /* glsl */ `varying float vRy;`,
      vertexWorld: /* glsl */ `vRy = position.y;`,
      fragHead: /* glsl */ `varying float vRy; float rk_h; float rk_moss; ${TG_GLSL} ${MOSS_GLSL}`,
      fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        vec3 fw3 = fwidth(wp);
        float fw = max(max(fw3.x, fw3.y), max(fw3.z, 1e-5));
        float fineF = 1.0 - smoothstep(0.003, 0.016, fw);
        float midF = 1.0 - smoothstep(0.01, 0.05, fw);
        float big = n_fbm3(wp * 0.8, 3);
        float mid = n_fbm3(wp * 3.2 + 4.0, 3);
        float dry = step(1.5, vColor.g);
        vec3 vc = vColor.rgb * mix(1.0, 0.5, dry);
        vec3 col = vec3(0.215, 0.21, 0.198) * mix(1.0, 1.3, dry) * vc * (0.78 + 0.28 * big + 0.12 * mid * midF);
        // biotite / feldspar specks (filtered)
        float s1 = n_snoise3(wp * 42.0), s2 = n_snoise3(wp * 77.0 + 3.0);
        col = mix(col, vec3(0.05), smoothstep(0.55, 0.85, s1) * 0.55 * fineF);
        col = mix(col, col * 1.45, smoothstep(0.62, 0.9, s2) * 0.4 * fineF);
        // dark rain streaks down the flanks, damp darker foot
        float streak = n_fbm3(wp * vec3(3.0, 0.4, 3.0) + 7.0, 3);
        col *= 1.0 - smoothstep(0.05, 0.6, streak) * 0.3 * (1.0 - abs(wn.y));
        col *= mix(0.45, 1.0, smoothstep(-0.05, 0.45, vRy));
        // pale crustose lichen
        float lich = smoothstep(0.6, 0.72, n_fbm3(wp * 2.6 + 9.0, 3) * 0.5 + 0.5);
        col = mix(col, vec3(0.50, 0.50, 0.40), lich * 0.45);
        // moss cushions on the top and the shady north side
        float up = smoothstep(0.05, 0.85, wn.y) + 0.35 * smoothstep(0.2, 0.9, -wn.z);
        float mn = n_fbm3(wp * 1.5 + 2.0, 4) * 0.5 + 0.5;
        float mb = smoothstep(0.9, 0.7, vc.g);
        rk_moss = smoothstep(0.58 - 0.38 * up - 0.25 * mb, 0.72 - 0.22 * up - 0.2 * mb, mn + 0.16 * up);
        // set stones in the gravel gardens are kept clean: moss only in the hollows near the foot
        rk_moss *= mix(1.0, 0.35 * smoothstep(0.35, 0.0, vRy) + 0.12 * smoothstep(0.7, 0.85, mn), dry);
        vec3 mc; float mh; float mr;
        tg_moss(wp.xz + wp.y * 2.0, wp.y, fw, mc, mh, mr);
        mc *= 1.35;
        col = mix(col, mc, rk_moss);
        diffuseColor.rgb = col;
        rk_h = big * 0.012 + mid * 0.004 * midF + s1 * 0.0006 * fineF + rk_moss * (0.006 + mh);
      }`,
      fragRough: /* glsl */ `roughnessFactor = mix(0.78, 0.95, rk_moss);`,
      fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, rk_h, 1.0);`,
    });
    mat.name = 'gardenRocks';
    for (let t = 0; t < 3; t++) inst(rocks.filter((o) => o.t === t), tpls[t], mat, 'gardenRocks' + t, true);
  }

  // =========================================================================
  // 5. fallen cherry petals and maple leaves
  // =========================================================================
  const petals = [], leaves = [];
  const v3 = new THREE.Vector3();
  const pathStones = stones.filter((s) => s.kind !== 3 && !s.gutter);
  const onStone = (s) => {
    const lx = R.range(-0.45, 0.45) * s.w, lz = R.range(-0.45, 0.45) * s.d;
    v3.set(lx, 0.0035, lz).applyMatrix4(s.m);
    return v3;
  };
  const petalCol = () => { const t = R.next(); return [lerp(0.80, 0.62, t), lerp(0.62, 0.42, t), lerp(0.66, 0.46, t)]; };
  // petals on paving (a light dusting everywhere, heavier downwind of cherries)
  for (let i = 0; i < 4200; i++) {
    const s = pathStones[R.int(0, pathStones.length - 1)];
    if (!s) break;
    const dc = nearTree(s.x, s.z, cherries, 0);
    if (R.next() > 0.35 + 0.65 * smoothstep(22, 6, dc)) continue;
    const p = onStone(s);
    const sc = R.range(0.02, 0.03);
    petals.push({ x: p.x, y: p.y, z: p.z, ry: R.range(0, 6.28), rx: R.range(-0.15, 0.15), rz: R.range(-0.15, 0.15), sx: sc, sy: sc, sz: sc, c: petalCol() });
  }
  // petal drift on the processional paths: blown in from the cherries, lodged against the joints
  // and kerbs of the wet slabs
  const heroStones = pathStones.filter((s) => s.path === 0 || s.path === 1);
  for (let i = 0; i < 2600 && heroStones.length; i++) {
    const s = heroStones[R.int(0, heroStones.length - 1)];
    let lx = R.range(-0.46, 0.46), lz = R.range(-0.46, 0.46);
    if (R.chance(0.55)) { if (R.chance(0.5)) lx = R.sign() * R.range(0.4, 0.48); else lz = R.sign() * R.range(0.4, 0.48); }
    v3.set(lx * s.w, 0.0035, lz * s.d).applyMatrix4(s.m);
    const sc = R.range(0.022, 0.034);
    petals.push({ x: v3.x, y: v3.y, z: v3.z, ry: R.range(0, 6.28), rx: R.range(-0.12, 0.12), rz: R.range(-0.12, 0.12), sx: sc, sy: sc, sz: sc, c: petalCol() });
  }
  // petals on gravel / moss under & downwind of the cherries
  for (const t of cherries) {
    for (let i = 0; i < 700; i++) {
      const a = R.range(0, 6.28), rr = Math.abs(R.gauss(0, 4.2));
      const x = t.x + Math.cos(a) * rr + 1.5, z = t.z + Math.sin(a) * rr + 0.8;
      if (inPond(x, z, 0.1) || onPath(x, z, 0.0) || !free(x, z)) continue;
      const sc = R.range(0.02, 0.028);
      petals.push({ x, y: F.heightAt(x, z) + 0.004, z, ry: R.range(0, 6.28), rx: R.range(-0.3, 0.3), rz: R.range(-0.3, 0.3), sx: sc, sy: sc, sz: sc, c: petalCol() });
    }
  }
  const leafCol = () => {
    const t = R.next();
    if (t < 0.45) return [R.range(0.30, 0.45), R.range(0.025, 0.05), R.range(0.012, 0.02)];
    if (t < 0.75) return [R.range(0.45, 0.6), R.range(0.10, 0.2), R.range(0.015, 0.03)];
    if (t < 0.9) return [R.range(0.45, 0.55), R.range(0.28, 0.36), R.range(0.03, 0.05)];
    return [0.16, 0.07, 0.03];
  };
  for (const t of maples) {
    for (let i = 0; i < 380; i++) {
      const a = R.range(0, 6.28), rr = Math.abs(R.gauss(0, 3.4));
      const x = t.x + Math.cos(a) * rr + 1.0, z = t.z + Math.sin(a) * rr;
      if (inPond(x, z, 0.1) || !free(x, z)) continue;
      let y;
      if (onPath(x, z, 0.0)) {
        // find the stone under it (cheap: nearest stone centre)
        let best = null, bd = 1e9;
        for (const s of pathStones) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
        if (!best || bd > 0.8) continue;
        y = onStone(best).y;
      } else y = F.heightAt(x, z) + 0.006;
      const sc = R.range(0.025, 0.04);
      leaves.push({ x, y, z, ry: R.range(0, 6.28), rx: R.range(-0.25, 0.25), rz: R.range(-0.25, 0.25), sx: sc, sy: sc, sz: sc, c: leafCol() });
    }
  }
  // a few stray maple leaves along every path
  for (let i = 0; i < 260; i++) {
    const s = pathStones[R.int(0, pathStones.length - 1)];
    if (!s) break;
    const p = onStone(s);
    const sc = R.range(0.025, 0.038);
    leaves.push({ x: p.x, y: p.y, z: p.z, ry: R.range(0, 6.28), rx: R.range(-0.2, 0.2), rz: R.range(-0.2, 0.2), sx: sc, sy: sc, sz: sc, c: leafCol() });
  }
  {
    const debrisMat = ctx.mat.std({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }, {
      fragHead: `float d_h;`,
      fragColor: /* glsl */ `
      {
        float n = n_snoise3(vWPos * 400.0);
        diffuseColor.rgb = vColor.rgb * (0.88 + 0.16 * n);
      }`,
      fragNormal: `normal = normalize(vNormal);`,
      fragLight: /* glsl */ `
      {
        float vl = clamp(dot(-geometryViewDir, directLight.direction), 0.0, 1.0);
        reflectedLight.directDiffuse += directLight.color * (pow(vl, 3.0) * 0.6 + 0.1) * vColor.rgb * 0.5;
      }`,
    });
    debrisMat.name = 'petalsLeaves';
    // petal: cupped, notched oval (4 tris)
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, -0.38, 0.06, -0.05, -0.28, 0.1, 0.38, 0, 0.06, 0.5, 0.28, 0.1, 0.38, 0.38, 0.06, -0.05, 0, 0.12, 0.05], 3));
    pg.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
    pg.computeVertexNormals();
    inst(petals, pg, debrisMat, 'petals', false);
    // maple leaf: 7-lobed star with a slight curl
    const LP = [0, 0.05, 0];
    const lobes = [[-90, 1], [-50, 0.85], [-15, 0.6], [25, 0.45], [155, 0.45], [195, 0.6], [230, 0.85]].map(([a, r]) => [(a + 90) * Math.PI / 180, r]);
    const outline = [];
    lobes.forEach(([a, r], i) => {
      outline.push([Math.cos(a - Math.PI / 2) * r, Math.sin(a - Math.PI / 2) * r]);
      const [a2] = lobes[(i + 1) % lobes.length];
      let am = (a + (a2 < a ? a2 + Math.PI * 2 : a2)) / 2;
      outline.push([Math.cos(am - Math.PI / 2) * r * 0.42, Math.sin(am - Math.PI / 2) * r * 0.42]);
    });
    for (const [x, z] of outline) LP.push(x, 0.12 * (x * x + z * z), z);
    const LI = [];
    for (let i = 0; i < outline.length; i++) LI.push(0, 1 + ((i + 1) % outline.length), 1 + i);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
    lg.setIndex(LI);
    lg.computeVertexNormals();
    inst(leaves, lg, debrisMat, 'leaves', false);
  }

  group.userData.stats = { rocks: rocks.length, moss: moss.length, ferns: ferns.length, grass: grass.length, pebbles: peb.length, petals: petals.length, leaves: leaves.length };
  return group;
}
