// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** A continuous Gaussian footprint, rather than shifted copies of a sharp silhouette. */
export function createOpticalDiffusion(renderer:T.WebGLRenderer){
 const horizontal=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 const vertical=horizontal.clone(),prefilter=horizontal.clone();
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{uSource:{value:horizontal.texture},uStep:{value:new T.Vector2()},uPrefilter:{value:false}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D uSource;uniform vec2 uStep;uniform bool uPrefilter;varying vec2 vUv;
   vec3 sampleAt(vec2 uv){return texture2D(uSource,clamp(uv,vec2(0.),vec2(1.))).rgb;}
   void main(){
    if(uPrefilter){gl_FragColor=vec4(sampleAt(vUv),1.);return;}
    // Bilinear pairs implement the nine neighbouring Gaussian taps in five reads.
    vec3 color=sampleAt(vUv)*.2270270270;
    color+=(sampleAt(vUv+uStep*1.3846153846)+sampleAt(vUv-uStep*1.3846153846))*.3162162162;
    color+=(sampleAt(vUv+uStep*3.2307692308)+sampleAt(vUv-uStep*3.2307692308))*.0702702703;
    gl_FragColor=vec4(color,1.);
   }`});
 const quad=new FullScreenQuad(material);let passes=0;
 return {
  get texture(){return vertical.texture;},
  resize(width:number,height:number){horizontal.setSize(Math.max(1,Math.ceil(width/2)),Math.max(1,Math.ceil(height/2)));vertical.setSize(horizontal.width,horizontal.height);prefilter.setSize(horizontal.width,horizontal.height);},
  skip(){passes=0;},
  render(source:T.Texture){
   const target=renderer.getRenderTarget();passes=0;
   try{
    // Downsample first: Gaussian tap pairs must sample adjacent texels of their source.
    // Applying half-size steps directly to the full-size source leaves holes in the kernel.
    material.uniforms.uSource!.value=source;material.uniforms.uPrefilter!.value=true;
    renderer.setRenderTarget(prefilter);quad.render(renderer);passes++;
    material.uniforms.uSource!.value=prefilter.texture;material.uniforms.uPrefilter!.value=false;
    material.uniforms.uStep!.value.set(1/horizontal.width,0);
    renderer.setRenderTarget(horizontal);quad.render(renderer);passes++;
    material.uniforms.uSource!.value=horizontal.texture;material.uniforms.uStep!.value.set(0,1/horizontal.height);
    renderer.setRenderTarget(vertical);quad.render(renderer);passes++;
   }finally{renderer.setRenderTarget(target);}
  },
  diagnostics:()=>({resolution:[vertical.width,vertical.height],passes}),
  dispose(){horizontal.dispose();vertical.dispose();prefilter.dispose();material.dispose();quad.dispose();}
 };
}
