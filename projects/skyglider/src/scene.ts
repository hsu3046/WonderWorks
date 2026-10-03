// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {loadAssets} from './assets';
import {createWorld} from './world';
import {createWater} from './water';
import {createGlider} from './glider';
import {PERCH,ROUTE,CLIMB_DURATION,GLIDE_DURATION,clamp,random,smooth,terrainHeight} from './landscape';
import {CLIMB_TOP_AT,RELEASE_AT,departurePosition,departureOrientation} from './departure';
import {landingPosition,planLanding,type LandingPlan} from './landing';
import {GLIDER_SCALE} from './glider-pose';
import {advanceWalk,createWalkState} from './walking';
import {renderedTerrainHeight} from './terrain-surface';

export interface Settings {paused:boolean;speed:number;golden:boolean;cinema:boolean;}
export type FlightMode='perched'|'journey'|'landing'|'grounded';
export interface Readout {phase:string;mode:FlightMode;flying:boolean;canLand:boolean;progress:number;altitude:number;speed:number;}
export async function createScene(canvas:HTMLCanvasElement,settings:Settings,onStatus:(state:Readout)=>void,onLoad:(text:string)=>void,onError:(message:string)=>void){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.info.autoReset=false;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(57,1,.12,2600);scene.fog=new T.FogExp2(0xaec5c6,.00085);
  const ambient=new T.HemisphereLight(0xc0deed,0x48503b,1.5);scene.add(ambient);
  const sun=new T.DirectionalLight(0xffe6b2,3.4);sun.position.set(-150,220,-80);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38;
  sun.shadow.camera.near=1;sun.shadow.camera.far=460;sun.shadow.bias=-.00012;sun.shadow.normalBias=.08;sun.shadow.radius=3;scene.add(sun,sun.target);
  let assets:Awaited<ReturnType<typeof loadAssets>>;
  try{assets=await loadAssets(onLoad,true);}catch(error){renderer.dispose();throw error;}
  scene.background=assets.sky;scene.backgroundIntensity=.92;scene.environment=assets.sky;scene.environmentIntensity=.42;
  const time={value:0},world=createWorld(scene,assets,time),waterfalls=createWater(scene,assets,time),glider=createGlider(assets.squirrel);scene.add(glider.group);
  glider.group.scale.setScalar(GLIDER_SCALE);

  // Sparse, world-space pollen makes foreground light visible without a fullscreen glow overlay.
  const rng=random(276),positions=new Float32Array(160*3),seeds=new Float32Array(160);
  for(let i=0;i<160;i++){positions.set([(rng()-.5)*50,65+rng()*35,30+rng()*65],i*3);seeds[i]=rng();}
  const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(positions,3));dustGeometry.setAttribute('seed',new T.BufferAttribute(seeds,1));
  scene.add(new T.Points(dustGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:time},
    vertexShader:`attribute float seed;uniform float uTime;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.14+seed*16.)*3.;p.y+=sin(uTime*.25+seed*53.)*1.4;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(45./-mv.z,1.,4.);vAlpha=.18+seed*.35;}`,
    fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(1.,.91,.62,(1.-smoothstep(.1,1.,r))*vAlpha);}`
  })));
  const birdGeo=new T.BufferGeometry();birdGeo.setAttribute('position',new T.Float32BufferAttribute([-.8,0,0,0,0,-.1,0,.12,.25,0,0,-.1,.8,0,0,0,.12,.25],3));
  const birds=new T.InstancedMesh(birdGeo,new T.MeshStandardMaterial({color:0x313c3c,side:T.DoubleSide,roughness:1}),18);scene.add(birds);const birdObject=new T.Object3D();

  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4});
  const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new T.Vector2(1,1),.13,.55,1.3);composer.addPass(bloom);composer.addPass(new OutputPass());
  const path=new T.CatmullRomCurve3(ROUTE.map(p=>new T.Vector3(...p)),false,'centripetal');
  path.arcLengthDivisions=400;path.updateArcLengths();const routeSpeed=path.getLength()/GLIDE_DURATION,totalDuration=CLIMB_DURATION+GLIDE_DURATION;
  const position=new T.Vector3(PERCH.x,PERCH.y,PERCH.z),heading=new T.Vector3(0,0,-1),next=new T.Vector3(),side=new T.Vector3(),look=new T.Vector3(),desiredCamera=new T.Vector3(),desiredLook=new T.Vector3(),sunOffset=new T.Vector3(-140,190,-70);
  let flight=0,mode:FlightMode='perched',frameCount=0,raf=0,last=0,disposed=false,active=true,yaw=.29,pitch=.20,distance=10.7,steer=0,lift=0,bank=0,uiTime=0;
  let landing:LandingPlan|null=null,landingElapsed=0;
  let walk=createWalkState(),groundCameraYaw=0,tapForward=0,tapRight=0;
  const departureStart={...PERCH},departureFacing=new T.Quaternion(),authoredFacing=new T.Quaternion();
  let width=0,height=0,ready=false;
  const keys=new Set<string>(),pointers=new Map<number,{x:number;y:number}>();let pinch=0;
  const eventAbort=new AbortController(),signal=eventAbort.signal;
  function readout():Readout{
    const flying=mode==='journey'||mode==='landing';
    return {phase:mode==='landing'?'Coming down to the forest':mode==='grounded'?landing?.name??'Feet on the ground':mode==='perched'?'The old oak':flight<2.4?'A little running start':flight<CLIMB_TOP_AT?'Up the ancient oak':flight<RELEASE_AT?'Ready to leap':flight<CLIMB_DURATION+3?'Catching the wind':flight<26?'The hanging bridge':flight<36?'Valley of waterfalls':flight<58?'The high kingdom':'A way back home',
      mode,flying,canLand:mode==='journey'&&flight>=CLIMB_DURATION+1.2,progress:mode==='landing'&&landing?landingElapsed/landing.duration:flight/totalDuration,
      altitude:Math.max(0,position.y-.15),speed:flying?Math.round((mode==='landing'?8:flight<CLIMB_DURATION?3:routeSpeed)*settings.speed):Math.round(walk.speed*settings.speed)};
  }
  function resize(){
    const w=Math.round(canvas.clientWidth),h=Math.round(canvas.clientHeight);if(w<1||h<1||w===width&&h===height)return;
    width=w;height=h;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<.85?67:57;camera.updateProjectionMatrix();invalidate();
  }
  function frame(now:number){
    raf=0;if(disposed||!active||document.hidden)return;
    const dt=last&&!settings.paused?Math.min((now-last)/1000,.05):0;last=now;time.value+=dt;
    let departure:ReturnType<typeof departurePosition>|null=null;
    if(mode==='journey'){
      flight=Math.min(totalDuration,flight+dt*settings.speed);const t=Math.max(0,(flight-CLIMB_DURATION)/GLIDE_DURATION);
      path.getPointAt(t,position);path.getPointAt(Math.min(1,t+.004),next);heading.copy(next).sub(position).normalize();
      if(flight<CLIMB_DURATION){departure=departurePosition(flight,departureStart);position.set(departure.x,departure.y,departure.z);heading.set(0,0,-1);}
      if(t>.998)heading.set(0,0,-1);
      side.set(-heading.z,0,heading.x).normalize();
      const left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
      const airborne=flight>=CLIMB_DURATION;
      steer=airborne?clamp(steer+((right?1:0)-(left?1:0))*dt*11,-18,18):0;steer*=Math.exp(-dt*.15);
      lift=airborne?clamp(lift+((keys.has('ArrowUp')||keys.has('KeyW')?1:0)-(keys.has('ArrowDown')||keys.has('KeyS')?1:0))*dt*7,-15,22):0;lift*=Math.exp(-dt*.08);
      position.addScaledVector(side,steer);position.y+=lift;
      position.y=Math.max(position.y,terrainHeight(position.x,position.z)+4);
      bank=T.MathUtils.damp(bank,((left?1:0)-(right?1:0))*.38,4,dt);
      if(flight>=totalDuration){mode='perched';flight=0;steer=0;lift=0;walk=createWalkState();groundCameraYaw=0;position.set(PERCH.x,PERCH.y,PERCH.z);}
    }else if(mode==='landing'&&landing){
      landingElapsed=Math.min(landing.duration,landingElapsed+dt*settings.speed);
      const t=landingElapsed/landing.duration;landingPosition(landing,t,position);landingPosition(landing,Math.min(1,t+.003),next);
      if(t<.997){next.sub(position).normalize();heading.lerp(next,1-Math.exp(-dt*4)).normalize();}
      bank=T.MathUtils.damp(bank,0,4,dt);
      if(t===1){mode='grounded';heading.y=0;heading.normalize();walk=createWalkState(Math.atan2(-heading.x,-heading.z));groundCameraYaw=walk.yaw;keys.clear();tapForward=0;tapRight=0;}
    }else if(mode==='perched'||mode==='grounded'){
      let forward=Number(keys.has('ArrowUp')||keys.has('KeyW'))-Number(keys.has('ArrowDown')||keys.has('KeyS'));
      let right=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
      const tapped=!forward&&!right&&(tapForward!==0||tapRight!==0);
      if(tapped){forward=tapForward;right=tapRight;}
      advanceWalk(walk,position,forward,right,groundCameraYaw+yaw,dt>0?(tapped?.075:dt*settings.speed):0,mode==='perched',world.walkObstacles);
      tapForward=0;tapRight=0;heading.set(-Math.sin(walk.yaw),0,-Math.cos(walk.yaw));bank=0;
    }
    const flying=mode==='journey'||mode==='landing';
    const touchdown=landing?smooth(.70,1,landingElapsed/landing.duration):0;
    glider.group.position.copy(position);glider.group.rotation.set(Math.asin(clamp(heading.y,-1,1))*.55,Math.atan2(-heading.x,-heading.z),0,'YXZ');
    if(departure){
      departureOrientation(flight,authoredFacing);
      glider.group.quaternion.copy(departureFacing).slerp(authoredFacing,smooth(0,.7,flight));
    }else if(mode==='perched'||mode==='grounded')glider.group.rotation.set(walk.pitch,walk.yaw,walk.roll,'YXZ');
    if(mode==='landing')glider.group.rotation.x*=1-touchdown;
    const spread=departure?departure.spread:mode==='landing'?1-smooth(.64,.99,landingElapsed/landing!.duration):mode==='journey'?1:0;
    glider.update(time.value,spread,bank,departure?.gait??(mode==='perched'||mode==='grounded'?walk.gait:0),departure?.climbing??0,departure?.travel??walk.travel,departure?.ground??(mode==='grounded'||mode==='perched'?1:mode==='landing'?touchdown:0),departure?.launch??0,departure?.tailLift??0,mode==='perched'||mode==='grounded',mode==='grounded'?renderedTerrainHeight:undefined);
    const cameraClimb=departure?smooth(1.4,2.4,flight)*(1-smooth(RELEASE_AT,CLIMB_DURATION+1,flight)):mode==='journey'?1-smooth(RELEASE_AT,CLIMB_DURATION+1,flight):0;
    const headingYaw=Math.atan2(-heading.x,-heading.z),cameraYaw=(mode==='perched'||mode==='grounded'?groundCameraYaw:headingYaw)+yaw+cameraClimb*1.03;
    desiredCamera.copy(position).add(new T.Vector3(Math.sin(cameraYaw)*distance,Math.sin(pitch)*distance+1.05,Math.cos(cameraYaw)*distance));
    desiredCamera.y=Math.max(desiredCamera.y,terrainHeight(desiredCamera.x,desiredCamera.z)+1.3);
    desiredLook.copy(position).addScaledVector(heading,mode==='grounded'?1.6:mode==='landing'?T.MathUtils.lerp(4.3,1.6,touchdown):flying?4.3:7.3);desiredLook.y+=mode==='grounded'?.55:flying?1.2:1.8;
    if(cameraClimb){desiredLook.x=T.MathUtils.lerp(desiredLook.x,position.x,cameraClimb);desiredLook.z=T.MathUtils.lerp(desiredLook.z,position.z,cameraClimb);desiredLook.y=T.MathUtils.lerp(desiredLook.y,position.y+1.2,cameraClimb);}
    if(frameCount===0){camera.position.copy(desiredCamera);look.copy(desiredLook);}else{const factor=settings.paused?1:1-Math.exp(-Math.max(dt,.001)*5);camera.position.lerp(desiredCamera,factor);look.lerp(desiredLook,factor);}
    camera.lookAt(look);sun.position.copy(position).add(sunOffset);sun.target.position.copy(position);
    world.updateView(camera.position);
    for(let i=0;i<18;i++){const a=time.value*.036+i*.72;birdObject.position.set(-25+Math.cos(a)*65,80+Math.sin(a*1.4+i)*8,-160+Math.sin(a)*60);birdObject.rotation.set(0,-a,Math.sin(time.value*4+i)*.14);birdObject.scale.set(1,1,1);birdObject.updateMatrix();birds.setMatrixAt(i,birdObject.matrix);}birds.instanceMatrix.needsUpdate=true;
    renderer.info.reset();composer.render();frameCount++;
    if(now-uiTime>180||settings.paused){onStatus(readout());uiTime=now;}
    if(!settings.paused)raf=requestAnimationFrame(frame);
  }
  function invalidate(){if(ready&&!disposed&&active&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
  function pause(){keys.clear();tapForward=0;tapRight=0;walk.speed=0;last=0;if(raf){cancelAnimationFrame(raf);raf=0;}invalidate();}
  function depart(){if(mode!=='perched')return;Object.assign(departureStart,position);departureFacing.copy(glider.group.quaternion);mode='journey';keys.clear();tapForward=0;tapRight=0;landing=null;flight=0;steer=0;lift=0;settings.paused=false;yaw=.10;pitch=.20;distance=9.5;onStatus(readout());pause();}
  function home(){mode='perched';walk=createWalkState();groundCameraYaw=0;tapForward=0;tapRight=0;landing=null;landingElapsed=0;flight=0;steer=0;lift=0;keys.clear();yaw=.29;pitch=.20;distance=10.7;frameCount=0;position.set(PERCH.x,PERCH.y,PERCH.z);onStatus(readout());invalidate();}
  function land(){
    if(!readout().canLand)return false;
    landing=planLanding(position,heading);landingElapsed=0;mode='landing';keys.clear();steer=0;lift=0;settings.paused=false;onStatus(readout());pause();return true;
  }
  function mood(){sun.color.set(settings.golden?0xffb969:0xffe6b2);sun.intensity=settings.golden?3.0:3.4;ambient.intensity=settings.golden?1.25:1.5;renderer.toneMappingExposure=settings.golden?1.05:1.13;scene.backgroundIntensity=settings.golden?.6:.92;(scene.fog as T.FogExp2).color.set(settings.golden?0xc9bdb0:0xaec5c6);sunOffset.set(-140,settings.golden?95:190,-70);invalidate();}
  canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);pinch=0;},{signal});
  canvas.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a!.x-b!.x,a!.y-b!.y);if(pinch>0)distance=clamp(distance*pinch/d,5,30);pinch=d;}
    else{yaw-=dx*.004;pitch=clamp(pitch+dy*.003,-.28,.9);}invalidate();
  },{signal});
  const release=(e:PointerEvent)=>{pointers.delete(e.pointerId);pinch=0;};
  canvas.addEventListener('pointerup',release,{signal});canvas.addEventListener('pointercancel',release,{signal});canvas.addEventListener('lostpointercapture',release,{signal});
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*Math.exp(e.deltaY*.001),5,30);invalidate();},{passive:false,signal});
  function steerKey(key:string,pressed:boolean){
    if(pressed&&(!active||document.hidden||settings.paused))return;
    if(pressed&&!keys.has(key)&&(mode==='perched'||mode==='grounded')){
      if(key==='ArrowUp'||key==='KeyW')tapForward=1;
      if(key==='ArrowDown'||key==='KeyS')tapForward=-1;
      if(key==='ArrowLeft'||key==='KeyA')tapRight=-1;
      if(key==='ArrowRight'||key==='KeyD')tapRight=1;
    }
    // Preserve very short taps that begin and end between two render frames; held keys still integrate with dt.
    if(pressed&&!keys.has(key)&&mode==='journey'&&flight>=CLIMB_DURATION&&!settings.paused){
      if(key==='ArrowLeft'||key==='KeyA')steer=clamp(steer-.45,-18,18);
      if(key==='ArrowRight'||key==='KeyD')steer=clamp(steer+.45,-18,18);
      if(key==='ArrowUp'||key==='KeyW')lift=clamp(lift+.35,-15,22);
      if(key==='ArrowDown'||key==='KeyS')lift=clamp(lift-.35,-15,22);
    }
    if(pressed)keys.add(key);else keys.delete(key);
  }
  addEventListener('keydown',e=>{if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true],dialog'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();steerKey(e.code,true);}},{signal});
  addEventListener('keyup',e=>steerKey(e.code,false),{signal});
  addEventListener('blur',()=>{keys.clear();tapForward=0;tapRight=0;walk.speed=0;pointers.clear();pinch=0;},{signal});
  document.addEventListener('visibilitychange',()=>{keys.clear();tapForward=0;tapRight=0;walk.speed=0;pointers.clear();last=0;if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else invalidate();},{signal});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;if(raf)cancelAnimationFrame(raf);raf=0;onError('The graphics connection was interrupted. Reload to return to the valley.');},{signal});
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  onLoad('Letting the light in…');resize();
  // Prepare programs before removing the loading state; first interaction cannot trigger a shader-compilation wall.
  glider.group.position.copy(position);camera.position.set(3,84,75);camera.lookAt(0,79,50);
  await renderer.compileAsync(scene,camera);composer.render();frameCount=0;ready=true;invalidate();
  function dispose(){
    if(disposed)return;disposed=true;eventAbort.abort();resizeObserver.disconnect();if(raf)cancelAnimationFrame(raf);raf=0;
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    for(const m of materials){for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose();}
    for(const value of Object.values(assets))if(value instanceof T.Texture)textures.add(value);
    if(assets.local){textures.add(assets.local.meadow);textures.add(assets.local.leafFloor);for(const model of Object.values(assets.local.models))model.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});}
    textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());waterfalls.dispose();glider.dispose();composer.passes.forEach(p=>p.dispose());composer.dispose();renderer.dispose();
  }
  return {depart,home,land,pause,mood,invalidate,dispose,
    setSteering:steerKey,
    setActive(value:boolean){active=value;keys.clear();tapForward=0;tapRight=0;walk.speed=0;last=0;if(!value&&raf){cancelAnimationFrame(raf);raf=0;}if(value)invalidate();},
    async snapshot():Promise<Blob>{composer.render();return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('The image could not be saved.')),'image/png'));},
    diagnostics(){return {ready,frame:frameCount,time:time.value,pending:raf!==0,mode,flying:mode==='journey'||mode==='landing',flight,steer,lift,walking:{...walk},landing:landing?{elapsed:landingElapsed,duration:landing.duration,name:landing.name,target:landing.end}:null,clearance:position.y-terrainHeight(position.x,position.z),position:position.toArray(),camera:camera.position.toArray(),trees:world.trees,grove:world.groveCounts(),flowers:world.flowerCounts(),localScenery:world.localCounts(),waterfalls:waterfalls.count,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,canvas:[canvas.width,canvas.height]};}
  };
}
