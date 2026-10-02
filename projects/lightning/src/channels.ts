// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {MAX_STROKES,type Discharge} from './bolt';
import {CLOUD_HEIGHT} from './cloud-field';
export function createChannels(){
 const capacity=1800,geometry=new T.InstancedBufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([0,-1,0,1,-1,0,1,1,0,0,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
 const attribute=(size:number)=>new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage);
 const from=attribute(3),to=attribute(3),previous=attribute(3),next=attribute(3),data=attribute(4),timing=attribute(3);
 for(const [name,value] of Object.entries({aFrom:from,aTo:to,aPrevious:previous,aNext:next,aData:data,aTiming:timing}))geometry.setAttribute(name,value);
 geometry.instanceCount=0;
 const material=new T.ShaderMaterial({transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:true,uniforms:{uAge:{value:0},uExposure:{value:0},uViewport:{value:new T.Vector2(1,1)},uCloudOffset:{value:new T.Vector3(0,CLOUD_HEIGHT,0)},uCloudScale:{value:new T.Vector3(1,1,1)},uCloudShear:{value:0},uSource:{value:new T.Vector3()},uStrokes:{value:Array.from({length:MAX_STROKES},()=>new T.Vector3(100,0,1))},uStrokeCount:{value:0},uContinuing:{value:0},uLeaderDuration:{value:.06}},
 vertexShader:`attribute vec3 aFrom,aTo,aPrevious,aNext,aTiming;attribute vec4 aData;uniform vec2 uViewport;uniform vec3 uCloudOffset,uCloudScale,uSource;uniform float uCloudShear;
 varying float vAcross,vWidth,vBirth,vRadius,vEmbedded;varying vec2 vChannel;
 vec2 screen(vec4 p){return p.xy/p.w*uViewport*.5;}
 vec2 safeDirection(vec2 d,vec2 fallback){return length(d)>.001?normalize(d):fallback;}
 void main(){
  mat4 transform=projectionMatrix*modelViewMatrix;
  vec4 a=transform*vec4(aFrom,1.),b=transform*vec4(aTo,1.);
  vec2 d=safeDirection(screen(b)-screen(a),vec2(0.,1.));
  vec2 before=safeDirection(screen(a)-screen(transform*vec4(aPrevious,1.)),d);
  vec2 after=safeDirection(screen(transform*vec4(aNext,1.))-screen(b),d);
  vec2 tangent=safeDirection(mix(before+d,d+after,position.x),d);
  vec2 normal=vec2(-tangent.y,tangent.x),segmentNormal=vec2(-d.y,d.x);
  float miter=min(2.8,1./max(.35,dot(normal,segmentNormal)));
  vec4 p=mix(a,b,position.x);
  float width=mix(aData.x,aData.y,position.x);
  // Project a world-space radius. Do not promote every fine twig to the same
  // minimum pixel width; its filtered energy is handled in the fragment shader.
  float core=max(.004,width*.009*uViewport.y*projectionMatrix[1][1]/max(p.w,.1));
  // Keep the channel mesh narrow: wide per-segment halos overlap at bends and
  // accumulate into white blobs. The HDR bloom pass supplies the broad spill.
  float radius=core*4.5+1.5;
  p.xy+=normal*position.y*radius*miter*2./uViewport*p.w;
  gl_Position=p;vAcross=position.y*radius;vWidth=core;vRadius=radius;
  // Buried channels read as scattered light rather than a white wire on the
  // cloud's surface. The volume pass retains the actual internal light sources.
  vec3 world=mix(aFrom,aTo,position.x),cloudLocal=(world-uCloudOffset)/uCloudScale;cloudLocal.x-=cloudLocal.y*uCloudShear;cloudLocal.y+=.12;
  vEmbedded=1.-smoothstep(.5,1.05,length(cloudLocal/vec3(2.15,.92,1.35)));
  // Upper/side origins are also buried in their own lobe, not only the center.
  vEmbedded=max(vEmbedded,1.-smoothstep(.20,.72,length(world-uSource)));
  vBirth=mix(aTiming.x,aTiming.y,position.x);vChannel=aData.zw;
 }`,
 fragmentShader:`varying float vAcross,vWidth,vBirth,vRadius,vEmbedded;varying vec2 vChannel;
 uniform float uAge,uExposure,uLeaderDuration,uContinuing;uniform int uStrokeCount;uniform vec3 uStrokes[${MAX_STROKES}];
 float shutter(float age,float decay){if(age<0.)return 0.;if(uExposure<.000001)return exp(-age/decay);return decay*(exp(-max(0.,age-uExposure)/decay)-exp(-age/decay))/uExposure;}
 void main(){
  float branch=step(.5,vChannel.x),life=0.;
  // Return current climbs from the contact point. Only the first return stroke
  // lights unsuccessful branches; subsequent darts follow the established trunk.
  float propagation=(1.-vChannel.y)*.0012;
  // Unused slots and later branch strokes contributed exactly zero. Skip their
  // exponential evaluations while preserving active-stroke accumulation order.
  for(int i=0;i<${MAX_STROKES};i++){
   if(i>=uStrokeCount||(i>0&&branch>.5))break;
   life+=uStrokes[i].y*shutter(uAge-uStrokes[i].x-propagation,mix(uStrokes[i].z,.016,branch));
  }
  life+=(1.-branch)*uContinuing*shutter(uAge-uLeaderDuration,.13);
  float leaderAge=uAge-vBirth;
  float leader=step(0.,leaderAge)*(.017+.10*exp(-max(0.,leaderAge)*1800.))*(1.-smoothstep(uLeaderDuration,uLeaderDuration+.012,uAge));
  life=max(life,leader);life*=mix(1.,.62/(1.+vChannel.x*.30),branch);
  float d=abs(vAcross),aa=max(.48,length(vec2(dFdx(vAcross),dFdy(vAcross)))*.5);
  // Gaussian pixel filtering keeps subpixel forks continuous without making
  // them as bright or thick as the trunk. The integral scales with true width.
  float filtered=sqrt(vWidth*vWidth+aa*aa);
  float core=exp(-.5*d*d/(filtered*filtered))*vWidth/filtered;
  float haloWidth=vWidth*1.8+.25;
  float halo=exp(-.5*d*d/(haloWidth*haloWidth))*vWidth/(vWidth+.18);
  float edge=1.-smoothstep(vRadius*.76,vRadius,d);
  vec3 color=(vec3(.93,.96,1.)*core*9.*mix(1.,.18,vEmbedded)+vec3(.46,.57,1.)*halo*.85*mix(1.,.3,vEmbedded))*edge;
  gl_FragColor=vec4(color*life,1.);
 }`});
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=2;
 return {mesh,uniforms:material.uniforms,set(discharge:Discharge){
  material.uniforms.uSource!.value.fromArray(discharge.source);
  material.uniforms.uStrokeCount!.value=Math.min(discharge.strokes.length,MAX_STROKES);
  const segments=discharge.segments.slice(0,capacity);geometry.instanceCount=segments.length;
  segments.forEach((s,i)=>{from.setXYZ(i,...s.from);to.setXYZ(i,...s.to);previous.setXYZ(i,...s.previous);next.setXYZ(i,...s.next);data.setXYZW(i,s.width,s.endWidth,s.branch,s.progress);timing.setXYZ(i,s.delay,s.arrival,0);});
  for(const a of [from,to,previous,next,data,timing]){a.clearUpdateRanges();a.addUpdateRange(0,segments.length*a.itemSize);a.needsUpdate=true;}
  for(let i=0;i<MAX_STROKES;i++){const s=discharge.strokes[i];material.uniforms.uStrokes!.value[i].set(s?.time??100,s?.strength??0,s?.decay??1);}
  material.uniforms.uLeaderDuration!.value=discharge.leaderDuration;material.uniforms.uContinuing!.value=discharge.continuing;
 },get count(){return geometry.instanceCount;},dispose(){geometry.dispose();material.dispose();}};
}
