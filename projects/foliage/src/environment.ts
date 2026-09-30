// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {random,climate,smooth,type Settings} from './state.ts';
import type {LivingUniforms} from './tree';
import {createForest} from './forest';
import {createHorizon} from './horizon';
const meadowNoise=`
float meadowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.54);}
float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(meadowHash(i),meadowHash(i+vec2(1,0)),f.x),mix(meadowHash(i+vec2(0,1)),meadowHash(i+vec2(1,1)),f.x),f.y);}
float meadowFbm(vec2 p){return meadowNoise(p)*.57+meadowNoise(p*2.13+7.2)*.28+meadowNoise(p*4.31)*.15;}
`;


export function createEnvironment(scene:T.Scene,settings:Settings,u:LivingUniforms,renderer:T.WebGLRenderer,hero:T.Group,invalidate:()=>void,onError:(message:string)=>void){
 const rng=random(319),resources:{dispose():void}[]=[];
 const skyUniforms={uTime:u.time,uDay:{value:1},uSunset:{value:0},uCloud:{value:0},uFlash:{value:0}};
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyUniforms,vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vP;uniform float uTime,uDay,uSunset,uCloud,uFlash;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.54);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){vec3 d=normalize(vP);float h=max(d.y,0.);vec3 daylight=mix(vec3(.81,.85,.77),vec3(.24,.48,.68),pow(h,.45));
 vec3 sunset=mix(vec3(.98,.5,.23),vec3(.29,.35,.58),pow(h,.42));
 vec3 col=mix(vec3(.018,.031,.066),mix(daylight,sunset,uSunset),uDay);
 vec2 p=d.xz/(h+.17)*1.6+vec2(uTime*.008,0.);float n=noise(p)*.57+noise(p*2.1)*.28+noise(p*4.2)*.15;
 float cloud=smoothstep(.5-uCloud*.23,.76-uCloud*.12,n)*smoothstep(0.,.12,h);
 col=mix(col,mix(vec3(.7,.76,.78),vec3(.13,.17,.22),uCloud)*(.22+.78*uDay),cloud*(.62+uCloud*.3));
 col=mix(col,vec3(.19,.24,.29)*(.3+uDay*.7),uCloud*.5);
 float stars=step(.9985,hash(floor(d.xz/(h+.08)*600.)))*smoothstep(.04,.4,h)*(1.-uDay)*(1.-uCloud);
 float moon=dot(d,normalize(vec3(-.4,.4,-1.)));
 col+=vec3(.65,.77,1.)*(smoothstep(.9994,.9997,moon)*1.2+pow(max(moon,0.),450.)*.06)*(1.-uDay)*(1.-uCloud*.6);
 col+=stars*.7+uFlash*.28;gl_FragColor=vec4(col,1.);#include <colorspace_fragment>
 }`.replace(';#include',';\n#include')});
 const skyGeo=new T.SphereGeometry(180,32,16),sky=new T.Mesh(skyGeo,skyMat);scene.add(sky);resources.push(skyGeo,skyMat);
 const hemi=new T.HemisphereLight('#a9d8f3','#655935',2.5);scene.add(hemi);
 const moonlight=new T.DirectionalLight('#97bbf5',0);moonlight.position.set(-12,16,-8);scene.add(moonlight);
 const sun=new T.DirectionalLight('#ffe2a3',3.1);sun.position.set(10,11,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-8;sun.shadow.camera.far=50;sun.shadow.normalBias=.04;sun.shadow.bias=-.0003;sun.shadow.radius=3;scene.add(sun,sun.target);
 // Illustrated ground carries the fine vegetation; only nearby silhouettes need blades.
 let disposed=false;
 const meadow=new T.TextureLoader().load('./landscape/meadow-ground-v1.webp',texture=>{
  if(disposed){texture.dispose();return;}invalidate();
 },undefined,error=>{if(!disposed){console.error('Meadow illustration could not load',error);onError('The meadow illustration could not load. Reload to restore ground detail.');}});
 meadow.colorSpace=T.SRGBColorSpace;meadow.wrapS=meadow.wrapT=T.MirroredRepeatWrapping;
 meadow.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());resources.push(meadow);
 const autumnMap=new T.TextureLoader().load('./landscape/foliage-autumn-ground-v1.webp',texture=>{
  if(disposed){texture.dispose();return;}invalidate();
 },undefined,error=>{if(!disposed){console.error('Autumn ground could not load',error);onError('The autumn ground could not load. Reload to restore seasonal detail.');}});
 autumnMap.colorSpace=T.SRGBColorSpace;autumnMap.wrapS=autumnMap.wrapT=T.MirroredRepeatWrapping;
 autumnMap.anisotropy=meadow.anisotropy;resources.push(autumnMap);
 const groundMat=new T.MeshStandardMaterial({color:'white',map:meadow,roughness:1});
 groundMat.onBeforeCompile=shader=>{
  shader.uniforms.uAutumnMap={value:autumnMap};shader.uniforms.uSnow=u.snow;shader.uniforms.uYear=u.year;shader.uniforms.uDay=skyUniforms.uDay;
  shader.vertexShader='varying vec3 vGround;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position;');
  shader.fragmentShader=meadowNoise+'uniform sampler2D uAutumnMap;uniform float uSnow,uYear,uDay;varying vec3 vGround;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float n=meadowFbm(vGround.xz*.34),fine=meadowNoise(vGround.xz*9.);
   float spring=1.-smoothstep(.32,.47,uYear);
   float autumn=smoothstep(.64,.87,uYear);
   vec3 summerTint=mix(vec3(.65,.79,.48),vec3(.98,1.03,.68),n);
   vec3 springTint=mix(vec3(.92,1.13,.64),vec3(1.2,1.23,.86),n);
   vec3 meadowColor=diffuseColor.rgb*mix(summerTint,springTint,spring);
   vec3 litter=texture2D(uAutumnMap,vGround.xz*.34).rgb;
   // Uneven leaf cover accumulates across the grass instead of a global brown tint.
   float cover=smoothstep(.12,.88,autumn+(n-.5)*.32);
   diffuseColor.rgb=mix(meadowColor,litter,cover);
   float snowCover=smoothstep(.02,.98,uSnow+(n-.5)*.22);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.9,.94)*(.95+fine*.05),snowCover);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.22,.24,.26)*uSnow*uDay;');
 };
 const groundGeo=new T.PlaneGeometry(200,200,80,80).rotateX(-Math.PI/2),gp=groundGeo.getAttribute('position');
 const groundY=(x:number,z:number)=>smooth(10,35,-z)*(Math.sin(x*.11+1)*2+Math.cos(z*.12)*1.4+2);
 const groundUv=groundGeo.getAttribute('uv');
 for(let i=0;i<gp.count;i++){gp.setY(i,groundY(gp.getX(i),gp.getZ(i))-.03);groundUv.setXY(i,gp.getX(i)*.34,gp.getZ(i)*.34);}groundGeo.computeVertexNormals();
 const ground=new T.Mesh(groundGeo,groundMat);ground.receiveShadow=true;scene.add(ground);resources.push(groundGeo,groundMat);
 // Preserve wind and foreground depth in a compact ring; painted hills need no blades.
 const grassGeo=new T.InstancedBufferGeometry(),base=new T.PlaneGeometry(1,1,1,4).translate(0,.5,0);grassGeo.index=base.index;grassGeo.attributes=base.attributes;
 const blades=32000,origins=new Float32Array(blades*4);
 let tuftX=0,tuftZ=0;
 for(let i=0;i<blades;i++){
  if(i%5===0){const angle=rng()*Math.PI*2,radius=Math.sqrt(rng())*23;tuftX=Math.cos(angle)*radius;tuftZ=Math.sin(angle)*radius;}
  const angle=rng()*Math.PI*2,r=rng()*.19,x=tuftX+Math.cos(angle)*r,z=tuftZ+Math.sin(angle)*r;
  origins.set([x,groundY(x,z),z,rng()],i*4);
 }
 grassGeo.setAttribute('blade',new T.InstancedBufferAttribute(origins,4));grassGeo.instanceCount=blades;
 const grassMat=new T.MeshStandardMaterial({color:'white',side:T.DoubleSide,roughness:.94});
 grassMat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{uTime:u.time,uWind:u.wind,uSnow:u.snow,uYear:u.year});
  shader.vertexShader=meadowNoise+`uniform float uTime,uWind,uSnow,uYear;attribute vec4 blade;varying float vBlade,vHeight,vPatch;
   vec3 grassPoint(vec3 p,float t,vec4 shape){
    float seed=blade.w,angle=seed*47.,h=shape.x,edge=shape.y;
    float width=(.05+seed*.048)*(1.-t*.96)*edge;
    float bend=(.16+seed*.42)*h*t*t;
    float gust=shape.z*t*t;
    return vec3(p.x*width*cos(angle)+sin(angle)*bend+gust,t*h-bend*.24,p.x*width*sin(angle)-cos(angle)*bend+gust*.45);
   }
   vec4 grassShape(){
    float seed=blade.w,density=meadowFbm(blade.xz*.42);
    float edge=1.-smoothstep(15.,23.,length(blade.xz));
    float root=smoothstep(.55,1.45,length(blade.xz));
    float seasonalHeight=mix(.62,1.,smoothstep(.23,.48,uYear))*(1.-smoothstep(.66,.92,uYear)*.34);
    float h=(.16+seed*.24)*( .65+density*.8)*edge*root*(1.-uSnow*.96)*seasonalHeight;
    float gust=sin(uTime*1.25+blade.x*.26+blade.z*.19)*(.035+uWind*.16);
    return vec4(h,edge,gust,density);
   }
