// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {random,smooth,type Settings} from './state';
import type {LivingUniforms} from './tree';

const variants=4,tileSize=512,treeCount=240;

/** Bake the actual hero tree once; distant trees only draw camera-facing cards. */
function bakeTree(renderer:T.WebGLRenderer,hero:T.Group,u:LivingUniforms){
 const atlas=new T.WebGLRenderTarget(tileSize*variants,tileSize*2,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,generateMipmaps:false});
 const stage=new T.Scene(),copy=hero.clone(true);stage.add(copy);
 stage.add(new T.HemisphereLight('#dceaf4','#817256',2));
 const light=new T.DirectionalLight('#fff1d1',2.4);light.position.set(-8,14,10);stage.add(light);
 // GPU-deformed leaves extend beyond their base geometry; frame their home anchors.
 let radius=0,top=0;
 hero.traverse(object=>{if(object instanceof T.Mesh){const homes=object.geometry.getAttribute('home');if(homes)for(let i=0;i<homes.count;i++){radius=Math.max(radius,Math.hypot(homes.getX(i),homes.getZ(i)));top=Math.max(top,homes.getY(i));}}});
 const width=(radius+.55)*2,height=top+1.1,centerY=top*.5;
 const camera=new T.OrthographicCamera(-width*.5,width*.5,height*.5,-height*.5,.1,70);
 const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4());
 const scissorTest=renderer.getScissorTest(),clearColor=renderer.getClearColor(new T.Color()),clearAlpha=renderer.getClearAlpha();
 const shadowEnabled=renderer.shadowMap.enabled;
 const saved={year:u.year.value,time:u.time.value,flight:u.flightTime.value,wind:u.wind.value,snow:u.snow.value};
 try{
  u.year.value=.54;u.time.value=0;u.flightTime.value=0;u.wind.value=0;u.snow.value=0;
  renderer.shadowMap.enabled=false;renderer.setRenderTarget(atlas);renderer.setClearColor(0,0);renderer.setScissorTest(true);
  // Separate wood and foliage allow winter bare branches without any new render passes.
  for(let layer=0;layer<2;layer++){
   copy.traverse(object=>{if(object instanceof T.Mesh)object.visible=object.geometry.hasAttribute('home')===(layer===1);});
   for(let view=0;view<variants;view++){
    const angle=view*Math.PI*.5+.35;camera.position.set(Math.sin(angle)*24,centerY,Math.cos(angle)*24);camera.lookAt(0,centerY,0);
    renderer.setViewport(view*tileSize,layer*tileSize,tileSize,tileSize);renderer.setScissor(view*tileSize,layer*tileSize,tileSize,tileSize);
    renderer.clear();renderer.render(stage,camera);
   }
  }
 }catch(error){atlas.dispose();throw error;}
 finally{
  u.year.value=saved.year;u.time.value=saved.time;u.flightTime.value=saved.flight;u.wind.value=saved.wind;u.snow.value=saved.snow;
  renderer.shadowMap.enabled=shadowEnabled;renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clearColor,clearAlpha);
 }
 // Cloned meshes share the hero's geometry/material; only the atlas belongs to the forest.
 return {atlas,width,height,centerY};
}

