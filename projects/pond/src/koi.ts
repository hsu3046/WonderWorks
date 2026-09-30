// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Fish assets: somitsu (CC BY 4.0) and AIB Inc.; see public/models/ATTRIBUTION.md.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {noiseGLSL,uTime} from './shared';
import {fishSpecies} from './fish-species';

/** Blender-normalized assets share +X forward / +Y up, with independent GPU swim phases. */
export async function createKoi(scene:T.Scene,seeds:Float32Array){
 const loader=new GLTFLoader();
 const assets=await Promise.all(fishSpecies.map(async({name})=>{
  const asset=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
  if(name==='aib-goldfish-v5'){
   const cornea=await loader.loadAsync(`${import.meta.env.BASE_URL}models/aib-goldfish-v5-cornea.glb`);
   asset.scene.add(cornea.scene);
  }
  return asset;
 }));
 const speciesCount=assets.length;
 const batches:T.InstancedMesh[][]=assets.map(()=>[]);
 const swimAttributes:T.InstancedBufferAttribute[]=[];
 assets.forEach((asset,species)=>{
  const authored=fishSpecies[species]!.name==='aib-goldfish-v5';
  asset.scene.updateMatrixWorld(true);
  const groups=new Map<string,{parts:T.BufferGeometry[];material:T.MeshStandardMaterial;fin:boolean;eye:boolean;cornea:boolean}>();
  asset.scene.traverse(obj=>{
   if(!(obj instanceof T.Mesh))return;
   const original=Array.isArray(obj.material)?obj.material[0]:obj.material;
   if(!(original instanceof T.MeshStandardMaterial))return;
   // A transmission cornea would trigger extra scene captures inside the pond's own passes.
   // The AIB membrane uses Fresnel alpha without a costly transmission capture.
   const cornea=/cornea/i.test(obj.name);if(cornea&&!authored)return;
   const fin=/^(SW_\w+_)?fin/i.test(obj.name),eye=/eye/i.test(obj.name);
   const key=`${original.name}:${fin}`;
   let group=groups.get(key);
   if(!group){
    let m=original.clone();
    if(authored&&eye&&!(m instanceof T.MeshPhysicalMaterial)){
     const wetEye=new T.MeshPhysicalMaterial();
     T.MeshStandardMaterial.prototype.copy.call(wetEye,m);m=wetEye;
    }
    m.side=cornea?T.FrontSide:T.DoubleSide;m.forceSinglePass=true;
    // The batching layout intentionally drops Blender's unused color layers. Leaving
    // vertexColors enabled on Ryukin multiplies its texture by a missing attribute.
    m.vertexColors=false;
    if(m instanceof T.MeshPhysicalMaterial){m.transmission=0;if(!authored)m.clearcoat=0;}
    m.transparent=fin||cornea;m.depthWrite=!(fin||cornea);m.alphaTest=fin?.025:0;if(!authored)m.opacity=1;
    if(!authored){m.normalScale.setScalar(fin?.38:.55);m.metalness=0;m.roughness=eye?.23:.8;}
    // Blender's micron ridges are grayscale HEIGHT data, not tangent-space RGB normals.
    // glTF exported the image as normalTexture; restore the original bump interpretation.
    if(authored&&/ThinScale/.test(m.name)&&m.normalMap){
     m.bumpMap=m.normalMap;m.bumpScale=.00012;m.normalMap=null;
    }
    // This authored iris stores linear RGB (Blender Non-Color); sRGB decoding darkens it twice.
    if(authored&&/Iris/.test(m.name)&&m.map){m.map.colorSpace=T.LinearSRGBColorSpace;m.map.needsUpdate=true;}
    if(authored&&eye&&m instanceof T.MeshPhysicalMaterial){
     // Wet eye layers stay reflective beneath the separate transparent membrane.
     m.clearcoat=1;m.clearcoatRoughness=.07;m.roughness=/Pupil/.test(m.name)?.12:m.roughness;
    }
    m.envMapIntensity=cornea?1.8:eye?(authored?1:.6):.35;
    if(!authored&&(/lens/i.test(obj.name)||(species===2&&eye))){m.color.set('#080e10');m.roughness=.19;}
    for(const value of Object.values(m))if(value instanceof T.Texture)value.anisotropy=4;
    group={parts:[],material:m,fin,eye,cornea};groups.set(key,group);
   }
   const g=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
   // Keep one attribute layout when the original left/right eye or fin meshes are merged.
   for(const name of Object.keys(g.attributes))if(!['position','normal','uv','uv1'].includes(name))g.deleteAttribute(name);
   if(!g.hasAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   // The v5 growth-line height map has its own UV set; retain it when batching scales.
   if(!g.hasAttribute('uv1'))g.setAttribute('uv1',g.getAttribute('uv').clone());
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
  for(const {parts,material,fin,eye,cornea} of groups.values()){
   const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
   g.setAttribute('aSwim',swim);
   material.onBeforeCompile=shader=>{
    shader.uniforms.uLifeTime=uTime;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
     uniform float uLifeTime;attribute vec3 aSwim;attribute vec2 aFlex;varying vec3 vPond;`)
    .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
     float swimPhase=aSwim.x+position.x*2.7;
     float tailWeight=clamp((.65-position.x)/1.8,0.,1.);
     float amplitude=.12+.15*aSwim.y;
     float bendSlope=amplitude*(2.7*cos(swimPhase)*tailWeight*tailWeight-2.*sin(swimPhase)*tailWeight/1.8)-aSwim.z*tailWeight*.12;
     objectNormal.x-=bendSlope*objectNormal.z;`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     transformed.z+=sin(swimPhase)*amplitude*tailWeight*tailWeight+aSwim.z*tailWeight*tailWeight*.11;
     float flutter=sin(aSwim.x*1.35+position.x*4.+position.z*3.)*aFlex.x*aFlex.x*(.045+.045*aSwim.y);
     if(aFlex.y>.5)transformed.y+=flutter;else transformed.z+=flutter;`)
    .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvPond=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
     uniform float uLifeTime;varying vec3 vPond;${noiseGLSL}`)
    .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
     // Keep texture cutouts but prevent the whole fin from disappearing under refraction.
     diffuseColor.a=${cornea?'.16':fin?(authored?'clamp(diffuseColor.a,.03,.98)':'clamp(diffuseColor.a,.72,.98)'):'1.'};`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     // glTF roughness maps multiply the scalar, so the scalar alone cannot set a floor.
     ${eye||authored?'':'roughnessFactor=clamp(roughnessFactor,.48,.82);'}`)
    .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
     ${eye?'':'totalEmissiveRadiance+=diffuseColor.rgb*vec3(.038,.050,.027)*caustic(vPond.xz*3.,uLifeTime);'}`);
    if(cornea)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
     // Original curved membrane: nearly clear head-on, more reflective toward the rim.
     float eyeFresnel=pow(1.-abs(dot(normal,normalize(vViewPosition))),3.);
     // A broad studio catchlight keeps the small curved eye legible in the pond.
     float catchlight=pow(max(dot(normal,normalize(vec3(-.28,.42,1.))),0.),180.);
     outgoingLight+=vec3(1.,.94,.84)*catchlight*2.5;
     diffuseColor.a=max(.12+.48*eyeFresnel,catchlight*.85);
     #include <opaque_fragment>`);
   };
   material.customProgramCacheKey=()=>`stillwater-source-colors-v10-${species}-${fin}-${eye}-${cornea}`;
   const mesh=new T.InstancedMesh(g,material,subset.length);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=!fin&&!cornea;mesh.receiveShadow=true;
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
