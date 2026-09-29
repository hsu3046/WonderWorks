// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const sequenceModes=['columns','ribbons','disc','orbit','wave'] as const;
export type SequenceMode=typeof sequenceModes[number];
export const sceneDuration=5;
export const sequenceDuration=sceneDuration*sequenceModes.length;
export const transitionDuration=1.6;

export function sequenceFrame(time:number){
 const cycle=((time%sequenceDuration)+sequenceDuration)%sequenceDuration;
 const index=Math.floor(cycle/sceneDuration),local=cycle-index*sceneDuration;
 const progress=Math.max(0,Math.min(1,(local-(sceneDuration-transitionDuration))/transitionDuration));
 // Quintic blending joins both ends with zero first and second derivatives.
 // Clamp round-off near 1 so the geometric interpolation stays within its endpoints.
 const blend=Math.max(0,Math.min(1,progress**3*(progress*(progress*6-15)+10)));
 return {from:sequenceModes[index],to:sequenceModes[(index+1)%sequenceModes.length],
  fromTime:local,toTime:local-sceneDuration,blend};
}
