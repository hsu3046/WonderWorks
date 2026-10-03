// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {inClearing,terrainHeight} from './landscape.ts';

export interface TreeLocation {x:number;z:number;s:number;rot:number;}
export function createBroadleafGrove(source:T.Group,locations:ReadonlyArray<TreeLocation>,sprite:T.Texture){
  source.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(source),center=bounds.getCenter(new T.Vector3()),height=bounds.max.y-bounds.min.y;
  const group=new T.Group(),near:T.InstancedMesh[]=[],dummy=new T.Object3D(),matrices:T.Matrix4[]=[],anchors:T.Vector3[]=[];
  locations.forEach(l=>{if(inClearing(l.x,l.z,20))return;dummy.position.set(l.x,terrainHeight(l.x,l.z),l.z);dummy.rotation.set(0,l.rot,0);dummy.scale.setScalar(l.s*6.6);dummy.updateMatrix();matrices.push(dummy.matrix.clone());anchors.push(dummy.position.clone().add(new T.Vector3(0,l.s*3.3,0)));});
  source.traverse(object=>{
    if(!(object instanceof T.Mesh)||!(object.material instanceof T.MeshStandardMaterial))return;
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(1/height,1/height,1/height);
    const material=object.material.clone();material.roughness=.94;material.color.multiplyScalar(1.08);
    if(material.name.includes('leaves'))material.side=T.DoubleSide;
    const mesh=new T.InstancedMesh(geometry,material,matrices.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.count=0;near.push(mesh);group.add(mesh);
  });
  const card=new T.PlaneGeometry(1.15,1).translate(0,.5,0),cross=card.clone().rotateY(Math.PI/2);
  // Four triangles per distant tree; the detailed model is uploaded only into nearby instance slots.
  const positions:Array<number>=[],uv:Array<number>=[],indices:Array<number>=[];
  for(const g of [card,cross]){const offset=positions.length/3;positions.push(...g.getAttribute('position').array);uv.push(...g.getAttribute('uv').array);indices.push(...Array.from(g.index!.array,i=>i+offset));g.dispose();}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({map:sprite,alphaTest:.45,side:T.DoubleSide,roughness:1,color:0xb4c4a4});
  const far=new T.InstancedMesh(geometry,material,matrices.length);far.receiveShadow=true;far.count=0;group.add(far);
  const membership=matrices.map(()=>false),last=new T.Vector3(Infinity,Infinity,Infinity);let initialized=false;
  function updateView(camera:T.Vector3){
    if(initialized&&last.distanceToSquared(camera)<4)return;last.copy(camera);let changed=!initialized;
    for(let i=0;i<anchors.length;i++){const distance=anchors[i]!.distanceToSquared(camera),next=distance<(membership[i]?92*92:72*72);if(next!==membership[i]){membership[i]=next;changed=true;}}
    if(!changed)return;initialized=true;let closeCount=0,farCount=0;
    matrices.forEach((matrix,i)=>{if(membership[i]){near.forEach(mesh=>mesh.setMatrixAt(closeCount,matrix));closeCount++;}else{far.setMatrixAt(farCount++,matrix);}});
    near.forEach(mesh=>{mesh.count=closeCount;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();});far.count=farCount;far.instanceMatrix.needsUpdate=true;far.computeBoundingSphere();
  }
  return {group,updateView,counts:()=>({near:near[0]?.count??0,far:far.count})};
}
