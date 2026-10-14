// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildCassette,WIDTH,HEIGHT,DEPTH,type Cassette} from './cassette';
import {drawLabel,drawShadow} from './label';
import {clamp,initialReels,packRadii,stepReels,type Reels,type Shell,type Transport} from './settings';
const TURN=Math.PI*2/21;// one slow automatic revolution every 21 seconds
const axisAngle=(axis:THREE.Vector3,angle:number)=>new THREE.Quaternion().setFromAxisAngle(axis,angle);
const UP=new THREE.Vector3(0,1,0);
export class Viewer{
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(28,1,.1,60);
 private sway=new THREE.Group();
 private body=new THREE.Group();
 private cassette:Cassette;
 private shadow:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private environment:THREE.WebGLRenderTarget;
 private labelTexture:THREE.CanvasTexture|null=null;
 private orientation=new THREE.Quaternion();
 private rest=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.07,0,0));
 private spin={axis:new THREE.Vector3(0,1,0),speed:0};
 private returning=false;
 private reels:Reels=initialReels();
 private transport:Transport='rewind';
 private auto=true;
 private zoom=1;private baseDistance=7.3;private time=0;private last=0;private frame=0;private dirty=true;private disposed=false;private failed=false;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private controller=new AbortController();private resize:ResizeObserver;
 private pointers=new Set<number>();private pointer:number|null=null;private dragging=false;private grabbed=false;
 private startX=0;private startY=0;private lastX=0;private lastY=0;private lastMove=0;private radPerPx=.01;
 private corners=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>new THREE.Vector3(x*WIDTH/2,y*HEIGHT/2,z*DEPTH/2))));
 constructor(private host:HTMLElement,private report:(message:string)=>void,private onTransport:(transport:Transport)=>void){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0xffffff,1);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  host.append(this.renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
  this.environment=pmrem.fromScene(room,.035);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.7;this.scene.environmentRotation.set(.2,.6,0);
  room.dispose();pmrem.dispose();
  this.scene.add(new THREE.HemisphereLight(0xffffff,0xf1dbe9,.55));
  const key=new THREE.DirectionalLight(0xffffff,1.5);key.position.set(-3,5,6);this.scene.add(key);
  const rim=new THREE.DirectionalLight(0xe8e4ff,.9);rim.position.set(4,1.5,-6);this.scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffe8f4,.35);fill.position.set(3,-2,4);this.scene.add(fill);
  this.cassette=buildCassette();(this.cassette.label.uniforms.uKey!.value as THREE.Vector3).copy(key.position);
  this.body.add(this.cassette.group);this.sway.add(this.body);this.scene.add(this.sway);
  const shadowTexture=new THREE.CanvasTexture(drawShadow());
  this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  this.shadow.position.y=-HEIGHT/2-.42;this.scene.add(this.shadow);
  this.orientation.copy(this.rest);
  const signal=this.controller.signal;
  host.addEventListener('pointerdown',this.down,{signal});host.addEventListener('pointermove',this.move,{signal});host.addEventListener('pointerup',this.up,{signal});host.addEventListener('pointercancel',this.up,{signal});
  host.addEventListener('lostpointercapture',this.lost,{signal});host.addEventListener('wheel',this.wheel,{signal,passive:false});host.addEventListener('keydown',this.key,{signal});
  window.addEventListener('blur',this.cancel,{signal});document.addEventListener('visibilitychange',this.visibility,{signal});this.reduced.addEventListener('change',this.wake,{signal});
  this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost,{signal});
  this.resize=new ResizeObserver(()=>{this.cancel();this.size();});this.resize.observe(host);this.size();
 }
 private contextLost=(e:Event)=>{e.preventDefault();this.failed=true;cancelAnimationFrame(this.frame);this.frame=0;this.report('The graphics context was lost. Reload this page to restore the cassette.');};
 private size(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.fit();this.wake();}
 private fit(){
  const half=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
  this.baseDistance=clamp(Math.max(WIDTH*1.7/2/(half*this.camera.aspect),HEIGHT*2/2/half),5.6,16);
 }
 /** True when the visitor prefers reduced motion; autonomous turning and the default reel motion stay off. */
 get prefersStill(){return this.reduced.matches;}
 setTitle(title:string){const texture=new THREE.CanvasTexture(drawLabel(title));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.cassette.setLabel(texture);this.labelTexture?.dispose();this.labelTexture=texture;this.wake();}
 setShell(shell:Shell){this.cassette.setShell(shell);this.wake();}
 setHolo(value:number){this.cassette.label.uniforms.uHolo!.value=clamp(value,0,1.4);this.wake();}
 setAuto(auto:boolean){this.auto=auto;this.wake();}
 setTransport(transport:Transport){this.transport=transport;this.wake();}
 reset(){this.cancel();this.returning=true;this.spin.speed=0;this.zoom=1;this.wake();}
 private down=(e:PointerEvent)=>{
  if(e.button!==0)return;
  this.pointers.add(e.pointerId);this.host.setPointerCapture(e.pointerId);
  if(this.pointers.size>1){this.abandon();return;}
  this.pointer=e.pointerId;this.startX=this.lastX=e.clientX;this.startY=this.lastY=e.clientY;this.lastMove=e.timeStamp;
  // Sensitivity is fixed per gesture: dragging across the stage turns the cassette about 165°.
  this.radPerPx=2.9/Math.max(this.host.clientWidth,200);
  this.dragging=e.pointerType!=='touch';this.grabbed=true;this.spin.speed=0;this.returning=false;this.wake();
 };
 private move=(e:PointerEvent)=>{
  if(this.pointer!==e.pointerId||this.pointers.size!==1)return;
  if(!this.dragging){
   const dx=e.clientX-this.startX,dy=e.clientY-this.startY;if(Math.hypot(dx,dy)<8)return;
   // Mostly vertical touch movement belongs to the page.
   if(Math.abs(dx)<Math.abs(dy)*1.2){this.abandon();this.wake();return;}
   this.dragging=true;this.lastX=e.clientX;this.lastY=e.clientY;this.lastMove=e.timeStamp;
  }
  const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;if(!dx&&!dy)return;
  this.lastX=e.clientX;this.lastY=e.clientY;
  const angle=this.rotate(dx,dy);
  const dt=clamp((e.timeStamp-this.lastMove)/1000,.004,.1);this.lastMove=e.timeStamp;
  this.spin.axis.set(dy,dx,0).normalize();this.spin.speed=Math.min(angle/dt,9);
  this.wake();
 };
 /** Screen-space drag → world-space rotation; the surface follows the pointer like a globe. */
 private rotate(dx:number,dy:number){const angle=Math.hypot(dx,dy)*this.radPerPx;this.orientation.premultiply(axisAngle(new THREE.Vector3(dy,dx,0).normalize(),angle)).normalize();return angle;}
 private up=(e:PointerEvent)=>{
  this.pointers.delete(e.pointerId);if(this.host.hasPointerCapture(e.pointerId))this.host.releasePointerCapture(e.pointerId);
  if(this.pointer===e.pointerId){this.pointer=null;if(!this.dragging||e.timeStamp-this.lastMove>80)this.spin.speed=0;this.dragging=false;}
  if(!this.pointers.size)this.grabbed=false;this.wake();
 };
 private lost=(e:PointerEvent)=>{if(e.target===this.host&&this.pointers.has(e.pointerId))this.up(e);};
 /** Give up the current drag without a fling: a second finger, a vertical page stroke, blur or resize. */
 private abandon(){this.pointer=null;this.dragging=false;this.grabbed=false;this.spin.speed=0;}
 private cancel=()=>{this.abandon();const ids=[...this.pointers];this.pointers.clear();for(const id of ids)if(this.host.hasPointerCapture(id))this.host.releasePointerCapture(id);};
 private wheel=(e:WheelEvent)=>{e.preventDefault();const step=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*Math.max(this.host.clientHeight,200):e.deltaY;this.zoom=clamp(this.zoom*Math.exp(step*.0011),.7,1.7);this.wake();};
 private key=(e:KeyboardEvent)=>{
  const k=e.key;if(k.toLowerCase()==='r'){e.preventDefault();this.reset();return;}
  const map:Record<string,[number,number]>={ArrowLeft:[-26,0],ArrowRight:[26,0],ArrowUp:[0,-26],ArrowDown:[0,26]};const step=map[k];if(!step)return;
  e.preventDefault();this.returning=false;this.spin.speed=0;this.radPerPx=2.9/Math.max(this.host.clientWidth,200);this.rotate(step[0],step[1]);this.wake();
 };
 private visibility=()=>{this.cancel();if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}else this.wake();};
 private wake=()=>{this.dirty=true;if(!this.frame&&!this.disposed&&!this.failed)this.frame=requestAnimationFrame(this.draw);};
 private draw=(now:number)=>{
  this.frame=0;if(this.disposed||this.failed)return;
  const dt=this.last?Math.min((now-this.last)/1000,.05):.016;this.last=now;
  const still=this.reduced.matches,free=!this.grabbed;let moving=false;
  if(free&&this.spin.speed>0){this.orientation.premultiply(axisAngle(this.spin.axis,this.spin.speed*dt)).normalize();this.spin.speed*=Math.exp(-3.2*dt);if(this.spin.speed<.012)this.spin.speed=0;moving=true;}
  if(free&&this.returning&&!this.spin.speed){this.orientation.slerp(this.rest,still?1:1-Math.exp(-7*dt));if(this.orientation.angleTo(this.rest)<.003){this.orientation.copy(this.rest);this.returning=false;}else moving=true;}
  const wandering=free&&this.auto&&!still&&!this.spin.speed&&!this.returning;
  if(wandering){this.time+=dt;this.orientation.premultiply(axisAngle(UP,TURN*dt)).normalize();moving=true;}
  // Gentle rocking and float ride on a parent group so they never fight the user's rotation.
  const rockX=wandering?Math.sin(this.time*.55)*.16:0,rockZ=wandering?Math.sin(this.time*.37)*.045:0,lift=wandering?Math.sin(this.time*.8)*.03:0;
  const k=still?1:1-Math.exp(-4*dt);
  this.sway.rotation.x+=(rockX-this.sway.rotation.x)*k;this.sway.rotation.z+=(rockZ-this.sway.rotation.z)*k;this.sway.position.y+=(lift-this.sway.position.y)*k;
  if(Math.abs(rockX-this.sway.rotation.x)>.0005||Math.abs(rockZ-this.sway.rotation.z)>.0005||Math.abs(lift-this.sway.position.y)>.0005)moving=true;
  if(this.transport!=='stop'){const step=stepReels(this.reels,this.transport,dt);this.reels=step.reels;if(step.reversed){this.transport=step.transport;this.onTransport(step.transport);}moving=true;}
  const {left,right}=packRadii(this.reels.fraction);
  this.cassette.left.group.rotation.z=this.reels.angleLeft;this.cassette.right.group.rotation.z=this.reels.angleRight;this.cassette.setTape(left,right);
  this.body.quaternion.copy(this.orientation);
  this.updateShadow();
  this.camera.position.set(0,.3,this.baseDistance*this.zoom);this.camera.lookAt(0,-.08,0);
  if(this.dirty||moving){this.renderer.render(this.scene,this.camera);this.dirty=false;}
  if(moving&&!document.hidden)this.frame=requestAnimationFrame(this.draw);else this.last=0;
 };
 /** Contact shadow follows the rotated footprint of the slab. */
 private updateShadow(){
  let x=0,z=0;const v=new THREE.Vector3();
  for(const corner of this.corners){v.copy(corner).applyQuaternion(this.orientation);x=Math.max(x,Math.abs(v.x));z=Math.max(z,Math.abs(v.z));}
  this.shadow.scale.set(x*2*1.08+.7,1,z*2*1.1+1.1);
  this.shadow.material.opacity=clamp(1.05-this.sway.position.y*6,.6,1);
 }
 async snapshot():Promise<Blob>{
  if(this.failed)throw new Error('Reload the page to restore the graphics context before saving.');
  const size=this.renderer.getSize(new THREE.Vector2()),ratio=this.renderer.getPixelRatio();
  try{this.renderer.setPixelRatio(1);const scale=1600/Math.max(size.x,size.y);this.renderer.setSize(Math.round(size.x*scale),Math.round(size.y*scale),false);this.renderer.render(this.scene,this.camera);
   return await new Promise<Blob>((resolve,reject)=>this.renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('Could not save this picture.')),'image/png'));
  }finally{this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.wake();}
 }
 dispose(){this.disposed=true;this.cancel();this.controller.abort();this.resize.disconnect();cancelAnimationFrame(this.frame);this.cassette.dispose();this.labelTexture?.dispose();this.shadow.geometry.dispose();this.shadow.material.map?.dispose();this.shadow.material.dispose();this.environment.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
