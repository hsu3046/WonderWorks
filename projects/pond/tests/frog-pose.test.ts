// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {frogPose} from '../src/frog-pose.ts';

test('limbs progress from crouch to kick, tuck and reaching, then settle exactly',()=>{
 const w=[0,0,0,0];for(const [time,index] of [[.24,2],[.40,1],[.64,2],[.94,3]]){frogPose(time!,w);assert.ok(w[index!]!>.5);}
 frogPose(1.24,w);assert.deepEqual(w,[0,0,0,0]);frogPose(14,w);assert.deepEqual(w,[0,0,0,0]);
});
test('pose blends stay bounded and continuous throughout takeoff and landing',()=>{
 const w=[0,0,0,0],last=[0,0,0,0];for(let i=0;i<1400;i++){frogPose(i/1000,w);assert.ok(w.every(x=>x>=0&&x<=1));assert.ok(w.reduce((a,b)=>a+b,0)<=1);assert.ok(w.every((x,j)=>Math.abs(x-last[j]!)<.025));last.splice(0,4,...w);}
});

test('hind legs load fully before takeoff and release into a full kick',()=>{
 const w=[0,0,0,0];frogPose(.24,w);assert.equal(w[0]!+w[2]!,1);assert.equal(w[1],0);
 frogPose(.40,w);assert.deepEqual(w,[0,1,0,0]);
});
