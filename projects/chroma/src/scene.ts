// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';
import {palettes,type Settings,type Mode} from './state';
import {createGeometries,columnProfile,ribbonProfile,waveProfile} from './geometry';
import {sequenceFrame} from './sequence';
import {createMorph} from './morph';
const vertex=`
uniform float uTime,uTwist,uAmp,uKind,uPhase,uCap;
uniform vec2 uSection;
varying vec3 vWorld,vLocal;varying float vCap,vFace;varying vec2 vUv;
void main(){
 vec3 p=position;vCap=max(abs(normal.y),uCap);vUv=uv;vFace=0.;
 if(uKind>0.5){
  float a=uSection.x+p.x/6.3*uSection.y;
  float y=p.y,z=p.z;p.y=y*cos(a)-z*sin(a);p.z=y*sin(a)+z*cos(a);
  // A shared centreline bend keeps the front broad and eases the silhouette
  // toward horizontal at either end of the reference frame.
  p.y+=sin(p.x/6.3*3.14159265)*.5*(uSection.y/1.65)*cos(uSection.x);
  vFace=normal.y>.5?1.:normal.y<-.5?3.:normal.z<-.5?2.:0.;vCap=0.;
 }else{
  p.y-=p.z*uSection.x;p.z*=uSection.y;
 }
 vLocal=p;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;
}`;
const fragment=`
uniform vec3 uWarm,uLight,uDeep,uAccent;uniform float uTime,uGrain,uKind,uHue;
uniform vec3 uRibbonWarm,uRibbonPink,uRibbonCream,uRibbonCool,uRibbonShade;uniform vec2 uSection;
varying vec3 vWorld,vLocal;varying float vCap,vFace;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
 vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
 float x=smoothstep(-2.6,2.6,vWorld.x+sin(uTime*.18+uHue)*.3);
 float y=smoothstep(-1.8,1.9,vWorld.y);
 vec3 top=mix(uWarm,uLight,x);
 vec3 col=mix(uDeep,top,y*.91+.08);
 float sweep=smoothstep(-.7,2.5,vWorld.x-vWorld.y*.3);
 col=mix(col,mix(uDeep,uAccent,sweep),uHue*.8);
 if(uKind>.5){
  // Colour belongs to a face of one continuous volume. Occlusion follows
  // geometry, rather than independent sheets swapping in front of each other.
  float across=clamp(vLocal.x/6.3+.5,0.,1.);
  float roll=abs(sin(uSection.x));
  vec3 foldedBlue=mix(uRibbonCool,uLight,.045+.045*sin(across*3.14159265));
  if(vFace<.5){
   col=mix(mix(uRibbonWarm,uRibbonPink,smoothstep(0.,.55,across)),uRibbonCream,smoothstep(.42,1.,across));
   col=mix(col,uRibbonShade,pow(vUv.y,1.8)*pow(1.-across,2.)*.99);
   col=mix(col,mix(uRibbonCream,vec3(1.),.4),pow(1.-vUv.y,2.)*across*.23);
  }else if(vFace<1.5){
   col=mix(mix(uWarm,uLight,smoothstep(0.,.45,across)),uRibbonCool,smoothstep(.4,1.,across));
   col=mix(foldedBlue,col,roll);
  }else if(vFace<2.5){
   col=mix(uWarm,uLight,across);
  }else{
   col=mix(foldedBlue,mix(uRibbonCool,uAccent,across),roll);
  }
  col+=pow(abs(vUv.y*2.-1.),40.)*.015;
 }else if(vCap>.5){
  float capLight=smoothstep(-.6,.6,-vLocal.x*.55-vLocal.z*.65);
  col=mix(uDeep,mix(uLight,vec3(1.),.48),capLight*.92);
  col=mix(col,uAccent,uHue*capLight*.75);
 }else{
  float light=dot(n,normalize(vec3(-.5,.8,1.)))*.5+.5;
  // Joined columns use symmetric fill: opposing tangent normals must not
  // introduce a light/dark stripe into the shared world-space colour field.
  col*=uKind<-.5 ? .97+.03*abs(n.z) : .83+.2*light;
 }
 float rim=pow(1.-abs(dot(n,normalize(cameraPosition-vWorld))),3.);
 col+=rim*.045*step(-.5,uKind)*(1.-step(.5,uKind));col+=(hash(gl_FragCoord.xy)-.5)*uGrain;
 gl_FragColor=vec4(max(col,vec3(0.)),1.);
 #include <colorspace_fragment>
}`;
export function createScene(canvas:HTMLCanvasElement,s:Settings,onMode:(mode:Mode)=>void,onError:(message:string)=>void){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setClearColor('#000000');renderer.outputColorSpace=THREE.SRGBColorSpace;
 const morph=createMorph(s);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.3,3.3,3.3,-3.3,.1,100),group=new THREE.Group();scene.add(group,morph.group);camera.position.set(0,1.4,10);camera.lookAt(0,0,0);
 const {cylinder,ribbon,cap,tube}=createGeometries();
 const meshes:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[];
 for(let i=0;i<32;i++){
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,uniforms:{uTime:{value:0},uAmp:{value:1},uTwist:{value:1},uKind:{value:0},uPhase:{value:0},uCap:{value:0},uSection:{value:new THREE.Vector2(0,1)},uGrain:{value:s.grain},uHue:{value:0},uWarm:{value:new THREE.Color()},uLight:{value:new THREE.Color()},uDeep:{value:new THREE.Color()},uAccent:{value:new THREE.Color()}}});
  const mesh=new THREE.Mesh(cylinder,material);mesh.visible=false;mesh.frustumCulled=false;meshes.push(mesh);group.add(mesh);
 }
 let reportedMode:Mode|undefined;
 function reportMode(){if(reportedMode!==mode){reportedMode=mode;onMode(mode);}}
 let time=0,frames=0,raf=0,last=0,paused=matchMedia('(prefers-reduced-motion:reduce)').matches,active=true,lost=false,disposed=false,mode:Mode='columns',width=0,height=0,pixelRatio=0;
 let yaw=0,pitch=0,pointer:number|null=null,px=0,py=0;
 function colors(){const c=palettes[s.palette];for(const m of meshes){const u=m.material.uniforms;['uWarm','uLight','uDeep','uAccent'].forEach((key,i)=>(u[key].value as THREE.Color).set(c[i]));
  const ribbonColors=s.palette==='spectral'?['#ee2348','#e568b5','#fff4cf','#3020b5','#640079']:[c[0],c[1],c[3],c[2],c[2]];
  ['uRibbonWarm','uRibbonPink','uRibbonCream','uRibbonCool','uRibbonShade'].forEach((key,i)=>{if(!u[key])u[key]={value:new THREE.Color()};(u[key].value as THREE.Color).set(ribbonColors[i]);});
 }}
 colors();
 function pose(m:typeof meshes[number],geometry:THREE.BufferGeometry,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0,kind=0,phase=0,hue=0){
  m.visible=true;m.geometry=geometry;m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);const u=m.material.uniforms;u.uCap.value=geometry===cap?1:0;u.uKind.value=kind;u.uPhase.value=phase;u.uHue.value=hue;(u.uSection.value as THREE.Vector2).set(0,1);
 }
 function renderStudy(studyMode:Mode,local:number,shaderTime:number,target:THREE.WebGLRenderTarget|null){
  const amp=s.amplitude;
  for(const m of meshes){m.visible=false;const u=m.material.uniforms;u.uTime.value=shaderTime;u.uAmp.value=amp;u.uTwist.value=s.twist;u.uGrain.value=s.grain;}
  const count=studyMode==='wave'?3:s.mode==='sequence'?(studyMode==='columns'?3:1):s.count;
  if(studyMode==='columns'){
   for(let i=0;i<count;i++){
    const p=columnProfile(i,count,local,amp,s.twist);
    pose(meshes[i],cylinder,p.x,0,0,p.radius,p.height,p.radius,p.roll,p.spin,0,-1);
   }
  }else if(studyMode==='ribbons'){
   const profile=ribbonProfile(local,amp,s.twist),scale=count===1?1:1.35/count;
   // The reference is an edge-to-edge band with cropped ends, viewed head-on.
   for(let i=0;i<count;i++){
    pose(meshes[i],ribbon,0,(i-(count-1)/2)*4.25/count,0,(camera.right-camera.left)*1.06/6.3,scale,scale,0,0,0,1);
    (meshes[i].material.uniforms.uSection.value as THREE.Vector2).set(profile.angle,profile.twist);
   }
  }else if(studyMode==='disc'){
   const h=.6+(.5+.5*Math.sin(local*1.55))*1.8*amp,split=(.5+.5*Math.sin(local*1.5-1.4))*amp*2.1;
   for(let i=0;i<count;i++){
    const x=count===1?0:(i-(count-1)/2)*5.2/count,r=count===1?2.35:2.45/count;
    const rx=Math.sin(local*1.35)*.5*amp;
    pose(meshes[i*3],tube,x,0,0,r,h,r,rx,0,0,0,0,.5+.5*Math.sin(local*.6));
    // Local cap translations follow the same tilt as the sleeve.
    for(let j=0;j<2;j++){const side=j===0?1:-1,dy=side*(h/2+split);pose(meshes[i*3+1+j],cap,x,dy*Math.cos(rx),dy*Math.sin(rx),r,r,r,rx,0,0,0,0,1);}
   }
  }else if(studyMode==='orbit'){
   // Wider, nearly circular orbit; keep room for the discs at full elasticity.
   const orbitRadius=Math.min(2.25,1.6+.55*amp);
   for(let i=0;i<count;i++){const a=local*.62+i*Math.PI*2/count;pose(meshes[i],cylinder,Math.cos(a)*orbitRadius,Math.sin(a)*orbitRadius,Math.sin(a*.7)*.35,.78,.2+(.5+.5*Math.sin(local*2+i))*.5,.78,.6+Math.sin(a)*.6,0,a*.35,0,0,(i%3)/2);}
  }else{
   for(let i=0;i<count;i++){
    const p=waveProfile(i,local,amp);
    pose(meshes[i],cylinder,p.x,p.y,0,p.radius,p.height,p.radius);
   }
  }
  group.rotation.set(pitch,yaw,0);
  camera.position.y=studyMode==='ribbons'?0:1.4;camera.lookAt(0,0,0);
  // Each layer keeps its own steady framing throughout the overlap.
  group.scale.setScalar(s.zoom*(studyMode==='disc'?.81:1));
  renderer.setRenderTarget(target);renderer.render(scene,camera);
 }
 function draw(){
  if(disposed||lost||!width||!height)return;
  const t=time+s.phase;
  morph.group.visible=s.mode==='sequence';group.visible=s.mode!=='sequence';
  if(s.mode==='sequence'){
   const state=morph.update(t,(camera.right-camera.left)*1.06);
   mode=state.blend<.5?state.from:state.to;reportMode();
   // One camera and one depth-tested scene throughout the geometric handoff.
   const fromY=state.from==='ribbons'?0:1.4,toY=state.to==='ribbons'?0:1.4;
   camera.position.y=THREE.MathUtils.lerp(fromY,toY,state.blend);camera.lookAt(0,0,0);
   morph.group.rotation.set(pitch,yaw,0);morph.group.scale.setScalar(s.zoom);
   renderer.setRenderTarget(null);renderer.render(scene,camera);
  }else{
   mode=s.mode;reportMode();renderStudy(mode,t,t,null);
  }
  frames++;
 }

 function frame(now:number){raf=0;if(disposed||lost||!active||document.hidden)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!paused)time+=dt*s.speed;draw();if(!paused&&s.speed>0)raf=requestAnimationFrame(frame);}
 function invalidate(){if(disposed||lost||!active||document.hidden||raf)return;raf=requestAnimationFrame(frame);}
 function stop(){cancelAnimationFrame(raf);raf=0;last=0;}
 function resize(){const w=Math.round(canvas.clientWidth),h=Math.round(canvas.clientHeight);if(!w||!h)return;const dpr=Math.min(devicePixelRatio,2,Math.sqrt(2200000/(w*h)));if(w===width&&h===height&&pixelRatio===dpr)return;width=w;height=h;pixelRatio=dpr;renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);const aspect=w/h,extent=aspect<1?3.15/aspect:3.15;camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();invalidate();}
 const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
 const visibility=()=>{stop();if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',visibility);
 const down=(e:PointerEvent)=>{if(e.button!==0||pointer!==null)return;pointer=e.pointerId;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);};
 const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;yaw+=(e.clientX-px)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-py)*.006,-1,1);px=e.clientX;py=e.clientY;invalidate();};
 const up=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,up as EventListener);
 const loss=(e:Event)=>{e.preventDefault();lost=true;stop();onError('The graphics context was interrupted. Reload to restore the studio.');};canvas.addEventListener('webglcontextlost',loss);
 return {
  update(){colors();invalidate();},restart(){time=0;yaw=0;pitch=0;last=0;invalidate();},
  setPaused(value:boolean){paused=value;stop();invalidate();},get paused(){return paused;},
  setActive(value:boolean){active=value;stop();if(value)invalidate();},
  setProgress(value:number){time=value;last=0;invalidate();},get time(){return time;},get frames(){return frames;},get mode(){return mode;},
  get transitionState(){return {technique:'vertex-morph',layers:1,targetPixels:0,sequence:s.mode==='sequence'?sequenceFrame(time+s.phase):null};},
  draw,canvas,
  snapshot(){draw();return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image capture unavailable.')),'image/png'));},
  dispose(){if(disposed)return;disposed=true;stop();ro.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.removeEventListener(event,up as EventListener);canvas.removeEventListener('webglcontextlost',loss);[cylinder,ribbon,cap,tube].forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());morph.dispose();renderer.dispose();},
 };
}
