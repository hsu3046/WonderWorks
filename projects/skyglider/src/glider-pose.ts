// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
export const GLIDER_SCALE=1.42;
export const STRIDE=1.15;
export const BOUND_STRIDE=2.05;
const STANCE=.72;
/** During stance, local foot travel exactly cancels the animal's forward world motion. */
export function stepPose(distance:number,offset:number):{stroke:number;release:number}{
  const phase=((distance/STRIDE+offset)%1+1)%1,reach=STANCE*STRIDE/GLIDER_SCALE*.5;
  if(phase<STANCE)return {stroke:(phase-STANCE*.5)*STRIDE/GLIDER_SCALE,release:0};
  const swing=(phase-STANCE)/(1-STANCE),eased=swing*swing*(3-2*swing);
  return {stroke:reach*(1-2*eased),release:Math.sin(swing*Math.PI)};
}

/** Paired forefoot catch → hindfoot push → suspended recovery, driven by distance, not wall time. */
export function boundPose(distance:number){
  const phase=((distance/BOUND_STRIDE)%1+1)%1;
  const foot=(offset:number)=>{
    const t=(phase+offset+1)%1,stance=.27,reach=stance*BOUND_STRIDE/GLIDER_SCALE*.5;
    if(t<stance)return {stroke:(t-stance*.5)*BOUND_STRIDE/GLIDER_SCALE,release:0};
    const swing=(t-stance)/(1-stance),ease=swing*swing*(3-2*swing);
    return {stroke:reach*(1-2*ease),release:Math.sin(swing*Math.PI)**2};
  };
  const airborne=phase>.54?Math.sin((phase-.54)/.46*Math.PI)**2:0;
  const gather=phase<.54?Math.sin(phase/.54*Math.PI)**2:0;
  return {front:foot(0),hind:foot(-.27),height:airborne*.18-gather*.045,gather,extension:airborne-gather,pitch:Math.sin(phase*Math.PI*2)*.10,tail:Math.sin(phase*Math.PI*2-.9)*.16};
}
