// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Offline authoring: one continuous skin surface, rather than intersecting render-time primitives.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {HEAD_PIVOT,LIMB_BIND,SQUIRREL_BONES} from '../src/squirrel-rig.ts';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const shapes=[];
function ellipsoid(center,radius,bone=0,blend=.085){shapes.push({kind:'ellipsoid',center,radius,bone,blend});}
function capsule(a,b,r0,r1,bone,blend=.06){const delta=b.map((v,i)=>v-a[i]);shapes.push({kind:'capsule',a,delta,length2:delta.reduce((s,v)=>s+v*v,0),r0,r1,bone,blend});}
ellipsoid([0,.11,.37],[.355,.365,.57]); // Rounded haunches and rising back.
ellipsoid([0,.025,-.04],[.293,.270,.52]);
ellipsoid([0,.065,-.41],[.267,.275,.34]);
ellipsoid([0,.125,-.65],[.207,.213,.27]);
ellipsoid([0,.165,-.89],[.251,.237,.303],1,.075);
ellipsoid([0,.065,-1.065],[.177,.142,.230],1,.070);
ellipsoid([0,.032,-1.205],[.105,.093,.113],1,.045);
for(const leg of LIMB_BIND){
  const {sign,front,root,joint,foot,upper,lower,paw}=leg;
  if(!front)ellipsoid([sign*.258,-.035,.475],[.183,.251,.248],upper,.10);
  capsule(root,joint,front?.116:.145,front?.087:.092,upper,.08);
  capsule(joint,foot,front?.080:.083,.048,lower,.047);
  ellipsoid([foot[0],foot[1]+.007,foot[2]-.026],[front?.068:.076,.030,.092],paw,.025);
}
function distance(shape,x,y,z){
  if(shape.kind==='ellipsoid'){
    const p=[x-shape.center[0],y-shape.center[1],z-shape.center[2]],r=shape.radius;
    const k0=Math.hypot(p[0]/r[0],p[1]/r[1],p[2]/r[2]);
    const k1=Math.hypot(p[0]/r[0]**2,p[1]/r[1]**2,p[2]/r[2]**2);
    return k1>1e-10?k0*(k0-1)/k1:-Math.min(...r);
  }
  const px=x-shape.a[0],py=y-shape.a[1],pz=z-shape.a[2],d=shape.delta;
  const t=clamp((px*d[0]+py*d[1]+pz*d[2])/shape.length2,0,1);
  return Math.hypot(px-d[0]*t,py-d[1]*t,pz-d[2]*t)-mix(shape.r0,shape.r1,t);
}
function field(x,y,z){
  let result=10;
  for(const shape of shapes){const d=distance(shape,x,y,z),h=clamp(.5+.5*(d-result)/shape.blend,0,1);result=mix(d,result,h)-shape.blend*h*(1-h);}
  return result;
}
const resolution=112,extent=1.52,offsetZ=-.19;
const mc=new MarchingCubes(resolution,new T.MeshBasicMaterial(),false,false,80000);mc.isolation=0;
for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  mc.field[x+y*resolution+z*resolution*resolution]=-field((x/resolution*2-1)*extent,(y/resolution*2-1)*extent,(z/resolution*2-1)*extent+offsetZ);
}
mc.update();
if(mc.count/3>=80000)throw new Error('Squirrel authoring buffer is too small.');
const raw=new T.BufferGeometry();
raw.setAttribute('position',new T.BufferAttribute(mc.positionArray.slice(0,mc.count*3),3));
raw.setAttribute('normal',new T.BufferAttribute(mc.normalArray.slice(0,mc.count*3),3));
raw.scale(extent,extent,extent);raw.translate(0,0,offsetZ);raw.normalizeNormals();
const geometry=mergeVertices(raw,1e-4),positions=geometry.attributes.position;
// Welding can collapse triangles that lie almost exactly on a marching-cube corner.
const triangles=[];
for(let i=0;i<geometry.index.count;i+=3){const a=geometry.index.getX(i),b=geometry.index.getX(i+1),c=geometry.index.getX(i+2);if(a!==b&&b!==c&&a!==c)triangles.push(a,b,c);}
geometry.setIndex(triangles);
const joints=new Uint8Array(positions.count*4),weights=new Float32Array(positions.count*4);
const boneWeights=new Float64Array(SQUIRREL_BONES);
for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  boneWeights.fill(0);const distances=shapes.map(s=>distance(s,x,y,z)),nearest=Math.min(...distances);
  shapes.forEach((shape,j)=>{boneWeights[shape.bone]=Math.max(boneWeights[shape.bone],Math.exp(-(distances[j]-nearest)*38));});
  const strongest=[...boneWeights].map((weight,bone)=>({weight,bone})).sort((a,b)=>b.weight-a.weight).slice(0,4),sum=strongest.reduce((s,b)=>s+b.weight,0);
  strongest.forEach((b,j)=>{joints[i*4+j]=b.bone;weights[i*4+j]=b.weight/sum;});
}

