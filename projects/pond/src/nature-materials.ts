// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// PBR photographs: Poly Haven, CC0. See public/textures/ATTRIBUTION.md.
import * as T from 'three';
import {noiseGLSL,uTime} from './shared';
import {causticGLSL,waterUniforms} from './water-field';

export async function createNatureMaterials(){
 const loader=new T.TextureLoader();
 const sets=await Promise.all(['rock_boulder_dry','bark_brown_02','forest_ground_04'].map(async name=>{
  const maps=await Promise.all(['diff','nor_gl','rough'].map(async kind=>{
   const t=await loader.loadAsync(`${import.meta.env.BASE_URL}textures/${name}_${kind}_1k.jpg`);
   t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;
   if(kind==='diff')t.colorSpace=T.SRGBColorSpace;
   return t;
  }));
  return new T.MeshStandardMaterial({map:maps[0],normalMap:maps[1],roughnessMap:maps[2],roughness:.92,normalScale:new T.Vector2(.55,.55)});
 }));
 const [stone,bark,soil]=sets as [T.MeshStandardMaterial,T.MeshStandardMaterial,T.MeshStandardMaterial];
 // World-space triplanar mapping keeps merged, rotated boulders free from stretched UVs.
 stone.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,waterUniforms);
  shader.uniforms.uNatureTime=uTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStoneP;varying vec3 vStoneN;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvStoneP=(modelMatrix*vec4(position,1.)).xyz;vStoneN=mat3(modelMatrix)*normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vStoneP;varying vec3 vStoneN;uniform float uNatureTime;${noiseGLSL}${causticGLSL}
   vec3 stoneWeights(){vec3 w=pow(abs(normalize(vStoneN)),vec3(4.));return w/(w.x+w.y+w.z);}
   vec4 stoneSample(sampler2D tex){vec3 p=vStoneP*.72,w=stoneWeights();return texture2D(tex,p.yz)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}`)
   .replace('#include <map_fragment>',`diffuseColor*=stoneSample(map);
    float wet=1.-smoothstep(-.06,.10,vStoneP.y);
    float moss=smoothstep(.35,.72,noise2(vStoneP.xz*1.8))*smoothstep(.24,.8,normalize(vStoneN).y)*(1.-smoothstep(.1,1.7,vStoneP.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.48,.64,.32),moss*.5);
    diffuseColor.rgb*=mix(1.,.60,wet);`)
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*stoneSample(roughnessMap).g;roughnessFactor=mix(roughnessFactor,.38,wet*.65);')
   .replace('#include <normal_fragment_maps>',`vec3 p=vStoneP*.72,w=stoneWeights(),sgn=sign(vStoneN);
    vec3 nx=texture2D(normalMap,p.yz).xyz*2.-1.,ny=texture2D(normalMap,p.xz).xyz*2.-1.,nz=texture2D(normalMap,p.xy).xyz*2.-1.;
    vec3 detail=normalize(vec3(nx.z*sgn.x,nx.x,nx.y)*w.x+vec3(ny.x,ny.z*sgn.y,ny.y)*w.y+vec3(nz.x,nz.y,nz.z*sgn.z)*w.z);
    normal=normalize(mat3(viewMatrix)*normalize(mix(normalize(vStoneN),detail,.56)));`)
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(.15,.18,.13)*causticLight(vStoneP)*wet;');
 };
 stone.customProgramCacheKey=()=> 'pond-rock-triplanar-v1';
 stone.color.set('#acafa0');
 bark.color.set('#b3ae9a');bark.normalScale.setScalar(.65);
 soil.color.set('#8b9876');soil.normalScale.setScalar(.45);
 let meadowMap:T.Texture;
 try{meadowMap=await loader.loadAsync(`${import.meta.env.BASE_URL}landscape/meadow-ground-v1.webp`);}
 catch(cause){throw new Error('The meadow texture could not load. Please reload the garden.',{cause});}
 meadowMap.colorSpace=T.SRGBColorSpace;
 meadowMap.wrapS=meadowMap.wrapT=T.MirroredRepeatWrapping;meadowMap.anisotropy=16;
 // Painted groundcover fills the gaps beneath the existing grass instances.
 // Keep the pond's soil maps separate; their roots/stone normals do not match leaves.
 const meadow=new T.MeshStandardMaterial({map:meadowMap,bumpMap:meadowMap,bumpScale:.018,
  color:'#ced6b5',roughness:.98,envMapIntensity:.12});
 return {stone,bark,soil,meadow};
}

/** Thin leaves retain their silhouette, with a midrib, finer veins and uneven pigment. */
export function detailFoliage(material:T.MeshStandardMaterial,grass=false){
 material.onBeforeCompile=shader=>{
  shader.uniforms.uNatureTime=uTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
   uniform float uNatureTime;varying vec3 vLeafLocal;varying float vLeafSeed;`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vLeafLocal=position;vec3 anchor=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vLeafSeed=anchor.x*2.7+anchor.z*1.9;
    float tip=${grass?'position.y/.4':'position.z/1.15'};
    float wind=sin(uNatureTime*1.4+anchor.x*.53+anchor.z*.37)+.4*sin(uNatureTime*2.7+vLeafSeed);
    transformed.x+=wind*tip*tip*${grass?'.028':'.065'};
    transformed.y+=sin(uNatureTime*1.1+vLeafSeed)*tip*.022;
    transformed.z+=cos(uNatureTime*.9+anchor.z)*tip*tip*.027;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vLeafLocal;varying float vLeafSeed;${noiseGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    ${grass?`float tip=clamp(vLeafLocal.y/.4,0.,1.);diffuseColor.rgb*=mix(vec3(.35,.42,.27),vec3(.95,1.,.71),tip);`:`
    float rib=exp(-abs(vLeafLocal.x)*100.);
    float veins=pow(.5+.5*cos((vLeafLocal.z-abs(vLeafLocal.x)*.65)*95.),18.)*.14;
    float pigment=noise2(vLeafLocal.xz*32.+vLeafSeed);
    diffuseColor.rgb*=.72+.25*pigment;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.12,1.10,.75),rib*.28+veins);`}`);
 };
 material.customProgramCacheKey=()=> `pond-foliage-detail-${grass}`;
 return material;
}
