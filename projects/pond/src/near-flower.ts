// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {createModelLoader} from './model-loader';
import {disposeObjects} from './scene-resources';
/** Download exact near geometry once, only when approached; keep far flowers visible meanwhile. */
export function deferredFlower(file:string,nodeName:string,apply:(g:T.BufferGeometry)=>void,onError:(message:string)=>void){
 let state:'idle'|'loading'|'ready'|'failed'='idle',disposed=false;
 return {get ready(){return state==='ready';},get state(){return state;},request(){
  if(state!=='idle'||disposed)return;state='loading';
  void createModelLoader().loadAsync(`${import.meta.env.BASE_URL}models/${file}.glb`).then(asset=>{
   const mesh=asset.scene.getObjectByName(nodeName);
   if(disposed){disposeObjects(asset.scene);return;}
   if(!(mesh instanceof T.Mesh)){disposeObjects(asset.scene);throw new Error('Missing flower geometry');}
   const geometry=mesh.geometry.clone();disposeObjects(asset.scene);apply(geometry);state='ready';
  }).catch(cause=>{state='failed';if(!disposed){console.error(cause);onError('Close-up flowers could not load. Distant flowers remain visible; reload to retry.');}});
 },dispose(){disposed=true;}};
}
