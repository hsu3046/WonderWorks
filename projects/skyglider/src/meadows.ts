// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CLEARINGS,noise,random,smooth,terrainHeight} from './landscape.ts';
import {createGroundDetailLOD} from './prop-lod.ts';
import {occupiedByScenery} from './local-scenery-layout.ts';

export const MEADOWS=[{x:-32,z:61,r:25},{x:10,z:60,r:22},{x:-118,z:-98,r:31},{x:120,z:-134,r:34},{x:-19,z:-271,r:27},{x:40,z:-351,r:32},{x:96,z:-392,r:33}] as const;
export function meadowCoverage(x:number,z:number){
  let cover=0;
  for(const m of MEADOWS){const d=Math.hypot(x-m.x,(z-m.z)*1.16)+(noise(x*.09,z*.09)-.5)*7;cover=Math.max(cover,1-smooth(m.r*.45,m.r,d));}
  for(const c of CLEARINGS)cover*=smooth(5,12,Math.hypot(x-c.x,z-c.z));
  return cover;
}
export const meadowGLSL=`
float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453),f.x),mix(fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+1.,vec2(127.1,311.7)))*43758.5453),f.x),f.y);}
float meadowCoverage(vec2 p){float cover=0.;float variation=(meadowNoise(p*.09)-.5)*7.;
${MEADOWS.map(m=>`cover=max(cover,1.-smoothstep(${m.r*.45},${m.r.toFixed(1)},length((p-vec2(${m.x.toFixed(1)},${m.z.toFixed(1)}))*vec2(1.,1.16))+variation));`).join('\n')}
${CLEARINGS.map(c=>`cover*=smoothstep(5.,12.,distance(p,vec2(${c.x.toFixed(1)},${c.z.toFixed(1)})));`).join('\n')}
return cover;}
`;

export function createMeadows(sprite:T.Texture,time:{value:number}){
  const rng=random(10791),locations:Array<{x:number;y:number;z:number;s:number;angle:number}>=[];
  for(const m of MEADOWS)for(let i=0;i<460;i++){
    const a=rng()*Math.PI*2,r=Math.sqrt(rng())*m.r,x=m.x+Math.cos(a)*r,z=m.z+Math.sin(a)*r/1.16,y=terrainHeight(x,z);
    if(meadowCoverage(x,z)<.4||y<3||Math.abs(terrainHeight(x+1,z)-y)>.7||Math.abs(terrainHeight(x,z+1)-y)>.7)continue;
    const candidate={x,y:y-.08,z,s:.65+rng()*.65,angle:rng()*Math.PI};
    if(!occupiedByScenery(x,z,.4))locations.push(candidate);
  }
  const a=new T.PlaneGeometry(1.9,1.1,1,3).translate(0,.55,0),b=a.clone().rotateY(Math.PI/2),geometry=mergeGeometries([a,b])!;a.dispose();b.dispose();
  const material=new T.MeshStandardMaterial({map:sprite,alphaTest:.40,side:T.DoubleSide,roughness:1});
  material.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed.x+=sin(uTime*1.1+instanceMatrix[3].x*.23+instanceMatrix[3].z*.17)*.035*position.y*position.y;
  `);s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*.20;\n#include <opaque_fragment>');};
  const mesh=new T.InstancedMesh(geometry,material,locations.length),dummy=new T.Object3D();mesh.name='Painted alpine wildflowers';
  locations.forEach((l,i)=>{dummy.position.set(l.x,l.y,l.z);dummy.rotation.set(0,l.angle,0);dummy.scale.setScalar(l.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.receiveShadow=true;return {mesh,updateView:createGroundDetailLOD(mesh,65,85),count:locations.length};
}
