// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {CLIMB_TRUNK,RUN_BRANCH,TOP_BRANCH} from './landscape.ts';
import type {Coordinate} from './squirrel-rig.ts';
import {batchStaticMeshes} from './world-batches.ts';

function curvedBranch(points:ReadonlyArray<Coordinate>,r0:number,r1:number,material:T.Material){
  const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),length=path.getLength(),rings=Math.max(12,Math.ceil(length*2)),sides=12,frames=path.computeFrenetFrames(rings,false);
  const p:number[]=[],uv:number[]=[],index:number[]=[],center=new T.Vector3(),v=new T.Vector3();
  for(let i=0;i<=rings;i++){
    const t=i/rings,r=T.MathUtils.lerp(r0,r1,t);path.getPointAt(t,center);
    for(let j=0;j<=sides;j++){
      const a=j/sides*Math.PI*2;v.copy(center).addScaledVector(frames.normals[i]!,Math.cos(a)*r).addScaledVector(frames.binormals[i]!,Math.sin(a)*r*.94);
      p.push(v.x,v.y,v.z);uv.push(j/sides,t*length*.10);
      if(i<rings&&j<sides){const q=i*(sides+1)+j,b=q+sides+1;index.push(q,q+1,b,b,q+1,b+1);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
  return new T.Mesh(geometry,material);
}
function contactBranch(branch:{a:Coordinate;b:Coordinate;rootRadius:number;tipRadius:number},material:T.Material){
  const a=new T.Vector3(...branch.a),b=new T.Vector3(...branch.b),delta=b.clone().sub(a),geometry=new T.CylinderGeometry(branch.tipRadius,branch.rootRadius,delta.length(),32,8,false);
  const mesh=new T.Mesh(geometry,material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;
}

export function createHeroTree(material:T.Material,foliage:T.Texture){
  const tree=new T.Group(),wood=new T.Group();wood.name='Continuous oak limbs';tree.add(wood);
  wood.add(curvedBranch([[-11,55,69],[-11.5,63,67.9],[-12.1,72,65.9],CLIMB_TRUNK.a],2.9,2.2,material));
  for(const branch of [CLIMB_TRUNK,RUN_BRANCH,TOP_BRANCH])wood.add(contactBranch(branch,material));
  // The crown junction conceals the planar branch end while staying below the standing contact surface.
  const crownJoint=new T.Mesh(new T.SphereGeometry(.80,20,12),material);crownJoint.position.set(...CLIMB_TRUNK.b);crownJoint.scale.set(1,1.10,1);wood.add(crownJoint);
  const boughs:Array<{points:Coordinate[];r:number}>= [
    {points:[[-12,80,65],[-18,82,70],[-24,86,75],[-29,92,78]],r:1.35},
    {points:[[-11.6,85.5,64.7],[-16,87,59],[-20,91,52],[-22,96,49]],r:1.12},
    {points:[[-11.4,89,64.5],[-11,91,72],[-2,95,77],[6,99,78]],r:.92},
    {points:[[-10.9,97,64.2],[-16,99,67],[-20,102,71],[-23,103,73]],r:.66},
    {points:[[-10.8,99,64],[-14,100.6,58],[-18,103,53],[-21,104,50]],r:.58},
    {points:[RUN_BRANCH.b,[4,81,64],[6,84,66]],r:RUN_BRANCH.tipRadius},
    {points:[TOP_BRANCH.b,[-7.6,107.1,55.2],[-6.8,107.2,54.2]],r:TOP_BRANCH.tipRadius},
  ];
  const crowns:Array<{point:Coordinate;size:number}>=[];
  boughs.forEach((branch,i)=>{
    wood.add(curvedBranch(branch.points,branch.r,.025,material));
    const end=branch.points.at(-1)!;crowns.push({point:end,size:i===6?2.8:i===5?2.5:6.8});
    if(i>=5)return;
    const root=new T.Vector3(...branch.points[2]!);
    for(let twig=0;twig<3;twig++){
      const sign=twig%2?1:-1,tip=root.clone().add(new T.Vector3(sign*(2.4+twig),2.7+twig*.25,-3+twig*2.6));
      wood.add(curvedBranch([root.toArray() as Coordinate,root.clone().lerp(tip,.6).add(new T.Vector3(0,-.35,0)).toArray() as Coordinate,tip.toArray() as Coordinate],branch.r*.24,.012,material));
      crowns.push({point:tip.toArray() as Coordinate,size:4.8});
    }
  });
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;wood.add(curvedBranch([[-11,59,69],[-11+Math.cos(a)*3,57.8,69+Math.sin(a)*3],[-11+Math.cos(a)*8,57,69+Math.sin(a)*8]],1.4,.10,material));}
  batchStaticMeshes(wood);
  // A painted crown keeps leaf clusters coherent instead of thousands of disconnected leaf planes.
  const leafGeometry=new T.PlaneGeometry(1,1);
  const leafMaterial=new T.MeshStandardMaterial({map:foliage,alphaTest:.42,side:T.DoubleSide,roughness:1,color:0xe3e9d9});
  leafMaterial.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*.14;\n#include <opaque_fragment>');};
  const leaves=new T.InstancedMesh(leafGeometry,leafMaterial,crowns.length*3),dummy=new T.Object3D(),color=new T.Color();
  crowns.forEach((c,i)=>{for(let side=0;side<3;side++){
    dummy.position.set(c.point[0],c.point[1],c.point[2]);dummy.rotation.set(side===2?-.58:0,i*.83+side*Math.PI/2,side===2?.2:0);dummy.scale.set(c.size,c.size*.64,1);dummy.updateMatrix();leaves.setMatrixAt(i*3+side,dummy.matrix);
    color.setHSL(.20+(i%3)*.009,.06,.87+(i%4)*.025);leaves.setColorAt(i*3+side,color);
  }});leaves.castShadow=true;leaves.receiveShadow=true;leaves.name='Painted oak crown clusters';tree.add(leaves);return tree;
}
