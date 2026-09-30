// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {settleAll} from './task-pool';
import {createModelLoader} from './model-loader';

/** Preserve authored proportions, UVs and material groups; place each model by its bounds. */
export async function createArchitecture(parent:T.Group){
 const loader=createModelLoader();
 // The smaller bridge footings sit in the near-side pond bed rather than on the surface.
 const specs=[
  {name:'bridge',file:'wooden-bridge-refined-v1-packed-v1',axis:'x' as const,size:6.6,base:-1.5,z:-5.7},
  {name:'gazebo',file:'wooden-gazebo-refined-v1-packed-v1',axis:'y' as const,size:7.2,base:.25,z:-11.3},
 ];
 return settleAll(specs.map(async spec=>{
  let asset;
  try{asset=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${spec.file}.glb`);}
  catch{throw new Error(`The ${spec.name} model could not load. Please reload the garden.`);}
  const model=asset.scene;model.name=`refined-${spec.name}`;
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  if(size[spec.axis]<=0)throw new Error(`The ${spec.name} model has invalid dimensions.`);
  const scale=spec.size/size[spec.axis];model.scale.setScalar(scale);
  model.position.set(-center.x*scale,spec.base-bounds.min.y*scale,spec.z-center.z*scale);
  model.traverse(obj=>{
   if(!(obj instanceof T.Mesh))return;
   obj.castShadow=true;obj.receiveShadow=true;
   for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
    for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=4;
   }
  });
  parent.add(model);
  return {name:spec.name,bounds:new T.Box3().setFromObject(model)};
 }));
}
