// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {random,createDischarge,pulse,type Point} from '../src/bolt.ts';
import {CLOUD_HEIGHT,createCloudPose,updateCloudPose,createCloudSourceSampler,cloudFlash} from '../src/cloud-field.ts';

test('1,000 origins span the cloud interior without repeating recent neighborhoods',()=>{
 const pose=createCloudPose(),sample=createCloudSourceSampler(random(18412)),history:Point[]=[];
 // Actual broad/upper lobes used by the density shader, before noise erosion.
 const lobes:[Point,Point][]=[[[0,-.12,0],[2.45,.8,1.65]],[[-1.35,.12,.45],[1.04,.78,1.07]],[[-.72,.66,-.48],[.97,1.16,.96]],[[.85,.42,.5],[1.05,.94,1.02]],[[1.6,-.04,-.3],[.92,.68,1.03]],[[.15,-.18,-1.05],[1.22,.65,.81]]];
 for(let i=0;i<1000;i++){
  updateCloudPose(pose,i*2.8,.32);
  const world=sample(pose),y=(world[1]-pose.offset[1])/pose.scale[1];
  const p:Point=[(world[0]-pose.offset[0])/pose.scale[0]-y*pose.shear,y,(world[2]-pose.offset[2])/pose.scale[2]];
  assert.ok(lobes.some(([c,r])=>Math.hypot((p[0]-c[0])/r[0],(p[1]-c[1])/r[1],(p[2]-c[2])/r[2])<.66),'origin left the inset cloud interior');
  for(let ago=1;ago<=Math.min(2,history.length);ago++){
   const old=history.at(-ago)!;
   assert.ok(Math.hypot(p[0]-old[0],p[1]-old[1],p[2]-old[2])>=(ago===1?1.05:.75)-1e-10);
  }
  history.push(p);
 }
 assert.ok(Math.max(...history.map(p=>p[0]))-Math.min(...history.map(p=>p[0]))>3);
 assert.ok(Math.max(...history.map(p=>p[1]))-Math.min(...history.map(p=>p[1]))>1.1);
 assert.ok(Math.max(...history.map(p=>p[2]))-Math.min(...history.map(p=>p[2]))>1.5);
});
test('cloud motion is smooth, bounded and repeatable at the same simulation time',()=>{
 const pose=createCloudPose(),same=createCloudPose();let previous:Point|undefined;
 for(let i=0;i<6000;i++){
  updateCloudPose(pose,i/60,1);updateCloudPose(same,i/60,1);
  assert.deepEqual(pose,same);
  assert.ok(Math.abs(pose.offset[0])<=.32&&Math.abs(pose.offset[1]-CLOUD_HEIGHT)<=.071&&Math.abs(pose.offset[2])<=.15);
  assert.ok(pose.scale.every(s=>s>.95&&s<1.05));
  if(previous)assert.ok(Math.hypot(...pose.offset.map((n,j)=>n-previous![j]!))<.003);
  previous=[...pose.offset];
 }
});
test('internal glow follows every return stroke, stays brief, and cannot fire early',()=>{
 for(let seed=0;seed<100;seed++){
  const strike=createDischarge(seed,[1,4.5,.2],[0,.77,0],.68);
  assert.equal(cloudFlash(strike.leaderDuration-.001,strike),0);
  assert.ok(cloudFlash(strike.leaderDuration+.035,strike)>pulse(strike.leaderDuration+.035,strike));
  for(const s of strike.strokes)assert.ok(cloudFlash(s.time+.012,strike,1/60)>.1);
  assert.ok(cloudFlash(strike.strokes.at(-1)!.time+1,strike)<.0001);
 }
});
