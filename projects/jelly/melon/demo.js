import {GrabContacts} from '../jelly-shared/grabs.js';
// SPDX-License-Identifier: GPL-3.0-only
// © 2026 KnowAI. Original interactive watermelon cutting study.
import * as THREE from 'three';
import {nativeMode,nativeActive,connectNative} from '../jelly-shared/native.js';
import {SoftBody,createSkin} from '../citrus/physics.js';
import {watermelon,makeMesh,cutPolygon,localCut,transfer} from './geometry.js';
import {separatePieces} from './collision.js';
import {PieceActivity} from './activity.js';
import {updateNormals} from '../jelly-shared/surface.js';
const $=s=>document.querySelector(s),canvas=$('#scene'),status=$('#status');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){status.textContent='3D 화면을 열 수 없습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요.';console.error(error);}
if(renderer)start();
function start(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#f3f1e8');
 const camera=new THREE.PerspectiveCamera(35,1,.1,40);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.91;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const studio=new THREE.Scene();studio.background=new THREE.Color('#92897c');
 for(const[x,y,z,w,h,power]of[[-3,5,2,3,5,4],[3,4,-2,2,4,2],[-2,4,-6,1,4,4]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power*.98,power*.93),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);studio.add(m);}
 const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.02,.1,30);scene.environment=env.texture;pmrem.dispose();for(const m of studio.children){m.geometry.dispose();m.material.dispose();}
 scene.add(new THREE.HemisphereLight(0xffffff,0xaca88d,.8));
 const key=new THREE.DirectionalLight(0xfff6e8,2.3);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5});key.shadow.normalBias=.012;scene.add(key);
 const fill=new THREE.DirectionalLight(0xffffff,.6);fill.position.set(4,3,-3);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshBasicMaterial({color:'#f3f1e8',toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.009;scene.add(floor);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.2}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.007;shadow.receiveShadow=true;scene.add(shadow);
 // Global rest coordinates keep the rind only on the original curved edge, including after cuts.
 const flesh={value:new THREE.Color('#eb2943')},seeds={value:[]};
 for(let row=0;row<5;row++)for(let col=0;col<=row;col++){const r=.62+row*.31,a=(col-row/2)*.23+(row%2)*.03;seeds.value.push(new THREE.Vector2(Math.sin(a)*r,-1.15+Math.cos(a)*r));}
 const jellyMaterial=new THREE.MeshPhysicalMaterial({roughness:.14,transmission:.27,thickness:.48,ior:1.38,attenuationColor:'#f56b77',attenuationDistance:2.4,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1.15});
 jellyMaterial.onBeforeCompile=shader=>{
  shader.uniforms.flesh=flesh;shader.uniforms.seeds=seeds;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 restPosition;varying vec3 melonRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nmelonRest=restPosition;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 melonRest;uniform vec3 flesh;uniform vec2 seeds[15];
   float hashMelon(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   vec2 q=melonRest.xz-vec2(0.,-1.15);float r=length(q),a=atan(q.x,q.y);
   float stripe=smoothstep(-.2,.25,sin(a*64.+sin(melonRest.y*22.+a*8.)*.62+sin(a*155.)*.2));
   vec3 peel=mix(vec3(.012,.082,.020),vec3(.070,.235,.042),stripe);
   vec3 pulp=flesh*(.97+.025*hashMelon(melonRest.xz*160.));
   vec3 colour=mix(pulp,vec3(.88,.95,.64),smoothstep(2.35,2.42,r));
   colour=mix(colour,peel,smoothstep(2.53,2.58,r));
   float seed=0.;for(int i=0;i<15;i++){vec2 d=melonRest.xz-seeds[i];float angle=atan(seeds[i].x,seeds[i].y+1.15);mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));d=rot*d;float ellipse=length(d/vec2(.031,.066));seed=max(seed,1.-smoothstep(.76,1.04,ellipse));}
   seed*=smoothstep(.41,.49,melonRest.y)*(1.-smoothstep(2.22,2.35,r));
   colour=mix(colour,vec3(.022,.012,.009),seed*.95);diffuseColor.rgb*=colour;
  `);
 };
 const contacts=new GrabContacts(canvas);
 const pieces=[],activities=new WeakMap();
 const contactOptions={isSleeping:body=>activities.get(body).sleeping,onContact:(a,b)=>{activities.get(a).wake();activities.get(b).wake();}};
 let referenceVolume=0,firmness=.42,damping=.35,meshVisible=false,mode='hand',pointer=null,cutStart=null,cutEnd=null;
 let raf=0,last=0,accumulator=0,steps=0,frameCount=0,physicsMS=0,surfaceMS=0,renderMS=0,lost=false,feedbackUntil=0;
 function createPiece(poly,parent=null){
  const body=new SoftBody(makeMesh(poly));body.firmness=firmness;body.damping=damping;if(parent)transfer(parent,body);
  const skin=createSkin(body.mesh,2),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(skin.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('restPosition',new THREE.BufferAttribute(skin.rest,3));geometry.setIndex(skin.indices);geometry.setAttribute('normal',new THREE.BufferAttribute(updateNormals(skin.positions,skin.indices,new Float32Array(skin.positions.length)),3).setUsage(THREE.DynamicDrawUsage));
  const mesh=new THREE.Mesh(geometry,jellyMaterial);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);
  const linePositions=new Float32Array(body.edges.length*6),lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(linePositions,3).setUsage(THREE.DynamicDrawUsage));const wire=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:'#5d382c',transparent:true,opacity:.34,depthTest:false}));wire.visible=meshVisible;wire.frustumCulled=false;wire.renderOrder=4;scene.add(wire);
  const activity=new PieceActivity(body);activities.set(body,activity);
  const piece={body,skin,mesh,wire,linePositions,activity};mesh.userData.piece=piece;return piece;
 }
 function disposePiece(p){scene.remove(p.mesh,p.wire);p.mesh.geometry.dispose();p.wire.geometry.dispose();p.wire.material.dispose();}
 function reset(){release();for(const p of pieces)disposePiece(p);pieces.length=0;pieces.push(createPiece(watermelon()));referenceVolume=pieces[0].body.restVolume;feedback('');wake();}
 // The knife follows the cut stroke. Blade width is parallel to the cut, with its edge on the surface.
 const knife=new THREE.Group(),steel=new THREE.MeshStandardMaterial({color:'#dbe4e5',metalness:.82,roughness:.21}),wood=new THREE.MeshStandardMaterial({color:'#382719',roughness:.55});
 const blade=new THREE.Mesh(new THREE.BoxGeometry(1.25,.56,.035),steel);blade.position.set(.28,.34,0);knife.add(blade);const edge=new THREE.Mesh(new THREE.BoxGeometry(1.25,.04,.012),new THREE.MeshStandardMaterial({color:'#f5ffff',metalness:.95,roughness:.13}));edge.position.set(.28,.055,0);knife.add(edge);const handle=new THREE.Mesh(new THREE.BoxGeometry(.7,.19,.14),wood);handle.position.set(-.7,.52,0);knife.add(handle);for(const x of[-.89,-.69,-.49]){const rivet=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),steel);rivet.position.set(x,.52,.074);knife.add(rivet);}knife.visible=false;for(const c of knife.children)c.castShadow=true;scene.add(knife);
 const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),cutLine=new THREE.Line(lineGeometry,new THREE.LineDashedMaterial({color:'#78826b',dashSize:.08,gapSize:.055,transparent:true,opacity:.6,depthTest:false}));cutLine.visible=false;cutLine.renderOrder=5;scene.add(cutLine);
 const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.3),hitPoint=new THREE.Vector3(),normal=new THREE.Vector3();
 function ray(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(ndc,camera);}
 function groundPoint(e){ray(e);return raycaster.ray.intersectPlane(ground,hitPoint)?[hitPoint.x,hitPoint.z]:null;}
 function release(){contacts.clear();const old=pointer;pointer=null;if(old!==null&&canvas.hasPointerCapture(old))canvas.releasePointerCapture(old);cutStart=null;cutEnd=null;cutLine.visible=false;knife.visible=false;}
 function feedback(message){$('#feedback').textContent=message;$('#feedback').hidden=!message;feedbackUntil=performance.now()+2600;}
 function drawKnife(p){knife.position.set(p[0],.28,p[1]);knife.visible=true;if(cutStart){const dx=p[0]-cutStart[0],dz=p[1]-cutStart[1];if(Math.hypot(dx,dz)>.02)knife.rotation.y=-Math.atan2(dz,dx);const a=lineGeometry.attributes.position.array;a.set([cutStart[0],.59,cutStart[1],p[0],.59,p[1]]);lineGeometry.attributes.position.needsUpdate=true;cutLine.computeLineDistances();cutLine.visible=true;}wake();}
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  // Knife strokes remain single-owner; another finger must not cancel the cut.
  if(mode==='knife'){if(pointer!==null)return;cutStart=groundPoint(e);if(!cutStart)return;cutEnd=[...cutStart];pointer=e.pointerId;canvas.setPointerCapture(pointer);drawKnife(cutStart);return;}
  ray(e);for(const p of pieces)p.mesh.geometry.computeBoundingSphere();const hit=raycaster.intersectObjects(pieces.map(p=>p.mesh),false)[0];if(!hit)return;
  const piece=hit.object.userData.piece;camera.getWorldDirection(normal);const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point);
  if(contacts.begin(e.pointerId,piece.body,hit.point.toArray(),plane)){piece.activity.wake();wake();}
 });
 canvas.addEventListener('pointermove',e=>{
  if(mode==='knife'){if(pointer!==null&&pointer!==e.pointerId)return;if(pointer===null&&e.pointerType!=='mouse')return;const p=groundPoint(e);if(!p)return;if(pointer!==null)cutEnd=p;drawKnife(p);return;}
  const contact=contacts.get(e.pointerId);if(!contact)return;ray(e);if(raycaster.ray.intersectPlane(contact.plane,hitPoint))contact.body.moveGrab(hitPoint.toArray(),e.pointerId);wake();
 });
 canvas.addEventListener('pointerleave',()=>{if(pointer===null){knife.visible=false;wake();}});
 canvas.addEventListener('pointerup',e=>{
  if(contacts.end(e.pointerId)){wake();return;}
  if(e.pointerId!==pointer)return;if(mode==='knife'&&cutStart&&cutEnd)performCut(cutStart,cutEnd);release();wake();
 });
 for(const event of['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(contacts.end(e.pointerId))wake();else if(e.pointerId===pointer){release();wake();}});
 function performCut(a,b){
  if(Math.hypot(b[0]-a[0],b[1]-a[1])<.18){feedback('수박을 가로질러 선을 그어 주세요.');return;}if(pieces.length>=12){feedback('조각이 충분히 작아졌어요. 처음부터 다시 잘라 볼까요?');return;}
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=[dz/len,-dx/len];let count=0;
  for(const piece of[...pieces]){
   if(pieces.length>=12)break;
   // Reject strokes whose finite segment never reaches this piece's projected footprint.
   const p=piece.body.p;let min=Infinity,max=-Infinity,sideMin=Infinity,sideMax=-Infinity;for(let i=0;i<p.length;i+=3){const along=((p[i]-a[0])*dx+(p[i+2]-a[1])*dz)/(len*len),side=(p[i]-a[0])*n[0]+(p[i+2]-a[1])*n[1];min=Math.min(min,along);max=Math.max(max,along);sideMin=Math.min(sideMin,side);sideMax=Math.max(sideMax,side);}if(max<0||min>1||sideMin>=0||sideMax<=0)continue;
   const local=localCut(piece.body,a,b),polys=local&&cutPolygon(piece.body.mesh.polygon,...local);if(!polys)continue;
   let children=[];try{for(const poly of polys)children.push(createPiece(poly,piece.body));}catch(error){for(const c of children)disposePiece(c);feedback('이 위치는 자르기 어려워요. 다른 방향으로 잘라 주세요.');console.error(error);continue;}
   for(const child of children){let side=0;for(let i=0;i<child.body.p.length;i+=3)side+=(child.body.p[i]-a[0])*n[0]+(child.body.p[i+2]-a[1])*n[1];const sign=side>=0?1:-1;for(let i=0;i<child.body.p.length;i+=3){child.body.p[i]+=n[0]*sign*.06;child.body.p[i+2]+=n[1]*sign*.06;child.body.v[i]+=n[0]*sign*.3;child.body.v[i+1]+=.22;child.body.v[i+2]+=n[1]*sign*.3;}child.body.previous.set(child.body.p);}
   pieces.splice(pieces.indexOf(piece),1,...children);disposePiece(piece);count++;
  }
  feedback(count?'':'조각의 양쪽을 가로질러 잘라 주세요.');
 }
 function setMode(next){release();mode=next;$('#hand').setAttribute('aria-pressed',String(next==='hand'));$('#knife').setAttribute('aria-pressed',String(next==='knife'));canvas.classList.toggle('cutting',next==='knife');$('#hint').innerHTML=next==='knife'?'수박을 가로질러 선을 그어 보세요.<br>자른 조각은 손으로 만질 수 있습니다.':'손으로 잡아당기고, 놓아 보세요.<br>자른 조각도 하나씩 움직일 수 있습니다.';wake();}
 $('#hand').onclick=()=>setMode('hand');$('#knife').onclick=()=>setMode('knife');$('#reset').onclick=reset;
 $('#nudge').onclick=()=>{for(const p of pieces){p.activity.wake();p.body.nudge();}wake();};
 $('#mesh').onclick=e=>{meshVisible=!meshVisible;for(const p of pieces){p.wire.visible=meshVisible;p.activity.dirty=true;}e.currentTarget.setAttribute('aria-pressed',String(meshVisible));wake();};
 $('#firmness').oninput=e=>{firmness=Number(e.target.value)/100;for(const p of pieces){p.body.firmness=firmness;p.activity.wake();}$('#firmness-value').value=firmness<.3?'아주 말랑하게':firmness<.7?'말랑하게':'탱탱하게';wake();};
 $('#damping').oninput=e=>{damping=Number(e.target.value)/100;for(const p of pieces){p.body.damping=damping;p.activity.wake();}$('#damping-value').value=damping<.4?'천천히':damping<.75?'적당하게':'빠르게';wake();};
 for(const button of document.querySelectorAll('[data-flavor]'))button.onclick=()=>{const color={red:'#eb2943',gold:'#ffbd35',pink:'#ed7196'}[button.dataset.flavor];flesh.value.set(color);jellyMaterial.attenuationColor.set(color);for(const b of document.querySelectorAll('[data-flavor]'))b.setAttribute('aria-pressed',String(b===button));wake();};
 canvas.onkeydown=e=>{if(e.key==='Escape'){release();wake();}if(e.code==='Space'){e.preventDefault();for(const p of pieces){p.activity.wake();p.body.nudge();}wake();}};
 function resize(){release();const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<700?42:35;camera.position.set(w<700?0:1.2,w<700?8.8:5.8,w<700?11:7.3);camera.lookAt(0,w<700?-.16:.2,.25);if(nativeMode){camera.fov=38;const visibleHeight=Math.max(5.8,4.8/camera.aspect),distance=visibleHeight/(2*Math.tan(camera.fov*Math.PI/360));camera.position.set(0,distance*.64+.15,distance*.77);camera.lookAt(0,.15,0);}camera.updateProjectionMatrix();wake();}
 new ResizeObserver(resize).observe(canvas);
 function surfaces(){for(const p of pieces){if(!p.activity.dirty)continue;p.activity.dirty=false;p.skin.update(p.body.p);p.mesh.geometry.attributes.position.needsUpdate=true;updateNormals(p.skin.positions,p.skin.indices,p.mesh.geometry.attributes.normal.array);p.mesh.geometry.attributes.normal.needsUpdate=true;if(meshVisible){let j=0;for(const[a,b]of p.body.edges)for(const id of[a,b])for(let k=0;k<3;k++)p.linePositions[j++]=p.body.p[id*3+k];p.wire.geometry.attributes.position.needsUpdate=true;}}}
 function metrics(){let volume=0,motion=0,inverted=0,tets=0;for(const p of pieces){const m=p.body.metrics();volume+=m.volume*p.body.restVolume;motion=Math.max(motion,m.motion);inverted+=m.inverted;tets+=p.body.tets.length;}return{pieces:pieces.length,volume:volume/referenceVolume,motion,inverted,tets};}
 function frame(now){
  raf=0;if(document.hidden||lost||!nativeActive())return;
  const elapsed=last?Math.min((now-last)/1000,.04):1/60;last=now;accumulator+=elapsed;
  let t=performance.now();
  while(accumulator>=1/120){
   for(const p of pieces)p.activity.step(1/120);
   if(++steps%2===0&&pieces.length>1)separatePieces(pieces.map(p=>p.body),contactOptions);
   accumulator-=1/120;
  }
  physicsMS=.9*physicsMS+.1*(performance.now()-t);t=performance.now();
  surfaces();surfaceMS=.9*surfaceMS+.1*(performance.now()-t);t=performance.now();
  renderer.render(scene,camera);renderMS=.9*renderMS+.1*(performance.now()-t);
  // Native controls hide these diagnostics; avoid volume scans and hidden DOM writes there.
  if(frameCount++%10===0&&!nativeMode){const m=metrics();$('#pieces').textContent=m.pieces;$('#volume').innerHTML=`${(m.volume*100).toFixed(1)}<span>%</span>`;$('#motion').textContent=m.motion.toFixed(2);$('#diagnostics').textContent=`${m.tets}개 사면체 · 뒤집힘 ${m.inverted} · 물리 ${physicsMS.toFixed(1)}ms · 표면 ${surfaceMS.toFixed(1)}ms · 렌더 제출 ${renderMS.toFixed(1)}ms (GPU 시간 아님)`;}
  if(feedbackUntil&&now>feedbackUntil){$('#feedback').hidden=true;feedbackUntil=0;}
  if(pointer!==null||contacts.size>0||pieces.some(p=>!p.activity.sleeping)||!$('#feedback').hidden)raf=requestAnimationFrame(frame);
  else{last=0;accumulator=0;}
 }
 function wake(){if(!raf&&!document.hidden&&!lost&&nativeActive()){last=0;raf=requestAnimationFrame(frame);}}
 function suspend(){release();cancelAnimationFrame(raf);raf=0;last=0;accumulator=0;}
 document.addEventListener('visibilitychange',()=>document.hidden?suspend():wake());window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',wake);window.addEventListener('blur',()=>{release();wake();});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;suspend();status.hidden=false;status.textContent='3D 화면을 복구하고 있습니다.';});canvas.addEventListener('webglcontextrestored',()=>{lost=false;status.hidden=true;wake();});
 window.melonDiagnostics=()=>({...metrics(),held:pointer!==null||contacts.size>0,contacts:contacts.size,mode,sleepingPieces:pieces.filter(p=>p.activity.sleeping).length,physicsMS,surfaceMS,renderSubmitMS:renderMS,frameCount});
 status.hidden=true;reset();resize();
 connectNative({suspend,wake,command(action){
  release();
  if(action==='reset') reset();
  if(action==='hand'||action==='knife') setMode(action);
  if(['red','gold','pink'].includes(action)) document.querySelector(`[data-flavor="${action}"]`).click();
 }});
}
