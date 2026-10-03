// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Isolated material/pose inspection uses the same model factory and local HDR as the valley.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createGlider} from './glider';
const canvas=document.querySelector<HTMLCanvasElement>('#study')!,status=document.querySelector<HTMLElement>('#status')!;
try{
  const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#504c45');
  const camera=new T.PerspectiveCamera(37,1,.05,60),controls=new OrbitControls(camera,canvas);controls.target.set(0,.03,.54);controls.minDistance=2.5;controls.maxDistance=24;controls.enableDamping=false;
  const [model,environment]=await Promise.all([new GLTFLoader().loadAsync('./assets/squirrel-v3.glb'),new HDRLoader().loadAsync('./assets/sky.hdr')]);environment.mapping=T.EquirectangularReflectionMapping;scene.environment=environment;scene.environmentIntensity=.55;
  scene.add(new T.HemisphereLight(0xf0ecdf,0x4b3b2a,1.2));
  const key=new T.DirectionalLight(0xffebd0,3.0);key.position.set(-3,5,-4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.006;key.shadow.bias=-.0002;scene.add(key);
  const rim=new T.DirectionalLight(0xd7e6f4,1.7);rim.position.set(3,3,3);scene.add(rim);
  const floor=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0x504c45,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.507;floor.receiveShadow=true;scene.add(floor);
  const glider=createGlider(model.scene);scene.add(glider.group);
  let pose='ground',animate=false,time=0,last=0,raf=0,cameraView='quarter',fit=1;
  const viewportFit=()=>Math.max(1,(cameraView==='side'?1.5:cameraView==='belly'?1.15:.97)/camera.aspect);
  function render(now=performance.now()){
    raf=0;if(animate&&!document.hidden){time+=last?Math.min((now-last)/1000,.05):0;last=now;}else last=0;
    glider.update(time,pose==='glide'?1:0,0,pose==='climb'||pose==='run'?1:0,pose==='climb'?1:0,time*(pose==='run'?4.7:.9),pose==='ground'?1:0);
    renderer.render(scene,camera);if(animate&&!document.hidden)raf=requestAnimationFrame(render);
  }
  function invalidate(){if(!raf)raf=requestAnimationFrame(render);}
  function view(name:string){
    cameraView=name;floor.visible=name!=='belly';controls.target.set(0,name==='front'?.16:.03,name==='front'?-.94:.54);controls.minDistance=name==='front'?1.1:2.5;
    camera.position.copy(new T.Vector3(...(name==='side'?[4.8,1.0,.65]:name==='front'?[1.25,.58,-2.55]:name==='top'?[3.1,6.6,-3.3]:name==='back'?[-.8,1.65,6.0]:name==='belly'?[2.3,-3.4,-2.8]:[3.45,1.85,-3.80]) as [number,number,number]));
    fit=viewportFit();camera.position.sub(controls.target).multiplyScalar(fit).add(controls.target);
    controls.update();invalidate();
  }
  controls.addEventListener('change',invalidate);
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>view(button.dataset.view!));
  document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button=>button.onclick=()=>{pose=button.dataset.pose!;document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));invalidate();});
  const animateButton=document.querySelector<HTMLButtonElement>('#animate')!;animateButton.onclick=()=>{animate=!animate;animateButton.setAttribute('aria-pressed',String(animate));animateButton.textContent=animate?'Pause':'Animate';last=0;invalidate();};
  const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const nextFit=viewportFit();camera.position.sub(controls.target).multiplyScalar(nextFit/fit).add(controls.target);fit=nextFit;controls.update();invalidate();};
  addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else invalidate();});
  resize();view('quarter');await renderer.compileAsync(scene,camera);status.hidden=true;invalidate();
  if(import.meta.env.DEV)Object.defineProperty(window,'squirrelStudy',{value:()=>({pose,time,pending:raf!==0,cameraDistance:camera.position.distanceTo(controls.target),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls})});
  addEventListener('pageshow',event=>{if(event.persisted){last=0;invalidate();}});
  addEventListener('pagehide',event=>{if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(event.persisted)return;controls.dispose();glider.dispose();const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();scene.traverse(object=>{if(object instanceof T.Mesh||object instanceof T.LineSegments){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();});
}catch(error){console.error(error);status.textContent=error instanceof Error?error.message:'The squirrel could not be prepared. Reload to try again.';}
