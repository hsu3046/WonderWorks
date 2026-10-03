// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
// Original geometry; art direction informed by Sourany Phomhome's Koi Pond Garden.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,tau,uTime} from './shared';
import {hydrangeaBeds} from './hydrangeas';
import {createMapleLeaf,addMapleVeins} from './maple-leaf';

type Kind='broad'|'maple'|'cherry'|'pine';
type Batch={geometry:T.BufferGeometry;matrices:T.Matrix4[];colors:T.Color[];material:T.MeshStandardMaterial};
const windCode=`vec3 anchor=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 float weight=uv.y*uv.y;
 float gust=sin(uPlantTime*1.15+anchor.x*.42+anchor.z*.31);
 transformed.x+=weight*(gust+.35*sin(uPlantTime*2.1+anchor.z))*.035;
 transformed.y+=weight*sin(uPlantTime*1.7+anchor.x*1.3)*.015;
 transformed.z+=weight*cos(uPlantTime*.83+anchor.z*.71)*.025;`;
function windMaterial(material:T.MeshStandardMaterial){
 material.onBeforeCompile=shader=>{
  shader.uniforms.uPlantTime=uTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uPlantTime;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\n'+windCode);
 };
 // UVs also drive wind on untextured foliage.
 material.defines={...material.defines,USE_UV:''};
 material.customProgramCacheKey=()=> 'pond-rooted-foliage-v1';
 return material;
}
function depthMaterial(map:T.Texture|null,alphaTest:number){
 const material=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map,alphaTest,side:T.DoubleSide});
 material.defines={...material.defines,USE_UV:''};
 material.onBeforeCompile=shader=>{shader.uniforms.uPlantTime=uTime;shader.vertexShader=shader.vertexShader
  .replace('#include <common>','#include <common>\nuniform float uPlantTime;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\n'+windCode);};
 material.customProgramCacheKey=()=> 'pond-rooted-foliage-depth-v1';return material;
}
function geometry(vertices:number[],indices:number[],uvs:number[],colors?:number[]){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);
 if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
/** Cupped silhouettes have a raised midrib and a darker attached base. */
function leaf(kind:Kind|'hosta'|'shrub'){
 if(kind==='maple')return createMapleLeaf();
 const p:number[]=[],uv:number[]=[],idx:number[]=[],col:number[]=[];
 if(kind==='cherry'){
  for(let k=0;k<5;k++){
   const a=k*tau/5,n=p.length/3;
   for(const [rad,side,y] of [[0,0,.035],[.19,-.11,.04],[.39,-.075,.005],[.35,0,.014],[.39,.075,.005],[.19,.11,.04]]){
    const x=Math.cos(a)*rad!+Math.sin(a)*side!,z=Math.sin(a)*rad!-Math.cos(a)*side!;
    p.push(x,y!,z);uv.push(x+.5,z+.5);const c=rad!<.1?.62:1;col.push(1,c*.98,c*.93);}
   idx.push(n,n+1,n+2,n,n+2,n+3,n,n+3,n+4,n,n+4,n+5);
  }
 }else if(kind==='pine'){
  for(let k=0;k<7;k++){const a=(k-3)*.24,n=p.length/3,z=k%2*.08;
   p.push(-.013,0,z,.013,0,z,Math.sin(a)*.40,.06,Math.cos(a)*.52+z);uv.push(0,0,1,0,.5,1);col.push(.45,.59,.34,.45,.59,.34,.9,1,.66);idx.push(n,n+1,n+2);}
 }else{
  const segments=kind==='hosta'?10:kind==='shrub'?6:3;
  for(let i=0;i<=segments;i++){const t=i/segments,w=Math.pow(Math.sin(t*Math.PI),kind==='hosta'?.7:.9)*(kind==='hosta'?.34:kind==='shrub'?.36:.29)+.001;
   for(const s of [-1,0,1]){p.push(s*w,Math.sin(t*Math.PI)*(.08+(1-Math.abs(s))*.065),t);uv.push((s+1)/2,t);
    const shade=.65+t*.28+(s===0?.07:0);const rim=kind==='hosta'&&s!==0;
    col.push(rim?1:shade*.86,rim?1:shade,rim?.64:shade*.68);}
   if(i<segments){const n=i*3;idx.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}
  }
 }
 return geometry(p,idx,uv,col);
}
function fernGeometry(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d')!;
 c.strokeStyle='#78994a';c.lineWidth=3;c.beginPath();c.moveTo(128,510);c.lineTo(128,6);c.stroke();
 for(let row=0;row<23;row++){const t=row/23,len=Math.sin(Math.PI*(t*.89+.05))*112*(1-t*.5),y=488-row*20;
  for(const side of [-1,1]){c.fillStyle=row%3===0?'#8cae61':'#668f43';c.beginPath();c.moveTo(128,y+6);c.bezierCurveTo(128+side*len*.4,y+5,128+side*len,y-14,128+side*len,y-25);c.bezierCurveTo(128+side*len*.5,y-15,128+side*10,y-8,128,y);c.fill();}}
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 const p:number[]=[],uv:number[]=[],idx:number[]=[];
 for(let i=0;i<=12;i++){const t=i/12;for(const side of [-1,1]){p.push(side*.25,.78*t-.58*t*t*t,t*.87);uv.push((side+1)/2,t);}if(i<12){const n=i*2;idx.push(n,n+2,n+1,n+1,n+2,n+3);}}
 return {g:geometry(p,idx,uv),map};
}

