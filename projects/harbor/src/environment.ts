// SPDX-License-Identifier: GPL-3.0-only
import * as T from 'three';
import { Water } from 'three/addons/objects/Water.js';
export type Weather = 'sunset' | 'dawn' | 'mist' | 'moon' | 'rain';
export interface Atmosphere { top:string; horizon:string; cloud:string; fog:string; water:string; sun:string; light:number; ambient:number; elevation:number; haze:number; exposure:number; rain:number; caption:string; }
export const weather:Record<Weather,Atmosphere> = {
 sunset:{top:'#527b83',horizon:'#d7cbb1',cloud:'#edcb9a',fog:'#b1bdae',water:'#224f48',sun:'#ffcc88',light:2.6,ambient:1.6,elevation:.19,haze:.007,exposure:1.08,rain:0,caption:'17:42 / GOLDEN HOUR'},
 dawn:{top:'#7b9baf',horizon:'#f5d4b4',cloud:'#f9e4cf',fog:'#b8cac4',water:'#3c706c',sun:'#ffe5be',light:2.3,ambient:1.9,elevation:.26,haze:.013,exposure:1.04,rain:0,caption:'06:18 / FIRST LIGHT'},
 mist:{top:'#819b9b',horizon:'#c9d6c9',cloud:'#c0cec4',fog:'#a8bdb5',water:'#365952',sun:'#dfecd4',light:.8,ambient:2.1,elevation:.4,haze:.03,exposure:1.02,rain:0,caption:'08:06 / SEA MIST'},
 moon:{top:'#101e38',horizon:'#526f88',cloud:'#3e5975',fog:'#405e71',water:'#102b3f',sun:'#c7dcfa',light:.6,ambient:.8,elevation:.29,haze:.012,exposure:1.04,rain:0,caption:'21:24 / MOONRISE'},
 rain:{top:'#273e4c',horizon:'#8ba09f',cloud:'#526969',fog:'#718b89',water:'#243f40',sun:'#b7cecd',light:.48,ambient:1.8,elevation:.4,haze:.024,exposure:.98,rain:1,caption:'15:09 / PASSING RAIN'}
};
const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.;float a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+4.7;a*=.5;}return s;}`;
export function createEnvironment(scene:T.Scene){
 const uniforms={time:{value:0},top:{value:new T.Color()},horizon:{value:new T.Color()},cloud:{value:new T.Color()},hazeColor:{value:new T.Color()},sunColor:{value:new T.Color()},sunDir:{value:new T.Vector3()},storm:{value:0},night:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(450,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,
 vertexShader:`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec3 vDirection;uniform vec3 top,horizon,cloud,hazeColor,sunColor,sunDir;uniform float time,storm,night;${noiseGLSL}
 void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 c=mix(horizon,top,pow(h,.45));c=mix(hazeColor,c,smoothstep(0.,.12,h));float sd=max(dot(d,sunDir),0.);
 c+=sunColor*pow(sd,10.)*.17; c+=sunColor*pow(sd,100.)*.2;
 vec2 p=d.xz/(max(d.y,.035)+.16)*1.8+vec2(time*.005,0.);
 float n=fbm(p); float cl=smoothstep(.40-storm*.10,.71,n)*smoothstep(0.,.17,d.y);
 vec3 cc=mix(cloud*.48,cloud,smoothstep(.42,.64,n));c=mix(c,cc,cl*.8);
 float disk=smoothstep(.99982,.99993,sd)*(1.-cl*.95);c+=sunColor*disk*mix(10.,3.,night)*(1.-storm);
 c=mix(hazeColor,c,smoothstep(0.,.07,h));gl_FragColor=vec4(c,1.); #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`.replace(' #include','\n#include')}));
 scene.add(sky);
 // Tileable, locally generated normal map: no remote texture dependency.
 const n=256,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n*Math.PI*2,v=y/n*Math.PI*2;
  let dx=0,dz=0;
  // Mixed directions and wavelengths avoid the evenly spaced rings of a single sine.
  for(let j=0;j<14;j++){const kx=[3,7,-11,17,23,-31,41,13,-19,29,53,-43,61,5][j],kz=[7,-5,3,11,-17,19,23,-31,43,5,-13,37,17,59][j];const phase=u*kx+v*kz+j*2.399;const amplitude=.052/(1+j*.23);dx+=Math.cos(phase)*amplitude*kx/Math.hypot(kx,kz);dz+=Math.cos(phase)*amplitude*kz/Math.hypot(kx,kz);}
  const inv=1/Math.hypot(dx,dz,1),i=(y*n+x)*4;data[i]=128+127*dx*inv;data[i+1]=128+127*dz*inv;data[i+2]=128+127*inv;data[i+3]=255;
 }
 const normal=new T.DataTexture(data,n,n);normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.magFilter=T.LinearFilter;normal.minFilter=T.LinearMipmapLinearFilter;normal.generateMipmaps=true;normal.needsUpdate=true;
 const water=new Water(new T.PlaneGeometry(1500,1500),{textureWidth:768,textureHeight:768,waterNormals:normal,sunDirection:new T.Vector3(.6,.2,-.8),sunColor:0xffddb0,waterColor:0x28554c,distortionScale:2.0,fog:true});
 water.rotation.x=-Math.PI/2;water.position.y=.05;water.material.uniforms.size.value=1.8;scene.add(water);
 const sun=new T.DirectionalLight(0xffdca1,2.5);sun.position.set(45,22,-55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.camera.far=150;sun.shadow.normalBias=.07;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);
 const ambient=new T.HemisphereLight(0xc1d5d1,0x313e34,1.6);scene.add(ambient);
 const fog=new T.FogExp2(0xbcc7b5,.01);scene.fog=fog;
 const rainGeo=new T.BufferGeometry();const rainPos=new Float32Array(1600*2*3);const rainSeed=new Float32Array(1600*3);
 for(let i=0;i<1600;i++){rainSeed[i*3]=(Math.random()-.5)*75;rainSeed[i*3+1]=Math.random()*35;rainSeed[i*3+2]=(Math.random()-.5)*75;}
 rainGeo.setAttribute('position',new T.BufferAttribute(rainPos,3));const rainMat=new T.LineBasicMaterial({color:0xc0d9d8,transparent:true,opacity:.23,depthWrite:false});const rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;rain.visible=false;scene.add(rain);
 let current:Weather='sunset';let wind=.35;
 function set(preset:Weather,haze:number,breeze:number){
  current=preset;wind=breeze;const p=weather[preset];for(const k of ['top','horizon','cloud'] as const)uniforms[k].value.set(p[k]);
  uniforms.hazeColor.value.set(p.fog);uniforms.sunColor.value.set(p.sun);uniforms.sunDir.value.set(-.25,p.elevation,-1).normalize();uniforms.storm.value=p.rain;uniforms.night.value=preset==='moon'?1:0;
  sun.color.set(p.sun);sun.intensity=p.light;sun.position.copy(uniforms.sunDir.value).multiplyScalar(95);ambient.color.set(p.fog);ambient.intensity=p.ambient;
  fog.color.set(p.fog);fog.density=p.haze*(.4+haze*1.4);water.material.uniforms.waterColor.value.set(p.water);water.material.uniforms.sunColor.value.set(p.sun);water.material.uniforms.sunDirection.value.copy(uniforms.sunDir.value);water.material.uniforms.distortionScale.value=.8+breeze*3.5;rain.visible=p.rain>0;
 }
 function update(t:number,camera:T.Camera){
  uniforms.time.value=t;water.material.uniforms.time.value=t*(.13+wind*.27);
  if(current==='rain'){
   for(let i=0;i<1600;i++){const k=i*6,s=i*3;const x=rainSeed[s]+camera.position.x,y=((rainSeed[s+1]-t*17)%35+35)%35,z=rainSeed[s+2]+camera.position.z;rainPos[k]=x;rainPos[k+1]=y;rainPos[k+2]=z;rainPos[k+3]=x-.10;rainPos[k+4]=y+.62;rainPos[k+5]=z+.13;}
   rainGeo.attributes.position.needsUpdate=true;
  }
 }
 set('sunset',.45,.35);return {set,update,water,sun,ambient};
}
