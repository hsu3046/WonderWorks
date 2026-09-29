// SPDX-License-Identifier: GPL-3.0-only
import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
let seed=5299;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
export function addLandscape(scene:T.Scene){
 const ground=new T.Group();ground.name='Archipelago';scene.add(ground);
 const rockMat=new T.MeshStandardMaterial({color:0x718275,roughness:.94,vertexColors:true});
 const foliage=new T.MeshStandardMaterial({color:0x345f43,roughness:1});
 const bark=new T.MeshStandardMaterial({color:0x453e2a,roughness:1});
 const sphere=new T.IcosahedronGeometry(1,1),rockGeo=mergeVertices(new T.IcosahedronGeometry(1,3));
 const pos=rockGeo.attributes.position,col=new Float32Array(pos.count*3),v=new T.Vector3(),c=new T.Color();
 for(let i=0;i<pos.count;i++){
  v.fromBufferAttribute(pos,i);const n=Math.sin(v.x*7+v.y*9)*Math.cos(v.z*6-v.y*3)*.13+Math.sin(v.x*19-v.z*17)*.045;
  v.multiplyScalar(1+n);pos.setXYZ(i,v.x,v.y,v.z);const shade=.6+.25*Math.sin(v.y*22)+rand()*.13;c.setRGB(shade*.83,shade,shade*.86);col.set([c.r,c.g,c.b],i*3);
 }
 rockGeo.setAttribute('color',new T.BufferAttribute(col,3));rockGeo.computeVertexNormals();
 rockMat.onBeforeCompile=shader=>{
 shader.vertexShader='varying vec3 vRock;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRock=position;');
 shader.fragmentShader='varying vec3 vRock;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float stratum=sin(vRock.y*90.+sin(vRock.x*19.)*2.+sin(vRock.z*21.));
 float fleck=fract(sin(dot(floor(vRock*380.),vec3(12.989,78.233,39.45)))*43758.54);
 diffuseColor.rgb*=.84+stratum*.065+fleck*.17;`);
 };
 const trunkMatrices:T.Matrix4[]=[],leafMatrices:T.Matrix4[]=[],leafColors:T.Color[]=[];const dummy=new T.Object3D();
 function pine(x:number,y:number,z:number,s:number){
  dummy.position.set(x,y+s*2.4,z);dummy.rotation.set(.06*(rand()-.5),rand()*6,.09*(rand()-.5));dummy.scale.set(s*.13,s*5.4,s*.13);dummy.updateMatrix();trunkMatrices.push(dummy.matrix.clone());
  for(let l=0;l<6;l++){
   const h=y+s*(1.7+l*.72),r=s*(1.6-l*.19);
   for(let k=0;k<5;k++){
    const a=k*Math.PI*.4+l*2.2;dummy.position.set(x+Math.cos(a)*r*(.34+rand()*.38),h+rand()*.4,z+Math.sin(a)*r*(.34+rand()*.38));dummy.rotation.set(rand()*.2,rand()*6,rand()*.15);dummy.scale.set(r*(.65+rand()*.3),s*(.14+rand()*.12),r*(.7+rand()*.25));dummy.updateMatrix();leafMatrices.push(dummy.matrix.clone());leafColors.push(new T.Color().setHSL(.29+rand()*.04,.17+rand()*.1,.29+rand()*.1));
   }
  }
 }
 const islands=[[-21,-10,11,8,9],[-35,-55,15,11,12],[32,-64,15,10,14],[65,-100,18,12,20],[-75,-110,22,12,18],[2,-135,25,13,15],[92,-180,23,15,20],[-120,-210,35,17,28]];
 for(const [x,z,w,h,d] of islands){
  for(let i=0;i<15;i++){
   const a=i*Math.PI*2/15, r=.65+rand()*.12;const rock=new T.Mesh(rockGeo,rockMat);rock.position.set(x+Math.cos(a)*w*r,h*.20+rand()*.6,z+Math.sin(a)*d*r);rock.scale.set(w*(.24+rand()*.1),h*(.55+rand()*.14),d*(.25+rand()*.08));rock.rotation.y=rand()*6;rock.castShadow=rock.receiveShadow=true;ground.add(rock);
  }
  const top=new T.Mesh(rockGeo,new T.MeshStandardMaterial({color:0x455939,roughness:1}));top.position.set(x,h*.63,z);top.scale.set(w*.86,h*.25,d*.85);top.castShadow=top.receiveShadow=true;ground.add(top);
  for(let i=0;i<18;i++){
   const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.74;pine(x+Math.cos(a)*w*r,h*(.83-.11*r),z+Math.sin(a)*d*r,.65+rand()*.72);
  }
 }
 function instanced(geo:T.BufferGeometry,mat:T.Material,matrices:T.Matrix4[],colors?:T.Color[]){
  const mesh=new T.InstancedMesh(geo,mat,matrices.length);matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors)mesh.setColorAt(i,colors[i]);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();ground.add(mesh);
 }
 instanced(new T.CylinderGeometry(.65,1,1,7),bark,trunkMatrices);instanced(sphere,foliage,leafMatrices,leafColors);
 // Connect the landing to the island with a rising timber stair.
 const stepGeo=new T.BoxGeometry(1,.14,.42),stairs=new T.InstancedMesh(stepGeo,bark,26);
 for(let i=0;i<26;i++){const k=i/25;dummy.position.set(-10.4-k*5.4,1.06+k*5.9,-1-k*4.2);dummy.rotation.set(0,.9,0);dummy.scale.set(1.8,1,1);dummy.updateMatrix();stairs.setMatrixAt(i,dummy.matrix);}
 stairs.castShadow=stairs.receiveShadow=true;ground.add(stairs);
 return ground;
}
