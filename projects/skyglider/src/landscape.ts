// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export function smooth(lo: number, hi: number, v: number): number { const t = clamp((v-lo)/(hi-lo), 0, 1); return t*t*(3-2*t); }
const hash = (x: number, z: number): number => { const n = Math.sin(x*127.1+z*311.7)*43758.5453; return n-Math.floor(n); };
export function noise(x: number, z: number): number {
  const ix=Math.floor(x), iz=Math.floor(z), u=smooth(0,1,x-ix), v=smooth(0,1,z-iz);
  const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
export function fbm(x: number,z: number): number { return noise(x,z)*.55+noise(x*2.03,z*2.03)*.27+noise(x*4.11,z*4.11)*.13+noise(x*8.21,z*8.21)*.05; }
export const mesas = [
  {x:-19,z:66,r:40,h:59}, {x:-139,z:-93,r:88,h:49},
  {x:127,z:-140,r:96,h:67}, {x:-27,z:-273,r:67,h:66},
  {x:91,z:-393,r:108,h:103}, {x:-190,z:-395,r:90,h:99},
  {x:269,z:-352,r:100,h:85}, {x:-290,z:-190,r:87,h:81},
];
export function naturalHeight(x:number,z:number):number {
  let height=-11;
  for(const m of mesas){
    const dx=(x-m.x),dz=(z-m.z)*1.03;
    const edge=Math.hypot(dx,dz)/m.r+(fbm(x*.037,z*.037)-.5)*.25+(noise(x*.14,z*.14)-.5)*.035;
    const top=m.h+(fbm(x*.027+17,z*.027)-.5)*22;
    const cliff=1-smooth(.81,1.09,edge);
    height=Math.max(height,-11+(top+11)*cliff+(noise(x*.20,z*.20)-.5)*2.7*smooth(.1,.8,cliff));
  }
  return height+(noise(x*.31,z*.31)-.5)*.65;
}
/** Small, level woodland clearings share their height with the rendered ground and landing feet. */
export const CLEARINGS = [
  {x:-2,z:84,name:'The oak clearing'}, {x:-104,z:-104,name:'The fern clearing'},
  {x:115,z:-107,name:'The eastern grove'}, {x:-22,z:-264,name:'The waterfall glade'},
  {x:37,z:-348,name:'The high meadow'},
].map(site=>({...site,y:naturalHeight(site.x,site.z)}));
export function inClearing(x:number,z:number,radius=13):boolean{return CLEARINGS.some(site=>Math.hypot(x-site.x,z-site.z)<radius);}
export function terrainHeight(x:number,z:number):number {
  const height=naturalHeight(x,z);
  for(const site of CLEARINGS){const d=Math.hypot(x-site.x,z-site.z);if(d<10)return site.y+(height-site.y)*smooth(4,10,d);}
  return height;
}
// The visible running branch and the foot path must share the same tapered surface.
export const RUN_BRANCH={a:[-12,77.13,65.16] as const,b:[2,78.835,63.807] as const,rootRadius:1.9,tipRadius:.5};
export const BRANCH_CLEARANCE=.72;
export function branchTop(branch:{a:readonly [number,number,number];b:readonly [number,number,number];rootRadius:number;tipRadius:number},x:number,z:number):number {
  const {a,b,rootRadius,tipRadius}=branch,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],lengthSq=dx*dx+dy*dy+dz*dz;
  const qx=x-a[0],qz=z-a[2],h=(qx*dx+qz*dz)/lengthSq,k=dy/lengthSq,dr=tipRadius-rootRadius,r=rootRadius+dr*h;
  const A=1-lengthSq*k*k-dr*dr*k*k,B=-2*lengthSq*h*k-2*r*dr*k,C=qx*qx+qz*qz-lengthSq*h*h-r*r;
  return a[1]+(-B+Math.sqrt(Math.max(0,B*B-4*A*C)))/(2*A);
}
export const runBranchTop=(x:number,z:number):number=>branchTop(RUN_BRANCH,x,z);
export const PERCH = {x:0,y:runBranchTop(0,64)+BRANCH_CLEARANCE,z:64};
// One tapered trunk is shared by the rendered oak and the authored contact path.
export const CLIMB_TRUNK={a:[-12,78,65] as const,b:[-10.5,106,63.8] as const,rootRadius:2.2,tipRadius:.65};
export const TOP_BRANCH={a:CLIMB_TRUNK.b,b:[-8.5,107,56.5] as const,rootRadius:.80,tipRadius:.34};
const trunkDelta=CLIMB_TRUNK.b.map((v,i)=>v-CLIMB_TRUNK.a[i]!);
export const TRUNK_LENGTH=Math.hypot(...trunkDelta);
export const TRUNK_AXIS=trunkDelta.map(v=>v/TRUNK_LENGTH) as [number,number,number];
const approach=[RUN_BRANCH.b[0]-RUN_BRANCH.a[0],0,RUN_BRANCH.b[2]-RUN_BRANCH.a[2]],dot=approach.reduce((sum,v,i)=>sum+v*TRUNK_AXIS[i]!,0);
const outward=approach.map((v,i)=>v-dot*TRUNK_AXIS[i]!),outwardLength=Math.hypot(...outward);
export const TRUNK_NORMAL=outward.map(v=>v/outwardLength) as [number,number,number];
export const TRUNK_BODY_CLEARANCE=.69;
export function trunkBodyPosition(height:number):{x:number;y:number;z:number}{
  const t=(height-CLIMB_TRUNK.a[1])/(CLIMB_TRUNK.b[1]-CLIMB_TRUNK.a[1]),radius=CLIMB_TRUNK.rootRadius+(CLIMB_TRUNK.tipRadius-CLIMB_TRUNK.rootRadius)*t;
  const p=CLIMB_TRUNK.a.map((v,i)=>v+trunkDelta[i]!*t+TRUNK_NORMAL[i]!*(radius+TRUNK_BODY_CLEARANCE));
  return {x:p[0]!,y:p[1]!,z:p[2]!};
}
// Acquire bark above the departure bough so the hips and tail root clear its upper surface.
export const CLIMB_START_HEIGHT=81.4;
export const CLIMB_BASE = trunkBodyPosition(CLIMB_START_HEIGHT);
export const CLIMB_SIDE_HEIGHT=103.4;
export const CLIMB_SIDE_TOP=trunkBodyPosition(CLIMB_SIDE_HEIGHT);
export const CLIMB_TOP = {x:-9.5,y:branchTop(TOP_BRANCH,-9.5,60.15)+BRANCH_CLEARANCE,z:60.15};
// The tour begins after the push-off arc, with enough space to unfold clear of the bark.
export const LAUNCH = {x:CLIMB_TOP.x+6.2,y:CLIMB_TOP.y+.8,z:CLIMB_TOP.z-11};
export const CLIMB_DURATION = 10.5;
export const GLIDE_DURATION = 82;
export const ROUTE: ReadonlyArray<readonly [number,number,number]> = [
  [LAUNCH.x,LAUNCH.y,LAUNCH.z], [0,107,38], [4,94,9], [-16,68,-43], [-41,63,-116],
  [-22,90,-196], [31,110,-261], [47,132,-319], [135,135,-337],
  [203,108,-245], [147,94,-116], [62,86,-35], [0,88,38], [PERCH.x,PERCH.y,PERCH.z],
];
