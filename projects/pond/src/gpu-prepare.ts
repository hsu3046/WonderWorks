// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {createTaskPool} from './task-pool';

/** Give input and rendering a turn between GPU uploads; never attach an unprepared chunk. */
export function createGpuPreparation(renderer:T.WebGLRenderer,compile:(root:T.Object3D)=>Promise<void>,cancelled:()=>boolean){
 const serial=createTaskPool(1),uploaded=new WeakSet<T.Texture>();
 return (root:T.Object3D)=>serial(async()=>{
  if(cancelled())return;
  const textures=new Set<T.Texture>();
  root.traverse(object=>{
   if(!(object instanceof T.Mesh||object instanceof T.Points||object instanceof T.Line||object instanceof T.Sprite))return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    for(const value of Object.values(material))if(value instanceof T.Texture&&!value.isRenderTargetTexture)textures.add(value);
   }
  });
  for(const texture of textures){
   if(cancelled())return;
   if(uploaded.has(texture))continue;
   renderer.initTexture(texture);uploaded.add(texture);
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  if(!cancelled())await compile(root);
 });
}
