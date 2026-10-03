// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
export type Coordinate=readonly [number,number,number];
export interface LimbBind {name:string;sign:number;front:boolean;root:Coordinate;joint:Coordinate;foot:Coordinate;upper:number;lower:number;paw:number;}
export const HEAD_PIVOT:Coordinate=[0,.17,-.83];
/** Offline skin weights and runtime bones use exactly the same rest pose and ordering. */
export const LIMB_BIND:ReadonlyArray<LimbBind>=[-1,1].flatMap((sign,side)=>[true,false].map((front,leg)=>{
  const first=2+(side*2+leg)*3;
  return {name:`${sign<0?'left':'right'}_${front?'front':'hind'}`,sign,front,
    root:[sign*.235,front?.075:.10,front?-.47:.49] as Coordinate,
    joint:[sign*(front?.315:.38),front?-.19:-.17,front?-.55:.31] as Coordinate,
    foot:[sign*(front?.31:.37),-.466,front?-.80:.58] as Coordinate,
    upper:first,lower:first+1,paw:first+2};
}));
export const SQUIRREL_BONES=14;
