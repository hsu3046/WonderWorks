// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {random} from './bolt';
/** Periodic, prefiltered FBM + cellular erosion. Built once; no per-frame CPU noise. */
export function noiseVolume(){
 const side=64,values=new Uint8Array(side**3*2),rand=random(1208);
 const grids=[4,8,16].map(n=>({n,data:Float32Array.from({length:n**3},rand)}));
 const features=Float32Array.from({length:8**3*3},rand);
 const smooth=(t:number)=>t*t*(3-2*t),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
 function value(x:number,y:number,z:number,grid:typeof grids[number]) {
  const {n,data}=grid,ix=Math.floor(x*n),iy=Math.floor(y*n),iz=Math.floor(z*n),fx=smooth(x*n-ix),fy=smooth(y*n-iy),fz=smooth(z*n-iz);
  const at=(dx:number,dy:number,dz:number)=>data[((iz+dz)%n*n+(iy+dy)%n)*n+(ix+dx)%n]!;
  return mix(mix(mix(at(0,0,0),at(1,0,0),fx),mix(at(0,1,0),at(1,1,0),fx),fy),mix(mix(at(0,0,1),at(1,0,1),fx),mix(at(0,1,1),at(1,1,1),fx),fy),fz);
 }
 for(let z=0;z<side;z++)for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const nx=(x+.5)/side,ny=(y+.5)/side,nz=(z+.5)/side,px=nx*8,py=ny*8,pz=nz*8,ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz);
  let nearest=4;
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
   const cx=ix+dx,cy=iy+dy,cz=iz+dz,index=(((cz+8)%8*8+(cy+8)%8)*8+(cx+8)%8)*3;
   const distance=(cx+features[index]!-px)**2+(cy+features[index+1]!-py)**2+(cz+features[index+2]!-pz)**2;
   nearest=Math.min(nearest,distance);
  }
  const index=((z*side+y)*side+x)*2;
  values[index]=Math.round(255*(value(nx,ny,nz,grids[0]!)*.55+value(nx,ny,nz,grids[1]!)*.3+value(nx,ny,nz,grids[2]!)*.15));
  values[index+1]=Math.round(255*Math.max(0,1-Math.sqrt(nearest)/1.15));
 }
 const texture=new T.Data3DTexture(values,side,side,side);texture.format=T.RGFormat;texture.type=T.UnsignedByteType;
 texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.wrapS=texture.wrapT=texture.wrapR=T.RepeatWrapping;texture.unpackAlignment=1;texture.needsUpdate=true;
 return texture;
}
