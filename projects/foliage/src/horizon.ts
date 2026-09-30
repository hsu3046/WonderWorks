// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {smooth,type Settings} from './state';
import type {LivingUniforms} from './tree';

/** A painted 360° mountain range beyond the seasonal woodland; one draw, no shadows. */
export function createHorizon(u:LivingUniforms,invalidate:()=>void,onError:(message:string)=>void){
 let disposed=false;
 const map=new T.TextureLoader().load('./landscape/foliage-mountain-v1.webp',texture=>{
  if(disposed){texture.dispose();return;}invalidate();
 },undefined,error=>{if(!disposed){console.error('Horizon image could not load',error);onError('The distant landscape could not load. Reload to restore it.');}});
 map.colorSpace=T.SRGBColorSpace;map.wrapS=T.MirroredRepeatWrapping;map.repeat.x=4;map.anisotropy=2;
 const uniforms={uHorizonYear:u.year,uHorizonSnow:u.snow,uHorizonDay:{value:1},uHorizonCloud:{value:0},uHorizonWarmth:{value:0},uHorizonFlash:{value:0}};
 const material=new T.MeshBasicMaterial({map,side:T.BackSide,transparent:true,alphaTest:.035,depthWrite:false,fog:false});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec2 vHorizonUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHorizonUv=uv;');
  shader.fragmentShader='uniform float uHorizonYear,uHorizonSnow,uHorizonDay,uHorizonCloud,uHorizonWarmth,uHorizonFlash;varying vec2 vHorizonUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float lowerForest=1.-smoothstep(.26,.7,vHorizonUv.y);
   float autumn=smoothstep(.63,.84,uHorizonYear);
   float spring=smoothstep(.2,.3,uHorizonYear)*(1.-smoothstep(.36,.5,uHorizonYear));
   float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb*=mix(vec3(1.),vec3(.94,1.08,.88),spring*lowerForest);
   diffuseColor.rgb=mix(diffuseColor.rgb,luminance*vec3(1.38,1.03,.67),autumn*lowerForest*.65);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.76,.81)*(.7+luminance*.5),uHorizonSnow*.7);
   vec3 haze=mix(vec3(.31,.43,.46),vec3(.06,.09,.14),uHorizonCloud);
   diffuseColor.rgb=mix(diffuseColor.rgb,haze,.13+uHorizonCloud*.22);
   diffuseColor.rgb*=mix(vec3(1.),vec3(1.22,.86,.67),uHorizonWarmth);
   diffuseColor.rgb*=.055+.945*uHorizonDay;
   diffuseColor.rgb+=uHorizonFlash*.22;
  `);
 };
 const geometry=new T.CylinderGeometry(122,122,80,128,1,true).translate(0,23,0);
 const mesh=new T.Mesh(geometry,material);mesh.name='Painted distant mountain range';mesh.renderOrder=-1;
 return {mesh,update(settings:Settings,day:number,cloud:number,flash:number){
  uniforms.uHorizonDay.value=day;uniforms.uHorizonCloud.value=cloud;uniforms.uHorizonFlash.value=flash;
  uniforms.uHorizonWarmth.value=(smooth(15.5,18.5,settings.hour)*(1-smooth(19.5,21,settings.hour))+smooth(4.5,6,settings.hour)*(1-smooth(7,9,settings.hour)))*day;
 },dispose(){disposed=true;map.dispose();geometry.dispose();material.dispose();}};
}
