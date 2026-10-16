// ---------------------------------------------------------------------------
// VEGETATION — opaque foliage cores. A clipped niwaki pine pad is a dense,
// light-tight cushion of needles: an alpha-card cloud alone reads as fuzzy
// "cotton" from 40-90 m (light leaks through, every card shades differently).
// Each pad therefore gets a closed, lobed super-ellipsoid core sitting just
// under the needle tufts: it gives the pad a crisp outline, a dark interior
// showing through the gaps, and real self-shadowing (dark undersides, shadows
// cast onto the pads below).
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;

export class CushionAccum {
  constructor() { this.pos = []; this.tint = []; this.flex = []; this.idx = []; this.vc = 0; this.tris = 0; }
  // shapeFn(th, phi) -> [lx, ly, lz] in the pad frame (phi 0 = top pole, PI = bottom pole);
  // the frame is rotated by `yaw` about +Y and placed at c.
  add(c, yaw, shapeFn, tintFn, flex, nTh = 14, nPhi = 8) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const base = this.vc;
    const push = (th, phi) => {
      const [lx, ly, lz] = shapeFn(th, phi);
      this.pos.push(c.x + lx * cy - lz * sy, c.y + ly, c.z + lx * sy + lz * cy);
      const t = tintFn(th, phi);
      this.tint.push(t[0], t[1], t[2]);
      this.flex.push(flex);
      this.vc++;
    };
    push(0, 0);
    for (let i = 1; i < nPhi; i++) for (let j = 0; j < nTh; j++) push((j / nTh) * TAU, (i / nPhi) * Math.PI);
    push(0, Math.PI);
    const ring = (i, j) => base + 1 + (i - 1) * nTh + (j % nTh);
    for (let j = 0; j < nTh; j++) this.idx.push(base, ring(1, j + 1), ring(1, j));
    for (let i = 1; i < nPhi - 1; i++) {
      for (let j = 0; j < nTh; j++) {
        const a = ring(i, j), b = ring(i, j + 1), c2 = ring(i + 1, j), d = ring(i + 1, j + 1);
        this.idx.push(a, b, c2, b, d, c2);
      }
    }
    const bot = base + 1 + (nPhi - 1) * nTh;
    for (let j = 0; j < nTh; j++) this.idx.push(bot, ring(nPhi - 1, j), ring(nPhi - 1, j + 1));
    this.tris += nTh * 2 + (nPhi - 2) * nTh * 2;
  }
  toGeometry(THREE) {
    if (!this.vc) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(this.flex, 1));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// signed power (super-ellipse profile)
export const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
