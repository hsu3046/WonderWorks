// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {monarchBehavior} from './monarch-behavior';

// The supplied mesh faces +X, with the body pitched up and its wings already raised.
// Convert to the garden's -Z forward axis without modifying the original GLB.
const alignment=new T.Matrix4().makeRotationY(Math.PI/2)
 .multiply(new T.Matrix4().makeRotationZ(-Math.PI/4))
 .multiply(new T.Matrix4().makeTranslation(-.10,-.28,0));

export async function createMonarchs(scene:T.Scene,pads:T.Group[]){
 let asset;
 try{asset=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/monarch-butterfly.glb`);}
 catch(cause){throw new Error('The monarch butterfly could not load. Please reload the garden.',{cause});}
 const meshes:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
 asset.scene.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial)meshes.push(o);});
 if(meshes.length!==1)throw new Error('The monarch model has an unexpected mesh layout.');
 const source=meshes[0]!,geometry=source.geometry;
 geometry.applyMatrix4(source.matrixWorld).applyMatrix4(alignment);
 const positions=geometry.attributes.position!,weights=new Float32Array(positions.count),legWeights=new Float32Array(positions.count);
 let footY=0;
 // Separate appendages below the thorax; the forward antenna tips must stay rigid.
 for(let i=0;i<positions.count;i++){
  const lateral=Math.abs(positions.getX(i)),height=positions.getY(i);
  weights[i]=T.MathUtils.smoothstep(lateral,.038,.10)*T.MathUtils.smoothstep(height,-.035,.045);
  legWeights[i]=T.MathUtils.smoothstep(-height,.045,.105)*T.MathUtils.smoothstep(lateral,.028,.065)*(1-T.MathUtils.smoothstep(-positions.getZ(i),.16,.22));
  if(legWeights[i]!>.5)footY=Math.min(footY,height);
 }
 geometry.setAttribute('wingWeight',new T.BufferAttribute(weights,1));
 geometry.setAttribute('legWeight',new T.BufferAttribute(legWeights,1));
 geometry.computeBoundingSphere();geometry.boundingSphere!.radius*=1.45;
 const butterflies=Array.from({length:2},(_,i)=>{
  const root=new T.Group();root.name=`Monarch butterfly ${i+1}`;
  root.scale.setScalar(i===0?.15:.17);scene.add(root);
  const flap={value:0},legFold={value:1},material=source.material.clone();
  material.metalness=0;material.roughness=.82;material.side=T.DoubleSide;
  material.envMapIntensity=.35;material.normalScale.setScalar(.55);
  // Rotate the actual textured wings, including normals, instead of scaling the insect.
  material.onBeforeCompile=shader=>{
   shader.uniforms.monarchFlap=flap;
   shader.uniforms.monarchLegFold=legFold;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    attribute float wingWeight;
    attribute float legWeight;
    uniform float monarchFlap;
    uniform float monarchLegFold;
    mat3 legRotation(float angle){float c=cos(angle),s=sin(angle);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
    mat3 monarchRotation(float angle){float c=cos(angle),s=sin(angle);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}`)
    .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
     float wingAngle=sign(position.x)*monarchFlap*wingWeight;
     float fold=monarchLegFold*legWeight;
     objectNormal=monarchRotation(wingAngle)*objectNormal;
     objectNormal.x/=1.-.55*fold;
     objectNormal=legRotation(-1.18*fold)*objectNormal;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 hinge=vec3(sign(position.x)*.038,.015,0.);
     transformed=monarchRotation(wingAngle)*(transformed-hinge)+hinge;
     vec3 hip=vec3(sign(position.x)*.038,-.03,position.z);
     vec3 leg=transformed-hip;leg.x*=1.-.55*fold;
     transformed=legRotation(-1.18*fold)*leg+hip;`);
  };
  material.customProgramCacheKey=()=> 'stillwater-monarch-wing-legs-v2';
  const mesh=new T.Mesh(geometry,material);mesh.name='Textured monarch with hinged wings';root.add(mesh);
  return {root,flap,legFold,phase:i*2.71+.8,behavior:monarchBehavior(0,i),padIndex:2,contact:new T.Vector3()};
 });
 // The two instances share geometry and all source maps; only flap uniforms differ.
 source.material.dispose();
 const flight=new T.Vector3(),perched=new T.Vector3(),flightQ=new T.Quaternion(),perchQ=new T.Quaternion(),yawQ=new T.Quaternion(),up=new T.Vector3(0,1,0),euler=new T.Euler();
 return {count:butterflies.length,diagnostics(){return butterflies.map(({root,flap,legFold,behavior,padIndex,contact})=>({position:root.position.toArray(),flap:flap.value,scale:root.scale.x,legFold:legFold.value,state:behavior.state,perchWeight:behavior.perchWeight,padIndex,contact:contact.toArray()}));},update(time:number,breeze:number){
  butterflies.forEach((butterfly,i)=>{
   const {root,flap,legFold,phase}=butterfly;
   const behavior=monarchBehavior(time,i);butterfly.behavior=behavior;
   const t=time*(.24+i*.035)+phase;
   const cx=i===0?-3.4:2.4,cz=i===0?2.6:-2.5;
   const x=cx+Math.sin(t)*1.45+Math.sin(t*2.31+phase)*.24;
   const z=cz+Math.sin(t*.79+phase)*.92;
   const dx=Math.cos(t)*1.45+Math.cos(t*2.31+phase)*.24*2.31;
   const dz=Math.cos(t*.79+phase)*.92*.79;
   const glide=T.MathUtils.smoothstep(Math.sin(time*.73+phase),.48,.94);
   const flyingFlap=T.MathUtils.lerp(-.13+Math.sin(time*(19+i*1.7)+phase)*.66,-.52,glide*.86);
   flap.value=T.MathUtils.lerp(.28+Math.sin(time*.85+phase)*.075,flyingFlap,behavior.wingActivity);
   legFold.value=behavior.legFold;
   flight.set(x,1.10+Math.sin(t*1.6+phase)*.32+Math.sin(time*2.1+phase)*.035*(1-glide),z);
   flightQ.setFromEuler(euler.set(.08+Math.sin(time*1.3+phase)*.065,Math.atan2(-dx,-dz),Math.sin(t*1.7)*(.16+breeze*.10)));
   // Flower-bearing leaves are excluded from the frog's landing choices.
   // Alternate leaves each trip; separate rim positions prevent shared contact points.
   const padIndex=(i+behavior.cycle)%2===0?2:5,pad=pads[padIndex]!;butterfly.padIndex=padIndex;
   pad.updateWorldMatrix(true,false);
   const radius=padIndex===2?.48:.64,angle=i===0?2.25:4.25;
   butterfly.contact.set(Math.cos(angle)*radius,.006,Math.sin(angle)*radius).applyMatrix4(pad.matrixWorld);
   perched.set(Math.cos(angle)*radius,.006-footY*root.scale.x,Math.sin(angle)*radius).applyMatrix4(pad.matrixWorld);
   pad.getWorldQuaternion(perchQ);yawQ.setFromAxisAngle(up,-angle-Math.PI/2);perchQ.multiply(yawQ);
   root.position.lerpVectors(flight,perched,behavior.perchWeight);
   root.quaternion.slerpQuaternions(flightQ,perchQ,behavior.perchWeight);
  });
 }};
}
