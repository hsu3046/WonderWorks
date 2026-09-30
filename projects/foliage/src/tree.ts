// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random,type Settings,createLeafCounter,leafFall,autumnSeconds} from './state.ts';
export const leafCount=26000;
export interface LivingUniforms{time:{value:number};flightTime:{value:number};year:{value:number};wind:{value:number};snow:{value:number};species:{value:number};}
const deform=`
uniform float uTime,uYear,uWind,uSpecies,uFlightTime;
attribute vec3 home;attribute vec4 leafData,fallData;
varying float vAge,vSeed,vSnow;varying vec2 vLeaf;
float ease(float a,float b,float x){float q=clamp((x-a)/(b-a),0.,1.);return q*q*(3.-2.*q);}
vec3 rx(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
vec3 ry(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
vec3 rz(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
float leafFlight(){
 float localTime=uYear>=.69?uFlightTime:0.;
 return clamp(((uYear-fallData.x+uWind*.012)*${autumnSeconds.toFixed(1)}+localTime)/fallData.y,0.,1.);
}
// Fixed per-leaf phases and incommensurate waves give continuous three-axis flutter.
vec3 leafBreeze(){
 vec3 randoms=fract(vec3(leafData.x*17.13+.37,leafData.x*43.71+.19,leafData.x*71.93+.53));
 vec3 phase=randoms*6.2831853+home*.29;
 vec3 frequency=vec3(.67,.89,.58)+randoms*vec3(.91,1.13,.83);
 return (sin(uTime*frequency+phase)+.32*sin(uTime*frequency*1.79+phase.yzx))*.76;
}
vec3 leafRotation(vec3 p){
 float flight=leafFlight(),age=flight*fallData.y,seed=leafData.x;
 float settle=ease(.8,1.,flight),released=ease(0.,.07,flight),phase=fallData.z;
 vec3 breeze=leafBreeze();
 float attached=breeze.x*uWind*.72;
 float rocking=sin(age*(2.1+seed*1.7)+phase)*(.55+uWind*.3);
 float tilt=mix(leafData.z+attached,rocking,released);
 float roll=mix(breeze.z*uWind*.48,sin(age*(1.7+seed)+phase)*.65,released)*(1.-settle);
 float yaw=leafData.w+breeze.y*uWind*.42*(1.-released)+age*(seed-.5)*1.8*released;
 yaw=mix(yaw,leafData.w+fallData.z,settle);
 return ry(rx(rz(p,roll),mix(tilt,-1.5708,settle)),yaw);
}
vec3 leafPosition(vec3 p){
 float seed=leafData.x,bud=.20+seed*.09,flight=leafFlight(),age=flight*fallData.y;
 float grow=ease(bud,bud+.06,uYear)*(1.-ease(.96,1.,uYear));
 float blossom=ease(.21,.27,uYear)*(1.-ease(.31,.4,uYear));
 if(uSpecies>1.5&&uSpecies<2.5)grow=max(grow,blossom);
 p=leafRotation(p*leafData.y*grow);
 vec2 heading=vec2(cos(fallData.z),sin(fallData.z));
 vec2 drift=heading*fallData.w+vec2(1.8,.4)*uWind;
 vec3 end=vec3(home.x+drift.x,.025+seed*.035,home.z+drift.y);
 vec3 center=mix(home,end,flight);
 float envelope=sin(flight*3.14159265),phase=fallData.z;
 float flutter=(sin(age*(1.4+seed)+phase)-sin(phase))*envelope*(.35+seed*.45+uWind*.25);
 center.xz+=vec2(-heading.y,heading.x)*flutter;
 center.xz+=heading*sin(age*(2.3-seed)+phase)*envelope*.22;
 center.y+=sin(age*(2.+seed)+phase)*envelope*.16;
 float attached=1.-ease(0.,.08,flight);
 // A broad gust links neighboring leaves; local flutter keeps their paths independent.
 float gust=sin(uTime*.53+dot(home,vec3(.19,.10,.13)));
 vec3 gustOffset=vec3(gust*.24,sin(uTime*.71+home.x*.17+home.z*.21)*.11,cos(uTime*.43+home.z*.18)*.17);
 vec3 flutterOffset=leafBreeze()*vec3(.23,.22,.20);
 center+=(gustOffset+flutterOffset)*uWind*(.5+home.y*.09)*attached;
 vAge=ease(.62+seed*.08,.84+seed*.06,uYear);vSeed=seed;vLeaf=position.xy;
 return p+center;
}`;

