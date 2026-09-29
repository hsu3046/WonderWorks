// SPDX-License-Identifier: GPL-3.0-only
// Same indexed, area-weighted normals as Three.js, using reusable Float32 buffers.
export function updateNormals(positions,indices,normals){
 normals.fill(0);
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const cbx=positions[c]-positions[b],cby=positions[c+1]-positions[b+1],cbz=positions[c+2]-positions[b+2];
  const abx=positions[a]-positions[b],aby=positions[a+1]-positions[b+1],abz=positions[a+2]-positions[b+2];
  const x=cby*abz-cbz*aby,y=cbz*abx-cbx*abz,z=cbx*aby-cby*abx;
  normals[a]+=x;normals[a+1]+=y;normals[a+2]+=z;
  normals[b]+=x;normals[b+1]+=y;normals[b+2]+=z;
  normals[c]+=x;normals[c+1]+=y;normals[c+2]+=z;
 }
 for(let i=0;i<normals.length;i+=3){
  const x=normals[i],y=normals[i+1],z=normals[i+2],scale=1/(Math.sqrt(x*x+y*y+z*z)||1);
  normals[i]=x*scale;normals[i+1]=y*scale;normals[i+2]=z*scale;
 }
 return normals;
}
