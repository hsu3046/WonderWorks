// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDischarge,random,type Point} from '../src/bolt.ts';
import {DOME_RADIUS,DOME_HEIGHT,domeHeight,domeNormal,domeClearance,visibleDomeContact} from '../src/conductor.ts';
test('contact position and normal use the rendered ellipsoid, including near the rim',()=>{
 for(let i=0;i<=100;i++){
  const radius=DOME_RADIUS*i/101,angle=i*.37;
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,p:Point=[x,domeHeight(x,z),z],n=domeNormal(p);
  assert.ok(Math.abs(domeClearance(p,p)-1)<1e-12);
  assert.ok(Math.abs(Math.hypot(...n)-1)<1e-12);
  assert.ok(n[1]>0);
  const outside:Point=[p[0]+n[0]*.01,p[1]+n[1]*.01,p[2]+n[2]*.01];
  assert.ok(domeClearance(outside,outside)>1);
 }
 assert.equal(domeHeight(0,0),DOME_HEIGHT);
});
test('250 strikes meet the metal along its normal without any channel penetrating it',()=>{
 const randomValue=random(7713);
 for(let seed=0;seed<250;seed++){
  const angle=randomValue()*Math.PI*2,radius=randomValue()*DOME_RADIUS*.99;
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,target:Point=[x,domeHeight(x,z),z],normal=domeNormal(target);
  const strike=createDischarge(seed,[.2,3.8,-.15],target,1,{normal,dome:true});
  const main=strike.segments.filter(s=>s.branch===0),last=main.at(-1)!;
  assert.deepEqual(last.to,target);
  const direction=last.from.map((v,i)=>v-target[i]!),length=Math.hypot(...direction);
  const alignment=direction.reduce((sum,v,i)=>sum+v/length*normal[i]!,0);
  assert.ok(alignment>.9999);
  for(const segment of strike.segments)assert.ok(domeClearance(segment.from,segment.to)>=1-1e-7,`seed ${seed}: branch ${segment.branch} entered metal`);
 }
});
test('automatic contacts remain visible from all allowed orbit bearings, heights and distances',()=>{
 // A positive normal/view dot product is the exact front-face criterion for
 // this convex conductor. Test low views and both ends of the random sector.
 for(let a=0;a<24;a++)for(const polar of [.45,1.52])for(const distance of [7.5,19]){
  const bearing=a*Math.PI/12;
  const eye:Point=[Math.cos(bearing)*Math.sin(polar)*distance,2.6+Math.cos(polar)*distance,Math.sin(bearing)*Math.sin(polar)*distance];
  for(const azimuth of [0,.25,.5,.75,1])for(const radius of [0,.5,1]){
   const p=visibleDomeContact(eye,azimuth,radius),normal=domeNormal(p);
   assert.ok(Math.abs(domeClearance(p,p)-1)<1e-12);
   const facing=normal.reduce((sum,n,i)=>sum+n*(eye[i]!-p[i]!),0);
   assert.ok(facing>0,'contact was hidden behind the ellipsoid');
   assert.ok(p[0]*eye[0]+p[2]*eye[2]>0,'contact was on the far shoulder');
  }
 }
});
