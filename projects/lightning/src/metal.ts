// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {DOME_RADIUS,DOME_HEIGHT,domeNormal} from './conductor';
import type {Discharge} from './bolt';
import {MAX_DISCHARGES} from './storm-timing';

/** A small baked studio environment: metal needs something to reflect. */
function studioEnvironment(renderer:T.WebGLRenderer){
 // Keep the existing 8-bit fallback usable on devices without HDR render targets.
 if(!renderer.extensions.has('EXT_color_buffer_float'))return null;
 const room=new T.Scene();room.background=new T.Color(.045,.052,.065);
 const panels:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[];
 function panel(position:[number,number,number],width:number,height:number,color:T.Color){
  const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({color,side:T.DoubleSide}));
  mesh.position.set(...position);mesh.lookAt(0,0,0);room.add(mesh);panels.push(mesh);
 }
 panel([-4,4,2],2.7,6,new T.Color(3.7,3.9,4.2));
 panel([4,2,-3],1.2,6,new T.Color(1.3,1.65,2.0));
 panel([1,6,-1],5,2.7,new T.Color(1.0,1.08,1.2));
 panel([0,1,6],6,.9,new T.Color(.65,.7,.8));
 panel([0,-3,0],12,12,new T.Color(.012,.014,.018));
 const pmrem=new T.PMREMGenerator(renderer),map=pmrem.fromScene(room,.025,.1,30,{size:128});
 pmrem.dispose();for(const panel of panels){panel.geometry.dispose();panel.material.dispose();}
 return map;
}

export function createMetalConductor(renderer:T.WebGLRenderer){
 const environment=studioEnvironment(renderer);
 const uniforms={uMetalFlash:{value:new Float32Array(MAX_DISCHARGES)},uContactPower:{value:new Float32Array(MAX_DISCHARGES)},uContact:{value:Array.from({length:MAX_DISCHARGES},()=>new T.Vector3(0,DOME_HEIGHT,0))},uContactNormal:{value:Array.from({length:MAX_DISCHARGES},()=>new T.Vector3(0,1,0))},uArcPoints:{value:Array.from({length:MAX_DISCHARGES*9},()=>new T.Vector3())}};
 const material=new T.MeshPhysicalMaterial({color:'#a6afb9',metalness:1,roughness:.22,envMap:environment?.texture??null,envMapIntensity:1.1});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vMetalPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvMetalPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=`varying vec3 vMetalPosition;uniform float uMetalFlash[${MAX_DISCHARGES}],uContactPower[${MAX_DISCHARGES}];uniform vec3 uContact[${MAX_DISCHARGES}],uContactNormal[${MAX_DISCHARGES}],uArcPoints[${MAX_DISCHARGES*9}];
  // Distance from the mirror ray to a finite lightning segment. This reuses the
  // actual channel, with roughness broadening, rather than a painted highlight.
  float reflectedArc(vec3 p,vec3 ray,vec3 a,vec3 b){
   vec3 segment=b-a,offset=p-a;float c=max(dot(segment,segment),.00001),q=dot(ray,segment);
   float rayT=(q*dot(segment,offset)-c*dot(ray,offset))/max(.00001,c-q*q);
   float u=clamp((dot(segment,offset)+q*max(0.,rayT))/c,0.,1.);
   vec3 closest=a+segment*u;rayT=max(0.,dot(closest-p,ray));
   float distance=length(p+ray*rayT-closest),spread=.018+rayT*.028;
   return exp(-distance*distance/(spread*spread))/(1.+rayT*.35);
  }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float latitude=atan(length(vMetalPosition.xz),max(.001,vMetalPosition.y));
   float footprint=fwidth(latitude)*950.;
   float brushing=sin(latitude*950.)*exp(-footprint*footprint);
   roughnessFactor=clamp(roughnessFactor+brushing*.018,.16,.32);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 worldNormal=normalize(inverseTransformDirection(normal,viewMatrix));
   vec3 towardEye=normalize(cameraPosition-vMetalPosition),mirrorRay=reflect(-towardEye,worldNormal);
   for(int j=0;j<${MAX_DISCHARGES};j++){
    if(uMetalFlash[j]>.001){
     float reflected=0.;
     for(int i=0;i<8;i++)reflected=max(reflected,reflectedArc(vMetalPosition,mirrorRay,uArcPoints[j*9+i],uArcPoints[j*9+i+1]));
     outgoingLight+=vec3(.66,.77,1.)*reflected*uMetalFlash[j]*2.8;
    }
    if(uContactPower[j]>.001){
     vec3 delta=vMetalPosition-uContact[j];float d2=dot(delta,delta);
     float facing=smoothstep(.15,.65,dot(worldNormal,uContactNormal[j]));
     float weld=exp(-d2/.00055)*22.+exp(-d2/.009)*.65;
     outgoingLight+=vec3(.77,.85,1.)*weld*facing*uContactPower[j];
    }
   }
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'fulgur-conductor-contact-v2';
 const dome=new T.Mesh(new T.SphereGeometry(DOME_RADIUS,96,48,0,Math.PI*2,0,Math.PI/2),material);dome.scale.y=DOME_HEIGHT/DOME_RADIUS;
 const rimMaterial=new T.MeshStandardMaterial({color:'#8d98a4',metalness:1,roughness:.28,envMap:environment?.texture??null,envMapIntensity:1});
 const rim=new T.Mesh(new T.TorusGeometry(DOME_RADIUS-.01,.025,12,120),rimMaterial);rim.rotation.x=Math.PI/2;rim.position.y=.018;
 const contactLight=new T.PointLight('#d5e2ff',0,2.8,2);
 const attached=Array.from({length:MAX_DISCHARGES},()=>false);
 return {dome,rim,contactLight,set(index:number,discharge:Discharge,onDome:boolean){
  attached[index]=onDome;uniforms.uContact.value[index]!.fromArray(discharge.target);uniforms.uContactNormal.value[index]!.fromArray(onDome?domeNormal(discharge.target):[0,1,0]);
  const trunk=discharge.segments.filter(segment=>segment.branch===0);
  for(let i=0;i<9;i++)uniforms.uArcPoints.value[index*9+i]!.fromArray(i===8?discharge.target:trunk[Math.floor(i/8*trunk.length)]!.from);
 },update(flashes:ArrayLike<number>,leaders:ArrayLike<number>,domeVisible:boolean){
  dome.visible=rim.visible=domeVisible;let strongest=0;
  for(let i=0;i<MAX_DISCHARGES;i++){
   const flash=flashes[i]??0;
   uniforms.uMetalFlash.value[i]=flash;
   uniforms.uContactPower.value[i]=attached[i]?flash+(leaders[i]??0)*.04:0;
   if(flash>(flashes[strongest]??0))strongest=i;
  }
  // Analytic surface emission/reflections cover every contact; one shared fill
  // light follows the strongest return instead of adding permanent point lights.
  contactLight.position.copy(uniforms.uContact.value[strongest]!).addScaledVector(uniforms.uContactNormal.value[strongest]!, .12);
  contactLight.intensity=(attached[strongest]?3.5:1.6)*(flashes[strongest]??0);
  contactLight.visible=attached[strongest]?domeVisible:true;
 },dispose(){environment?.dispose();}};
}
