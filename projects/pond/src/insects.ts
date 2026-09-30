// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,tau} from './shared';
import {createStriders} from './striders';
import {createMonarchs} from './monarch';

export async function createInsects(scene:T.Scene,pads:T.Group[]){
 const monarchs=await createMonarchs(scene,pads);
 const random=rng(489),sphere=new T.SphereGeometry(1,8,6),dark=new T.MeshStandardMaterial({color:'#242b20',roughness:.65});
 function ellipsoid(parent:T.Group,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){const mesh=new T.Mesh(sphere,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
 const wingMaterial=new T.MeshStandardMaterial({color:'#cfe8dc',transparent:true,opacity:.32,roughness:.48,side:T.DoubleSide,depthWrite:false});
 const dragonflies=Array.from({length:5},(_,i)=>{
  const root=new T.Group();root.scale.setScalar(.62);scene.add(root);const parts:T.BufferGeometry[]=[];
  // A segmented needle abdomen, compact thorax and two small compound eyes.
  for(let j=0;j<9;j++){const g=sphere.clone();g.scale(.0058-j*.0003,.006-j*.0003,.016);g.translate(0,0,.025+j*.025);parts.push(g);}
  const abdomen=new T.Mesh(mergeGeometries(parts)!,new T.MeshStandardMaterial({color:i%2?'#4b828b':'#9b523a',roughness:.53}));parts.forEach(g=>g.dispose());root.add(abdomen);
  ellipsoid(root,dark,0,0,0,.012,.014,.025);for(const side of [-1,1])ellipsoid(root,dark,side*.011,.006,-.025,.010,.009,.008);
  const wings:T.Group[]=[];
  for(const side of [-1,1])for(const z of [-.011,.017]){
   const pivot=new T.Group();pivot.position.z=z;root.add(pivot);wings.push(pivot);
   const wing=new T.Mesh(new T.CircleGeometry(1,14).rotateX(-Math.PI/2),wingMaterial);wing.scale.set(.115,1,.019);wing.position.x=side*.113;pivot.add(wing);
  }
  return {root,wings,phase:random()*tau};
 });
 // Painted wings retain a scalloped silhouette and fine dark veins, rather than flat discs.
 const butterflyPalettes=[['#ed9834','#ffe3a0'],['#2478ca','#8ee6ef'],['#8e55bb','#dfb3ef'],['#fff0cc','#fffdf2'],['#ca5545','#ffb895'],['#d9b62f','#fff39a'],['#427e65','#a8d9a3']] as const;
 const wingMaps=butterflyPalettes.map(([base,light])=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
  const color=ctx.createLinearGradient(0,128,256,128);color.addColorStop(0,light);color.addColorStop(.6,base);color.addColorStop(1,'#29313a');ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
  ctx.strokeStyle='#30303a';ctx.lineWidth=12;ctx.strokeRect(0,0,256,256);
  for(let j=0;j<8;j++){ctx.beginPath();ctx.moveTo(0,130);ctx.quadraticCurveTo(110,100+j*9,256,j*36);ctx.lineWidth=2.4;ctx.stroke();}
  for(let j=0;j<9;j++){ctx.fillStyle=light;ctx.beginPath();ctx.arc(233,18+j*27,4,0,tau);ctx.fill();}
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
 });
 const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.1,.08,.20,.26,.31,.17);shape.bezierCurveTo(.38,.08,.30,-.02,.20,-.025);shape.bezierCurveTo(.34,-.20,.17,-.26,.065,-.11);shape.lineTo(0,0);
 const butterflyWing=new T.ShapeGeometry(shape,18);const uv=butterflyWing.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/.38,(uv.getY(i)+.26)/.52);butterflyWing.rotateX(-Math.PI/2);
 const butterflies=Array.from({length:7},(_,i)=>{
  const root=new T.Group();scene.add(root);root.scale.setScalar(.26+random()*.06);ellipsoid(root,dark,0,0,0,.015,.018,.10);
  const material=new T.MeshStandardMaterial({map:wingMaps[i]!,color:'#ffffff',side:T.DoubleSide,roughness:.85});
  const wings=[-1,1].map(side=>{const pivot=new T.Group();root.add(pivot);const mesh=new T.Mesh(butterflyWing,material);mesh.scale.x=side;pivot.add(mesh);return pivot;});
  const antenna=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,-.06,-.034,.04,-.14,0,0,-.06,.034,.04,-.14],3)),new T.LineBasicMaterial({color:'#38352b'}));root.add(antenna);
  return {root,wings,phase:random()*tau,cx:(random()-.5)*11,cz:(random()-.5)*7};
 });
 const striders=createStriders(scene);
 return {counts:{dragonflies:dragonflies.length,butterflies:butterflies.length+monarchs.count,monarchs:monarchs.count,striders:striders.count},diagnostics:striders.diagnostics,monarchDiagnostics:monarchs.diagnostics,update(dt:number,time:number,breeze:number){
  monarchs.update(time,breeze);
  dragonflies.forEach(({root,wings,phase},i)=>{
   const a=time*(.22+i*.013)+phase;root.position.set(Math.sin(a)*5,.55+Math.sin(time*.9+phase)*.19+Math.sin(time*.3+phase)*.17,Math.sin(a*.73+phase)*3);root.rotation.y=Math.atan2(-Math.cos(a),-Math.cos(a*.73+phase)*.44);
   wings.forEach((w,j)=>w.rotation.z=Math.sin(time*96+phase+(j%2)*.6)*(j<2?1:-1)*.22);
  });
  butterflies.forEach(({root,wings,phase,cx,cz})=>{
   const t=time*.32+phase;root.position.set(cx+Math.sin(t)*1.6,1.15+Math.sin(time*.75+phase)*.58+Math.cos(t*1.7)*.25,cz+Math.sin(t*.7+phase)*1.2);
   root.rotation.set(Math.sin(time*1.1+phase)*.16,Math.atan2(-Math.cos(t),-Math.cos(t*.7+phase)*.52),Math.sin(t*2)*.19);
   wings.forEach((w,i)=>w.rotation.z=(i===0?1:-1)*(.32+Math.sin(time*(10+phase*.4)+phase)*.85));
  });
  striders.update(dt,time,breeze);
 }};
}
