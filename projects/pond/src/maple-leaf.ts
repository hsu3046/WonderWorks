// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Original Blender Momiji v7 mesh from AIB's Kiboon; see docs/pond/MAPLE.md.
import * as T from 'three';
import source from './data/momiji-v7.json';

export function createMapleLeaf(){
 const positions:number[]=[],colors:number[]=[],uvs:number[]=[],detail:number[]=[];
 // Smaller individual leaves; keep the petiole attached at the same branch anchor.
 const scale=1.13/1.53*.55;
 const redBase=[.807,.036,.021] as const;
 source.vertices.forEach(([x,y,z],i)=>{
  positions.push((x!-.05)*scale,-z!*scale,(y!+.44)*scale);
  // Compress the authored red-to-yellow gradient without tinting the brown petiole.
  for(let channel=0;channel<3;channel++){
   const pigment=source.colors[i]![channel]!;
   colors.push(i<286?T.MathUtils.lerp(redBase[channel]!,pigment,.28):pigment);
  }
  uvs.push((x!+.754)/1.516,(y!+.44)/1.53);
  detail.push(...source.uvs[i]!,i<source.lobeVertexCount*source.lobes?1:0);
 });
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 g.setAttribute('aMomijiDetail',new T.Float32BufferAttribute(detail,3));g.setIndex(source.faces.flat());
 g.computeVertexNormals();return g;
}

/** Subtle blade veins fade out before their screen footprint starts aliasing. */
export function addMapleVeins(material:T.MeshStandardMaterial){
 const wind=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  wind.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aMomijiDetail;varying vec3 vMomijiDetail;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvMomijiDetail=aMomijiDetail;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vMomijiDetail;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec2 leafUV=vMomijiDetail.xy;
    float detailFade=1.-smoothstep(.015,.065,max(fwidth(leafUV.x),fwidth(leafUV.y)));
    float mid=exp(-pow((leafUV.x-.5)*24.,2.))*smoothstep(.15,.34,leafUV.y)*(1.-leafUV.y*.3);
    float branch=exp(-pow((fract(leafUV.y*7.2+abs(leafUV.x-.5)*1.1)-.5)*18.,2.))*smoothstep(.09,.27,abs(leafUV.x-.5));
    diffuseColor.rgb*=1.-vMomijiDetail.z*detailFade*(.155*mid+.055*branch);`);
 };
 material.customProgramCacheKey=()=> 'pond-kiboon-momiji-v7';
}