const nodes=[{name:'Squirrel',children:[1,...Array.from({length:SQUIRREL_BONES},(_,i)=>i+2)]},{name:'Continuous squirrel skin',mesh:0,skin:0}];
const boneTransforms=Array.from({length:SQUIRREL_BONES},()=>new T.Matrix4());
function bone(index,name,pivot,end){
  const q=new T.Quaternion();if(end)q.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...end).sub(new T.Vector3(...pivot)).normalize());
  nodes[index+2]={name,translation:[...pivot],rotation:q.toArray()};boneTransforms[index].compose(new T.Vector3(...pivot),q,new T.Vector3(1,1,1));
}
bone(0,'torso',[0,0,0]);bone(1,'head',HEAD_PIVOT);
for(const leg of LIMB_BIND){bone(leg.upper,`${leg.name}_upper`,leg.root,leg.joint);bone(leg.lower,`${leg.name}_lower`,leg.joint,leg.foot);bone(leg.paw,`${leg.name}_paw`,leg.foot);}
const inverseBind=new Float32Array(SQUIRREL_BONES*16);boneTransforms.forEach((m,i)=>m.invert().toArray(inverseBind,i*16));

const gltf={asset:{version:'2.0',generator:'Wonderworks squirrel sculpt v3',copyright:'© 2026 AIB Inc. https://www.aib.vote — GPL-3.0-only'},scene:0,scenes:[{nodes:[0]}],nodes,
  meshes:[{primitives:[{attributes:{},material:0}]}],skins:[{joints:Array.from({length:SQUIRREL_BONES},(_,i)=>i+2),skeleton:0}],
  materials:[{name:'Squirrel coat',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.92}}],buffers:[],bufferViews:[],accessors:[]};
const chunks=[];let offset=0;
function attribute(array,size,type,target,extrema=false){
  const buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=gltf.bufferViews.length;
  gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length,...(target?{target}:{})});chunks.push(buffer);offset+=buffer.length;
  const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
  const accessor={bufferView:view,componentType:type,count:array.length/size,type:size===1?'SCALAR':size===16?'MAT4':`VEC${size}`};
  if(extrema){accessor.min=Array(size).fill(Infinity);accessor.max=Array(size).fill(-Infinity);for(let i=0;i<array.length;i++){const c=i%size;accessor.min[c]=Math.min(accessor.min[c],array[i]);accessor.max[c]=Math.max(accessor.max[c],array[i]);}}
  gltf.accessors.push(accessor);return gltf.accessors.length-1;
}
const primitive=gltf.meshes[0].primitives[0];
primitive.attributes.POSITION=attribute(positions.array,3,5126,34962,true);
primitive.attributes.NORMAL=attribute(geometry.attributes.normal.array,3,5126,34962);
primitive.attributes.JOINTS_0=attribute(joints,4,5121,34962);
primitive.attributes.WEIGHTS_0=attribute(weights,4,5126,34962);
primitive.indices=attribute(geometry.index.array,1,geometry.index.array instanceof Uint32Array?5125:5123,34963);
gltf.skins[0].inverseBindMatrices=attribute(inverseBind,16,5126);
gltf.buffers.push({byteLength:offset});
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const binary=Buffer.concat(chunks),header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);
jsonHeader.writeUInt32LE(json.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,jsonHeader,json,binHeader,binary]);
const destination=new URL('../public/assets/squirrel-v3.glb',import.meta.url);await fs.writeFile(destination,result);
console.log(JSON.stringify({file:fileURLToPath(destination),vertices:positions.count,triangles:geometry.index.count/3,bones:SQUIRREL_BONES,bytes:result.length}));
mc.geometry.dispose();mc.material.dispose();raw.dispose();geometry.dispose();
