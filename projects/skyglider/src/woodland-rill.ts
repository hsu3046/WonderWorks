// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {TERRAIN_GRID,renderedTerrainHeight} from './terrain-surface.ts';

/** Use the terrain's exact triangles so this shallow stream cannot intersect grid seams. */
export function woodlandRillGeometry(){
 const {width,depth,columns,rows,centerZ}=TERRAIN_GRID,dx=width/columns,dz=depth/rows;
 const x0=Math.floor((-139+width/2)/dx),x1=Math.ceil((-133+width/2)/dx),z0=Math.floor((-105-centerZ+depth/2)/dz),z1=Math.ceil((-65-centerZ+depth/2)/dz),stride=x1-x0+1;
 const vertices:number[]=[],indices:number[]=[];
 for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){const x=Math.fround(i*dx-width/2),z=Math.fround(Math.fround(j*dz-depth/2)+centerZ);vertices.push(x,renderedTerrainHeight(x,z)+.12,z);}
 for(let j=0;j<z1-z0;j++)for(let i=0;i<x1-x0;i++){const k=j*stride+i;indices.push(k,k+stride,k+1,k+1,k+stride,k+stride+1);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function createWoodlandRill(){
 const material=new T.MeshStandardMaterial({roughness:.32,color:0x4a8e89});
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec2 vRill;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRill=position.xz;');
  s.fragmentShader='varying vec2 vRill;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float lateral=abs(vRill.x+136.-sin((vRill.y+105.)*.12)*.65);
    if(lateral>.9||vRill.y< -105.||vRill.y> -65.)discard;
    diffuseColor.rgb*=mix(1.12,.66,smoothstep(.32,.9,lateral));`);
 };
 const mesh=new T.Mesh(woodlandRillGeometry(),material);mesh.name='Woodland rill under supplied bridge';mesh.receiveShadow=true;return mesh;
}
