// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Authoring-only: uses the existing workspace meshoptimizer, never loaded by the browser.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {MeshoptSimplifier} from 'meshoptimizer';
const input=process.argv[2];if(!input)throw new Error('Usage: node scripts/prepare-tree.mjs <downloaded source folder>');
const output=path.resolve('public/assets/island_tree_02');await fs.mkdir(output,{recursive:true});
const source=JSON.parse(await fs.readFile(path.join(input,'source.gltf'),'utf8'));
const sourceBuffer=await fs.readFile(path.join(input,source.buffers[0].uri));
const document=structuredClone(source);document.accessors=[];document.bufferViews=[];
const chunks=[];let length=0;
function data(index){const a=source.accessors[index],v=source.bufferViews[a.bufferView];const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];const bytes={5126:4,5125:4,5123:2}[a.componentType];const Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];const offset=(v.byteOffset||0)+(a.byteOffset||0);if(v.byteStride&&v.byteStride!==size*bytes)throw new Error('Unexpected interleaved source');const raw=sourceBuffer.subarray(offset,offset+a.count*size*bytes);return new Type(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));}
function append(values,template){const buf=Buffer.from(values.buffer,values.byteOffset,values.byteLength);const pad=Buffer.alloc((4-buf.length%4)%4);const view=document.bufferViews.push({buffer:0,byteOffset:length,byteLength:buf.length})-1;chunks.push(buf,pad);length+=buf.length+pad.length;const a={...template,bufferView:view,byteOffset:0,count:values.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[template.type])};delete a.min;delete a.max;if(template.type==='VEC3'&&template.min){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++){a.min[i%3]=Math.min(a.min[i%3],values[i]);a.max[i%3]=Math.max(a.max[i%3],values[i]);}}return document.accessors.push(a)-1;}
await MeshoptSimplifier.ready;const stats=[];
for(let i=0;i<source.meshes[0].primitives.length;i++){
 const original=source.meshes[0].primitives[i],primitive=document.meshes[0].primitives[i];
 const indices=Uint32Array.from(data(original.indices)),positions=data(original.attributes.POSITION),target=[3500,22000,3000][i]*3;
 const [reduced,error]=MeshoptSimplifier.simplify(indices,positions,3,target,.018,['Prune']);
 const [remap,count]=MeshoptSimplifier.compactMesh(reduced);
 for(const [semantic,idx] of Object.entries(original.attributes)){const src=data(idx),a=source.accessors[idx],size={VEC2:2,VEC3:3,VEC4:4}[a.type],dst=new Float32Array(count*size);for(let v=0;v<remap.length;v++)if(remap[v]<count)dst.set(src.subarray(v*size,v*size+size),remap[v]*size);primitive.attributes[semantic]=append(dst,a);}
 primitive.indices=append(reduced,{componentType:5125,type:'SCALAR'});stats.push({material:original.material,sourceTriangles:indices.length/3,triangles:reduced.length/3,error});
}
for(const img of document.images){const from=path.join(input,img.uri),name=path.basename(img.uri,'.jpg')+'.webp';execFileSync('cwebp',['-quiet','-q','87','-resize','512','512',from,'-o',path.join(output,name)]);img.uri=name;img.mimeType='image/webp';}
for(const mat of document.materials){mat.alphaMode='OPAQUE';delete mat.alphaCutoff;mat.doubleSided=true;}
document.buffers=[{uri:'tree.bin',byteLength:length}];document.asset.extras={source:'https://polyhaven.com/a/island_tree_02',license:'CC0-1.0',modifications:'Geometry simplified; textures resized to 512px WebP; leaf blending replaced with solid geometric leaves.'};
await fs.writeFile(path.join(output,'tree.bin'),Buffer.concat(chunks));await fs.writeFile(path.join(output,'tree.gltf'),JSON.stringify(document));await fs.writeFile(path.join(output,'processing.json'),JSON.stringify(stats,null,2)+'\n');console.log(JSON.stringify({stats,geometryBytes:length}));
