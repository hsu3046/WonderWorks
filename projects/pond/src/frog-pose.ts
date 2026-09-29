// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const frogTiming={takeoff:.30,landing:1.02,end:1.24} as const;
// Preload blends the folded Tuck pose into Crouch; Crouch alone leaves the feet trailing.
// Slow loading, a quick full kick, recovery and landing reach.
const keys:readonly [number,readonly number[]][]=[
 [0,[0,0,0,0]],[.24,[.34,0,.66,0]],[.40,[0,1,0,0]],
 [.64,[0,.08,.82,0]],[.94,[0,0,0,.92]],[1.06,[.60,0,0,.20]],[1.24,[0,0,0,0]],
];
export function frogPose(age:number,out:number[]){
 out.fill(0);if(age<0||age>=frogTiming.end)return;
 for(let i=1;i<keys.length;i++){const [end,b]=keys[i]!,[start,a]=keys[i-1]!;if(age<=end){const t=(age-start)/(end-start),s=t*t*(3-2*t);for(let j=0;j<4;j++)out[j]=a[j]!+(b[j]!-a[j]!)*s;return;}}
}
