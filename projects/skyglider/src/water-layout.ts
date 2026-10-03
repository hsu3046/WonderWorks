// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {mesas,terrainHeight,smooth} from './landscape.ts';
import {renderedTerrainHeight} from './terrain-surface.ts';

export const SEA={x:0,z:-220,level:.15,radius:2400,fadeStart:1850};
export const FALL_SITES=[{mesa:1,x:-134,width:13},{mesa:1,x:-112,width:7},{mesa:2,x:117,width:16},{mesa:2,x:141,width:8},{mesa:3,x:-31,width:14},{mesa:4,x:83,width:18}] as const;
export const FALL_GRID={columns:24,rows:96};
export interface FallProfile {x:number;width:number;crestZ:number;impactZ:number;crestY:number;}

/** Find the actual front lip and waterline instead of hanging a rectangle from an arbitrary height. */
export function fallProfile(site:typeof FALL_SITES[number]):FallProfile{
  const mesa=mesas[site.mesa]!,from=mesa.z+mesa.r*.45,limit=mesa.z+mesa.r*1.45;
  let crestZ=from;
  for(let z=from;z<limit;z+=.5){
    if(terrainHeight(site.x,z)-terrainHeight(site.x,z+1)>.95){crestZ=z;break;}
  }
  let impactZ=crestZ;
  while(impactZ<limit&&terrainHeight(site.x,impactZ)>SEA.level-.8)impactZ+=.5;
  return {x:site.x,width:site.width,crestZ,impactZ:impactZ+3,crestY:terrainHeight(site.x,crestZ)+.6};
}

export function fallPoint(profile:FallProfile,t:number,u:number){
  const width=profile.width*(.58+.35*smooth(.06,.7,t)+.25*smooth(.7,1,t));
  const centerX=profile.x+Math.sin(t*4.5)*.5;
  const x=centerX+(u-.5)*width,z=profile.crestZ+(profile.impactZ-profile.crestZ)*t;
  // Analytic noise is not the visible cliff: use its coarser, interpolated triangles and allow clearance
  // for the ribbon's own triangles crossing terrain grid seams between their vertices.
  const y=Math.max(SEA.level+.10,renderedTerrainHeight(x,z)+1.1,renderedTerrainHeight(centerX,z)+1.1);
  return {x,y,z};
}
