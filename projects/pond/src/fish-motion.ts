// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {localSchooling} from './fish-school.ts';

/** Independent, seeded destinations: no shared orbit and no position teleport on turns. */
export function createFishMotion(seeds:Float32Array,sizes:readonly number[]){
 let seed=801;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const states=Array.from(seeds,(phase,i)=>{
  const angle=random()*Math.PI*2,rad=1.5+random()*3;
  return {position:new T.Vector3(Math.cos(angle)*rad,-.65-random()*.5,Math.sin(angle)*rad*.65),target:new T.Vector3(),yaw:phase,pitch:0,bank:0,speed:0,stroke:phase,effort:.4,until:0,cruise:.2+random()*.23,vertical:0,choices:0,index:i,propelling:true,strokeRemaining:.45+(phase%1.3)};
 });
 const bounds=(p:T.Vector3,size:number)=>{
  // Stay above the same sloping bed as garden.ts, including body/tail clearance.
  const rad=Math.hypot(p.x/10,p.z/7.5),floor=-1.65+Math.pow(rad,5)*1.85+.05;
  return [floor+size*.65+.10,-.20-size*.72] as const;
 };
 function choose(s:typeof states[number],time:number,feed:T.Vector3|null){
  const angle=random()*Math.PI*2;
  if(feed){const radius=.3+random()*.8;s.target.set(feed.x+Math.cos(angle)*radius,-.48-random()*.18,feed.z+Math.sin(angle)*radius);}
  else{
   const radius=1.2+Math.sqrt(random())*5.1;
   s.target.set(Math.cos(angle)*radius,-.45-random()*.85,Math.sin(angle)*radius*.67);
  }
  const [low,high]=bounds(s.target,sizes[s.index]!);s.target.y=T.MathUtils.clamp(s.target.y,low,high);
  s.cruise=.19+random()*.29;s.until=time+(feed?2+random()*3:9+random()*14);s.choices++;
 }
 const poses=new Float64Array(states.length*4),school={x:0,z:0};
 let wasFeeding=false;
 return {states,update(dt:number,time:number,activity:number,feed:T.Vector3|null){
  if(dt<=0)return;
  for(const s of states){const at=s.index*4;poses[at]=s.position.x;poses[at+1]=s.position.y;poses[at+2]=s.position.z;poses[at+3]=s.yaw;}
  for(const s of states){
   if(time>s.until||s.position.distanceToSquared(s.target)<.3||Boolean(feed)!==wasFeeding)choose(s,time,feed);
   const p=s.position;let dx=s.target.x-p.x,dz=s.target.z-p.z;
   // Snapshot-based boids steering stays weak; individual destinations and depth remain dominant.
   localSchooling(s.index,poses,school);const social=feed?.25:1;dx+=school.x*social;dz+=school.z*social;
   // Local avoidance is weak enough to preserve individual destinations.
   for(const other of states){if(other===s||Math.abs(p.y-poses[other.index*4+1]!)>.24+(sizes[s.index]!+sizes[other.index]!)*.25)continue;const x=p.x-poses[other.index*4]!,z=p.z-poses[other.index*4+2]!,d=x*x+z*z;if(d>.001&&d<.65){dx+=x*(.65-d)/d*.7;dz+=z*(.65-d)/d*.7;}}
   for(const [x,z] of [[5.7,2.3],[-6.3,-1.7]]){const ox=p.x-x!,oz=p.z-z!,d=ox*ox+oz*oz;if(d>.001&&d<2.3){dx+=ox*(2.3-d)/d;dz+=oz*(2.3-d)/d;}}
   const turn=Math.atan2(Math.sin(Math.atan2(dz,dx)-s.yaw),Math.cos(Math.atan2(dz,dx)-s.yaw));
   s.yaw+=T.MathUtils.clamp(turn,-dt*.95,dt*.95);
   s.bank=T.MathUtils.damp(s.bank,T.MathUtils.clamp(turn,-1,1),3,dt);
   // Independent propulsion/rest intervals, smoothed so fins never snap at a boundary.
   s.strokeRemaining-=dt*activity;
   if(s.strokeRemaining<=0){s.propelling=!s.propelling;s.strokeRemaining+=s.propelling?1.1+random()*.9:.55+random()*.8;}
   const driving=s.propelling||Boolean(feed),turnEffort=Math.min(1,Math.abs(turn))*.12;
   s.effort=T.MathUtils.damp(s.effort,(driving?.86:.27)+turnEffort,driving?4.5:2.8,dt);
   const sizeRate=T.MathUtils.clamp(Math.sqrt(.25/sizes[s.index]!),.7,1.3);
   s.stroke+=dt*(4.8+s.effort*8.0)*activity*sizeRate;
   const approach=Math.min(1,Math.hypot(dx,dz)/.9);
   const desired=s.cruise*activity*(feed?1.22:1)*(.48+.52*approach)*(1-.5*Math.min(1,Math.abs(turn)))*(driving?1:.38)*(1+.08*s.effort*Math.sin(s.stroke*2));
   s.speed=T.MathUtils.damp(s.speed,desired,driving?2.5:.65,dt);
   p.x+=Math.cos(s.yaw)*s.speed*dt;p.z+=Math.sin(s.yaw)*s.speed*dt;
   const [low,high]=bounds(p,sizes[s.index]!);
   const dy=T.MathUtils.clamp(s.target.y,low,high)-p.y;
   s.vertical=T.MathUtils.damp(s.vertical,T.MathUtils.clamp(dy*.45,-.11,.11)*activity,2,dt);
   p.y=T.MathUtils.clamp(p.y+s.vertical*dt,low,high);
   s.pitch=T.MathUtils.damp(s.pitch,Math.atan2(s.vertical,Math.max(.12,s.speed)),2.5,dt);
  }
  wasFeeding=Boolean(feed);
 },snapshot(){return states.map(s=>({position:s.position.toArray(),target:s.target.toArray(),choices:s.choices,speed:s.speed,propelling:s.propelling,effort:s.effort}));}};
}
