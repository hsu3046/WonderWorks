// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createGlider} from '../src/glider.ts';
import {BOUND_STRIDE,GLIDER_SCALE,STRIDE,boundPose} from '../src/glider-pose.ts';
import {FOOT_HEIGHT} from '../src/landing.ts';
import {LIMB_BIND,SQUIRREL_BONES} from '../src/squirrel-rig.ts';
import {createPatagium,patagiumPoint} from '../src/squirrel-patagium.ts';
import {CLIMB_TRUNK,CLIMB_DURATION,RUN_BRANCH,TOP_BRANCH} from '../src/landscape.ts';
import {renderedTerrainHeight} from '../src/terrain-surface.ts';
import {departurePosition,departureOrientation} from '../src/departure.ts';
import {advanceWalk,createWalkState} from '../src/walking.ts';
import {CLEARINGS} from '../src/landscape.ts';

async function load(){
  const file=await readFile(new URL('../public/assets/squirrel-v3.glb',import.meta.url));
  const model=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
  let skin:T.SkinnedMesh|undefined;model.scene.traverse(object=>{if(object instanceof T.SkinnedMesh)skin=object;});
  assert.ok(skin);return {model,skin};
}

test('the squirrel is one closed skin, with valid normalized influences and feet matching landing clearance',async()=>{
  const {skin}=await load(),geometry=skin.geometry,index=geometry.index!,p=geometry.getAttribute('position');
  const parents=Array.from({length:p.count},(_,i)=>i),edges=new Map<string,number>();
  const root=(i:number):number=>parents[i]===i?i:parents[i]=root(parents[i]);
  for(let i=0;i<index.count;i+=3){
    const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];assert.equal(new Set(triangle).size,3);
    for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3];parents[root(a)]=root(b);const key=`${Math.min(a,b)}:${Math.max(a,b)}`;edges.set(key,(edges.get(key)??0)+1);}
  }
  assert.equal(new Set(parents.map((_,i)=>root(i))).size,1,'shoulders, neck and hips must remain connected');
  for(const count of edges.values())assert.equal(count,2,'skin must have no boundary or non-manifold edges');
  assert.equal(skin.skeleton.bones.length,SQUIRREL_BONES);
  const weights=geometry.getAttribute('skinWeight'),joints=geometry.getAttribute('skinIndex');
  for(let i=0;i<p.count;i++){
    let total=0;for(let j=0;j<4;j++){const weight=weights.getComponent(i,j);assert.ok(Number.isFinite(weight)&&weight>=0);assert.ok(joints.getComponent(i,j)<SQUIRREL_BONES);total+=weight;}
    assert.ok(Math.abs(total-1)<1e-6);
  }
  const box=new T.Box3().setFromBufferAttribute(p as T.BufferAttribute);
  assert.ok(Math.abs(-box.min.y*GLIDER_SCALE-FOOT_HEIGHT)<.025,'landing placement must meet the new feet');
});

test('climbing and wing deployment keep skin finite, bounded, and attached to the shared fur skeleton',async()=>{
  const {model,skin}=await load(),glider=createGlider(model.scene),geometry=skin.geometry,index=geometry.index!,p=geometry.getAttribute('position');
  const layers:T.SkinnedMesh[]=[];glider.group.traverse(object=>{if(object instanceof T.SkinnedMesh)layers.push(object);});
  assert.equal(layers.length,2);assert.equal(layers[0].skeleton,layers[1].skeleton);
  const vertices=Array.from({length:p.count},()=>new T.Vector3());
  for(let phase=0;phase<=16;phase++)for(const spread of [0,.25,.5,.75,1]){
    glider.update(phase/8,spread,0,1,1-spread,STRIDE*phase/16,0);glider.group.updateMatrixWorld(true);skin.skeleton.update();
    const bounds=new T.Box3();
    for(let i=0;i<p.count;i++){const v=vertices[i].fromBufferAttribute(p,i);skin.applyBoneTransform(i,v);assert.ok(Number.isFinite(v.x+v.y+v.z));bounds.expandByPoint(v);}
    assert.ok(bounds.min.x>-1.6&&bounds.max.x<1.6&&bounds.min.y>-.8&&bounds.max.y<.65);
    for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++)assert.ok(vertices[index.getX(i+j)].distanceTo(vertices[index.getX(i+(j+1)%3)])<.4,'no elongated skin spikes at joint transitions');
    for(const leg of LIMB_BIND)assert.ok(skin.skeleton.bones[leg.paw].position.distanceTo(new T.Vector3())<1.65);
  }
  glider.dispose();
});

