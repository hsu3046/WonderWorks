// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
export const WHALE_PERIOD=36;
export const WHALE_SCALE=2.5;
export const WHALE_IMPACT_PHASE=28.6;
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
/** A long surface passage, then a head-first dive with the flukes raised last. */
export function whaleMotion(time:number){
 const phase=((time+5)%WHALE_PERIOD+WHALE_PERIOD)%WHALE_PERIOD;
 const emergence=smooth(phase/5),descent=smooth((phase-22)/9);
 const a=time*.014;
 const breathStart=phase>=14?14:5,breathAge=phase-breathStart;
 return {phase,x:14+Math.sin(a)*4,z:-30+Math.cos(a)*2,y:-11+emergence*10.35-descent*10.35,
  heading:Math.atan2(4*Math.cos(a),-2*Math.sin(a)),pitch:.025+smooth((phase-18)/7)*.94,
  spout:breathAge>0&&breathAge<5?breathAge/5:-1,
  tailLift:Math.sin(smooth((phase-20)/9)*Math.PI)*.5,visible:phase>.1&&phase<31.5};
}
export const schoolBases=[[-8,13],[14,12],[13,-14]] as const;
export function schoolMotion(time:number,school:number){
 const a=time*.16+school*2.1,base=schoolBases[school];
 return {x:base[0]+Math.sin(a)*2.4,z:base[1]+Math.cos(a)*1.8,heading:Math.atan2(2.4*Math.cos(a),-1.8*Math.sin(a))};
}
export function fishJump(time:number,index:number){
 if(index%20>1)return {height:0,slope:0,splash:-1};
 const phase=((time+index*.71+3)%(12+Math.floor(index/20)*5));
 const p=phase/1.25;
 return {height:p<1?Math.sin(p*Math.PI)**2*1.35:0,slope:p<1?Math.sin(p*Math.PI*2)*2.2:0,splash:phase>=1.1&&phase<2.3?(phase-1.1)/1.2:-1};
}
