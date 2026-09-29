// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 AIB Inc.
import './style.css';
import { Mesh, PerspectiveCamera, Scene, WebGPURenderer, ACESFilmicToneMapping, Vector2 } from 'three/webgpu';
import { createUniforms, element, FISH_COUNT } from './shared';
import { createSimulation } from './simulation';
import { createSchool } from './school';
import { createEnvironment } from './environment';
import { OceanControls } from './controls';
import { createPostprocessing } from './postprocessing';

const galleryPreview=new URLSearchParams(location.search).has('preview');
const canvas=element<HTMLCanvasElement>('#ocean');
const loading=element<HTMLDivElement>('#loading');
const status=element<HTMLParagraphElement>('#status');
const detail=element<HTMLElement>('#status-detail');
const retry=element<HTMLButtonElement>('#retry');
retry.addEventListener('click',()=>location.reload());
let dispose: (()=>void)|undefined;

async function boot(){
  if(!('gpu' in navigator))throw new Error('This browser does not support WebGPU. Use a WebGPU-enabled browser with hardware acceleration turned on.');
  const renderer=new WebGPURenderer({canvas,antialias:true,requiredLimits:{maxStorageBuffersInVertexStage:3}});
  renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  await renderer.init();
  if(!('isWebGPUBackend' in renderer.backend))throw new Error('WebGPU could not start. Check your browser’s hardware acceleration settings.');
  status.textContent='Gathering the shoal';detail.textContent='6,144 fish · GPU simulation and underwater light';
  const scene=new Scene(),camera=new PerspectiveCamera(58,1,.08,240),u=createUniforms();
  const sim=createSimulation(u);scene.add(createSchool(sim,u));
  const environment=createEnvironment(scene,u);
  const postprocessing=createPostprocessing(renderer,scene,camera,u);
  const renderScene=()=>postprocessing.render();
  let paused=false,disposed=false,failed=false,last=0,frames=0,elapsed=0,frameSum=0,measuredFps=0,pendingFrame=0;
  const abort=new AbortController(),options={signal:abort.signal};
  const controls=new OceanControls(canvas,camera,u,()=>{
    if(paused&&!pendingFrame&&!document.hidden)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;controls.update(1,false);renderScene();});
  });
  const cinemaButton=element<HTMLButtonElement>('#cinema');
  const updateCameraMode=()=>{cinemaButton.textContent=controls.cinematic?'Auto camera: On':'Auto camera: Off';cinemaButton.setAttribute('aria-pressed',String(controls.cinematic));};
  canvas.addEventListener('cameramodechange',updateCameraMode,options);updateCameraMode();
  cinemaButton.addEventListener('click',()=>controls.toggleCinematic(),options);
  const bufferSize=new Vector2();
  const resize=()=>{
    const width=window.innerWidth,height=window.innerHeight;
    const ratio=Math.min(galleryPreview?2:window.devicePixelRatio,galleryPreview?2:1.5,Math.sqrt(1_800_000/(width*height)));
    renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();controls.refreshRect();
    if(paused)renderScene();
  };
  resize();window.addEventListener('resize',resize,options);
  const fail=(error:unknown)=>{
    if(failed)return;failed=true;
    renderer.setAnimationLoop(null);loading.hidden=false;status.textContent='Unable to load the ocean';
    detail.textContent=error instanceof Error?error.message:String(error);retry.hidden=false;
    loading.classList.add('error');console.error(error);
  };
  renderer.onError=message=>fail(new Error(message));
  renderer.onDeviceLost=info=>fail(new Error(`GPU connection lost: ${info.message || info.reason}. Please reload.`));
  const animate=(now:number)=>{
    if(disposed||failed||paused||document.hidden)return;
    const raw=last?(now-last)/1000:1/60;last=now;
    const dt=Math.min(raw,1/30);u.dt.value=dt*u.speed.value;u.time.value+=u.dt.value;
    controls.update(dt);
    try{
      renderer.compute(sim.stepVelocity);renderer.compute(sim.integrate);renderScene();
      if(frames===0)loading.hidden=true;
      frames++;elapsed+=raw;frameSum++;
      if(elapsed>=1){measuredFps=Math.round(frameSum/elapsed);elapsed=0;frameSum=0;}
    }catch(error){fail(error);}
  };
  const lifecycle=()=>{
    last=0;
    if(failed||paused||document.hidden){renderer.setAnimationLoop(null);controls.cancel();if(pendingFrame){cancelAnimationFrame(pendingFrame);pendingFrame=0;}}
    else renderer.setAnimationLoop(animate);
  };
  const pauseButton=element<HTMLButtonElement>('#pause');
  const togglePause=()=>{paused=!paused;pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));lifecycle();};
  pauseButton.addEventListener('click',togglePause,options);
  element('#reset').addEventListener('click',()=>controls.reset(),options);
  document.addEventListener('visibilitychange',lifecycle,options);
  const settings=element<HTMLDetailsElement>('#settings'),hud=element<HTMLElement>('#hud');
  window.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLButtonElement||e.target instanceof HTMLElement&&e.target.tagName==='SUMMARY')return;
    if(e.code==='KeyH'){settings.hidden=!settings.hidden;hud.hidden=settings.hidden;}
    else if(e.code==='KeyR')controls.reset();
    else if(e.code==='KeyC')controls.toggleCinematic();
    else if(e.code==='Space'){e.preventDefault();togglePause();}
    else if(e.key==='+'||e.key==='=')controls.zoom(.82);
    else if(e.key==='-')controls.zoom(1.22);
  },options);
  for(const key of ['rays','caustics','fog','speed'] as const){
    element<HTMLInputElement>(`#${key}`).addEventListener('input',e=>{
      u[key].value=Number((e.target as HTMLInputElement).value);if(paused)renderScene();
    },options);
  }
  element<HTMLInputElement>('#exposure').addEventListener('input',e=>{
    renderer.toneMappingExposure=Number((e.target as HTMLInputElement).value);if(paused)renderScene();
  },options);
  // Read-only diagnostics for local verification; no per-frame DOM or CPU fish updates.
  const inspectSimulation=async()=>{
    const [positionBuffer,velocityBuffer]=await Promise.all([renderer.getArrayBufferAsync(sim.positions.value),renderer.getArrayBufferAsync(sim.velocities.value)]);
    const positions=new Float32Array(positionBuffer),velocities=new Float32Array(velocityBuffer);
    const stride=sim.positions.value.itemSize,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    let finite=0,speedSum=0,maxSpeed=0;
    for(let i=0;i<FISH_COUNT;i++){
      const offset=i*stride;let valid=true;
      for(let axis=0;axis<3;axis++){const value=positions[offset+axis];valid=valid&&Number.isFinite(value)&&Number.isFinite(velocities[offset+axis]);min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}
      if(valid)finite++;
      const speed=Math.hypot(velocities[offset],velocities[offset+1],velocities[offset+2]);speedSum+=speed;maxSpeed=Math.max(maxSpeed,speed);
    }
    return {count:FISH_COUNT,finite,min,max,averageSpeed:speedSum/FISH_COUNT,maxSpeed};
  };
  if(import.meta.env.DEV)Object.defineProperty(window,'__fish',{configurable:true,get:()=>{
    renderer.getDrawingBufferSize(bufferSize);
    return {backend:'WebGPU',fishCount:FISH_COUNT,grassCount:environment.grassCount,frames,fps:measuredFps,paused,hidden:document.hidden,time:u.time.value,distance:controls.distance,targetDistance:controls.targetDistance,cinematic:controls.cinematic,camera:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,shocks:controls.shockCount,pointerPower:u.pointerPower.value,buffer:[bufferSize.x,bufferSize.y],inspectSimulation};
  }});
  dispose=()=>{
    if(disposed)return;disposed=true;renderer.setAnimationLoop(null);cancelAnimationFrame(pendingFrame);abort.abort();controls.dispose();
    const geometries=new Set<Mesh['geometry']>(),materials=new Set<Mesh['material']>();
    scene.traverse(object=>{if(object instanceof Mesh){geometries.add(object.geometry);materials.add(object.material);}});
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials){if(Array.isArray(material))material.forEach(m=>m.dispose());else material.dispose();}
    postprocessing.dispose();renderer.dispose();Reflect.deleteProperty(window,'__fish');
  };
  window.addEventListener('pagehide',e=>{if(!e.persisted)dispose?.();else renderer.setAnimationLoop(null);},options);
  window.addEventListener('pageshow',e=>{if(e.persisted)lifecycle();},options);
  await renderer.compileAsync(scene,camera);
  if(galleryPreview){
    // Gallery controls are idempotent and separate from keyboard toggles.
    controls.zoom(.82**3);
    window.dispatchEvent(new CustomEvent('wonderworks:register',{detail:{
      canvas,ready:()=>frames>=16,frames:()=>frames,draw:renderScene,
      setActive:(active:boolean)=>{paused=!active;lifecycle();},
    }}));
  }
  lifecycle();
}

boot().catch(error=>{
  dispose?.();loading.hidden=false;status.textContent='Unable to load the ocean';
  detail.textContent=error instanceof Error?error.message:String(error);retry.hidden=false;loading.classList.add('error');console.error(error);
});
if(import.meta.hot)import.meta.hot.dispose(()=>dispose?.());
