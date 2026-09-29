// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {noiseGLSL} from './shared';
import {frogPose,frogTiming} from './frog-pose';

export async function createFrog(scene:T.Scene,pads:T.Group[],ripple:(x:number,z:number,strength?:number)=>void){
 const pad=pads[0]!;
 const asset=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/montane-frog-hopping.glb`);
 const root=asset.scene;root.scale.setScalar(.72);root.position.y=.009;
 // Face the lily viewpoint independently of the pad's random rotation.
 root.rotation.y=.60;const hopper=new T.Group();scene.add(hopper);hopper.add(root);hopper.position.copy(pad.position);
 // Source: ffish.asia / floraZia.com, CC BY 4.0; see model attribution.
 let body:T.Object3D|undefined;const posed:T.Mesh[]=[],pose=[0,0,0,0];
 root.traverse(o=>{
  if(o.name.includes('Montane'))body=o;
  if(!(o instanceof T.Mesh))return;
  o.castShadow=true;o.receiveShadow=true;if(o.morphTargetInfluences)posed.push(o);
  const materials=Array.isArray(o.material)?o.material:[o.material];
  for(const m of materials){
   if(!(m instanceof T.MeshStandardMaterial))continue;
   if(o.name.includes('Eye')){m.roughness=.17;continue;}
   m.roughness=.46;
   m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFrogSkin;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFrogSkin=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vFrogSkin;${noiseGLSL}`)
    .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     // Submillimetre skin grain in object space, avoiding large plastic-looking bumps.
     float skinGrain=noise2(vFrogSkin.xz*240.+vFrogSkin.y*73.)*.00065;
     vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
     vec3 r1=cross(q1,normal),r2=cross(normal,q0);
     float determinant=dot(q0,r1);
     normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(skinGrain)*r1+dFdy(skinGrain)*r2));`);
   };
   m.customProgramCacheKey=()=> 'stillwater-frog-skin-v1';
  }
 });
 const ground=document.createElement('canvas');ground.width=ground.height=64;
 const ctx=ground.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,4,32,32,31);
 gradient.addColorStop(0,'rgba(18,26,8,.32)');gradient.addColorStop(.55,'rgba(18,26,8,.17)');gradient.addColorStop(1,'rgba(18,26,8,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const map=new T.CanvasTexture(ground);map.colorSpace=T.SRGBColorSpace;
 const shadow=new T.Mesh(new T.PlaneGeometry(.80,.65),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.065;scene.add(shadow);
 let lastTime=0,padIndex=0,nextPad=0,started=-100,nextIdle=13,hops=0,lastReason='rest',hovered=false;
 let startYaw=.60,endYaw=.60;const start=new T.Vector3(),end=new T.Vector3(),center=new T.Vector3();
 const hitSphere=new T.Sphere(center,.65),hit=new T.Vector3();
 const random=()=>{const n=Math.sin(hops*73.15+19.8)*43758.5;return n-Math.floor(n);};
 function hop(time:number,reason:string){
  if(time-started<2)return false;
  const choices=pads.map((p,i)=>({i,d:p.position.distanceTo(hopper.position)})).filter(p=>p.i!==padIndex&&p.i!==2&&p.i!==5&&p.d<2.5&&p.d>.5);
  if(!choices.length)return false;
  nextPad=choices[Math.floor(random()*choices.length)]!.i;start.copy(hopper.position);end.copy(pads[nextPad]!.position);
  startYaw=root.rotation.y;const angle=Math.atan2(end.x-start.x,end.z-start.z);endYaw=startYaw+Math.atan2(Math.sin(angle-startYaw),Math.cos(angle-startYaw));
  started=time;hops++;lastReason=reason;nextIdle=time+14+random()*17;return true;
 }
 return {react(ray:T.Ray,time:number,force:boolean){
  center.copy(hopper.position);center.y+=.22;
  const near=ray.intersectSphere(hitSphere,hit)!==null;
  const entered=near&&!hovered;hovered=near;
  return near&&(force||entered)?hop(time,force?'tap':'pointer'):false;
 },clearHover(){hovered=false;},diagnostics(){return {position:hopper.position.toArray(),pad:padIndex,hops,lastReason,pose:[...pose],jumping:started>-100&&lastTime-started<frogTiming.end};},update(time:number){
  lastTime=time;if(time>nextIdle)hop(time,'idle');
  const age=time-started;frogPose(age,pose);for(const mesh of posed)for(const [i,name] of ['Crouch','Kick','Tuck','Reach'].entries()){const index=mesh.morphTargetDictionary?.[name];if(index!==undefined)mesh.morphTargetInfluences![index]=pose[i]!;}const load=pose[0]!+(age<.40?pose[2]!:0);let squash=1,height=0;
  if(age>=0&&age<frogTiming.takeoff){const p=age/frogTiming.takeoff;squash=1-.13*load;root.rotation.x=-.08*load;root.rotation.y=T.MathUtils.lerp(startYaw,endYaw,p*p*(3-2*p));}
  else if(age>=frogTiming.takeoff&&age<frogTiming.landing){
   const p=(age-frogTiming.takeoff)/(frogTiming.landing-frogTiming.takeoff);end.copy(pads[nextPad]!.position);hopper.position.lerpVectors(start,end,p);
   height=4*p*(1-p)*.67;hopper.position.y+=height;
   squash=1-.13*load+.045*Math.sin(p*Math.PI);root.rotation.x=-.08*load-.26*Math.sin(p*Math.PI*2);
  }else{
   if(age>=frogTiming.landing&&padIndex!==nextPad){padIndex=nextPad;ripple(hopper.position.x,hopper.position.z,.48);}
   hopper.position.copy(pads[padIndex]!.position);
   if(age<frogTiming.end)squash=1-.09*Math.sin((age-frogTiming.landing)/(frogTiming.end-frogTiming.landing)*Math.PI);
   root.rotation.x=Math.sin(time*.63)*.007;
  }
  root.scale.set(.72/Math.sqrt(squash),.72*squash,.72/Math.sqrt(squash));
  if(body)body.scale.y=1+Math.sin(time*2.25)*.008;
  shadow.position.set(hopper.position.x,.064,hopper.position.z);shadow.scale.setScalar(1+height*.3);shadow.material.opacity=1-height*.8;
 }};
}
