// SPDX-License-Identifier: GPL-3.0-only
// © 2026 KnowAI. CPU reference solver; no rendering or browser dependencies.
export const STEP = 1 / 240;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub = (p,a,b) => [p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]];
// Scalar triple product: preserve operation order without four temporary arrays per tet.
export function signedVolume(p,a,b,c,d) {
  const ax=p[a*3],ay=p[a*3+1],az=p[a*3+2];
  const bx=p[b*3]-ax,by=p[b*3+1]-ay,bz=p[b*3+2]-az;
  const cx=p[c*3]-ax,cy=p[c*3+1]-ay,cz=p[c*3+2]-az;
  const dx=p[d*3]-ax,dy=p[d*3+1]-ay,dz=p[d*3+2]-az;
  return (bx*(cy*dz-cz*dy)+by*(cz*dx-cx*dz)+bz*(cx*dy-cy*dx))/6;
}

// Consistent triangular-prism split: sorted triangle IDs give every shared quad the same diagonal.
export function createCitrus({rings=4,sectors=24,layers=3,radius=1.58,height=.43}={}) {
  const points=[], triangles=[], tets=[];
  const per=1+rings*sectors, index=(r,s)=>r===0?0:1+(r-1)*sectors+(s+sectors)%sectors;
  for(let k=0;k<layers;k++) {
    const y=.04+height*k/(layers-1), edgeScale=k===1?1: .977;
    points.push(0,y+(k===layers-1?.15:0),0);
    for(let r=1;r<=rings;r++) for(let s=0;s<sectors;s++) {
      const a=s/sectors*Math.PI*2, rad=radius*r/rings*edgeScale;
      points.push(rad*Math.cos(a),y+(k===layers-1?.15*(1-(r/rings)**2):0),rad*Math.sin(a));
    }
  }
  for(let s=0;s<sectors;s++) triangles.push([0,index(1,s),index(1,s+1)]);
  for(let r=1;r<rings;r++) for(let s=0;s<sectors;s++) {
    const a=index(r,s),b=index(r+1,s),c=index(r+1,s+1),d=index(r,s+1);
    triangles.push([a,b,c],[a,c,d]);
  }
  for(let k=0;k<layers-1;k++) for(const tri of triangles) {
    const [a,b,c]=[...tri].sort((x,y)=>x-y).map(i=>i+k*per),A=a+per,B=b+per,C=c+per;
    for(const tet of [[a,b,c,C],[a,b,B,C],[a,A,B,C]]) {
      if(signedVolume(points,...tet)<0) [tet[1],tet[2]]=[tet[2],tet[1]];
      tets.push(tet);
    }
  }
  const edges=new Map(),faces=new Map();
  for(const t of tets) {
    for(let a=0;a<4;a++) for(let b=a+1;b<4;b++) { const pair=[t[a],t[b]].sort((x,y)=>x-y);edges.set(pair.join(','),pair); }
    for(let opposite=0;opposite<4;opposite++) {
      const f=t.filter((_,i)=>i!==opposite);const n=cross(sub(points,f[1],f[0]),sub(points,f[2],f[0]));
      if(dot(n,sub(points,t[opposite],f[0]))>0) [f[1],f[2]]=[f[2],f[1]];
      const key=[...f].sort((x,y)=>x-y).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,f);
    }
  }
  return {rest:new Float64Array(points),tets,edges:[...edges.values()],faces:[...faces.values()],radius,height};
}

