// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {uTime,noiseGLSL,type Settings} from './shared';
export function createWater(scene:T.Scene,renderer:T.WebGLRenderer,camera:T.PerspectiveCamera,s:Settings){
 const reflection=new T.WebGLRenderTarget(768,512,{type:T.HalfFloatType,depthBuffer:true});const refraction=new T.WebGLRenderTarget(1280,800,{type:T.HalfFloatType,depthBuffer:true});const mirror=new T.PerspectiveCamera();const matrix=new T.Matrix4();const clip=[new T.Plane(new T.Vector3(0,1,0),-.02)];
 const rings=Array.from({length:10},()=>new T.Vector4(0,0,-100,0));let cursor=0;
 const uniforms={uTime,uReflection:{value:reflection.texture},uRefraction:{value:refraction.texture},uResolution:{value:new T.Vector2(1280,800)},uReflectMatrix:{value:matrix},uClarity:{value:s.clarity},uBreeze:{value:s.breeze},uSun:{value:new T.Vector3(-.5,.8,-.4)},uSunColor:{value:new T.Color('#fff2d4')},uUnder:{value:0},uRings:{value:rings}};
 const mat=new T.ShaderMaterial({uniforms,side:T.DoubleSide,vertexShader:`uniform float uTime;uniform float uBreeze;uniform vec4 uRings[10];varying vec3 vWorld;varying vec4 vReflect;uniform mat4 uReflectMatrix;
 float wave(vec2 p){return sin(p.x*1.7+p.y*.7+uTime*.8)*.012+sin(p.x*.8-p.y*2.1-uTime*1.1)*.009;}
 void main(){vec3 p=position;p.y+=wave(p.xz)*(.4+uBreeze);for(int i=0;i<10;i++){vec4 ring=uRings[i];float age=uTime-ring.z;float d=length(p.xz-ring.xy);p.y+=sin((d-age*1.5)*13.)*exp(-pow(d-age*1.5,2.)*4.)*exp(-age*.85)*ring.w*.026*step(0.,age);}vWorld=(modelMatrix*vec4(p,1.)).xyz;vReflect=uReflectMatrix*vec4(vWorld,1.);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
 fragmentShader:`uniform float uTime;uniform sampler2D uReflection;uniform sampler2D uRefraction;uniform vec2 uResolution;uniform float uClarity;uniform float uBreeze;uniform vec3 uSun;uniform vec3 uSunColor;uniform float uUnder;uniform vec4 uRings[10];varying vec3 vWorld;varying vec4 vReflect;${noiseGLSL}
 void main(){vec2 p=vWorld.xz;float t=uTime;vec2 slope=vec2(cos(p.x*1.7+p.y*.7+t*.8)*.024+cos(p.x*.8-p.y*2.1-t*1.1)*.011,cos(p.x*1.7+p.y*.7+t*.8)*.011-cos(p.x*.8-p.y*2.1-t*1.1)*.022)*(.4+uBreeze);slope+=vec2(noise2(p*5.+t*.2),noise2(p*5.-t*.17))*.024-.012;
 float rippleLight=0.;for(int i=0;i<10;i++){float age=t-uRings[i].z;vec2 q=p-uRings[i].xy;float d=length(q);float envelope=exp(-pow(d-age*1.5,2.)*4.)*exp(-max(age,0.)*.75)*uRings[i].w*step(0.,age);slope+=normalize(q+.0001)*cos((d-age*1.5)*13.)*envelope*.19;rippleLight+=pow(max(0.,cos((d-age*1.5)*13.)),6.)*envelope*.09;}
 vec3 n=normalize(vec3(-slope.x,1.,-slope.y));vec3 viewDir=normalize(cameraPosition-vWorld);float viewCos=clamp(abs(dot(n,viewDir)),0.,1.);float fresnel=.0204+.9796*pow(1.-viewCos,5.);vec2 uv=gl_FragCoord.xy/uResolution;vec2 bend=slope*.06;vec3 bed=texture2D(uRefraction,clamp(uv+bend,vec2(.002),vec2(.998))).rgb;vec2 ruv=vReflect.xy/vReflect.w*.5+.5;vec3 reflected=texture2D(uReflection,clamp(ruv+slope*.065,vec2(.003),vec2(.997))).rgb;
 // Absorption preserves pigment contrast; only suspended particles add a color veil.
 float murk=1.-uClarity;
 // A grazing ray travels farther through water; Schlick reflection reaches 100% at the horizon.
 float opticalPath=.12+murk*1.8+(.045+murk*.18)*(1./max(viewCos,.025)-1.);
 vec3 transmission=exp(-vec3(.22,.065,.11)*opticalPath);
 bed=bed*transmission+vec3(.025,.10,.065)*(murk*murk*.5);
 vec3 col=mix(bed,reflected,fresnel);vec3 halfVec=normalize(normalize(uSun)+viewDir);float glint=pow(max(0.,dot(n,halfVec)),240.)*2.1+pow(max(0.,dot(n,halfVec)),32.)*.12;col+=uSunColor*glint+vec3(.7,.9,.72)*rippleLight;
 if(uUnder>.5){col=mix(bed,vec3(.045,.15,.12),.045+murk*.16);col+=vec3(.1,.2,.14)*pow(max(0.,dot(-n,viewDir)),8.);}
 gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>
 }`.replace(';#include',';\n#include')});
 const g=new T.CircleGeometry(1,128,0,Math.PI*2); // Subdivided grid gives rings a real surface displacement.
 g.dispose();const grid=new T.PlaneGeometry(20,15,180,136);grid.rotateX(-Math.PI/2);const index=grid.index!,p=grid.attributes.position;const kept:number[]=[];for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;if(x*x/99.5+z*z/55.5<1)kept.push(a,b,c);}grid.setIndex(kept);const surface=new T.Mesh(grid,mat);surface.renderOrder=1;surface.frustumCulled=false;scene.add(surface);
 const look=new T.Vector3(),up=new T.Vector3();
 return {surface,uniforms,ripple(x:number,z:number,strength=1){rings[cursor]!.set(x,z,uTime.value,strength);cursor=(cursor+1)%rings.length;},resize(w:number,h:number){refraction.setSize(w,h);reflection.setSize(Math.max(1,Math.round(w*.6)),Math.max(1,Math.round(h*.6)));uniforms.uResolution.value.set(w,h);},render(){
 uniforms.uClarity.value=s.clarity;uniforms.uBreeze.value=s.breeze;const underwater=camera.position.y<0;uniforms.uUnder.value=underwater?1:0;surface.visible=false;const tone=renderer.toneMapping;renderer.toneMapping=T.NoToneMapping;renderer.shadowMap.needsUpdate=true;renderer.setRenderTarget(refraction);renderer.render(scene,camera);
 if(!underwater){mirror.copy(camera);mirror.position.y=-camera.position.y;camera.getWorldDirection(look);look.add(camera.position);look.y=-look.y;up.copy(camera.up);up.y=-up.y;mirror.up.copy(up);mirror.lookAt(look);mirror.updateMatrixWorld();matrix.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);renderer.clippingPlanes=clip;renderer.setRenderTarget(reflection);renderer.render(scene,mirror);renderer.clippingPlanes=[];}
 surface.visible=true;renderer.toneMapping=tone;renderer.setRenderTarget(null);renderer.render(scene,camera);
 },dispose(){reflection.dispose();refraction.dispose();}};
}
