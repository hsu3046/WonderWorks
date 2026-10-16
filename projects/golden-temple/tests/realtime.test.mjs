import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RenderGate,realtimeOptions,postPlan,ResolutionBudget} from '../src/core/realtime.js';
import {clusterIndex,splitFoliage} from '../src/core/geometry-lod.js';
import {encodeSDF,decodeSDF,sdfKey} from '../src/core/sdf-cache.js';

test('offline and original preview retain full quality path',()=>{
  for(const mode of ['still','render'])assert.equal(realtimeOptions(new URLSearchParams(),mode,'preview').enabled,false);
  assert.equal(realtimeOptions(new URLSearchParams('opt=0'),'dev','preview').enabled,false);
  assert.equal(realtimeOptions(new URLSearchParams(),'dev','final').enabled,false);
  assert.equal(realtimeOptions(new URLSearchParams(),'dev','preview').enabled,true);
});
test('reflection/shadow refresh on movement, rate-limit animation and retain paused content',()=>{
  const gate=new RenderGate(50);
  assert.equal(gate.needs(0,1,'camera-a'),true);
  assert.equal(gate.needs(16,2,'camera-a'),false);
  assert.equal(gate.needs(20,2,'camera-b'),true);
  assert.equal(gate.needs(1000,2,'camera-b'),false);
  assert.equal(gate.needs(1001,3,'camera-b'),true);
  gate.invalidate();assert.equal(gate.needs(1002,3,'camera-b'),true);
});
test('post graph distinguishes no effects, clarity only, bloom and both',()=>{
  assert.deepEqual(postPlan(0,0),{down:0,up:false,local:false});
  assert.deepEqual(postPlan(0,.5),{down:4,up:false,local:true});
  assert.deepEqual(postPlan(.06,0),{down:7,up:true,local:false});
  assert.deepEqual(postPlan(.06,.5),{down:7,up:true,local:true});
});
test('SDF binary cache losslessly roundtrips typed geometry and rejects corruption',()=>{
  const g=new THREE.SphereGeometry(1,12,8);g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(.375),3));
  const data=encodeSDF(g),copy=decodeSDF(THREE,data);
  for(const name of ['position','normal','color'])assert.deepEqual(copy.attributes[name].array,g.attributes[name].array);
  assert.deepEqual([...copy.index.array],[...g.index.array]);
  assert.throws(()=>decodeSDF(THREE,data.slice(0,-4)));
  const bad=data.slice(0);new Uint32Array(bad,0,1)[0]=0;assert.throws(()=>decodeSDF(THREE,bad));
  assert.notEqual(sdfKey('x',null,[0,0,0],[1,1,1],.01,{}),sdfKey('x',null,[0,0,0],[1,1,1],.02,{}));
});
test('index LOD keeps source attributes immutable and emits valid nondegenerate faces',()=>{
  const g=new THREE.SphereGeometry(1,64,32), before=g.attributes.position.array.slice();
  const low=clusterIndex(g,.12);
  assert.ok(low.count<g.index.count);assert.ok(low.count>0);assert.deepEqual(g.attributes.position.array,before);
  for(let i=0;i<low.count;i+=3){const [a,b,c]=low.array.subarray(i,i+3);assert.ok(a<before.length/3&&b<before.length/3&&c<before.length/3);assert.notEqual(a,b);assert.notEqual(b,c);assert.notEqual(a,c);}
});
test('spatial batches preserve every foliage transform and paired shader attribute',()=>{
  const root=new THREE.Group(),g=new THREE.PlaneGeometry(1,1),n=2050;
  const custom=new Float32Array(n),m=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial(),n);m.name='leaves_maple_far';
  for(let i=0;i<n;i++){m.setMatrixAt(i,new THREE.Matrix4().makeTranslation(i*.1,0,0));custom[i]=i;}
  g.setAttribute('aFol',new THREE.InstancedBufferAttribute(custom,1));root.add(m);
  const cells=splitFoliage(root);assert.ok(cells.length>1);assert.equal(cells.reduce((s,c)=>s+c.total,0),n);
  const seen=new Set();for(const {mesh} of cells)for(let i=0;i<mesh.count;i++){const id=mesh.geometry.attributes.aFol.getX(i);seen.add(id);assert.ok(Math.abs(mesh.instanceMatrix.array[i*16+12]-id*.1)<.0001);}
  assert.equal(seen.size,n);
});


test('adaptive resolution has bounded scale and cooldown rather than frame-by-frame resizing',()=>{
  const b=new ResolutionBudget();for(let i=0;i<44;i++)assert.equal(b.observe(90,i*100),1);
  assert.equal(b.observe(90,4500),.9);
  for(let i=0;i<30;i++)assert.equal(b.observe(90,4600+i*10),.9);
  for(let i=0;i<600;i++)b.observe(90,9000+i*100);
  assert.equal(b.scale,.65);assert.equal(b.observe(NaN,80000),.65);
});