export class SoftBody {
  constructor(mesh=createCitrus()) {
    this.mesh=mesh;this.rest=mesh.rest;this.p=new Float64Array(this.rest);this.previous=new Float64Array(this.rest);this.v=new Float64Array(this.rest.length);
    this.edges=mesh.edges;this.tets=mesh.tets;
    this.lengths=Float64Array.from(this.edges,([a,b])=>Math.hypot(...sub(this.rest,a,b)));
    this.volumes=Float64Array.from(this.tets,t=>signedVolume(this.rest,...t));
    this.restVolume=this.volumes.reduce((a,b)=>a+b,0);
    this.edgeLambda=new Float64Array(this.edges.length);this.volumeLambda=new Float64Array(this.tets.length);
    this.grad=new Float64Array(12);this.firmness=.28;this.damping=.35;this.grabs=new Map();this.grabCorrection=new Float64Array(this.p.length);this.grabWeight=new Float64Array(this.p.length/3);this.elapsed=0;this.guardedSteps=0;
  }
  reset() { this.p.set(this.rest);this.previous.set(this.rest);this.v.fill(0);this.grabs.clear();this.elapsed=0;this.guardedSteps=0; }
  // Grab a weighted local patch, retaining rest offsets instead of pinching all vertices to one point.
  get grab(){return this.grabs.values().next().value??null;}
  beginGrab(point,id=0) {
    if(point.length!==3||!point.every(Number.isFinite)||this.grabs.has(id)||this.grabs.size>=10)return false;
    const nearest=[];
    for(let i=0;i<this.p.length/3;i++)nearest.push([i,Math.hypot(this.p[i*3]-point[0],this.p[i*3+1]-point[1],this.p[i*3+2]-point[2])]);
    nearest.sort((a,b)=>a[1]-b[1]);const cutoff=Math.max(.38,nearest[0][1]+.12);
    const nodes=nearest.filter(([,d])=>d<cutoff).slice(0,10).map(([i,d])=>({i,w:Math.max(.12,1-d/cutoff),offset:[this.p[i*3]-point[0],this.p[i*3+1]-point[1],this.p[i*3+2]-point[2]]}));
    this.grabs.set(id,{nodes,target:[...point],current:[...point]});return true;
  }
  moveGrab(point,id=0) {const grab=this.grabs.get(id);if(grab&&point.length===3&&point.every(Number.isFinite))grab.target=[clamp(point[0],-3,3),clamp(point[1],.05,3.4),clamp(point[2],-2.6,2.6)];}
  endGrab(id) {if(id===undefined)this.grabs.clear();else this.grabs.delete(id);}
  nudge() {for(let i=0;i<this.p.length;i+=3){const w=.4+.6*(this.rest[i]/this.mesh.radius+1)/2;this.v[i]+=.2*w;this.v[i+1]+=1.8*w;this.v[i+2]+=.25*Math.sin(this.rest[i]*2);}}
  step(dt=STEP) {
    const p=this.p,v=this.v,prev=this.previous;prev.set(p);this.elapsed+=dt;
    const drag=Math.exp(-.22*dt);
    for(let i=0;i<p.length;i+=3) {v[i]*=drag;v[i+1]=(v[i+1]-5.5*dt)*drag;v[i+2]*=drag;for(let k=0;k<3;k++)p[i+k]+=v[i+k]*dt;}
    this.edgeLambda.fill(0);this.volumeLambda.fill(0);
    for(const g of this.grabs.values()) {const delta=g.target.map((x,k)=>x-g.current[k]),len=Math.hypot(...delta),step=Math.min(1,5*dt/(len||1));for(let k=0;k<3;k++)g.current[k]+=delta[k]*step;}
    const edgeCompliance=1e-5*Math.pow(500,1-clamp(this.firmness,0,1));
    for(let it=0;it<4;it++) {
      this.solveEdges(edgeCompliance/(dt*dt));this.solveVolumes(2e-10/(dt*dt));
      this.solveGrabs();
      for(let i=0;i<p.length;i+=3) {p[i]=clamp(p[i],-3.8,3.8);p[i+2]=clamp(p[i+2],-3.1,3.1);if(p[i+1]<.025){p[i+1]=.025;p[i]=prev[i]+(p[i]-prev[i])*.84;p[i+2]=prev[i+2]+(p[i+2]-prev[i+2])*.84;}}
    }
    // Reject element collapse independently of total volume: backtrack toward the last valid state.
    let guarded=false;
    for(let attempt=0;attempt<16;attempt++) {
      let valid=true;
      for(let t=0;t<this.tets.length;t++)if(!(signedVolume(p,...this.tets[t])>this.volumes[t]*.08)){valid=false;break;}
      if(valid)break;
      guarded=true;for(let i=0;i<p.length;i++)p[i]=(p[i]+prev[i])*.5;
      if(attempt===15)p.set(prev);
    }
    if(guarded)this.guardedSteps++;
    for(let i=0;i<p.length;i++)v[i]=(p[i]-prev[i])/dt;
    // Pairwise axial damping removes internal strain velocity, preserving bulk translation.
    const factor=1-Math.exp(-(1+this.damping*45)*dt);
    for(const [a0,b0] of this.edges) {const a=a0*3,b=b0*3,dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],l2=dx*dx+dy*dy+dz*dz;if(l2<1e-12)continue;const j=((v[a]-v[b])*dx+(v[a+1]-v[b+1])*dy+(v[a+2]-v[b+2])*dz)/l2*factor*.5;v[a]-=dx*j;v[b]+=dx*j;v[a+1]-=dy*j;v[b+1]+=dy*j;v[a+2]-=dz*j;v[b+2]+=dz*j;}
  }
  solveGrabs(){
    if(!this.grabs.size)return;
    if(this.grabs.size===1){
      const g=this.grab;
      for(const n of g.nodes)for(let k=0;k<3;k++){const i=n.i*3+k;this.p[i]+=(g.current[k]+n.offset[k]-this.p[i])*.32*n.w;}
      return;
    }
    // Evaluate all hands against the same pose. Shared patches average their pulls,
    // so extra fingers cannot multiply stiffness or give the last finger priority.
    const correction=this.grabCorrection,weights=this.grabWeight;correction.fill(0);weights.fill(0);
    for(const g of this.grabs.values())for(const n of g.nodes){
      weights[n.i]+=n.w;
      for(let k=0;k<3;k++){const i=n.i*3+k;correction[i]+=(g.current[k]+n.offset[k]-this.p[i])*n.w;}
    }
    for(let n=0;n<weights.length;n++)if(weights[n])for(let k=0;k<3;k++){const i=n*3+k;this.p[i]+=correction[i]*.32/Math.max(1,weights[n]);}
  }
  solveEdges(alpha) {
    // The solver clamps positions to a small finite box; hypot overflow rescaling is unnecessary.
    const p=this.p;
    for(let e=0;e<this.edges.length;e++){const [ai,bi]=this.edges[e],a=ai*3,b=bi*3,dx=p[a]-p[b],dy=p[a+1]-p[b+1],dz=p[a+2]-p[b+2],len=Math.sqrt(dx*dx+dy*dy+dz*dz);if(len<1e-9)continue;const dl=(-(len-this.lengths[e])-alpha*this.edgeLambda[e])/(2+alpha);this.edgeLambda[e]+=dl;const f=dl/len;p[a]+=dx*f;p[b]-=dx*f;p[a+1]+=dy*f;p[b+1]-=dy*f;p[a+2]+=dz*f;p[b+2]-=dz*f;}
  }
  solveVolumes(alpha) {
    const p=this.p,g=this.grad;
    for(let t=0;t<this.tets.length;t++) {
      const ids=this.tets[t],a=ids[0]*3,b=ids[1]*3,c=ids[2]*3,d=ids[3]*3;
      const bx=p[b]-p[a],by=p[b+1]-p[a+1],bz=p[b+2]-p[a+2],cx=p[c]-p[a],cy=p[c+1]-p[a+1],cz=p[c+2]-p[a+2],dx=p[d]-p[a],dy=p[d+1]-p[a+1],dz=p[d+2]-p[a+2];
      g[3]=(cy*dz-cz*dy)/6;g[4]=(cz*dx-cx*dz)/6;g[5]=(cx*dy-cy*dx)/6;
      g[6]=(dy*bz-dz*by)/6;g[7]=(dz*bx-dx*bz)/6;g[8]=(dx*by-dy*bx)/6;
      g[9]=(by*cz-bz*cy)/6;g[10]=(bz*cx-bx*cz)/6;g[11]=(bx*cy-by*cx)/6;
      let denom=0;for(let k=0;k<3;k++)g[k]=-g[3+k]-g[6+k]-g[9+k];for(let k=0;k<12;k++)denom+=g[k]*g[k];
      if(denom<1e-14)continue;
      const volume=bx*g[3]+by*g[4]+bz*g[5],dl=(-(volume-this.volumes[t])-alpha*this.volumeLambda[t])/(denom+alpha);this.volumeLambda[t]+=dl;
      for(let n=0;n<4;n++)for(let k=0;k<3;k++)p[ids[n]*3+k]+=dl*g[n*3+k];
    }
  }
  metrics() {
    let volume=0,inverted=0,error=0,motion=0,lift=0;
    for(let t=0;t<this.tets.length;t++){const v=signedVolume(this.p,...this.tets[t]);volume+=v;if(v<=0)inverted++;error=Math.max(error,Math.abs(v/this.volumes[t]-1));}
    for(let i=0;i<this.p.length;i+=3){motion+=this.v[i]**2+this.v[i+1]**2+this.v[i+2]**2;lift=Math.max(lift,this.p[i+1]-this.rest[i+1]);}
    return {volume:volume/this.restVolume,inverted,maxVolumeError:error,guardedSteps:this.guardedSteps,motion:Math.sqrt(motion/(this.p.length/3)),lift};
  }
}

