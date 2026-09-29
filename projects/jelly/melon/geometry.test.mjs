import test from 'node:test';import assert from 'node:assert/strict';
import {SoftBody,signedVolume,createSkin} from '../citrus/physics.js';
import {watermelon,area,cutPolygon,makeMesh,transfer,localCut} from './geometry.js';
import {separatePieces} from './collision.js';
const body=p=>new SoftBody(makeMesh(p));
test('convex cuts conserve area and volume; create closed positive-volume children',()=>{
 const original=watermelon();let polys=[original];for(const[a,b]of[[[-3,.7],[3,.7]],[[.3,-3],[.3,3]],[[-.4,-3],[-.4,3]]])polys=polys.flatMap(p=>cutPolygon(p,a,b)||[p]);
 assert.ok(polys.length>=5);assert.ok(Math.abs(polys.reduce((s,p)=>s+area(p),0)-area(original))<1e-8);
 const all=polys.map(body);assert.ok(Math.abs(all.reduce((s,b)=>s+b.restVolume,0)-body(original).restVolume)<1e-8);
 for(const b of all){assert.ok(b.volumes.every(v=>v>0));const edges=new Map();for(const[a,c,d]of b.mesh.faces)for(const[u,v]of[[a,c],[c,d],[d,a]]){const k=[u,v].sort((a,b)=>a-b).join(',');edges.set(k,(edges.get(k)||0)+1);}assert.ok([...edges.values()].every(v=>v===2));const skin=createSkin(b.mesh);assert.ok(skin.positions.every(Number.isFinite));}
});
test('cut remesh transfers affine deformation and velocity without resetting parent pose',()=>{
 const parent=body(watermelon());for(let i=0;i<parent.p.length;i+=3){parent.p[i]+=.7;parent.p[i+1]+=parent.rest[i]*.07+.3;parent.p[i+2]-=.4;parent.v[i]=.2;parent.v[i+1]=.1;}
 const cut=cutPolygon(parent.mesh.polygon,[-3,.5],[3,.5]);for(const p of cut){const child=body(p);transfer(parent,child);for(let i=0;i<child.p.length;i+=3){assert.ok(Math.abs(child.p[i]-child.rest[i]-.7)<1e-7);assert.ok(Math.abs(child.p[i+1]-child.rest[i+1]-child.rest[i]*.07-.3)<1e-7);assert.ok(Math.abs(child.v[i]-.2)<1e-7);}assert.equal(child.metrics().inverted,0);}
 const mapped=localCut(parent,[.7,-.4],[1.7,.6]);assert.ok(Math.abs(mapped[0][0])<1e-7);assert.ok(Math.abs(mapped[0][1])<1e-7);
});
test('separate pieces remain finite and non-inverted while settling and nudging',()=>{
 const polys=cutPolygon(watermelon(),[0,-3],[0,3]),bs=polys.map(body);for(const b of bs){b.firmness=.42;b.nudge();}
 for(let i=0;i<480;i++){for(const b of bs)b.step(1/120);if(i%2===0)separatePieces(bs);}
 for(const b of bs){assert.ok(b.p.every(Number.isFinite));assert.equal(b.metrics().inverted,0);assert.ok(Math.abs(b.metrics().volume-1)<.02);}
});
test('degenerate, tangent and tiny cuts are rejected',()=>{const p=watermelon();assert.equal(cutPolygon(p,[0,0],[0,0]),null);assert.equal(cutPolygon(p,[8,-2],[8,3]),null);assert.equal(cutPolygon(p,[-3,-1.14],[3,-1.14]),null);});

// Frozen volume-ratio reference checks non-affine deformation, not just translation.
function referenceTransfer(parent,child){
 const temp=new Float64Array(15);
 for(let i=0;i<child.rest.length;i+=3){temp.set(child.rest.subarray(i,i+3),12);let found=false;
  for(const t of parent.tets){for(let j=0;j<4;j++)temp.set(parent.rest.subarray(t[j]*3,t[j]*3+3),j*3);const v=signedVolume(temp,0,1,2,3);const w=[signedVolume(temp,4,1,2,3)/v,signedVolume(temp,0,4,2,3)/v,signedVolume(temp,0,1,4,3)/v,signedVolume(temp,0,1,2,4)/v];if(w.some(x=>x< -1e-6||x>1.000001))continue;
   for(let k=0;k<3;k++){child.p[i+k]=t.reduce((s,id,j)=>s+parent.p[id*3+k]*w[j],0);child.v[i+k]=t.reduce((s,id,j)=>s+parent.v[id*3+k]*w[j],0);}found=true;break;
  }
  if(!found)throw new Error('New cut vertex is outside its source volume');
 }
 child.previous.set(child.p);
}

test('cached transfer matches volume-ratio reference through repeated non-affine cuts',()=>{
 let parents=[body(watermelon())];
 for(const [a,b] of [[[.12,-3],[.12,3]],[[-3,.4],[3,.7]],[[-.7,-3],[-.4,3]]]){
  const next=[];
  for(const parent of parents){
   for(let i=0;i<parent.p.length;i++){parent.p[i]+=.02*Math.sin(i*.37);parent.v[i]=.1*Math.cos(i*.21);}
   const polys=cutPolygon(parent.mesh.polygon,a,b);if(!polys){next.push(parent);continue;}
   for(const poly of polys){
    const child=body(poly),reference=body(poly);transfer(parent,child);referenceTransfer(parent,reference);
    for(let i=0;i<child.p.length;i++){assert.ok(Math.abs(child.p[i]-reference.p[i])<1e-9);assert.ok(Math.abs(child.v[i]-reference.v[i])<1e-9);}
    assert.deepEqual(child.previous,child.p);next.push(child);
   }
  }
  parents=next;
 }
 assert.ok(parents.length>3);
 const parent=body(watermelon()),outside=body(watermelon());outside.rest[0]=100;
 assert.throws(()=>transfer(parent,outside),/outside its source volume/);
});
