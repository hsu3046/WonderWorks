// Lossless generated mesh cache. © 2026 AIB Inc. GPL-3.0-only.
export function sdfKey(shape,params,bmin,bmax,h,options) {
  const source=JSON.stringify([1,shape,params,bmin,bmax,h,options.band??2,options.newton??1,options.aoDist??.05]);
  let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);
  return (hash>>>0).toString(16);
}
export function encodeSDF(g) {
  const p=g.attributes.position.array,n=g.attributes.normal.array,c=g.attributes.color.array,idx=g.index.array;
  const buffer=new ArrayBuffer(16+(p.length+n.length+c.length+idx.length)*4);
  new Uint32Array(buffer,0,4).set([0x53444631,p.length/3,idx.length,1]);
  let offset=16;for(const a of [p,n,c]){new Float32Array(buffer,offset,a.length).set(a);offset+=a.length*4;}
  new Uint32Array(buffer,offset,idx.length).set(idx);return buffer;
}
export function decodeSDF(THREE,buffer) {
  if(buffer.byteLength<16)throw new Error('Invalid SDF cache header');
  const [magic,nv,ni,version]=new Uint32Array(buffer,0,4);
  if(magic!==0x53444631||version!==1||buffer.byteLength!==16+(nv*9+ni)*4||ni%3)throw new Error('Invalid SDF cache length');
  const g=new THREE.BufferGeometry();let offset=16;
  for(const name of ['position','normal','color']){const a=new Float32Array(buffer,offset,nv*3);g.setAttribute(name,new THREE.BufferAttribute(a,3));offset+=nv*12;}
  const idx=new Uint32Array(buffer,offset,ni);
  if(idx.some(i=>i>=nv))throw new Error('Invalid SDF cache index');
  g.setIndex(new THREE.BufferAttribute(idx,1));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