function leafGeometry(kind:number){
 const s=new T.Shape();
 if(kind===1){s.moveTo(0,-.8);s.lineTo(-.15,-.3);for(let i=0;i<=20;i++){const a=Math.PI*.08+i/20*Math.PI*.84;s.lineTo(-Math.cos(a)*.9,Math.sin(a)*.95-.3);}s.lineTo(.15,-.3);}
 else if(kind===2){for(let i=0;i<=60;i++){const a=i/60*Math.PI*2,r=.68+.21*Math.cos(a*5);if(i===0)s.moveTo(Math.cos(a)*r,Math.sin(a)*r);else s.lineTo(Math.cos(a)*r,Math.sin(a)*r);}}
 else if(kind===3){s.moveTo(0,-.8);s.bezierCurveTo(-.75,-.3,-.65,.6,0,.9);s.bezierCurveTo(.65,.6,.75,-.3,0,-.8);}
 else{
  const points=[0,-.85,-.1,-.3,-.6,-.4,-.46,-.05,-.95,.12,-.65,.3,-.77,.6,-.33,.49,-.2,.82,-.07,.64,0,1,.13,.66,.3,.88,.34,.49,.8,.63,.65,.29,.97,.08,.49,-.08,.61,-.43,.1,-.3];
  s.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)s.lineTo(points[i],points[i+1]);
 }
 s.closePath();const g=new T.ShapeGeometry(s,5);return g;
}
export function createTree(settings:Settings,uniforms:LivingUniforms){
 const group=new T.Group(),rng=random(905),parts:T.BufferGeometry[]=[],tips:T.Vector3[]=[];
 function branch(a:T.Vector3,direction:T.Vector3,length:number,radius:number,depth:number){
  const end=a.clone().addScaledVector(direction,length),middle=a.clone().lerp(end,.55).add(new T.Vector3((rng()-.5)*length*.2,0,(rng()-.5)*length*.2));
  const curve=new T.CatmullRomCurve3([a,middle,end]);
  const tube=new T.TubeGeometry(curve,5,radius,7,false),pos=tube.getAttribute('position');
  for(let i=0;i<pos.count;i++){const t=Math.floor(i/8)/5,c=curve.getPointAt(t);const v=new T.Vector3().fromBufferAttribute(pos,i).sub(c).multiplyScalar(1-t*.64).add(c);pos.setXYZ(i,v.x,v.y,v.z);}
  tube.computeVertexNormals();parts.push(tube);
  if(depth<=2)tips.push(end);
  if(depth===0)return;
  for(let i=0;i<3;i++){
   const angle=rng()*Math.PI*2,spread=.6+rng()*.55;
   const d=direction.clone().multiplyScalar(.65).add(new T.Vector3(Math.cos(angle)*spread,.25+rng()*.45,Math.sin(angle)*spread)).normalize();
   branch(end,d,length*(.65+rng()*.14),radius*.49,depth-1);
  }
 }
 // Mature trunk with staggered scaffold limbs and a taller central leader.
 // One continuous trunk surface widens into irregular buttresses below the soil.
 const trunkStart=new T.Vector3(0,-.32,0),trunkEnd=new T.Vector3(.05,1,.02).normalize().multiplyScalar(4.25).add(new T.Vector3(0,-.12,0));
 const trunkMiddle=new T.Vector3(0,-.12,0).lerp(trunkEnd,.55).add(new T.Vector3((rng()-.5)*4.25*.2,0,(rng()-.5)*4.25*.2));
 const trunkCurve=new T.CatmullRomCurve3([trunkStart,trunkMiddle,trunkEnd]);
 const trunkTube=new T.TubeGeometry(trunkCurve,48,.58,48,false),trunkVertices=trunkTube.getAttribute('position');
 const buttresses=[{angle:.18,reach:.58,width:.29},{angle:1.34,reach:.76,width:.24},{angle:2.48,reach:.47,width:.34},{angle:3.55,reach:.66,width:.25},{angle:4.72,reach:.43,width:.3},{angle:5.69,reach:.63,width:.24}];
 const offset=new T.Vector3();
 for(let i=0;i<trunkVertices.count;i++){
  const t=Math.floor(i/49)/48,center=trunkCurve.getPointAt(t);
  offset.fromBufferAttribute(trunkVertices,i).sub(center).normalize();
  const angle=Math.atan2(offset.z,offset.x);
  let flare=.09;
  for(const root of buttresses){const delta=Math.atan2(Math.sin(angle-root.angle),Math.cos(angle-root.angle));flare+=root.reach*Math.exp(-delta*delta/(root.width*root.width));}
  const radius=.58*(1-t*.64)+flare*Math.exp(-Math.max(0,center.y)/.34);
  offset.multiplyScalar(radius).add(center);trunkVertices.setXYZ(i,offset.x,offset.y,offset.z);
 }
 trunkTube.computeVertexNormals();parts.push(trunkTube);
 for(let i=0;i<10;i++){
  const a=i*2.399963,base=new T.Vector3(.08+i*.012,2.55+i*.17,.04),d=new T.Vector3(Math.cos(a)*.72,.76+rng()*.35,Math.sin(a)*.72).normalize();
  branch(base,d,2.25+rng()*.7,.22+rng()*.09,3);
 }
 branch(new T.Vector3(.20,3.7,.08),new T.Vector3(-.06,1,.05).normalize(),2.6,.22,3);
 // Preserve the established canopy's random sequence after removing nine two-sample roots.
 for(let i=0;i<18;i++)rng();
 // Spread the woody crown and its leaf anchors together; the trunk remains upright.
 function spreadCrown(point:T.Vector3){
  const upper=T.MathUtils.smoothstep(point.y,2.5,5.5),radial=Math.hypot(point.x,point.z);
  point.x*=1+upper*.32;point.z*=1+upper*.27;
  point.y-=Math.max(0,radial-1)*.28*upper;
  return point;
 }
 const barkGeometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
 const barkPositions=barkGeometry.getAttribute('position'),crownPoint=new T.Vector3();
 for(let i=0;i<barkPositions.count;i++){spreadCrown(crownPoint.fromBufferAttribute(barkPositions,i));barkPositions.setXYZ(i,crownPoint.x,crownPoint.y,crownPoint.z);}
 barkGeometry.computeVertexNormals();tips.forEach(spreadCrown);
 const bark=new T.MeshStandardMaterial({color:'#55412a',roughness:1});
 bark.onBeforeCompile=shader=>{
  shader.uniforms.uSnow=uniforms.snow;
  shader.vertexShader='varying vec3 vBark;varying vec3 vBarkNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBark=position;vBarkNormal=normal;');
  shader.fragmentShader='uniform float uSnow;varying vec3 vBark;varying vec3 vBarkNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=sin(vBark.x*94.+sin(vBark.y*7.)*1.4+vBark.z*53.)*.5+.5;
   float furrow=pow(grain,8.);diffuseColor.rgb*=.68+.42*grain;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.09,.065,.035),furrow*.43);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.91,.94,.91),uSnow*smoothstep(.12,.68,vBarkNormal.y));`);
 };
 const trunk=new T.Mesh(barkGeometry,bark);trunk.castShadow=true;trunk.receiveShadow=true;group.add(trunk);
 const homes=new Float32Array(leafCount*3),data=new Float32Array(leafCount*4),falls=new Float32Array(leafCount*4);
 const crownTips=tips.filter(t=>t.y>4);
 for(let i=0;i<leafCount;i++){
  const tip=crownTips[i%crownTips.length],a=rng()*Math.PI*2,r=Math.sqrt(rng())*1.0;
  // Fuller side sprays taper into hanging fringes instead of a clipped crown underside.
  const inner=i%4===0?.25+rng()*.4:1,center=new T.Vector3(.1,6.9,0).lerp(tip,inner);
  const edge=T.MathUtils.smoothstep(Math.hypot(center.x,center.z),1.2,3.5);
  const fringe=Math.pow(rng(),.7)*edge*1.35;
  homes.set([center.x+Math.cos(a)*r,center.y+(rng()-.5)*2.1+Math.sin(tip.x*1.4+tip.z)*.3-fringe,center.z+Math.sin(a)*r],i*3);
  data.set([rng(),.15+rng()*.11,(rng()-.5)*Math.PI*1.3,rng()*Math.PI*2],i*4);
  const fall=leafFall(data[i*4]);falls.set([fall.release,fall.duration,fall.angle,fall.drift],i*4);
 }
 let geometry:T.InstancedBufferGeometry;
 function makeGeometry(kind:number){const source=leafGeometry(kind),g=new T.InstancedBufferGeometry();g.index=source.index;g.attributes=source.attributes;g.setAttribute('home',new T.InstancedBufferAttribute(homes,3));g.setAttribute('leafData',new T.InstancedBufferAttribute(data,4));g.setAttribute('fallData',new T.InstancedBufferAttribute(falls,4));g.instanceCount=leafCount;return g;}
 geometry=makeGeometry(0);
 const material=new T.MeshStandardMaterial({color:'white',roughness:.86,side:T.DoubleSide});
 function inject(shader:T.WebGLProgramParametersWithUniforms){
  Object.assign(shader.uniforms,{uTime:uniforms.time,uFlightTime:uniforms.flightTime,uYear:uniforms.year,uWind:uniforms.wind,uSpecies:uniforms.species});
  shader.vertexShader=deform+'\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=leafPosition(position);');
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','vec3 objectNormal=leafRotation(normal);');
 }
 material.onBeforeCompile=shader=>{
  inject(shader);
  shader.fragmentShader='uniform float uSpecies,uYear;varying float vAge,vSeed,vSnow;varying vec2 vLeaf;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 green=mix(vec3(.09,.22,.012),vec3(.32,.49,.035),vSeed);
   vec3 gold=mix(vec3(.8,.19,.008),vec3(.95,.62,.035),vSeed);
   vec3 red=mix(vec3(.43,.028,.009),vec3(.85,.13,.014),vSeed);
   vec3 autumn=mix(gold,red,smoothstep(.3,.9,vAge)*(.5+vSeed*.5));
   if(uSpecies>.5&&uSpecies<1.5)autumn=vec3(.95,.69,.015)*( .75+vSeed*.3);
   if(uSpecies>3.5){green=mix(vec3(.24,.012,.018),vec3(.52,.04,.055),vSeed);autumn=red;}
   diffuseColor.rgb=mix(green,autumn,vAge);
   float bloom=smoothstep(.20,.26,uYear)*(1.-smoothstep(.32,.4,uYear));
   if(uSpecies>1.5&&uSpecies<2.5)diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.95,.55,.64),vec3(1.,.87,.84),vSeed),bloom);
   float vein=1.-smoothstep(.008,.024,abs(vLeaf.x));
   float ribs=1.-smoothstep(.01,.026,abs(fract(abs(vLeaf.x)*2.5-vLeaf.y*3.5)-.5));
   diffuseColor.rgb*=.87+.13*sin(vLeaf.y*7.+vSeed*8.);diffuseColor.rgb+=vec3(.05,.06,.015)*(vein+ribs*.28);`);
 };
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});depth.onBeforeCompile=inject;
 const leaves=new T.Mesh(geometry,material);leaves.frustumCulled=false;leaves.castShadow=true;leaves.receiveShadow=true;leaves.customDepthMaterial=depth;group.add(leaves);
 let kind=0;
 function updateSpecies(){const next=['maple','ginkgo','cherry','aspen','japanese'].indexOf(settings.species);if(kind===next)return;kind=next;uniforms.species.value=kind;geometry.dispose();geometry=makeGeometry(kind);leaves.geometry=geometry;}
 const countLeaves=createLeafCounter(Float32Array.from({length:leafCount},(_,i)=>data[i*4]));
 function counts(){return countLeaves(settings.year,uniforms.wind.value,uniforms.flightTime.value,settings.species);}
 function update(){
  updateSpecies();
  // Every vertex has zero growth outside this interval, including cherry blossom.
  // Skip the degenerate leaf and shadow draws instead of shading 26,000 collapsed leaves.
  leaves.visible=settings.year>.20&&settings.year<1;
 }
 return {group,update,counts,dispose(){barkGeometry.dispose();bark.dispose();geometry.dispose();material.dispose();depth.dispose();}};
}
