// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Offline only. Originals are read-only; the browser needs no geometry decoder.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {MeshoptSimplifier as simplifier,MeshoptDecoder as decoder} from 'meshoptimizer';
const root=process.argv[2];if(!root)throw Error('Usage: node scripts/prepare-local-scenery.mjs <original Wonderworks directory>');
const out=new URL('../public/assets/local/',import.meta.url);await fs.mkdir(out,{recursive:true});
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'skyglider-scenery-'));
const specs=[
 ['bridge','assets/Wooden_Bridge_Refined/Wooden_Bridge_Refined_v1.glb',24000],
 ['gazebo','assets/Wooden_Gazebo_Refined/Wooden_Gazebo_Refined_v1.glb',22000],
 ['cherry','assets/樱花树3d模型.glb',24000],
 ['house','assets/whimsical house 3d model.glb',18000],
 ['castle','assets/fantasy castle 3d model.glb',32000],
 ['hydrangea','projects/pond/public/models/hydrangea-far-v2.glb',2800],
 ['azalea','projects/pond/public/models/azalea-far-v2.glb',1000],
 ['butterfly','assets/monarch butterfly 3d model.glb',3000],
];
const sizes={5121:1,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
await Promise.all([simplifier.ready,decoder.ready]);const report=[];
try{for(const [name,file,budget] of specs){
 const original=await fs.readFile(path.join(root,file)),length=original.readUInt32LE(12),j=JSON.parse(original.subarray(20,20+length)),bin=original.subarray(28+length);
 if(j.animations?.length||j.skins?.length)throw Error('Only static scenery is supported');
 const views=j.bufferViews.map(v=>{const e=v.extensions?.EXT_meshopt_compression;if(e){const decoded=new Uint8Array(e.count*e.byteStride);decoder.decodeGltfBuffer(decoded,e.count,e.byteStride,bin.subarray(e.byteOffset,e.byteOffset+e.byteLength),e.mode,e.filter);return Buffer.from(decoded);}return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);});
 function data(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],size=sizes[a.componentType]*components[a.type],stride=v.byteStride||size,src=views[a.bufferView],b=Buffer.alloc(a.count*size);for(let i=0;i<a.count;i++)src.copy(b,i*size,(a.byteOffset||0)+i*stride,(a.byteOffset||0)+i*stride+size);return b;}
 const accessors=[],bufferViews=[],chunks=[];let offset=0;
 function append(bytes){const index=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;chunks.push(Buffer.alloc(pad));offset+=pad;return index;}
 function attribute(values,original){const bufferView=append(Buffer.from(values.buffer,values.byteOffset,values.byteLength)),a={...original,bufferView,byteOffset:0,count:values.length/components[original.type]};delete a.min;delete a.max;if(original.type==='VEC3'&&original.min){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++){a.min[i%3]=Math.min(a.min[i%3],values[i]);a.max[i%3]=Math.max(a.max[i%3],values[i]);}}return accessors.push(a)-1;}
 let before=0,after=0;const total=j.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+j.accessors[p.indices].count/3,0);
 for(const m of j.meshes)for(const p of m.primitives){
  const ib=data(p.indices),ia=j.accessors[p.indices],indices=new Uint32Array(ia.count);for(let i=0;i<ia.count;i++)indices[i]=ia.componentType===5123?ib.readUInt16LE(i*2):ib.readUInt32LE(i*4);
  const pb=data(p.attributes.POSITION),positions=new Float32Array(pb.buffer,pb.byteOffset,pb.length/4),attrs=[];let weights=[];
  for(const key of ['NORMAL','TEXCOORD_0'])if(p.attributes[key]!==undefined){const raw=data(p.attributes[key]),a=j.accessors[p.attributes[key]],size=components[a.type];attrs.push({raw,size});weights.push(...Array(size).fill(key==='NORMAL'?.05:.12));}
  const count=positions.length/3,stride=weights.length,attributes=new Float32Array(count*stride);
  for(let i=0;i<count;i++){let k=0;for(const a of attrs)for(let c=0;c<a.size;c++)attributes[i*stride+k++]=a.raw.readFloatLE((i*a.size+c)*4);}
  const target=Math.max(16,Math.round(budget*(indices.length/3)/total))*3;
  const reduced=indices.length>target?simplifier.simplifyWithAttributes(indices,positions,3,attributes,stride,weights,null,target,.025,['Permissive','Prune'])[0]:indices;
  before+=indices.length/3;after+=reduced.length/3;const [remap,vertices]=simplifier.compactMesh(reduced);
  for(const [key,index] of Object.entries(p.attributes)){const a=j.accessors[index];if(a.componentType!==5126)throw Error('Expected floating point attribute');const raw=data(index),size=components[a.type],values=new Float32Array(vertices*size);for(let v=0;v<remap.length;v++)if(remap[v]<vertices)for(let c=0;c<size;c++)values[remap[v]*size+c]=raw.readFloatLE((v*size+c)*4);p.attributes[key]=attribute(values,a);}
  p.indices=attribute(reduced,{componentType:5125,type:'SCALAR'});
 }
 const dataImages=new Set();for(const m of j.materials)for(const info of [m.normalTexture,m.occlusionTexture,m.pbrMetallicRoughness?.metallicRoughnessTexture])if(info){const t=j.textures[info.index];dataImages.add(t.source??t.extensions?.EXT_texture_webp?.source);}
 for(const [i,img] of (j.images||[]).entries()){
  const input=path.join(temp,'input'),output=path.join(temp,'output.webp');await fs.writeFile(input,views[img.bufferView]);
  // Color detail stays at 1K, including source alpha. Data maps are resampled then losslessly encoded.
  execFileSync('cwebp',['-quiet',...(dataImages.has(i)?['-lossless']:['-q','90','-alpha_q','100']),'-resize','1024','0',input,'-o',output]);
  img.bufferView=append(await fs.readFile(output));img.mimeType='image/webp';delete img.uri;
 }
 for(const t of j.textures||[]){const source=t.source??t.extensions?.EXT_texture_webp?.source;t.extensions={EXT_texture_webp:{source}};delete t.source;}
 // Preserve authored PBR maps, discard unsupported exporter metadata and expensive transmission.
 for(const m of j.materials){delete m.extensions;m.pbrMetallicRoughness.metallicFactor=0;m.pbrMetallicRoughness.roughnessFactor=Math.max(.7,m.pbrMetallicRoughness.roughnessFactor??1);}
 j.extensionsUsed=j.extensionsRequired=['EXT_texture_webp'];j.accessors=accessors;j.bufferViews=bufferViews;j.buffers=[{byteLength:offset}];
 j.asset.extras={...j.asset.extras,source:file,sourceSha256:createHash('sha256').update(original).digest('hex'),modifications:'Attribute-aware static geometry reduction, compact vertices, 1K WebP maps. Source rights unchanged.'};
 let header=Buffer.from(JSON.stringify(j));header=Buffer.concat([header,Buffer.alloc((4-header.length%4)%4,32)]);const binary=Buffer.concat(chunks),h=Buffer.alloc(20),b=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+header.length+binary.length,8);h.writeUInt32LE(header.length,12);h.writeUInt32LE(0x4e4f534a,16);b.writeUInt32LE(binary.length);b.writeUInt32LE(0x004e4942,4);const packed=Buffer.concat([h,header,b,binary]);await fs.writeFile(new URL(name+'.glb',out),packed);
 report.push({name,source:file,sourceBytes:original.length,bytes:packed.length,sourceTriangles:before,triangles:after,sha256:j.asset.extras.sourceSha256});console.log(name,before,'→',after,'triangles;',packed.length,'bytes');
 }
 for(const [name,file] of [['meadow','assets/meadow-ground-v1.png'],['leaf-floor','assets/foliage-autumn-ground-v1.png']]){const source=path.join(root,file);execFileSync('cwebp',['-quiet','-q','88',source,'-o',new URL(name+'.webp',out).pathname]);const bytes=await fs.readFile(source);report.push({name,source:file,sourceBytes:bytes.length,bytes:(await fs.stat(new URL(name+'.webp',out))).size,sha256:createHash('sha256').update(bytes).digest('hex')});}
 await fs.writeFile(new URL('processing.json',out),JSON.stringify(report,null,2)+'\n');
}finally{await fs.rm(temp,{recursive:true,force:true});}
