// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironment,weather } from './environment';
import type { Weather } from './environment';
import { addLandscape } from './landscape';
import { createWildlife } from './wildlife';
import { loadHarbor } from './models';
import { createNavigation,speedModes } from './navigation';
const el=<E extends HTMLElement>(id:string)=>{const e=document.getElementById(id);if(!e)throw new Error(`Missing ${id}`);return e as E;};
const preview=new URLSearchParams(location.search).has('preview');if(preview)document.body.classList.add('preview');
if(location.port==='4177')el<HTMLAnchorElement>('back').href='http://127.0.0.1:4175/#collection';
const canvas=el<HTMLCanvasElement>('world'),loading=el('loading');
type CameraMode='overview'|'drift'|'pier'|'wildlife';
let renderer:T.WebGLRenderer|undefined;
async function start(){
 renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});const gpu=renderer;
 gpu.toneMapping=T.ACESFilmicToneMapping;gpu.toneMappingExposure=weather.sunset.exposure;gpu.outputColorSpace=T.SRGBColorSpace;gpu.shadowMap.enabled=true;gpu.shadowMap.type=T.PCFSoftShadowMap;gpu.shadowMap.autoUpdate=false;gpu.info.autoReset=false;
 const scene=new T.Scene();scene.matrixWorldAutoUpdate=false;const camera=new T.PerspectiveCamera(44,1,.15,700);camera.position.set(22,12,29);
 const controls=new OrbitControls(camera,canvas);controls.target.set(-1,3,-2);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.485;controls.minDistance=4;controls.maxDistance=125;controls.enablePan=false;controls.update();
 const environment=createEnvironment(scene);addLandscape(scene);const wildlife=createWildlife(scene,environment.water);
 const models=await loadHarbor(scene,text=>{el('load-label').textContent=text;},environment.water.material);
 const composer=new EffectComposer(gpu);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new T.Vector2(800,600),.3,.55,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());
 let raf=0,last=0,time=0,frames=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,previewActive=!preview,manual=false,mode:CameraMode='overview',preset:Weather='sunset',wind=.35,haze=.45,glow=.7,lost=false;
 const navigation=createNavigation(),keys=new Set<string>(),pointers=new Map<number,string>();
 const previousBoat=new T.Vector3(navigation.pose.x,.16,navigation.pose.z),boatDelta=new T.Vector3();
 let width=0,height=0,dpr=0;const pos=new T.Vector3(),target=new T.Vector3(),wildlifeOffset=new T.Vector3(19,10.5,24);
 function clearInput(){keys.clear();pointers.clear();document.querySelectorAll('[data-helm]').forEach(b=>b.classList.remove('held'));}
 function held(code:string){if(keys.has(code))return true;for(const value of pointers.values())if(value===code)return true;return false;}
 function helmInput(){return {throttle:Number(held('KeyW'))-Number(held('KeyS')),rudder:Number(held('KeyA'))-Number(held('KeyD'))};}
 const helmSpeed=el('boat-speed'),helmHeading=el('boat-heading'),helmGear=el('speed-mode'),helmState=el('helm-state');
 function writeText(node:HTMLElement,text:string){if(node.textContent!==text)node.textContent=text;}
 function updateHelm(){const p=navigation.pose;writeText(helmSpeed,(Math.abs(p.speed)*1.94384).toFixed(1));writeText(helmHeading,String(Math.round(((180-p.heading*180/Math.PI)%360+360)%360)%360).padStart(3,'0')+'°');writeText(helmGear,speedModes[navigation.gear].name+' · Q');writeText(helmState,navigation.piloted?'YOU HAVE THE HELM':'WASD TO TAKE THE HELM');}
 function takeHelm(){if(!active()||!el('settings').hidden)return false;if(mode!=='drift')setMode('drift');navigation.takeHelm();updateHelm();return true;}

 const pier=new T.CatmullRomCurve3([new T.Vector3(6.65,2.55,7),new T.Vector3(6.65,2.65,3.7),new T.Vector3(3,2.55,3.8),new T.Vector3(-3.3,2.55,3.8)]);
 const active=()=>!paused&&!document.hidden&&previewActive&&!lost;
 function resize(){const w=innerWidth,h=innerHeight,r=Math.min(devicePixelRatio,1.65,Math.sqrt(2400000/(w*h)));if(w===width&&h===height&&r===dpr)return;width=w;height=h;dpr=r;gpu.setPixelRatio(r);gpu.setSize(w,h,false);composer.setPixelRatio(r);composer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<.8?58:44;camera.updateProjectionMatrix();if((mode==='overview'||mode==='wildlife')&&!manual)cameraStep(0,true);}
 function cameraStep(dt:number,instant=false){
  if(mode==='drift'&&manual){camera.position.add(boatDelta);controls.target.add(boatDelta);controls.update();return;}
  if(manual)return;
  if(mode==='overview'){const a=.58+Math.sin(time*.035)*.12;const radius=width/height<.8?43:32;pos.set(Math.sin(a)*radius,10+Math.sin(time*.03)*.65,Math.cos(a)*radius);target.set(-1,3,-2);}
  else if(mode==='drift'){const a=navigation.pose.heading;pos.set(models.boatPoint.x-Math.sin(a)*9,models.boatPoint.y+4.2,models.boatPoint.z-Math.cos(a)*9);target.copy(models.boatPoint);target.y+=.5;}
  else if(mode==='wildlife'){target.copy(wildlife.whalePoint);pos.copy(wildlifeOffset).multiplyScalar(width/height<.8?1.4:1).add(target);}
  else {const progress=(Math.sin(time*.035-Math.PI*.5)+1)*.5;pier.getPoint(progress,pos);target.set(-.5,2.7,1.8);}
  const k=instant?1:1-Math.exp(-dt*1.4);camera.position.lerp(pos,k);controls.target.lerp(target,k);controls.update();
 }
 function draw(dt:number){resize();navigation.update(active()?dt:0,mode==='drift'?helmInput():{throttle:0,rudder:0});models.update(time,wind,navigation.pose);boatDelta.copy(models.boatPoint).sub(previousBoat);previousBoat.copy(models.boatPoint);models.updateWake(time,navigation.pose);updateHelm();wildlife.update(time,navigation.pose);if(mode==='wildlife'&&!manual){const message=wildlife.status();if(el('camera-hint').textContent!==message)el('camera-hint').textContent=message;}environment.update(time,camera);cameraStep(active()?dt:0);if(frames===0||frames%120===0)gpu.shadowMap.needsUpdate=true;gpu.info.reset();scene.updateMatrixWorld();composer.render();frames++;}
 function frame(now:number){raf=0;if(lost||document.hidden)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(active())time+=dt;draw(dt);if(active()&&!raf)raf=requestAnimationFrame(frame);}
 function invalidate(){if(!lost&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
 function syncLoop(){cancelAnimationFrame(raf);raf=0;last=0;if(active())invalidate();}
 function press(selector:string,value:string,key:'camera'|'weather'){document.querySelectorAll<HTMLButtonElement>(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===value)));}
 function setMode(value:CameraMode){clearInput();mode=value;manual=false;document.body.classList.toggle('watching',mode==='wildlife');document.body.classList.toggle('drifting',mode==='drift'||mode==='wildlife');el('helm').hidden=mode!=='drift';press('[data-camera]',mode,'camera');if(paused)cameraStep(0,true);el('camera-hint').textContent=mode==='wildlife'?'WHALE WATCH · SURFACING, BREATHING & DIVING':mode==='pier'?'A SLOW WALK ALONG THE WATER':mode==='drift'?'WASD HELM · Q SPEED · DRAG TO LOOK':'DRAG TO EXPLORE · SCROLL TO ZOOM';invalidate();}
 function atmosphere(){environment.set(preset,haze,wind);models.glow(glow);models.setRain(preset==='rain'?1:0);gpu.toneMappingExposure=weather[preset].exposure;bloom.strength=preset==='moon'?.38:.28;el('weather-caption').textContent=weather[preset].caption;gpu.shadowMap.needsUpdate=true;invalidate();}
 function setPause(value:boolean){clearInput();paused=value;const b=el<HTMLButtonElement>('pause');b.setAttribute('aria-pressed',String(paused));b.innerHTML=paused?'▷ <span>Play</span>':'Ⅱ <span>Pause</span>';syncLoop();invalidate();}
 function toggleUI(){const hide=document.body.classList.toggle('hide-ui');el('show-ui').hidden=!hide;}
 document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>b.onclick=()=>setMode(b.dataset.camera as CameraMode));
 document.querySelectorAll<HTMLButtonElement>('[data-weather]').forEach(b=>b.onclick=()=>{preset=b.dataset.weather as Weather;press('[data-weather]',preset,'weather');atmosphere();});
 el('pause').onclick=()=>setPause(!paused);
 el('settings-toggle').onclick=()=>{clearInput();const panel=el('settings');panel.hidden=!panel.hidden;el('settings-toggle').setAttribute('aria-expanded',String(!panel.hidden));};
 el('settings-close').onclick=()=>{el('settings').hidden=true;el('settings-toggle').setAttribute('aria-expanded','false');el('settings-toggle').focus();};
 for(const name of ['wind','haze','glow'])el<HTMLInputElement>(name).oninput=e=>{const value=Number((e.target as HTMLInputElement).value);if(name==='wind')wind=value;if(name==='haze')haze=value;if(name==='glow')glow=value;el(`${name}-value`).textContent=`${Math.round(value*100)}%`;atmosphere();};
 el('reset').onclick=()=>{preset='sunset';wind=.35;haze=.45;glow=.7;time=0;navigation.reset();models.resetWake();models.update(0,wind,navigation.pose);previousBoat.copy(models.boatPoint);updateHelm();for(const [n,v] of [['wind',wind],['haze',haze],['glow',glow]] as const){el<HTMLInputElement>(n).value=String(v);el(`${n}-value`).textContent=`${Math.round(v*100)}%`;}press('[data-weather]',preset,'weather');setMode('overview');cameraStep(0,true);atmosphere();};
 let noticeTimer=0;function notice(text:string){el('notice').textContent=text;el('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>{el('notice').hidden=true;},4000);}
 el('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notice('Fullscreen is not available in this browser.');}catch{notice('Fullscreen is unavailable here. Open the experience in a new tab.');}};
 el('show-ui').onclick=toggleUI;
 const helmCodes=['KeyW','KeyA','KeyS','KeyD'];
 addEventListener('keydown',e=>{
  if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable)||e.metaKey||e.ctrlKey||e.altKey)return;
  if(helmCodes.includes(e.code)){if(takeHelm()){e.preventDefault();keys.add(e.code);}return;}
  if(e.code==='KeyQ'&&!e.repeat){if(takeHelm()){e.preventDefault();navigation.cycleSpeed();updateHelm();}return;}
  if(e.repeat)return;
  if(e.code==='Space'&&!(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement)){e.preventDefault();setPause(!paused);}
  if(e.key.toLowerCase()==='h')toggleUI();if(['1','2','3','4'].includes(e.key))setMode((['overview','drift','pier','wildlife'] as const)[Number(e.key)-1]);
  if(e.key==='Escape'){clearInput();el('settings').hidden=true;el('settings-toggle').setAttribute('aria-expanded','false');}
 });
 addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',clearInput);
 el('speed-mode').onclick=()=>{if(takeHelm()){navigation.cycleSpeed();updateHelm();}};
 document.querySelectorAll<HTMLButtonElement>('[data-helm]').forEach(button=>{
  const code=button.dataset.helm!;
  button.addEventListener('pointerdown',e=>{if(e.button!==0||!takeHelm())return;e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,code);button.classList.add('held');});
  const release=(e:PointerEvent)=>{pointers.delete(e.pointerId);if(!Array.from(pointers.values()).includes(code))button.classList.remove('held');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(takeHelm()){keys.add(code);button.classList.add('held');}}});
  button.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){keys.delete(code);button.classList.remove('held');}});
  button.addEventListener('blur',()=>{keys.delete(code);button.classList.remove('held');});
 });
 controls.addEventListener('start',()=>{manual=true;el('camera-hint').textContent=mode==='drift'?'FOLLOWING BOAT · WASD HELM · Q SPEED':'FREE LOOK · SELECT A CAMERA TO RESUME';});controls.addEventListener('change',invalidate);
 addEventListener('resize',invalidate);document.addEventListener('visibilitychange',()=>{clearInput();syncLoop();if(!document.hidden)invalidate();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();clearInput();lost=true;loading.hidden=false;cancelAnimationFrame(raf);loading.classList.remove('done');loading.classList.add('error');el('load-label').textContent='The graphics context was interrupted. Reload to return to the harbor.';const b=document.createElement('button');b.textContent='Reload experience';b.onclick=()=>location.reload();loading.append(b);});
 if(preview)addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='wonderworks:play'){previewActive=true;syncLoop();}if(e.data?.type==='wonderworks:pause'){previewActive=false;clearInput();syncLoop();}});
 cameraStep(0,true);resize();draw(0);setPause(paused);loading.classList.add('done');window.setTimeout(()=>{if(!lost)loading.hidden=true;},900);
 if(preview)parent.postMessage({type:'wonderworks:ready'},location.origin);
 Object.defineProperty(window,'harborDiagnostics',{value:()=>({frames,time,paused,mode,preset,manual,boat:{...navigation.pose,piloted:navigation.piloted,gear:navigation.gear},helm:helmInput(),rowing:models.rowingState(),wildlife:wildlife.diagnostics(),camera:camera.position.toArray(),target:controls.target.toArray(),active:active(),drawCalls:gpu.info.render.calls,triangles:gpu.info.render.triangles,geometries:gpu.info.memory.geometries,textures:gpu.info.memory.textures,width:canvas.width,height:canvas.height}),configurable:true});
}
start().catch((error:unknown)=>{console.error('Harbor initialization failed',error);renderer?.dispose();loading.classList.add('error');el('load-label').textContent='The harbor could not load. Check that WebGL is enabled and try again.';const button=document.createElement('button');button.textContent='Try again';button.onclick=()=>location.reload();loading.append(button);});
