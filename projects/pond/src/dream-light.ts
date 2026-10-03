// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const sampleGLSL=`uniform sampler2D uSource;uniform vec2 uStep;varying vec2 vUv;
 vec3 sampleLight(vec2 uv){return texture2D(uSource,clamp(uv,vec2(0.),vec2(1.))).rgb;}`;

/** Soft, camera-occluded sunlight; the same source also appears in water reflections. */
export function createSunGlow(world:T.Scene){
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{uStrength:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform float uStrength;
   void main(){float r=length(vUv-.5)*2.;float core=1.-smoothstep(.065,.15,r);
    float halo=exp(-r*r*11.)*(1.-smoothstep(.7,1.,r));
    gl_FragColor=vec4((vec3(7.,5.3,3.1)*core+vec3(1.1,.65,.27)*halo)*uStrength,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const sun=new T.Mesh(new T.PlaneGeometry(22,22),material);
 sun.name='Dream light · sun and soft aureole';sun.renderOrder=-1;world.add(sun);
 return {update(camera:T.Camera,direction:T.Vector3,day:number,rain:boolean,amount:number){
  sun.position.copy(direction).normalize().multiplyScalar(82);sun.quaternion.copy(camera.quaternion);
  material.uniforms.uStrength!.value=amount*day*(rain?.10:1);
  sun.visible=amount>0&&day>0;
 }};
}

/** One sharp HDR scene, five small bloom passes, then one output conversion. */
export function createDreamLight(renderer:T.WebGLRenderer,onFallback:(message:string)=>void){
 const gl=renderer.getContext();
 let available=renderer.extensions.has('EXT_color_buffer_float'),failed=false,width=1,height=1;
 const sceneTarget=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:2});
 const levels=Array.from({length:3},()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}));
 const up=Array.from({length:2},()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}));
 const extract=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
  uniforms:{uSource:{value:sceneTarget.texture},uStep:{value:new T.Vector2()},uThreshold:{value:.65}},
  fragmentShader:`${sampleGLSL}uniform float uThreshold;
   vec3 bright(vec2 uv){vec3 c=sampleLight(uv);float l=dot(c,vec3(.2126,.7152,.0722));
    return c*smoothstep(uThreshold*.6,uThreshold*1.6,l);}
   void main(){vec3 c=bright(vUv-uStep)+bright(vUv+uStep)+bright(vUv+vec2(uStep.x,-uStep.y))+bright(vUv+vec2(-uStep.x,uStep.y));gl_FragColor=vec4(c*.25,1.);}`});
 const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
  uniforms:{uSource:{value:levels[0]!.texture},uStep:{value:new T.Vector2()},uDetail:{value:levels[0]!.texture},uMix:{value:0}},
  fragmentShader:`${sampleGLSL}uniform sampler2D uDetail;uniform float uMix;
   void main(){vec3 c=sampleLight(vUv)*.2;
    c+=(sampleLight(vUv+uStep)+sampleLight(vUv-uStep)+sampleLight(vUv+vec2(uStep.x,-uStep.y))+sampleLight(vUv+vec2(-uStep.x,uStep.y)))*.2;
    gl_FragColor=vec4(mix(c,texture2D(uDetail,vUv).rgb,uMix),1.);}`});
 const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,vertexShader,
  uniforms:{uScene:{value:sceneTarget.texture},uBloom:{value:up[0]!.texture},uStrength:{value:0},uScatter:{value:0},uScatterStep:{value:new T.Vector2()}},
  fragmentShader:`varying vec2 vUv;uniform sampler2D uScene,uBloom;uniform float uStrength,uScatter;uniform vec2 uScatterStep;
   void main(){vec3 base=texture2D(uScene,vUv).rgb;
    // Only submerged views diffuse the original image through the water column.
    if(uScatter>0.){vec3 soft=texture2D(uScene,clamp(vUv+uScatterStep,0.,1.)).rgb;
     soft+=texture2D(uScene,clamp(vUv-uScatterStep,0.,1.)).rgb;
     soft+=texture2D(uScene,clamp(vUv+vec2(uScatterStep.x,-uScatterStep.y),0.,1.)).rgb;
     soft+=texture2D(uScene,clamp(vUv+vec2(-uScatterStep.x,uScatterStep.y),0.,1.)).rgb;
     base=mix(base,soft*.25,uScatter);}
    vec3 halo=texture2D(uBloom,vUv).rgb*vec3(1.18,1.07,.74);
    gl_FragColor=vec4(base+halo*uStrength,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const quad=new FullScreenQuad(extract);
 let passes=0;
 function fallback(cause?:unknown){
  available=false;if(failed)return;failed=true;
  if(cause)console.error('Dream light unavailable',cause);
  onFallback('Soft light is unavailable on this device. The garden is using its original lighting.');
 }
 function validateTargets(){
  if(!available)return;
  const previous=renderer.getRenderTarget();
  try{
   for(const target of [sceneTarget,...levels,...up]){
    renderer.setRenderTarget(target);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete soft-light render target.');
   }
  }catch(cause){fallback(cause);}
  finally{renderer.setRenderTarget(previous);}
 }
 function draw(material:T.ShaderMaterial,target:T.WebGLRenderTarget|null){
  quad.material=material;renderer.setRenderTarget(target);quad.render(renderer);passes++;
 }
 function blurTo(source:T.WebGLRenderTarget,target:T.WebGLRenderTarget,radius:number,detail?:T.WebGLRenderTarget){
  blur.uniforms.uSource!.value=source.texture;blur.uniforms.uStep!.value.set(radius/source.width,radius/source.height);
  blur.uniforms.uDetail!.value=(detail??source).texture;blur.uniforms.uMix!.value=detail?.42:0;draw(blur,target);
 }
 if(!available)fallback();
 return {
  get target(){return available?sceneTarget:null;},
  resize(w:number,h:number){
   width=w;height=h;sceneTarget.setSize(w,h);
   // Limit only the light buffers. Original scene and water resolution stay intact.
   const scale=Math.min(.35,640/Math.max(w,h));
   levels.forEach((target,i)=>target.setSize(Math.max(1,Math.ceil(w*scale/2**i)),Math.max(1,Math.ceil(h*scale/2**i))));
   up.forEach((target,i)=>target.setSize(levels[i]!.width,levels[i]!.height));validateTargets();
  },
  render(renderScene:()=>void,amount:number,day:number,rain:boolean,underwater:boolean){
   passes=0;if(!available||amount<=0){composite.uniforms.uStrength!.value=0;renderScene();return;}
   const target=renderer.getRenderTarget(),tone=renderer.toneMapping;
   try{
    // Water captures restore this HDR target before rendering the main scene.
    renderer.setRenderTarget(sceneTarget);renderer.toneMapping=T.NoToneMapping;renderScene();
    extract.uniforms.uStep!.value.set(.75/levels[0]!.width,.75/levels[0]!.height);
    extract.uniforms.uThreshold!.value=underwater?.52:.80;draw(extract,levels[0]!);
    blurTo(levels[0]!,levels[1]!,1.05);blurTo(levels[1]!,levels[2]!,1.05);
    blurTo(levels[2]!,up[1]!,1.05,levels[1]);blurTo(up[1]!,up[0]!,1.05,levels[0]);
    composite.uniforms.uStrength!.value=amount*(.65+.55*day)*(rain?.48:1)*(underwater?1.05:1);
    composite.uniforms.uScatter!.value=underwater?Math.min(.32,amount*.22):0;
    composite.uniforms.uScatterStep!.value.set(4.5/width,4.5/height);
    renderer.toneMapping=tone;draw(composite,target);
   }finally{renderer.toneMapping=tone;renderer.setRenderTarget(target);}
  },
  diagnostics:()=>({available,amount:composite.uniforms.uStrength!.value,passes,scene:[width,height],bloom:levels.map(t=>[t.width,t.height]),samples:sceneTarget.samples}),
  dispose(){sceneTarget.dispose();for(const target of [...levels,...up])target.dispose();extract.dispose();blur.dispose();composite.dispose();quad.dispose();}
 };
}
