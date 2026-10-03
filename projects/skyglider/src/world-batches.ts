// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake immutable architecture into one mesh per material while keeping its authored placement. */
export function batchStaticMeshes(group:T.Group){
  group.updateWorldMatrix(true,true);
  const inverse=group.matrixWorld.clone().invert(),batches=new Map<T.Material,T.BufferGeometry[]>(),originals=new Set<T.BufferGeometry>();
  group.traverse(object=>{
    if(!(object instanceof T.Mesh)||Array.isArray(object.material))return;
    const geometry=object.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    const list=batches.get(object.material)??[];list.push(geometry);batches.set(object.material,list);originals.add(object.geometry);
  });
  group.clear();
  for(const [material,geometries] of batches){
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error('The scenery geometry could not be batched.');
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  originals.forEach(g=>g.dispose());
}
