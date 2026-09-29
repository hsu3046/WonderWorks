// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,tau} from './shared';

function leafTextures(){
 const size=512,random=rng(618),color=document.createElement('canvas'),height=document.createElement('canvas');color.width=color.height=height.width=height.height=size;
 const c=color.getContext('2d')!,h=height.getContext('2d')!,pixels=c.createImageData(size,size),bumps=h.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x-256)/256,dy=(y-256)/256,rad=Math.hypot(dx,dy);
  const grain=random()-.5,cloud=Math.sin(x*.031+Math.sin(y*.019)*2)*Math.cos(y*.043)+.5*Math.sin(x*.089+y*.065);
  const edge=T.MathUtils.smoothstep(rad,.84,1),v=cloud*5+grain*7;
  const i=(y*size+x)*4;pixels.data.set([52+v+edge*14,91+v+edge*9,31+v*.45,255],i);const relief=126+cloud*3+grain*8;bumps.data.set([relief,relief,relief,255],i);
 }
 c.putImageData(pixels,0,0);h.putImageData(bumps,0,0);
 // Branching veins follow the leaf radially and taper toward its waxy rim.
 for(let j=0;j<22;j++){
  const a=.10+j/22*(tau-.2),reach=228+random()*17,ex=256+Math.cos(a)*reach,ey=256+Math.sin(a)*reach;
  for(const [ctx,stroke,width] of [[c,'rgba(151,171,79,.48)',1.9],[h,'rgb(163,163,163)',2.4]] as const){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(256,256);ctx.quadraticCurveTo(256+Math.cos(a+.035)*reach*.55,256+Math.sin(a+.035)*reach*.55,ex,ey);ctx.stroke();}
  for(let k=1;k<7;k++)for(const side of [-1,1]){
   const r=reach*(.18+k*.105),angle=a+side*.09;
   for(const ctx of [c,h]){ctx.strokeStyle=ctx===c?'rgba(147,161,74,.25)':'rgb(143,143,143)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(256+Math.cos(a)*r,256+Math.sin(a)*r);ctx.quadraticCurveTo(256+Math.cos(angle)*(r+12),256+Math.sin(angle)*(r+12),256+Math.cos(a+side*.14)*(r+24),256+Math.sin(a+side*.14)*(r+24));ctx.stroke();}
  }
 }
 const map=new T.CanvasTexture(color),bumpMap=new T.CanvasTexture(height);map.colorSpace=T.SRGBColorSpace;map.anisotropy=bumpMap.anisotropy=4;return {map,bumpMap};
}
function petalTexture(){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const c=canvas.getContext('2d')!;
 const gradient=c.createLinearGradient(0,256,0,0);gradient.addColorStop(0,'#fff1cc');gradient.addColorStop(.4,'#fff0ec');gradient.addColorStop(.8,'#efb4cf');gradient.addColorStop(1,'#ce709e');c.fillStyle=gradient;c.fillRect(0,0,128,256);
 c.strokeStyle='rgba(173,83,126,.16)';c.lineWidth=.6;for(let i=0;i<18;i++){c.beginPath();c.moveTo(64+(i-9)*1.4,256);c.quadraticCurveTo(i*7,140,i*7,0);c.stroke();}
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
export function createLilies(scene:T.Scene){
 const r=rng(720),root=new T.Group();scene.add(root);const pads:T.Group[]=[],maps=leafTextures(),petalMap=petalTexture();
 const spots=[[-5.2,2.7,.86],[-6.4,2.3,.64],[-4.3,3.4,.61],[-6,3.8,.82],[4.9,-2,.7],[6,-1.2,.86],[6.4,-2.7,.63],[-2.2,-3.9,.5],[2.8,3.8,.52]];
 spots.forEach(([x,z,size],index)=>{
  const pad=new T.Group();pad.position.set(x!,.055,z!);pad.rotation.y=r()*tau;root.add(pad);pads.push(pad);
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],segments=96,rings=14;
  for(let row=0;row<=rings;row++)for(let j=0;j<=segments;j++){
   const f=row/rings,a=.075+j/segments*(tau-.15),rad=f*size!*(1+.018*Math.sin(a*7+index)*f**4);
   const px=Math.cos(a)*rad,pz=Math.sin(a)*rad,y=-.007*(1-f)+.016*f**5+Math.sin(a*5+index)*.006*f*f;
   positions.push(px,y,pz);uv.push(.5+px/(size!*2.05),.5-pz/(size!*2.05));
   if(row<rings&&j<segments){const k=row*(segments+1)+j;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const material=new T.MeshStandardMaterial({...maps,color:new T.Color().setHSL(.23+r()*.035,.12,.83+r()*.06),bumpScale:.010,roughness:.48,metalness:0,side:T.DoubleSide});
  const leaf=new T.Mesh(g,material);leaf.receiveShadow=true;pad.add(leaf);
  if(index!==2&&index!==5)return;
  const flower=new T.Group();flower.position.set(.02,.025,.02);flower.rotation.y=.3;pad.add(flower);
  // Thin lanceolate surfaces in staggered whorls replace thick ellipsoid petals.
  for(let ring=0;ring<3;ring++){
   const parts:T.BufferGeometry[]=[],count=[16,12,9][ring]!,length=[.35,.27,.18][ring]!,rise=[.14,.23,.27][ring]!;
   for(let j=0;j<count;j++){
    const pos:number[]=[],tex:number[]=[],idx:number[]=[],angle=j/count*tau+ring*.24;
    for(let u=0;u<=20;u++)for(let v=0;v<=8;v++){
     const t=u/20,w=v/4-1,width=Math.pow(Math.sin(Math.PI*t),.8)*[.072,.064,.049][ring]!,rad=.025+t*length;
     const lateral=w*width,y=.025+t*rise+Math.sin(t*Math.PI)*.015+(1-w*w)*Math.sin(t*Math.PI)*.020;
     pos.push(Math.sin(angle)*rad+Math.cos(angle)*lateral,y,Math.cos(angle)*rad-Math.sin(angle)*lateral);tex.push((w+1)/2,t);
     if(u<20&&v<8){const k=u*9+v;idx.push(k,k+9,k+1,k+1,k+9,k+10);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(tex,2));geometry.setIndex(idx);geometry.computeVertexNormals();parts.push(geometry);
   }
   const mesh=new T.Mesh(mergeGeometries(parts)!,new T.MeshStandardMaterial({map:petalMap,color:ring===0?'#efcfdf':'#fff9ee',side:T.DoubleSide,roughness:.58}));parts.forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;flower.add(mesh);
  }
  const stamens:T.BufferGeometry[]=[];
  for(let j=0;j<48;j++){const a=j/48*tau,rad=.035+r()*.025;const g=new T.SphereGeometry(1,5,4);g.scale(.008,.035+r()*.014,.008);g.translate(Math.cos(a)*rad,.15,Math.sin(a)*rad);stamens.push(g);}
  const pollen=new T.Mesh(mergeGeometries(stamens)!,new T.MeshStandardMaterial({color:'#e0af35',roughness:.85}));stamens.forEach(g=>g.dispose());flower.add(pollen);
  const heart=new T.Mesh(new T.SphereGeometry(.037,12,8),new T.MeshStandardMaterial({color:'#bd9c34',roughness:.8}));heart.scale.y=.45;heart.position.y=.13;flower.add(heart);
 });
 return pads;
}
