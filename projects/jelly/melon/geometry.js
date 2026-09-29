// SPDX-License-Identifier: GPL-3.0-only
// © 2026 KnowAI. Convex polygon cutting and conforming volumetric remeshing.
import {signedVolume} from '../citrus/physics.js';
export const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))*.5;
export function watermelon(){const p=[[0,-1.15]];for(let i=0;i<=16;i++){const a=-.66+i/16*1.32;p.push([Math.sin(a)*2.65,-1.15+Math.cos(a)*2.65]);}return p;}
function clean(p){return p.filter((a,i)=>Math.hypot(a[0]-p[(i+p.length-1)%p.length][0],a[1]-p[(i+p.length-1)%p.length][1])>1e-6);}
export function cutPolygon(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1];if(Math.hypot(dx,dy)<1e-5)return null;
 const distance=q=>(q[0]-a[0])*dy-(q[1]-a[1])*dx;
 const side=sign=>{const out=[];for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],du=distance(u)*sign,dv=distance(v)*sign;if(du>=-1e-8)out.push([...u]);if((du>1e-8&&dv< -1e-8)||(du< -1e-8&&dv>1e-8)){const t=du/(du-dv);out.push([u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t]);}}return clean(out);};
 const parts=[side(1),side(-1)];return parts.every(q=>q.length>=3&&area(q)>.07)?parts:null;
}
export function makeMesh(polygon){
 const boundary=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.38));for(let j=0;j<n;j++)boundary.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
 const center=polygon.reduce((s,p)=>[s[0]+p[0]/polygon.length,s[1]+p[1]/polygon.length],[0,0]);
 const n=boundary.length,per=1+n*2,points=[],triangles=[],tets=[];
 for(let k=0;k<3;k++){points.push(center[0],.06+k*.25,center[1]);for(const f of[.52,1])for(const p of boundary)points.push(center[0]+(p[0]-center[0])*f,.06+k*.25,center[1]+(p[1]-center[1])*f);}
 for(let i=0;i<n;i++){const j=(i+1)%n;triangles.push([0,1+i,1+j],[1+i,1+n+i,1+n+j],[1+i,1+n+j,1+j]);}
 for(let k=0;k<2;k++)for(const tri of triangles){const[a,b,c]=[...tri].sort((x,y)=>x-y).map(i=>i+k*per),A=a+per,B=b+per,C=c+per;for(const t of[[a,b,c,C],[a,b,B,C],[a,A,B,C]]){if(signedVolume(points,...t)<0)[t[1],t[2]]=[t[2],t[1]];if(signedVolume(points,...t)>1e-10)tets.push(t);}}
 const edges=new Map(),faces=new Map();
 for(const t of tets){for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const e=[t[i],t[j]].sort((a,b)=>a-b);edges.set(e.join(','),e);}for(let o=0;o<4;o++){const f=t.filter((_,i)=>i!==o);if(signedVolume(points,...f,t[o])>0)[f[1],f[2]]=[f[2],f[1]];const key=[...f].sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,f);}}
 return {rest:new Float64Array(points),tets,edges:[...edges.values()],faces:[...faces.values()],radius:2.65,height:.5,polygon};
}
// Barycentric transfer preserves the parent's deformed shape and momentum at a cut.
// Rest coordinates are immutable. Cache bounds/inverse bases once per parent mesh,
// shared by both children. Weak ownership releases them when a cut parent disappears.
const transferPlans=new WeakMap();
function transferPlan(mesh){
 let plan=transferPlans.get(mesh);if(plan)return plan;
 const p=mesh.rest;
 plan=mesh.tets.map(ids=>{
  const [a,b,c,d]=ids.map(i=>i*3),ax=p[a],ay=p[a+1],az=p[a+2];
  const bx=p[b]-ax,by=p[b+1]-ay,bz=p[b+2]-az,cx=p[c]-ax,cy=p[c+1]-ay,cz=p[c+2]-az,dx=p[d]-ax,dy=p[d+1]-ay,dz=p[d+2]-az;
  const r1=[cy*dz-cz*dy,cz*dx-cx*dz,cx*dy-cy*dx],r2=[dy*bz-dz*by,dz*bx-dx*bz,dx*by-dy*bx],r3=[by*cz-bz*cy,bz*cx-bx*cz,bx*cy-by*cx];
  const det=bx*r1[0]+by*r1[1]+bz*r1[2];
  const lo=[0,1,2].map(k=>Math.min(...ids.map(i=>p[i*3+k]))),hi=[0,1,2].map(k=>Math.max(...ids.map(i=>p[i*3+k])));
  const pad=lo.map((v,k)=>Math.max(1,hi[k]-v)*4e-6);
  return {ids,origin:[ax,ay,az],basis:[...r1,...r2,...r3].map(v=>v/det),lo,hi,pad};
 });
 transferPlans.set(mesh,plan);return plan;
}
export function transfer(parent,child){
 const plan=transferPlan(parent.mesh),weights=new Float64Array(4);
 for(let i=0;i<child.rest.length;i+=3){
  const x=child.rest[i],y=child.rest[i+1],z=child.rest[i+2];let found=false;
  for(const t of plan){
   if(x<t.lo[0]-t.pad[0]||x>t.hi[0]+t.pad[0]||y<t.lo[1]-t.pad[1]||y>t.hi[1]+t.pad[1]||z<t.lo[2]-t.pad[2]||z>t.hi[2]+t.pad[2])continue;
   const dx=x-t.origin[0],dy=y-t.origin[1],dz=z-t.origin[2],m=t.basis;
   weights[1]=m[0]*dx+m[1]*dy+m[2]*dz;weights[2]=m[3]*dx+m[4]*dy+m[5]*dz;weights[3]=m[6]*dx+m[7]*dy+m[8]*dz;weights[0]=1-weights[1]-weights[2]-weights[3];
   if(weights.some(w=>!Number.isFinite(w)||w< -1e-6||w>1.000001))continue;
   for(let k=0;k<3;k++){let p=0,v=0;for(let j=0;j<4;j++){p+=parent.p[t.ids[j]*3+k]*weights[j];v+=parent.v[t.ids[j]*3+k]*weights[j];}child.p[i+k]=p;child.v[i+k]=v;}
   found=true;break;
  }
  if(!found)throw new Error('New cut vertex is outside its source volume');
 }
 child.previous.set(child.p);
}
// Least-squares world XZ -> rest XZ map for a vertical cut of a settled/translated piece.
export function localCut(body,a,b){
 const n=body.p.length/3;let x=0,z=0,u=0,v=0;for(let i=0;i<body.p.length;i+=3){x+=body.p[i]/n;z+=body.p[i+2]/n;u+=body.rest[i]/n;v+=body.rest[i+2]/n;}
 let xx=0,xz=0,zz=0,xu=0,zu=0,xv=0,zv=0;
 for(let i=0;i<body.p.length;i+=3){const X=body.p[i]-x,Z=body.p[i+2]-z,U=body.rest[i]-u,V=body.rest[i+2]-v;xx+=X*X;xz+=X*Z;zz+=Z*Z;xu+=X*U;zu+=Z*U;xv+=X*V;zv+=Z*V;}
 const d=xx*zz-xz*xz;if(d<1e-7)return null;
 const map=p=>[u+((zz*xu-xz*zu)*(p[0]-x)+(xx*zu-xz*xu)*(p[1]-z))/d,v+((zz*xv-xz*zv)*(p[0]-x)+(xx*zv-xz*xv)*(p[1]-z))/d];return[map(a),map(b)];
}
