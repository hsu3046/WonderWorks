// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {BRANCH_CLEARANCE,CLIMB_BASE,PERCH,clamp,runBranchTop} from './landscape.ts';
import {FOOT_HEIGHT,type Point} from './landing.ts';
import {renderedTerrainHeight} from './terrain-surface.ts';

export const WALK_SPEED=3.2;
export interface WalkObstacle {x:number;z:number;radius:number;}
export interface WalkState {speed:number;travel:number;gait:number;yaw:number;pitch:number;roll:number;branchDistance:number;blocked:boolean;}
export const createWalkState=(yaw=0):WalkState=>({speed:0,travel:0,gait:0,yaw,pitch:0,roll:0,branchDistance:0,blocked:false});
const branchLength=Math.hypot(CLIMB_BASE.x-PERCH.x,CLIMB_BASE.z-PERCH.z);
const branchX=(CLIMB_BASE.x-PERCH.x)/branchLength,branchZ=(CLIMB_BASE.z-PERCH.z)/branchLength;
export function walkingBranchPosition(distance:number,out:Point):Point{
  const d=clamp(distance,0,6);out.x=PERCH.x+branchX*d;out.z=PERCH.z+branchZ*d;
  out.y=runBranchTop(out.x,out.z)+BRANCH_CLEARANCE;return out;
}
function incline(x:number,z:number){
  const h=renderedTerrainHeight(x,z),dx=renderedTerrainHeight(x+.6,z)-renderedTerrainHeight(x-.6,z),dz=renderedTerrainHeight(x,z+.6)-renderedTerrainHeight(x,z-.6);
  return {h,dx:dx/1.2,dz:dz/1.2};
}
export function walkable(x:number,z:number,obstacles:readonly WalkObstacle[]):boolean{
  // Body-sized probes stop before steep cliff faces, water and solid props, not after crossing them.
  if(Math.abs(x)>395||z< -640||z>200)return false;
  for(const [ox,oz] of [[0,0],[1.8,0],[-1.8,0],[0,1.8],[0,-1.8]]){
    const sample=incline(x+ox!,z+oz!);if(sample.h<2||Math.hypot(sample.dx,sample.dz)>.65)return false;
  }
  return !obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+1.8);
}
/** One shared scene clock; distance drives feet even when pace or frame rate changes. */
export function advanceWalk(state:WalkState,position:Point,forward:number,right:number,cameraYaw:number,dt:number,onBranch:boolean,obstacles:readonly WalkObstacle[]):void{
  if(dt<=0)return;
  const magnitude=Math.min(1,Math.hypot(forward,right));state.speed+=(WALK_SPEED*magnitude-state.speed)*(1-Math.exp(-dt*(magnitude?9:16)));
  let dx=0,dz=0;
  if(onBranch){
    const direction=clamp(forward-right,-1,1),before=state.branchDistance;
    state.branchDistance=clamp(before+direction*state.speed*dt,0,6);walkingBranchPosition(state.branchDistance,position);
    dx=branchX*(state.branchDistance-before);dz=branchZ*(state.branchDistance-before);
  }else if(magnitude){
    const length=Math.hypot(forward,right),vx=(-Math.sin(cameraYaw)*forward+Math.cos(cameraYaw)*right)/length,vz=(-Math.cos(cameraYaw)*forward-Math.sin(cameraYaw)*right)/length;
    const steps=Math.max(1,Math.ceil(state.speed*dt/.16)),step=state.speed*dt/steps;
    for(let i=0;i<steps;i++){
      const x=position.x,z=position.z;
      if(walkable(x+vx*step,z+vz*step,obstacles)){position.x+=vx*step;position.z+=vz*step;}
      else if(walkable(x+vx*step,z,obstacles))position.x+=vx*step;
      else if(walkable(x,z+vz*step,obstacles))position.z+=vz*step;
      dx+=position.x-x;dz+=position.z-z;
    }
  }
  const moved=Math.hypot(dx,dz);state.travel+=moved;state.blocked=magnitude>0&&moved<1e-6;
  const gait=moved>1e-6?Math.min(1,moved/dt/WALK_SPEED):0;state.gait+=(gait-state.gait)*(1-Math.exp(-dt*14));
  if(moved>1e-6){const target=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(target-state.yaw),Math.cos(target-state.yaw));state.yaw+=delta*(1-Math.exp(-dt*12));}
  if(onBranch){
    const ahead=runBranchTop(position.x-Math.sin(state.yaw)*.5,position.z-Math.cos(state.yaw)*.5),behind=runBranchTop(position.x+Math.sin(state.yaw)*.5,position.z+Math.cos(state.yaw)*.5);
    state.pitch=clamp(Math.atan(ahead-behind),-.2,.2);state.roll=0;
  }else{
    const ground=incline(position.x,position.z),sin=Math.sin(state.yaw),cos=Math.cos(state.yaw);
    state.pitch=Math.atan(-ground.dx*sin-ground.dz*cos);state.roll=Math.atan(ground.dx*cos-ground.dz*sin);
    // The body follows the local plane; each paw conforms to curvature in the rig.
    position.y=ground.h+FOOT_HEIGHT*Math.sqrt(1+ground.dx**2+ground.dz**2)+.035;
  }
}
