import test from 'node:test';
import assert from 'node:assert/strict';
import {SoftBody,createCitrus,createSkin,STEP,signedVolume} from './physics.js';
const advance=(b,seconds)=>{for(let i=0;i<Math.round(seconds/STEP);i++)b.step();};
test('closed manifold cage, positive tetrahedra and normalized surface stencils',()=>{
 const mesh=createCitrus(),skin=createSkin(mesh),edges=new Map();
 for(const t of mesh.tets)assert.ok(signedVolume(mesh.rest,...t)>0);
 for(const[a,b,c]of mesh.faces)for(const[u,v]of[[a,b],[b,c],[c,a]]){const key=[u,v].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);}
 assert.ok([...edges.values()].every(n=>n===2));
 for(const weights of skin.weights)assert.ok(Math.abs(weights.reduce((s,[,w])=>s+w,0)-1)<1e-9);
 const moved=Float64Array.from(mesh.rest,(v,i)=>v+(i%3===0?2:0));skin.update(moved);
 for(let i=0;i<skin.positions.length;i++)assert.ok(Math.abs(skin.positions[i]-skin.rest[i]-(i%3===0?2:0))<1e-6);
});
test('gravity rests on floor, retains volume and dissipates motion',()=>{
 const b=new SoftBody();b.nudge();advance(b,8);const m=b.metrics();
 assert.ok(Math.abs(m.volume-1)<.01);assert.equal(m.inverted,0);assert.ok(m.motion<.01);
 for(let i=1;i<b.p.length;i+=3)assert.ok(b.p[i]>=.025-1e-8);
});
test('local lift deforms rather than uniformly scaling; release recovers',()=>{
 const b=new SoftBody();advance(b,1);b.beginGrab([1.5,.43,0]);b.moveGrab([1.5,1.5,0]);advance(b,1.2);
 const m=b.metrics();assert.ok(m.lift>.5);assert.equal(m.inverted,0);assert.ok(Math.abs(m.volume-1)<.035);
 const strains=b.edges.map(([a,c],i)=>Math.abs(Math.hypot(...[0,1,2].map(k=>b.p[a*3+k]-b.p[c*3+k]))/b.lengths[i]-1));
 assert.ok(Math.max(...strains)-Math.min(...strains)>.05);
 b.endGrab();advance(b,9);assert.ok(b.metrics().motion<.025);assert.ok(Math.abs(b.metrics().volume-1)<.01);
});
test('extreme changing drag at all firmness endpoints stays finite and non-inverted',()=>{
 for(const firmness of[0,.28,1]){
  const b=new SoftBody();b.firmness=firmness;advance(b,1);b.beginGrab([1.5,.43,0]);
  for(let i=0;i<1200;i++) {b.moveGrab([Math.sin(i*.013)*8,Math.sin(i*.023)*6,Math.cos(i*.009)*7]);b.step();assert.ok(b.p.every(Number.isFinite));assert.equal(b.metrics().inverted,0);}
  b.endGrab();advance(b,5);assert.equal(b.metrics().inverted,0);
 }
});
test('firmness changes deformation and damping removes internal motion independently',()=>{
 const strain=firmness=>{const b=new SoftBody();b.firmness=firmness;advance(b,1);b.beginGrab([1.5,.43,0]);b.moveGrab([1.5,1.5,0]);advance(b,2);return Math.max(...b.edges.map(([a,c],i)=>Math.abs(Math.hypot(...[0,1,2].map(k=>b.p[a*3+k]-b.p[c*3+k]))/b.lengths[i]-1)));};
 assert.ok(strain(0)>strain(1)*2);
 const energy=damping=>{const b=new SoftBody();b.damping=damping;for(let i=0;i<b.v.length;i++)b.v[i]=Math.sin(i*1.71)*.4;advance(b,.15);return b.v.reduce((s,v)=>s+v*v,0);};assert.ok(energy(1)<energy(0));
});
test('invalid input, cancellation and reset preserve a valid fresh state',()=>{
 const b=new SoftBody();assert.equal(b.beginGrab([NaN,0,0]),false);b.beginGrab([0,.58,0]);b.moveGrab([Infinity,0,0]);advance(b,.1);b.endGrab();assert.equal(b.grab,null);b.nudge();b.reset();assert.deepEqual(b.p,b.rest);assert.ok(b.v.every(x=>x===0));assert.equal(b.metrics().inverted,0);assert.equal(b.metrics().lift,0);
});

test('allocation-free volume retains the reference triple-product arithmetic',()=>{
 const sub=(p,a,b)=>[p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]];
 const mesh=createCitrus();
 for(let pose=0;pose<8;pose++){
  const p=Float64Array.from(mesh.rest,(v,i)=>v+Math.sin(i*1.71+pose)*pose*.11);
  for(const [a,b,c,d] of mesh.tets){const u=sub(p,b,a),v=sub(p,c,a),w=sub(p,d,a),n=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];
   assert.equal(signedVolume(p,a,b,c,d),(u[0]*n[0]+u[1]*n[1]+u[2]*n[2])/6);
  }
 }
});
