// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {noise,random,smooth} from './landscape.ts';
import {SQUIRREL_BONES} from './squirrel-rig.ts';

type CoatPart='body'|'tail'|'ear';
const brown=new T.Color('#544b3d'),russet=new T.Color('#805231'),cream=new T.Color('#cec6b7'),dark=new T.Color('#26221b');
const silver=new T.Color('#b0a58d');
const color=new T.Color();

/** Short, low-contrast facial nap remains a filtered surface when individual hairs are subpixel. */
export function addFaceNap(material:T.MeshStandardMaterial):void {
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCoatRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCoatRest=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vCoatRest;
float napHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float napNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(napHash(i),napHash(i+vec3(1,0,0)),f.x),mix(napHash(i+vec3(0,1,0)),napHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(napHash(i+vec3(0,0,1)),napHash(i+vec3(1,0,1)),f.x),mix(napHash(i+vec3(0,1,1)),napHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float faceNap=1.0-smoothstep(-.80,-.66,vCoatRest.z);
vec3 napCoordinate=vCoatRest*vec3(145.0,145.0,48.0);
vec3 napFootprint=fwidth(napCoordinate);
float napFilter=1.0-smoothstep(.35,1.0,max(max(napFootprint.x,napFootprint.y),napFootprint.z));
float napValue=napNoise(napCoordinate)-.5;
diffuseColor.rgb*=1.0+napValue*.42*faceNap*napFilter;
float napHeight=napValue*.0005*faceNap*napFilter;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 napDx=dFdx(-vViewPosition),napDy=dFdy(-vViewPosition);
vec3 napR1=cross(napDy,normal),napR2=cross(normal,napDx);
float napDet=dot(napDx,napR1);
normal=normalize(abs(napDet)*normal-sign(napDet)*(dFdx(napHeight)*napR1+dFdy(napHeight)*napR2));
`);
  };
  material.customProgramCacheKey=()=> 'squirrel-filtered-face-nap-v1';
}

/** Collapse only facial guard hairs below their projected footprint, without alpha dithering or LOD swaps. */
export function createFurMaterial():T.MeshPhysicalMaterial {
  const material=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.93,side:T.DoubleSide,sheen:.29,sheenRoughness:.93,sheenColor:0xa78f6f});
  const viewportHeight={value:720},viewport=new T.Vector4();
  material.onBeforeCompile=shader=>{
    shader.uniforms.furViewportHeight=viewportHeight;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 furOffset;\nuniform float furViewportHeight;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 furRoot=position-furOffset;
float faceDetail=1.0-smoothstep(-.80,-.66,furRoot.z);
float furDepth=max(.01,-(modelViewMatrix*vec4(furRoot,1.0)).z);
float furPixels=.010*length(modelViewMatrix[0].xyz)*projectionMatrix[1][1]*furViewportHeight*.5/furDepth;
transformed-=furOffset*faceDetail*(1.0-smoothstep(.65,2.0,furPixels));
`);
    // Ribbon backs approximate the same outward-facing volume, not inward-facing sheets.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;',''));
  };
  material.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);viewportHeight.value=viewport.w;};
  material.customProgramCacheKey=()=> 'squirrel-facial-fur-footprint-v1';return material;
}

/** Color follows anatomy: grizzled brown back, warm cheeks and a continuous pale chin/belly. */
export function coatColor(p:T.Vector3,part:CoatPart,out:T.Color):T.Color {
  if(part==='ear')return out.copy(brown).multiplyScalar(.83);
  const variation=noise(p.x*18+p.y*9,p.z*21),mottle=noise(p.x*53-p.y*17,p.z*47);
  out.copy(brown).lerp(russet,.07+variation*.15);
  if(part==='tail')return out.lerp(dark,smooth(1.30,2.10,p.z)*.37).multiplyScalar(.79+variation*.28+mottle*.22);
  const face=1-smooth(-.75,-.57,p.z);out.lerp(russet,face*.28);
  const belly=smooth(.025,-.19,p.y)*(1-smooth(.15,.29,Math.abs(p.x)))*(1-smooth(.76,1,p.z));
  const chin=face*smooth(.105,-.055,p.y)*(1-smooth(.135,.23,Math.abs(p.x)));
  out.lerp(cream,Math.max(belly,chin)*.95);
  // Slight socket shadow connects the aperture to the face without a contrasting pale ring.
  const eye=((Math.abs(p.x)-.204)/.060)**2+((p.y-.231)/.080)**2+((p.z+1.014)/.081)**2;
  out.lerp(dark,face*(1-smooth(.72,1.50,eye))*.12);
  out.multiplyScalar(.86+variation*.17+mottle*.14);
  if(p.y>.21&&p.z>-.62)out.multiplyScalar(1-.11*Math.exp(-p.x*p.x*16));
  return out;
}