export function createPlanting(root:T.Group,bark:T.MeshStandardMaterial){
 const random=rng(8241),dummy=new T.Object3D(),branches:T.BufferGeometry[]=[],batches=new Map<string,Batch>();
 const makeBatch=(key:string,g:T.BufferGeometry,material:T.MeshStandardMaterial)=>{const b={geometry:g,matrices:[],colors:[],material:windMaterial(material)};batches.set(key,b);return b;};
 const matte=()=>new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.78,envMapIntensity:.18,side:T.DoubleSide});
 for(const kind of ['broad','maple','cherry','pine'] as const)makeBatch(kind,leaf(kind),matte());
 addMapleVeins(batches.get('maple')!.material);
 const add=(key:string,p:T.Vector3,scale:T.Vector3,color:T.Color,rotation:T.Euler)=>{dummy.position.copy(p);dummy.scale.copy(scale);dummy.rotation.copy(rotation);dummy.updateMatrix();const b=batches.get(key)!;b.matrices.push(dummy.matrix.clone());b.colors.push(color);};
 // Momiji carries its own red-to-gold pigment; avoid multiplying it by old brown paint.
 const palettes:Record<Kind,string[]>={broad:['#46713e','#658344','#76964d','#395e38'],maple:['#ffffff','#fff5eb','#f7ece4','#ffedda'],cherry:['#ffe0e7','#f8ccd9','#f9e8e4','#eab4ca'],pine:['#354f39','#48613e','#5c7547']};
 function limb(points:T.Vector3[],radius:number,end:number){
  const curve=new T.CatmullRomCurve3(points),steps=radius>.18?10:5,radial=radius>.18?10:5;
  const g=new T.TubeGeometry(curve,steps,1,radial,false),p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){const t=uv.getX(i),center=curve.getPointAt(t),rad=T.MathUtils.lerp(radius,end,t);p.setXYZ(i,center.x+(p.getX(i)-center.x)*rad,center.y+(p.getY(i)-center.y)*rad,center.z+(p.getZ(i)-center.z)*rad);uv.setXY(i,uv.getY(i)*radius*6.28,t*curve.getLength());}
  g.computeVertexNormals();branches.push(g);
 }
 const mapleFillRandom=rng(9361);
 function crown(kind:Kind,center:T.Vector3,rx:number,ry:number,rz:number,count:number,size:number){
  const total=count+(kind==='maple'?Math.round(count*.45):0);
  for(let i=0;i<total;i++){
   // Additional maple leaves must not shift the existing tree/garden RNG sequence.
   const sample=i<count?random:mapleFillRandom;
   const a=sample()*tau,v=sample()*2-1,rad=Math.cbrt(sample()),horizontal=Math.sqrt(1-v*v)*rad;
   const p=center.clone().add(new T.Vector3(Math.cos(a)*horizontal*rx,v*rad*ry,Math.sin(a)*horizontal*rz));
   const s=size*(.75+sample()*.5),color=new T.Color(palettes[kind][Math.floor(sample()*palettes[kind].length)]!);
   add(kind,p,new T.Vector3(s,s,s),color,new T.Euler((sample()-.5)*1.7-.18,sample()*tau,(sample()-.5)*1.1));
  }
 }
 function tree(x:number,z:number,h:number,kind:Kind){
  const lean=new T.Vector3(-x,0,-z).normalize().multiplyScalar(kind==='maple'?h*.20:h*.09),base=new T.Vector3(x,.26,z);
  const at=(t:number)=>base.clone().addScaledVector(lean,t*t).add(new T.Vector3(Math.sin(t*4)*h*.027,h*t,Math.sin(t*5)*h*.018));
  limb([at(0),at(.22),at(.52),at(.83)],h*.044,.035);
  const levels=kind==='pine'?7:8;
  for(let j=0;j<levels;j++){
   const t=.34+j/levels*.43,angle=j*2.399+random()*.35,start=at(t),reach=h*(kind==='pine'?.26:.31)*(1-(t-.34)*.9);
   const mid=start.clone().add(new T.Vector3(Math.cos(angle)*reach*.54,kind==='pine'?.02:h*.035,Math.sin(angle)*reach*.54));
   const tip=start.clone().add(new T.Vector3(Math.cos(angle)*reach,h*(kind==='pine'?.018:.085),Math.sin(angle)*reach));
   limb([start,mid,tip],h*.012,.014);
   if(kind==='pine'){crown(kind,tip,.85+h*.04,.23,.8+h*.03,170,.39);continue;}
   for(let k=0;k<3;k++){
    const aa=angle+(k-1)*.7,end=tip.clone().add(new T.Vector3(Math.cos(aa)*h*.15,h*.02,Math.sin(aa)*h*.15));
    limb([mid,tip,end],.033,.005);
    crown(kind,end,h*.14,h*.067,h*.14,kind==='cherry'?95:85,kind==='cherry'?.29:.42);
    if(kind==='cherry'){
     const bottom=end.clone().add(new T.Vector3(Math.cos(aa)*.45,-.9-random()*.65,Math.sin(aa)*.45));
     limb([end,end.clone().lerp(bottom,.55).add(new T.Vector3(.07,0,0)),bottom],.012,.003);
     for(let n=1;n<=5;n++)crown(kind,end.clone().lerp(bottom,n/5),.25,.15,.25,12,.24);
    }
   }
  }
  crown(kind,at(.85),h*.14,h*(kind==='pine'?.03:.06),h*.14,kind==='cherry'?300:230,kind==='cherry'?.29:kind==='pine'?.4:.42);
 }
 // Keep the approved tree anchors and open central view of the timber architecture.
 tree(-8.8,-4.4,7.5,'cherry');tree(9,-4.3,8.1,'maple');
 tree(-15,1,9.5,'broad');tree(15,-.5,10,'pine');tree(6.8,-10.2,8.2,'cherry');
 tree(-13,-9.2,8.8,'pine');tree(-6.8,-15,9.3,'broad');tree(6,-17,10.1,'broad');tree(14,-10,9.2,'broad');

 // Open leafy shrubs replace the opaque textured ellipsoids that read as rocks.
 const clusters:{x:number;z:number;r:number;y:number;ry:number}[]=[];
 const shrubLeaves=leaf('shrub');
 const shrubBatch=makeBatch('shrub',shrubLeaves,matte());
 const shrubWind=shrubBatch.material.onBeforeCompile;
 shrubBatch.material.onBeforeCompile=(shader,renderer)=>{
  shrubWind.call(shrubBatch.material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float midrib=1.-smoothstep(.009,.035,abs(vUv.x-.5));
   float sideVeins=1.-smoothstep(.025,.080,abs(fract(vUv.y*7.-abs(vUv.x-.5)*2.4)-.5));
   diffuseColor.rgb*=.90+.10*midrib+.055*sideVeins;`);
 };
 shrubBatch.material.customProgramCacheKey=()=> 'pond-open-shrub-veins-v1';
 const shrubRandom=rng(592);
 for(let i=0;i<36;i++){
  const a=i/36*tau+.045*Math.sin(i*2.3),x=Math.cos(a)*(11.4+random()*1.3),z=Math.sin(a)*(8.9+random());
  if(z>5&&Math.abs(x)<7||Math.abs(x)<3.3&&z<-7)continue;
  const flowering=hydrangeaBeds.some(b=>(x-b.x)**2+(z-b.z)**2<2.1**2);
  const radius=.65+random()*.48,y=.28+radius*(flowering?.55:.25),ry=radius*(flowering?.95:.60);
  clusters.push({x,z,r:radius,y,ry});
  // Preserve the old placement RNG stream; extra leaves use an independent stream.
  random();random();
  for(let k=0;k<140;k++){
   const az=random()*tau,v=random()*.95,ring=Math.sqrt(1-v*v);
   const point=new T.Vector3(x+Math.cos(az)*ring*radius,y+v*ry*1.06,z+Math.sin(az)*ring*radius*.85);
   const size=.27+random()*.10;
   add('broad',point,new T.Vector3(size,size,size),new T.Color(palettes.broad[k%4]!),new T.Euler(-v*.55,az,(random()-.5)*.9));
  }
  // Branches and individual leaves have gaps, depth and an irregular silhouette.
  for(let branch=0;branch<7;branch++){
   const az=branch*tau/7+shrubRandom()*.3,reach=radius*(.45+shrubRandom()*.35);
   const base=new T.Vector3(x,.27,z),tip=new T.Vector3(x+Math.cos(az)*reach,y+ry*(.52+shrubRandom()*.4),z+Math.sin(az)*reach*.85);
   limb([base,base.clone().lerp(tip,.5).add(new T.Vector3(0,.15,0)),tip],.015,.004);
  }
  for(let k=0;k<360;k++){
   const az=shrubRandom()*tau,v=shrubRandom()*1.7-.7,ring=Math.sqrt(1-v*v),spread=.52+.48*Math.cbrt(shrubRandom());
   const point=new T.Vector3(x+Math.cos(az)*ring*radius*spread,y+v*ry*spread,z+Math.sin(az)*ring*radius*.85*spread);
   const size=.29+shrubRandom()*.19,color=new T.Color(['#3e762f','#56883c','#6c983f','#457732'][k%4]!);
   add('shrub',point,new T.Vector3(size*.92,size,size),color,new T.Euler((shrubRandom()-.5)*1.4,az,(shrubRandom()-.5)*1.2));
  }
 }
 // One interlocking bank beside the gazebo, with crowns at hydrangea height.
 // Shared anchors lift the branches/leaves and attached flowers together.
 const azaleaClusters=[[-8.15,-12.1,.92],[-6.7,-11.75,1.02],[-5.3,-11.25,.86],[-8.15,-10.55,.92],[-6.7,-10.2,.90],[-5.3,-9.7,.94]]
  .map(([x,z,r])=>({x:x!,z:z!,r:r!,y:1.12,ry:.82}));
 const azRandom=rng(1347);
 for(const {x,z,r,y,ry} of azaleaClusters){
  for(let j=0;j<9;j++){
   const a=j*tau/9+azRandom()*.25,reach=r*(.45+azRandom()*.37);
   const base=new T.Vector3(x,.24,z),tip=new T.Vector3(x+Math.cos(a)*reach,y+ry*(.4+azRandom()*.5),z+Math.sin(a)*reach);
   limb([base,base.clone().lerp(tip,.55).add(new T.Vector3(0,.12,0)),tip],.013,.003);
  }
  for(let j=0;j<320;j++){
   const a=azRandom()*tau,v=azRandom()*1.65-.65,ring=Math.sqrt(1-v*v),spread=.65+.35*Math.cbrt(azRandom());
   const at=new T.Vector3(x+Math.cos(a)*ring*r*spread,y+v*ry*spread,z+Math.sin(a)*ring*r*spread);
   const size=.18+azRandom()*.09;
   add('shrub',at,new T.Vector3(size*.72,size,size),new T.Color(['#397332','#52813b','#64913e','#3d6a2b'][j%4]!),new T.Euler((azRandom()-.5)*1.3,a,(azRandom()-.5)*1.2));
  }
 }
 // Retain the random sequence used by the former texture so nearby plants stay put.
 for(let i=0;i<2400*4;i++)random();
 const fern=fernGeometry();makeBatch('fern',fern.g,new T.MeshStandardMaterial({map:fern.map,color:'#a0ba81',alphaTest:.45,side:T.DoubleSide,roughness:.85}));
 makeBatch('hosta',leaf('hosta'),matte());
 const irisP:number[]=[],irisUV:number[]=[],irisI:number[]=[],irisC:number[]=[];
 for(let i=0;i<=8;i++){const t=i/8,w=.022*(1-Math.pow(t,5))+.001;for(const side of [-1,0,1]){irisP.push(side*w,t*.94,t*t*.30+(side===0?-.012:0));irisUV.push((side+1)/2,t);irisC.push(.4+t*.35,.55+t*.4,.22+t*.27);}if(i<8){const n=i*3;irisI.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}}
 makeBatch('iris',geometry(irisP,irisI,irisUV,irisC),matte());
 // Three broad falls and three upright standards read as an iris at close range.
 const petals:T.BufferGeometry[]=[];
 for(let j=0;j<6;j++){const petal=leaf('hosta');petal.scale(j<3?.36:.22,1,j<3?.30:.22);petal.rotateX(j<3?.45:-1.08);petal.rotateY(j%3*tau/3+(j<3?0:.45));petal.translate(0,.89,0);petals.push(petal);}
 const irisFlower=mergeGeometries(petals)!;petals.forEach(g=>g.dispose());makeBatch('iris-flower',irisFlower,matte());
 const stalk=new T.CylinderGeometry(.005,.008,.9,5);stalk.translate(0,.45,0);const stems:T.Matrix4[]=[];
 for(let i=0;i<18;i++){
  const a=.22+i/18*tau,x=Math.cos(a)*10.95,z=Math.sin(a)*8.4;
  if(z>5&&Math.abs(x)<7||Math.abs(x)<3.3&&z<-7)continue;
  const kind=i%3===0?'hosta':'fern',count=kind==='hosta'?9:8;
  for(let j=0;j<count;j++){const s=.65+random()*.4,angle=j/count*tau+random()*.2;
   add(kind,new T.Vector3(x,.27,z),new T.Vector3(s,s,s),new T.Color(kind==='hosta'?'#709354':'#ffffff'),new T.Euler(kind==='hosta'?-.40:0,angle,0));}
  if(i%2===0)continue;
  const ix=x*.96,iz=z*.96;
  for(let k=0;k<3;k++){
   const px=ix+(random()-.5)*.28,pz=iz+(random()-.5)*.28,yaw=random()*tau,s=.8+random()*.32;
   for(let j=-2;j<=2;j++)add('iris',new T.Vector3(px,.26,pz),new T.Vector3(1,s*(1-Math.abs(j)*.1),1),new T.Color('#90a977'),new T.Euler(j*.15,yaw,0));
   add('iris-flower',new T.Vector3(px,.26,pz),new T.Vector3(s,s,s),new T.Color(k%2?'#9c83c4':'#7160aa'),new T.Euler(0,yaw,0));
   dummy.position.set(px,.26,pz);dummy.scale.set(1,s,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();stems.push(dummy.matrix.clone());
  }
 }
 const stalks=new T.InstancedMesh(stalk,new T.MeshStandardMaterial({color:'#557238',roughness:.9}),stems.length);stalks.name='Iris flower stalks';stems.forEach((m,i)=>stalks.setMatrixAt(i,m));stalks.receiveShadow=true;root.add(stalks);
 let leaves=0,triangles=0;
 for(const [key,b] of batches){
  const mesh=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);mesh.name=`Garden planting: ${key}`;
  b.matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,b.colors[i]!);});mesh.receiveShadow=true;
  mesh.castShadow=['broad','maple','cherry','pine','shrub'].includes(key);
  if(mesh.castShadow)mesh.customDepthMaterial=depthMaterial(b.material.map,b.material.alphaTest);
  mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.12;root.add(mesh);leaves+=b.matrices.length;triangles+=(b.geometry.index?.count??0)/3*b.matrices.length;
 }
 const woodGeo=mergeGeometries(branches)!;branches.forEach(g=>g.dispose());const wood=new T.Mesh(woodGeo,bark);wood.name='Species-shaped garden branches';wood.castShadow=wood.receiveShadow=true;root.add(wood);
 triangles+=(woodGeo.index?.count??woodGeo.attributes.position!.count)/3+stalk.index!.count/3*stalks.count;
 return {leaves,clusters,azaleaClusters,triangles,trees:9,shrubs:clusters.length+azaleaClusters.length};
}
