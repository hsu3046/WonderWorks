import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------------------
// Geometry helpers shared by all world modules.
// ---------------------------------------------------------------------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Build a Matrix4 from {pos:[x,y,z], rot:[x,y,z] (radians, XYZ), scale:[x,y,z]|number, quat}
export function mat4(pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, quat = null) {
  _p.set(pos[0], pos[1], pos[2]);
  if (quat) _q.copy(quat); else _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ'));
  if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Normalise attributes so geometries can be merged (position/normal/uv only, non-indexed).
export function clean(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    const n = geo.attributes.position.count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  for (const k of Object.keys(geo.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geo.deleteAttribute(k);
  }
  geo.morphAttributes = {};
  geo.clearGroups();
  return geo;
}

// Collect geometries per material and emit merged meshes.
//   const b = new Builder();
//   b.add(geometry, material, matrix4)      // geometry is cloned + transformed
//   b.box(material, w, h, d, pos, rot, bevel)
//   const group = b.build({ castShadow: true, receiveShadow: true, name: 'pagoda' });
export class Builder {
  constructor() { this.buckets = new Map(); }
  add(geo, material, matrix = null) {
    let g = geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    g = clean(g);
    const hasColor = !!g.attributes.color;
    const key = material.uuid + (hasColor ? ':c' : '');
    if (!this.buckets.has(key)) this.buckets.set(key, { material, geos: [] });
    this.buckets.get(key).geos.push(g);
    return this;
  }
  box(material, w, h, d, pos = [0, 0, 0], rot = [0, 0, 0], bevel = 0) {
    const g = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d);
    return this.add(g, material, mat4(pos, rot));
  }
  cyl(material, rTop, rBot, h, pos = [0, 0, 0], rot = [0, 0, 0], seg = 16) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1), material, mat4(pos, rot));
  }
  addBuilder(other, matrix = null) {
    for (const { material, geos } of other.buckets.values()) for (const g of geos) this.add(g, material, matrix);
    return this;
  }
  build({ castShadow = true, receiveShadow = true, name = 'built' } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const { material, geos } of this.buckets.values()) {
      // split into chunks to keep index ranges sane
      const chunks = [];
      let cur = [], count = 0;
      for (const g of geos) {
        cur.push(g); count += g.attributes.position.count;
        if (count > 3_000_000) { chunks.push(cur); cur = []; count = 0; }
      }
      if (cur.length) chunks.push(cur);
      for (const c of chunks) {
        const merged = mergeGeometries(c, false);
        if (!merged) { console.warn('merge failed for', name, material.name); continue; }
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
        group.add(mesh);
      }
    }
    return group;
  }
}

// InstancedMesh from a list of Matrix4
export function instanced(geo, material, matrices, { castShadow = true, receiveShadow = true } = {}) {
  const im = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = castShadow; im.receiveShadow = receiveShadow;
  im.computeBoundingSphere();
  return im;
}

// Lathe from [[r,y],...] profile
export function lathe(profile, seg = 24) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg);
}

// Sweep a 2D shape (THREE.Shape) along a 3D curve (THREE.Curve) with frames
export function sweep(shape, curve, steps = 32, closed = false) {
  return new THREE.ExtrudeGeometry(shape, { steps, bevelEnabled: false, extrudePath: curve });
}

// Tube along a list of [x,y,z] points
export function tubeAlong(points, radius = 0.05, seg = 32, radial = 8) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(c, seg, radius, radial, false);
}

export { mergeGeometries, mergeVertices, RoundedBoxGeometry };

// Smooth curve helpers
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
