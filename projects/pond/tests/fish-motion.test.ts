// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import * as T from 'three';
import {createFishMotion} from '../src/fish-motion.ts';
const seeds=new Float32Array([.2,1,2,3,3.6,4.5,5.2,6]);
const sizes=[.2,.19,.18,.49,.2,.19,.18,.49];

test('independent destinations, depth variation and bounded continuous movement for two minutes',()=>{
 const motion=createFishMotion(seeds,sizes),low=Array(8).fill(Infinity),high=Array(8).fill(-Infinity);
 for(let frame=1;frame<=7200;frame++){
  const before=motion.states.map(s=>s.position.clone());motion.update(1/60,frame/60,1,null);
  motion.states.forEach((s,i)=>{
   assert.ok(s.position.distanceTo(before[i]!)<.02,'no teleport');
   assert.ok(Math.hypot(s.position.x/8,s.position.z/6)<1,'inside pond');
   assert.ok(s.position.y<-.30&&s.position.y>-1.55,'under surface, above bottom');
   low[i]=Math.min(low[i],s.position.y);high[i]=Math.max(high[i],s.position.y);
  });
 }
 assert.equal(new Set(motion.states.map(s=>s.target.toArray().join(','))).size,8);
 motion.states.forEach((s,i)=>{assert.ok(s.choices>=5);assert.ok(high[i]-low[i]>.25,'meaningful individual depth change');});
});
test('feeding changes destinations once, zero dt preserves all simulation state',()=>{
 const motion=createFishMotion(seeds,sizes);motion.update(.016,1,1,null);
 const before=JSON.stringify(motion.snapshot());motion.update(0,10,1,new T.Vector3(0,-.5,0));assert.equal(JSON.stringify(motion.snapshot()),before);
 const choices=motion.states.map(s=>s.choices);motion.update(.016,2,1,new T.Vector3(0,-.5,0));
 motion.states.forEach((s,i)=>{assert.equal(s.choices,choices[i]!+1);assert.ok(Math.hypot(s.target.x,s.target.z)<1.11);});
});


test('propulsion and glide alternate independently without snapping effort or position',()=>{
 const motion=createFishMotion(seeds,sizes),driven=Array(8).fill(0),coasts=Array(8).fill(0);
 let mixed=false;
 for(let frame=1;frame<=1800;frame++){
  const prev=motion.states.map(s=>({effort:s.effort,speed:s.speed,position:s.position.clone()}));
  motion.update(1/60,frame/60,1,null);
  mixed ||= new Set(motion.states.map(s=>s.propelling)).size>1;
  motion.states.forEach((s,i)=>{
   if(s.propelling)driven[i]++;else coasts[i]++;
   assert.ok(Math.abs(s.effort-prev[i]!.effort)<.065,'continuous tail amplitude');
   assert.ok(Math.abs(s.speed-prev[i]!.speed)<.03,'continuous forward speed');
   assert.ok(s.position.distanceTo(prev[i]!.position)<.02,'no movement jump');
  });
 }
 assert.ok(mixed,'fish do not beat and rest in lockstep');
 driven.forEach((n,i)=>{assert.ok(n>100);assert.ok(coasts[i]>100);});
});