`+shader.vertexShader;
  // Normals follow the same bent blade as its vertices, avoiding flat black bristles.
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`float tGrass=uv.y;vec4 shapeGrass=grassShape();
   vec3 tangent=grassPoint(vec3(0.),tGrass+.01,shapeGrass)-grassPoint(vec3(0.),tGrass,shapeGrass);
   vec3 across=vec3(cos(blade.w*47.),0.,sin(blade.w*47.));
   vec3 objectNormal=normalize(cross(across,tangent));`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=grassPoint(position,uv.y,shapeGrass)+blade.xyz;vBlade=blade.w;vHeight=uv.y;vPatch=shapeGrass.w;`);
  shader.fragmentShader='uniform float uSnow,uYear;varying float vBlade,vHeight,vPatch;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 green=mix(vec3(.16,.245,.042),vec3(.36,.44,.13),vPatch*.55+vBlade*.25+vHeight*.2);
   diffuseColor.rgb=green*(.78+vHeight*.22);
   diffuseColor.rgb*=mix(vec3(1.15,1.12,.85),vec3(.86,1.,.78),smoothstep(.3,.5,uYear));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.18,.058),smoothstep(.65,.88,uYear)*.85);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.87,.89),uSnow*(.92+.08*vHeight));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*.1*vHeight;');
 };
 const grass=new T.Mesh(grassGeo,grassMat);grass.receiveShadow=true;grass.frustumCulled=false;scene.add(grass);resources.push(grassGeo,grassMat);
 const horizon=createHorizon(u,invalidate,onError);scene.add(horizon.mesh);resources.push(horizon);
 const forest=createForest(renderer,hero,u,groundY);scene.add(forest.mesh);resources.push(forest);
 const rainCount=6500,rainGeo=new T.BufferGeometry(),rainP=new Float32Array(rainCount*6),rainSeed=new Float32Array(rainCount*2),rainEnd=new Float32Array(rainCount*2);
 for(let i=0;i<rainCount;i++){const x=(rng()-.5)*45,y=rng()*23,z=(rng()-.5)*40;rainP.set([x,y,z,x,y,z],i*6);rainEnd[i*2+1]=1;rainSeed[i*2]=rainSeed[i*2+1]=rng();}
 rainGeo.setAttribute('position',new T.BufferAttribute(rainP,3));rainGeo.setAttribute('rainEnd',new T.BufferAttribute(rainEnd,1));rainGeo.setAttribute('seed',new T.BufferAttribute(rainSeed,1));
 // Rain and spray share the same phase and impact point, including sloped ground.
 const rainTerrain=`float rainGround(vec2 p){return smoothstep(10.,35.,-p.y)*(sin(p.x*.11+1.)*2.+cos(p.y*.12)*1.4+2.)-.03;}`;
 const rainU={uTime:u.time,uWind:u.wind,uOpacity:{value:0},uDay:skyUniforms.uDay,uPixel:{value:1},uStrength:{value:0},uFlash:skyUniforms.uFlash};
 const rainMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:rainU,vertexShader:`uniform float uTime,uWind;attribute float seed,rainEnd;
  ${rainTerrain}
  void main(){
   float speed=11.+seed*5.,height=mod(position.y-uTime*speed+1000.,23.);
   vec2 impact=vec2(position.x+uWind*23.*.35,position.z);
   vec3 p=vec3(position.x+uWind*(23.-height)*.35,rainGround(impact)+height+rainEnd*.45,position.z);
   gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`,fragmentShader:'uniform float uOpacity,uDay;void main(){gl_FragColor=vec4(vec3(.65,.78,.87)*(.3+uDay*.7),uOpacity);}' });
 const rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;scene.add(rain);resources.push(rainGeo,rainMat);
 const dropletsPerImpact=5,sprayCount=rainCount*dropletsPerImpact;
 const sprayGeo=new T.BufferGeometry(),sprayP=new Float32Array(sprayCount*3),sprayData=new Float32Array(sprayCount*2);
 for(let i=0;i<rainCount;i++)for(let j=0;j<dropletsPerImpact;j++){
  const index=i*dropletsPerImpact+j;
  sprayP.set(rainP.subarray(i*6,i*6+3),index*3);sprayData.set([rainSeed[i*2],j],index*2);
 }
 sprayGeo.setAttribute('position',new T.BufferAttribute(sprayP,3));sprayGeo.setAttribute('impactData',new T.BufferAttribute(sprayData,2));
 const sprayMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:rainU,vertexShader:`
  uniform float uTime,uWind,uPixel,uStrength;attribute vec2 impactData;varying float vSprayAlpha;
  ${rainTerrain}
  void main(){
   float seed=impactData.x,speed=11.+seed*5.;
   float height=mod(position.y-uTime*speed+1000.,23.);
   float age=(23.-height)/speed;
   float cycle=floor((uTime*speed-position.y-1000.)/23.);
   float variation=fract(seed*83.17+impactData.y*.618034+cycle*.381966);
   float angle=variation*6.2831853+impactData.y*2.399963;
   float vertical=(1.6+fract(variation*7.31)*1.25)*(1.+uStrength*.22),life=2.*vertical/9.81;
   float lateral=.45+fract(variation*13.17)*1.2;
   vec2 impact=vec2(position.x+uWind*23.*.35,position.z);
   vec2 offset=vec2(cos(angle),sin(angle))*lateral*age+vec2(uWind*.28,0.)*age;
   vec3 p=vec3(impact.x+offset.x,rainGround(impact)+.018+vertical*age-4.905*age*age,impact.y+offset.y);
   float aboveGround=step(rainGround(p.xz)+.006,p.y);
   vSprayAlpha=smoothstep(0.,.018,age)*(1.-smoothstep(life*.35,life,age))*aboveGround;
   vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
   vSprayAlpha*=1.-smoothstep(32.,65.,-mv.z);
   gl_PointSize=clamp(36./max(.1,-mv.z),1.4,4.7)*uPixel*(.8+variation*.4);
  }`,fragmentShader:`uniform float uOpacity,uDay,uFlash;varying float vSprayAlpha;
  void main(){float radius=length(gl_PointCoord-.5);if(radius>.5||vSprayAlpha<.001)discard;
   float soft=exp(-12.*radius*radius)*(1.-smoothstep(.35,.5,radius));
   vec3 color=vec3(.72,.84,.91)*(.28+uDay*.72)+uFlash*.35;
   gl_FragColor=vec4(color,soft*vSprayAlpha*uOpacity*2.6);
  }`});
 const spray=new T.Points(sprayGeo,sprayMat);spray.frustumCulled=false;scene.add(spray);resources.push(sprayGeo,sprayMat);
 const snowGeo=new T.BufferGeometry(),snowP=new Float32Array(4000*3);
 for(let i=0;i<4000;i++)snowP.set([(rng()-.5)*40,rng()*20,(rng()-.5)*35],i*3);snowGeo.setAttribute('position',new T.BufferAttribute(snowP,3));
 const snowU={uTime:u.time,uWind:u.wind,uOpacity:{value:0},uPixel:{value:1}};
 const snowMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:snowU,vertexShader:`uniform float uTime,uWind,uPixel;void main(){vec3 p=position;p.y=mod(p.y-uTime*(.6+fract(p.x)*.8)+1000.,20.);p.x+=sin(uTime*.7+p.z)*.55+uWind*(20.-p.y)*.35;p.z+=sin(uTime*.5+p.x)*.3;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(112./-mv.z,3.5,14.)*uPixel;}`,fragmentShader:'uniform float uOpacity;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(.93,.96,1.,exp(-10.*r*r)*(1.-smoothstep(.34,.5,r))*.88*uOpacity);}' });
 const snow=new T.Points(snowGeo,snowMat);snow.frustumCulled=false;scene.add(snow);resources.push(snowGeo,snowMat);
 const lightning=new T.Group();scene.add(lightning);
 const boltMat=new T.LineBasicMaterial({color:new T.Color(3,4,5),transparent:true,opacity:1,toneMapped:false});resources.push(boltMat);
 const lightningLight=new T.DirectionalLight('#c5dcff',0);lightningLight.position.set(-12,20,-15);scene.add(lightningLight);
 for(let j=0;j<3;j++){
  const points:T.Vector3[]=[];for(let i=0;i<13;i++)points.push(new T.Vector3(-14+j*2+Math.sin(i*3.4+j)*1.3,29-i*(j?1.25:2),-27+i*.18));
  const g=new T.BufferGeometry().setFromPoints(points);resources.push(g);lightning.add(new T.Line(g,boltMat));
 }
 let flash=0,thunderId=-1,stormAge=0;
 const warmSun=new T.Color('#ffaa65'),cloudSky=new T.Color('#798b9f'),sunsetFog=new T.Color('#b9a086'),cloudFog=new T.Color('#74828d'),nightFog=new T.Color('#142031'),fogColor=new T.Color();
 function update(dt:number,onThunder:()=>void){
  const day=smooth(5,8,settings.hour)*(1-smooth(18.5,21,settings.hour));
  const sunset=(smooth(15.5,18.5,settings.hour)*(1-smooth(19.5,21,settings.hour))+smooth(4.5,6,settings.hour)*(1-smooth(7,9,settings.hour)))*day;
  const storm=settings.weather==='storm',wet=storm||settings.weather==='rain';
  const cloud=storm?.95:settings.weather==='rain'?.78:settings.weather==='cloudy'?.5:settings.weather==='snow'?.62:.08;
  skyUniforms.uDay.value=day;skyUniforms.uSunset.value=sunset;skyUniforms.uCloud.value=T.MathUtils.damp(skyUniforms.uCloud.value,cloud,2,dt);
  if(storm){stormAge+=dt;const id=Math.floor(stormAge/9),phase=stormAge%9;flash=phase<.12?1:phase>.22&&phase<.34?.75:phase>.4&&phase<.46?.3:0;if(id!==thunderId){thunderId=id;onThunder();}}
  else{stormAge=8.95;thunderId=-1;flash=0;}
  lightning.visible=flash>0;lightningLight.intensity=flash*7;skyUniforms.uFlash.value=flash;
  const h=settings.hour/24*Math.PI*2-Math.PI/2;
  sun.position.set(Math.cos(h)*-13,Math.max(3,Math.sin(h)*16),10);sun.intensity=(.12+day*3.1)*(1-cloud*.8);
  sun.color.set('#ffdc9d').lerp(warmSun,sunset*.6);
  moonlight.intensity=.9*(1-day)*(1-cloud*.65);
  hemi.intensity=.35+day*(1.6-cloud*.5);hemi.color.set('#c2d9ed').lerp(cloudSky,cloud);
  fogColor.set('#b5bea7').lerp(sunsetFog,sunset*.5).lerp(cloudFog,cloud).lerp(nightFog,1-day);
  (scene.fog as T.FogExp2).color.copy(fogColor);(scene.fog as T.FogExp2).density=.013+cloud*.01;
  rainU.uOpacity.value=T.MathUtils.damp(rainU.uOpacity.value,wet?storm?.44:.28:0,2,dt);rain.visible=rainU.uOpacity.value>.005;spray.visible=rain.visible;
  rainU.uPixel.value=Math.min(devicePixelRatio,2);rainU.uStrength.value=T.MathUtils.damp(rainU.uStrength.value,storm?1:0,2,dt);
  snowU.uOpacity.value=T.MathUtils.damp(snowU.uOpacity.value,settings.weather==='snow'?.95:0,2,dt);snow.visible=snowU.uOpacity.value>.005;snowU.uPixel.value=Math.min(devicePixelRatio,2);
  const natural=climate(settings.year).snow,target=Math.max(natural,settings.weather==='snow'?.85:0);u.snow.value=T.MathUtils.damp(u.snow.value,target,.5,dt);grass.visible=u.snow.value<.985;
  forest.update(settings,day,cloud,flash);horizon.update(settings,day,cloud,flash);
 }
 return {update,counts:{grassBlades:blades,forestCards:forest.mesh.count},dispose(){disposed=true;resources.forEach(r=>r.dispose());sun.shadow.dispose();}};
}
