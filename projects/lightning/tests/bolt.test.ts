// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDischarge,pulse,exposurePulse,MAX_STROKES,type Point} from '../src/bolt.ts';
const source:Point=[.2,3.8,-.1],target:Point=[1,0,1];
test('same seed reproduces topology and stroke timing; a new seed varies both',()=>{
 const a=createDischarge(42,source,target,.6),b=createDischarge(43,source,target,.6);
 assert.deepEqual(a,createDischarge(42,source,target,.6));
 assert.notDeepEqual(a.segments,b.segments);assert.notDeepEqual(a.strokes,b.strokes);
});
test('branching spans a bare trunk to a rich canopy without changing the main strike',()=>{
 let sparseLength=0,richLength=0,sparseCount=0,richCount=0;
 const length=(bolt:ReturnType<typeof createDischarge>)=>bolt.segments.filter(s=>s.branch>0).reduce((sum,s)=>sum+Math.hypot(s.to[0]-s.from[0],s.to[1]-s.from[1],s.to[2]-s.from[2]),0);
 for(let seed=0;seed<100;seed++){
  const bare=createDischarge(seed,source,target,0),sparse=createDischarge(seed,source,target,.15),rich=createDischarge(seed,source,target,1);
  assert.ok(bare.segments.every(s=>s.branch===0));
  assert.deepEqual(bare.segments,rich.segments.filter(s=>s.branch===0));
  assert.deepEqual(bare.strokes,rich.strokes);
  sparseLength+=length(sparse);richLength+=length(rich);
  sparseCount+=sparse.segments.filter(s=>s.branch>0).length;richCount+=rich.segments.filter(s=>s.branch>0).length;
 }
 assert.ok(richCount>sparseCount*4,'high branching must be visibly denser');
 assert.ok(richLength>sparseLength*5,'high branching must also reach farther');
});
test('primary channel joins continuously and attaches at the exact electrode',()=>{
 const main=createDischarge(12,source,target,.7).segments.filter(s=>s.branch===0);
 assert.deepEqual(main[0]!.from,source);assert.deepEqual(main.at(-1)!.to,target);
 for(let i=1;i<main.length;i++)assert.deepEqual(main[i-1]!.to,main[i]!.from);
 assert.ok(main.at(-1)!.arrival<main.at(-1)!.delay,'the connecting streamer grows upward');
});
test('1,000 seeds stay finite, tapered and within the geometry budget',()=>{
 let singles=0,longChains=0;
 for(let seed=0;seed<1000;seed++){
  const bolt=createDischarge(seed,source,target,1);assert.ok(bolt.segments.length<=1750);
  for(const s of bolt.segments){
   assert.ok([...s.from,...s.to,...s.previous,...s.next,s.width,s.endWidth,s.delay,s.arrival].every(Number.isFinite));
   assert.ok(s.width>0&&s.endWidth>0);assert.ok(s.delay>=0&&s.arrival>=0);assert.ok(s.branch<=2);
   assert.ok(Math.max(s.delay,s.arrival)<=bolt.leaderDuration+1e-9);
   if(s.branch>0)assert.ok(s.endWidth<=s.width);
  }
  assert.ok(bolt.strokes.length>=1&&bolt.strokes.length<=MAX_STROKES);
  for(let i=1;i<bolt.strokes.length;i++)assert.ok(bolt.strokes[i]!.time>bolt.strokes[i-1]!.time+.02);
  const span=bolt.strokes.at(-1)!.time-bolt.leaderDuration;
  if(bolt.strokes.length===1)singles++;
  if(bolt.strokes.length>5){
   longChains++;assert.ok(span>=.65&&span<=1.300001);
   const last=bolt.strokes.at(-1)!;
   assert.ok(pulse(last.time+.005,bolt)>.2,'late return remains visible');
   assert.ok(pulse(last.time+.005,bolt,0,true)<.0001,'failed forks stay dark');
   assert.ok(pulse(last.time+1,bolt)<.0001,'long chain does not remain lit');
  }
 }
 assert.ok(singles>150&&singles<300,'isolated flashes remain in the mixture');
 assert.ok(longChains>250&&longChains<420,'long chains appear regularly, not on every strike');
});
test('no return stroke before attachment; failed branches do not re-ignite',()=>{
 const bolt=createDischarge(42,source,target,.7);assert.ok(bolt.strokes.length>1);
 assert.equal(pulse(-1,bolt),0);assert.equal(pulse(bolt.leaderDuration-.001,bolt),0);
 const time=bolt.strokes.at(-1)!.time+.002;
 assert.ok(pulse(time,bolt)>.2);
 assert.ok(pulse(time,bolt,0,true)<.03);
 assert.ok(pulse(2,bolt)<.0001);
});
test('shutter integration captures short flashes between frames at 30/60/120 Hz',()=>{
 const decay=.002,start=.0237;
 for(const fps of [30,60,120]){
  const dt=1/fps;let energy=0;
  for(let t=dt;t<1;t+=dt)energy+=exposurePulse(t-start,decay,dt)*dt;
  assert.ok(Math.abs(energy-decay)<1e-10,`${fps} Hz preserves pulse energy`);
 }
 assert.equal(exposurePulse(-.001,decay,.016),0);
 assert.equal(exposurePulse(0,decay,0),1);
});