test('bounding has a suspended phase and planted pairs cancel forward movement',()=>{
  const start=boundPose(.07*BOUND_STRIDE),end=boundPose(.22*BOUND_STRIDE);
  assert.equal(start.front.release,0);assert.equal(end.front.release,0);
  assert.ok(Math.abs((.22-.07)*BOUND_STRIDE-(end.front.stroke-start.front.stroke)*GLIDER_SCALE)<1e-10);
  const pushStart=boundPose(.31*BOUND_STRIDE),pushEnd=boundPose(.49*BOUND_STRIDE);
  assert.equal(pushStart.hind.release,0);assert.equal(pushEnd.hind.release,0);
  assert.ok(Math.abs((.49-.31)*BOUND_STRIDE-(pushEnd.hind.stroke-pushStart.hind.stroke)*GLIDER_SCALE)<1e-10);
  const flight=boundPose(.77*BOUND_STRIDE);assert.ok(flight.height>.17&&flight.front.release>0&&flight.hind.release>0);
  const before=boundPose(BOUND_STRIDE-1e-6),after=boundPose(BOUND_STRIDE+1e-6);
  for(const key of ['height','pitch','tail','extension'] as const)assert.ok(Math.abs(before[key]-after[key])<1e-5);
});

test('running keeps feet above the contact plane and the deforming skin finite',async()=>{
  const {model,skin}=await load(),glider=createGlider(model.scene),p=skin.geometry.getAttribute('position'),point=new T.Vector3();
  let airborneFrames=0;
  for(let frame=0;frame<=60;frame++){
    const travel=BOUND_STRIDE*(1+frame/60);glider.update(travel/4.7,0,0,1,0,travel,0);glider.group.updateMatrixWorld(true);skin.skeleton.update();
    let airborneFeet=0;
    for(const leg of LIMB_BIND){skin.skeleton.bones[leg.paw].getWorldPosition(point);assert.ok(point.y>=-.466-1e-6);if(point.y>-.40)airborneFeet++;}
    if(airborneFeet===4)airborneFrames++;
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);skin.applyBoneTransform(i,point);assert.ok(Number.isFinite(point.x+point.y+point.z));assert.ok(Math.abs(point.x)<1.4&&Math.abs(point.y)<1&&Math.abs(point.z)<1.6);}
  }
  assert.ok(airborneFrames>10,'running must visibly leave the ground, not just shuffle the limbs');glider.dispose();
});

test('both patagia retain wrist and ankle attachment and an upward dorsal normal',()=>{
  const point=new T.Vector3();
  for(const sign of [-1,1]){
    const fore=new T.Vector3(sign*1.13,-.022,-.83),hind=new T.Vector3(sign*1.08,-.022,.8),rootZ=new T.Vector2(-.47,.49),patch=createPatagium(sign);
    const pose={sign,spread:1,fore,hind,rootZ};
    assert.ok(patagiumPoint(1,0,pose,point).distanceTo(fore)<1e-10);assert.ok(patagiumPoint(1,1,pose,point).distanceTo(hind)<1e-10);
    patch.update(0,fore,hind,rootZ.x,rootZ.y);assert.equal(patch.group.visible,false);
    for(const spread of [.03,.2,.55,1]){
      patch.update(spread,fore,hind,rootZ.x,rootZ.y);assert.equal(patch.group.visible,true);
      const mesh=patch.group.getObjectByName('Patagium skin') as T.Mesh,positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');
      for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i);assert.ok(Number.isFinite(point.x+point.y+point.z));assert.ok(normals.getY(i)>0);}
    }
  }
});

