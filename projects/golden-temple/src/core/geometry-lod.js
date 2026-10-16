// Bounded-error index LOD and spatial foliage batches. © 2026 AIB Inc. GPL-3.0-only.
import * as THREE from 'three';
import { readDerived, writeDerived } from './atlas-cache.js';
const sourceGeometries=new WeakMap();

// Retain original vertex attributes (UV/normal/procedural data). Only the index changes.
// Quantized normals and UVs protect creases and texture islands; no triangle subsampling.
export function clusterIndex(g, cell) {
  const p=g.attributes.position, n=g.attributes.normal, uv=g.attributes.uv;
  const remap=new Uint32Array(p.count), bins=new Map();
  for(let i=0;i<p.count;i++) {
    let key=`${Math.floor(p.getX(i)/cell)},${Math.floor(p.getY(i)/cell)},${Math.floor(p.getZ(i)/cell)}`;
    if(n) key+=`:${Math.round(n.getX(i)*4)},${Math.round(n.getY(i)*4)},${Math.round(n.getZ(i)*4)}`;
    if(uv) key+=`:${Math.floor(uv.getX(i)*16)},${Math.floor(uv.getY(i)*16)}`;
    // Preserve categorical surface data used by the stone/bark shaders.
    for(const name of ['aTag','aPart','aRel']) {
      const a=g.attributes[name]; if(a && !a.isInstancedBufferAttribute) for(let c=0;c<a.itemSize;c++) key+=`:${Math.round(a.array[i*a.itemSize+c]*8)}`;
    }
    let rep=bins.get(key); if(rep===undefined) { rep=i; bins.set(key,i); } remap[i]=rep;
  }
  const source=g.index?.array, count=source?.length??p.count, out=[];
  for(let i=0;i<count;i+=3) {
    const a=remap[source?source[i]:i],b=remap[source?source[i+1]:i+1],c=remap[source?source[i+2]:i+2];
    if(a!==b&&b!==c&&a!==c) out.push(a,b,c);
  }
  return new THREE.BufferAttribute(p.count>65535?new Uint32Array(out):new Uint16Array(out),1);
}

function sliceInstances(attr, ids) {
  const result=new attr.array.constructor(ids.length*attr.itemSize);
  ids.forEach((id,j)=>result.set(attr.array.subarray(id*attr.itemSize,(id+1)*attr.itemSize),j*attr.itemSize));
  return new THREE.InstancedBufferAttribute(result,attr.itemSize,attr.normalized,attr.meshPerAttribute);
}

// Shader-animated foliage has immutable instance matrices; fish/drifting leaves are excluded.
export function splitFoliage(root, cellSize=16) {
  const candidates=[];
  root.traverse(o=>{if(o.isInstancedMesh && /^(leaves_maple_far|needles_pine|blossom_cherry|leaves_shrub)$/.test(o.name) && o.count>8)candidates.push(o);});
  const cells=[];
  for(const source of candidates) {
    const bins=new Map(), a=source.instanceMatrix.array;
    for(let i=0;i<source.count;i++) {
      const key=`${Math.floor(a[i*16+12]/cellSize)},${Math.floor(a[i*16+14]/cellSize)}`;
      if(!bins.has(key)) bins.set(key,[]); bins.get(key).push(i);
    }
    const group=new THREE.Group(); group.name=source.name+'-cells'; group.copy(source,false); group.name=source.name+'-cells';
    for(const ids of bins.values()) {
      // Stable permutation keeps reduced density distributed throughout each cell.
      ids.sort((a,b)=>((Math.imul(a+1,1664525)>>>0)-(Math.imul(b+1,1664525)>>>0)));
      const geo=new THREE.BufferGeometry();
      for(const [name,attr] of Object.entries(source.geometry.attributes)) geo.setAttribute(name,attr.isInstancedBufferAttribute?sliceInstances(attr,ids):attr);
      geo.setIndex(source.geometry.index);
      sourceGeometries.set(geo,source.geometry);
      const im=new THREE.InstancedMesh(geo,source.material,ids.length);
      im.instanceMatrix=sliceInstances(source.instanceMatrix,ids);
      if(source.instanceColor)im.instanceColor=sliceInstances(source.instanceColor,ids);
      im.name=source.name; im.castShadow=source.castShadow; im.receiveShadow=source.receiveShadow;
      im.customDepthMaterial=source.customDepthMaterial;im.onBeforeRender=source.onBeforeRender;
      im.computeBoundingSphere(); im.boundingSphere.radius+=2; // wind deformation envelope
      im.frustumCulled=true; group.add(im); if(/^(leaves_|needles_|blossom_)/.test(source.name))cells.push({mesh:im,total:ids.length,level:0});
    }
    source.parent.add(group); source.removeFromParent(); source.dispose(); source.geometry.dispose();
  }
  return cells;
}

