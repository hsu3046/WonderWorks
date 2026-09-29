// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import type { BoatPose } from './navigation';

/** Independent water-surface stamps avoid ribbon folds and bright polygon seams. */
export function createWake(scene:T.Scene,waterMaterial?:T.ShaderMaterial){
 const count=96,life=6.5;
 const samples=Array.from({length:count},()=>({x:0,z:0,heading:0,born:-100,power:0}));
 const ages=new Float32Array(count),power=new Float32Array(count),seeds=Float32Array.from({length:count},(_,i)=>i*.6180339);
 const geometry=new T.PlaneGeometry(2,2,32,24);
 geometry.setAttribute('age',new T.InstancedBufferAttribute(ages,1));geometry.setAttribute('power',new T.InstancedBufferAttribute(power,1));geometry.setAttribute('seed',new T.InstancedBufferAttribute(seeds,1));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{
   waterColor:waterMaterial?.uniforms.waterColor??{value:new T.Color('#224f48')},
   sunColor:waterMaterial?.uniforms.sunColor??{value:new T.Color('#ffcc88')},
   sunDirection:waterMaterial?.uniforms.sunDirection??{value:new T.Vector3(.6,.2,-.8).normalize()},
   skyColor:{value:scene.fog?.color??new T.Color('#b1bdae')}
  },
  vertexShader:`attribute float age;attribute float power;attribute float seed;varying vec2 vUv;varying float vAge;varying float vPower;varying float vSeed;varying vec3 vWorld;varying vec3 vNormal;
  float elevation(vec2 p){float r=length(p);float wobble=sin(atan(p.y,p.x)*5.+seed*13.+age*1.8)*.025;
   float crest=exp(-pow((r-.62+wobble)/.14,2.))*smoothstep(-.6,.25,p.y);
   return crest*smoothstep(0.,.2,age)*exp(-age*.62)*power*.22;
  }
  void main(){
   vUv=uv;vAge=age;vPower=power;vSeed=seed;
   vec2 p=uv*2.-1.;float h=elevation(p);
   float dx=(elevation(p+vec2(.006,0.))-elevation(p-vec2(.006,0.)))/.012;
   float dy=(elevation(p+vec2(0.,.006))-elevation(p-vec2(0.,.006)))/.012;
   mat4 transform=modelMatrix*instanceMatrix;
   vec3 lifted=position;lifted.z+=h;
   vec4 world=transform*vec4(lifted,1.);vWorld=world.xyz;
   vNormal=normalize(cross(mat3(transform)*vec3(1.,0.,dx),mat3(transform)*vec3(0.,1.,dy)));
   gl_Position=projectionMatrix*viewMatrix*world;
  }`,
  fragmentShader:`uniform vec3 waterColor,sunColor,sunDirection,skyColor;varying vec3 vWorld;varying vec3 vNormal;varying vec2 vUv;varying float vAge;varying float vPower;varying float vSeed;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
  void main(){
   vec2 p=vUv*2.-1.;float r=length(p);float n=noise(p*7.+vSeed*31.+vec2(vAge*.35,-vAge*.2));
   float ripple=exp(-pow((r-.62+(n-.5)*.13)/.085,2.));
   // Broken crescent, soft on both edges; the centre stays mostly transparent.
   float arc=smoothstep(-.6,.35,p.y)*(.12+.88*smoothstep(.28,.72,n));
   float foam=exp(-dot(p,p)*8.)*smoothstep(.57,.83,noise(p*23.+vSeed*13.))*exp(-vAge*1.8);
   float fade=smoothstep(0.,.35,vAge)*pow(max(0.,1.-vAge/6.5),2.);
   float edge=1.-smoothstep(.83,1.,r);
   float height=max(0.,vWorld.y-.065);
   vec3 normal=normalize(vNormal);if(normal.y<0.)normal=-normal;
   vec3 viewDir=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,dot(normal,viewDir)),3.);
   float glint=pow(max(0.,dot(reflect(-sunDirection,normal),viewDir)),55.);
   vec3 water=mix(waterColor*.9,skyColor*.5,.1+fresnel*.28)+sunColor*glint*.18;
   float foamAmount=ripple*arc*.065+foam*.14;
   float surface=min(1.,height*8.)*.30;
   float opacity=(surface+foamAmount)*vPower*fade*edge;
   gl_FragColor=vec4(mix(water,skyColor*.85,clamp(foamAmount*3.,0.,.5)),opacity);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const mesh=new T.InstancedMesh(geometry,material,count);mesh.name='SoftSternRipples';mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
 const spray=createSpray(scene,waterMaterial);
 const dummy=new T.Object3D();let head=0,lastSample=-100,lastX=0,lastZ=0;
 function reset(){spray.reset();samples.forEach(s=>{s.born=-100;s.power=0;});head=0;lastSample=-100;}
 function update(time:number,pose:BoatPose){
  spray.update(time,pose);
  const speed=Math.abs(pose.speed),direction=pose.speed<0?-1:1;
  const x=pose.x-Math.sin(pose.heading)*1.85*direction,z=pose.z-Math.cos(pose.heading)*1.85*direction;
  // Spatial spacing prevents stationary/coasting samples piling into a bright patch.
  if(speed>.065&&time-lastSample>.12&&(lastSample<0||Math.hypot(x-lastX,z-lastZ)>.43+(head*.6180339%1)*.17)){
   Object.assign(samples[head],{x,z,heading:pose.heading+(direction<0?Math.PI:0),born:time,power:Math.min(1,speed*.4)});head=(head+1)%count;lastSample=time;lastX=x;lastZ=z;
  }
  for(let i=0;i<count;i++){
   const s=samples[i],age=time-s.born,visible=age>=0&&age<life;
   ages[i]=Math.max(0,age);power[i]=visible?s.power:0;
   dummy.position.set(s.x,.065,s.z);dummy.rotation.set(-Math.PI/2,0,-s.heading);
   const size=visible?(.65+age*.36)*(.94+(seeds[i]%1)*.12):0;dummy.scale.set(size,size*.6,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;geometry.getAttribute('age').needsUpdate=true;geometry.getAttribute('power').needsUpdate=true;
 }
 return {update,reset};
}

/** Small ballistic droplets shed from the bow; no allocation or CPU particle integration per frame. */
function createSpray(scene:T.Scene,water?:T.ShaderMaterial){
 const count=256,positions=new Float32Array(count*3),velocities=new Float32Array(count*3),birth=new Float32Array(count).fill(-100),sizes=new Float32Array(count);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('velocity',new T.BufferAttribute(velocities,3));geometry.setAttribute('born',new T.BufferAttribute(birth,1));geometry.setAttribute('radius',new T.BufferAttribute(sizes,1));
 const clock={value:0};
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock,light:water?.uniforms.sunColor??{value:new T.Color('#ffcc88')}},
  vertexShader:`attribute vec3 velocity;attribute float born,radius;uniform float clock;varying float vAlpha;
  void main(){float age=max(0.,clock-born);vec3 p=position+velocity*age;p.y-=2.8*age*age;
   vAlpha=(1.-smoothstep(.25,.7,age))*smoothstep(.045,.1,p.y)*smoothstep(0.,.035,age);
   vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
   gl_PointSize=clamp(radius*650./max(1.,-mv.z),1.,9.);if(age>.75)gl_PointSize=0.;
  }`,
  fragmentShader:`uniform vec3 light;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;float soft=exp(-r*r*3.)*(1.-smoothstep(.5,1.,r));gl_FragColor=vec4(mix(vec3(.6,.75,.72),light,.3),soft*vAlpha*.62);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const points=new T.Points(geometry,material);points.name='BowSpray';points.frustumCulled=false;scene.add(points);
 let head=0,last=-100,serial=0;
 const rand=(i:number)=>{const x=Math.sin(i*127.1+31.7)*43758.5453;return x-Math.floor(x);};
 function reset(){birth.fill(-100);geometry.getAttribute('born').needsUpdate=true;last=-100;head=0;serial=0;}
 function update(time:number,pose:BoatPose){
  clock.value=time;const speed=Math.abs(pose.speed);if(speed<.4||time-last<.045)return;last=time;
  const direction=pose.speed<0?-1:1,fx=Math.sin(pose.heading)*direction,fz=Math.cos(pose.heading)*direction,rx=Math.cos(pose.heading),rz=-Math.sin(pose.heading);
  for(let i=0;i<4;i++){
   const side=i%2?1:-1,a=rand(++serial),b=rand(serial+41),c=rand(serial+79),k=head*3;
   positions.set([pose.x+fx*(1.15+a*.3)+rx*side*.53,.08,pose.z+fz*(1.15+a*.3)+rz*side*.53],k);
   const spread=(.25+b*.5)*Math.min(1.5,speed*.45);
   velocities.set([rx*side*spread-fx*speed*.12,.5+speed*(.2+c*.2),rz*side*spread-fz*speed*.12],k);
   birth[head]=time;sizes[head]=(.018+a*.03)*Math.min(1.3,speed*.5);head=(head+1)%count;
  }
  for(const name of ['position','velocity','born','radius'])geometry.getAttribute(name).needsUpdate=true;
 }
 return {update,reset};
}
