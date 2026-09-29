// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Fish meshes/textures: somitsu, CC BY 4.0; see public/models/ATTRIBUTION.md.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {noiseGLSL,uTime} from './shared';
import {fishSpecies} from './fish-species';

/** Blender-normalized assets share +X forward / +Y up, with independent GPU swim phases. */
export async function createKoi(scene:T.Scene,seeds:Float32Array){
 const loader=new GLTFLoader();
 const assets=await Promise.all(fishSpecies.map(({name})=>loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)));
 const speciesCount=assets.length;
 const batches:T.InstancedMesh[][]=assets.map(()=>[]);
 const swimAttributes:T.InstancedBufferAttribute[]=[];
 assets.forEach((asset,species)=>{
  asset.scene.updateMatrixWorld(true);
  const groups=new Map<string,{parts:T.BufferGeometry[];material:T.MeshStandardMaterial;fin:boolean;eye:boolean}>();
  asset.scene.traverse(obj=>{
   if(!(obj instanceof T.Mesh))return;
   const original=Array.isArray(obj.material)?obj.material[0]:obj.material;
   if(!(original instanceof T.MeshStandardMaterial))return;
   // A transmission cornea would trigger extra scene captures inside the pond's own passes.
   // The underlying iris and black lens already provide the visible eye and specular glint.
   if(/cornea/i.test(obj.name))return;
   const fin=/^(SW_\w+_)?fin/i.test(obj.name),eye=/eye/i.test(obj.name);
   const key=`${original.name}:${fin}`;
   let group=groups.get(key);
   if(!group){
    const m=original.clone();m.side=T.DoubleSide;m.forceSinglePass=true;
    // The batching layout intentionally drops Blender's unused color layers. Leaving
    // vertexColors enabled on Ryukin multiplies its texture by a missing attribute.
    m.vertexColors=false;
    if(m instanceof T.MeshPhysicalMaterial){m.transmission=0;m.clearcoat=0;}
    m.transparent=fin;m.depthWrite=!fin;m.alphaTest=fin?.025:0;m.opacity=1;
    m.normalScale.setScalar(fin?.38:.55);m.metalness=0;m.roughness=eye?.23:.8;
    m.envMapIntensity=eye?.6:.35;
    if(/lens/i.test(obj.name)||(species===2&&eye)){m.color.set('#080e10');m.roughness=.19;}
    for(const value of Object.values(m))if(value instanceof T.Texture)value.anisotropy=4;
    group={parts:[],material:m,fin,eye};groups.set(key,group);
   }
   const g=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
   // Keep one attribute layout when the original left/right eye or fin meshes are merged.
   for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
   if(!g.hasAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   const p=g.getAttribute('position'),flex:number[]=[];
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    let weight=0,axis=0;
    if(fin){
     if(/caudal/i.test(obj.name))weight=T.MathUtils.smoothstep(-x,.28,1.05);
     else if(/dorsal/i.test(obj.name))weight=T.MathUtils.smoothstep(y,.18,.60);
     else if(/pectoral|pelvic/i.test(obj.name)){weight=T.MathUtils.smoothstep(Math.abs(z),.10,.48);axis=1;}
     else weight=T.MathUtils.smoothstep(-y,.17,.49);
    }
    flex.push(weight,axis);
   }
   g.setAttribute('aFlex',new T.Float32BufferAttribute(flex,2));
   group.parts.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();
  });
  const subset=Float32Array.from([...seeds].filter((_,i)=>i%speciesCount===species));
  const swim=new T.InstancedBufferAttribute(new Float32Array(subset.length*3),3).setUsage(T.DynamicDrawUsage);
  swimAttributes.push(swim);
  for(const {parts,material,fin,eye} of groups.values()){
   const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
   g.setAttribute('aSeed',new T.InstancedBufferAttribute(subset,1));
   g.setAttribute('aSwim',swim);
   g.setAttribute('aPalette',new T.InstancedBufferAttribute(Float32Array.from(subset,(_,i)=>fishSpecies[species]!.palettes[i%2]!),1));
   material.onBeforeCompile=shader=>{
    shader.uniforms.uLifeTime=uTime;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
     uniform float uLifeTime;attribute float aSeed;attribute vec3 aSwim;attribute float aPalette;attribute vec2 aFlex;varying vec3 vPond;varying vec3 vFishRest;varying float vPalette;varying float vFishSeed;`)
    .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
     float swimPhase=aSwim.x+position.x*2.7;
     float tailWeight=clamp((.65-position.x)/1.8,0.,1.);
     float amplitude=.12+.15*aSwim.y;
     float bendSlope=amplitude*(2.7*cos(swimPhase)*tailWeight*tailWeight-2.*sin(swimPhase)*tailWeight/1.8)-aSwim.z*tailWeight*.12;
     objectNormal.x-=bendSlope*objectNormal.z;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vFishRest=position;vPalette=aPalette;vFishSeed=aSeed;
     transformed.z+=sin(swimPhase)*amplitude*tailWeight*tailWeight+aSwim.z*tailWeight*tailWeight*.11;
     float flutter=sin(aSwim.x*1.35+position.x*4.+position.z*3.)*aFlex.x*aFlex.x*(.045+.045*aSwim.y);
     if(aFlex.y>.5)transformed.y+=flutter;else transformed.z+=flutter;`)
    .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvPond=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
     uniform float uLifeTime;varying vec3 vPond;varying vec3 vFishRest;varying float vPalette;varying float vFishSeed;${noiseGLSL}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
     ${eye?'':`// Preserve the authored fine texture and normal maps; vary pigment per fish.
     vec3 sourcePigment=diffuseColor.rgb;
     float warmth=smoothstep(.035,.19,sourcePigment.r-max(sourcePigment.g,sourcePigment.b));
     float luminance=dot(sourcePigment,vec3(.2126,.7152,.0722));
     float detail=clamp(luminance/(mix(.65,.23,warmth)+.03),.55,1.3);
     float mottling=noise2(vFishRest.xz*6.+vFishSeed)+.22*noise2(vFishRest.xy*14.+vFishSeed);
     vec3 pigment=sourcePigment;
     // Shift only the warm patches: source silver scales, fin rays and markings survive.
     if(vPalette>.5&&vPalette<1.5)pigment=mix(sourcePigment,vec3(.66,.25,.025)*detail,warmth*.85);
     else if(vPalette>1.5&&vPalette<2.5){
      // The second calico retains dark markings and silver scales, with warmer copper patches.
      pigment=mix(sourcePigment*vec3(.91,1.015,1.06),sourcePigment*vec3(1.07,1.7,.92),warmth*.60);
     }
     else if(vPalette>2.5){
      float belly=1.-smoothstep(-.25,.15,vFishRest.y);
      vec3 charcoal=mix(vec3(.045,.054,.050),vec3(.19,.115,.050),belly*.7+mottling*.12)*detail;
      pigment=mix(sourcePigment*.58,charcoal,.65+warmth*.35);
     }
     diffuseColor.rgb=pigment;`}`)
    .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
     // Keep texture cutouts but prevent the whole fin from disappearing under refraction.
     diffuseColor.a=${fin?'clamp(diffuseColor.a,.72,.98)':'1.'};`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     // glTF roughness maps multiply the scalar, so the scalar alone cannot set a floor.
     ${eye?'':'roughnessFactor=clamp(roughnessFactor,.48,.82);'}`)
    .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
     ${eye?'':'totalEmissiveRadiance+=diffuseColor.rgb*vec3(.038,.050,.027)*caustic(vPond.xz*3.,uLifeTime);'}`);
   };
   material.customProgramCacheKey=()=>`stillwater-swim-v4-${species}-${fin}-${eye}`;
   const mesh=new T.InstancedMesh(g,material,subset.length);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=!fin;mesh.receiveShadow=true;
   scene.add(mesh);batches[species]!.push(mesh);
  }
  // Source geometry/material objects are replaced by the shared instanced batches; maps stay shared.
  asset.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
 });
 return {
  setMatrixAt(index:number,matrix:T.Matrix4){for(const mesh of batches[index%speciesCount]!)mesh.setMatrixAt(Math.floor(index/speciesCount),matrix);},
  setMotionAt(index:number,phase:number,effort:number,turn:number){swimAttributes[index%speciesCount]!.setXYZ(Math.floor(index/speciesCount),phase,effort,turn);},
  updateInstances(){for(const attr of swimAttributes)attr.needsUpdate=true;for(const group of batches)for(const mesh of group)mesh.instanceMatrix.needsUpdate=true;},
 };
}
