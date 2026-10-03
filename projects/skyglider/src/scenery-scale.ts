// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Measured bounds of the processed GLBs, including their node transforms.
// Source physical units are unspecified; these dimensions establish scene proportions.
export const MODEL_EXTENTS={
 bridge:[3.197968364,1.721794327,2.095503092],
 gazebo:[3.158666134,3.997126081,3.752099752],
 cherry:[.969818115,.901916504,.845916748],
 house:[.530670166,.980682373,.529663086],
 castle:[.655670166,.998291016,.621978760],
 hydrangea:[.968974799,.911393806,.690542549],
 azalea:[1.077598095,.986259355,.691066295],
 butterfly:[.812500060,.995117188,.999511719],
} as const;
export function sceneryDimensions(model:keyof typeof MODEL_EXTENTS,size:number,axis:'x'|'y'){
 const source=MODEL_EXTENTS[model],scale=size/source[axis==='x'?0:1];
 return {width:source[0]*scale,height:source[1]*scale,depth:source[2]*scale,scale};
}
