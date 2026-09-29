// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createTree,type LivingUniforms} from './tree';
import {createEnvironment} from './environment';
import {createSound} from './audio';
import {type Settings,climate,seasonDuration} from './state';
export function createScene(canvas:HTMLCanvasElement,s:Settings,onTick:()=>void,onError:(message:string)=>void){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const world=new T.Scene();world.fog=new T.FogExp2('#b5bea7',.012);
 const camera=new T.PerspectiveCamera(38,1,.1,230);camera.position.set(12,7.3,24);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,4.25,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=7;controls.maxDistance=36;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.5;controls.autoRotateSpeed=.3;controls.update();
 const u:LivingUniforms={time:{value:0},flightTime:{value:0},year:{value:s.year},wind:{value:s.wind},snow:{value:climate(s.year).snow},species:{value:0}};
 const tree=createTree(s,u);world.add(tree.group);tree.update();const environment=createEnvironment(world,s,u,renderer,tree.group),sound=createSound();
 let raf=0,last=0,frames=0,disposed=false,active=true,uiTime=0,previousYear=s.year,previousWind=s.wind,previousAuto=s.auto,releaseEpoch=0;
 function draw(dt:number){
  if(!s.paused){u.time.value+=dt;if(s.auto)s.year=(s.year+dt/seasonDuration(s.year)*s.speed)%1;if(s.dayCycle)s.hour=(s.hour+dt*.08)%24;}
  if((!s.auto&&Math.abs(previousYear-s.year)>.00001)||previousWind!==s.wind||previousAuto!==s.auto)releaseEpoch=u.time.value;
  previousYear=s.year;previousWind=s.wind;previousAuto=s.auto;u.flightTime.value=s.auto?0:u.time.value-releaseEpoch;
  u.year.value=s.year;u.wind.value=s.weather==='storm'?Math.max(.8,s.wind):s.wind;tree.update();
  environment.update(dt,()=>{if(s.sound&&!s.paused)sound.thunder();});sound.update(s.weather==='rain'||s.weather==='storm',s.wind);
  controls.autoRotate=s.orbit&&!s.paused;controls.update();renderer.render(world,camera);frames++;
  uiTime+=dt;if(uiTime>.14||dt===0){uiTime=0;onTick();}
 }
 function frame(now:number){raf=0;if(disposed||!active||document.hidden)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;draw(s.paused?0:dt);if(!s.paused)raf=requestAnimationFrame(frame);}
 function invalidate(){if(!raf&&active&&!disposed&&!document.hidden)raf=requestAnimationFrame(frame);}
 controls.addEventListener('change',()=>{if(s.paused)invalidate();});
 function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
 const ro=new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio,1.8,Math.sqrt(2200000/(w*h))));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<.8?60:38;camera.updateProjectionMatrix();invalidate();});ro.observe(canvas);
 const visibility=()=>{stop();if(document.hidden){void sound.enable(false).catch(()=>onError('Audio could not be suspended. Toggle sound off.'));}else{if(s.sound)void sound.enable(true).catch(()=>onError('Sound could not resume. Toggle sound to try again.'));invalidate();}};document.addEventListener('visibilitychange',visibility);
 const lost=(event:Event)=>{event.preventDefault();stop();active=false;onError('Graphics were interrupted. Reload to restore the landscape.');};canvas.addEventListener('webglcontextlost',lost);
 return {update:invalidate,counts:tree.counts,get frames(){return frames;},get time(){return u.time.value;},
  setActive(value:boolean){active=value;stop();if(value)invalidate();},
  pause(){stop();invalidate();if(s.paused)void sound.enable(false);else if(s.sound)void sound.enable(true).catch(()=>onError('Sound could not start.'));},
  async setSound(value:boolean){await sound.enable(value);},
  resetView(){camera.position.set(12,7.3,24);controls.target.set(0,4.25,0);controls.update();invalidate();},
  snapshot(){draw(0);return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Capture unavailable.')),'image/png'));},
  dispose(){disposed=true;stop();ro.disconnect();controls.dispose();tree.dispose();environment.dispose();sound.dispose();renderer.dispose();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);},
 };
}
