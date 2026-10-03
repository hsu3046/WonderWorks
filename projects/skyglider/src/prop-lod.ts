// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';

/** Small scanned ground details retain their original transforms and return as the camera approaches. */
export function createGroundDetailLOD(mesh:T.InstancedMesh,enterRadius=38,exitRadius=48){
  const matrices:T.Matrix4[]=[],anchors:T.Vector3[]=[],matrix=new T.Matrix4(),scale=new T.Vector3();
  for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);scale.setFromMatrixScale(matrix);if(scale.lengthSq()<1e-8)continue;
    matrices.push(matrix.clone());anchors.push(new T.Vector3().setFromMatrixPosition(matrix));
  }
  const membership=matrices.map(()=>false),last=new T.Vector3(Infinity,Infinity,Infinity);let initialized=false;
  return (camera:T.Vector3)=>{
    if(initialized&&last.distanceToSquared(camera)<4)return;last.copy(camera);let changed=!initialized;
    anchors.forEach((anchor,i)=>{const radius=membership[i]?exitRadius:enterRadius,next=anchor.distanceToSquared(camera)<radius*radius;if(next!==membership[i]){membership[i]=next;changed=true;}});
    if(!changed)return;initialized=true;let count=0;
    matrices.forEach((transform,i)=>{if(membership[i])mesh.setMatrixAt(count++,transform);});
    mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  };
}
