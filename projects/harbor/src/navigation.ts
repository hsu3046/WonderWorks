// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
export interface BoatPose { x:number; z:number; heading:number; speed:number; turnRate:number }
export interface HelmInput { throttle:number; rudder:number }
export const speedModes = [{name:'Quiet',speed:1.4},{name:'Cruise',speed:2.6},{name:'Swift',speed:4.2}] as const;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const islands=[[-21,-10,14,12],[-35,-55,19,16],[32,-64,19,18],[65,-100,23,25],[-75,-110,28,23],[2,-135,30,20],[92,-180,29,25],[-120,-210,42,35]];
export function navigable(x:number,z:number){
 if(x*x+z*z>145*145)return false;
 // Conservative waterline bounds include hull clearance, dock steps and moored sailboat.
 for(const [cx,cz,w,d] of islands)if(((x-cx)/w)**2+((z-cz)/d)**2<1)return false;
 for(const [x0,x1,z0,z1] of [[-7.3,7.3,-6.1,7.6],[3.5,9.8,-6.8,9.8],[-12.4,-4,-4,2],[7,13,-5.8,5.3]])if(x>x0&&x<x1&&z>z0&&z<z1)return false;
 return true;
}
export function createNavigation(){
 const pose:BoatPose={x:3,z:16,heading:Math.PI/2,speed:.225,turnRate:0};
 let piloted=false,gear=1,autoTime=0;
 function reset(){Object.assign(pose,{x:3,z:16,heading:Math.PI/2,speed:.225,turnRate:0});piloted=false;gear=1;autoTime=0;}
 function takeHelm(){piloted=true;}
 function cycleSpeed(){gear=(gear+1)%speedModes.length;}
 function update(dt:number,input:HelmInput){
  if(dt<=0)return;
  if(!piloted){autoTime+=dt;const a=autoTime*.025;pose.x=3+Math.sin(a)*9;pose.z=14+Math.cos(a)*2;pose.heading=Math.atan2(9*Math.cos(a),-2*Math.sin(a));pose.speed=Math.hypot(9*Math.cos(a),2*Math.sin(a))*.025;return;}
  // Small integration steps give equivalent steering at 30/60/120 Hz.
  const steps=Math.ceil(Math.min(dt,.1)*120),h=Math.min(dt,.1)/steps;
  for(let i=0;i<steps;i++){
   const throttle=clamp(input.throttle,-1,1),rudder=clamp(input.rudder,-1,1),limit=speedModes[gear].speed;
   const wanted=throttle*(throttle<0?limit*.42:limit);
   pose.speed+=(wanted-pose.speed)*(1-Math.exp(-h*(throttle===0?.55:1.1)));
   // +Z is the model's bow: port turns towards +X, starboard towards -X.
   const turn=rudder*.65*Math.tanh(pose.speed/.85);
   pose.turnRate+=(turn-pose.turnRate)*(1-Math.exp(-h*3));pose.heading+=pose.turnRate*h;
   const x=pose.x+Math.sin(pose.heading)*pose.speed*h,z=pose.z+Math.cos(pose.heading)*pose.speed*h;
   if(navigable(x,z)){pose.x=x;pose.z=z;}else{pose.speed=0;pose.turnRate=0;}
  }
 }
 return {pose,update,reset,takeHelm,cycleSpeed,get piloted(){return piloted;},get gear(){return gear;}};
}
