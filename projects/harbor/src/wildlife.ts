// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {BoatPose} from './navigation';
import {fishJump,schoolMotion,whaleMotion,WHALE_SCALE,WHALE_PERIOD} from './wildlife-motion.ts';

import {createWhaleWater} from './whale-water.ts';

function paint(geo:T.BufferGeometry,color:T.ColorRepresentation,wing=0){
 geo.deleteAttribute('uv');const n=geo.attributes.position.count,c=new T.Color(color),colors=new Float32Array(n*3);
 for(let i=0;i<n;i++)colors.set([c.r,c.g,c.b],i*3);
 geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setAttribute('wing',new T.BufferAttribute(new Float32Array(n).fill(wing),1));return geo;
}
function polygon(points:number[],indices:number[]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function birdGeometry(){
 const parts=[paint(new T.SphereGeometry(1,10,8).scale(.13,.14,.34),0xd9e0dc),paint(new T.SphereGeometry(1,8,6).scale(.105,.105,.13).translate(0,.09,.30),0xe8e8d9),paint(new T.ConeGeometry(.035,.19,6).rotateX(Math.PI/2).translate(0,.08,.47),0xcbb66a)];
 for(const side of [-1,1]){
  const g=polygon([.1*side,0,.08,.38*side,.05,.02,.78*side,.025,-.14,1.05*side,-.025,-.4,.7*side,0,-.34,.35*side,0,-.23,.1*side,0,-.12],[0,1,5,0,5,6,1,2,4,1,4,5,2,3,4]);paint(g,0xcdd5d1,1);
  const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>.76)c.setXYZ(i,.075,.1,.11);parts.push(g);
 }
 parts.push(paint(polygon([0,0,-.25,-.14,0,-.54,.14,0,-.54],[0,1,2]),0xcfd6d1));
 const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geo;
}
function fishGeometry(){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];const rings=13,sides=10;
 for(let j=0;j<=rings;j++){
  const u=j/rings,z=-.45+u*.95,r=Math.pow(Math.sin(u*Math.PI),.85)*.135;
  for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,y=Math.cos(a)*r;positions.push(Math.sin(a)*r*.65,y,z);const c=new T.Color(y>0?0x456f72:0xb0cfbe);colors.push(c.r,c.g,c.b);if(j<rings){const k=j*sides+i,n=j*sides+(i+1)%sides;indices.push(k,k+sides,n,n,k+sides,n+sides);}}
 }
 const add=(p:number[],ids:number[])=>{const offset=positions.length/3;positions.push(...p);for(let i=0;i<p.length/3;i++)colors.push(.27,.43,.41);indices.push(...ids.map(i=>i+offset));};
 add([0,0,-.40,0,.22,-.72,0,.045,-.62,0,-.22,-.72],[0,1,2,0,2,3]);
 add([0,.1,-.15,0,.29,-.19,0,.1,.2],[0,1,2]);
 for(const s of [-1,1])add([s*.08,0,.14,s*.25,-.06,-.09,s*.07,-.05,-.17],[0,1,2]);
 const geo=polygon(positions,indices);geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));return geo;
}
function whaleGeometry(){
 const p:number[]=[],c:number[]=[],indices:number[]=[];const profile=[[0,.015],[.08,.2],[.25,.45],[.48,.93],[.68,1.05],[.88,.82],[.97,.55],[1,.02]];
 for(let j=0;j<=40;j++){
  const u=j/40;let a=profile[0],b=profile[1];for(let k=1;k<profile.length;k++)if(u>=profile[k-1][0]){a=profile[k-1];b=profile[k];if(u<=b[0])break;}
  const t=T.MathUtils.clamp((u-a[0])/(b[0]-a[0]),0,1),r=T.MathUtils.lerp(a[1],b[1],t*t*(3-2*t));
  for(let i=0;i<32;i++){const angle=i/32*Math.PI*2,y=Math.cos(angle)*r*.79,x=Math.sin(angle)*r,z=-4+u*7.4;p.push(x,y,z);
   const col=new T.Color(y<-.2?0x718486:0x304c53),mottle=.86+.12*Math.sin(x*32+z*9)*Math.sin(y*38-z*14);col.multiplyScalar(mottle);c.push(col.r,col.g,col.b);
   if(j<40){const k=j*32+i,n=j*32+(i+1)%32;indices.push(k,k+32,n,n,k+32,n+32);}
  }
 }
 const geo=polygon(p,indices);geo.setAttribute('color',new T.Float32BufferAttribute(c,3));return geo;
}
function whaleFin(side:number){
 const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(1,-.1,2.7,-1,2.5,-1.7);shape.bezierCurveTo(2,-1.5,.7,-.7,0,-.25);
 return new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelThickness:.04,bevelSize:.05,bevelSegments:2,steps:1,curveSegments:10}).rotateX(Math.PI/2).scale(side,1,1);
}
export function createWildlife(scene:T.Scene,waterMesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>){
 const water=waterMesh.material;
 // Transparent water must precede mist/foam or it paints over particles with no depth writes.
 waterMesh.renderOrder=-10;
 const deepMat=new T.MeshBasicMaterial({fog:false});deepMat.color=water.uniforms.waterColor.value as T.Color;
 const deep=new T.Mesh(new T.PlaneGeometry(1500,1500),deepMat);deep.rotation.x=-Math.PI/2;deep.position.y=-3.5;deep.name='UnderwaterTint';scene.add(deep);
 const clock={value:0},dummy=new T.Object3D();dummy.rotation.order='YXZ';
 const birdGeo=birdGeometry();birdGeo.setAttribute('seed',new T.InstancedBufferAttribute(Float32Array.from({length:18},(_,i)=>i*1.71),1));
 const birdMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.8,side:T.DoubleSide});
 birdMat.onBeforeCompile=s=>{
  s.uniforms.lifeTime=clock;s.vertexShader='uniform float lifeTime;attribute float seed;attribute float wing;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   float beat=sin(lifeTime*(4.4+fract(seed)) + seed)*smoothstep(-.5,.6,sin(lifeTime*.43+seed))*.65+.09;
   float angle=sign(position.x)*beat*wing;
   objectNormal.xy=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*objectNormal.xy;`);
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   if(wing>.5){float hinge=sign(position.x)*.1;transformed.x-=hinge;transformed.xy=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*transformed.xy;transformed.x+=hinge;}`);
 };
 const gulls=new T.InstancedMesh(birdGeo,birdMat,18);gulls.name='HarborGulls';gulls.frustumCulled=false;gulls.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(gulls);
 const fishGeo=fishGeometry(),fishCount=60;fishGeo.setAttribute('seed',new T.InstancedBufferAttribute(Float32Array.from({length:fishCount},(_,i)=>i*2.399),1));
 const fishMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.28,side:T.DoubleSide});
 fishMat.onBeforeCompile=s=>{s.uniforms.lifeTime=clock;s.vertexShader='uniform float lifeTime;attribute float seed;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  float tail=1.-smoothstep(-.65,.15,position.z);transformed.x+=sin(lifeTime*11.+seed+position.z*6.)*tail*tail*.14;`);};
 const fish=new T.InstancedMesh(fishGeo,fishMat,fishCount);fish.name='HarborShoals';fish.frustumCulled=false;fish.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(fish);
 // Only small moving patches reveal fish; the rest of the existing water stays opaque.
 const schools=Array.from({length:3},()=>new T.Vector3()),whaleWindow=new T.Vector4();water.uniforms.wildlifeSchools={value:schools};water.uniforms.wildlifeWhale={value:whaleWindow};
 const anchor='gl_FragColor = vec4( outgoingLight, alpha );';if(!water.fragmentShader.includes(anchor))throw new Error('Water shader fish-window anchor changed');
 water.fragmentShader='uniform vec3 wildlifeSchools[3];uniform vec4 wildlifeWhale;\n'+water.fragmentShader;
 water.fragmentShader=water.fragmentShader.replace(anchor,`${anchor}
  float shoalWindow=0.;for(int i=0;i<3;i++){shoalWindow=max(shoalWindow,1.-smoothstep(1.7,4.2,length(worldPosition.xz-wildlifeSchools[i].xy)));}
  float whaleWindow=(1.-smoothstep(7.,13.,length(worldPosition.xz-wildlifeWhale.xy)))*wildlifeWhale.z;
  gl_FragColor.a*=1.-max(shoalWindow*.25,whaleWindow*.27);`);water.transparent=true;water.needsUpdate=true;
 const whale=new T.Group();whale.name='Humpback';whale.rotation.order='YXZ';whale.scale.setScalar(WHALE_SCALE);scene.add(whale);
 const skin=new T.MeshStandardMaterial({vertexColors:true,roughness:.38,metalness:.05,side:T.DoubleSide}),finMat=new T.MeshStandardMaterial({color:0x334c52,roughness:.3,side:T.DoubleSide});
 whale.add(new T.Mesh(whaleGeometry(),skin));
 const tail=new T.Group();tail.name='WhaleFlukes';tail.position.set(0,-.02,-3.9);whale.add(tail);
 const flukes=new T.Shape();flukes.moveTo(0,0);flukes.bezierCurveTo(-.7,.2,-1.8,-.05,-2.1,-.65);flukes.bezierCurveTo(-1.7,-.75,-.7,-.6,0,-.95);flukes.bezierCurveTo(.7,-.6,1.7,-.75,2.1,-.65);flukes.bezierCurveTo(1.8,-.05,.7,.2,0,0);
 const tailMesh=new T.Mesh(new T.ExtrudeGeometry(flukes,{depth:.11,bevelEnabled:true,bevelThickness:.04,bevelSize:.06,bevelSegments:2,curveSegments:12}).rotateX(Math.PI/2),finMat);tail.add(tailMesh);
 const fins=[-1,1].map(side=>{const fin=new T.Mesh(whaleFin(side),finMat);fin.position.set(side*.8,-.3,.8);whale.add(fin);return fin;});
 const dorsalShape=new T.Shape();dorsalShape.moveTo(-.48,-.12);dorsalShape.bezierCurveTo(-.2,.01,-.19,.30,.12,.44);dorsalShape.bezierCurveTo(.07,.19,.10,.10,.48,-.09);dorsalShape.lineTo(-.48,-.12);
 const dorsal=new T.Mesh(new T.ExtrudeGeometry(dorsalShape,{depth:.065,bevelEnabled:true,bevelThickness:.025,bevelSize:.03,bevelSegments:2,curveSegments:10}).rotateY(Math.PI/2),finMat);dorsal.position.set(0,.38,-1.5);whale.add(dorsal);
 const blowhole=new T.Mesh(new T.SphereGeometry(1,10,6),new T.MeshStandardMaterial({color:0x142c32,roughness:.28}));blowhole.scale.set(.13,.022,.20);blowhole.position.set(0,.77,1.6);whale.add(blowhole);
 for(const side of [-1,1]){const eye=new T.Mesh(new T.SphereGeometry(.038,8,6),new T.MeshStandardMaterial({color:0x081518,roughness:.12}));eye.position.set(side*.74,.05,2.55);whale.add(eye);}
 const whaleWater=createWhaleWater(scene,water);
 const rippleGeo=new T.RingGeometry(.82,1,48);const rippleAlpha=new Float32Array(8);rippleGeo.setAttribute('strength',new T.InstancedBufferAttribute(rippleAlpha,1));
 const rippleMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,vertexShader:'attribute float strength;varying float a;varying vec2 p;void main(){a=strength;p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying float a;varying vec2 p;void main(){float r=length(p);float soft=smoothstep(.82,.89,r)*(1.-smoothstep(.92,1.,r));float broken=.25+.75*smoothstep(-.5,.8,sin(atan(p.y,p.x)*13.+r*41.));gl_FragColor=vec4(.58,.73,.69,a*soft*broken);}' });
 const ripples=new T.InstancedMesh(rippleGeo,rippleMat,8);ripples.name='WildlifeRipples';ripples.frustumCulled=false;scene.add(ripples);
 const schoolStates=[schoolMotion(0,0),schoolMotion(0,1),schoolMotion(0,2)];
 const whalePoint=new T.Vector3(),blowPoint=new T.Vector3(),flukePoint=new T.Vector3();let lastWhale=whaleMotion(0),jumping=0;
 function ripple(index:number,x:number,z:number,size:number,opacity:number){dummy.position.set(x,.075,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(size,size*.75,1);dummy.updateMatrix();ripples.setMatrixAt(index,dummy.matrix);rippleAlpha[index]=opacity;}
 function update(time:number,boat:BoatPose){
  clock.value=time;
  for(let i=0;i<18;i++){
   const near=i<6,a=time*(near?.14:.04)+i*2.399,rx=near?15:28+i*.6,rz=near?6:18;
   dummy.position.set((near?4:0)+Math.cos(a)*rx,near?3.5+Math.sin(a*1.7+i)*1.8:12+i*.35+Math.sin(a*2)*2,(near?19:-21)+Math.sin(a)*rz);
   dummy.rotation.set(Math.sin(a*1.7+i)*.08,Math.atan2(-Math.sin(a)*rx,Math.cos(a)*rz),Math.sin(a+i)*.16);dummy.scale.setScalar(near?.72:.62);dummy.updateMatrix();gulls.setMatrixAt(i,dummy.matrix);
  }
  gulls.instanceMatrix.needsUpdate=true;jumping=0;
  for(let g=0;g<3;g++){const p=schoolMotion(time,g);schoolStates[g]=p;schools[g].set(p.x,p.z,3);}
  for(let i=0;i<fishCount;i++){
   const group=Math.floor(i/20),p=schoolStates[group],phase=i*2.399,spread=.7+(i%7)*.25;
   let x=p.x+Math.cos(phase+time*.34)*spread,z=p.z+Math.sin(phase+time*.34)*spread*.6;
   const dx=x-boat.x,dz=z-boat.z,d=Math.hypot(dx,dz),avoid=(1-T.MathUtils.smoothstep(d,1,4))*1.7;
   if(d>.001){x+=dx/d*avoid;z+=dz/d*avoid;}
   const jump=fishJump(time,i);if(jump.height>.3)jumping++;
   dummy.position.set(x,-.22-(i%5)*.055+jump.height,z);dummy.rotation.set(-Math.atan2(jump.slope,2)*.7,p.heading+Math.sin(phase+time*.34)*.25,Math.sin(time*4+phase)*.07);dummy.scale.setScalar(.55+(i%4)*.09);dummy.updateMatrix();fish.setMatrixAt(i,dummy.matrix);
   if(i%20<2){const slot=group*2+i%20;ripple(slot,x,z,jump.splash>=0?.25+jump.splash*1.7:0,jump.splash>=0?Math.sin(jump.splash*Math.PI)*.18:0);}
  }
  fish.instanceMatrix.needsUpdate=true;
  const w=whaleMotion(time);lastWhale=w;whaleWindow.set(w.x,w.z,w.visible?1:0,0);whalePoint.set(w.x,1.6,w.z);whale.position.set(w.x,w.y,w.z);whale.rotation.set(w.pitch,w.heading,Math.sin(time*.22)*.018);whale.visible=w.visible;
  tail.rotation.x=Math.sin(time*1.4)*.08+w.tailLift;fins.forEach((fin,i)=>{fin.rotation.z=(i?1:-1)*(.12+Math.sin(time*.7)*.12);});
  whale.updateMatrixWorld(true);blowPoint.set(0,.8,1.6).applyMatrix4(whale.matrixWorld);
  flukePoint.set(0,0,-.6);tail.localToWorld(flukePoint);
  whaleWater.update(time,w,blowPoint,flukePoint);
  const breath=w.spout;ripple(6,blowPoint.x,blowPoint.z,breath>=0?1+breath*3:0,breath>=0?Math.sin(breath*Math.PI)*.055:0);
  const dive=T.MathUtils.clamp((w.phase-17)/7,0,1);ripple(7,flukePoint.x,flukePoint.z,dive>0&&dive<1?1+dive*3:0,dive>0&&dive<1?Math.sin(dive*Math.PI)*.12:0);
  ripples.instanceMatrix.needsUpdate=true;rippleGeo.attributes.strength.needsUpdate=true;
 }
 return {update,whalePoint,status:()=>lastWhale.phase<5?'A HUMPBACK RISES FROM THE DEEP':lastWhale.spout>=0?'A HUMPBACK TAKES A BREATH':lastWhale.phase>=18&&lastWhale.phase<32?'FLUKES UP · DIVING BELOW THE SURFACE':lastWhale.visible?'A QUIET PASSAGE THROUGH THE BAY':`BELOW THE SURFACE · RETURNS IN ${Math.ceil(WHALE_PERIOD-lastWhale.phase)}s`,diagnostics:()=>({gulls:18,fish:fishCount,jumping,whale:{...lastWhale}})};
}
