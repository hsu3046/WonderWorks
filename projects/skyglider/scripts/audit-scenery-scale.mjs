// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Read geometry in Node; image decoding is unnecessary for measuring transformed bounds.
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LOCAL_MODELS} from '../src/local-scenery-layout.ts';
import {MODEL_EXTENTS} from '../src/scenery-scale.ts';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createLocalScenery} from '../src/local-scenery.ts';
export async function auditSceneryScale(){
const models={},measurements=[];
for(const name of LOCAL_MODELS){
 const file=await fs.readFile(new URL(`../public/assets/local/${name}.glb`,import.meta.url)),length=file.readUInt32LE(12),j=JSON.parse(file.subarray(20,20+length)),binary=file.subarray(28+length);
 delete j.images;delete j.textures;delete j.materials;delete j.extensionsUsed;delete j.extensionsRequired;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
 let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const h=Buffer.alloc(20),b=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+binary.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);b.writeUInt32LE(binary.length);b.writeUInt32LE(0x004e4942,4);const stripped=Buffer.concat([h,json,b,binary]);
 const asset=await new GLTFLoader().parseAsync(stripped.buffer.slice(stripped.byteOffset,stripped.byteOffset+stripped.byteLength),'');models[name]=asset.scene;
 const bounds=new T.Box3().setFromObject(asset.scene,true),extent=bounds.getSize(new T.Vector3()).toArray();extent.forEach((v,i)=>{if(Math.abs(v-MODEL_EXTENTS[name][i])>1e-6)throw Error(`Stale dimension reference: ${name}`);});measurements.push({model:name,sourceExtent:extent,units:'source physical units unspecified'});
}
const scenery=createLocalScenery({models,meadow:new T.Texture(),leafFloor:new T.Texture()},new T.MeshStandardMaterial());
const report={measurements,placements:scenery.diagnostics().foundations};
return {report,group:scenery.group};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
const {report}=await auditSceneryScale();
const target=new URL('../../../docs/skyglider/SCENERY_SCALE_AUDIT.json',import.meta.url);await fs.writeFile(target,JSON.stringify(report,null,2)+'\n');
for(const s of report.placements)console.log(s.name,`${s.x},${s.z}`,`${s.dimensions.width.toFixed(2)} × ${s.dimensions.height.toFixed(2)} × ${s.dimensions.depth.toFixed(2)}`,'ground range',s.spread.toFixed(2));
}
