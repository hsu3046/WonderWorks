import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMorph,createMorphGeometry,morphPose} from '../src/morph.ts';
import {defaults} from '../src/state.ts';

test('one opaque set of three surfaces survives every scene and the loop boundary',()=>{
 const morph=createMorph({...defaults}),meshes=[...morph.group.children],geometry=meshes[0].geometry;
 for(let time=0;time<=50;time+=.1){
  morph.update(time,9);
  assert.deepEqual(morph.group.children,meshes);
  for(const mesh of meshes){
   assert.equal(mesh.geometry,geometry);
   assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.depthWrite,true);
   assert.equal(mesh.material.opacity,1);
  }
 }
 morph.dispose();
});

test('every patch retains its incoming shape and placement through each handoff',()=>{
 const morph=createMorph({...defaults}),epsilon=1e-6;
 for(const boundary of [5,10,15,20,25,30,35,40,45,50]){
  morph.update(boundary-epsilon,9);
  const before=morph.group.children.map(m=>({kind:m.material.uniforms.uTo.value,
   shape:m.material.uniforms.uShapeB.value.toArray(),center:m.material.uniforms.uCenterB.value.toArray()}));
  morph.update(boundary+epsilon,9);
  morph.group.children.forEach((m,i)=>{
   const u=m.material.uniforms;assert.equal(u.uFrom.value,before[i].kind);
   u.uShapeA.value.toArray().forEach((n,j)=>assert.ok(Math.abs(n-before[i].shape[j])<2e-5));
   u.uCenterA.value.toArray().forEach((n,j)=>assert.ok(Math.abs(n-before[i].center[j])<2e-5));
  });
 }
 morph.dispose();
});

test('rotation interpolation stays finite through supported twists and all ribbon sections',()=>{
 const s={...defaults},morph=createMorph(s),axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),axisZ=new THREE.Vector3(0,0,1);
 function q(kind,shape,x,width){
  const result=new THREE.Quaternion().setFromAxisAngle(axisX,shape.z+(kind===1?x/width*shape.w:0));
  if(kind===0)result.multiply(new THREE.Quaternion().setFromAxisAngle(axisY,shape.w));
  if(kind===3)result.multiply(new THREE.Quaternion().setFromAxisAngle(axisZ,shape.w));
  if(kind===1)result.multiply(new THREE.Quaternion().setFromAxisAngle(axisZ,-Math.PI/2));
  return result;
 }
 for(const amplitude of [0,1,1.8])for(const twist of [0,.5,1,1.5,2.5]){
  s.amplitude=amplitude;s.twist=twist;
  for(let t=3.4;t<25;t+=.04){
   const state=morph.update(t,9);if(state.blend===0)continue;
   morph.group.children.forEach(m=>{
    const u=m.material.uniforms;
    for(const v of [-.5,0,.5]){
     const a=q(u.uFrom.value,u.uShapeA.value,u.uCenterA.value.x+v*u.uShapeA.value.y,9);
     const b=q(u.uTo.value,u.uShapeB.value,u.uCenterB.value.x+v*u.uShapeB.value.y,9);
     const norm=a.toArray().reduce((total,n,i)=>total+(n*(1-state.blend)+b.toArray()[i]*u.uRotationSign.value*state.blend)**2,0);
     assert.ok(norm>.01,`rotation degenerates at ${t}, twist ${twist}`);
    }
   });
  }
 }
 morph.dispose();
});

test('parametric angular seam closes exactly and indices address existing vertices',()=>{
 const g=createMorphGeometry(),a=g.getAttribute('address');
 for(let i=0;i<a.count;i+=97){
  assert.ok(Math.abs(Math.sin(a.getX(i))-Math.sin(a.getX(i+96)))<1e-6);
  for(const key of ['getY','getZ','getW'])assert.equal(a[key](i),a[key](i+96));
 }
 for(const index of g.index.array)assert.ok(index>=0&&index<a.count);
 g.dispose();
});


test('orbit spreads all three patches around a circle and wave keeps anchored bases',()=>{
 for(let t=-1.6;t<5;t+=.1){
  const orbit=Array.from({length:3},(_,i)=>morphPose('orbit',t,i,1,1,9));
  for(const p of orbit)assert.ok(Math.abs(Math.hypot(...p.center.slice(0,2))-2.15)<1e-12);
  for(let i=0;i<3;i++){
   const p=morphPose('wave',t,i,1,1,9);
   assert.ok(Math.abs(p.center[1]-p.shape[1]/2+2.2)<1e-12);
  }
 }
});
