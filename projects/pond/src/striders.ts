// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {rng,tau,uTime} from './shared';

/** Hair-thin legs, six contact dimples, and paired capillary waves left at each rowing stroke. */
export function createStriders(scene:T.Scene){
 const random=rng(829),size=.23,count=6,wind={value:.35},dummy=new T.Object3D(),up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),delta=new T.Vector3(),direction=new T.Vector3();
 const material=new T.MeshStandardMaterial({color:'#738d82',transparent:true,opacity:.46,roughness:.38,depthWrite:false});
 // A darker body stays readable without thickening the translucent hair-thin legs.
 const bodyMaterial=new T.MeshStandardMaterial({color:'#455e54',transparent:true,opacity:.68,roughness:.4,depthWrite:false});
 const bodies=new T.InstancedMesh(new T.SphereGeometry(1,8,6),bodyMaterial,count);
 // World-space tapered cylinders avoid WebGL's minimum one-pixel opaque line width.
 const legs=new T.InstancedMesh(new T.CylinderGeometry(.65,1,1,3),material,count*12);scene.add(bodies,legs);
 const waveCount=48,births=new Float32Array(waveCount).fill(-100),waveGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
 waveGeometry.setAttribute('aBirth',new T.InstancedBufferAttribute(births,1));
 const surfaceVertex=`uniform float uTime,uWind;varying vec2 vUv;varying float vAge;
 ${'attribute float aBirth;'}
 void main(){vUv=uv;vAge=uTime-aBirth;vec3 p=position;
 p*=.10+max(0.,vAge)*.23;
 vec4 world=modelMatrix*instanceMatrix*vec4(p,1.);
 world.y=.006+(sin(world.x*1.7+world.z*.7+uTime*.8)*.012+sin(world.x*.8-world.z*2.1-uTime*1.1)*.009)*(.4+uWind);
 gl_Position=projectionMatrix*viewMatrix*world;}`;
 const wakeMat=new T.ShaderMaterial({uniforms:{uTime,uWind:wind},transparent:true,depthWrite:false,side:T.DoubleSide,vertexShader:surfaceVertex,
  fragmentShader:`varying vec2 vUv;varying float vAge;
  void main(){if(vAge<0.||vAge>1.45||cameraPosition.y<.02)discard;
   vec2 p=(vUv-.5)*2.;float r=length(p*vec2(1.,.82));float aa=max(fwidth(r),.018);
   float crest=1.-smoothstep(aa,aa*2.5,abs(r-.76));
   float inner=1.-smoothstep(aa,aa*2.,abs(r-.51));
   float rear=mix(.30,1.,smoothstep(-.8,.55,p.y));
   float alpha=(crest+inner*.34)*rear*.36*(1.-smoothstep(.1,1.45,vAge));
   gl_FragColor=vec4(mix(vec3(.24,.36,.28),vec3(.80,.88,.72),crest),alpha);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const wakes=new T.InstancedMesh(waveGeometry,wakeMat,waveCount);wakes.frustumCulled=false;wakes.renderOrder=2;scene.add(wakes);
 // Dimples follow the tarsi; travelling waves keep their original world-space contact point.
 const contactMaterial=new T.MeshBasicMaterial({color:'#adc5b1',transparent:true,opacity:.23,side:T.DoubleSide,depthWrite:false});
 const contacts=new T.InstancedMesh(new T.RingGeometry(.62,1,16).rotateX(-Math.PI/2),contactMaterial,count*6);contacts.renderOrder=2;scene.add(contacts);
 const states=Array.from({length:count},()=>({phase:random()*tau,x:(random()-.5)*10,z:(random()-.5)*6,heading:random()*tau,target:random()*tau,until:0,stroke:0}));
 let cursor=0,emitted=0;
 function waterY(x:number,z:number,t:number){return .006+(Math.sin(x*1.7+z*.7+t*.8)*.012+Math.sin(x*.8-z*2.1-t*1.1)*.009)*(.4+wind.value);}
 function point(out:T.Vector3,s:typeof states[number],x:number,y:number,z:number,time:number){out.set(s.x+(Math.cos(s.heading)*x+Math.sin(s.heading)*z)*size,waterY(s.x,s.z,time)+y*size,s.z+(-Math.sin(s.heading)*x+Math.cos(s.heading)*z)*size);}
 function segment(index:number,from:T.Vector3,to:T.Vector3,radius:number){delta.subVectors(to,from);dummy.position.copy(from).add(to).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,direction.copy(delta).normalize());dummy.scale.set(radius,delta.length(),radius);dummy.updateMatrix();legs.setMatrixAt(index,dummy.matrix);}
 function stamp(x:number,z:number,heading:number,time:number){dummy.position.set(x,0,z);dummy.rotation.set(0,heading,0);dummy.scale.set(1,1,1.25);dummy.updateMatrix();wakes.setMatrixAt(cursor,dummy.matrix);births[cursor]=time;cursor=(cursor+1)%waveCount;emitted++;}
 return {count,diagnostics(){return {count,emitted,positions:states.map(s=>[s.x,waterY(s.x,s.z,uTime.value),s.z])};},update(dt:number,time:number,breeze:number){
  wind.value=breeze;
  states.forEach((s,i)=>{
   if(time>s.until){s.target=s.heading+(random()-.5)*2.7;if(Math.hypot(s.x/6.3,s.z/4.2)>.8)s.target=Math.atan2(-s.x,-s.z);s.until=time+2+random()*4;}
   const turn=Math.atan2(Math.sin(s.target-s.heading),Math.cos(s.target-s.heading));s.heading+=T.MathUtils.clamp(turn,-dt*2,dt*2);
   const stroke=Math.max(0,Math.sin(time*3.6+s.phase)),speed=.025+Math.pow(stroke,4)*.20,release=stroke>=.70&&s.stroke<.70;
   s.x+=Math.sin(s.heading)*speed*dt;s.z+=Math.cos(s.heading)*speed*dt;
   dummy.position.set(s.x,waterY(s.x,s.z,time)+.004,s.z);dummy.rotation.set(0,s.heading,0);dummy.scale.set(.010*size,.011*size,.093*size);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
   for(let j=0;j<6;j++){
    const side=j<3?-1:1,k=j%3;
    // Short front feelers, long rowing middle legs and rear stabilisers: no radial spider fan.
    const x=side*(k===0?.10:k===1?.34:.23),z=k===0?.10:k===1?.025-stroke*.16:-.21;
    point(a,s,side*.007,.018,(1-k)*.025,time);point(b,s,x*.52,.045,z*.48,time);segment(i*12+j*2,a,b,.00034);
    a.copy(b);point(b,s,x,-.012,z,time);segment(i*12+j*2+1,a,b,.00022);
    dummy.position.copy(b);dummy.position.y=waterY(b.x,b.z,time);dummy.rotation.set(0,s.heading,0);dummy.scale.set(.0065,1,.010);dummy.updateMatrix();contacts.setMatrixAt(i*6+j,dummy.matrix);
    if(release&&k===1)stamp(b.x,b.z,s.heading,time);
   }
   s.stroke=stroke;
  });
  for(const mesh of [bodies,legs,contacts,wakes])mesh.instanceMatrix.needsUpdate=true;
  waveGeometry.attributes.aBirth!.needsUpdate=true;
 }};
}
