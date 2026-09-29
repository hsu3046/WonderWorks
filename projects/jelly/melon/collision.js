// SPDX-License-Identifier: GPL-3.0-only
// © 2026 KnowAI. Bounded 2.5D piece contact, not general deformable self-collision.
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function outline(b){const p=[];let lo=Infinity,hi=-Infinity,cx=0,cz=0;for(let i=0;i<b.p.length;i+=3){p.push([b.p[i],b.p[i+2]]);lo=Math.min(lo,b.p[i+1]);hi=Math.max(hi,b.p[i+1]);cx+=b.p[i];cz+=b.p[i+2];}p.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const lower=[],upper=[];for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}for(const q of [...p].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}lower.pop();upper.pop();return{p:lower.concat(upper),lo,hi,center:[cx/(b.p.length/3),cz/(b.p.length/3)]};}
export function separatePieces(bodies,{isSleeping=()=>false,onContact=()=>{}}={}){
 const shapes=bodies.map(outline);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  if(isSleeping(bodies[i])&&isSleeping(bodies[j]))continue;
  const a=shapes[i],b=shapes[j];if(a.hi<b.lo+.025||b.hi<a.lo+.025)continue;
  let depth=Infinity,normal=null,separate=false;
  for(const poly of[a.p,b.p]){for(let k=0;k<poly.length;k++){const u=poly[k],v=poly[(k+1)%poly.length],dx=v[0]-u[0],dz=v[1]-u[1],len=Math.hypot(dx,dz);if(len<1e-6)continue;const n=[-dz/len,dx/len];const pa=a.p.map(p=>p[0]*n[0]+p[1]*n[1]),pb=b.p.map(p=>p[0]*n[0]+p[1]*n[1]);const overlap=Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb));if(overlap<=0){separate=true;break;}if(overlap<depth){depth=overlap;normal=n;}}if(separate)break;}
  if(separate||!normal)continue;if((b.center[0]-a.center[0])*normal[0]+(b.center[1]-a.center[1])*normal[1]<0)normal=normal.map(v=>-v);
  onContact(bodies[i],bodies[j]);
  const mass=bodies[i].restVolume+bodies[j].restVolume;
  for(const [id,sign,weight]of[[i,-1,bodies[j].restVolume/mass],[j,1,bodies[i].restVolume/mass]]){const body=bodies[id],shift=(depth+.001)*weight;let speed=0;for(let k=0;k<body.v.length;k+=3)speed+=(body.v[k]*normal[0]+body.v[k+2]*normal[1])/(body.v.length/3);for(let k=0;k<body.p.length;k+=3){body.p[k]+=normal[0]*shift*sign;body.p[k+2]+=normal[1]*shift*sign;if(speed*sign<0){body.v[k]-=speed*normal[0]*.7;body.v[k+2]-=speed*normal[1]*.7;}}}
 }
}
