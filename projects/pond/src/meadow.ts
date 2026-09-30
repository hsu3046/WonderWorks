// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,tau} from './shared';
import {hydrangeaBeds} from './hydrangeas';

/** Rooted yellow flowers, white seed heads and settled petals share instanced batches. */
export function createMeadow(root:T.Group){
 const random=rng(417),dummy=new T.Object3D(),parts:T.BufferGeometry[]=[];
 function colored(g:T.BufferGeometry,color:T.Color){const colors=new Float32Array(g.attributes.position!.count*3);for(let i=0;i<colors.length;i+=3)colors.set([color.r,color.g,color.b],i);g.setAttribute('color',new T.BufferAttribute(colors,3));g.deleteAttribute('uv');parts.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();}
 // Toothed basal rosettes sit below slender leafless flower stems.
 for(let j=0;j<5;j++){
  const vertices:number[]=[],indices:number[]=[];
  for(let k=0;k<=6;k++){const t=k/6,width=k===0||k===6?.002:(k%2?.055:.022)*(1-t*.45);vertices.push(-width,.012+Math.sin(t*Math.PI)*.018,t*.31,0,.025+Math.sin(t*Math.PI)*.020,t*.31,width,.012+Math.sin(t*Math.PI)*.018,t*.31);if(k<6){const n=k*3;indices.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}}
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.rotateY(j*tau/5);g.computeVertexNormals();colored(g,new T.Color('#3e7629'));
 }
 const stem=new T.CylinderGeometry(.004,.006,.48,5);stem.translate(.025,.24,0);colored(stem,new T.Color('#709333'));
 const calyx=new T.SphereGeometry(.025,6,3);calyx.scale(1,.45,1);calyx.translate(.025,.48,0);colored(calyx,new T.Color('#4c722a'));
 const seedStalkGeometry=mergeGeometries(parts,false)!;
 // Several close rings of narrow ray florets make a dandelion, without broad daisy petals.
 for(let ring=0;ring<3;ring++)for(let j=0;j<22;j++){
  const angle=j*tau/22+ring*.13,inner=.008+ring*.012,outer=.032+ring*.024,w=.0055;
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([-w,.495+ring*.002,inner,w,.495+ring*.002,inner,-w*.55,.494+ring*.007,outer,w*.55,.494+ring*.007,outer],3));g.setIndex([0,2,1,1,2,3]);g.rotateY(angle);g.translate(.025,0,0);g.computeVertexNormals();colored(g,new T.Color().setHSL(.135+random()*.018,.99,.27+random()*.06));
 }
 const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());
 const plantMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,side:T.DoubleSide});
 const flowers=new T.InstancedMesh(geometry,plantMaterial,715);flowers.name='Yellow meadow dandelions';
 const seedStalks=new T.InstancedMesh(seedStalkGeometry,plantMaterial,385);seedStalks.name='White dandelion stems';
 // A whole seed head uses one soft filament image, avoiding dark seams between tuft cards.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const ctx=canvas.getContext('2d')!,fuzz=rng(618);
 const glow=ctx.createRadialGradient(128,128,10,128,128,112);
 glow.addColorStop(0,'rgba(255,255,249,.12)');glow.addColorStop(.65,'rgba(255,255,249,.20)');glow.addColorStop(1,'rgba(255,255,249,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,256,256);
 for(let i=0;i<210;i++){
  const a=fuzz()*tau,r=Math.sqrt(fuzz())*103,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;
  ctx.strokeStyle='rgba(255,255,250,.20)';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(128+(x-128)*.14,128+(y-128)*.14);ctx.lineTo(x,y);ctx.stroke();
  for(let j=0;j<7;j++){
   const angle=j/7*tau+fuzz()*.4,len=4+fuzz()*9;
   ctx.strokeStyle=`rgba(255,255,252,${.38+fuzz()*.40})`;ctx.lineWidth=.65+fuzz()*.5;
   ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(angle+.2)*len*.5,y+Math.sin(angle+.2)*len*.5,x+Math.cos(angle)*len,y+Math.sin(angle)*len);ctx.stroke();
  }
 }
 const tuftMap=new T.CanvasTexture(canvas);tuftMap.colorSpace=T.SRGBColorSpace;
 // White filaments transmit ambient light; a single camera-facing card has no faceted self-shadow.
 const puffMaterial=new T.ShaderMaterial({uniforms:{uPuff:{value:tuftMap},...T.UniformsUtils.clone(T.UniformsLib.fog)},transparent:true,depthWrite:false,fog:true,side:T.DoubleSide,
  vertexShader:`#include <common>
   #include <fog_pars_vertex>
   varying vec2 vPuffUV;
   void main(){vPuffUV=uv;vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(.025,.54,0.,1.);
    mvPosition.xy+=position.xy*length(instanceMatrix[0].xyz);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform sampler2D uPuff;varying vec2 vPuffUV;
   #include <fog_pars_fragment>
   void main(){float alpha=texture2D(uPuff,vPuffUV).a;if(alpha<.006)discard;
    gl_FragColor=vec4(.98,.98,.95,alpha*.92);
    #include <colorspace_fragment>
    #include <fog_fragment>
   }`});
 puffMaterial.addEventListener('dispose',()=>tuftMap.dispose());
 const puffGeometry=new T.PlaneGeometry(.22,.22);
 // Shader offsets the card to the stem tip; expand CPU bounds for correct frustum culling.
 puffGeometry.boundingSphere=new T.Sphere(new T.Vector3(.025,.54,0),.16);
 const seedHeads=new T.InstancedMesh(puffGeometry,puffMaterial,385);seedHeads.name='White dandelion seed heads';
 let yellowIndex=0,whiteIndex=0;
 for(let i=0;i<1100;i++){
  let x=12,z=6;
  // Mixed flowering and seed-stage drifts wrap the flowerbeds without growing through the pavilion.
  for(let attempt=0;attempt<64;attempt++){
   // Retry outside the initial drift if it lies entirely inside an excluded bed.
   const angle=attempt<8?(i%21)/21*tau+(random()-.5)*.20:random()*tau;
   const rad=1.035+Math.pow(random(),1.7)*.66;
   const px=Math.cos(angle)*10.5*rad,pz=Math.sin(angle)*8*rad;
   if((Math.abs(px)<3.3&&pz<-8)||hydrangeaBeds.some(b=>(px-b.x)**2+(pz-b.z)**2<.65))continue;
   x=px;z=pz;break;
  }
  dummy.position.set(x,.264,z);dummy.rotation.set((random()-.5)*.12,random()*tau,(random()-.5)*.15);dummy.scale.setScalar(.90+random()*.40);dummy.updateMatrix();
  // 65% yellow and 35% seed-stage, interleaved within every drift at the same existing positions.
  if(i%20<7){seedStalks.setMatrixAt(whiteIndex,dummy.matrix);seedHeads.setMatrixAt(whiteIndex++,dummy.matrix);}
  else flowers.setMatrixAt(yellowIndex++,dummy.matrix);
 }flowers.receiveShadow=seedStalks.receiveShadow=true;root.add(flowers,seedStalks,seedHeads);
 const petal=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,-.5,-.42,.06,0,-.28,.09,.45,0,.05,.30,.28,.08,.45,.42,.05,0,0,.07,.02],3));petal.setIndex([0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0,6]);petal.computeVertexNormals();
 const fallen=new T.InstancedMesh(petal,new T.MeshStandardMaterial({color:'#ffe3e7',roughness:.94,side:T.DoubleSide}),4200);fallen.name='Fallen cherry petals';
 for(let i=0;i<fallen.count;i++){
  let x:number,z:number;
  // Windblown drifts beneath the cherry tree, with a lighter scattering along the shore.
  do{if(i<3200){x=-9.7+(random()+random()-1)*6;z=-4.7+(random()+random()-1)*6;}else{const a=random()*tau,rad=1.015+random()*.40;x=Math.cos(a)*10.5*rad;z=Math.sin(a)*8*rad;}}while(x*x/(10.5*10.5)+z*z/64<1.008);
  dummy.position.set(x,.271+random()*.008,z);dummy.rotation.set((random()-.5)*.22,random()*tau,(random()-.5)*.20);dummy.scale.setScalar(.055+random()*.045);dummy.updateMatrix();fallen.setMatrixAt(i,dummy.matrix);fallen.setColorAt(i,new T.Color().setHSL(.94+random()*.035,.25+random()*.15,.76+random()*.16));
 }fallen.receiveShadow=true;root.add(fallen);
 return {dandelions:flowers.count+seedHeads.count,yellowDandelions:flowers.count,whiteSeedHeads:seedHeads.count,fallenPetals:fallen.count};
}

