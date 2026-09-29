// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { HalfFloatType, RenderPipeline, type PerspectiveCamera, type Scene, type WebGPURenderer } from 'three/webgpu';
import { getViewPosition, pass, rtt, uniform, uv, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import type { OceanUniforms } from './shared';
import { volumeLight } from './shaders';

export function createPostprocessing(renderer:WebGPURenderer,scene:Scene,camera:PerspectiveCamera,u:OceanUniforms){
  // Scene and effects stay linear HDR. RenderPipeline owns the single final output transform.
  const scenePass=pass(scene,camera,{type:HalfFloatType});
  const color=scenePass.getTextureNode('output');
  const depth=scenePass.getTextureNode('depth');
  const view=getViewPosition(uv(),depth,uniform(camera.projectionMatrixInverse));
  const world=uniform(camera.matrixWorld).mul(vec4(view,1)).xyz;
  const shafts=rtt(vec4(volumeLight({end:world,eye:u.eye,t:u.time,strength:u.rays}),1),null,null,{resolutionScale:.5,depthBuffer:false});
  // Denoise only the low-frequency light volume; fish and terrain retain their detail.
  const softShafts=gaussianBlur(shafts,2,3);
  // Let the bright water volume bloom too, while retaining the darker seabed.
  const illuminated=vec4(color.rgb.add(softShafts.rgb),color.a);
  const glow=bloom(illuminated,.42,.85,1.05).setResolutionScale(.5);
  const pipeline=new RenderPipeline(renderer);
  pipeline.outputNode=vec4(illuminated.rgb.add(glow.rgb),color.a);
  return {
    render:()=>pipeline.render(),
    dispose:()=>{pipeline.dispose();scenePass.dispose();shafts.dispose();softShafts.dispose();glow.dispose();},
  };
}
