// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {smooth} from './landscape.ts';

/** A shallow, rounded triangular rhinarium with recessed nostrils rather than a floating ellipsoid. */
export function addSquirrelNose(parent:T.Group,skin:T.SkinnedMesh):void {
  const outline=new T.Shape();outline.moveTo(0,.024);
  outline.bezierCurveTo(.024,.026,.048,.023,.047,.009);outline.bezierCurveTo(.046,-.004,.013,-.024,0,-.026);
  outline.bezierCurveTo(-.013,-.024,-.046,-.004,-.047,.009);outline.bezierCurveTo(-.048,.023,-.024,.026,0,.024);
  const boundary=outline.getSpacedPoints(80),rings=16,segments=80,positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const base=new T.Color('#382c27'),rim=new T.Color('#665144'),cavity=new T.Color('#100d0b'),color=new T.Color();
  skin.updateWorldMatrix(true,false);skin.skeleton.update();
  const surfaceZ=(x:number,y:number):number=>{
    const ray=new T.Raycaster(new T.Vector3(x,y+.034,-1.6),new T.Vector3(0,0,1)),hit=ray.intersectObject(skin,false)[0];
    if(!hit)throw new Error('The squirrel nose could not be fitted to its muzzle.');return hit.point.z;
  };
  const centerZ=surfaceZ(0,0),edgeZ=boundary.map(p=>surfaceZ(p.x,p.y));
  for(let r=0;r<=rings;r++)for(let j=0;j<segments;j++){
    const radius=r/rings,x=boundary[j]!.x*radius,y=boundary[j]!.y*radius;
    const nostril=Math.exp(-2*(((Math.abs(x)-.030)/.0095)**2+((y+.0005-(Math.abs(x)-.03)*.25)/.0048)**2));
    const cleft=Math.exp(-((x/.0018)**2))*(1-smooth(-.019,.008,y));
    // Fit the rim to the convex muzzle so the center cannot disappear behind the old skin.
    const z=T.MathUtils.lerp(centerZ,edgeZ[j]!,radius*radius)-.0016-.014*(1-radius*radius)+nostril*.0045+cleft*.0013;
    positions.push(x,y,z);color.copy(base).lerp(rim,smooth(.78,1,radius)*.50).lerp(cavity,Math.min(.94,nostril*.96+cleft*.20));color.toArray(colors,colors.length);
    if(r<rings){const a=r*segments+j,b=r*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.54,clearcoat:.10,clearcoatRoughness:.38,envMapIntensity:.45});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vNose;').replace('#include <begin_vertex>','#include <begin_vertex>\nvNose=position.xy;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 vNose;
float poreHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float poreNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(poreHash(i),poreHash(i+vec2(1,0)),f.x),mix(poreHash(i+vec2(0,1)),poreHash(i+vec2(1,1)),f.x),f.y);}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 poreUv=vNose*780.0,footprint=fwidth(poreUv);
float pore=(poreNoise(poreUv)-.5)*(1.0-smoothstep(.4,1.3,max(footprint.x,footprint.y)));
diffuseColor.rgb*=1.0+pore*.26;
float poreHeight=pore*.00023;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+pore*.15,.35,.7);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 poreDx=dFdx(-vViewPosition),poreDy=dFdy(-vViewPosition);
vec3 poreR1=cross(poreDy,normal),poreR2=cross(normal,poreDx);
float poreDet=dot(poreDx,poreR1);
normal=normalize(abs(poreDet)*normal-sign(poreDet)*(dFdx(poreHeight)*poreR1+dFdy(poreHeight)*poreR2));
`);
  };
  material.customProgramCacheKey=()=> 'squirrel-sculpted-nose-v1';
  const nose=new T.Mesh(geometry,material);nose.name='Sculpted nose and nostrils';nose.position.set(0,.034,0);parent.add(nose);
}
