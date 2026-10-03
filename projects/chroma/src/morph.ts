// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';
import {columnProfile,ribbonProfile,waveProfile} from './geometry.ts';
import {sequenceModes,sequenceFrame,sceneDuration,transitionDuration,type SequenceMode} from './sequence.ts';
import {palettes,type Settings} from './state.ts';

// Three persistent patches: columns → ribbon → disc → orbit → wave → columns.
// Each vertex retains its angular/axial/radial address through the whole cycle.
export function createMorphGeometry(){
 const positions:number[]=[],addresses:number[]=[],indices:number[]=[];
 const radial=96,axial=48;
 function surface(cap:number){
  const offset=positions.length/3,rows=cap===0?axial:8;
  for(let j=0;j<=rows;j++)for(let i=0;i<=radial;i++){
   const theta=i/radial*Math.PI*2,v=cap===0?j/rows-.5:cap*.5,r=cap===0?1:j/rows;
   positions.push(Math.cos(theta)*r,v,Math.sin(theta)*r);
   addresses.push(theta,v,r,cap);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<radial;i++){
   const a=offset+j*(radial+1)+i,b=a+radial+1;
   indices.push(a,b,a+1,b,b+1,a+1);
  }
 }
 surface(0);surface(-1);surface(1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('address',new THREE.Float32BufferAttribute(addresses,4));g.setIndex(indices);return g;
}

export function morphPose(mode:SequenceMode,time:number,index:number,amplitude:number,twist:number,width:number){
 const kind=sequenceModes.indexOf(mode);
 if(mode==='columns'){
  const c=columnProfile(index,3,time,amplitude,twist);
  return {kind,center:[c.x,0,0],shape:[c.radius,c.height,c.roll,c.spin]};
 }
 if(mode==='ribbons'){
  const r=ribbonProfile(time,amplitude,twist);
  return {kind,center:[(index-1)*width/3,0,0],shape:[1.05,width/3,r.angle,r.twist]};
 }
 if(mode==='orbit'){
  // Carry the same three disc parts out into the circular orbit.
  const a=time*.62+index*Math.PI*2/3,radius=Math.min(2.25,1.6+.55*amplitude);
  return {kind,center:[Math.cos(a)*radius,Math.sin(a)*radius,Math.sin(a*.7)*.35],
   shape:[.78,.2+(.5+.5*Math.sin(time*2+index))*.5,.6+Math.sin(a)*.6,a*.35]};
 }
 if(mode==='wave'){
  const w=waveProfile(index,time,amplitude);
  return {kind,center:[w.x,w.y,0],shape:[w.radius,w.height,0,0]};
 }
 const h=.6+(.5+.5*Math.sin(time*1.55))*1.8*amplitude;
 const split=(.5+.5*Math.sin(time*1.5-1.4))*amplitude*2.1;
 return {kind,center:[0,(index-1)*(h/2+split),0],shape:[2.35,index===1?h:.012,Math.sin(time*1.35)*.5*amplitude,0]};
}

const vertex=`
attribute vec4 address;
uniform float uPart,uFrom,uTo,uMorph,uWidth;
uniform vec3 uCenterA,uCenterB;
uniform vec4 uShapeA,uShapeB;
varying vec3 vWorld,vLocal;
varying float vCap,vRibbon,vHue;
vec3 turnX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}
vec3 turnY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x*c+p.z*s,p.y,p.z*c-p.x*s);}
vec4 axisQ(vec3 axis,float a){return vec4(axis*sin(a*.5),cos(a*.5));}
vec4 mulQ(vec4 a,vec4 b){return vec4(a.w*b.xyz+b.w*a.xyz+cross(a.xyz,b.xyz),a.w*b.w-dot(a.xyz,b.xyz));}
vec3 rotateQ(vec3 p,vec4 q){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
uniform float uRotationSign;
void shape(float kind,vec4 s,vec3 center,out vec3 p,out vec4 q,out vec3 c){
 float theta=address.x,v=address.y,r=address.z;
 vec2 circle=vec2(cos(theta),sin(theta));
 if(kind<.5){
  p=vec3(circle.x*r*s.x,v*s.y,circle.y*r*s.x);
  q=mulQ(axisQ(vec3(1.,0.,0.),s.z),axisQ(vec3(0.,1.,0.),s.w));c=center;
 }else if(kind<1.5){
  // The adjoining ends shrink to their perimeter, eliminating internal faces.
  bool internal=(address.w>0.&&uPart<1.5)||(address.w<0.&&uPart>.5);
  vec2 square=circle/max(abs(circle.x),abs(circle.y))*s.x*(internal?1.:r);
  float x=center.x+v*s.y,a=s.z+x/uWidth*s.w;
  p=vec3(square.x,v*s.y,square.y);
  q=mulQ(axisQ(vec3(1.,0.,0.),a),axisQ(vec3(0.,0.,1.),-1.570796327));
  c=vec3(center.x,sin(x/uWidth*3.14159265)*.5*(s.w/1.65)*cos(s.z),0.);
 }else if(kind<2.5){
  float radial=uPart>.5&&uPart<1.5?1.:r;
  p=vec3(circle.x*radial*s.x,v*s.y,circle.y*radial*s.x)*.81;
  q=axisQ(vec3(1.,0.,0.),s.z);c=turnX(center,s.z)*.81;
 }else{
  p=vec3(circle.x*r*s.x,v*s.y,circle.y*r*s.x);c=center;
  q=mulQ(axisQ(vec3(1.,0.,0.),s.z),axisQ(vec3(0.,0.,1.),s.w));
 }
}
float hue(float kind){return kind<1.5?0.:kind<2.5?1.:kind<3.5?uPart*.5:0.;}
void main(){
 vec3 a,b,ca,cb;vec4 qa,qb;
 shape(uFrom,uShapeA,uCenterA,a,qa,ca);shape(uTo,uShapeB,uCenterB,b,qb,cb);
 // Interpolate local shape and rotation separately to avoid flattened/pinched
 // silhouettes when the endpoint orientations differ. Never mix rendered images.
 vec4 rotation=normalize(mix(qa,qb*uRotationSign,uMorph));
 vec3 p=rotateQ(mix(a,b,uMorph),rotation)+mix(ca,cb,uMorph);
 vLocal=vec3(cos(address.x)*address.z,address.y,sin(address.x)*address.z);
 vCap=abs(address.w);
 vRibbon=mix(1.-step(.1,abs(uFrom-1.)),1.-step(.1,abs(uTo-1.)),uMorph);
 vHue=mix(hue(uFrom),hue(uTo),uMorph);
 vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;
}`;
const fragment=`
uniform vec3 uWarm,uLight,uDeep,uAccent;uniform float uGrain,uWidth,uRibbonRoll;
uniform vec3 uRibbonWarm,uRibbonPink,uRibbonCream,uRibbonCool,uRibbonShade;
varying vec3 vWorld,vLocal;varying float vCap,vRibbon,vHue;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
 vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
 float across=smoothstep(-2.6,2.6,vWorld.x),height=smoothstep(-1.8,1.9,vWorld.y);
 vec3 col=mix(uDeep,mix(uWarm,uLight,across),height*.91+.08);
 col=mix(col,mix(uDeep,uAccent,smoothstep(-.7,2.5,vWorld.x-vWorld.y*.3)),vHue*.8);
 float capLight=smoothstep(-.6,.6,-vLocal.x*.55-vLocal.z*.65);
 vec3 cap=mix(uDeep,mix(uLight,vec3(1.),.48),capLight*.92);
 cap=mix(cap,uAccent,vHue*capLight*.75);
 col=mix(col,cap,vCap*(1.-vRibbon));
 float x=clamp(vWorld.x/uWidth+.5,0.,1.);
 // Preserve the distinct faces of the ribbon while the same material morphs.
 vec3 folded=mix(uRibbonCool,uLight,.045+.045*sin(x*3.14159265));
 vec3 band;
 if(abs(vLocal.x)>abs(vLocal.z)){
  band=vLocal.x<0.?mix(folded,mix(mix(uWarm,uLight,smoothstep(0.,.45,x)),uRibbonCool,smoothstep(.4,1.,x)),uRibbonRoll):mix(folded,mix(uRibbonCool,uAccent,x),uRibbonRoll);
 }else if(vLocal.z<0.)band=mix(uWarm,uLight,x);
 else{
  band=mix(mix(uRibbonWarm,uRibbonPink,smoothstep(0.,.55,x)),uRibbonCream,smoothstep(.42,1.,x));
  band=mix(band,uRibbonShade,pow(clamp(vLocal.x*.5+.5,0.,1.),1.8)*pow(1.-x,2.)*.99);
 }
 col=mix(col,band,vRibbon);
 col*=.96+.04*abs(n.z);
 col+=(hash(gl_FragCoord.xy)-.5)*uGrain;
 gl_FragColor=vec4(max(col,vec3(0.)),1.);
 #include <colorspace_fragment>
}`;

export function createMorph(s:Settings){
 // Fix quaternion hemisphere for the entire transition, not each frame: a
 // moving shortest-path sign would itself introduce a sudden half-turn.
 const qA=new THREE.Quaternion(),qB=new THREE.Quaternion(),qTemp=new THREE.Quaternion();
 const xAxis=new THREE.Vector3(1,0,0),yAxis=new THREE.Vector3(0,1,0),zAxis=new THREE.Vector3(0,0,1);
 function orientation(mode:SequenceMode,time:number,index:number,q:THREE.Quaternion){
  const p=morphPose(mode,time,index,s.amplitude,s.twist,6.3);
  q.setFromAxisAngle(xAxis,p.shape[2]);
  if(mode==='columns')q.multiply(qTemp.setFromAxisAngle(yAxis,p.shape[3]));
  if(mode==='orbit')q.multiply(qTemp.setFromAxisAngle(zAxis,p.shape[3]));
  if(mode==='ribbons')q.multiply(qTemp.setFromAxisAngle(zAxis,-Math.PI/2));
  return q;
 }
 const group=new THREE.Group(),geometry=createMorphGeometry();
 const materials=Array.from({length:3},(_,i)=>new THREE.ShaderMaterial({
  vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,
  uniforms:{uRotationSign:{value:1},uPart:{value:i},uFrom:{value:0},uTo:{value:1},uMorph:{value:0},uWidth:{value:6.3},
   uCenterA:{value:new THREE.Vector3()},uCenterB:{value:new THREE.Vector3()},
   uShapeA:{value:new THREE.Vector4()},uShapeB:{value:new THREE.Vector4()},
   uRibbonRoll:{value:0},uRibbonWarm:{value:new THREE.Color()},uRibbonPink:{value:new THREE.Color()},uRibbonCream:{value:new THREE.Color()},uRibbonCool:{value:new THREE.Color()},uRibbonShade:{value:new THREE.Color()},uWarm:{value:new THREE.Color()},uLight:{value:new THREE.Color()},uDeep:{value:new THREE.Color()},uAccent:{value:new THREE.Color()},uGrain:{value:s.grain}},
 }));
 materials.forEach(material=>{const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;group.add(mesh);});
 let lastPalette:Settings['palette']|undefined;
 function update(time:number,width:number){
  const state=sequenceFrame(time),colors=palettes[s.palette];
  materials.forEach((material,i)=>{
   const u=material.uniforms;
   const midpoint=sceneDuration-transitionDuration/2;
   const rotationSign=orientation(state.from,midpoint,i,qA).dot(orientation(state.to,-transitionDuration/2,i,qB))<0?-1:1;
   const a=morphPose(state.from,state.fromTime,i,s.amplitude,s.twist,width),b=morphPose(state.to,state.toTime,i,s.amplitude,s.twist,width);
   u.uRotationSign.value=rotationSign;u.uFrom.value=a.kind;u.uTo.value=b.kind;u.uMorph.value=state.blend;u.uWidth.value=width;u.uGrain.value=s.grain;
   (u.uCenterA.value as THREE.Vector3).fromArray(a.center);(u.uCenterB.value as THREE.Vector3).fromArray(b.center);
   (u.uShapeA.value as THREE.Vector4).fromArray(a.shape);(u.uShapeB.value as THREE.Vector4).fromArray(b.shape);
   if(lastPalette!==s.palette){
   ['uWarm','uLight','uDeep','uAccent'].forEach((key,j)=>(u[key].value as THREE.Color).set(colors[j]));
   const ribbonColors=s.palette==='spectral'?['#ee2348','#e568b5','#fff4cf','#3020b5','#640079']:[colors[0],colors[1],colors[3],colors[2],colors[2]];
   ['uRibbonWarm','uRibbonPink','uRibbonCream','uRibbonCool','uRibbonShade'].forEach((key,j)=>(u[key].value as THREE.Color).set(ribbonColors[j]));
   }
   u.uRibbonRoll.value=Math.abs(Math.sin(state.from==='ribbons'?a.shape[2]:b.shape[2]));
  });
  lastPalette=s.palette;
  return state;
 }
 return {group,update,dispose(){geometry.dispose();materials.forEach(m=>m.dispose());}};
}
