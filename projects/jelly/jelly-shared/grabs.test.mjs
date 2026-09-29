import test from 'node:test';import assert from 'node:assert/strict';
import {GrabContacts} from './grabs.js';import {SoftBody} from '../citrus/physics.js';
import {watermelon,makeMesh} from '../melon/geometry.js';
import {PieceActivity} from '../melon/activity.js';
function canvas(){const captured=new Set();return {setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture(id){captured.delete(id);this.onlost?.(id);}};}
const advance=(b,n=120)=>{for(let i=0;i<n;i++)b.step(1/240);};
test('separate bodies retain independent capture/planes and ending one leaves the other held',()=>{
 const c=canvas(),contacts=new GrabContacts(c),a=new SoftBody(),b=new SoftBody();c.onlost=id=>contacts.end(id);
 const planeA={},planeB={};assert.equal(contacts.begin(11,a,[0,.6,0],planeA),true);assert.equal(contacts.begin(22,b,[.2,.6,0],planeB),true);
 assert.equal(contacts.get(11).plane,planeA);assert.equal(contacts.get(22).plane,planeB);
 contacts.end(11);assert.equal(a.grabs.size,0);assert.equal(b.grabs.size,1);assert.equal(c.hasPointerCapture(22),true);
 assert.equal(contacts.end(11),false);contacts.clear();assert.equal(contacts.size,0);assert.equal(b.grab,null);
});
test('two hands on one body survive partial release, regrab and reset',()=>{
 const b=new SoftBody(),contacts=new GrabContacts(canvas());contacts.begin(1,b,[-.8,.6,0],{});contacts.begin(2,b,[.8,.6,0],{});
 b.moveGrab([-1.1,1.1,0],1);b.moveGrab([1.1,1.4,0],2);advance(b);
 const second=b.grabs.get(2);assert.ok(second.current[1]>.7);contacts.end(1);assert.equal(b.grabs.get(2),second);
 b.moveGrab([.9,1.8,0],2);advance(b);assert.ok(second.current[1]>1.4);
 assert.equal(contacts.begin(3,b,[-.5,1,0],{}),true);contacts.clear();b.reset();assert.equal(b.grabs.size,0);assert.deepEqual(b.p,b.rest);
});
test('overlapping hands are independent of insertion order and remain bounded',()=>{
 const a=new SoftBody(),b=new SoftBody(),points=[[0,.6,0],[.02,.6,0],[.01,.61,0]];
 for(const id of[0,1,2])a.beginGrab(points[id],id);for(const id of[2,1,0])b.beginGrab(points[id],id);
 for(let frame=0;frame<180;frame++){
  for(let id=0;id<3;id++){const target=[Math.sin(frame*.04+id)*2,.7+id*.7,Math.cos(frame*.04+id)];a.moveGrab(target,id);b.moveGrab(target,id);}
  a.step();b.step();
 }
 assert.equal(a.metrics().inverted,0);assert.equal(b.metrics().inverted,0);
 for(let i=0;i<a.p.length;i++)assert.ok(Math.abs(a.p[i]-b.p[i])<1e-7);
});
test('ten changing contacts remain finite and non-inverted for citrus and melon at stiffness extremes',()=>{
 for(const mesh of [undefined,makeMesh(watermelon())])for(const firmness of [0,1]){
  const b=new SoftBody(mesh);b.firmness=firmness;
  for(let id=0;id<10;id++)b.beginGrab([Math.cos(id)*.7,.56,Math.sin(id)*.5],id);
  assert.equal(b.beginGrab([0,.6,0],11),false);
  for(let frame=0;frame<240;frame++){
   for(let id=0;id<10;id++)b.moveGrab([Math.sin(frame*.08+id)*3,.5+(id%4),Math.cos(frame*.07+id)*2.6],id);
   b.step();assert.equal(b.metrics().inverted,0);
  }
  b.endGrab();advance(b);assert.ok(b.p.every(Number.isFinite));assert.equal(b.grab,null);
 }
});
test('capture failure rolls back only that contact; active remaining hand prevents sleep',()=>{
 const b=new SoftBody(makeMesh(watermelon())),c=canvas(),contacts=new GrabContacts(c),activity=new PieceActivity(b);
 contacts.begin(1,b,[0,.56,0],{});c.setPointerCapture=()=>{throw Error('inactive pointer');};
 assert.equal(contacts.begin(2,b,[.4,.56,0],{}),false);assert.equal(b.grabs.size,1);
 activity.sleeping=true;activity.step(1/120);assert.equal(activity.sleeping,false);
 contacts.clear();assert.equal(b.grabs.size,0);
});