export function paintCoat(geometry:T.BufferGeometry,part:CoatPart='body'):void {
  const p=geometry.getAttribute('position'),colors=new Float32Array(p.count*3),point=new T.Vector3();
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);coatColor(point,part,color).toArray(colors,i*3);}
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
}

/** Area-weighted curved strands inherit barycentrically blended skin weights from the continuous skin. */
export function furGeometry(surface:T.BufferGeometry,count:number,part:CoatPart,seed:number,region:'all'|'face'='all'):T.BufferGeometry {
  const rng=random(seed),points=surface.getAttribute('position'),surfaceNormals=surface.getAttribute('normal'),index=surface.getIndex();
  const joints=surface.getAttribute('skinIndex'),weights=surface.getAttribute('skinWeight'),skinned=Boolean(joints&&weights);
  const faceCount=(index?index.count:points.count)/3,area=new Float64Array(faceCount);
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();let total=0;
  const vertex=(i:number):number=>index?index.getX(i):i;
  for(let i=0;i<faceCount;i++){
    a.fromBufferAttribute(points,vertex(i*3));b.fromBufferAttribute(points,vertex(i*3+1));c.fromBufferAttribute(points,vertex(i*3+2));
    // Extra follicles fade into the neck; the existing body/tail distribution keeps its seed.
    const density=region==='face'?1-smooth(-.76,-.60,(a.z+b.z+c.z)/3):1;
    total+=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5*density;area[i]=total;
  }
  const positions=new Float32Array(count*15),normals=new Float32Array(count*15),colors=new Float32Array(count*15),offsets=new Float32Array(count*15),indices=new Uint32Array(count*9);
  const skinIndices=skinned?new Uint8Array(count*20):null,skinWeights=skinned?new Float32Array(count*20):null;
  const blend=new Float64Array(SQUIRREL_BONES),selected=new Uint8Array(4),selectedWeights=new Float32Array(4);
  const p=new T.Vector3(),n=new T.Vector3(),flow=new T.Vector3(),across=new T.Vector3(),mid=new T.Vector3(),tip=new T.Vector3(),at=new T.Vector3();
  const baseColor=new T.Color(),middleColor=new T.Color(),tipColor=new T.Color();
  for(let hair=0;hair<count;hair++){
    const sample=rng()*total;let lo=0,hi=faceCount-1;
    while(lo<hi){const midIndex=(lo+hi)>>>1;if(area[midIndex]!<sample)lo=midIndex+1;else hi=midIndex;}
    const vertices=[vertex(lo*3),vertex(lo*3+1),vertex(lo*3+2)],root=Math.sqrt(rng()),bary=[1-root,root*(1-rng()),0];bary[2]=1-bary[0]!-bary[1]!;
    p.set(0,0,0);n.set(0,0,0);blend.fill(0);
    for(let j=0;j<3;j++){
      const i=vertices[j]!,weight=bary[j]!;p.addScaledVector(a.fromBufferAttribute(points,i),weight);n.addScaledVector(a.fromBufferAttribute(surfaceNormals,i),weight);
      if(skinned)for(let k=0;k<4;k++)blend[joints.getComponent(i,k)]!+=weights.getComponent(i,k)*weight;
    }
    n.normalize();
    if(skinned){
      let sum=0;for(let j=0;j<4;j++){let best=0;for(let k=1;k<blend.length;k++)if(blend[k]!>blend[best]!)best=k;selected[j]=best;selectedWeights[j]=blend[best]!;sum+=blend[best]!;blend[best]=0;}
      for(let j=0;j<4;j++)selectedWeights[j]!/=sum;
    }
    const facial=part==='body'?1-smooth(-.80,-.64,p.z):0;
    flow.set((rng()-.5)*.28+p.x*facial*.6,-.04-facial*.10,1);
    if(part==='body'&&Math.abs(p.x)>.22&&p.y<.02)flow.set(Math.sign(p.x)*.14,-.75,p.z<0?-.3:.4);
    if(part==='ear')flow.set(p.x*.7,1,.05);
    flow.addScaledVector(n,-flow.dot(n));if(flow.lengthSq()<.001)flow.set(1,0,0).cross(n);flow.normalize();
    across.crossVectors(n,flow).normalize();
    const eye=((Math.abs(p.x)-.215)/.045)**2+((p.y-.233)/.058)**2+((p.z+1.019)/.067)**2;
    const nose=(p.x/.052)**2+((p.y-.034)/.030)**2+((p.z+1.320)/.022)**2;
    const eyeClearance=T.MathUtils.lerp(1,smooth(.72,1.8,eye)*smooth(.70,1.30,nose),facial);
    const muzzle=1-smooth(-1.24,-1.08,p.z);
    const length=part==='tail'?.10+rng()*.148:part==='ear'?.012+rng()*.018:(.020+rng()*.041)*T.MathUtils.lerp(1,.62-muzzle*.20,facial)*eyeClearance;
    const width=(part==='tail'?.0017+rng()*.0023:.0008+rng()*.0015)*T.MathUtils.lerp(part==='body'?.88:1,.72,facial)*eyeClearance;
    const lift=part==='tail'?.62:T.MathUtils.lerp(.28,.26,facial);
    // Bow above the skin, then settle toward the coat instead of ending as a straight bristle.
    mid.copy(p).addScaledVector(n,length*lift*.98).addScaledVector(flow,length*.43);
    tip.copy(p).addScaledVector(n,length*lift).addScaledVector(flow,length*.9);
    // Individual banded guard hairs break up the solid base coat without a repeating image texture.
    coatColor(p,part,baseColor);const band=rng(),pale=baseColor.r>.35&&baseColor.g>.30;
    baseColor.multiplyScalar(.57+rng()*.49);middleColor.copy(baseColor);
    if(!pale)middleColor.lerp(band<.30?dark:silver,band<.30?.55:.26);
    else middleColor.multiplyScalar(1.12);
    tipColor.copy(baseColor).lerp(band<.52?silver:dark,pale?.12:part==='tail'?.56:.44);
    if(facial>0){
      coatColor(p,part,color);baseColor.lerp(color,facial*.56);middleColor.lerp(color,facial*.52);
      color.lerp(band<.52?silver:dark,.25);tipColor.lerp(color,facial);
    }
    for(let j=0;j<5;j++){
      if(j<2)at.copy(p).addScaledVector(across,(j===0?-1:1)*width);
      else if(j<4)at.copy(mid).addScaledVector(across,(j===2?-1:1)*width*.59);
      else at.copy(tip);
      const v=hair*5+j;at.toArray(positions,v*3);n.toArray(normals,v*3);(j<2?baseColor:j<4?middleColor:tipColor).toArray(colors,v*3);
      at.sub(p).toArray(offsets,v*3);
      if(skinIndices&&skinWeights){skinIndices.set(selected,v*4);skinWeights.set(selectedWeights,v*4);}
    }
    const v=hair*5;indices.set([v,v+2,v+1,v+1,v+2,v+3,v+2,v+4,v+3],hair*9);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('normal',new T.BufferAttribute(normals,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setAttribute('furOffset',new T.BufferAttribute(offsets,3));geometry.setIndex(new T.BufferAttribute(indices,1));
  if(skinIndices&&skinWeights){geometry.setAttribute('skinIndex',new T.BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new T.BufferAttribute(skinWeights,4));}
  geometry.computeBoundingSphere();return geometry;
}
