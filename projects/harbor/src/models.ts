// SPDX-License-Identifier: GPL-3.0-only
import * as T from 'three';
import type { BoatPose } from './navigation';
import { rigOars } from './rowing';
import { createWake } from './wake';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTimberSurfaces, isTimber, mapTimber } from './timber';
export async function loadHarbor(scene:T.Scene,onProgress:(text:string)=>void,waterMaterial?:T.ShaderMaterial){
 const timber=createTimberSurfaces();const loader=new GLTFLoader();const glows:T.MeshStandardMaterial[]=[];const lights:T.PointLight[]=[];const prepared=new Set<T.Material>();
 function prepare(root:T.Object3D){root.traverse(o=>{
  if(!(o instanceof T.Mesh))return;o.castShadow=o.receiveShadow=true;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  if(materials.some(m=>isTimber(m.name)))mapTimber(o.geometry);
  for(const material of materials){
   if(!(material instanceof T.MeshStandardMaterial)||prepared.has(material))continue;prepared.add(material);material.side=T.DoubleSide;
   if(/lamp|paper/.test(material.name)){glows.push(material);continue;}
   if(isTimber(material.name)){timber.apply(material);continue;}
   if(/roof|cloth/.test(material.name)){
    const wood=/wood|cedar|plank/.test(material.name);
    // Fine local grain survives GLB export without a downloaded texture pack.
    material.onBeforeCompile=shader=>{
     shader.vertexShader='varying vec3 vGrain;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGrain=position;');
     shader.fragmentShader='varying vec3 vGrain;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=sin(vGrain.${wood?'x':'z'}*${wood?'145.':'210.'}+sin(vGrain.y*7.+vGrain.z*13.)*3.)*.04;
      float wear=sin(vGrain.x*5.+vGrain.y*2.)*sin(vGrain.z*9.)*.08;
      diffuseColor.rgb*=.92+grain+wear;`);
    };
   }
  }
 });}
 onProgress('Opening the tea house…');const house=await loader.loadAsync('./models/harbor.glb');prepare(house.scene);scene.add(house.scene);
 onProgress('Mooring the boats…');const [row,sail]=await Promise.all([loader.loadAsync('./models/rowboat.glb'),loader.loadAsync('./models/sailboat.glb')]);
 const rowing=rigOars(row.scene);prepare(row.scene);prepare(sail.scene);scene.add(row.scene,sail.scene);sail.scene.position.set(10,.12,-.3);sail.scene.rotation.y=.12;
 // Warm light pools use a few real lights; emission and reflection supply the other lanterns.
 for(const [x,y,z] of [[-3,2.8,3.25],[3,2.8,3.25],[6.65,2.8,7.5],[10,2.1,.4]]){const l=new T.PointLight(0xffbd62,9,9,2);l.position.set(x,y,z);scene.add(l);lights.push(l);}
 function sign(text:string,w:number,h:number,x:number,y:number,z:number){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#20271f';ctx.fillRect(0,0,1024,192);ctx.strokeStyle='#998d5c';ctx.lineWidth=4;ctx.strokeRect(12,12,1000,168);ctx.fillStyle='#dbd1ad';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='60px Georgia';ctx.fillText(text,512,103);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,roughness:.7,emissive:0xafa27c,emissiveMap:map,emissiveIntensity:.08}));p.position.set(x,y,z);scene.add(p);}
 sign('T I D E L I G H T   T E A',3.6,.49,0,3.44,3.111);
 // A distant second residence provides a sense of an inhabited island.
 const rear=house.scene.getObjectByName('Teahouse');if(rear){const guest=rear.clone();guest.scale.setScalar(.65);guest.position.set(-21,7,-12);guest.rotation.y=.4;scene.add(guest);}
 const bases=glows.map(m=>m.emissiveIntensity);
 function glow(value:number){glows.forEach((m,i)=>{m.emissiveIntensity=bases[i]*(.15+value*1.5);});lights.forEach(l=>{l.intensity=4+value*16;});}
 const boatPoint=new T.Vector3();
 function update(t:number,wind:number,pose:BoatPose){
  rowing.update(t,pose);
  boatPoint.set(pose.x,.16+Math.sin(t*1.3)*(.018+wind*.045),pose.z);row.scene.position.copy(boatPoint);row.scene.rotation.set(Math.sin(t*1.1)*.018,pose.heading,Math.sin(t*1.6)*(.025+wind*.04)-pose.turnRate*pose.speed*.035);
  sail.scene.position.y=.12+Math.sin(t*.83)*(.045+wind*.035);sail.scene.rotation.z=Math.sin(t*.6)*(.012+wind*.022);
 }
 const wake=createWake(scene,waterMaterial);
 glow(.7);return{update,updateWake:wake.update,resetWake:wake.reset,glow,boatPoint,setRain:timber.setRain,rowingState:()=>({phase:rowing.phase,effort:rowing.effort})};
}
