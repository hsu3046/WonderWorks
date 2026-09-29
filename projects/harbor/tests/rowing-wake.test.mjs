import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rigOars} from '../src/rowing.ts';
import {createWake} from '../src/wake.ts';
const pose={x:3,z:16,heading:Math.PI/2,speed:2.6,turnRate:0};
const triangles=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
test('original GLB oars split without duplicating or losing hull triangles; pause and idle settle',async()=>{
 const bytes=await readFile(new URL('../public/models/rowboat.glb',import.meta.url));const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const original=triangles(scene),rig=rigOars(scene);
 assert.equal(triangles(scene),original);
 const port=scene.getObjectByName('PortOar'),starboard=scene.getObjectByName('StarboardOar');assert.equal(port.children.length,2);assert.equal(starboard.children.length,2);
 for(let i=1;i<=120;i++)rig.update(i/60,pose);const old=port.quaternion.clone();rig.update(2,pose);assert.ok(old.equals(port.quaternion));rig.update(2.05,pose);assert.ok(!old.equals(port.quaternion));
 for(let i=1;i<=240;i++)rig.update(2.05+i/60,{...pose,speed:0});assert.ok(rig.effort<.00001);assert.ok(Math.abs(port.rotation.y)<.00001);
});
test('wake history stays anchored during turns and expires while stopped',()=>{
 const scene=new T.Scene(),wake=createWake(scene),mesh=scene.getObjectByName('SoftSternRipples');wake.update(0,pose);const original=new T.Matrix4();mesh.getMatrixAt(0,original);
 wake.update(.5,{...pose,x:6,heading:1});const grown=new T.Matrix4();mesh.getMatrixAt(0,grown);assert.equal(grown.elements[12],original.elements[12]);assert.equal(grown.elements[14],original.elements[14]);
 wake.update(8,{...pose,speed:0});assert.ok(Array.from(mesh.geometry.attributes.power.array).every(x=>x===0));assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));wake.reset();wake.update(0,{...pose,speed:0});assert.ok(Array.from(mesh.geometry.attributes.power.array).every(x=>x===0));
});
test('spray emits only while travelling and does not advance when paused; reset clears drops',()=>{
 const scene=new T.Scene(),wake=createWake(scene),spray=scene.getObjectByName('BowSpray');
 wake.update(0,{...pose,speed:0});assert.ok(Array.from(spray.geometry.attributes.born.array).every(x=>x===-100));
 wake.update(.1,pose);const born=Array.from(spray.geometry.attributes.born.array);assert.equal(born.filter(x=>x>=0).length,4);
 wake.update(.1,pose);assert.deepEqual(Array.from(spray.geometry.attributes.born.array),born);
 wake.update(.2,{...pose,speed:0});assert.deepEqual(Array.from(spray.geometry.attributes.born.array),born);
 assert.ok(Array.from(spray.geometry.attributes.velocity.array).every(Number.isFinite));wake.reset();assert.ok(Array.from(spray.geometry.attributes.born.array).every(x=>x===-100));
});
