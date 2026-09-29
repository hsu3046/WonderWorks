import test from 'node:test';import assert from 'node:assert/strict';
import {SoftBody} from '../citrus/physics.js';import {watermelon,makeMesh} from './geometry.js';
import {PieceActivity} from './activity.js';import {separatePieces} from './collision.js';
const make=()=>new SoftBody(makeMesh(watermelon()));
const settle=a=>{for(let i=0;i<2400&&!a.sleeping;i++)a.step(1/120);assert.equal(a.sleeping,true);};
test('settled piece skips integration, resumes for a grab, nudge or changed parameter',()=>{
 const b=make(),a=new PieceActivity(b);settle(a);const p=b.p.slice();a.dirty=false;
 for(let i=0;i<100;i++)a.step(1/120);assert.deepEqual(b.p,p);assert.equal(a.dirty,false);
 b.beginGrab([b.p[0],b.p[1],b.p[2]]);a.step(1/120);assert.equal(a.sleeping,false);b.endGrab();settle(a);
 a.wake();b.nudge();a.step(1/120);assert.equal(a.sleeping,false);assert.notDeepEqual(b.p,p);
 settle(a);b.firmness=.9;a.wake();a.step(1/120);assert.equal(a.sleeping,false);
});
test('contact wakes sleeping participant while distant and asleep pairs stay asleep',()=>{
 const bs=[make(),make(),make()],activities=new Map(bs.map(b=>[b,new PieceActivity(b)]));
 for(const a of activities.values())settle(a);
 for(let i=0;i<bs[2].p.length;i+=3)bs[2].p[i]+=20;
 const options={isSleeping:b=>activities.get(b).sleeping,onContact:(a,b)=>{activities.get(a).wake();activities.get(b).wake();}};
 const first=bs[0].p.slice();separatePieces(bs,options);assert.deepEqual(bs[0].p,first);
 activities.get(bs[0]).wake();separatePieces(bs,options);
 assert.equal(activities.get(bs[1]).sleeping,false);assert.equal(activities.get(bs[2]).sleeping,true);assert.notDeepEqual(bs[0].p,first);
});