/** Low tufts give the painted outer meadow a silhouette from ground-level cameras. */
export function createOuterGroundcover(root:T.Group){
 const random=rng(915),vertices:number[]=[],indices:number[]=[],dummy=new T.Object3D();
 for(let blade=0;blade<6;blade++){
  const angle=blade*tau/6,rx=Math.cos(angle),rz=Math.sin(angle),height=.055+random()*.08;
  const base=vertices.length/3,width=.004+random()*.003,reach=.035+random()*.055;
  vertices.push(-rz*width,0,rx*width,rz*width,0,-rx*width,
   rx*reach*.45-rz*width*.6,height*.6,rz*reach*.45+rx*width*.6,
   rx*reach*.45+rz*width*.6,height*.6,rz*reach*.45-rx*width*.6,
   rx*reach,height,rz*reach);
  indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 // Dark root / lighter tip variation keeps tiny blades legible without flat bright wedges.
 const shades:number[]=[];
 for(let i=0;i<vertices.length;i+=3){const t=Math.min(vertices[i+1]!/.13,1),shade=.55+t*.45;shades.push(shade*.86,shade,shade*.72);}
 geometry.setAttribute('color',new T.Float32BufferAttribute(shades,3));
 const material=new T.MeshStandardMaterial({color:'#b4c690',vertexColors:true,roughness:1,envMapIntensity:.08,side:T.DoubleSide});
 const tufts=new T.InstancedMesh(geometry,material,8000);tufts.name='Outer meadow low groundcover';
 for(let i=0;i<tufts.count;i++){
  const angle=random()*tau,radius=Math.sqrt(1.6*1.6+random()*(4.8*4.8-1.6*1.6));
  dummy.position.set(Math.cos(angle)*10.5*radius,.253,Math.sin(angle)*8*radius);
  dummy.rotation.set(0,random()*tau,0);dummy.scale.setScalar(.7+random()*.65);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);
  tufts.setColorAt(i,new T.Color().setHSL(.23+random()*.07,.30+random()*.20,.25+random()*.10));
 }
 tufts.receiveShadow=true;root.add(tufts);return tufts.count;
}
