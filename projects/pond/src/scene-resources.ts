// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
/** Also used for detached async chunks that finish after navigation or fail. */
export function disposeObjects(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
 root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.Line){
  geometries.add(o.geometry);
  if(o instanceof T.Mesh){if(o.customDepthMaterial)materials.add(o.customDepthMaterial);if(o.customDistanceMaterial)materials.add(o.customDistanceMaterial);}
  for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
 }});
 for(const m of materials)for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear();
}
/** Own a detached group until every async writer has finished. */
export async function stageObjects<T>(parent:T.Object3D,build:(group:T.Scene)=>Promise<T>,cancelled:()=>boolean,onAttach:(value:T)=>void,prepare?:(group:T.Scene)=>Promise<void>){
 const staging=new T.Scene();
 try{const value=await build(staging);if(cancelled()){disposeObjects(staging);return;}
  await prepare?.(staging);
  if(cancelled()){disposeObjects(staging);return;}
  parent.add(...staging.children.slice());onAttach(value);
 }catch(cause){disposeObjects(staging);if(!cancelled())throw cause;}
}
