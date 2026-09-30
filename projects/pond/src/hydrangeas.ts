// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rng,tau,uTime} from './shared';

/** Keep the central architecture and the front camera approach open. */
export const hydrangeaBeds=[
 {x:-11.1,z:2.1,hue:0},{x:-10.4,z:-2.2,hue:1},{x:-9.1,z:-6.0,hue:2},
 {x:-6.7,z:-8.8,hue:0},{x:-4.2,z:-10.7,hue:1},{x:4.3,z:-10.8,hue:2},
 {x:7.0,z:-8.8,hue:1},{x:10.2,z:-5.0,hue:0},{x:11.5,z:-.7,hue:2},
 {x:11.0,z:3.2,hue:1},{x:-10.1,z:5.6,hue:2},
] as const;
const sway=`vec3 anchor=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 float tip=smoothstep(.06,.92,position.y);
 transformed.x+=sin(uHydTime*1.15+anchor.x*.48+anchor.z*.29)*.014*tip*tip;
 transformed.z+=sin(uHydTime*.83+anchor.x*.31)*.011*tip*tip;`;
export async function createHydrangeas(root:T.Group,shrubs:readonly {x:number;z:number;r:number;y:number;ry:number}[]){
 let asset;
 try{asset=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/hydrangea-garden-v1.glb`);}
 catch(cause){throw new Error('The hydrangea flowers could not load. Please reload the garden.',{cause});}
 const near=asset.scene.getObjectByName('HydrangeaNear'),far=asset.scene.getObjectByName('HydrangeaFar');
 if(!(near instanceof T.Mesh)||!(far instanceof T.Mesh)||!(near.material instanceof T.MeshStandardMaterial))throw new Error('The hydrangea model is incomplete.');
 const sourceMaterial=near.material,material=sourceMaterial.clone();
 material.roughness=.9;material.metalness=0;material.normalScale.setScalar(.38);material.envMapIntensity=.32;
 for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=4;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uHydTime=uTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uHydTime;attribute vec3 aHydTint;varying vec3 vHydTint;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvHydTint=aHydTint;\n'+sway);
  // Change the cool flower pigments only. Green leaves and brown stems keep their authored color.
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHydTint;')
   .replace('#include <map_fragment>',`#include <map_fragment>
    vec3 original=diffuseColor.rgb;
    float petals=smoothstep(.018,.10,original.b-original.g*.92);
    float lum=dot(original,vec3(.2126,.7152,.0722));
    vec3 tinted=lum*vHydTint/max(.08,dot(vHydTint,vec3(.2126,.7152,.0722)));
    diffuseColor.rgb=mix(original,tinted,petals*.88);`);
 };
 material.customProgramCacheKey=()=> 'hydrangea-petal-pigment-v2';
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
 depth.onBeforeCompile=shader=>{shader.uniforms.uHydTime=uTime;shader.vertexShader=shader.vertexShader
  .replace('#include <common>','#include <common>\nuniform float uHydTime;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\n'+sway);};
 depth.customProgramCacheKey=()=> 'hydrangea-sway-depth-v1';
 const random=rng(950),dummy=new T.Object3D(),palette=['#88ace7','#baa0e0','#ed9dcc','#c6da9a'];
 const specimens:{matrix:T.Matrix4;position:T.Vector3;color:T.Color;near:boolean}[]=[];
 // Attach flowers to the existing shrub crowns; never replace their green mass.
 const headsPerShrub=20;
 for(const [bedIndex,crown] of shrubs.entries())for(let i=0;i<headsPerShrub;i++){
  const a=i*Math.PI*(3-Math.sqrt(5))+random()*.18,r=crown.r*Math.sqrt((i+.5)/headsPerShrub)*.90;
  const pigment=(i+bedIndex)%palette.length,size=(.40+random()*.15)*(pigment===3?.82:1);
  // Embed the model's lower leaves in the crown, with blossoms above the foliage.
  const height=crown.y+crown.ry*Math.sqrt(Math.max(.05,1-(r/crown.r)**2))-.12+random()*.16;
  const p=new T.Vector3(crown.x+Math.cos(a)*r,height,crown.z+Math.sin(a)*r);
  dummy.position.copy(p);dummy.rotation.set((random()-.5)*.14,random()*tau,(random()-.5)*.14);dummy.scale.setScalar(size);dummy.updateMatrix();
  // Each bush carries mixed colors, including a smaller pale green young head.
  const color=new T.Color(palette[pigment]!);color.offsetHSL((random()-.5)*.025,(random()-.5)*.08,(random()-.5)*.035);
  specimens.push({matrix:dummy.matrix.clone(),position:p,color,near:false});
 }
 const meshes=[near,far].map((source,index)=>{
  const g=source.geometry.clone();g.setAttribute('aHydTint',new T.InstancedBufferAttribute(new Float32Array(specimens.length*3),3).setUsage(T.DynamicDrawUsage));
  const mesh=new T.InstancedMesh(g,material,specimens.length);mesh.name=index===0?'Hydrangea close flowers':'Hydrangea distant flowers';mesh.userData.waterAbove=true;mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=depth;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);return mesh;
 });
 near.geometry.dispose();far.geometry.dispose();sourceMaterial.dispose();
 const previous=new T.Vector3(Infinity,Infinity,Infinity);let initialized=false;
 const counts=[0,0];
 function update(camera:T.Camera){
  if(initialized&&previous.distanceToSquared(camera.position)<.04)return;
  previous.copy(camera.position);let changed=!initialized;
  for(const s of specimens){const d=s.position.distanceToSquared(camera.position),next=d<(s.near?25:16);changed ||=next!==s.near;s.near=next;}
  if(!changed)return;initialized=true;counts.fill(0);
  for(const s of specimens){const batch=s.near?0:1,index=counts[batch]!,mesh=meshes[batch]!;counts[batch]=index+1;mesh.setMatrixAt(index,s.matrix);(mesh.geometry.getAttribute('aHydTint') as T.InstancedBufferAttribute).setXYZ(index,s.color.r,s.color.g,s.color.b);}
  meshes.forEach((mesh,i)=>{mesh.count=counts[i]!;mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;(mesh.geometry.getAttribute('aHydTint') as T.InstancedBufferAttribute).needsUpdate=true;if(mesh.count){mesh.computeBoundingSphere();mesh.boundingSphere!.radius+=.04;}});
 }
 return {update,diagnostics:()=>({beds:shrubs.length,headsPerShrub,heads:specimens.length,near:counts[0],far:counts[1],triangles:counts[0]!*47395+counts[1]!*12096})};
}
