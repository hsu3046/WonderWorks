// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';

export const FIELD_WIDTH=128,FIELD_HEIGHT=96,FIELD_STEP=1/60;
export const waterUniforms={
 uWaterTime:{value:0},uWaterBreeze:{value:.35},uWaveMap:{value:null as T.Texture|null},
 uCausticMap:{value:null as T.Texture|null},uWaterSun:{value:new T.Vector3(0,1,0)},uWaterDay:{value:1},
};
/** Shared wave height/gradient: surface, reflections and caustics sample the same field. */
export const waterFieldGLSL=`
 uniform float uWaterTime,uWaterBreeze;
 uniform sampler2D uWaveMap;
 float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 vec3 waterNoise(vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
  float a=waterHash(i),b=waterHash(i+vec2(1,0)),c=waterHash(i+vec2(0,1)),d=waterHash(i+1.);
  return vec3(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),du.x*mix(b-a,d-c,u.y),du.y*mix(c-a,d-b,u.x));
 }
 void addGerstner(vec2 p,vec2 dir,float k,float amp,float phase,inout vec3 field,inout vec2 shift){
  float f=dot(p,dir)*k-uWaterTime*sqrt(9.81*k)*.42+phase;
  field+=vec3(amp*sin(f),dir*amp*k*cos(f));shift+=dir*amp*.28*cos(f);
 }
 vec3 waterField(vec2 p,out vec2 shift){
  vec3 field=vec3(0);shift=vec2(0);float wind=.35+uWaterBreeze;
  addGerstner(p,normalize(vec2(1.,.42)),2.4,.010*wind,.3,field,shift);
  addGerstner(p,normalize(vec2(-.32,1.)),4.1,.006*wind,1.7,field,shift);
  addGerstner(p,normalize(vec2(.73,-.65)),7.2,.0025*wind,2.5,field,shift);
  float amp=.0022*wind,freq=3.7;
  for(int i=0;i<3;i++){
   vec3 n=waterNoise(p*freq+vec2(uWaterTime*.12,-uWaterTime*.09)+float(i)*13.7);
   field+=vec3((n.x-.5)*amp,n.yz*amp*freq);freq*=2.03;amp*=.46;
  }
  vec2 uv=p/vec2(20.,15.)+.5,texel=vec2(1./128.,1./96.);
  float h=texture2D(uWaveMap,uv).r;
  vec2 slope=vec2(texture2D(uWaveMap,uv+vec2(texel.x,0)).r-texture2D(uWaveMap,uv-vec2(texel.x,0)).r,
                  texture2D(uWaveMap,uv+vec2(0,texel.y)).r-texture2D(uWaveMap,uv-vec2(0,texel.y)).r)/.3125;
  float radius=length(p/vec2(9.95,7.45)),fade=clamp((radius-.91)/.09,0.,1.);
  float edge=1.-fade*fade*(3.-2.*fade);
  vec2 edgeGradient=-6.*fade*(1.-fade)/.09*p/(vec2(9.95*9.95,7.45*7.45)*max(radius,.001));
  shift*=edge;return vec3(field.x*edge+h,field.yz*edge+field.x*edgeGradient+slope);
 }
`;
export const causticGLSL=`
 uniform sampler2D uCausticMap;uniform vec3 uWaterSun;uniform float uWaterDay;
 float causticLight(vec3 receiver){
  float depth=max(0.,-receiver.y);
  vec3 direction=refract(-normalize(uWaterSun),vec3(0,1,0),1./1.333);
  // Reverse the mean refracted ray from each receiver to the common surface map.
  vec2 atSurface=receiver.xz-direction.xz*depth/max(.2,-direction.y);
  vec2 uv=atSurface/vec2(20.,15.)+.5;
  vec2 refractedSlope=texture2D(uCausticMap,clamp(uv,0.,1.)).gb;
  uv=(receiver.xz-refractedSlope*depth)/vec2(20.,15.)+.5;
  float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  return texture2D(uCausticMap,uv).r*inside*uWaterDay*exp(-depth*.22)*(1.-smoothstep(-.06,.025,receiver.y));
 }
`;
const fullscreenVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
/** Damped two-dimensional wave equation; RG stores height and previous height. */
export function createWaveField(renderer:T.WebGLRenderer){
 const targets=[0,1].map(()=>new T.WebGLRenderTarget(FIELD_WIDTH,FIELD_HEIGHT,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false}));
 const impulses=Array.from({length:32},()=>new T.Vector4());let queued=0,current=0,accumulator=0,steps=0,lastImpulse=-100,elapsed=0;
 const simUniforms={uPrevious:{value:targets[0]!.texture},uImpulses:{value:impulses},uCount:{value:0}};
 const simulation=new T.ShaderMaterial({uniforms:simUniforms,depthTest:false,depthWrite:false,vertexShader:fullscreenVertex,fragmentShader:`
  varying vec2 vUv;uniform sampler2D uPrevious;uniform vec4 uImpulses[32];uniform int uCount;
  bool wet(vec2 uv){vec2 p=(uv-.5)*vec2(20.,15.);return dot(p/vec2(9.95,7.45),p/vec2(9.95,7.45))<1.
   &&length(p-vec2(5.7,2.3))>.65&&length(p-vec2(-6.3,-1.7))>.48;}
  float neighbor(vec2 uv,float h){return wet(uv)?texture2D(uPrevious,uv).r:h;}
  void main(){if(!wet(vUv)){gl_FragColor=vec4(0);return;}
   vec2 state=texture2D(uPrevious,vUv).rg,cell=vec2(1./128.,1./96.);
   float lap=neighbor(vUv+vec2(cell.x,0),state.x)+neighbor(vUv-vec2(cell.x,0),state.x)
    +neighbor(vUv+vec2(0,cell.y),state.x)+neighbor(vUv-vec2(0,cell.y),state.x)-4.*state.x;
   float edge=smoothstep(.90,1.,length((vUv-.5)*vec2(20.,15.)/vec2(9.95,7.45)));
   float h=(state.x+(state.x-state.y)*(.992-edge*.08)+.03640889*lap)*.9992;
   for(int i=0;i<32;i++){if(i>=uCount)break;vec4 impact=uImpulses[i];vec2 d=((vUv-.5)*vec2(20.,15.)-impact.xy)/impact.w;
    h+=exp(-dot(d,d)*2.)*impact.z;}
   gl_FragColor=vec4(clamp(h,-.10,.10),state.x,0,1);
  }`});
 const caustics=new T.WebGLRenderTarget(256,192,{type:T.HalfFloatType,depthBuffer:false});
 const causticMaterial=new T.ShaderMaterial({uniforms:waterUniforms,vertexShader:fullscreenVertex,depthTest:false,depthWrite:false,fragmentShader:`
  varying vec2 vUv;${waterFieldGLSL}
  uniform vec3 uWaterSun;
  vec2 footprint(vec2 p,float depth){vec2 offset;vec3 field=waterField(p,offset);
   vec3 n=normalize(vec3(-field.y,1.,-field.z));vec3 ray=refract(-normalize(uWaterSun),n,1./1.333);
   return p+offset+ray.xz*(depth+field.x)/max(.25,-ray.y);}
  void main(){vec2 p=(vUv-.5)*vec2(20.,15.);float rad=length(p/vec2(10.,7.5));
   float depth=clamp(1.65-pow(rad,5.)*1.85,.08,1.65),e=.045;
   vec2 dx=(footprint(p+vec2(e,0),depth)-footprint(p-vec2(e,0),depth))/(2.*e);
   vec2 dz=(footprint(p+vec2(0,e),depth)-footprint(p-vec2(0,e),depth))/(2.*e);
   float compression=abs(dx.x*dz.y-dx.y*dz.x);
   float focus=clamp((1./max(.25,compression)-1.)*6.,0.,2.4);
   focus*=1.-smoothstep(.92,1.,rad);
   vec2 shift;vec3 wave=waterField(p,shift);vec3 ray=refract(-normalize(uWaterSun),normalize(vec3(-wave.y,1.,-wave.z)),1./1.333);
   gl_FragColor=vec4(focus,ray.xz/max(.25,-ray.y),1);
  }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),simulation),pass=new T.Scene(),camera=new T.Camera();pass.add(quad);quad.frustumCulled=false;
 const savedColor=new T.Color();const oldTarget=renderer.getRenderTarget(),oldAlpha=renderer.getClearAlpha();renderer.getClearColor(savedColor);renderer.setClearColor(0,0);
 for(const target of [...targets,caustics]){renderer.setRenderTarget(target);renderer.clear();}renderer.setRenderTarget(oldTarget);renderer.setClearColor(savedColor,oldAlpha);
 waterUniforms.uWaveMap.value=targets[0]!.texture;waterUniforms.uCausticMap.value=caustics.texture;
 let lastCausticTime=-1,lastBreeze=-1;const lastSun=new T.Vector3();
 return {splat(x:number,z:number,strength=1,radius=.22){if(queued===32)return;impulses[queued++]!.set(x,z,.017*Math.min(4,Math.max(0,strength)),Math.min(.9,Math.max(.12,radius)));lastImpulse=elapsed;},
  update(dt:number){elapsed+=dt;const previousTarget=renderer.getRenderTarget(),tone=renderer.toneMapping;renderer.toneMapping=T.NoToneMapping;
   try{
   // Bounded fixed steps prevent stalls from destabilizing the solver; paused dt=0 is inert.
   accumulator=Math.min(accumulator+Math.max(0,dt),FIELD_STEP*4);
   quad.material=simulation;
   while(accumulator>=FIELD_STEP){
    accumulator-=FIELD_STEP;if(elapsed-lastImpulse>20&&queued===0)continue;
    simUniforms.uPrevious.value=targets[current]!.texture;simUniforms.uCount.value=queued;
    renderer.setRenderTarget(targets[1-current]!);renderer.render(pass,camera);current=1-current;queued=0;steps++;
   }
   waterUniforms.uWaveMap.value=targets[current]!.texture;
   if(lastCausticTime!==waterUniforms.uWaterTime.value||lastBreeze!==waterUniforms.uWaterBreeze.value||!lastSun.equals(waterUniforms.uWaterSun.value)){
    quad.material=causticMaterial;renderer.setRenderTarget(caustics);renderer.render(pass,camera);
    lastCausticTime=waterUniforms.uWaterTime.value;lastBreeze=waterUniforms.uWaterBreeze.value;lastSun.copy(waterUniforms.uWaterSun.value);
   }
   }finally{renderer.setRenderTarget(previousTarget);renderer.toneMapping=tone;}
  },diagnostics:()=>({resolution:[FIELD_WIDTH,FIELD_HEIGHT],causticResolution:[256,192],steps,queued}),
  async inspect(){
   const pixels=new Uint16Array(FIELD_WIDTH*FIELD_HEIGHT*4);
   await renderer.readRenderTargetPixelsAsync(targets[current]!,0,0,FIELD_WIDTH,FIELD_HEIGHT,pixels);
   let peak=0,energy=0,finite=true;
   for(let i=0;i<pixels.length;i+=4){const height=T.DataUtils.fromHalfFloat(pixels[i]!);finite&&=Number.isFinite(height);peak=Math.max(peak,Math.abs(height));energy+=height*height;}
   return {peak,energy,finite};
  },
  dispose(){targets.forEach(t=>t.dispose());caustics.dispose();simulation.dispose();causticMaterial.dispose();quad.geometry.dispose();waterUniforms.uWaveMap.value=null;waterUniforms.uCausticMap.value=null;}
 };
}
