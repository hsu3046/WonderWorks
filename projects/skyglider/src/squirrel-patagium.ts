// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {noise,random,smooth} from './landscape.ts';

export interface PatagiumPose {sign:number;spread:number;fore:T.Vector3;hind:T.Vector3;rootZ:T.Vector2;}

/** The membrane and dorsal groom use the same wrist/ankle patch, including while folding. */
export function patagiumPoint(u:number,v:number,pose:PatagiumPose,out:T.Vector3):T.Vector3 {
  const {sign,spread,fore,hind,rootZ}=pose,bow=Math.sin(v*Math.PI),open=smooth(0,.55,spread);
  const edgeX=T.MathUtils.lerp(sign*.235,T.MathUtils.lerp(fore.x,hind.x,v)-sign*bow*.24,open);
  const edgeY=T.MathUtils.lerp(-.035,T.MathUtils.lerp(fore.y,hind.y,v),open);
  return out.set(T.MathUtils.lerp(sign*.215,edgeX,u),T.MathUtils.lerp(-.055,edgeY,u)-Math.sin(u*Math.PI)*bow*.15*spread,T.MathUtils.lerp(T.MathUtils.lerp(rootZ.x,rootZ.y,v),T.MathUtils.lerp(fore.z,hind.z,v),u));
}

const wingBase=new T.Color('#574e40'),wingEdge=new T.Color('#423b32');
function wingColor(u:number,v:number,out:T.Color):T.Color {
  return out.copy(wingBase).lerp(wingEdge,smooth(.65,1,u)*.40).multiplyScalar(.86+noise(u*13,v*19)*.25);
}

