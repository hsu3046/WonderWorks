// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';
import {vertex,fragment} from './shaders';
import {clamp,region,type Settings} from './settings';
export class Viewer{
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(30,1,.1,100);
  private material:THREE.ShaderMaterial;
  private card:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
  private texture:THREE.CanvasTexture|null=null;
  private target=new THREE.Vector2(.12,-.1);
  private pose=new THREE.Vector2(.12,-.1);
  private motion=false;private hovering=false;private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private resize:ResizeObserver;private controller=new AbortController();private frame=0;private last=0;private time=0;private dirty=true;private disposed=false;private failed=false;
  private pointers=new Set<number>();private pointer:number|null=null;private startX=0;private startY=0;private startPose=new THREE.Vector2();private dragging=false;private aspect=5/7;
  constructor(private host:HTMLElement,private report:(message:string)=>void){
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x000000,0);this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    this.camera.position.z=8;
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,uniforms:{uImage:{value:null},uTilt:{value:new THREE.Vector2()},uFinish:{value:0},uIntensity:{value:.72},uScale:{value:1},uGlare:{value:.38},uGrain:{value:.45},uEdge:{value:.45},uZone:{value:0},uCompare:{value:0},uAspect:{value:this.aspect},uRegion:{value:new THREE.Vector4(.075,.16,.925,.64)}}});
    this.card=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.material);this.scene.add(this.card);
    host.append(this.renderer.domElement);this.renderer.domElement.style.filter='drop-shadow(14px 24px 17px #0008)';
    const signal=this.controller.signal;
    host.addEventListener('pointerdown',this.down,{signal});host.addEventListener('pointermove',this.move,{signal});host.addEventListener('pointerup',this.up,{signal});host.addEventListener('pointercancel',this.up,{signal});
    host.addEventListener('lostpointercapture',this.lost,{signal});host.addEventListener('pointerleave',this.leave,{signal});host.addEventListener('keydown',this.key,{signal});
    window.addEventListener('blur',this.cancel,{signal});document.addEventListener('visibilitychange',this.visibility,{signal});this.reduced.addEventListener('change',this.wake,{signal});
    this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost,{signal});
    this.resize=new ResizeObserver(()=>{this.cancel();this.size();});this.resize.observe(host);this.size();
  }
  private contextLost=(e:Event)=>{e.preventDefault();this.failed=true;cancelAnimationFrame(this.frame);this.frame=0;this.report('The graphics context was lost. Reload this page to restore the card.');};
  private size(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.fit();this.wake();}
  private fit(){const visibleHeight=2*Math.tan(THREE.MathUtils.degToRad(15))*this.camera.position.z;const h=Math.min(visibleHeight*.78,visibleHeight*this.camera.aspect*.64/this.aspect);this.card.scale.set(h*this.aspect,h,1);}
  setImage(canvas:HTMLCanvasElement){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.NoColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.texture?.dispose();this.texture=texture;this.aspect=canvas.width/canvas.height;this.material.uniforms.uImage!.value=texture;this.material.uniforms.uAspect!.value=this.aspect;this.fit();this.wake();}
  update(s:Settings){const u=this.material.uniforms;u.uFinish!.value=s.finish;u.uIntensity!.value=s.intensity;u.uScale!.value=s.scale;u.uGlare!.value=s.glare;u.uGrain!.value=s.grain;u.uEdge!.value=s.edge;u.uZone!.value=['full','art','reverse'].indexOf(s.zone);u.uCompare!.value=s.compare?1:0;(u.uRegion!.value as THREE.Vector4).fromArray(region(s.top,s.bottom,s.left,s.right));this.motion=s.motion;this.wake();}
  reset(){this.cancel();this.hovering=false;this.target.set(0,0);this.wake();}
  private hit(x:number,y:number){const r=this.host.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);this.card.updateMatrixWorld();return ray.intersectObject(this.card).length>0;}
  private down=(e:PointerEvent)=>{
    if(e.button!==0)return;
    if(this.pointers.size||this.hit(e.clientX,e.clientY)){
      this.pointers.add(e.pointerId);this.host.setPointerCapture(e.pointerId);
      if(this.pointers.size>1){this.pointer=null;this.dragging=false;this.hovering=false;return;}
      this.pointer=e.pointerId;this.startX=e.clientX;this.startY=e.clientY;this.startPose.copy(this.pose);this.target.copy(this.pose);this.dragging=e.pointerType!=='touch';this.hovering=true;
    }
  };
  private move=(e:PointerEvent)=>{
    if(this.pointers.size>1)return;
    if(this.pointer===e.pointerId){
      const dx=e.clientX-this.startX,dy=e.clientY-this.startY;
      if(!this.dragging){if(Math.hypot(dx,dy)<8)return;if(Math.abs(dx)<Math.abs(dy)*1.2){this.pointer=null;this.hovering=false;return;}this.dragging=true;}
      this.target.set(clamp(this.startPose.x+dx*.003,-.58,.58),clamp(this.startPose.y-dy*.003,-.5,.5));this.wake();
    }else if(!this.pointers.size&&e.pointerType!=='touch'&&this.hit(e.clientX,e.clientY)){
      const r=this.host.getBoundingClientRect();this.hovering=true;this.target.set(clamp(((e.clientX-r.left)/r.width-.5)*1.35,-.5,.5),clamp(-((e.clientY-r.top)/r.height-.5)*1.1,-.42,.42));this.wake();
    }else if(!this.pointers.size&&this.hovering)this.leave();
  };
  private up=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);if(this.host.hasPointerCapture(e.pointerId))this.host.releasePointerCapture(e.pointerId);if(this.pointer===e.pointerId){this.pointer=null;this.dragging=false;}if(!this.pointers.size){this.hovering=false;this.wake();}};
  private lost=(e:PointerEvent)=>{if(e.target===this.host&&this.pointers.has(e.pointerId))this.up(e);};
  private leave=()=>{if(this.pointers.size)return;this.hovering=false;this.target.set(.12,-.1);this.wake();};
  private cancel=()=>{this.pointer=null;this.dragging=false;this.hovering=false;const pointers=[...this.pointers];this.pointers.clear();for(const id of pointers)if(this.host.hasPointerCapture(id))this.host.releasePointerCapture(id);};
  private key=(e:KeyboardEvent)=>{const k=e.key;if(k.toLowerCase()==='r'){e.preventDefault();this.reset();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k))return;e.preventDefault();this.hovering=true;if(k==='ArrowLeft')this.target.x-=.08;if(k==='ArrowRight')this.target.x+=.08;if(k==='ArrowUp')this.target.y+=.08;if(k==='ArrowDown')this.target.y-=.08;this.target.x=clamp(this.target.x,-.58,.58);this.target.y=clamp(this.target.y,-.5,.5);this.wake();};
  private visibility=()=>{this.cancel();if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}else this.wake();};
  private wake=()=>{this.dirty=true;if(!this.frame&&!this.disposed&&!this.failed&&!document.hidden)this.frame=requestAnimationFrame(this.draw);};
  private draw=(now:number)=>{
    this.frame=0;if(this.disposed||this.failed||document.hidden)return;
    const dt=this.last?Math.min((now-this.last)/1000,.05):.016;this.last=now;
    const moving=this.motion&&!this.reduced.matches&&!this.hovering&&!this.pointers.size;
    if(moving){this.time+=dt;this.target.set(Math.sin(this.time*.7)*.34,Math.cos(this.time*.51)*.19);}
    this.pose.lerp(this.target,this.reduced.matches?1:1-Math.exp(-9*dt));
    this.card.rotation.set(this.pose.y,this.pose.x,-this.pose.x*.045);
    (this.material.uniforms.uTilt!.value as THREE.Vector2).set(this.pose.x*2.7,this.pose.y*2.7);
    const unsettled=this.pose.distanceToSquared(this.target)>.000001;
    if(this.dirty||moving||unsettled){this.renderer.render(this.scene,this.camera);this.dirty=false;}
    if(moving||unsettled)this.frame=requestAnimationFrame(this.draw);else this.last=0;
  };
  async snapshot():Promise<Blob>{
    if(this.failed)throw new Error('Reload the page to restore the graphics context before saving.');
    // Render synchronously at export resolution; the visible canvas is restored immediately.
    const size=this.renderer.getSize(new THREE.Vector2()),ratio=this.renderer.getPixelRatio();
    try{this.renderer.setPixelRatio(1);const scale=1600/Math.max(size.x,size.y);this.renderer.setSize(Math.round(size.x*scale),Math.round(size.y*scale),false);this.renderer.render(this.scene,this.camera);
      const blob=await new Promise<Blob>((resolve,reject)=>this.renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('Could not save this reflection.')),'image/png'));return blob;
    }finally{this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.wake();}
  }
  dispose(){this.disposed=true;this.cancel();this.controller.abort();this.resize.disconnect();cancelAnimationFrame(this.frame);this.texture?.dispose();this.material.dispose();this.card.geometry.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
