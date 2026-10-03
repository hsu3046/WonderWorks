// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {CLEARINGS,clamp,smooth,terrainHeight} from './landscape.ts';

export interface Point {x:number;y:number;z:number;}
export interface LandingPlan {start:Point;end:Point;controlA:Point;controlB:Point;heights:number[];slopes:number[];duration:number;name:string;}
export const FOOT_HEIGHT=.72;
const SAMPLES=400;

function horizontalPosition(plan:LandingPlan,t:number,out:Point):void {
  const h=smooth(0,1,t),s=1-h;
  out.x=s*s*s*plan.start.x+3*s*s*h*plan.controlA.x+3*s*h*h*plan.controlB.x+h*h*h*plan.end.x;
  out.z=s*s*s*plan.start.z+3*s*s*h*plan.controlA.z+3*s*h*h*plan.controlB.z+h*h*h*plan.end.z;
}

/** Plan once from the actual steered position: switching modes never snaps back onto the tour. */
export function planLanding(start:Point,heading:Point):LandingPlan {
  const candidates=CLEARINGS.filter(site=>site.y+FOOT_HEIGHT<start.y-1);
  const sites=candidates.length?candidates:CLEARINGS;
  const site=sites.reduce((best,item)=>Math.hypot(start.x-item.x,start.z-item.z)<Math.hypot(start.x-best.x,start.z-best.z)?item:best);
  const end={x:site.x,y:site.y+FOOT_HEIGHT,z:site.z};
  const dx=end.x-start.x,dz=end.z-start.z,distance=Math.hypot(dx,dz),turn=Math.min(12,distance*.22);
  const headingLength=Math.hypot(heading.x,heading.z)||1,directionLength=distance||1;
  const plan:LandingPlan={start:{...start},end,
    controlA:{x:start.x+heading.x/headingLength*turn,y:0,z:start.z+heading.z/headingLength*turn},
    controlB:{x:end.x-dx/directionLength*turn,y:0,z:end.z-dz/directionLength*turn},
    heights:[],slopes:[],duration:clamp(distance/12+Math.abs(start.y-end.y)/9,5,17),name:site.name};
  const point={x:0,y:0,z:0};
  // Raise the approach only where terrain/canopy requires it, then flare inside the reserved clearing.
  for(let i=0;i<=SAMPLES;i++){
    const t=i/SAMPLES;horizontalPosition(plan,t,point);
    const fromStart=Math.hypot(point.x-start.x,point.z-start.z),toEnd=Math.hypot(point.x-end.x,point.z-end.z);
    const clearance=FOOT_HEIGHT+22*smooth(8,28,toEnd)*smooth(0,28,fromStart);
    const floor=terrainHeight(point.x,point.z)+clearance;
    const base=start.y+(end.y-start.y)*smooth(0,1,t);
    plan.heights.push(Math.max(base,floor)+.18*Math.sin(t*Math.PI));
  }
  plan.heights[0]=start.y;plan.heights[SAMPLES]=end.y;
  // Monotone Hermite interpolation rounds the sampled terrain envelope without overshooting it.
  for(let i=0;i<=SAMPLES;i++){
    if(i===0||i===SAMPLES){plan.slopes.push(0);continue;}
    const before=plan.heights[i]!-plan.heights[i-1]!,after=plan.heights[i+1]!-plan.heights[i]!;
    plan.slopes.push(before*after>0?2*before*after/(before+after):0);
  }
  return plan;
}

/** Caller-owned output keeps the animation path allocation-free. Progress is clamped at both ends. */
export function landingPosition(plan:LandingPlan,progress:number,out:Point):Point {
  const t=clamp(progress,0,1);horizontalPosition(plan,t,out);
  const index=Math.min(SAMPLES-1,Math.floor(t*SAMPLES)),f=t*SAMPLES-index,f2=f*f,f3=f2*f;
  out.y=(2*f3-3*f2+1)*plan.heights[index]!+(f3-2*f2+f)*plan.slopes[index]!+(-2*f3+3*f2)*plan.heights[index+1]!+(f3-f2)*plan.slopes[index+1]!;
  return out;
}
