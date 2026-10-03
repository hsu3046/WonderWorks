// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
/** Weak local alignment/cohesion. Separation remains the swimming controller's safety force. */
export function localSchooling(index:number,poses:Float64Array,out:{x:number;z:number}){
 const at=index*4,x=poses[at]!,y=poses[at+1]!,z=poses[at+2]!,yaw=poses[at+3]!;
 let cx=0,cz=0,ax=0,az=0,weight=0;
 for(let j=0;j<poses.length;j+=4){
  if(j===at||Math.abs(y-poses[j+1]!)>.45)continue;
  const dx=poses[j]!-x,dz=poses[j+2]!-z,d2=dx*dx+dz*dz;
  if(d2<.65||d2>5.76)continue;
  const distance=Math.sqrt(d2);
  if((Math.cos(yaw)*dx+Math.sin(yaw)*dz)/distance<-.25)continue;
  const w=(1-distance/2.4)**2;
  cx+=dx*w;cz+=dz*w;ax+=Math.cos(poses[j+3]!)*w;az+=Math.sin(poses[j+3]!)*w;weight+=w;
 }
 out.x=0;out.z=0;
 if(weight>0){
  const length=Math.hypot(cx,cz),fade=Math.min(1,weight*3);
  out.x=fade*((length>0?cx/length*.07:0)+ax/weight*.11);
  out.z=fade*((length>0?cz/length*.07:0)+az/weight*.11);
 }
 return out;
}
