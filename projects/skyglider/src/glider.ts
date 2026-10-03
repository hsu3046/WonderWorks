// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {smooth} from './landscape.ts';
import {GLIDER_SCALE,boundPose,stepPose} from './glider-pose.ts';
import {HEAD_PIVOT,LIMB_BIND,type LimbBind} from './squirrel-rig.ts';
import {addFaceNap,createFurMaterial,furGeometry,paintCoat} from './squirrel-coat.ts';
import {addSquirrelEyes} from './squirrel-eyes.ts';
import {addSquirrelWhiskers} from './squirrel-whiskers.ts';
import {addSquirrelNose} from './squirrel-nose.ts';
import {createPatagium} from './squirrel-patagium.ts';

/** The skin and fur share a skeleton, so the shoulder/hip remains one continuous surface in every pose. */
export function createGlider(source:T.Group){
  const group=new T.Group(),body=source;group.add(body);
  let skin:T.SkinnedMesh|undefined;source.traverse(object=>{if(object instanceof T.SkinnedMesh)skin=object;});
  if(!skin)throw new Error('The squirrel skin could not be prepared.');
  const squirrelSkin=skin,skeleton=squirrelSkin.skeleton;
  const coat=new T.MeshStandardMaterial({vertexColors:true,roughness:.94});addFaceNap(coat);
  const furMaterial=createFurMaterial();
  for(const material of Array.isArray(squirrelSkin.material)?squirrelSkin.material:[squirrelSkin.material])material.dispose();
  squirrelSkin.material=coat;paintCoat(squirrelSkin.geometry);squirrelSkin.castShadow=true;squirrelSkin.receiveShadow=true;squirrelSkin.frustumCulled=false;
  const bodyGroom=furGeometry(squirrelSkin.geometry,38000,'body',9182),faceGroom=furGeometry(squirrelSkin.geometry,10000,'body',3271,'face');
  const groom=mergeGeometries([bodyGroom,faceGroom]);bodyGroom.dispose();faceGroom.dispose();
  if(!groom)throw new Error('The squirrel facial groom could not be prepared.');
  const fur=new T.SkinnedMesh(groom,furMaterial);fur.bind(skeleton,squirrelSkin.bindMatrix);fur.frustumCulled=false;body.add(fur);
  const torso=skeleton.bones[0]!,head=skeleton.bones[1]!;
  const face=new T.Group();face.position.set(-HEAD_PIVOT[0],-HEAD_PIVOT[1],-HEAD_PIVOT[2]);head.add(face);
  addSquirrelEyes(face,squirrelSkin);
  addSquirrelWhiskers(face,squirrelSkin);
  addSquirrelNose(face,squirrelSkin);
  const lidMaterial=new T.MeshStandardMaterial({color:0x453122,roughness:.87});
  for(const sign of [-1,1]){
    const ear=new T.Group();ear.position.set(sign*.174,.335,-.735);ear.rotation.set(.12,-sign*.13,-sign*.18);face.add(ear);
    const earPositions:number[]=[],earColors:number[]=[],earIndices:number[]=[],radial=10,around=40;
    const outer=new T.Color('#806045'),inner=new T.Color('#694b3e'),rim=new T.Color('#a38a6c');
    for(let side=0;side<2;side++)for(let r=0;r<=radial;r++)for(let j=0;j<=around;j++){
      const radius=r/radial,a=j/around*Math.PI*2,s=Math.sin(a);
      const x=Math.cos(a)*radius*.095*(1-.24*Math.max(0,s)),y=.084+s*radius*.111;
      // The ear opening faces forward: its center is recessed, and the rim has actual thickness.
      const z=.046*(1-radius*radius)+(side===0?0:.018);
      earPositions.push(x,y,z);
      const color=(side===0?inner:outer).clone().lerp(rim,smooth(.78,1,radius)*.50);earColors.push(color.r,color.g,color.b);
      if(r<radial&&j<around){const v=side*(radial+1)*(around+1)+r*(around+1)+j,b=v+around+1;if(side===0)earIndices.push(v,v+1,b,b,v+1,b+1);else earIndices.push(v,b,v+1,b,b+1,v+1);}
    }
    const offset=(radial+1)*(around+1),edge=radial*(around+1);
    for(let j=0;j<around;j++){const a=edge+j,b=a+offset;earIndices.push(a,b,a+1,a+1,b,b+1);}
    const earGeo=new T.BufferGeometry();earGeo.setAttribute('position',new T.Float32BufferAttribute(earPositions,3));earGeo.setAttribute('color',new T.Float32BufferAttribute(earColors,3));earGeo.setIndex(earIndices);earGeo.computeVertexNormals();
    const earMesh=new T.Mesh(earGeo,coat);earMesh.castShadow=true;ear.add(earMesh);ear.add(new T.Mesh(furGeometry(earGeo,720,'ear',sign<0?15:31),furMaterial));
    const mouth=new T.QuadraticBezierCurve3(new T.Vector3(0,-.007,-1.326),new T.Vector3(sign*.04,-.051,-1.276),new T.Vector3(sign*.096,-.027,-1.176));
    face.add(new T.Mesh(new T.TubeGeometry(mouth,13,.0019,4,false),lidMaterial));
  }

  interface Limb extends LimbBind {rootPosition:T.Vector3;jointPosition:T.Vector3;footPosition:T.Vector3;upperLength:number;lowerLength:number;}
  const limbs:Limb[]=LIMB_BIND.map(bind=>({...bind,rootPosition:new T.Vector3(...bind.root),jointPosition:new T.Vector3(...bind.joint),footPosition:new T.Vector3(...bind.foot),upperLength:new T.Vector3(...bind.root).distanceTo(new T.Vector3(...bind.joint)),lowerLength:new T.Vector3(...bind.joint).distanceTo(new T.Vector3(...bind.foot))}));
  const toeMaterial=new T.MeshStandardMaterial({color:0x745038,roughness:.93}),clawMaterial=new T.MeshStandardMaterial({color:0x37291e,roughness:.69});
  for(const leg of limbs){
    const paw=skeleton.bones[leg.paw]!,digits=leg.front?4:5;
    for(let digit=0;digit<digits;digit++){
      const offset=(digit-(digits-1)/2)*.025,reach=.105-Math.abs(offset)*.4;
      const points=[new T.Vector3(offset,.006,-.064),new T.Vector3(offset*1.30,-.004,-.064-reach*.48),new T.Vector3(offset*1.53,-.011,-.064-reach)];
      const toe=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),8,.010,5,false),toeMaterial);paw.add(toe);
      const end=points[2]!,claw=new T.Mesh(new T.ConeGeometry(.008,.032,6),clawMaterial);claw.position.copy(end).add(new T.Vector3(0,-.006,-.012));claw.rotation.x=-Math.PI*.61;paw.add(claw);
    }
  }
  const wings:Array<{patch:ReturnType<typeof createPatagium>;front:Limb;hind:Limb}>=[];
  for(const sign of [-1,1]){
    const patch=createPatagium(sign),front=limbs.find(l=>l.sign===sign&&l.front)!,hind=limbs.find(l=>l.sign===sign&&!l.front)!;
    body.add(patch.group);wings.push({patch,front,hind});
  }

  // An elliptical, tapered brush gives the tail its volume before the longer guard hairs are added.
  const tail=new T.Group();tail.name='Tail articulation';tail.position.set(0,.07,.81);body.add(tail);
  const tailPath=new T.CatmullRomCurve3([new T.Vector3(),new T.Vector3(.07,.10,.43),new T.Vector3(.13,.20,.98),new T.Vector3(.06,.16,1.53),new T.Vector3(-.035,.01,1.98)]);
  const tailVertices:number[]=[],tailIndices:number[]=[],axisX=new T.Vector3(1,0,0),tangent=new T.Vector3(),up=new T.Vector3(),across=new T.Vector3(),center=new T.Vector3(),point=new T.Vector3();
  const rings=64,segments=24;
  for(let i=0;i<=rings;i++){
    const t=i/rings;tailPath.getPoint(t,center);tailPath.getTangent(t,tangent);across.copy(axisX).addScaledVector(tangent,-axisX.dot(tangent)).normalize();up.crossVectors(tangent,across).normalize();
    const taper=1-smooth(.80,1,t),radius=(.092+Math.sin(t*Math.PI)*.20)*taper+.003;
    for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2;point.copy(center).addScaledVector(across,Math.cos(a)*radius).addScaledVector(up,Math.sin(a)*radius*.66);point.toArray(tailVertices,tailVertices.length);if(i<rings&&j<segments){const a=i*(segments+1)+j,b=a+segments+1;tailIndices.push(a,a+1,b,b,a+1,b+1);}}
  }
  const tailGeo=new T.BufferGeometry();tailGeo.setAttribute('position',new T.Float32BufferAttribute(tailVertices,3));tailGeo.setIndex(tailIndices);tailGeo.computeVertexNormals();paintCoat(tailGeo,'tail');
  const tailMesh=new T.Mesh(tailGeo,coat);tailMesh.name='Tail skin';tailMesh.castShadow=true;tailMesh.receiveShadow=true;tail.add(tailMesh);const tailFur=new T.Mesh(furGeometry(tailGeo,16000,'tail',7741),furMaterial);tailFur.name='Tail groom';tail.add(tailFur);
  const axisY=new T.Vector3(0,1,0),delta=new T.Vector3(),contact=new T.Vector3();
  function poseBone(index:number,a:T.Vector3,b:T.Vector3,length:number){const bone=skeleton.bones[index]!;delta.copy(b).sub(a);const distance=delta.length();bone.position.copy(a);bone.quaternion.setFromUnitVectors(axisY,delta.divideScalar(distance));bone.scale.set(1,distance/length,1);}
  return {group,dispose(){skeleton.dispose();},update(time:number,spread:number,bank:number,gait=0,climb=0,travel=0,ground=0,launch=0,tailLift=0,walking=false,groundAt?:(x:number,z:number)=>number){
    const folded=1-spread,step=gait*folded;
    const gather=smooth(0,.225,launch)*(1-smooth(.225,.43,launch)),kick=smooth(.225,.33,launch)*(1-smooth(.38,.58,launch)),tuck=smooth(.38,.59,launch)*(1-smooth(.72,1,launch));
    const run=(walking?0:gait)*(1-climb)*(1-smooth(0,.16,spread))*smooth(0,.24,travel),bound=boundPose(travel),bob=bound.height*run;
    body.position.y=bob;
    torso.scale.set(1+climb*.025,1+Math.sin(time*2.2)*.005+bound.gather*.05*run,1-climb*.085+bound.extension*.075*run-gather*.055+kick*.035);
    torso.rotation.x=bound.pitch*run;
    head.position.set(HEAD_PIVOT[0],HEAD_PIVOT[1]+climb*.015-bound.pitch*.15*run,HEAD_PIVOT[2]+climb*.065-bound.extension*.04*run+gather*.035);head.rotation.set(climb*.10-bound.pitch*.45*run,Math.sin(time*.7)*.027*folded-gather*.18,0);
    if(walking&&groundAt)group.updateMatrixWorld(true);
    for(const leg of limbs){
      const {sign,front,rootPosition:root,jointPosition:joint,footPosition:foot}=leg,pose=stepPose(travel,front===(sign<0)?0:.5),running=front?bound.front:bound.hind;
      const stroke=T.MathUtils.lerp(pose.stroke*step,running.stroke,run),release=T.MathUtils.lerp(pose.release*step,running.release,run);
      root.set(sign*.235,front?.075:.10,front?-.47+climb*.025:.49-climb*.04);
      joint.set(sign*T.MathUtils.lerp(front?.315:.38,front?.65:.61,spread),T.MathUtils.lerp(front?-.19:-.17,.022,spread)+release*.025,T.MathUtils.lerp((front?-.55:.31)+stroke*.43,front?-.65:.65,spread));
      foot.set(sign*T.MathUtils.lerp(front?.31:.37,front?1.13:1.08,spread),T.MathUtils.lerp(-.466,-.022,spread)+release*.16,T.MathUtils.lerp((front?-.80:.58)+stroke,front?-.83:.80,spread));
      // Stance feet cancel body lift; the flight phase clears all four feet together.
      foot.y+=run*(release*.12-bound.height*(1-release));joint.y+=run*release*.12;
      joint.z+=run*(front?release*.10:-release*.16);root.y+=run*(front?-bound.pitch*.28:bound.pitch*.20);
      // Gather against the bark, release the forepaws, push with the hind pair, then tuck before spreading.
      foot.z+=folded*(front?gather*.10+tuck*.18:-gather*.08-tuck*.16);
      foot.y+=folded*(front?kick*.20+tuck*.14:-kick*.06+tuck*.16);
      foot.y+=folded*gather*ground*(.12/GLIDER_SCALE);
      joint.y+=folded*(gather*.04+tuck*.08);joint.z+=folded*(front?gather*.04:-gather*.05);
      if(walking&&groundAt){
        // Ground each stance paw independently; preserve its lifted recovery arc.
        const before=foot.y,up=group.matrixWorld.elements[5]!;
        for(let i=0;i<2;i++){
          contact.copy(foot).applyMatrix4(group.matrixWorld);
          foot.y+=(groundAt(contact.x,contact.z)+.07+release*.16*GLIDER_SCALE-contact.y)/up;
        }
        joint.y+=(foot.y-before)*.5;
      }
      poseBone(leg.upper,root,joint,leg.upperLength);poseBone(leg.lower,joint,foot,leg.lowerLength);
      const paw=skeleton.bones[leg.paw]!;paw.position.copy(foot);paw.rotation.set(release*(.20+run*(front?-.65:.42)),-sign*Math.PI*.48*spread,0);
    }
    for(const wing of wings)wing.patch.update(spread,wing.front.footPosition,wing.hind.footPosition,wing.front.rootPosition.z,wing.hind.rootPosition.z);
    tail.position.z=.81-climb*.05;tail.rotation.set(Math.sin(time*1.15)*.033-climb*.045-tailLift*1.70-ground*.07+bound.tail*run+gather*.06-kick*.09,Math.sin(time*1.8)*.065-bank*.23,0);
    // Lift the forward-facing chest as the wings open; ease back to level for touchdown.
    body.rotation.x=.24*smooth(.05,1,spread)*(1-climb)*(1-ground);
    body.rotation.z=bank;
  }};
}
