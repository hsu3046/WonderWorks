// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Offline derivatives: exact geometry compression; simplify only distant flowers.
// Reuses the workspace's existing meshoptimizer and the installed cwebp CLI.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {MeshoptEncoder as encoder} from '../../fish/node_modules/meshoptimizer/meshopt_encoder.js';
import {MeshoptDecoder as decoder} from '../../fish/node_modules/meshoptimizer/meshopt_decoder.mjs';
import {MeshoptSimplifier as simplifier} from '../../fish/node_modules/meshoptimizer/meshopt_simplifier.js';
await Promise.all([encoder.ready,decoder.ready,simplifier.ready]);
const base=new URL('../public/models/',import.meta.url),temp=await fs.mkdtemp(path.join(os.tmpdir(),'pond-opt-'));
const stats=[];
function parse(bytes){const len=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+len)),bin:bytes.subarray(28+len)};}
function glb(json,bin){let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+bin.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);const b=Buffer.alloc(8);b.writeUInt32LE(bin.length);b.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,b,bin]);}
const sizes={5121:1,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function accessorData(j,views,index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],bytes=views[a.bufferView],size=sizes[a.componentType]*components[a.type],stride=v.byteStride||size,out=Buffer.alloc(a.count*size);for(let i=0;i<a.count;i++)bytes.copy(out,i*size,(a.byteOffset||0)+i*stride,(a.byteOffset||0)+i*stride+size);return out;}
async function optimize(file,{flower,near=false,target}={}){
 const original=await fs.readFile(new URL(file+'.glb',base));const {json:j,bin}=parse(original);
 let views=j.bufferViews.map(v=>Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)));
 if(flower){
  const node=j.nodes.find(n=>n.name===flower+(near?'Near':'Far'));if(!node)throw Error('Missing flower node');
  j.meshes=[j.meshes[node.mesh]];j.nodes=[{...node,mesh:0}];j.scenes=[{nodes:[0]}];j.scene=0;
  if(near){delete j.materials;delete j.textures;delete j.images;delete j.samplers;delete j.extensionsUsed;delete j.extensionsRequired;for(const p of j.meshes[0].primitives)delete p.material;}
  else for(const p of j.meshes[0].primitives){
   const pos=accessorData(j,views,p.attributes.POSITION),a=j.accessors[p.indices],ib=accessorData(j,views,p.indices);
   const indices=new Uint32Array(a.count);for(let i=0;i<a.count;i++)indices[i]=a.componentType===5123?ib.readUInt16LE(i*2):ib.readUInt32LE(i*4);
   const positions=new Float32Array(pos.buffer,pos.byteOffset,pos.length/4);
   // Attribute-aware reduction keeps UV seams and normals. No changes to close LOD.
   const uv=accessorData(j,views,p.attributes.TEXCOORD_0),norm=accessorData(j,views,p.attributes.NORMAL),attrs=new Float32Array(positions.length/3*5);
   for(let i=0;i<positions.length/3;i++){for(let k=0;k<3;k++)attrs[i*5+k]=norm.readFloatLE(i*12+k*4);for(let k=0;k<2;k++)attrs[i*5+3+k]=uv.readFloatLE(i*8+k*4);}
   const [reduced,error]=simplifier.simplifyWithAttributes(indices,positions,3,attrs,5,[.05,.05,.05,.1,.1],null,target*3,.04,['Permissive']);
   const vi=views.length;views.push(Buffer.from(reduced.buffer,reduced.byteOffset,reduced.byteLength));j.bufferViews.push({buffer:0,byteLength:reduced.byteLength,target:34963});
   p.indices=j.accessors.length;j.accessors.push({componentType:5125,type:'SCALAR',count:reduced.length,bufferView:vi});
   stats.push({flower,trianglesBefore:indices.length/3,trianglesAfter:reduced.length/3,error});
  }
  // Remove near-only accessor/view references, including image-only data in near files.
  const used=new Set();for(const m of j.meshes)for(const p of m.primitives){used.add(p.indices);Object.values(p.attributes).forEach(i=>used.add(i));}
  const map=new Map([...used].map((old,i)=>[old,i]));j.accessors=[...used].map(i=>j.accessors[i]);
  for(const m of j.meshes)for(const p of m.primitives){p.indices=map.get(p.indices);for(const k in p.attributes)p.attributes[k]=map.get(p.attributes[k]);}
 }
 // Encode PNG/JPEG photographs as WebP; retain existing WebP and all alpha data.
 const dataImages=new Set();for(const m of j.materials||[])for(const info of [m.normalTexture,m.occlusionTexture,m.pbrMetallicRoughness?.metallicRoughnessTexture])if(info){const t=j.textures[info.index];dataImages.add(t.source??t.extensions?.EXT_texture_webp?.source);}
 for(const [i,img] of (j.images||[]).entries())if(img.mimeType!=='image/webp'){
  const input=path.join(temp,'input'),output=path.join(temp,'output.webp');await fs.writeFile(input,views[img.bufferView]);
  // Data maps, eyes, and alpha keep lossless samples; color photos use high quality.
  const lossless=dataImages.has(i)||file.includes('aib-goldfish');
  execFileSync('cwebp',['-quiet',...(lossless?['-lossless']:['-q','92','-alpha_q','100']),'-m','6',input,'-o',output]);
  const encoded=await fs.readFile(output);if(encoded.length<views[img.bufferView].length){views[img.bufferView]=encoded;img.mimeType='image/webp';}
 }
 for(const t of j.textures||[]){if(j.images[t.source]?.mimeType==='image/webp'){t.extensions={...t.extensions,EXT_texture_webp:{source:t.source}};delete t.source;}}
 if((j.images||[]).some(i=>i.mimeType==='image/webp')){j.extensionsUsed=[...new Set([...(j.extensionsUsed||[]),'EXT_texture_webp'])];j.extensionsRequired=[...new Set([...(j.extensionsRequired||[]),'EXT_texture_webp'])];}
 // Pack only used bufferViews. Lossless meshopt round-trip is checked byte for byte.
 const used=new Set();for(const a of j.accessors||[]){if(a.bufferView!==undefined)used.add(a.bufferView);if(a.sparse){used.add(a.sparse.indices.bufferView);used.add(a.sparse.values.bufferView);}}
 for(const img of j.images||[])used.add(img.bufferView);
 const indexViews=new Set(j.meshes.flatMap(m=>m.primitives.map(p=>j.accessors[p.indices]?.bufferView)).filter(i=>i!==undefined));
 const chunks=[],outViews=[],viewMap=new Map();let offset=0,fallback=0;
 const append=bytes=>{const at=offset;chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return at;};
 for(const old of used){const bytes=views[old],v={...j.bufferViews[old]},a=j.accessors?.find(a=>a.bufferView===old);viewMap.set(old,outViews.length);
  const stride=v.byteStride||(a?sizes[a.componentType]*components[a.type]:0),index=indexViews.has(old),mode=index?'INDICES':'ATTRIBUTES';
  if(a&&stride>=4&&stride<=256&&stride%4===0&&bytes.length%stride===0&&!a.sparse){
   const count=bytes.length/stride,compressed=encoder.encodeGltfBuffer(bytes,count,stride,mode),roundtrip=new Uint8Array(bytes.length);decoder.decodeGltfBuffer(roundtrip,count,stride,compressed,mode);if(!Buffer.from(roundtrip).equals(bytes))throw Error('Non-lossless codec '+file);
   v.extensions={...v.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:append(Buffer.from(compressed)),byteLength:compressed.length,byteStride:stride,count,mode,filter:'NONE'}};
   v.buffer=1;v.byteOffset=fallback;v.byteLength=bytes.length;fallback+=bytes.length;
  }else {v.buffer=0;v.byteOffset=append(bytes);v.byteLength=bytes.length;}
  outViews.push(v);
 }
 for(const a of j.accessors||[]){if(a.bufferView!==undefined)a.bufferView=viewMap.get(a.bufferView);if(a.sparse){a.sparse.indices.bufferView=viewMap.get(a.sparse.indices.bufferView);a.sparse.values.bufferView=viewMap.get(a.sparse.values.bufferView);}}
 for(const img of j.images||[])img.bufferView=viewMap.get(img.bufferView);
 j.bufferViews=outViews;j.buffers=[{byteLength:offset},{byteLength:fallback,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 j.extensionsUsed=[...new Set([...(j.extensionsUsed||[]),'EXT_meshopt_compression'])];j.extensionsRequired=[...new Set([...(j.extensionsRequired||[]),'EXT_meshopt_compression'])];
 const name=flower?`${flower.toLowerCase()}-${near?'near':'far'}-v2`:`${file}-packed-v1`,out=glb(j,Buffer.concat(chunks));await fs.writeFile(new URL(name+'.glb',base),out);stats.push({file:name,before:original.length,after:out.length});console.log(name,original.length,'→',out.length);
}
try{
 for(const file of ['wooden-bridge-refined-v1','wooden-gazebo-refined-v1','montane-frog-hopping','aib-goldfish-v5','aib-goldfish-v5-cornea','monarch-butterfly','jikin-neutral-v1','tosakin','ryukin','shubunkin'])await optimize(file);
 for(const [file,flower,target] of [['hydrangea-garden-v1','Hydrangea',2800],['azalea-garden-v1','Azalea',1000]]){await optimize(file,{flower,target});await optimize(file,{flower,near:true});}
 const textures=new URL('../public/textures/',import.meta.url);
 for(const file of await fs.readdir(textures))if(file.endsWith('_1k.jpg')){const src=new URL(file,textures),dst=new URL(file.replace('.jpg','-v2.webp'),textures);execFileSync('cwebp',['-quiet','-q','92','-m','6',src.pathname,'-o',dst.pathname]);stats.push({file:dst.pathname.split('/').pop(),before:(await fs.stat(src)).size,after:(await fs.stat(dst)).size});}
 await fs.writeFile(new URL('../../../docs/pond/asset-optimization.json',import.meta.url),JSON.stringify(stats,null,2)+'\n');
}finally{await fs.rm(temp,{recursive:true,force:true});}
