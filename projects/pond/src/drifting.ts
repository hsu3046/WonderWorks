// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {rng,uTime,tau} from './shared';

/** Two instanced draws, animated on the existing scene clock. */
export function createDrifting(scene:T.Scene){
 const r=rng(390),breeze={value:.35};
 const petalShape=new T.Shape();petalShape.moveTo(0,-.55);petalShape.bezierCurveTo(-.65,-.10,-.60,.46,-.15,.56);petalShape.lineTo(0,.40);petalShape.lineTo(.15,.56);petalShape.bezierCurveTo(.60,.46,.65,-.10,0,-.55);
 const petalGeometry=new T.ShapeGeometry(petalShape,7),p=petalGeometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.pow(p.getX(i),2)*.34);petalGeometry.computeVertexNormals();
 const seedCanvas=document.createElement('canvas');seedCanvas.width=seedCanvas.height=256;const ctx=seedCanvas.getContext('2d')!;
 ctx.strokeStyle='rgba(255,253,234,.88)';ctx.lineWidth=1.25;
 for(let j=0;j<42;j++){const a=j/42*tau,x=128+Math.cos(a)*(68+r()*22),y=94+Math.sin(a)*32;ctx.beginPath();ctx.moveTo(128,124);ctx.quadraticCurveTo((128+x)/2,80,x,y);ctx.stroke();for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a+k*.4)*13,y+Math.sin(a+k*.4)*9-9);ctx.stroke();}}
 ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(128,122);ctx.lineTo(124,193);ctx.stroke();ctx.fillStyle='#b7a276';ctx.beginPath();ctx.ellipse(123,204,3.5,12,.15,0,tau);ctx.fill();
 const map=new T.CanvasTexture(seedCanvas);map.colorSpace=T.SRGBColorSpace;
 function add(count:number,seed:boolean){
  const material=new T.ShaderMaterial({uniforms:{uTime,uBreeze:breeze,uMap:{value:map}},side:T.DoubleSide,transparent:seed,depthWrite:!seed,
   vertexShader:`uniform float uTime,uBreeze;attribute float aPhase;attribute float aSize;varying vec2 vUv;varying float vLight;void main(){
    vUv=uv;float t=uTime,phase=aPhase;vec3 origin=instanceMatrix[3].xyz;
    float fall=${seed?'.09':'.19'}+phase*.008;float age=t*fall;
    vec3 world=origin;world.y=.18+mod(origin.y-age+1000.,10.);
    world.x=mod(origin.x+t*(.07+uBreeze*.24)+sin(t*.43+phase)*.70+15.,30.)-15.;
    world.z=mod(origin.z+sin(t*.29+phase)*.75+cos(t*.15+phase)*.6+11.,22.)-11.;
    vec3 local=position*aSize;float a=t*(.65+phase*.07)+phase;
    ${seed?`vec4 mv=viewMatrix*vec4(world,1.);float tilt=sin(t*.7+phase)*.38;mv.xy+=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*local.xy;gl_Position=projectionMatrix*mv;vLight=1.;`:`local.xy=mat2(cos(a),-sin(a),sin(a),cos(a))*local.xy;float b=sin(t*.8+phase)*1.5;local.yz=mat2(cos(b),-sin(b),sin(b),cos(b))*local.yz;gl_Position=projectionMatrix*viewMatrix*vec4(world+local,1.);vLight=.70+.30*abs(cos(b));`}
   }`,fragmentShader:`uniform sampler2D uMap;varying vec2 vUv;varying float vLight;void main(){
    ${seed?'vec4 tex=texture2D(uMap,vUv);if(tex.a<.035)discard;gl_FragColor=vec4(tex.rgb,tex.a*.56);':'float vein=pow(1.-abs(vUv.x),8.)*.05;gl_FragColor=vec4(vec3(.97,.66,.73)*vLight+vein,1.);'}
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  const geometry=seed?new T.PlaneGeometry(1,1):petalGeometry;
  const phases=new Float32Array(count),sizes=new Float32Array(count),mesh=new T.InstancedMesh(geometry,material,count),matrix=new T.Matrix4();
  for(let i=0;i<count;i++){matrix.makeTranslation((r()-.5)*30,r()*10,(r()-.5)*22);mesh.setMatrixAt(i,matrix);phases[i]=r()*tau;sizes[i]=seed?.19+r()*.19:.055+r()*.06;}
  geometry.setAttribute('aPhase',new T.InstancedBufferAttribute(phases,1));geometry.setAttribute('aSize',new T.InstancedBufferAttribute(sizes,1));mesh.frustumCulled=false;scene.add(mesh);
 }
 add(760,false);add(140,true);
 return {dispose(){map.dispose();},update(wind:number){breeze.value=wind;},counts:{petals:760,dandelionSeeds:140}};
}
