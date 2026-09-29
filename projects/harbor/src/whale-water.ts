// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {whaleMotion,WHALE_IMPACT_PHASE,WHALE_SCALE} from './wildlife-motion.ts';

type WhalePose=ReturnType<typeof whaleMotion>;
/** Fixed GPU pools share scene time; no extra animation loop or reflection render. */
export function createWhaleWater(scene:T.Scene,water:T.ShaderMaterial){
 const uniforms={time:{value:0},phase:{value:0},breath:{value:-1},heading:{value:0},
  blow:{value:new T.Vector3()},fluke:{value:new T.Vector3()},body:{value:new T.Vector3()},impact:{value:new T.Vector3()},
  tint:water.uniforms.sunColor,waterTint:water.uniforms.waterColor};
 const count=2800,seeds=new Float32Array(count*4);
 for(let i=0;i<count;i++)seeds.set([(i*.618033989)%1,(i*.414213562)%1,(i*.732050808)%1,i<900?0:i<1500?1:2],i*4);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(count*3),3));geo.setAttribute('seed',new T.BufferAttribute(seeds,4));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
 vertexShader:`attribute vec4 seed;uniform float time,phase,breath,heading;uniform vec3 blow,fluke,impact;varying float opacity;varying float softness;
 void main(){float angle=seed.y*6.2831853;vec3 p;float size;float alpha;float age;
  if(seed.w<.5){
   age=breath*5.-seed.x*2.5;float a=max(age,0.);float life=3.1+seed.z*.6;
   // A narrow jet opens into a wind-carried plume; fine spray outlives the core.
   float fan=a*a*(.19+seed.z*.23);
   p=blow+vec3(cos(angle)*fan+a*a*.19,a*(8.4+seed.z*3.4)-3.05*a*a,sin(angle)*fan+a*.35);
   alpha=step(0.,age)*(1.-smoothstep(life*.55,life,a))*step(0.,breath);
   softness=step(.26,seed.z);size=mix(.045+seed.z*.08,.15+a*.34,softness);
   opacity=alpha*mix(.7,.25,softness);
  }else if(seed.w<1.5){
   age=fract(time*.63+seed.x)*1.58;
   vec3 spread=vec3(cos(heading),0.,-sin(heading))*(seed.y-.5)*9.4;
   p=fluke+spread+vec3(sin(angle)*age*.24,-age*age*3.8,cos(angle)*age*.28);
   opacity=smoothstep(20.,22.,phase)*(1.-smoothstep(27.5,29.,phase))*smoothstep(.08,.3,p.y)*.5;
   softness=0.;size=.04+seed.z*.09;
  }else{
   age=phase-${WHALE_IMPACT_PHASE.toFixed(1)}-seed.x*.85;float a=max(age,0.);
   float speed=1.6+seed.z*5.;float launch=2.4+seed.z*5.5;
   vec2 direction=vec2(cos(angle),sin(angle));
   p=impact+vec3(direction.x*(.3+a*speed),a*launch-4.2*a*a,direction.y*(.3+a*speed));
   opacity=step(0.,age)*smoothstep(.03,.24,p.y)*(1.-smoothstep(1.4,2.4,a))*.7;
   softness=step(.78,seed.z);opacity*=mix(1.,.28,softness);size=mix(.035+seed.z*.055,.16+a*.2,softness);
  }
  vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
  gl_PointSize=opacity>.001?clamp(size*850./max(1.,-mv.z),1.,52.):0.;
 }`,fragmentShader:`uniform vec3 tint;varying float opacity;varying float softness;
 void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||opacity<.001)discard;
  float shape=mix(1.-smoothstep(.2,1.,r),exp(-r*r*3.)*(1.-smoothstep(.75,1.,r)),softness);
  gl_FragColor=vec4(mix(vec3(.68,.83,.85),tint,.28),shape*opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const spray=new T.Points(geo,material);spray.name='WhaleBreathAndSplash';spray.frustumCulled=false;scene.add(spray);

 // Annular grids have actual height. Expanding crests leave broken foam in their troughs.
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];const segments=128,bands=12;
 for(let y=0;y<=bands;y++)for(let x=0;x<=segments;x++){positions.push(0,0,0);uvs.push(x/segments,y/bands);if(y<bands&&x<segments){const i=y*(segments+1)+x;indices.push(i,i+1,i+segments+1,i+1,i+segments+2,i+segments+1);}}
 const waveGeo=new T.BufferGeometry();waveGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));waveGeo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));waveGeo.setIndex(indices);waveGeo.setAttribute('wave',new T.InstancedBufferAttribute(new Float32Array([0,1,2,3,4,5,6,7]),1));
 const waveMat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,
 vertexShader:`attribute float wave;uniform float phase,time,heading;uniform vec3 body,impact;varying vec2 waveUv;varying float strength;varying float crest;varying float life;varying float sheet;
 void main(){float angle=uv.x*6.2831853;float age;float radius;float height;vec3 origin;vec2 stretch;sheet=step(5.5,wave);
  if(wave<3.){age=phase-(phase>18.?18.:1.)-wave*.7;life=age/10.;origin=body;radius=2.+max(age,0.)*.67;stretch=vec2(1.,2.2);height=.22;}
  else{age=phase-26.5-(wave-3.)*.62;life=age/8.5;origin=impact;radius=1.+max(age,0.)*1.2;stretch=vec2(1.,.82);height=.52;}
  strength=step(0.,age)*smoothstep(0.,.6,age)*(1.-smoothstep(.25,1.,life));
  float width=1.25+max(age,0.)*.1;float radial=radius+(uv.y-.5)*width;
  float noise=sin(angle*9.+time*.8)*sin(angle*17.-time*.3);
  crest=pow(sin(uv.y*3.14159265),2.);float h=crest*height*strength*(.75+noise*.25);
  vec2 q=vec2(cos(angle),sin(angle))*radial*stretch;
  q=mat2(cos(heading),-sin(heading),sin(heading),cos(heading))*q;
  if(sheet>.5){
   age=phase-28.6-(wave-6.)*.18;float flight=max(age,0.)*(.65+uv.y*.35);
   float velocity=3.8+sin(angle*5.+wave)*.6;
   q=vec2(cos(angle),sin(angle))*(.7+flight*(3.2+sin(angle*7.)*.6));
   h=flight*(5.5+sin(angle*9.)*.7)-4.2*flight*flight;origin=impact;
   strength=step(0.,age)*(1.-smoothstep(.9,1.5,age))*smoothstep(0.,.12,h);
   crest=sin(uv.y*3.14159265);h=max(h,0.);
  }
  waveUv=vec2(angle,uv.y);gl_Position=projectionMatrix*viewMatrix*vec4(origin.x+q.x,.085+h,origin.z+q.y,1.);
 }`,fragmentShader:`uniform vec3 tint,waterTint;uniform float time;varying vec2 waveUv;varying float strength,crest,life,sheet;
 void main(){float fragments=.5+.5*sin(waveUv.x*23.+sin(waveUv.x*7.)*4.-time*.7)*sin(waveUv.x*41.+sin(waveUv.x*13.)*2.+waveUv.y*3.);
  float foam=smoothstep(.42,.86,fragments)*pow(crest,3.);float alpha=strength*crest*mix(.025+foam*.14,.1+foam*.27,sheet);
  if(alpha<.003)discard;gl_FragColor=vec4(mix(waterTint*1.4,mix(vec3(.55,.73,.7),tint,.2),foam*.65),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const waves=new T.InstancedMesh(waveGeo,waveMat,8);waves.name='WhaleDisplacementWaves';waves.frustumCulled=false;scene.add(waves);
 const eventTransform=new T.Object3D(),tailTransform=new T.Object3D();eventTransform.rotation.order='YXZ';eventTransform.scale.setScalar(WHALE_SCALE);eventTransform.add(tailTransform);tailTransform.position.set(0,-.02,-3.9);
 function update(time:number,w:WhalePose,blow:T.Vector3,fluke:T.Vector3){
  uniforms.time.value=time;uniforms.phase.value=w.phase;uniforms.breath.value=w.spout;uniforms.heading.value=w.heading;
  uniforms.blow.value.copy(blow);uniforms.fluke.value.copy(fluke);uniforms.body.value.set(w.x,0,w.z);
  // Anchor the splash to the fluke's actual crossing, never to the sinking animal.
  const eventTime=time+WHALE_IMPACT_PHASE-w.phase,event=whaleMotion(eventTime);
  eventTransform.position.set(event.x,event.y,event.z);eventTransform.rotation.set(event.pitch,event.heading,Math.sin(eventTime*.22)*.018);
  tailTransform.rotation.x=Math.sin(eventTime*1.4)*.08+event.tailLift;eventTransform.updateMatrixWorld(true);
  uniforms.impact.value.set(0,0,-.6).applyMatrix4(tailTransform.matrixWorld);uniforms.impact.value.y=.08;
  spray.visible=w.spout>=0||(w.phase>20&&w.phase<32);waves.visible=w.phase<14||(w.phase>18&&w.phase<36);
 }
 return {update};
}
