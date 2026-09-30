// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,tau,underwaterLight} from './shared';
import {createNatureMaterials,detailFoliage} from './nature-materials';
import {createMeadow,createOuterGroundcover} from './meadow';
import {terrainHeight} from './terrain';
import {createArchitecture} from './architecture';
// Keep all navigable ground opaque; blend into the painted forest only beyond it.
function fadeMeadowGround(material:T.MeshStandardMaterial){
 material.transparent=true;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 vMeadowXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\n vMeadowXZ = (modelMatrix * vec4(position, 1.0)).xz;');
  shader.fragmentShader='varying vec2 vMeadowXZ;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
   'diffuseColor.a *= 1.0 - smoothstep(5.0, 6.0, length(vMeadowXZ / vec2(10.5, 8.0)));\n if (diffuseColor.a < 0.005) discard;\n#include <alphatest_fragment>');
 };
 material.customProgramCacheKey=()=> 'meadow-solid-navigable-ground-v2';
 return material;
}
export async function createGarden(scene:T.Scene){
 const {stone,bark,soil,meadow:meadowMaterial}=await createNatureMaterials();
 const r=rng(337),root=new T.Group();scene.add(root);
 const batches=new Map<T.Material,T.BufferGeometry[]>();
 function batch(g:T.BufferGeometry,m:T.Material,p:T.Vector3,scale=new T.Vector3(1,1,1),q=new T.Quaternion()){g.applyMatrix4(new T.Matrix4().compose(p,q,scale));const list=batches.get(m)||[];list.push(g);batches.set(m,list);}
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){batch(new T.BoxGeometry(w,h,d),m,new T.Vector3(x,y,z));}
 function branch(a:T.Vector3,b:T.Vector3,ra:number,rb:number,m:T.Material=bark){const delta=b.clone().sub(a),length=delta.length(),g=new T.CylinderGeometry(rb,ra,length,ra>.1?12:7);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(.12,2*Math.PI*ra),uv.getY(i)*length);batch(g,m,a.clone().add(b).multiplyScalar(.5),undefined,new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));}
 const rockBase=new T.IcosahedronGeometry(1,2);const pa=rockBase.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),d=1+.10*Math.sin(x*4.3+y*2.8)*Math.sin(z*5.1+x*2.4)+.035*Math.sin(x*16+z*11);pa.setXYZ(i,x*d,y*d,z*d);}rockBase.computeVertexNormals();
 // Radial topology shares its exact rim with the lawn; no raised clipped soil triangles.
 const floorG=new T.RingGeometry(0,1,128,64);floorG.rotateX(-Math.PI/2);floorG.scale(10,1,7.5);
 const pos=floorG.attributes.position,bedUV=floorG.attributes.uv;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,terrainHeight(x,z));bedUV.setXY(i,x*.6,z*.6);
 }
 floorG.computeVertexNormals();
 const bedMaterial=underwaterLight(soil.clone());bedMaterial.color.set('#a6afa0');
 const floor=new T.Mesh(floorG,bedMaterial);floor.receiveShadow=true;root.add(floor);
 const grassMat=fadeMeadowGround(meadowMaterial);const outside=new T.RingGeometry(1,8,128,16);outside.rotateX(-Math.PI/2);outside.scale(10,1,7.5);const lawn=new T.Mesh(outside,grassMat);const lawnUV=outside.attributes.uv,lawnP=outside.attributes.position;for(let i=0;i<lawnP.count;i++)lawnUV.setXY(i,lawnP.getX(i)*.42,lawnP.getZ(i)*.42);lawn.position.y=.25;lawn.receiveShadow=true;root.add(lawn);
 for(let i=0;i<102;i++){const a=i/102*tau,x=Math.cos(a)*10.1,z=Math.sin(a)*7.6;batch(rockBase.clone(),stone,new T.Vector3(x,.08+r()*.18,z),new T.Vector3(.5+r()*.28,.36+r()*.32,.42+r()*.35),new T.Quaternion().setFromEuler(new T.Euler(r(),a,r()*.2)));}
 for(let i=0;i<140;i++){const a=r()*tau,rad=Math.sqrt(r())*.92;const x=Math.cos(a)*9.5*rad,z=Math.sin(a)*6.7*rad;batch(rockBase.clone(),stone,new T.Vector3(x,-1.55+Math.pow(rad,5)*1.5,z),new T.Vector3(.035+r()*.13,.03+r()*.065,.04+r()*.1));}
 for(const [x,z,s] of [[5.7,2.3,1.25],[-6.3,-1.7,1.1],[8,-3.6,1.4],[-8,4.5,.8]]){batch(rockBase.clone(),stone,new T.Vector3(x,-.4,z),new T.Vector3(s,s*1.2,s*.8));batch(rockBase.clone(),stone,new T.Vector3(x+.45,.12,z+.1),new T.Vector3(s*.65,s*.38,s*.5));}
 // Supplied refined timber models replace the procedural bridge and pavilion.
 const architecture=await createArchitecture(root);
 // Lanterns have carved feet and a warm paper chamber.
 const lanternGlow=new T.MeshStandardMaterial({color:'#ffe0a0',emissive:'#ffc469',emissiveIntensity:.7,roughness:.6});
 for(const [x,z] of [[-5.4,-5.5],[6.3,-6.1]]){box(.85,.18,.85,x,.47,z,stone);branch(new T.Vector3(x,.5,z),new T.Vector3(x,1.75,z),.2,.17,stone);box(.65,.2,.65,x,1.8,z,stone);box(.46,.6,.46,x,2.15,z,lanternGlow);batch(new T.ConeGeometry(.66,.38,4),stone,new T.Vector3(x,2.63,z));}
 // Leaf silhouettes have a pointed tip and a raised central vein.
 const leafG=new T.BufferGeometry();leafG.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-.24,.018,.27,0,.075,.27,.24,.018,.27,-.32,.02,.62,0,.12,.62,.32,.02,.62,0,.065,1.15],3));leafG.setIndex([0,1,2,0,2,3,1,4,5,1,5,2,2,5,6,2,6,3,4,7,5,5,7,6]);leafG.computeVertexNormals();
 const leafMat=detailFoliage(new T.MeshStandardMaterial({color:'#d5d8bc',roughness:.84,envMapIntensity:.12,side:T.DoubleSide}));
 const leaves:T.Matrix4[]=[],colors:T.Color[]=[];const dummy=new T.Object3D();
 const scatter=(center:T.Vector3,count:number,spread:number,palette:string[],size:number)=>{for(let i=0;i<count;i++){const a=r()*tau,rad=Math.cbrt(r())*spread,v=r()*2-1;dummy.position.copy(center).add(new T.Vector3(Math.cos(a)*rad*Math.sqrt(1-v*v),v*rad*.54,Math.sin(a)*rad*Math.sqrt(1-v*v)));dummy.rotation.set(r()*2-1,r()*tau,r()*1.5-.75);dummy.scale.setScalar(size*(.7+r()*.7));dummy.updateMatrix();leaves.push(dummy.matrix.clone());colors.push(new T.Color(palette[Math.floor(r()*palette.length)]!));}};
 function tree(x:number,z:number,h:number,palette:string[],blossom=false){
  const base=new T.Vector3(x,.3,z),bend=new T.Vector3(x+h*.025,h*.30,z-h*.018),fork=new T.Vector3(x-h*.016,h*.54,z+h*.035),crown=new T.Vector3(x+h*.045,h*.77,z);
  branch(base,bend,h*.066,h*.043);branch(bend,fork,h*.043,h*.025);branch(fork,crown,h*.025,.018);
  for(let j=0;j<9;j++){
   const a=j*2.399+r()*.45,join=j<4?bend.clone().lerp(fork,.12+j*.20):fork.clone().lerp(crown,(j-4)/5);
   const reach=h*(.22+r()*.12),mid=join.clone().add(new T.Vector3(Math.cos(a)*reach,h*(.06+r()*.12),Math.sin(a)*reach));
   const elbow=join.clone().lerp(mid,.45);elbow.y-=h*.025;
   branch(join,elbow,h*.018,.065);branch(elbow,mid,.065,.035);
   for(let k=0;k<4;k++){const aa=a+(k-1.5)*.5,end=mid.clone().add(new T.Vector3(Math.cos(aa)*h*.19,h*(.025+r()*.12),Math.sin(aa)*h*.19));branch(mid,end,.035,.009);scatter(end,blossom?140:80,h*.15,palette,blossom?.115:.25);if(blossom){const droop=end.clone().add(new T.Vector3(Math.cos(aa)*.6,-1.3-r(),Math.sin(aa)*.6));branch(end,droop,.018,.004);for(let m=0;m<4;m++)scatter(end.clone().lerp(droop,m/3),24,.36,palette,.12);}}
  }
 }

 tree(-8.8,-4.4,7.5,['#f5dce1','#f8e7dc','#e8b8ca','#d993b4'],true);
 tree(9,-4.3,8.1,['#713c27','#b94b34','#bd6443','#7d3428']);
 tree(-15,1,9.5,['#395f32','#68854a','#829952']);tree(15,-.5,10,['#294d33','#4b753d','#71914b']);
 // The far forest and shrubs are painted into the lightweight 360-degree backdrop.
 // Dense irregular shoreline gardens, with open foreground windows onto the koi.
 for(let i=0;i<60;i++){const a=i/60*tau,x=Math.cos(a)*(11.2+r()*2.8),z=Math.sin(a)*(8.4+r()*2.5);if(z>5&&Math.abs(x)<6)continue;scatter(new T.Vector3(x,.65+r()*.5,z),100,.6+r()*.4,['#3b6138','#5e803e','#8a9d4a'],.22);}
 const reedMat=new T.MeshStandardMaterial({color:'#607a3d',roughness:1});
 for(let i=0;i<230;i++){
  const a=r()*tau;if(a>.3&&a<2.8&&r()<.7)continue;
  const x=Math.cos(a)*(9.1+r()*.8),z=Math.sin(a)*(6.6+r()*.7),h=.7+r()*1.7;
  const base=new T.Vector3(x,-.2,z),tip=new T.Vector3(x+(r()-.5)*.35,h,z);
  branch(base,tip,.016,.007,reedMat);
  if(i%3===0){
   // Use the stalk's actual endpoint and axis; overlap the seed head by 0.07.
   const axis=tip.clone().sub(base).normalize(),center=tip.clone().addScaledVector(axis,.08);
   batch(new T.CylinderGeometry(.04,.035,.3,5),bark,center,undefined,
    new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis));
  }
 }
 for(let i=0;i<16;i++){const a=i/16*tau;const x=Math.cos(a)*11.7,z=Math.sin(a)*9;if(z>5&&Math.abs(x)<6)continue;scatter(new T.Vector3(x,.65,z),200,.6,['#aa8fc2','#c1b0d5','#d2c8d9'],.075);}
 const bladeG=new T.BufferGeometry();bladeG.setAttribute('position',new T.Float32BufferAttribute([-.018,0,0,.018,0,0,-.017,.14,.012,.017,.14,.012,-.012,.28,.044,.012,.28,.044,.008,.40,.105],3));bladeG.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);bladeG.computeVertexNormals();
 const grassM=detailFoliage(new T.MeshStandardMaterial({color:'#d2e6b7',roughness:.92,envMapIntensity:.10,side:T.DoubleSide}),true);
 const grass=new T.InstancedMesh(bladeG,grassM,78000);
 for(let i=0;i<78000;i++){const a=r()*tau,rad=1.012+Math.pow(r(),1.75)*1.75,x=Math.cos(a)*10.5*rad,z=Math.sin(a)*8*rad,patch=.5+.5*Math.sin(x*.82+Math.sin(z*.54))*Math.cos(z*.71);
 dummy.position.set(x,.26,z);dummy.rotation.set((r()-.5)*.3,r()*tau,(r()-.5)*.5);dummy.scale.set(.95+r()*.60,(.42+r()*.68)*(.85+patch*.4),.8+r()*.6);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new T.Color().setHSL(.245+r()*.065,.43+r()*.25,.25+patch*.10+r()*.08));}grass.receiveShadow=true;root.add(grass);
 // Add canopy after existing planting so its seeded layout stays unchanged.
 // Keep the foreground and the central bridge/gazebo sightline open.
 tree(6.8,-10.2,8.2,['#f7dde4','#fae9e0','#e9b7cb','#df9ebc'],true);
 tree(-13,-9.2,8.8,['#345934','#658344','#8eaa57']);
 tree(-6.8,-15,9.3,['#315a3b','#557d46','#8aa75c']);
 tree(6,-17,10.1,['#345c3a','#69894c','#9bb66c']);
 tree(14,-10,9.2,['#2f5436','#5b8145','#87a85d']);
 const foliage=new T.InstancedMesh(leafG,leafMat,leaves.length);for(let i=0;i<leaves.length;i++){foliage.setMatrixAt(i,leaves[i]!);foliage.setColorAt(i,colors[i]!);}foliage.castShadow=true;foliage.receiveShadow=true;root.add(foliage);
 for(const [m,geometries] of batches){const merged=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g),false);if(!merged)throw Error('Garden geometry could not be assembled');
 // Preserve cylindrical bark UVs; stone uses its own triplanar projection.
 const mesh=new T.Mesh(merged,m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
 const meadow=createMeadow(root);const groundcover=createOuterGroundcover(root);rockBase.dispose();return {root,architecture,leaves:leaves.length,meadow:{...meadow,grass:grass.count,groundcover}};
}
