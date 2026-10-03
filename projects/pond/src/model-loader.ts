// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createTaskPool} from './task-pool';
// Bound decode bursts while independent assets share the same download window.
const run=createTaskPool(4);
export function createModelLoader(){
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 return {loadAsync:(url:string)=>run(()=>loader.loadAsync(url))};
}
