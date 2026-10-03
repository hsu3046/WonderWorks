// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import type {LocalAssets} from './assets';
import {SCENERY_SITES,FLOWER_BEDS,type LocalModel} from './local-scenery-layout.ts';
import {occupiedByScenery} from './local-scenery-layout.ts';
import {random,inClearing} from './landscape.ts';
import {renderedTerrainHeight} from './terrain-surface.ts';
import {createGroundDetailLOD} from './prop-lod.ts';
import {createWoodlandRill} from './woodland-rill.ts';

/** Bake node transforms once; all copies share compact geometry, textures and materials. */
function normalized(source:T.Group,size:number,axis:'x'|'y'){
 source.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(source),c=bounds.getCenter(new T.Vector3()),extent=bounds.getSize(new T.Vector3()),scale=size/extent[axis];
 if(!Number.isFinite(scale)||scale<=0)throw new Error('The supplied scenery has invalid bounds.');
 const parts:Array<{geometry:T.BufferGeometry;material:T.Material|T.Material[]}>=[];
 source.traverse(o=>{if(o instanceof T.Mesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.translate(-c.x,-bounds.min.y,-c.z);g.scale(scale,scale,scale);parts.push({geometry:g,material:o.material});}});
 return {parts,width:extent.x*scale,height:extent.y*scale,depth:extent.z*scale,scale};
}

export function createLocalScenery(assets:LocalAssets,stone:T.Material){
 const group=new T.Group();group.name='Scenery from supplied assets';const updates:Array<(camera:T.Vector3)=>void>=[],instances:T.InstancedMesh[]=[],counts:Partial<Record<LocalModel,number>>={},foundations:Array<{name:string;x:number;z:number;base:number;spread:number;dimensions:{width:number;height:number;depth:number};scale:number;radius:number;min:number[];max:number[]}>=[];
 const dummy=new T.Object3D(),cache=new Map<string,ReturnType<typeof normalized>>();
 function shape(name:LocalModel,size:number,axis:'x'|'y'){
  const key=`${name}-${size}-${axis}`;let value=cache.get(key);if(!value){value=normalized(assets.models[name],size,axis);cache.set(key,value);}return value;
 }
 for(const site of SCENERY_SITES){
  const {parts,width,height:heightExtent,depth,scale}=shape(site.model,site.size,site.axis),samples:number[]=[];
  // Footings follow the visible triangulated terrain, rather than an approximate noise surface.
  const footprint=site.model==='cherry'?1.05:Math.max(width,depth)*.49;
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;samples.push(renderedTerrainHeight(site.x+Math.cos(a)*footprint,site.z+Math.sin(a)*footprint));}
  // Enlarged irregular buildings need their actual feet, including rotated corners, checked too.
  const cos=Math.cos(site.yaw),sin=Math.sin(site.yaw),contactHeight=Math.min(1,heightExtent*.05);
  for(const part of parts){const p=part.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<=contactHeight){const x=site.x+p.getX(i)*cos+p.getZ(i)*sin,z=site.z-p.getX(i)*sin+p.getZ(i)*cos;samples.push(renderedTerrainHeight(x,z)-p.getY(i));}}
  samples.push(renderedTerrainHeight(site.x,site.z));const low=Math.min(...samples),base=Math.max(...samples)-.08;
  const model=new T.Group();model.name=`Supplied ${site.model}`;model.position.set(site.x,base,site.z);model.rotation.y=site.yaw;
  for(const p of parts){const mesh=new T.Mesh(p.geometry,p.material);mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);}group.add(model);
  // A low stone plinth closes the gap below rigid buildings on uneven hillsides.
  if(site.model==='bridge'){
   // Separate stone supports leave the arch and water beneath it open.
   for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*width*.44,z=sz*depth*.40,wx=site.x+x*Math.cos(site.yaw)+z*Math.sin(site.yaw),wz=site.z-x*Math.sin(site.yaw)+z*Math.cos(site.yaw),bottom=renderedTerrainHeight(wx,wz)-.35,height=Math.max(.2,base-bottom),foot=new T.Mesh(new T.BoxGeometry(1.15,height,1.15),stone);foot.position.set(wx,base-height/2,wz);foot.rotation.y=site.yaw;foot.receiveShadow=true;group.add(foot);}
  }else if(site.model!=='cherry'){const height=base-low+.5,plinth=new T.Mesh(new T.CylinderGeometry(Math.max(width,depth)*.52,Math.max(width,depth)*.56,height,site.model==='castle'?13:8),stone);plinth.position.set(site.x,base-height/2-.06,site.z);plinth.rotation.y=site.yaw;plinth.receiveShadow=true;group.add(plinth);}
  model.updateWorldMatrix(true,true);const worldBounds=new T.Box3().setFromObject(model,true);
  foundations.push({name:site.model,x:site.x,z:site.z,base,spread:base-low,dimensions:{width,height:heightExtent,depth},scale,radius:site.radius,min:worldBounds.min.toArray(),max:worldBounds.max.toArray()});counts[site.model]=(counts[site.model]??0)+1;
 }
 // Small flowers form irregular, leafy masses rather than isolated oversized flowerheads.
 const rng=random(20261003);
 for(const name of ['hydrangea','azalea'] as const){
  const flower=shape(name,name==='hydrangea'?.68:.57,'y'),matrices:T.Matrix4[]=[],positions:T.Vector3[]=[];
  FLOWER_BEDS.forEach(([cx,cz],bed)=>{for(let i=0;i<(name==='hydrangea'?12:18);i++){
   const a=i*2.399963+rng()*.5,r=Math.sqrt(rng())*1.8,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
   if(inClearing(x,z,14)||occupiedByScenery(x,z,.25))continue;
   const y=renderedTerrainHeight(x,z)-.035;dummy.position.set(x,y,z);dummy.rotation.set((rng()-.5)*.18,rng()*Math.PI*2,(rng()-.5)*.18);dummy.scale.setScalar(.82+rng()*.4);dummy.updateMatrix();matrices.push(dummy.matrix.clone());positions.push(dummy.position.clone());
  }if(bed<4&&name==='hydrangea'){const butterfly=shape('butterfly',.23,'x');for(const p of butterfly.parts){const mesh=new T.Mesh(p.geometry,p.material);mesh.position.set(cx+.4,renderedTerrainHeight(cx+.4,cz)+.58,cz);mesh.rotation.set(.2,bed*1.9,.15);group.add(mesh);}counts.butterfly=(counts.butterfly??0)+1;}});
  for(const p of flower.parts){const mesh=new T.InstancedMesh(p.geometry,p.material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name=`Supplied ${name} flowers`;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);instances.push(mesh);updates.push(createGroundDetailLOD(mesh,45,58));}
  counts[name]=positions.length;
 }
 group.add(createWoodlandRill());
 return {group,updateView:(camera:T.Vector3)=>updates.forEach(update=>update(camera)),diagnostics:()=>({placed:{...counts},visibleFlowers:instances.reduce((sum,m)=>sum+m.count,0),foundations})};
}
