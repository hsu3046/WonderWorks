// Optional local cache of deterministic atlas bytes, including alpha-coverage mipmaps.
// © 2026 AIB Inc. GPL-3.0-only.
import * as THREE from 'three';
const REVISION='golden-atlas-97fd9ec-v1';
let database;
function open() {
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const req=indexedDB.open('golden-temple-generated',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('atlases');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error('Atlas cache is blocked'));
  });return database;
}
function operation(db,key,value) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('atlases',value?'readwrite':'readonly');
    const req=value?tx.objectStore('atlases').put(value,key):tx.objectStore('atlases').get(key);
    tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export async function cachedAtlas(key,factory,enabled) {
  if(!enabled)return factory();
  let db;
  try {
    db=await Promise.race([open(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Atlas cache timeout')),1000))]);
    const v=await Promise.race([operation(db,key),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Atlas read timeout')),1000))]);
    if(v?.revision===REVISION && v.data?.length===v.width*v.height*4 && v.mipmaps?.length) {
      const t=new THREE.DataTexture(v.data,v.width,v.height,THREE.RGBAFormat,THREE.UnsignedByteType);
      t.mipmaps=v.mipmaps;t.generateMipmaps=false;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
      t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.colorSpace=v.colorSpace;t.anisotropy=v.anisotropy;t.flipY=false;t.needsUpdate=true;
      console.log('[cache] atlas hit',key);return t;
    }
  }catch(error){console.warn('[cache] Atlas cache unavailable; generating locally:',error.message);}
  const t=factory();
  if(db)void operation(db,key,{revision:REVISION,width:t.image.width,height:t.image.height,data:t.image.data,mipmaps:t.mipmaps,colorSpace:t.colorSpace,anisotropy:t.anisotropy}).catch(error=>console.warn('[cache] Atlas not stored:',error.message));
  return t;
}

// Bounded stable slots for other derived resources. Fingerprints are validated by callers.
export async function readDerived(key) {
  try{return await Promise.race([open().then(db=>operation(db,key)),new Promise(resolve=>setTimeout(()=>resolve(null),1000))]);}
  catch(error){console.warn('[cache] Derived cache read unavailable:',error.message);return null;}
}
export async function writeDerived(key,value) {
  try{await operation(await open(),key,value);}catch(error){console.warn('[cache] Derived cache write unavailable:',error.message);}
}
