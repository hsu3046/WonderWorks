import {GrabContacts} from '../jelly-shared/grabs.js';
import {updateNormals} from '../jelly-shared/surface.js';
// SPDX-License-Identifier: GPL-3.0-only
// © 2026 KnowAI. Original citrus surface + CPU XPBD prototype.
import * as THREE from 'three';
import {nativeMode,nativeActive,connectNative} from '../jelly-shared/native.js';
import {SoftBody,createSkin,STEP} from './physics.js';
const $=s=>document.querySelector(s),canvas=$('#scene'),status=$('#status');
let renderer;
try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}
catch(error){status.textContent='이 브라우저에서는 3D 화면을 열 수 없습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요.';console.error(error);}
if(renderer) start();
function start(){
 const body=new SoftBody(),skin=createSkin(body.mesh),scene=new THREE.Scene();scene.background=new THREE.Color('#f3f1e8');
 const camera=new THREE.PerspectiveCamera(35,1,.1,35);camera.position.set(0,6.3,7.9);camera.lookAt(0,.15,0);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor('#f3f1e8');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 // Offline studio environment: broad softbox reflections, no remote HDRI.
 const studio=new THREE.Scene();studio.background=new THREE.Color('#777468');
 const boxes=[];
 for(const [x,y,z,w,h,brightness]of [[-3,5,2,3,5,4],[3,4,-2,2,4,2],[-1.8,4,-6,.9,4,4]]){
  const light=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(brightness,brightness*.97,brightness*.9),side:THREE.DoubleSide}));light.position.set(x,y,z);light.lookAt(0,0,0);studio.add(light);boxes.push(light);
 }
 const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(studio,.02,.1,30);scene.environment=env.texture;pmrem.dispose();for(const m of boxes){m.geometry.dispose();m.material.dispose();}
 scene.add(new THREE.HemisphereLight(0xffffff,0xb2aa82,.65));
 const key=new THREE.DirectionalLight(0xfff4df,2.4);key.position.set(-3,7,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.015;key.shadow.bias=-.00015;key.shadow.radius=4;scene.add(key);
 const fill=new THREE.DirectionalLight(0xffffff,.65);fill.position.set(4,3,-4);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:'#f3f1e8',toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.008;scene.add(floor);
 const shadowFloor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.24}));shadowFloor.rotation.x=-Math.PI/2;shadowFloor.position.y=-.006;shadowFloor.receiveShadow=true;scene.add(shadowFloor);
 const uniforms={flesh:{value:new THREE.Color('#fa6805')},rind:{value:new THREE.Color('#fd9408')},pith:{value:new THREE.Color('#fff3b6')}};
 const material=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.14,metalness:0,transmission:.38,thickness:.43,ior:1.38,attenuationColor:'#ff9d29',attenuationDistance:1.8,clearcoat:1,clearcoatRoughness:.10,envMapIntensity:1.1});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 restPosition; varying vec3 citrusRest;').replace('#include <begin_vertex>','#include <begin_vertex>\ncitrusRest=restPosition;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 citrusRest; uniform vec3 flesh; uniform vec3 rind; uniform vec3 pith;
 float citrusHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float citrusNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(citrusHash(i),citrusHash(i+vec2(1,0)),f.x),mix(citrusHash(i+vec2(0,1)),citrusHash(i+vec2(1,1)),f.x),f.y);}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 vec2 uv=citrusRest.xz;float r=length(uv);float angle=atan(uv.y,uv.x);float sector=angle*10.0/6.2831853;
 float membrane=1.0-smoothstep(.009,.024,abs(fract(sector+.022*sin(r*7.0))-.5)*r);
 float ring=1.0-smoothstep(.024,.046,abs(r-1.407));
 float center=1.0-smoothstep(.06,.115,r);
 float top=smoothstep(.345,.408,citrusRest.y);float bottom=1.0-smoothstep(.07,.12,citrusRest.y);float face=max(top,bottom);
 float cells=citrusNoise(vec2(r*39.0,angle*35.0));float grain=citrusNoise(uv*135.0);
 float segmentLight=.9+.13*sin(floor(sector+.5)*13.1);
 vec3 pulp=flesh*(segmentLight+.12*(cells-.5)+.035*(grain-.5));
 float juiceVeins=(1.0-smoothstep(.022,.085,abs(fract(sector*13.0+sin(r*15.0)*.16)-.5)))*.14;
 pulp=mix(pulp,pith,juiceVeins*smoothstep(.2,.8,r));
 vec3 surface=mix(pulp,rind,smoothstep(1.43,1.49,r));
 surface=mix(surface,pith,max(max(membrane*(1.0-smoothstep(1.35,1.42,r)),ring),center)*.86);
 vec3 edge=rind*(.9+.15*citrusNoise(vec2(angle*48.0,citrusRest.y*180.0)));
 diffuseColor.rgb*=mix(edge,surface,face);
 `);
 };
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(skin.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('restPosition',new THREE.BufferAttribute(skin.rest,3));geometry.setIndex(skin.indices);geometry.setAttribute('normal',new THREE.BufferAttribute(updateNormals(skin.positions,skin.indices,new Float32Array(skin.positions.length)),3).setUsage(THREE.DynamicDrawUsage));
 const jelly=new THREE.Mesh(geometry,material);jelly.castShadow=true;jelly.receiveShadow=true;jelly.frustumCulled=false;scene.add(jelly);
 const wirePositions=new Float32Array(body.edges.length*6),wireGeometry=new THREE.BufferGeometry();wireGeometry.setAttribute('position',new THREE.BufferAttribute(wirePositions,3).setUsage(THREE.DynamicDrawUsage));
 const wire=new THREE.LineSegments(wireGeometry,new THREE.LineBasicMaterial({color:'#586449',transparent:true,opacity:.48,depthTest:false}));wire.visible=false;wire.renderOrder=5;wire.frustumCulled=false;scene.add(wire);
 const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),hitTarget=new THREE.Vector3(),normal=new THREE.Vector3();
 const contacts=new GrabContacts(canvas);
 let last=0,accumulator=0,raf=0,contextLost=false,sleeping=false,settled=0,frameCount=0,physicsMS=0,surfaceMS=0,renderMS=0;
 const screenPoint=e=>{const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(ndc,camera);};
 const stopGrab=()=>{contacts.clear();canvas.classList.remove('held');};
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  screenPoint(e);geometry.computeBoundingSphere();const hit=raycaster.intersectObject(jelly,false)[0];if(!hit)return;
  camera.getWorldDirection(normal);const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point);
  if(contacts.begin(e.pointerId,body,hit.point.toArray(),plane)){canvas.classList.add('held');wake();}
 });
 canvas.addEventListener('pointermove',e=>{const contact=contacts.get(e.pointerId);if(!contact)return;screenPoint(e);if(raycaster.ray.intersectPlane(contact.plane,hitTarget))contact.body.moveGrab(hitTarget.toArray(),e.pointerId);wake();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(contacts.end(e.pointerId)){if(!contacts.size)canvas.classList.remove('held');wake();}});
 canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();body.nudge();wake();}if(e.key==='Escape')stopGrab();});
 $('#nudge').addEventListener('click',()=>{body.nudge();wake();});
 $('#reset').addEventListener('click',()=>{stopGrab();body.reset();wake();});
 $('#mesh').addEventListener('click',e=>{wire.visible=!wire.visible;e.currentTarget.setAttribute('aria-pressed',String(wire.visible));wake();});
 $('#firmness').addEventListener('input',e=>{body.firmness=Number(e.target.value)/100;$('#firmness-value').value=body.firmness<.3?'아주 말랑하게':body.firmness<.7?'말랑하게':'탱탱하게';wake();});
 $('#damping').addEventListener('input',e=>{body.damping=Number(e.target.value)/100;$('#damping-value').value=body.damping<.4?'천천히':body.damping<.75?'적당하게':'빠르게';wake();});
 const palettes={orange:['#fa6805','#fd9408','#fff3b6'],grapefruit:['#f85e3d','#f99b35','#ffe9a9'],lime:['#b6cf31','#8bac19','#f4ffb8']};
 for(const button of document.querySelectorAll('[data-flavor]'))button.addEventListener('click',()=>{const colors=palettes[button.dataset.flavor];uniforms.flesh.value.set(colors[0]);uniforms.rind.value.set(colors[1]);uniforms.pith.value.set(colors[2]);material.attenuationColor.set(colors[1]);for(const b of document.querySelectorAll('[data-flavor]'))b.setAttribute('aria-pressed',String(b===button));wake();});
 function resize(){stopGrab();const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;const mobile=w<=700;camera.position.set(0,mobile?8.4:5.0,mobile?10.5:6.3);camera.lookAt(0,mobile?-.18:.15,0);camera.fov=mobile?42:35;if(nativeMode){camera.fov=38;const visibleHeight=Math.max(5.8,4.8/camera.aspect),distance=visibleHeight/(2*Math.tan(camera.fov*Math.PI/360));camera.position.set(0,distance*.64+.15,distance*.77);camera.lookAt(0,.15,0);}camera.updateProjectionMatrix();wake();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function updateSurface(){skin.update(body.p);geometry.attributes.position.needsUpdate=true;updateNormals(skin.positions,skin.indices,geometry.attributes.normal.array);geometry.attributes.normal.needsUpdate=true;if(wire.visible){let j=0;for(const[a,b]of body.edges)for(const id of[a,b])for(let k=0;k<3;k++)wirePositions[j++]=body.p[id*3+k];wireGeometry.attributes.position.needsUpdate=true;}

 }
 function frame(now){raf=0;if(document.hidden||contextLost||!nativeActive())return;
  const elapsed=last?Math.min((now-last)/1000,.045):1/60;last=now;accumulator+=elapsed;let start=performance.now();
  while(accumulator>=STEP){body.step();accumulator-=STEP;}physicsMS=physicsMS*.92+(performance.now()-start)*.08;
  start=performance.now();updateSurface();surfaceMS=surfaceMS*.92+(performance.now()-start)*.08;start=performance.now();
  renderer.render(scene,camera);renderMS=renderMS*.92+(performance.now()-start)*.08;
  if(frameCount++%12===0&&!nativeMode){const metrics=body.metrics();$('#volume').innerHTML=`${(metrics.volume*100).toFixed(1)}<span>%</span>`;$('#motion').textContent=metrics.motion.toFixed(2);$('#lift').textContent=metrics.lift.toFixed(2);$('#diagnostics').textContent=`${body.p.length/3}개 점 · ${body.tets.length}개 사면체 · 뒤집힘 ${metrics.inverted} · 붕괴 방지 ${metrics.guardedSteps}회 · 최대 국소 부피 오차 ${(metrics.maxVolumeError*100).toFixed(1)}% · 물리 ${physicsMS.toFixed(1)}ms · 표면 ${surfaceMS.toFixed(1)}ms · 렌더 제출 ${renderMS.toFixed(1)}ms (GPU 시간 아님)`;}
  let speed2=0;for(let i=0;i<body.v.length;i++)speed2+=body.v[i]*body.v[i];
  if(!body.grab&&Math.sqrt(speed2/(body.v.length/3))<.004)settled+=elapsed;else settled=0;
  if(settled<1.5){raf=requestAnimationFrame(frame);}else{sleeping=true;last=0;accumulator=0;}
 }
 function wake(){settled=0;sleeping=false;if(!raf&&!document.hidden&&!contextLost&&nativeActive()){last=0;raf=requestAnimationFrame(frame);}}
 function suspend(){stopGrab();cancelAnimationFrame(raf);raf=0;last=0;accumulator=0;}
 document.addEventListener('visibilitychange',()=>document.hidden?suspend():wake());window.addEventListener('blur',stopGrab);window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',wake);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;suspend();status.hidden=false;status.textContent='3D 화면을 복구하고 있습니다.';});
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;status.hidden=true;wake();});
 // Read-only diagnostics for repeatable tests; inputs continue through real UI events.
 window.citrusDiagnostics=()=>({...body.metrics(),nodes:body.p.length/3,tets:body.tets.length,held:contacts.size>0,contacts:contacts.size,sleeping,physicsMS,surfaceMS,renderSubmitMS:renderMS,frameCount,center:[...Array(3)].map((_,k)=>body.p.filter((_,i)=>i%3===k).reduce((a,b)=>a+b,0)/(body.p.length/3))});
 status.hidden=true;resize();
 connectNative({suspend,wake,command(action){
  stopGrab();
  if(action==='reset') $('#reset').click();
  if(action==='nudge') $('#nudge').click();
  if(['orange','grapefruit','lime'].includes(action)) document.querySelector(`[data-flavor="${action}"]`).click();
 }});
}
