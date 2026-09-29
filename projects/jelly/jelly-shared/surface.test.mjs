import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {SoftBody,createSkin} from '../citrus/physics.js';
import {makeMesh,watermelon,cutPolygon} from '../melon/geometry.js';
import {updateNormals} from './surface.js';
test('packed skin preserves weighted surface positions and cache isolates mutable buffers',()=>{
 const meshes=[new SoftBody().mesh,...cutPolygon(watermelon(),[0,-3],[0,3]).map(makeMesh)];
 for(const mesh of meshes){
  const skin=createSkin(mesh),other=createSkin({...mesh,rest:Float64Array.from(mesh.rest,x=>x+1)});
  assert.notEqual(skin.positions,other.positions);assert.notEqual(skin.rest,other.rest);
  const before=other.positions.slice();
  for(let frame=0;frame<30;frame++){
   const p=Float64Array.from(mesh.rest,(x,i)=>x+.08*Math.sin(i*.23+frame*.17));skin.update(p);
   const expected=new Float32Array(skin.positions.length);
   for(let i=0;i<skin.weights.length;i++)for(let k=0;k<3;k++)expected[i*3+k]=skin.weights[i].reduce((sum,[id,w])=>sum+p[id*3+k]*w,0);
   assert.deepEqual(skin.positions,expected);
  }
  assert.deepEqual(other.positions,before);
  for(let i=0;i<skin.rest.length;i++)assert.ok(Math.abs(other.rest[i]-skin.rest[i]-1)<3e-7);
 }
});
test('specialized normals match Three for evolving curved surfaces and degenerate faces',()=>{
 const skin=createSkin(new SoftBody().mesh),out=new Float32Array(skin.positions.length);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(skin.positions,3));geometry.setIndex(skin.indices);
 for(let frame=0;frame<80;frame++){
  for(let i=0;i<skin.positions.length;i++)skin.positions[i]=skin.rest[i]+.04*Math.sin(i*.33+frame*.1);
  geometry.computeVertexNormals();updateNormals(skin.positions,skin.indices,out);
  assert.deepEqual(out,geometry.attributes.normal.array);
 }
 assert.deepEqual(updateNormals(new Float32Array(9),new Uint32Array([0,1,2]),new Float32Array(9)),new Float32Array(9));
});