// Loop-subdivision stencils embed a smooth render surface in the coarse boundary cage.
// Every surface detail uses the same weights; no independent visual wobble.
// Only connectivity determines subdivision weights; rest/deformed positions stay instance-local.
const skinPlans=new Map();
export function createSkin(mesh,levels=2) {
  const key=levels+':'+mesh.rest.length+':'+mesh.faces.map(f=>f.join(',')).join(';');
  let plan=skinPlans.get(key);
  if(!plan){plan=buildSkinPlan(mesh,levels);skinPlans.set(key,plan);if(skinPlans.size>8)skinPlans.delete(skinPlans.keys().next().value);}
  else {skinPlans.delete(key);skinPlans.set(key,plan);}
  const {packed,offsets,ids,coefficients,indices}=plan;
  const rest=new Float32Array(packed.length*3),positions=new Float32Array(rest.length);
  const update=(p,out=positions)=>{
    for(let i=0;i<packed.length;i++){
      let x=0,y=0,z=0;
      for(let j=offsets[i];j<offsets[i+1];j++){const id=ids[j],w=coefficients[j];x+=p[id]*w;y+=p[id+1]*w;z+=p[id+2]*w;}
      out[i*3]=x;out[i*3+1]=y;out[i*3+2]=z;
    }
    return out;
  };
  update(mesh.rest,rest);update(mesh.rest);
  return {positions,rest,indices,update,weights:packed};
}
function buildSkinPlan(mesh,levels) {
  let faces=mesh.faces.map(f=>[...f]),weights=Array.from({length:mesh.rest.length/3},(_,i)=>new Map([[i,1]]));
  const combine=(terms)=>{const m=new Map();for(const [w,s]of terms)for(const [i,v]of w)m.set(i,(m.get(i)||0)+v*s);return m;};
  for(let level=0;level<levels;level++) {
    const edges=new Map(),neighbors=weights.map(()=>new Set());
    for(const [a,b,c]of faces)for(const [u,v,o]of [[a,b,c],[b,c,a],[c,a,b]]){neighbors[u].add(v);neighbors[v].add(u);const key=[u,v].sort((x,y)=>x-y).join(',');if(!edges.has(key))edges.set(key,{u,v,op:[]});edges.get(key).op.push(o);}
    const next=weights.map((w,i)=>{const n=neighbors[i].size;if(!n)return w;const beta=n===3?3/16:3/(8*n);return combine([[w,1-n*beta],...[...neighbors[i]].map(j=>[weights[j],beta])]);});
    for(const e of edges.values()){e.id=next.length;next.push(combine([[weights[e.u],3/8],[weights[e.v],3/8],...e.op.map(i=>[weights[i],1/8]) ]));}
    const edge=(a,b)=>edges.get([a,b].sort((x,y)=>x-y).join(',')).id,newFaces=[];
    for(const[a,b,c]of faces){const ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);newFaces.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}
    faces=newFaces;weights=next;
  }
  const used=[...new Set(faces.flat())],remap=new Map(used.map((v,i)=>[v,i]));
  const packed=used.map(i=>[...weights[i]]),offsets=new Uint32Array(packed.length+1);
  let count=0;for(let i=0;i<packed.length;i++){offsets[i]=count;count+=packed[i].length;}offsets[packed.length]=count;
  const ids=new Uint32Array(count),coefficients=new Float64Array(count);let j=0;
  for(const vertex of packed)for(const[id,w]of vertex){ids[j]=id*3;coefficients[j++]=w;}
  return {packed,offsets,ids,coefficients,indices:faces.flat().map(i=>remap.get(i))};
}
