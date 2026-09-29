// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { CatmullRomCurve3, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import type { OceanUniforms } from './shared';

export class OceanControls {
  readonly target=new Vector3(2,7.6,0);
  distance=23;
  targetDistance=23;
  cinematic=false;
  private tourTime=0;
  private roll=0;
  private desiredPosition=new Vector3();
  private desiredTarget=new Vector3();
  private offset=new Vector3();
  // Low angle reveal → wide orbit → pass inside the school → retreat above the reef.
  private tourPosition=new CatmullRomCurve3([
    new Vector3(1,5.8,16),new Vector3(-7,3.2,23),new Vector3(-14,5.8,15),
    new Vector3(-7,7.2,8),new Vector3(3,8,3),new Vector3(12,5.2,1),
    new Vector3(16,7,13),new Vector3(8,11,24),
  ],true,'catmullrom',.35);
  private tourLook=new CatmullRomCurve3([
    new Vector3(0,9,0),new Vector3(0,12,-1),new Vector3(1,10,0),
    new Vector3(0,9,-3),new Vector3(-2,9,-8),new Vector3(-2,8,0),
    new Vector3(0,8,1),new Vector3(0,7,0),
  ],true,'catmullrom',.4);
  private yaw=.06;
  private pitch=.06;
  private desiredYaw=.06;
  private desiredPitch=.06;
  private pointer=new Vector2(2,2);
  private raycaster=new Raycaster();
  private plane=new Plane();
  private direction=new Vector3();
  private hit=new Vector3();
  private pointers=new Map<number,{x:number;y:number}>();
  private start=new Vector2();
  private moved=false;
  private multiTouch=false;
  private pinchDistance=0;
  private lastPointerTime=-10000;
  private shockIndex=0;
  shockCount=0;
  private abort=new AbortController();
  private rect:DOMRect;
  constructor(private canvas:HTMLCanvasElement,private camera:PerspectiveCamera,private u:OceanUniforms,private requestFrame:()=>void){
    this.rect=canvas.getBoundingClientRect();
    const options={signal:this.abort.signal};
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.rect.height:1);
      this.zoom(Math.exp(Math.max(-250,Math.min(250,delta))*.0015));
    },{...options,passive:false});
    canvas.addEventListener('pointerdown',e=>{
      this.canvas.focus({preventScroll:true});this.refreshRect();this.setPointer(e);
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
      if(this.pointers.size===1){this.start.set(e.clientX,e.clientY);this.moved=false;this.multiTouch=false;}
      else {this.multiTouch=true;this.pinchDistance=this.pinchLength();}
    },options);
    canvas.addEventListener('pointermove',e=>{
      this.setPointer(e);
      const previous=this.pointers.get(e.pointerId);
      if(previous){
        const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
        previous.x=e.clientX;previous.y=e.clientY;
        if(this.pointers.size>=2){
          const next=this.pinchLength();if(this.pinchDistance>0&&next>0)this.zoom(this.pinchDistance/next);this.pinchDistance=next;
        }else if(!this.multiTouch){
          if(Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)>6)this.moved=true;
          if(this.moved){this.stopTour();this.desiredYaw-=dx*.004;this.desiredPitch=Math.max(-.65,Math.min(1.15,this.desiredPitch+dy*.004));}
        }
      }
      this.requestFrame();
    },options);
    canvas.addEventListener('pointerup',e=>{
      if(this.pointers.has(e.pointerId)&&!this.moved&&!this.multiTouch){this.setPointer(e);this.shock();}
      this.pointers.delete(e.pointerId);
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(e.pointerType!=='mouse')this.lastPointerTime=-10000;
    },options);
    canvas.addEventListener('pointercancel',()=>this.cancel(),options);
    canvas.addEventListener('lostpointercapture',e=>{this.pointers.delete(e.pointerId);},options);
    canvas.addEventListener('pointerleave',()=>{if(!this.pointers.size)this.lastPointerTime=-10000;},options);
    window.addEventListener('blur',()=>this.cancel(),options);
    this.tourPosition.getPoint(0,this.camera.position);this.tourLook.getPoint(0,this.target);this.update(0);
  }
  private setPointer(e:PointerEvent){
    // Pointer coordinates stay in CSS pixels. DPR belongs only to the drawing buffer.
    this.pointer.set((e.clientX-this.rect.left)/this.rect.width*2-1,-(e.clientY-this.rect.top)/this.rect.height*2+1);
    this.lastPointerTime=performance.now();
  }
  private pinchLength(){const values=[...this.pointers.values()];return values.length>1?Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y):0;}
  private shock(){
    this.raycaster.setFromCamera(this.pointer,this.camera);
    this.camera.getWorldDirection(this.direction);this.plane.setFromNormalAndCoplanarPoint(this.direction,this.target);
    if(this.raycaster.ray.intersectPlane(this.plane,this.hit)){
      this.u.shocks[this.shockIndex].value.set(this.hit.x,this.hit.y,this.hit.z,this.u.time.value);
      this.shockIndex=(this.shockIndex+1)%this.u.shocks.length;this.shockCount++;this.requestFrame();
    }
  }
  private stopTour(){
    if(!this.cinematic)return;
    this.cinematic=false;this.offset.copy(this.camera.position).sub(this.target);
    this.distance=this.targetDistance=this.offset.length();
    this.yaw=this.desiredYaw=Math.atan2(this.offset.x,this.offset.z);
    this.pitch=this.desiredPitch=Math.asin(this.offset.y/this.distance);
    this.canvas.dispatchEvent(new Event('cameramodechange'));
  }
  toggleCinematic(){
    if(this.cinematic)this.stopTour();else{this.cinematic=true;this.canvas.dispatchEvent(new Event('cameramodechange'));}
    this.requestFrame();
  }
  zoom(ratio:number){this.stopTour();this.targetDistance=Math.max(2.5,Math.min(55,this.targetDistance*ratio));this.requestFrame();}
  reset(){this.stopTour();this.target.set(0,9,0);this.targetDistance=23;this.desiredYaw=.04;this.desiredPitch=-.18;this.requestFrame();}
  refreshRect(){this.rect=this.canvas.getBoundingClientRect();}
  cancel(){this.pointers.clear();this.multiTouch=true;this.lastPointerTime=-10000;this.u.pointerPower.value=0;}
  update(dt:number,advanceTour=true){
    const ease=1-Math.exp(-dt*9);
    if(this.cinematic){
      if(advanceTour)this.tourTime+=dt;
      const progress=(this.tourTime%56)/56;
      this.tourPosition.getPoint(progress,this.desiredPosition);this.tourLook.getPoint(progress,this.desiredTarget);
      this.camera.position.lerp(this.desiredPosition,1-Math.exp(-dt*3));this.target.lerp(this.desiredTarget,1-Math.exp(-dt*2.2));
      this.distance=this.targetDistance=this.camera.position.distanceTo(this.target);
      this.roll+=(Math.sin(progress*Math.PI*4)*.035-this.roll)*ease;
    }else{
      this.distance+=(this.targetDistance-this.distance)*ease;
      this.yaw+=(this.desiredYaw-this.yaw)*ease;this.pitch+=(this.desiredPitch-this.pitch)*ease;
      this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,Math.max(1.3,Math.min(23,this.target.y+Math.sin(this.pitch)*this.distance)),this.target.z+Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance);
      this.roll+=(0-this.roll)*ease;
    }
    const fov=this.cinematic?64+Math.sin(this.tourTime/56*Math.PI*2)*4:64;
    if(Math.abs(this.camera.fov-fov)>.01){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    this.camera.up.set(Math.sin(this.roll),Math.cos(this.roll),0);
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer,this.camera);
    this.u.eye.value.copy(this.camera.position);this.u.rayOrigin.value.copy(this.raycaster.ray.origin);this.u.rayDirection.value.copy(this.raycaster.ray.direction);
    this.u.pointerPower.value=Math.max(0,1-(performance.now()-this.lastPointerTime)/650);
  }
  dispose(){this.cancel();this.abort.abort();}
}
