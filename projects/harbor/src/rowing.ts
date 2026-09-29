// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import type { BoatPose } from './navigation';

/** Separate the two exported oars by connected geometry, preserving the original timber. */
export function rigOars(root:T.Object3D){
 const pivots=[-1,1].map(side=>{const pivot=new T.Group();pivot.name=side<0?'StarboardOar':'PortOar';pivot.position.set(side*.68,.37,.14);return {side,pivot};});
 const meshes:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&/^Rowboat_(cedar|wood)$/.test(o.name))meshes.push(o);});
 let pieces=0;
 for(const mesh of meshes){
  const g=mesh.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),parent=Int32Array.from({length:p.count},(_,i)=>i),weld=new Map<string,number>();
  const find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const join=(a:number,b:number)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');const old=weld.get(key);if(old===undefined)weld.set(key,i);else join(i,old);}
  const indices=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i);
  for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
  const sides=new Map<number,number>();
  for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>.95)sides.set(find(i),Math.sign(p.getX(i)));
  const buckets=new Map<number,number[]>([[-1,[]],[0,[]],[1,[]]]);
  for(const i of indices)buckets.get(sides.get(find(i))??0)!.push(i);
  function geometry(ids:number[]){const pos=new Float32Array(ids.length*3),norm=new Float32Array(ids.length*3);ids.forEach((id,i)=>{pos.set([p.getX(id),p.getY(id),p.getZ(id)],i*3);norm.set([n.getX(id),n.getY(id),n.getZ(id)],i*3);});const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(norm,3));return out;}
  mesh.geometry=geometry(buckets.get(0)!);
  for(const {side,pivot} of pivots){const ids=buckets.get(side)!;if(!ids.length)continue;const part=new T.Mesh(geometry(ids).translate(-pivot.position.x,-pivot.position.y,-pivot.position.z),mesh.material);part.name=`${pivot.name}_${mesh.name}`;pivot.add(part);mesh.parent!.add(pivot);pieces++;}
  g.dispose();
 }
 if(pieces!==4)throw new Error(`Expected four oar components, found ${pieces}`);
 let phase=0,lastTime=0,effort=0;
 function update(time:number,pose:BoatPose){
  const dt=Math.max(0,Math.min(.05,time-lastTime));if(time<lastTime){phase=0;effort=0;}lastTime=time;
  const speed=Math.abs(pose.speed),wanted=T.MathUtils.smoothstep(speed,.015,1.3);
  effort+=(wanted-effort)*(1-Math.exp(-dt*3));phase+=dt*Math.PI*2*(.32+Math.min(speed,4.2)*.21);
  const direction=pose.speed<0?-1:1;
  for(const {side,pivot} of pivots){
   const stroke=phase+side*.045,strokePower=Math.cos(stroke),lift=Math.max(0,-strokePower);
   const turning=T.MathUtils.clamp(pose.turnRate*side*.65,-.3,.3);
   // Dip during the power stroke, lift clear of the water on the return stroke.
   pivot.rotation.set(0,side*Math.sin(stroke)*(.54+turning)*effort*direction,side*(-.30+.77*lift)*effort);
  }
 }
 return {update,get phase(){return phase;},get effort(){return effort;}};
}