export function createForest(renderer:T.WebGLRenderer,hero:T.Group,u:LivingUniforms,groundY:(x:number,z:number)=>number){
 const {atlas,width,height,centerY}=bakeTree(renderer,hero,u),rng=random(819),geometry=new T.PlaneGeometry(width,height).translate(0,centerY,0);
 const variation=new Float32Array(treeCount*4),matrix=new T.Object3D();
 const uniforms={uForestAtlas:{value:atlas.texture},uForestYear:u.year,uForestTime:u.time,uForestWind:u.wind,uForestSnow:u.snow,uForestLight:{value:1},uForestWarmth:{value:0}};
 const material=new T.MeshBasicMaterial({color:'white',side:T.DoubleSide,alphaTest:.32});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='attribute vec4 forestData;varying vec4 vForest;varying vec2 vForestUv;uniform float uForestTime,uForestWind;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvForest=forestData;vForestUv=uv;');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec3 anchor=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
   vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
   float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz);
   float sway=sin(uForestTime*.65+forestData.y*41.)*uForestWind*.08*smoothstep(2.,9.,position.y);
   vec3 forestPosition=anchor+right*(position.x*sx+sway)+vec3(0.,position.y*sy,0.);
   vec4 mvPosition=viewMatrix*vec4(forestPosition,1.);
   gl_Position=projectionMatrix*mvPosition;`);
  shader.fragmentShader=`uniform sampler2D uForestAtlas;uniform float uForestYear,uForestSnow,uForestLight,uForestWarmth;
   varying vec4 vForest;varying vec2 vForestUv;
   float forestHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.54);}
   \n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 tile=vec2((clamp(vForestUv.x,.001,.999)+vForest.x)/4.,clamp(vForestUv.y,.001,.999)*.5);
   vec4 wood=texture2D(uForestAtlas,tile),leaf=texture2D(uForestAtlas,tile+vec2(0.,.5));
   float seed=vForest.y;
   float growth=smoothstep(.20+seed*.035,.34+seed*.025,uForestYear);
   float shed=smoothstep(.75+seed*.035,.94+seed*.025,uForestYear);
   float cover=growth*(1.-shed);
   // Stable fine-grained thinning keeps intact branches through spring and winter.
   float grain=forestHash(floor(vForestUv*vec2(256.,256.))+seed*91.);
   leaf.a*=smoothstep(grain-.035,grain+.035,cover)*smoothstep(0.,.025,cover);
   float autumn=smoothstep(.64+seed*.025,.85+seed*.025,uForestYear);
   float luminance=dot(leaf.rgb,vec3(.2126,.7152,.0722));
   vec3 autumnColor=mix(vec3(.67,.17,.025),vec3(.92,.52,.065),seed);
   leaf.rgb=mix(leaf.rgb,autumnColor*luminance*2.1,autumn*.9);
   leaf.rgb=mix(leaf.rgb,vec3(.78,.85,.9),uForestSnow*.45);
   wood.rgb=mix(wood.rgb,vec3(.65,.72,.76),uForestSnow*.26);
   float alpha=leaf.a+wood.a*(1.-leaf.a);
   vec3 color=(leaf.rgb*leaf.a+wood.rgb*wood.a*(1.-leaf.a))/max(alpha,.001);
   color*=mix(vec3(1.),vec3(1.12,.88,.7),uForestWarmth)*uForestLight*vForest.z;
   diffuseColor=vec4(color,alpha);`);
 };
 geometry.setAttribute('forestData',new T.InstancedBufferAttribute(variation,4));
 const mesh=new T.InstancedMesh(geometry,material,treeCount);
 for(let i=0;i<treeCount;i++){
  // Three staggered 360° rows avoid random holes with far fewer overlapping cards.
  const row=Math.floor(i/80),angle=((i%80)+row*.37+(rng()-.5)*.55)/80*Math.PI*2;
  const radius=42+row*21+(rng()-.5)*7;
  const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
  const scale=.72+rng()*.50;
  matrix.position.set(x,groundY(x,z)-.11,z);matrix.scale.set(scale*(.83+rng()*.32),scale,1);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);
  variation.set([Math.floor(rng()*variants),rng(),.8+rng()*.25,0],i*4);
 }
 // Shader-facing billboards rotate outside static instance bounds; keep the inexpensive draw active.
 mesh.frustumCulled=false;
 return {mesh,update(settings:Settings,day:number,cloud:number,flash:number){
  uniforms.uForestLight.value=(.10+day*.9)*(1-cloud*.36)+flash*.45;
  uniforms.uForestWarmth.value=smooth(15.5,18.5,settings.hour)*(1-smooth(19.5,21,settings.hour));
 },dispose(){atlas.dispose();geometry.dispose();material.dispose();mesh.dispose();}};
}
