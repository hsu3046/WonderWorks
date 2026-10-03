// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {batchStaticMeshes} from '../src/world-batches.ts';
import {createBroadleafGrove} from '../src/tree-lod.ts';
import {terrainHeight} from '../src/landscape.ts';
import {createGroundDetailLOD} from '../src/prop-lod.ts';

test('static material batching preserves the world bounds and triangles of transformed architecture',()=>{
  const group=new T.Group(),a=new T.MeshStandardMaterial(),b=new T.MeshStandardMaterial();group.position.set(13,4,-22);group.rotation.y=.6;
  for(let i=0;i<3;i++){const sub=new T.Group();sub.position.set(i*5,i,0);sub.rotation.y=i*.3;const box=new T.Mesh(new T.BoxGeometry(2,4,3),i===2?b:a);box.position.z=3;sub.add(box);group.add(sub);}
  // Precise vertex bounds avoid conservative AABB inflation when rotated meshes are merged.
  group.updateMatrixWorld(true);const before=new T.Box3().setFromObject(group,true);let triangles=0;group.traverse(o=>{if(o instanceof T.Mesh)triangles+=o.geometry.index!.count/3;});
  batchStaticMeshes(group);group.updateMatrixWorld(true);const after=new T.Box3().setFromObject(group,true);
  assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6);assert.equal(group.children.length,2);
  assert.equal(group.children.reduce((sum,o)=>sum+(o as T.Mesh).geometry.index!.count/3,0),triangles);
});

test('ground details cull with hysteresis and restore their authored transforms',()=>{
  const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),3),a=new T.Matrix4().makeTranslation(0,0,0),b=new T.Matrix4().makeTranslation(120,0,0);
  mesh.setMatrixAt(0,a);mesh.setMatrixAt(1,b);mesh.setMatrixAt(2,new T.Matrix4().makeScale(0,0,0));const update=createGroundDetailLOD(mesh),camera=new T.Vector3(),matrix=new T.Matrix4();
  update(camera);assert.equal(mesh.count,1);const version=mesh.instanceMatrix.version;
  update(camera.set(10,0,0));assert.equal(mesh.instanceMatrix.version,version);
  update(camera.set(45,0,0));assert.equal(mesh.count,1);
  update(camera.set(50,0,0));assert.equal(mesh.count,0);
  update(camera.set(45,0,0));assert.equal(mesh.count,0);
  update(camera.set(120,0,0));assert.equal(mesh.count,1);mesh.getMatrixAt(0,matrix);assert.deepEqual(matrix.elements,b.elements);
  update(camera.set(0,0,0));mesh.getMatrixAt(0,matrix);assert.deepEqual(matrix.elements,a.elements);assert.equal(mesh.count,1);
});

test('grove LOD uses hysteresis and uploads instances only when membership changes',()=>{
  const source=new T.Group();source.add(new T.Mesh(new T.BoxGeometry(1,2,1).translate(0,1,0),new T.MeshStandardMaterial()));
  const grove=createBroadleafGrove(source,[{x:0,z:0,s:2,rot:.3},{x:220,z:0,s:1,rot:.5}],new T.Texture()),camera=new T.Vector3(0,terrainHeight(0,0)+6.6,0);
  grove.updateView(camera);assert.deepEqual(grove.counts(),{near:1,far:1});
  const mesh=grove.group.children[0] as T.InstancedMesh,version=mesh.instanceMatrix.version;
  grove.updateView(camera.clone().add(new T.Vector3(5,0,0)));assert.equal(mesh.instanceMatrix.version,version,'stable membership needs no buffer upload');
  grove.updateView(camera.clone().add(new T.Vector3(80,0,0)));assert.deepEqual(grove.counts(),{near:1,far:1});
  grove.updateView(camera.clone().add(new T.Vector3(96,0,0)));assert.deepEqual(grove.counts(),{near:0,far:2});
  grove.updateView(camera.clone().add(new T.Vector3(80,0,0)));assert.deepEqual(grove.counts(),{near:0,far:2});
  grove.updateView(camera.clone().add(new T.Vector3(70,0,0)));assert.deepEqual(grove.counts(),{near:1,far:1});
});
