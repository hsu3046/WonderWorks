// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {SCENERY_SITES,LOCAL_MODELS} from '../src/local-scenery-layout.ts';
import {CLEARINGS,ROUTE} from '../src/landscape.ts';
import {renderedTerrainHeight} from '../src/terrain-surface.ts';
import {woodlandRillGeometry} from '../src/woodland-rill.ts';
import {auditSceneryScale} from '../scripts/audit-scenery-scale.mjs';

test('transformed model dimensions and enlarged building contact points match the measured scale plan',async()=>{
 const {report,group}=await auditSceneryScale();group.updateMatrixWorld(true);
 for(let i=0;i<SCENERY_SITES.length;i++){
  const site=SCENERY_SITES[i],result=report.placements[i];
  if(site.model==='house')assert.equal(result.dimensions.height,20);
  if(site.model==='castle')assert.equal(result.dimensions.height,60);
  const model=group.children.filter(o=>o.name.startsWith('Supplied '))[i];
  const bounds=new T.Box3().setFromObject(model,true);
  assert.ok(Math.abs(bounds.max.y-bounds.min.y-result.dimensions.height)<.00001);
  assert.ok(Math.abs(site.radius-Math.hypot(result.dimensions.width,result.dimensions.depth)/2)<.00001);
  model.traverse(o=>{if(!(o instanceof T.Mesh))return;const p=o.geometry.attributes.position;for(let j=0;j<p.count;j++)if(p.getY(j)<=Math.min(1,result.dimensions.height*.05)){const v=new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);assert.ok(v.y-renderedTerrainHeight(v.x,v.z)>=-.081,`${site.model} foot enters the ground`);}});
  const path=new T.CatmullRomCurve3(ROUTE.map(p=>new T.Vector3(...p)),false,'centripetal');
  for(let j=0;j<=2000;j++){const v=path.getPointAt(j/2000);if(Math.hypot(v.x-site.x,v.z-site.z)<site.radius+2)assert.ok(v.y>bounds.max.y+2,`Flight intersects enlarged ${site.model}`);}
 }
 for(let i=0;i<SCENERY_SITES.length;i++)for(let j=i+1;j<SCENERY_SITES.length;j++){const a=SCENERY_SITES[i],b=SCENERY_SITES[j];assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>a.radius+b.radius+1.5,`${a.model} and ${b.model} overlap after scaling`);}
});

test('supplied landmarks leave landing pads open and the whole guided flight above their volumes',()=>{
 const path=new T.CatmullRomCurve3(ROUTE.map(p=>new T.Vector3(...p)),false,'centripetal');
 for(const s of SCENERY_SITES){
  assert.ok(renderedTerrainHeight(s.x,s.z)>10,`${s.model} must stand on land`);
  for(const c of CLEARINGS)assert.ok(Math.hypot(s.x-c.x,s.z-c.z)>s.radius+14,`${s.model} obstructs ${c.name}`);
  const height=s.model==='bridge'?s.size*.55:s.size,top=renderedTerrainHeight(s.x,s.z)+height+4;
  for(let i=0;i<=2000;i++){const p=path.getPointAt(i/2000);if(Math.hypot(p.x-s.x,p.z-s.z)<s.radius+2)assert.ok(p.y>top,`Flight intersects ${s.model}`);}
 }
});

test('processed scenery has bounded geometry, valid vertex references and self-contained image buffers',()=>{
 let total=0;
 for(const name of LOCAL_MODELS){
  const bytes=fs.readFileSync(new URL(`../public/assets/local/${name}.glb`,import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+length).toString()),binary=bytes.subarray(28+length);
  assert.deepEqual(j.extensionsRequired,['EXT_texture_webp']);
  for(const image of j.images){assert.equal(image.mimeType,'image/webp');const v=j.bufferViews[image.bufferView];assert.ok(v.byteOffset+v.byteLength<=binary.length);assert.equal(binary.subarray(v.byteOffset+8,v.byteOffset+12).toString(),'WEBP');}
  for(const m of j.meshes)for(const p of m.primitives){const a=j.accessors[p.indices],v=j.bufferViews[a.bufferView],count=j.accessors[p.attributes.POSITION].count;total+=a.count/3;for(let i=0;i<a.count;i++)assert.ok(binary.readUInt32LE(v.byteOffset+i*4)<count,`${name} has invalid compacted indices`);}
 }
 assert.ok(total<135000,'Scenery exceeds its shared-geometry budget');
});

test('the shallow bridge stream faces upward and clears the terrain through every triangle interior',()=>{
 const g=woodlandRillGeometry(),p=g.attributes.position!,indices=g.index!;
 for(let i=0;i<indices.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,indices.getX(i)),b=new T.Vector3().fromBufferAttribute(p,indices.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,indices.getX(i+2));assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).y>0);for(let u=0;u<=10;u++)for(let v=0;v<=10-u;v++){const q=a.clone().multiplyScalar(1-(u+v)/10).addScaledVector(b,u/10).addScaledVector(c,v/10);assert.ok(Math.abs(q.y-renderedTerrainHeight(q.x,q.z)-.12)<.00003);}}
 g.dispose();
});
