// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {createKoi} from './koi';
import {createFrog} from './frog';
import {fishSpecies} from './fish-species';
import {createFishMotion} from './fish-motion';
import {createInsects} from './insects';
import {createLilies} from './lilies';
import {rng,tau,uTime} from './shared';
export async function createLife(scene:T.Scene,ripple:(x:number,z:number,strength?:number)=>void){
 const r=rng(928),count=8,seeds=new Float32Array(count);
 for(let i=0;i<count;i++){seeds[i]=r()*tau;}
 const fish=await createKoi(scene,seeds);
 const sizes=Array.from({length:count},(_,i)=>{const [min,max]=fishSpecies[i%fishSpecies.length]!.scale;return T.MathUtils.lerp(min,max,r());});
 const motion=createFishMotion(seeds,sizes),positions=motion.states.map(s=>s.position),d=new T.Object3D(),feed=new T.Vector3();let fedAt=-100;
 const pellets=new T.InstancedMesh(new T.SphereGeometry(.026,6,4),new T.MeshStandardMaterial({color:'#c68d45',roughness:.75}),45);scene.add(pellets);pellets.visible=false;
 const pads=createLilies(scene);
 const frog=await createFrog(scene,pads,ripple),insects=createInsects(scene);
 return {fish,positions,frog,diagnostics(){return {fish:motion.snapshot(),frog:frog.diagnostics(),insects:insects.counts,striders:insects.diagnostics()};},feed(x:number,z:number){feed.set(x,-.2,z);fedAt=uTime.value;ripple(x,z,1);pellets.visible=true;},update(dt:number,activity:number,breeze:number){const time=uTime.value;
 motion.update(dt,time,activity,time-fedAt<12?feed:null);
 motion.states.forEach((s,i)=>{fish.setMotionAt(i,s.stroke,s.effort,s.bank);d.position.copy(s.position);d.rotation.order='YXZ';d.rotation.set(s.bank*.12,-s.yaw,T.MathUtils.clamp(s.pitch,-.4,.4));d.scale.setScalar(sizes[i]!);d.updateMatrix();fish.setMatrixAt(i,d.matrix);});fish.updateInstances();
 if(pellets.visible){const age=time-fedAt;for(let i=0;i<45;i++){const a=i*2.4,rad=.12+Math.sqrt(i/45)*.6;d.position.set(feed.x+Math.cos(a)*rad,.035-Math.max(0,age-3)*.026,feed.z+Math.sin(a)*rad);d.scale.setScalar(Math.max(.01,1-age/11));d.updateMatrix();pellets.setMatrixAt(i,d.matrix);}pellets.instanceMatrix.needsUpdate=true;if(age>11)pellets.visible=false;}
 pads.forEach((p,i)=>{p.position.y=.047+Math.sin(time*1.1+i)*.013;p.rotation.x=Math.sin(time*.65+i)*.016;p.rotation.z=Math.cos(time*.8+i)*.016;});frog.update(time);insects.update(dt,time,breeze);
},get feedActive(){return uTime.value-fedAt<12;},lilyTarget:new T.Vector3(-5.2,0,2.7)};
}
