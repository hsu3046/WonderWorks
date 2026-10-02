// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createDischarge,pulse,random,type Point,type Discharge} from './bolt';
import {createChannels} from './channels';
import {cloudMaterial} from './cloud';
import {CLOUD_HEIGHT,createCloudPose,updateCloudPose,createCloudSourceSampler,cloudFlash} from './cloud-field';
import {createMetalConductor} from './metal';
import {domeHeight,domeNormal,visibleDomeContact,type Attachment} from './conductor';
import {MAX_DISCHARGES,playbackRate,dischargeCount,initialAge,dischargeFinished} from './storm-timing';
export interface StormSettings {density:number;branching:number;wind:number;interval:number;dome:boolean;paused:boolean;fast:boolean}
export function createStorm(canvas:HTMLCanvasElement,settings:StormSettings,onStrike:(energy:number)=>void,onError:(message:string)=>void){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.;
 const colorType=renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType;
 const scene=new T.Scene();scene.background=new T.Color('#080b10');scene.fog=new T.FogExp2('#080b10',.045);
 const camera=new T.PerspectiveCamera(42,1,.1,70);camera.position.set(7.2,4.5,10.5);
 const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,2.6,0);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.enablePan=false;orbit.minDistance=7.5;orbit.maxDistance=19;orbit.minPolarAngle=.45;orbit.maxPolarAngle=1.52;orbit.rotateSpeed=.5;orbit.update();
 const depth=new T.DepthTexture(1,1,T.UnsignedIntType),target=new T.WebGLRenderTarget(1,1,{type:colorType});target.depthTexture=depth;
 const cloudTarget=new T.WebGLRenderTarget(1,1,{type:colorType,depthBuffer:false});
 const cloud=cloudMaterial(depth,camera),screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1),plane=new T.PlaneGeometry(2,2),cloudScene=new T.Scene();cloudScene.add(new T.Mesh(plane,cloud.material));
 const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uScene:{value:target.texture},uCloud:{value:cloudTarget.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D uScene,uCloud;void main(){vec4 cloud=texture2D(uCloud,vUv);gl_FragColor=vec4(texture2D(uScene,vUv).rgb*cloud.a+cloud.rgb,1.);}'});
 const postScene=new T.Scene();postScene.add(new T.Mesh(plane,composite));
 const composer=new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:colorType,depthBuffer:false}));composer.addPass(new RenderPass(postScene,screenCamera));const bloom=new UnrealBloomPass(new T.Vector2(1,1),.52,.60,1.3);composer.addPass(bloom);const output=new OutputPass();composer.addPass(output);
 const ambient=new T.HemisphereLight('#adc9ed','#141820',1.1),key=new T.DirectionalLight('#bdcedb',2.3);key.position.set(-3,7,4);scene.add(ambient,key);
 const flashLight=new T.PointLight('#bdceff',0,12,2);flashLight.position.set(0,3,0);scene.add(flashLight);
 const floorMaterial=new T.ShaderMaterial({uniforms:{uHits:{value:Array.from({length:MAX_DISCHARGES},()=>new T.Vector3())},uFlashes:{value:new Float32Array(MAX_DISCHARGES)},uDome:{value:1}},vertexShader:'varying vec3 vP;void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',fragmentShader:`varying vec3 vP;uniform vec3 uHits[${MAX_DISCHARGES}];uniform float uFlashes[${MAX_DISCHARGES}],uDome;void main(){vec2 p=vP.xz;vec2 grid=abs(fract(p*.5-.5)-.5)/max(fwidth(p*.5),vec2(.001));float line=1.-min(min(grid.x,grid.y),1.);float fade=exp(-length(p)*.11);float light=0.;for(int i=0;i<${MAX_DISCHARGES};i++)if(uFlashes[i]>.001)light+=exp(-length(p-uHits[i].xz)*1.1)*uFlashes[i];float pool=exp(-dot(p,p)*.05);vec3 col=vec3(.002428,.003347,.005182)+vec3(.018,.025,.035)*pool+vec3(.052,.065,.088)*line*fade*.17+vec3(.19,.25,.5)*light;float contactShadow=1.-.68*uDome*(1.-smoothstep(1.06,1.4,length(p)));gl_FragColor=vec4(col*contactShadow,1.);}`});
 const floor=new T.Mesh(new T.PlaneGeometry(60,60),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
 const metal=createMetalConductor(renderer),{dome,rim}=metal;scene.add(dome,rim,metal.contactLight);
 // Fixed-capacity channel slots share the expensive cloud and bloom passes.
 const channels=Array.from({length:MAX_DISCHARGES},()=>createChannels());
 for(const channel of channels)scene.add(channel.mesh);
 const channelMeshes=new Set(channels.map(channel=>channel.mesh));
 const cloudPose=createCloudPose(),sampleSource=createCloudSourceSampler(random(18412));
 const poseUniforms=[cloud.material.uniforms,...channels.map(channel=>channel.uniforms)];
 interface ActiveBolt {bolt:Discharge;age:number;delay:number;attached:boolean;attachment:Attachment|undefined}
 const bolts:ActiveBolt[]=[],flashes=new Float32Array(MAX_DISCHARGES),leaders=new Float32Array(MAX_DISCHARGES);
 const rand=random(4928),clusterRandom=random(92184);
 let generationMs=0,thunderPending=false,flashEnergy=0,branchingDirty=false;
 let seed=1208,time=0,untilStrike=.85,strikes=0,frames=0,raf=0,last=0,disposed=false,active=true,width=0,height=0;
 function discharge(hit?:T.Vector3,onDome=false){
  updateCloudPose(cloudPose,time,settings.wind);
  // A deliberate surface click retains its exact one-contact behavior.
  const count=hit?1:dischargeCount(clusterRandom()),started=performance.now();bolts.length=0;
  for(let index=0;index<count;index++){
   const source=sampleSource(cloudPose),grounded=settings.dome||strikes===0||!!hit||rand()>.2;
   const end:Point=hit?[hit.x,hit.y,hit.z]:grounded?[0,settings.dome?.77:0,0]:[(rand()>.5?1:-1)*(1.15+rand()*.7),CLOUD_HEIGHT-.6+rand()*.6,(rand()-.5)*1.4];
   if(!hit&&grounded){
    // Favor separated contacts within the same visible shoulder, so concurrent
    // channels do not collapse into a single bright endpoint on the dome.
    let bestDistance=-1;
    for(let attempt=0;attempt<12;attempt++){
     const candidate:Point=settings.dome?visibleDomeContact([camera.position.x,camera.position.y,camera.position.z],rand(),rand()):[(rand()-.5)*3,0,(rand()-.5)*3];
     const distance=bolts.reduce((nearest,other)=>Math.min(nearest,Math.hypot(candidate[0]-other.bolt.target[0],candidate[2]-other.bolt.target[2])),Infinity);
     if(distance>bestDistance){end[0]=candidate[0];end[1]=candidate[1];end[2]=candidate[2];bestDistance=distance;}
     if(distance>.42)break;
    }
   }
   const attached=settings.dome&&(hit?onDome:true);
   if(attached)end[1]=domeHeight(end[0],end[2]);
   const attachment:Attachment|undefined=grounded?{normal:attached?domeNormal(end):[0,1,0],dome:attached}:undefined;
   const bolt=createDischarge(++seed,source,end,settings.branching,attachment),delay=index?clusterRandom()*.012:0;
   bolts.push({bolt,attached,attachment,delay,age:initialAge(bolt.leaderDuration,bolts[0]?.bolt.leaderDuration??bolt.leaderDuration,delay,settings.paused)});
   channels[index]!.set(bolt);metal.set(index,bolt,attached);floorMaterial.uniforms.uHits!.value[index].fromArray(end);
  }
  generationMs=performance.now()-started;thunderPending=!settings.paused;
  untilStrike=settings.interval*(.8+rand()*.55);strikes+=count;branchingDirty=false;invalidate();
 }
 function rebuildBranches(){
  const started=performance.now();
  for(let i=0;i<bolts.length;i++){
   const state=bolts[i]!,old=state.bolt;
   state.bolt=createDischarge(old.seed,old.source,old.target,settings.branching,state.attachment);
   state.age=initialAge(state.bolt.leaderDuration,bolts[0]!.bolt.leaderDuration,state.delay,settings.paused);
   channels[i]!.set(state.bolt);metal.set(i,state.bolt,state.attached);
  }
  generationMs=performance.now()-started;untilStrike=settings.interval;branchingDirty=false;
 }
 function draw(dt:number){
  frames++;const step=settings.paused?0:dt*playbackRate(settings.fast);
  if(!settings.paused){
   time+=step;for(const state of bolts)state.age+=step;untilStrike-=step;
   if(untilStrike<=0&&bolts.every(state=>dischargeFinished(state.bolt,state.age)))discharge();
  }
  // Slider events coalesce into one regeneration per rendered frame. Sources,
  // contact points and seeds stay put, making the visual comparison immediate.
  if(branchingDirty)rebuildBranches();
  orbit.update();camera.updateMatrixWorld();updateCloudPose(cloudPose,time,settings.wind);
  for(const uniforms of poseUniforms){uniforms.uCloudOffset!.value.fromArray(cloudPose.offset);uniforms.uCloudScale!.value.fromArray(cloudPose.scale);uniforms.uCloudShear!.value=cloudPose.shear;}
  flashes.fill(0);leaders.fill(0);floorMaterial.uniforms.uFlashes!.value.fill(0);cloud.material.uniforms.uLightPowers!.value.fill(0);
  let strongest=0,totalFlash=0,maxCloudFlash=0;
  for(let i=0;i<MAX_DISCHARGES;i++){
   const state=bolts[i],channel=channels[i]!;channel.mesh.visible=!!state&&state.age<state.bolt.strokes.at(-1)!.time+.6;
   if(!state)continue;
   const {bolt,age}=state,flash=pulse(age,bolt,step),internalFlash=cloudFlash(age,bolt,step);
   flashes[i]=flash;leaders[i]=age>bolt.leaderDuration-.008&&age<bolt.leaderDuration?1:0;totalFlash+=flash;
   if(flash>flashes[strongest]!)strongest=i;
   channel.uniforms.uAge!.value=age;channel.uniforms.uExposure!.value=step;
   floorMaterial.uniforms.uFlashes!.value[i]=flash*(bolt.target[1]<1?1:.06);
   if(bolts.length===1){
    bolt.lights.forEach((point,j)=>{cloud.material.uniforms.uLights!.value[j].fromArray(point);cloud.material.uniforms.uLightPowers!.value[j]=internalFlash;});
   }else{
    cloud.material.uniforms.uLights!.value[i].fromArray(bolt.source);cloud.material.uniforms.uLightPowers!.value[i]=internalFlash*1.4;
   }
   maxCloudFlash=Math.max(maxCloudFlash,internalFlash);
  }
  if(thunderPending&&bolts.some(state=>state.age>=state.bolt.leaderDuration)){thunderPending=false;onStrike(Math.min(1.25,.75+bolts.length*.15));}
  flashEnergy=Math.min(1.5,totalFlash);const brightest=bolts[strongest]!.bolt;
  flashLight.position.set(brightest.source[0],(brightest.source[1]+brightest.target[1])*.5,brightest.source[2]);flashLight.intensity=flashEnergy*21;
  metal.update(flashes,leaders,settings.dome);floorMaterial.uniforms.uDome!.value=settings.dome?1:0;
  cloud.material.uniforms.uTime!.value=time;cloud.material.uniforms.uDensity!.value=settings.density;cloud.material.uniforms.uWind!.value=settings.wind;cloud.material.uniforms.uFlash!.value=maxCloudFlash;
  // Scene and cloud stay linear HDR; OutputPass owns the sole display conversion.
  const tone=renderer.toneMapping;renderer.toneMapping=T.NoToneMapping;
  renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(cloudTarget);renderer.render(cloudScene,screenCamera);renderer.setRenderTarget(null);renderer.toneMapping=tone;composer.render(dt);
 }
 function frame(now:number){raf=0;if(disposed||!active||document.hidden)return;const dt=last?Math.min((now-last)/1000,.08):0;last=now;draw(dt);if(!settings.paused)invalidate();}
 function invalidate(){if(!raf&&!disposed&&active&&!document.hidden)raf=requestAnimationFrame(frame);}
 function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const ratio=Math.min(devicePixelRatio,1.5,Math.sqrt(1500000/(w*h))),nw=Math.round(w*ratio),nh=Math.round(h*ratio);if(nw===width&&nh===height)return;width=nw;height=nh;renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.aspect=w/h;camera.fov=w/h<.8?57:42;camera.updateProjectionMatrix();target.setSize(width,height);cloudTarget.setSize(width,height);composer.setSize(width,height);for(const channel of channels)channel.uniforms.uViewport!.value.set(width,height);invalidate();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 const hidden=()=>{stop();if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',hidden);
 orbit.addEventListener('change',()=>{if(settings.paused)invalidate();});
 const ray=new T.Raycaster(),floorPlane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();let down:{x:number;y:number;id:number}|null=null;
 const pointerDown=(e:PointerEvent)=>{if(e.isPrimary&&e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};else down=null;};
 const pointerUp=(e:PointerEvent)=>{if(!down||e.pointerId!==down.id)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved>6)return;
  const rect=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
  const domeHit=settings.dome?ray.intersectObject(dome)[0]:undefined;
  if(domeHit){discharge(domeHit.point,true);return;}if(ray.ray.intersectPlane(floorPlane,hit)&&Math.abs(hit.x)<4&&Math.abs(hit.z)<3)discharge(hit);else discharge();
 };
 const pointerCancel=()=>{down=null;};canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerCancel);
 const lost=(e:Event)=>{e.preventDefault();stop();active=false;onError('The graphics connection was interrupted. Reload to return to the storm.');};canvas.addEventListener('webglcontextlost',lost);
 discharge();resize();draw(0);
 return {strike:()=>discharge(),refreshBranching(){branchingDirty=true;invalidate();},update:invalidate,pause(){stop();invalidate();},setActive(value:boolean){active=value;stop();invalidate();},reset(){camera.position.set(7.2,4.5,10.5);orbit.target.set(0,2.6,0);orbit.update();invalidate();},
 // The UI needs at most three timing records, not a full geometry diagnostic.
 status(){return {strikes,paused:settings.paused,leader:bolts.some(s=>s.age<s.bolt.leaderDuration),returning:bolts.some(s=>s.age<s.bolt.strokes.at(-1)!.time+.08),afterglow:bolts.some(s=>s.age<s.bolt.strokes.at(-1)!.time+.7)};},diagnostics(){const first=bolts[0]!;return {frames,strikes,segments:channels.reduce((count,channel,i)=>count+(i<bolts.length?channel.count:0),0),attachedToDome:first.attached,generationMs,flash:flashEnergy,cloudFlash:cloud.material.uniforms.uFlash!.value,source:[...first.bolt.source],cloudPose:{offset:[...cloudPose.offset],scale:[...cloudPose.scale],shear:cloudPose.shear},leaderDuration:first.bolt.leaderDuration,strokes:first.bolt.strokes,fast:settings.fast,branching:settings.branching,concurrent:bolts.length,bolts:bolts.map(({bolt,age,attached})=>({seed:bolt.seed,source:[...bolt.source],contact:[...bolt.target],age,attached,leaderDuration:bolt.leaderDuration,lastStroke:bolt.strokes.at(-1)!.time,segments:bolt.segments.length,branchSegments:bolt.segments.filter(s=>s.branch>0).length,flash:pulse(age,bolt)})),camera:camera.position.toArray(),contact:[...first.bolt.target],time,age:first.age,untilStrike,paused:settings.paused,active,pendingFrame:!!raf,canvas:[width,height],cloud:[cloudTarget.width,cloudTarget.height]};},async capture(){draw(0);return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Unable to save this moment.')),'image/png'));},dispose(){if(disposed)return;disposed=true;stop();observer.disconnect();orbit.dispose();document.removeEventListener('visibilitychange',hidden);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerCancel);canvas.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof T.Mesh&&!channelMeshes.has(o)){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});for(const channel of channels)channel.dispose();metal.dispose();cloud.dispose();plane.dispose();composite.dispose();target.dispose();cloudTarget.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();}};
}
