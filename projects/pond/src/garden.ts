// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,tau,texture,underwaterLight} from './shared';
import {createNatureMaterials,detailFoliage} from './nature-materials';
import {createMeadow} from './meadow';
export async function createGarden(scene:T.Scene){
 const {stone,bark,soil}=await createNatureMaterials();
 const r=rng(337),root=new T.Group();scene.add(root);const woodTex=texture('wood');
 const wood=new T.MeshStandardMaterial({color:'#9a4930',map:woodTex,roughness:.68,bumpMap:woodTex,bumpScale:.018});
 const roofMat=new T.MeshStandardMaterial({color:'#293c3a',roughness:.73,metalness:.12});const cream=new T.MeshStandardMaterial({color:'#e4d6b7',roughness:.8});
 const batches=new Map<T.Material,T.BufferGeometry[]>();
 function batch(g:T.BufferGeometry,m:T.Material,p:T.Vector3,scale=new T.Vector3(1,1,1),q=new T.Quaternion()){g.applyMatrix4(new T.Matrix4().compose(p,q,scale));const list=batches.get(m)||[];list.push(g);batches.set(m,list);}
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material=wood){batch(new T.BoxGeometry(w,h,d),m,new T.Vector3(x,y,z));}
 function branch(a:T.Vector3,b:T.Vector3,ra:number,rb:number,m:T.Material=bark){const delta=b.clone().sub(a),length=delta.length(),g=new T.CylinderGeometry(rb,ra,length,ra>.1?12:7);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(.12,2*Math.PI*ra),uv.getY(i)*length);batch(g,m,a.clone().add(b).multiplyScalar(.5),undefined,new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));}
 const rockBase=new T.IcosahedronGeometry(1,2);const pa=rockBase.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),d=1+.10*Math.sin(x*4.3+y*2.8)*Math.sin(z*5.1+x*2.4)+.035*Math.sin(x*16+z*11);pa.setXYZ(i,x*d,y*d,z*d);}rockBase.computeVertexNormals();
 const ground=new T.Mesh(new T.PlaneGeometry(170,170,1,1),soil);ground.rotation.x=-Math.PI/2;ground.position.y=-1.8;ground.receiveShadow=true;root.add(ground);
 // A sloping bed is visible through the surface; its rim rises into the garden.
 const floorG=new T.PlaneGeometry(21,17,100,80);floorG.rotateX(-Math.PI/2);const pos=floorG.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),rad=Math.sqrt(x*x/100+z*z/56.25);pos.setY(i,-1.65+Math.pow(Math.min(rad,1.15),5)*1.85+.045*Math.sin(x*2.8+z)*Math.cos(z*2));}const floorIndices:number[]=[];for(let i=0;i<floorG.index!.count;i+=3){const ids=[floorG.index!.getX(i),floorG.index!.getX(i+1),floorG.index!.getX(i+2)];const x=ids.reduce((a,j)=>a+pos.getX(j),0)/3,z=ids.reduce((a,j)=>a+pos.getZ(j),0)/3;if(x*x/109+z*z/62<1)floorIndices.push(...ids);}floorG.setIndex(floorIndices);floorG.computeVertexNormals();const bedUV=floorG.attributes.uv;for(let i=0;i<pos.count;i++)bedUV.setXY(i,pos.getX(i)*.6,pos.getZ(i)*.6);const bedMaterial=underwaterLight(soil.clone());bedMaterial.color.set('#a6afa0');const floor=new T.Mesh(floorG,bedMaterial);floor.receiveShadow=true;root.add(floor);
 const grassMat=soil.clone();grassMat.color.set('#527b32');const outside=new T.RingGeometry(1,8,100,1);outside.rotateX(-Math.PI/2);outside.scale(10.5,1,8);const lawn=new T.Mesh(outside,grassMat);const lawnUV=outside.attributes.uv,lawnP=outside.attributes.position;for(let i=0;i<lawnP.count;i++)lawnUV.setXY(i,lawnP.getX(i)*.42,lawnP.getZ(i)*.42);lawn.position.y=.25;lawn.receiveShadow=true;root.add(lawn);
 for(let i=0;i<102;i++){const a=i/102*tau,x=Math.cos(a)*10.1,z=Math.sin(a)*7.6;batch(rockBase.clone(),stone,new T.Vector3(x,.08+r()*.18,z),new T.Vector3(.5+r()*.28,.36+r()*.32,.42+r()*.35),new T.Quaternion().setFromEuler(new T.Euler(r(),a,r()*.2)));}
 for(let i=0;i<140;i++){const a=r()*tau,rad=Math.sqrt(r())*.92;const x=Math.cos(a)*9.5*rad,z=Math.sin(a)*6.7*rad;batch(rockBase.clone(),stone,new T.Vector3(x,-1.55+Math.pow(rad,5)*1.5,z),new T.Vector3(.035+r()*.13,.03+r()*.065,.04+r()*.1));}
 for(const [x,z,s] of [[5.7,2.3,1.25],[-6.3,-1.7,1.1],[8,-3.6,1.4],[-8,4.5,.8]]){batch(rockBase.clone(),stone,new T.Vector3(x,-.4,z),new T.Vector3(s,s*1.2,s*.8));batch(rockBase.clone(),stone,new T.Vector3(x+.45,.12,z+.1),new T.Vector3(s*.65,s*.38,s*.5));}
 // Arched red cedar bridge: boards and rails follow exactly the same curve.
 const arch=(x:number)=>.52+1.28*(1-x*x/18.5);const bridgeZ=-5.7;
 for(let i=0;i<46;i++){const x=-4.3+i*8.6/45;const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.atan(-2*1.28*x/18.5));batch(new T.BoxGeometry(.205,.13,2),wood,new T.Vector3(x,arch(x),bridgeZ),undefined,q);}
 for(const z of [bridgeZ-1.03,bridgeZ+1.03]){
  for(let i=0;i<=16;i++){const x=-4.25+i*8.5/16;box(.105,1.08,.105,x,arch(x)+.5,z);box(.18,.09,.18,x,arch(x)+1.08,z);}
  for(const lift of [.16,.62,1.05]){const points=Array.from({length:36},(_,i)=>{const x=-4.4+i*8.8/35;return new T.Vector3(x,arch(x)+lift,z)});batch(new T.TubeGeometry(new T.CatmullRomCurve3(points),64,lift===1.05?.085:.045,6,false),wood,new T.Vector3());}
  for(const x of [-3,3])box(.21,2.4,.21,x,.25,z);
 }
 // Open pavilion beyond the bridge, with curled ceramic eaves.
 box(4.6,.26,3.5,0,.5,-11.3,stone);box(4.25,.12,3.2,0,.7,-11.3,wood);
 for(const x of [-1.8,1.8])for(const z of [-12.6,-10]){box(.19,3.1,.19,x,2.1,z);box(.35,.15,.35,x,.87,z);}
 for(const z of [-12.6,-10])box(4.2,.25,.16,0,3.42,z);for(const x of [-1.8,1.8])box(.16,.25,3,x,3.42,-11.3);
 box(3.5,1.4,.09,0,1.8,-12.6,cream);for(let i=0;i<19;i++)box(.045,1.4,.12,-1.7+i*3.4/18,1.8,-12.5,wood);
 function roof(y:number,size:number){const g=new T.PlaneGeometry(size,size*.83,32,28);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),d=Math.max(Math.abs(x)/(size*.5),Math.abs(z)/(size*.415));p.setY(i,y+1.05*(1-d)+.3*Math.pow(d,7));p.setZ(i,z-11.3);}g.computeVertexNormals();const m=new T.Mesh(g,roofMat);m.material.side=T.DoubleSide;m.castShadow=true;root.add(m);
 for(const side of [-1,1]){const pts=Array.from({length:22},(_,i)=>{const x=-size/2+i*size/21;const d=Math.max(Math.abs(x)/(size*.5),1);return new T.Vector3(x,y+.3*Math.pow(d,7),-11.3+side*size*.415)});batch(new T.TubeGeometry(new T.CatmullRomCurve3(pts),22,.06,5),wood,new T.Vector3());}}
 roof(3.55,5.4);roof(4.65,3.0);branch(new T.Vector3(0,4.9,-11.3),new T.Vector3(0,6,-11.3),.12,.025,roofMat);
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
 for(let i=0;i<16;i++){const a=-Math.PI*.92+i/15*Math.PI*.83;tree(Math.cos(a)*23,Math.sin(a)*22-5,7+r()*5,['#45633d','#5f7850','#77925c']);}
 for(let i=0;i<50;i++){scatter(new T.Vector3(-27+r()*54,.7+r()*1.1,-17-r()*12),100,1.25,['#395d35','#536f3c','#70854e'],.23);}
 // Dense irregular shoreline gardens, with open foreground windows onto the koi.
 for(let i=0;i<60;i++){const a=i/60*tau,x=Math.cos(a)*(11.2+r()*2.8),z=Math.sin(a)*(8.4+r()*2.5);if(z>5&&Math.abs(x)<6)continue;scatter(new T.Vector3(x,.65+r()*.5,z),100,.6+r()*.4,['#3b6138','#5e803e','#8a9d4a'],.22);}
 const reedMat=new T.MeshStandardMaterial({color:'#607a3d',roughness:1});
 for(let i=0;i<230;i++){const a=r()*tau;if(a>.3&&a<2.8&&r()<.7)continue;const x=Math.cos(a)*(9.1+r()*.8),z=Math.sin(a)*(6.6+r()*.7),h=.7+r()*1.7;branch(new T.Vector3(x,-.2,z),new T.Vector3(x+(r()-.5)*.35,h,z),.016,.007,reedMat);if(i%3===0)batch(new T.CylinderGeometry(.04,.035,.3,5),bark,new T.Vector3(x,h+.08,z));}
 for(let i=0;i<38;i++){const x=-13+r()*26,z=-15-r()*10,h=6+r()*6;branch(new T.Vector3(x,.2,z),new T.Vector3(x+.3,h,z),.055,.027,reedMat);for(let j=0;j<3;j++)scatter(new T.Vector3(x+.3,h*.6+j*h*.15,z),26,.9,['#547744','#73935d'],.23);}
 for(let i=0;i<16;i++){const a=i/16*tau;const x=Math.cos(a)*11.7,z=Math.sin(a)*9;if(z>5&&Math.abs(x)<6)continue;scatter(new T.Vector3(x,.65,z),200,.6,['#aa8fc2','#c1b0d5','#d2c8d9'],.075);}
 const bladeG=new T.BufferGeometry();bladeG.setAttribute('position',new T.Float32BufferAttribute([-.018,0,0,.018,0,0,-.017,.14,.012,.017,.14,.012,-.012,.28,.044,.012,.28,.044,.008,.40,.105],3));bladeG.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);bladeG.computeVertexNormals();
 const grassM=detailFoliage(new T.MeshStandardMaterial({color:'#d2e6b7',roughness:.92,envMapIntensity:.10,side:T.DoubleSide}),true);
 const grass=new T.InstancedMesh(bladeG,grassM,78000);
 for(let i=0;i<78000;i++){const a=r()*tau,rad=1.012+Math.pow(r(),1.75)*1.75,x=Math.cos(a)*10.5*rad,z=Math.sin(a)*8*rad,patch=.5+.5*Math.sin(x*.82+Math.sin(z*.54))*Math.cos(z*.71);
 dummy.position.set(x,.26,z);dummy.rotation.set((r()-.5)*.3,r()*tau,(r()-.5)*.5);dummy.scale.set(.95+r()*.60,(.42+r()*.68)*(.85+patch*.4),.8+r()*.6);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new T.Color().setHSL(.245+r()*.065,.43+r()*.25,.25+patch*.10+r()*.08));}grass.receiveShadow=true;root.add(grass);
 const foliage=new T.InstancedMesh(leafG,leafMat,leaves.length);for(let i=0;i<leaves.length;i++){foliage.setMatrixAt(i,leaves[i]!);foliage.setColorAt(i,colors[i]!);}foliage.castShadow=true;foliage.receiveShadow=true;root.add(foliage);
 for(const [m,geometries] of batches){const merged=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g),false);if(!merged)throw Error('Garden geometry could not be assembled');
 // Preserve cylindrical bark UVs; stone uses its own triplanar projection.
 const mesh=new T.Mesh(merged,m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
 const meadow=createMeadow(root);rockBase.dispose();return {root,leaves:leaves.length,meadow:{...meadow,grass:grass.count}};
}
