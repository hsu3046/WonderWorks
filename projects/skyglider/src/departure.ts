// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {BRANCH_CLEARANCE,CLIMB_BASE,CLIMB_DURATION,CLIMB_START_HEIGHT,CLIMB_SIDE_HEIGHT,CLIMB_SIDE_TOP,CLIMB_TOP,CLIMB_TRUNK,GLIDE_DURATION,LAUNCH,PERCH,ROUTE,TOP_BRANCH,TRUNK_AXIS,TRUNK_LENGTH,TRUNK_NORMAL,clamp,runBranchTop,smooth,trunkBodyPosition} from './landscape.ts';

export const GRIP_AT=2.4,CLIMB_SIDE_AT=7.65,CLIMB_TOP_AT=8.5,RELEASE_AT=8.95;
const axis=new T.Vector3(...TRUNK_AXIS),normal=new T.Vector3(...TRUNK_NORMAL),right=new T.Vector3().crossVectors(axis,normal).normalize();
const climbOrientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,normal,axis.clone().negate()));
const approachYaw=Math.atan2(PERCH.x-CLIMB_BASE.x,PERCH.z-CLIMB_BASE.z);
const approachOrientation=new T.Quaternion().setFromEuler(new T.Euler(0,approachYaw,0,'YXZ'));
const topHeading=new T.Vector3(...TOP_BRANCH.b).sub(new T.Vector3(...TOP_BRANCH.a)).normalize();
const topOrientation=new T.Quaternion().setFromEuler(new T.Euler(0,Math.atan2(-topHeading.x,-topHeading.z),0,'YXZ'));
const route=new T.CatmullRomCurve3(ROUTE.map(p=>new T.Vector3(...p)),false,'centripetal');route.arcLengthDivisions=400;route.updateArcLengths();
export const DEPARTURE_EXIT_VELOCITY=route.getTangentAt(0).multiplyScalar(route.getLength()/GLIDE_DURATION);
const exitHeading=DEPARTURE_EXIT_VELOCITY.clone().normalize();
const exitOrientation=new T.Quaternion().setFromEuler(new T.Euler(Math.asin(exitHeading.y)*.55,Math.atan2(-exitHeading.x,-exitHeading.z),0,'YXZ'));
const climbLength=(CLIMB_SIDE_HEIGHT-CLIMB_START_HEIGHT)*TRUNK_LENGTH/(CLIMB_TRUNK.b[1]-CLIMB_TRUNK.a[1]);

/** Branch approach → bark contact → gather → outward push → tour with matching exit velocity. */
export function departurePosition(elapsed:number,start=PERCH){
  const time=clamp(elapsed,0,CLIMB_DURATION),runDistance=Math.hypot(CLIMB_BASE.x-start.x,CLIMB_BASE.z-start.z);
  let x:number,y:number,z:number,climbing=0,gait=1,spread=0,travel=0,ground=0;
  if(time<GRIP_AT){
    const t=smooth(0,GRIP_AT,time),acquire=smooth(1.4,GRIP_AT,time);
    x=T.MathUtils.lerp(start.x,CLIMB_BASE.x,t);z=T.MathUtils.lerp(start.z,CLIMB_BASE.z,t);
    y=T.MathUtils.lerp(runBranchTop(x,z)+BRANCH_CLEARANCE,CLIMB_BASE.y,acquire);
    climbing=smooth(1.4,2.2,time);travel=runDistance*t;
  }else if(time<=CLIMB_SIDE_AT){
    const t=smooth(GRIP_AT,CLIMB_SIDE_AT,time),p=trunkBodyPosition(T.MathUtils.lerp(CLIMB_START_HEIGHT,CLIMB_SIDE_HEIGHT,t));
    ({x,y,z}=p);climbing=1;gait=1-smooth(CLIMB_SIDE_AT-.28,CLIMB_SIDE_AT,time);travel=runDistance+climbLength*t;
  }else if(time<=CLIMB_TOP_AT){
    const t=(time-CLIMB_SIDE_AT)/(CLIMB_TOP_AT-CLIMB_SIDE_AT),lift=smooth(0,.62,t),across=smooth(.32,1,t);
    // Clear the end of the trunk vertically before rolling onto the highest bough.
    x=T.MathUtils.lerp(CLIMB_SIDE_TOP.x,CLIMB_TOP.x,across);z=T.MathUtils.lerp(CLIMB_SIDE_TOP.z,CLIMB_TOP.z,across);
    y=T.MathUtils.lerp(CLIMB_SIDE_TOP.y,CLIMB_TOP.y+.35,lift)-.35*smooth(.62,1,t);
    climbing=1-smooth(.35,1,t);gait=0;ground=1-climbing;travel=runDistance+climbLength;
  }else if(time<RELEASE_AT){
    const t=(time-CLIMB_TOP_AT)/(RELEASE_AT-CLIMB_TOP_AT);
    x=CLIMB_TOP.x;y=CLIMB_TOP.y-.12*smooth(0,1,t);z=CLIMB_TOP.z;
    ground=1;gait=0;travel=runDistance+climbLength;
  }else{
    const duration=CLIMB_DURATION-RELEASE_AT,t=(time-RELEASE_AT)/duration,t2=t*t,t3=t2*t;
    const h01=-2*t3+3*t2,h11=t3-t2;
    x=CLIMB_TOP.x+(LAUNCH.x-CLIMB_TOP.x)*h01+DEPARTURE_EXIT_VELOCITY.x*duration*h11;
    y=CLIMB_TOP.y-.12+(LAUNCH.y-CLIMB_TOP.y+.12)*h01+DEPARTURE_EXIT_VELOCITY.y*duration*h11+1.15*16*t2*(1-t)**2;
    z=CLIMB_TOP.z+(LAUNCH.z-CLIMB_TOP.z)*h01+DEPARTURE_EXIT_VELOCITY.z*duration*h11;
    ground=1-smooth(RELEASE_AT,RELEASE_AT+.25,time);gait=0;
    spread=smooth(RELEASE_AT+.32,CLIMB_DURATION,time);travel=runDistance+climbLength;
  }
  // Curl the brush away from the departure bough while standing, then let it hang once above it.
  const tailLift=climbing*(1-smooth(CLIMB_BASE.y,CLIMB_BASE.y+4.5,y));
  return {x,y,z,climbing,gait,spread,travel,ground,tailLift,launch:clamp((time-CLIMB_TOP_AT)/(CLIMB_DURATION-CLIMB_TOP_AT),0,1)};
}

export function departureOrientation(elapsed:number,out:T.Quaternion):T.Quaternion{
  if(elapsed<GRIP_AT)return out.copy(approachOrientation).slerp(climbOrientation,smooth(1.4,2.2,elapsed));
  if(elapsed<CLIMB_SIDE_AT)return out.copy(climbOrientation);
  if(elapsed<CLIMB_TOP_AT)return out.copy(climbOrientation).slerp(topOrientation,smooth(CLIMB_SIDE_AT+.30,CLIMB_TOP_AT,elapsed));
  return out.copy(topOrientation).slerp(exitOrientation,smooth(RELEASE_AT,CLIMB_DURATION,elapsed));
}