export async function prepareGeometryLOD(scene, status) {
  const cells=splitFoliage(scene), entries=[], variants=new Map(), p=new THREE.Vector3();
  scene.updateMatrixWorld(true);
  const objects=[];
  scene.traverse(o=>{if(o.isMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.geometry.attributes.position && !o.geometry.morphAttributes.position && !/sky|water|landscape|leaves_|needles_|blossom_|smoke|shaft|dust/.test(o.name))objects.push(o);});
  let processed=0, hits=0;
  for(const mesh of objects) {
    const g=mesh.geometry;
    if(g.groups.length || g.attributes.position.count<600 || g.attributes.position.count>4000000) continue;
    const base=sourceGeometries.get(g)||g;
    if(!variants.has(base)) {
      g.computeBoundingBox();g.computeBoundingSphere();
      const span=g.boundingBox.getSize(p).length();
      const cell=Math.min(.10,span/96);
      if(cell<=0)continue;
      status?.(`preparing detail ${++processed}...`);
      const fingerprint=await geometryFingerprint(g,cell);
      const slot=`lod-${processed}`;
      const saved=await readDerived(slot);
      let index;
      if(saved?.fingerprint===fingerprint && saved.indices?.length && saved.indices.length%3===0 && !saved.indices.some(i=>i>=g.attributes.position.count)) {
        index=new THREE.BufferAttribute(saved.indices,1);hits++;
      }else{
        index=clusterIndex(g,cell);
        void writeDerived(slot,{fingerprint,indices:index.array});
      }
      const original=g.index?.count??g.attributes.position.count;
      if(index.count<original*.85 && index.count>0) {
        const low=new THREE.BufferGeometry();
        for(const [k,a] of Object.entries(g.attributes))low.setAttribute(k,a);
        low.setIndex(index);low.boundingBox=g.boundingBox.clone();low.boundingSphere=g.boundingSphere.clone();
        variants.set(base,{low,cell});
      } else variants.set(base,null);
      // Yield between meshes so input/loading status remains responsive.
      if(processed%3===0) await new Promise(resolve=>setTimeout(resolve,0));
    }
    const v=variants.get(base);
    if(v) {
      let low=v.low;
      if(base!==g){low=new THREE.BufferGeometry();for(const [k,a] of Object.entries(g.attributes))low.setAttribute(k,a);low.setIndex(v.low.index);low.boundingBox=v.low.boundingBox.clone();low.boundingSphere=v.low.boundingSphere.clone();}
      entries.push({mesh,high:g,low,cell:v.cell});
    }
  }

  const sphere=new THREE.Sphere(), cam=new THREE.Vector3(), scale=new THREE.Vector3();
  function update(camera, height, reflection=false) {
    camera.getWorldPosition(cam);
    const factor=height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)));
    for(const e of entries) {
      // Instanced bounds include all copies; using the nearest extent preserves nearby detail.
      if(e.mesh.isInstancedMesh) { if(!e.mesh.boundingSphere)e.mesh.computeBoundingSphere();sphere.copy(e.mesh.boundingSphere); }
      else sphere.copy(e.high.boundingSphere);
      sphere.applyMatrix4(e.mesh.matrixWorld);
      const distance=Math.max(.1,cam.distanceTo(sphere.center)-sphere.radius);
      e.mesh.getWorldScale(scale);
      const error=e.cell*Math.sqrt(3)*Math.max(scale.x,scale.y,scale.z)*factor/distance;
      const threshold=reflection?2:1.2;
      e.mesh.geometry=error<threshold*(e.mesh.geometry===e.low?1.15:.85)?e.low:e.high;
    }
    for(const c of cells) {
      sphere.copy(c.mesh.boundingSphere).applyMatrix4(c.mesh.matrixWorld);
      const d=Math.max(0,cam.distanceTo(sphere.center)-sphere.radius);
      // Conservative far-only density reduction; close leaves retain every original instance.
      const level=d>(c.level?65:75)?1:0;
      c.level=level;c.mesh.count=Math.ceil(c.total*(level?.8:1));
    }
  }
  return {update,stats:{meshes:entries.length,foliageCells:cells.length,cacheHits:hits,cacheCandidates:processed},dispose(){const geometries=new Set();for(const e of entries){geometries.add(e.high);geometries.add(e.low);}for(const v of variants.values())if(v)geometries.add(v.low);for(const g of geometries)g.dispose();}};
}


async function geometryFingerprint(g,cell) {
  const parts=['cluster-v2',cell];
  for(const [name,attr] of Object.entries(g.attributes).concat(g.index?[['index',g.index]]:[])) {
    if(attr.isInstancedBufferAttribute)continue;
    const bytes=new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength);
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    parts.push(name,attr.itemSize,Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''));
  }
  return parts.join(':');
}