test('the actual skinned head stays outside the tapered trunk during approach, climbing and push-off',async()=>{
  const {model,skin}=await load(),glider=createGlider(model.scene),p=skin.geometry.getAttribute('position'),point=new T.Vector3();
  glider.group.scale.setScalar(GLIDER_SCALE);
  const start=new T.Vector3(...CLIMB_TRUNK.a),axis=new T.Vector3(...CLIMB_TRUNK.b).sub(start),length=axis.length();axis.normalize();
  for(let frame=0;frame<=136;frame++){
    const time=1.4+(CLIMB_DURATION-1.4)*frame/136,pose=departurePosition(time);
    glider.group.position.set(pose.x,pose.y,pose.z);departureOrientation(time,glider.group.quaternion);
    glider.update(time,pose.spread,0,pose.gait,pose.climbing,pose.travel,pose.ground,pose.launch);
    glider.group.updateMatrixWorld(true);skin.skeleton.update();
    for(let i=0;i<p.count;i++){
      if(p.getZ(i)>-.74)continue;
      point.fromBufferAttribute(p,i);skin.applyBoneTransform(i,point);skin.localToWorld(point);point.sub(start);
      const along=point.dot(axis);if(along<0||along>length)continue;
      const radius=CLIMB_TRUNK.rootRadius+(CLIMB_TRUNK.tipRadius-CLIMB_TRUNK.rootRadius)*along/length,clearance=point.addScaledVector(axis,-along).length()-radius;
      assert.ok(clearance>.04,`head vertex ${i} enters bark at ${time}s (${clearance})`);
    }
  }
  glider.dispose();
});

test('climbing keeps the actual tail volume above ground and outside the departure bough and trunk',async()=>{
  const {model}=await load(),glider=createGlider(model.scene),point=new T.Vector3(),delta=new T.Vector3();
  glider.group.scale.setScalar(GLIDER_SCALE);
  const branches=[RUN_BRANCH,CLIMB_TRUNK,TOP_BRANCH].map(branch=>{
    const a=new T.Vector3(...branch.a),axis=new T.Vector3(...branch.b).sub(a),length=axis.length();
    return {a,axis:axis.divideScalar(length),length,r0:branch.rootRadius,r1:branch.tipRadius};
  });
  const skin=glider.group.getObjectByName('Tail skin') as T.Mesh,groom=glider.group.getObjectByName('Tail groom') as T.Mesh;
  for(let frame=0;frame<=91;frame++)for(const clockOffset of [0,2,5]){
    const time=1.4+frame*.1,pose=departurePosition(time);
    glider.group.position.set(pose.x,pose.y,pose.z);departureOrientation(time,glider.group.quaternion);
    glider.update(time+clockOffset,pose.spread,0,pose.gait,pose.climbing,pose.travel,pose.ground,pose.launch,pose.tailLift);
    glider.group.updateMatrixWorld(true);
    for(const mesh of [skin,groom]){
      const p=mesh.geometry.getAttribute('position');
      // Test every solid vertex and every guard-hair tip. Soft hair tips may brush bark by up to15cm.
      for(let i=mesh===skin?0:4;i<p.count;i+=mesh===skin?1:5){
        point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert.ok(point.y-renderedTerrainHeight(point.x,point.z)>1);
        for(const branch of branches){
          delta.copy(point).sub(branch.a);const along=delta.dot(branch.axis);if(along<0||along>branch.length)continue;
          const radius=branch.r0+(branch.r1-branch.r0)*along/branch.length,clearance=delta.addScaledVector(branch.axis,-along).length()-radius;
          assert.ok(clearance>(mesh===skin?.02:-.15),`${mesh.name} enters wood at ${time}s (clearance ${clearance})`);
        }
      }
    }
  }
  glider.dispose();
});


test('walking uses alternating paws on the actual terrain while keeping the membrane folded',async()=>{
  const {model,skin}=await load(),glider=createGlider(model.scene),point=new T.Vector3();
  glider.group.scale.setScalar(GLIDER_SCALE);let planted=0,lifted=0;
  for(const site of CLEARINGS){
    const position={x:site.x,y:site.y+FOOT_HEIGHT,z:site.z},state=createWalkState();
    for(let i=0;i<120;i++){
      advanceWalk(state,position,1,.35,.7,1/60,false,[]);
      glider.group.position.set(position.x,position.y,position.z);glider.group.rotation.set(state.pitch,state.yaw,state.roll,'YXZ');
      glider.update(i/60,0,0,state.gait,0,state.travel,1,0,0,true,renderedTerrainHeight);glider.group.updateMatrixWorld(true);skin.skeleton.update();
      for(const leg of LIMB_BIND){
        skin.skeleton.bones[leg.paw].getWorldPosition(point);
        const clearance=point.y-renderedTerrainHeight(point.x,point.z);assert.ok(clearance>-.02,`paw penetrates ground ${JSON.stringify({clearance,site,position,state,foot:point.toArray(),leg:leg.paw})}`);
        if(clearance<.13)planted++;if(clearance>.2)lifted++;
      }
    }
  }
  assert.ok(planted>0&&lifted>0,'stance and lifted recovery feet are both visible');glider.dispose();
});