function membraneMaterial():T.MeshStandardMaterial {
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.96,side:T.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vWingUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWingUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 vWingUv;
float wingHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wingNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(wingHash(i),wingHash(i+vec2(1,0)),f.x),mix(wingHash(i+vec2(0,1)),wingHash(i+vec2(1,1)),f.x),f.y);}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 grainUv=vec2(vWingUv.x*210.0+vWingUv.y*24.0,vWingUv.y*65.0);
vec2 grainDx=fwidth(grainUv);
float grainFilter=1.0-smoothstep(.45,1.25,max(grainDx.x,grainDx.y));
float grain=(wingNoise(grainUv)-.5)*grainFilter;
diffuseColor.rgb*=1.0+grain*.40;
if(!gl_FrontFacing)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.49,.43,.34),.62);
float napHeight=grain*.0008;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 napDx=dFdx(-vViewPosition),napDy=dFdy(-vViewPosition);
vec3 napR1=cross(napDy,normal),napR2=cross(normal,napDx);
float napDet=dot(napDx,napR1);
normal=normalize(abs(napDet)*normal-sign(napDet)*(dFdx(napHeight)*napR1+dFdy(napHeight)*napR2));
`);
  };
  material.customProgramCacheKey=()=> 'squirrel-patagium-nap-v1';return material;
}

function dorsalGroom(pose:PatagiumPose):T.Mesh {
  const count=6500,rng=random(pose.sign<0?4031:9265),positions:number[]=[],roots:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[];
  const base=new T.Color(),tip=new T.Color(),silver=new T.Color('#a59880'),dark=new T.Color('#332e27');
  for(let hair=0;hair<count;hair++){
    const u=.012+rng()*.976,v=.012+rng()*.976,length=(.019+rng()*.027)*(1+smooth(.87,1,u)*.2),width=.00065+rng()*.00075;
    wingColor(u,v,base).multiplyScalar(.76+rng()*.35);tip.copy(base).lerp(rng()<.55?silver:dark,.33);
    const vertices=[[-width,0,0],[width,0,0],[-width*.56,length*.13,length*.46],[width*.56,length*.13,length*.46],[0,length*.17,length]];
    for(let j=0;j<5;j++){positions.push(...vertices[j]!);roots.push(u,v);normals.push(0,1,0);(j<2?base:tip).toArray(colors,colors.length);}
    const k=hair*5;indices.push(k,k+2,k+1,k+1,k+2,k+3,k+2,k+4,k+3);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('wingRoot',new T.Float32BufferAttribute(roots,2));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  const material=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.93,side:T.DoubleSide,sheen:.25,sheenRoughness:.9,sheenColor:0x9b8a71});
  const viewportHeight={value:720},spread={value:pose.spread},viewport=new T.Vector4();
  material.onBeforeCompile=shader=>{
    shader.uniforms.wingFore={value:pose.fore};shader.uniforms.wingHind={value:pose.hind};shader.uniforms.wingRootZ={value:pose.rootZ};shader.uniforms.wingSign={value:pose.sign};shader.uniforms.wingSpread=spread;shader.uniforms.wingViewport=viewportHeight;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec2 wingRoot;
uniform vec3 wingFore,wingHind;
uniform vec2 wingRootZ;
uniform float wingSign,wingSpread,wingViewport;
vec3 wingSurface(vec2 q){
  float u=q.x,v=q.y,bow=sin(v*PI),open=smoothstep(0.0,.55,wingSpread);
  float edgeX=mix(wingSign*.235,mix(wingFore.x,wingHind.x,v)-wingSign*bow*.24,open);
  float edgeY=mix(-.035,mix(wingFore.y,wingHind.y,v),open);
  return vec3(mix(wingSign*.215,edgeX,u),mix(-.055,edgeY,u)-sin(u*PI)*bow*.15*wingSpread,mix(mix(wingRootZ.x,wingRootZ.y,v),mix(wingFore.z,wingHind.z,v),u));
}
`);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
vec3 wingPoint=wingSurface(wingRoot);
vec3 wingU=wingSurface(wingRoot+vec2(.001,0.0))-wingPoint;
vec3 wingV=wingSurface(wingRoot+vec2(0.0,.001))-wingPoint;
vec3 objectNormal=normalize(cross(wingV,wingU))*wingSign;
vec3 groomFlow=normalize(wingV+wingU*.24);
vec3 groomAcross=normalize(cross(objectNormal,groomFlow));
`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
float groomDepth=max(.01,-(modelViewMatrix*vec4(wingPoint,1.0)).z);
float groomPixels=.020*length(modelViewMatrix[0].xyz)*projectionMatrix[1][1]*wingViewport*.5/groomDepth;
float groomDetail=smoothstep(.65,2.0,groomPixels);
vec3 transformed=wingPoint+objectNormal*.0008+(groomAcross*position.x+objectNormal*position.y+groomFlow*position.z)*groomDetail;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;',''));
  };
  material.onBeforeRender=renderer=>{spread.value=pose.spread;renderer.getCurrentViewport(viewport);viewportHeight.value=viewport.w;};
  material.customProgramCacheKey=()=> 'squirrel-patagium-groom-v1';
  const mesh=new T.Mesh(geometry,material);mesh.name='Dorsal patagium fur';mesh.frustumCulled=false;mesh.receiveShadow=true;return mesh;
}

export function createPatagium(sign:number){
  const pose:PatagiumPose={sign,spread:0,fore:new T.Vector3(),hind:new T.Vector3(),rootZ:new T.Vector2()},group=new T.Group();group.name=sign<0?'Left patagium':'Right patagium';
  // A close patch approximation keeps the analytically attached groom above the triangulated skin.
  const rows=48,cols=30,positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],color=new T.Color();
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    positions.push(0,0,0);uv.push(i/cols,j/rows);wingColor(i/cols,j/rows,color).toArray(colors,colors.length);
    if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+cols+1;if(sign>0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  const membrane=new T.Mesh(geometry,membraneMaterial());membrane.name='Patagium skin';membrane.frustumCulled=false;membrane.castShadow=true;membrane.receiveShadow=true;group.add(membrane,dorsalGroom(pose));
  const point=new T.Vector3(),vertices=geometry.getAttribute('position');
  return {group,update(spread:number,fore:T.Vector3,hind:T.Vector3,frontZ:number,hindZ:number){
    group.visible=spread>.025;pose.spread=spread;pose.fore.copy(fore);pose.hind.copy(hind);pose.rootZ.set(frontZ,hindZ);
    if(!group.visible)return;
    // Only the small supporting patch changes on the CPU; all follicles follow it on the GPU.
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){patagiumPoint(i/cols,j/rows,pose,point);vertices.setXYZ(j*(cols+1)+i,point.x,point.y,point.z);}
    vertices.needsUpdate=true;geometry.computeVertexNormals();
  }};
}
