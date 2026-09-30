// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {createModelLoader} from './model-loader';
import {deferredFlower} from './near-flower';
import {rng,uTime} from './shared';

const sway=`vec3 anchor=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 float tip=clamp(position.y+.5,0.,1.);
 transformed.x+=sin(uAzTime*1.15+anchor.x*.48+anchor.z*.29)*.012*tip;
 transformed.z+=sin(uAzTime*.83+anchor.x*.31)*.008*tip;`;
/** Small authored flowering sprigs spread over the upper AND outer crown, not giant flower heads. */
export async function createAzaleas(root:T.Object3D,crowns:readonly {x:number;z:number;r:number;y:number;ry:number}[],onChange:()=>void,onError:(message:string)=>void){
 let asset;
 try{asset=await createModelLoader().loadAsync(`${import.meta.env.BASE_URL}models/azalea-far-v2.glb`);}
 catch(cause){throw new Error('The azalea flowers could not load. Please reload the garden.',{cause});}
 const far=asset.scene.getObjectByName('AzaleaFar');
 if(!(far instanceof T.Mesh))throw new Error('Missing distant flowers');
 const near=new T.Mesh(far.geometry.clone(),far.material);
 if(!(near instanceof T.Mesh)||!(far instanceof T.Mesh)||!(near.material instanceof T.MeshStandardMaterial))throw new Error('The azalea model is incomplete.');
 const material=near.material.clone();material.roughness=.88;material.metalness=0;material.normalScale.setScalar(.30);material.envMapIntensity=.30;
 material.side=T.DoubleSide;material.forceSinglePass=true;
 for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=4;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uAzTime=uTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uAzTime;attribute vec3 aAzTint;varying vec3 vAzTint;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvAzTint=aAzTint;\n'+sway);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vAzTint;')
   .replace('#include <map_fragment>',`#include <map_fragment>
    vec3 original=diffuseColor.rgb;
    float petal=smoothstep(.04,.18,original.r-original.g)*smoothstep(.0,.09,original.b-original.g*.85);
    float lum=dot(original,vec3(.2126,.7152,.0722));
    vec3 tinted=lum*vAzTint/max(.08,dot(vAzTint,vec3(.2126,.7152,.0722)));
    diffuseColor.rgb=mix(original,tinted,petal*.60);`);
 };
 material.customProgramCacheKey=()=> 'azalea-flower-tint-v1';
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
 depth.onBeforeCompile=shader=>{shader.uniforms.uAzTime=uTime;shader.vertexShader=shader.vertexShader
  .replace('#include <common>','#include <common>\nuniform float uAzTime;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\n'+sway);};
 depth.customProgramCacheKey=()=> 'azalea-sway-depth-v1';
 const random=rng(1678),dummy=new T.Object3D(),normal=new T.Vector3(),front=new T.Vector3(0,0,1);
 const palette=['#ec91ba','#d875b0','#efaccb','#c685bf'],sprigsPerShrub=72;
 const specimens:{matrix:T.Matrix4;position:T.Vector3;color:T.Color;near:boolean}[]=[];
 for(const [bed,crown] of crowns.entries())for(let i=0;i<sprigsPerShrub;i++){
  const a=i*Math.PI*(3-Math.sqrt(5))+random()*.24,v=.97-(i+.5)/sprigsPerShrub*1.22,ring=Math.sqrt(1-v*v);
  const radius=crown.r*(.91+random()*.08);
  const p=new T.Vector3(crown.x+Math.cos(a)*ring*radius,crown.y+v*crown.ry,crown.z+Math.sin(a)*ring*radius);
  normal.set(Math.cos(a)*ring,v*.9+.28,Math.sin(a)*ring).normalize();
  dummy.position.copy(p).addScaledVector(normal,.045);dummy.quaternion.setFromUnitVectors(front,normal);dummy.rotateZ((random()-.5)*1.8);
  dummy.scale.setScalar(.29+random()*.095);dummy.updateMatrix();
  const color=new T.Color(palette[(i+bed)%palette.length]!);color.offsetHSL((random()-.5)*.014,0,(random()-.5)*.025);
  specimens.push({matrix:dummy.matrix.clone(),position:p,color,near:false});
 }

 const meshes=[near,far].map((source,i)=>{
  const g=source.geometry.clone();g.translate(0,-.50,0);
  g.setAttribute('aAzTint',new T.InstancedBufferAttribute(new Float32Array(specimens.length*3),3).setUsage(T.DynamicDrawUsage));

  const mesh=new T.InstancedMesh(g,material,specimens.length);mesh.name=i===0?'Azalea close blossoms':'Azalea distant blossoms';mesh.userData.waterAbove=true;
  mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=depth;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;mesh.visible=false;root.add(mesh);return mesh;
 });
 near.geometry.dispose();far.geometry.dispose();near.material.dispose();
 const previous=new T.Vector3(Infinity,Infinity,Infinity),counts=[0,0];let initialized=false;
 const nearAsset=deferredFlower('azalea-near-v2','AzaleaNear',g=>{
  g.translate(0,-.50,0);g.setAttribute('aAzTint',meshes[0]!.geometry.getAttribute('aAzTint'));
  meshes[0]!.geometry.dispose();meshes[0]!.geometry=g;meshes[0]!.boundingBox=null;meshes[0]!.boundingSphere=null;initialized=false;onChange();
 },onError);
 function update(camera:T.Camera){
  if(initialized&&previous.distanceToSquared(camera.position)<.04)return;
  previous.copy(camera.position);let changed=!initialized;
  for(const s of specimens){const wanted=s.position.distanceToSquared(camera.position)<(s.near?20.25:12.25);if(wanted)nearAsset.request();const next=wanted&&nearAsset.ready;changed ||= next!==s.near;s.near=next;}
  if(!changed)return;initialized=true;counts.fill(0);
  for(const s of specimens){const batch=s.near?0:1,index=counts[batch]!,mesh=meshes[batch]!;counts[batch]=index+1;
   mesh.setMatrixAt(index,s.matrix);(mesh.geometry.getAttribute('aAzTint') as T.InstancedBufferAttribute).setXYZ(index,s.color.r,s.color.g,s.color.b);}
  meshes.forEach((mesh,i)=>{mesh.count=counts[i]!;mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;
   (mesh.geometry.getAttribute('aAzTint') as T.InstancedBufferAttribute).needsUpdate=true;
   if(mesh.count){mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=.04;}});
 }
 return {update,dispose:nearAsset.dispose,diagnostics:()=>({shrubs:crowns.length,sprigsPerShrub,sprigs:specimens.length,openFlowers:specimens.length*3,near:counts[0],far:counts[1],nearAsset:nearAsset.state,triangles:meshes.reduce((sum,m)=>sum+m.count*(m.geometry.index?.count??m.geometry.attributes.position!.count)/3,0)})};
}
