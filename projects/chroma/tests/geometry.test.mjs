import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGeometries,columnProfile,ribbonProfile,waveProfile} from '../src/geometry.ts';

test('adjacent columns retain a shared tangent axis throughout the supported motion range',()=>{
 for(const count of [2,3,9])for(const amplitude of [0,1,1.8])for(const twist of [0,1,2.5])for(let t=0;t<=15;t+=.125){
  for(let i=0;i<count-1;i++){
   const a=columnProfile(i,count,t,amplitude,twist),b=columnProfile(i+1,count,t,amplitude,twist);
   assert.ok(Math.abs(a.x+a.radius-(b.x-b.radius))<1e-12,'no gap or overlap at the tangent');
   for(const p of [a,b]){
    assert.ok(p.height>0 && Number.isFinite(p.roll),'finite rotation and positive height');
   }
   assert.equal(a.roll,b.roll,'neighboring rotation axes stay aligned');
   assert.equal(a.spin,b.spin,'axial spin is shared across the row');
  }
 }
});

test('column rotation continues in one direction over multiple complete turns',()=>{
 for(const twist of [.1,1,2.5])for(let t=0;t<60;t+=.05){
  const current=columnProfile(0,3,t,1,twist),next=columnProfile(0,3,t+.05,1,twist);
  assert.ok(next.roll>current.roll);
  assert.ok(next.spin>current.spin,'cap colour still moves during a face-on pass');
  assert.ok(Math.abs((next.roll-current.roll)-.045*twist)<1e-12);
 }
 assert.ok(columnProfile(0,3,15,1,1).roll>Math.PI*4);
 assert.equal(columnProfile(0,3,15,1,0).roll,0);
});

test('face-on column passes retain depth without exceeding the original height envelope',()=>{
 for(let turn=0;turn<6;turn++)for(let i=0;i<3;i++){
  const t=(Math.PI/2+turn*Math.PI-Math.atan(.14))/.9;
  const p=columnProfile(i,3,t,1,1);
  assert.ok(p.height>=1.2-1e-12 && p.height<=4.52);
 }
});

test('both disc lids meet the actual sleeve rim after scale and tilt',()=>{
 const geometries=createGeometries(),lid=geometries.cap.attributes.position,sleeve=geometries.tube.attributes.position;
 for(const radius of [.27,2.35])for(const height of [.45,3.15])for(const tilt of [-.9,0,.9])for(const side of [-1,1]){
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),tilt);
  const offset=new THREE.Vector3(0,side*height/2,0).applyQuaternion(rotation);
  const capMatrix=new THREE.Matrix4().compose(offset,rotation,new THREE.Vector3(radius,radius,radius));
  const bodyMatrix=new THREE.Matrix4().compose(new THREE.Vector3(),rotation,new THREE.Vector3(radius,height,radius));
  const rim=[];
  for(let j=0;j<sleeve.count;j++)if(Math.abs(sleeve.getY(j)-side*.5)<1e-6)rim.push(new THREE.Vector3().fromBufferAttribute(sleeve,j).applyMatrix4(bodyMatrix));
  for(let j=1;j<lid.count;j++){
   const p=new THREE.Vector3().fromBufferAttribute(lid,j).applyMatrix4(capMatrix);
   assert.ok(Math.min(...rim.map(q=>q.distanceTo(p)))<1e-6,'every lid boundary vertex matches the sleeve');
  }
 }
 Object.values(geometries).forEach(g=>g.dispose());
});

test('ribbon is a closed connected volume with no unpaired surface edges',()=>{
 const all=createGeometries(),g=all.ribbon,p=g.attributes.position,index=g.index;
 assert.ok(index);
 const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e6)).join(',');
 const edges=new Map();
 for(let i=0;i<index.count;i+=3){
  const triangle=[key(index.getX(i)),key(index.getX(i+1)),key(index.getX(i+2))];
  for(let j=0;j<3;j++){
   const edge=[triangle[j],triangle[(j+1)%3]].sort().join('|');
   edges.set(edge,(edges.get(edge)??0)+1);
  }
 }
 for(const incidence of edges.values())assert.equal(incidence,2,'each surface edge has exactly two incident triangles');
 Object.values(all).forEach(geometry=>geometry.dispose());
});


test('ribbon rotation and torsion remain continuous across each half turn',()=>{
 for(const amplitude of [0,1,1.8])for(const twist of [0,1,2.5])for(let i=1;i<=14;i++){
  const t=i*1.15,left=ribbonProfile(t-1e-6,amplitude,twist),right=ribbonProfile(t+1e-6,amplitude,twist);
  assert.ok(Math.abs(left.angle-right.angle)<1e-8);
  assert.ok(Math.abs(left.twist-right.twist)<1e-8);
 }
});


test('wave bars have a fixed baseline and the same height wave delayed left to right',()=>{
 for(const amplitude of [0,1,1.8])for(let time=0;time<8;time+=.1)for(let i=0;i<3;i++){
  const p=waveProfile(i,time,amplitude);
  assert.ok(Math.abs(p.y-p.height/2+2.2)<1e-12);
  assert.ok(p.height>0);
  assert.ok(Math.abs(p.height-waveProfile(0,time-i,amplitude).height)<1e-12);
 }
});

test('wave crests pass left, centre, right continuously with no collective pause',()=>{
 for(let i=0;i<3;i++){
  const heights=[0,1,2].map(j=>waveProfile(j,i,1).height);
  assert.equal(heights.indexOf(Math.max(...heights)),i);
 }
 const dt=1e-4;
 for(let time=0;time<6;time+=.01){
  let movement=0,total=0;
  for(let i=0;i<3;i++){
   const height=waveProfile(i,time,1).height;
   movement+=Math.abs((waveProfile(i,time+dt,1).height-waveProfile(i,time-dt,1).height)/(2*dt));
   total+=height;
   assert.ok(Math.abs(waveProfile(i,time+3,1).height-height)<1e-12);
  }
  assert.ok(movement>4,'a crest never produces a collective hold');
  assert.ok(Math.abs(total-6)<1e-12,'height transfers smoothly between the bars');
 }
 for(let i=0;i<3;i++){
  const at=waveProfile(i,3,1).height;
  const incoming=(at-waveProfile(i,3-dt,1).height)/dt;
  const outgoing=(waveProfile(i,3+dt,1).height-at)/dt;
  assert.ok(Math.abs(incoming-outgoing)<.001,'no velocity discontinuity at the loop boundary');
 }
});
