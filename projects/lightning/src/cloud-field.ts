// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {exposurePulse,type Discharge,type Point} from './bolt.ts';

export const CLOUD_HEIGHT=4.3;
export interface CloudPose {offset:Point;scale:Point;shear:number}
export function createCloudPose():CloudPose{return {offset:[0,CLOUD_HEIGHT,0],scale:[1,1,1],shear:0};}

/** Slow advection and unequal billow deformation, evaluated once per frame. */
export function updateCloudPose(pose:CloudPose,time:number,wind:number):void {
 const t=time*(.45+Math.max(0,Math.min(1,wind))*.85);
 pose.offset[0]=.23*Math.sin(t*.31)+.09*Math.sin(t*.13);
 pose.offset[1]=CLOUD_HEIGHT+.07*Math.sin(t*.23);
 pose.offset[2]=.15*Math.sin(t*.19+.7);
 pose.scale[0]=1+.025*Math.sin(t*.27);
 pose.scale[1]=1+.04*Math.sin(t*.21+.8);
 pose.scale[2]=1+.02*Math.sin(t*.24+.9);
 pose.shear=.045*Math.sin(t*.32+.6);
}
export function cloudToWorld(p:Point,pose:CloudPose):Point {
 return [(p[0]+p[1]*pose.shear)*pose.scale[0]+pose.offset[0],p[1]*pose.scale[1]+pose.offset[1],p[2]*pose.scale[2]+pose.offset[2]];
}

// Inset regions within the existing volumetric lobes. Broad world-space boxes
// would also sample the empty gaps between those lobes and expose the origin.
const interiors:readonly Point[]=[[-1.25,.10,.35],[-.72,.80,-.45],[.90,.55,.48],[1.45,-.04,-.30],[.15,-.15,-.80],[0,.04,.55]];
export function createCloudSourceSampler(rand:()=>number){
 const recent:Point[]=[];
 return (pose:CloudPose):Point=>{
  let best:Point=[0,0,0],bestScore=-Infinity;
  // A bounded rejection sample avoids the last two neighborhoods without a
  // regular left/right cycle. History stays in cloud space as the volume moves.
  for(let i=0;i<32;i++){
   const center=interiors[Math.floor(rand()*interiors.length)]!;
   const p:Point=[center[0]+(rand()-.5)*.48,center[1]+(rand()-.5)*.32,center[2]+(rand()-.5)*.40];
   const score=recent.reduce((closest,old,index)=>Math.min(closest,Math.hypot(p[0]-old[0],p[1]-old[1],p[2]-old[2])/(index===0?1.05:.75)),Infinity);
   if(score>bestScore){best=p;bestScore=score;}
   if(score>=1)break;
  }
  recent.unshift(best);recent.length=Math.min(recent.length,2);
  return cloudToWorld(best,pose);
 };
}

/** A short optical tail makes in-cloud scattering readable at natural speed. */
export function cloudFlash(age:number,discharge:Discharge,exposure=0):number {
 let energy=0;
 for(const stroke of discharge.strokes)energy+=stroke.strength*exposurePulse(age-stroke.time,Math.max(.045,stroke.decay*2),exposure);
 return Math.min(1.5,energy);
}
