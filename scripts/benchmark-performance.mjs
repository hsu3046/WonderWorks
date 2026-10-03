// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// CPU microbenchmarks, not GPU time or end-to-end frame rate.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as after from '../projects/jelly/citrus/physics.js';
import {createLeafCounter,leafStage,species} from '../projects/foliage/src/state.ts';
if(!process.argv[2])throw new Error('Usage: node scripts/benchmark-performance.mjs /absolute/path/to/baseline-physics.js');
const before=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(process.argv[2])).toString('base64'));
const a=new before.SoftBody(),b=new after.SoftBody();
a.nudge();b.nudge();for(let i=0;i<600;i++){if(i===100){a.beginGrab([1.5,.4,0]);b.beginGrab([1.5,.4,0]);}if(i>100&&i<230){const p=[1.5,1+Math.sin(i*.05)*.4,Math.cos(i*.03)*.3];a.moveGrab(p);b.moveGrab(p);}if(i===230){a.endGrab();b.endGrab();}a.step();b.step();}
const maxPositionError=Math.max(...b.p.map((v,i)=>Math.abs(v-a.p[i]))),maxVelocityError=Math.max(...b.v.map((v,i)=>Math.abs(v-a.v[i])));assert.ok(maxPositionError<1e-6);assert.ok(maxVelocityError<1e-5);
function median(times){return [...times].sort((a,b)=>a-b)[Math.floor(times.length/2)];}
function run(module){const body=new module.SoftBody();body.nudge();const t=performance.now();for(let i=0;i<480;i++)body.step();return performance.now()-t;}
run(before);run(after);run(before);run(after); // Warm both JIT paths before sampling.
const old=[],next=[];for(let i=0;i<9;i++){if(i%2){next.push(run(after));old.push(run(before));}else{old.push(run(before));next.push(run(after));}}
const seeds=Float32Array.from({length:26000},(_,i)=>((i+1)*.61803398875)%1),counter=createLeafCounter(seeds);
function oldCounter(y,w,e,s){let attached=0,air=0,ground=0;for(const seed of seeds){const p=leafStage(y,seed,w,e,s);if(!p.visible)continue;if(p.flight===0)attached++;else if(p.flight<1)air++;else ground++;}return {attached,air,ground};}
for(const s of species)for(let i=0;i<=100;i++)for(const e of [0,7,120])assert.deepEqual(counter(i/100,.28,e,s),oldCounter(i/100,.28,e,s));
function countBench(fn){const t=performance.now();for(let i=0;i<100;i++)fn(.70+i*.002,.28,7,'cherry');return performance.now()-t;}
countBench(oldCounter);countBench(counter);
const co=[],cn=[];for(let i=0;i<9;i++){if(i%2){cn.push(countBench(counter));co.push(countBench(oldCounter));}else{co.push(countBench(oldCounter));cn.push(countBench(counter));}}
const report={environment:process.version,physics:{steps:480,tets:b.tets.length,maxPositionErrorAfter600Steps:maxPositionError,maxVelocityErrorAfter600Steps:maxVelocityError,beforeMs:old,afterMs:next,beforeMedian:median(old),afterMedian:median(next)},leafCount:{leaves:26000,batches:100,identicalStates:5*101*3,beforeMs:co,afterMs:cn,beforeMedian:median(co),afterMedian:median(cn)}};
console.log(JSON.stringify(report,null,2));
