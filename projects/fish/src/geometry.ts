// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three/webgpu';

type V3 = readonly [number, number, number];

/** One small, fully modeled fish. All 6144 instances share this geometry. */
export function fishGeometry(): BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const skinUV: number[] = [], parts: number[] = [];
  const rings = [
    [-.40,.025,.018],[-.29,.07,.047],[-.16,.113,.077],[0,.128,.09],
    [.15,.112,.081],[.27,.083,.068],[.36,.044,.041],[.405,.015,.02],
  ];
  const radial = 10;
  for (const [x, h, w] of rings) {
    for (let s = 0; s <= radial; s++) {
      const a = s / radial * Math.PI * 2, y = Math.cos(a), z = Math.sin(a);
      positions.push(x, y * h, z * w);
      skinUV.push((x + .40) / .805, s / radial); parts.push(0);
      const belly = Math.max(0, Math.min(1, .65 - y * .65));
      const stripe = Math.exp(-(((y - .25) / .18) ** 2));
      // Navy countershading rolls into a cool silver flank and a pale belly.
      colors.push(.12 + belly * .49 - stripe * .035, .22 + belly * .45 - stripe * .03, .36 + belly * .34 - stripe * .02);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < radial; s++) {
    const a = r * (radial + 1) + s, b = a + radial + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // Fin sheets have their own vertices so the edge stays crisp at close range.
  const fin = (vertices: V3[], tint: V3) => {
    const start = positions.length / 3;
    for (const v of vertices) { positions.push(...v); colors.push(...tint); skinUV.push(0,0); parts.push(1); }
    for (let i = 1; i < vertices.length - 1; i++) indices.push(start, start + i, start + i + 1);
  };
  fin([[-.34,0,0],[-.59,.20,0],[-.53,.036,0],[-.43,0,0]], [.41,.54,.54]);
  fin([[-.34,0,0],[-.43,0,0],[-.53,-.036,0],[-.59,-.20,0]], [.43,.55,.55]);
  fin([[.07,.112,0],[-.12,.24,0],[-.25,.076,0]], [.28,.43,.45]);
  fin([[-.06,-.10,0],[-.19,-.19,0],[-.28,-.063,0]], [.53,.62,.6]);
  for (const sign of [-1,1]) {
    fin([[.15,-.023,.077*sign],[-.12,-.075,.19*sign],[-.035,-.077,.07*sign]], [.45,.59,.6]);
    // A small silver iris and inset-looking dark pupil replace the flat black bead.
    for (const part of [2,3]) {
      const pupil = part === 3;
      const eye = new SphereGeometry(pupil ? .0075 : .0135, 8, 6);
      eye.scale(1, 1, pupil ? .45 : .35);
      eye.translate(.284,.035,(pupil ? .065 : .060)*sign);
      const tint: V3 = pupil ? [.009,.017,.022] : [.24,.34,.32];
      const p = eye.getAttribute('position'), index = eye.getIndex(), start = positions.length / 3;
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i),p.getY(i),p.getZ(i)); colors.push(...tint);
        skinUV.push(0,0); parts.push(part);
      }
      if (index) for (let i = 0; i < index.count; i++) indices.push(start + index.getX(i));
      eye.dispose();
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setAttribute('skinUV',new Float32BufferAttribute(skinUV,2));
  geometry.setAttribute('fishPart',new Float32BufferAttribute(parts,1));
  geometry.setIndex(indices); geometry.scale(1,.72,1); geometry.computeVertexNormals();
  return geometry;
}

/** Ribbons grow from the seabed; bend is applied on the GPU. */
export function grassGeometry(): BufferGeometry {
  const p: number[] = [], uv: number[] = [], ix: number[] = [];
  for (let i=0;i<=7;i++) {
    const t=i/7,w=.075*Math.pow(1-t,.8)+.002;
    p.push(-w,t,0,w,t,0); uv.push(0,t,1,t);
    if(i<7) {const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}

export function seabedHeight(x:number,z:number):number {
  return -.45 + Math.sin(x*.11)*.2 + Math.sin(z*.08+x*.07)*.22;
}
export const sunDirection = new Vector3(-.35, .86, .24).normalize();
