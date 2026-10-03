// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {random} from './landscape.ts';

/** Irregular follicles and tapered, curved shafts remain attached to the muzzle as the head moves. */
export function addSquirrelWhiskers(parent:T.Group,skin:T.SkinnedMesh):void {
  const positions:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[];
  const point=new T.Vector3(),normal=new T.Vector3(),color=new T.Color();
  const dark=new T.Color('#655448'),light=new T.Color('#baae99'),segments=18,sides=5;
  skin.updateWorldMatrix(true,false);skin.skeleton.update();
  for(const sign of [-1,1]){
    // Independent seeds avoid a mirrored comb, while keeping the groom stable between loads.
    const rng=random(sign<0?4217:8611),count=sign<0?8:9;
    for(let strand=0;strand<count;strand++){
      const y=.006+rng()*.082,z=-1.266+rng()*.089;
      const ray=new T.Raycaster(new T.Vector3(sign*.45,y,z),new T.Vector3(-sign,0,0));
      const hit=ray.intersectObject(skin,false)[0];
      if(!hit)throw new Error('The squirrel whisker could not be fitted to its muzzle.');
      const start=hit.point.clone(),reach=.095+Math.pow(rng(),.65)*.22;
      const rise=(rng()-.58)*.22,sweep=(rng()-.48)*.19,curl=(rng()-.5)*.105;
      const end=start.clone().add(new T.Vector3(sign*reach,rise,sweep));
      const first=start.clone().add(new T.Vector3(sign*reach*.29,rise*.12+.018,-.027));
      const second=start.clone().add(new T.Vector3(sign*reach*.72,rise*.55+curl,sweep*.46-.013));
      const curve=new T.CubicBezierCurve3(start,first,second,end),frames=curve.computeFrenetFrames(segments,false);
      const thickness=.00085+rng()*.00065,tone=.24+rng()*.48,offset=positions.length/3;
      for(let i=0;i<=segments;i++){
        const t=i/segments,radius=thickness*Math.pow(1-t,.72)+.000025;curve.getPoint(t,point);
        color.copy(dark).lerp(light,tone*.70+Math.sin(t*Math.PI)*.22);
        for(let j=0;j<sides;j++){
          const angle=j/sides*Math.PI*2;
          normal.copy(frames.normals[i]!).multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i]!,Math.sin(angle));
          positions.push(point.x+normal.x*radius,point.y+normal.y*radius,point.z+normal.z*radius);
          normal.toArray(normals,normals.length);color.toArray(colors,colors.length);
          if(i<segments){const a=offset+i*sides+j,b=offset+i*sides+(j+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
        }
      }
    }
  }
  // World-space thickness naturally recedes with distance, unlike fixed one-pixel line segments.
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
  const whiskers=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.71}));
  whiskers.name='Curved muzzle whiskers';parent.add(whiskers);
}
