// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {terrainHeight,clamp} from './landscape.ts';

// These dimensions also construct the visible PlaneGeometry. Contact with water needs its triangles.
export const TERRAIN_GRID={width:800,depth:850,columns:270,rows:290,centerZ:-220};
const {width,depth,columns,rows,centerZ}=TERRAIN_GRID;
const xs=Array.from({length:columns+1},(_,i)=>Math.fround(i*width/columns-width/2));
// PlaneGeometry writes Float32 local vertices before rotate/translate writes them a second time.
const zs=Array.from({length:rows+1},(_,i)=>Math.fround(Math.fround(i*depth/rows-depth/2)+centerZ));
const heights=zs.map(z=>xs.map(x=>Math.fround(terrainHeight(x,z))));

/** Interpolate the same a/b/d and b/c/d triangles used by Three's PlaneGeometry. */
export function renderedTerrainHeight(x:number,z:number):number {
  const ix=clamp(Math.floor((x+width/2)/width*columns),0,columns-1);
  const iz=clamp(Math.floor((z-centerZ+depth/2)/depth*rows),0,rows-1);
  const u=clamp((x-xs[ix]!)/(xs[ix+1]!-xs[ix]!),0,1),v=clamp((z-zs[iz]!)/(zs[iz+1]!-zs[iz]!),0,1);
  const a=heights[iz]![ix]!,b=heights[iz+1]![ix]!,c=heights[iz+1]![ix+1]!,d=heights[iz]![ix+1]!;
  return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
}
