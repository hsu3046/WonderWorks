// SPDX-License-Identifier: GPL-3.0-only
// © 2026 AIB Inc. — locally generated wood surfaces, no external texture assets.
import * as T from 'three';
export const isTimber=(name:string)=>/^TL_(wood|cedar|plank|dark)$/.test(name);

/** Weld positions only for component discovery; preserve the exported hard normals. */
export function mapTimber(geometry:T.BufferGeometry){
 const p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),count=p.count;
 const parent=Int32Array.from({length:count},(_,i)=>i),positions=new Map<string,number>();
 const find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a:number,b:number)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
 for(let i=0;i<count;i++){
  const key=`${Math.round(p.getX(i)*1e5)},${Math.round(p.getY(i)*1e5)},${Math.round(p.getZ(i)*1e5)}`;
  const previous=positions.get(key);if(previous!==undefined)join(i,previous);else positions.set(key,i);
 }
 const index=geometry.index,n=index?.count??count;
 for(let i=0;i<n;i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;join(a,b);join(a,c);}
 const bounds=new Map<number,{min:number[];max:number[]}>();
 for(let i=0;i<count;i++){
  const root=find(i),v=[p.getX(i),p.getY(i),p.getZ(i)];let b=bounds.get(root);
  if(!b){b={min:[...v],max:[...v]};bounds.set(root,b);}else for(let j=0;j<3;j++){b.min[j]=Math.min(b.min[j],v[j]);b.max[j]=Math.max(b.max[j],v[j]);}
 }
 const uv=new Float32Array(count*2),detail=new Float32Array(count*2),face=new Float32Array(count*4);
 for(let i=0;i<count;i++){
  const root=find(i),b=bounds.get(root)!;const size=b.max.map((value,j)=>value-b.min[j]);const axes=[0,1,2].sort((a,b)=>size[b]-size[a]);const long=axes[0];
  const v=[p.getX(i),p.getY(i),p.getZ(i)],norm=[Math.abs(normal.getX(i)),Math.abs(normal.getY(i)),Math.abs(normal.getZ(i))];
  const end=norm[long]>.8;const across=axes.slice(1).sort((a,b)=>norm[a]-norm[b])[0];const vertical=end?axes.find(a=>a!==across&&a!==long)!:long;
  const hash=Math.sin(b.min[0]*12.989+b.min[1]*78.233+b.min[2]*37.719)*43758.5453,s=hash-Math.floor(hash);
  const x=v[across]-b.min[across],y=v[vertical]-b.min[vertical];
  // One grain tile spans .55 x 2.8 metres; offsets prevent identical neighboring boards.
  uv.set([x/.55+s*7.3,y/2.8+s*11.1],i*2);detail.set([.87+s*.26,end?1:0],i*2);
  face.set([x,y,Math.max(.001,size[across]),Math.max(.001,size[vertical])],i*4);
 }
 geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setAttribute('timberDetail',new T.BufferAttribute(detail,2));geometry.setAttribute('timberFace',new T.BufferAttribute(face,4));
}

export function createTimberSurfaces(){
 const width=1024,height=1024,color=new Uint8Array(width*height*4),surface=new Uint8Array(width*height*4),tau=Math.PI*2;
 const wrap=(v:number)=>v-Math.round(v);
 const clamp=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x/width,v=y/height;
  let bend=0,knot=0,knotRings=0;
  for(const [kx,ky] of [[.27,.31],[.76,.81]]){
   const dx=wrap(u-kx),dy=wrap(v-ky),r=Math.hypot(dx/.062,dy/.095);
   bend+=dx*Math.exp(-dx*dx/ .022-dy*dy/.012)*1.2;
   const core=Math.exp(-r*r*2.2);knot+=core;knotRings+=Math.sin(r*18)*Math.exp(-r*r*.6)*.045;
  }
  const warp=.014*Math.sin(v*tau*2)+.006*Math.sin(v*tau*7+u*tau*2)+bend;
  const grain=Math.sin((u+warp)*tau*47+Math.sin(u*tau*5)*1.3);
  const fine=Math.sin((u+warp*.7)*tau*181+Math.sin(v*tau*13)*.7);
  const broad=Math.sin(u*tau*5+Math.sin(v*tau)*.5)*.065+Math.cos(u*tau*11-v*tau)*.022;
  const pore=Math.pow(Math.max(0,-fine),9)*(.5+.5*Math.sin(v*tau*83+u*17));
  let crack=0;
  for(const [cx,cy] of [[.115,.23],[.59,.69],[.88,.47]]){
   const line=wrap(u-cx-.002*Math.sin(v*tau*15)-.001*Math.sin(v*tau*37));
   crack+=Math.exp(-Math.pow(line/.0011,2))*Math.exp(-Math.pow(wrap(v-cy)/.17,6));
  }
  const fleck=(Math.sin(x*127.1+y*311.7)*43758.5453)%1;
  const shade=.79+broad+grain*.052+fine*.017-pore*.085-knot*.19+knotRings-crack*.26+fleck*.01;
  const h=.5+grain*.12+fine*.045-pore*.12-crack*.33+knotRings*.7;
  const r=.77+pore*.12+crack*.15-knot*.13+broad*.4;
  const i=(y*width+x)*4;color[i]=clamp(shade*255);color[i+1]=clamp(shade*248);color[i+2]=clamp(shade*232);color[i+3]=255;
  surface[i]=clamp(h*255);surface[i+1]=clamp(r*255);surface[i+2]=0;surface[i+3]=255;
 }
 function texture(data:Uint8Array,srgb=false){const t=new T.DataTexture(data,width,height);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;}
 const albedo=texture(color,true),relief=texture(surface);const rain={value:0};
 function apply(material:T.MeshStandardMaterial){
  material.map=albedo;material.bumpMap=relief;material.roughnessMap=relief;material.bumpScale=material.name==='TL_plank'?.065:.045;material.roughness=1;material.color.multiplyScalar(1.30);
  material.onBeforeCompile=shader=>{
   shader.uniforms.timberRain=rain;
   shader.vertexShader='attribute vec2 timberDetail;attribute vec4 timberFace;varying vec2 vTimberDetail;varying vec4 vTimberFace;varying vec3 vTimberWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vTimberDetail=timberDetail;vTimberFace=timberFace;vTimberWorld=(modelMatrix*vec4(position,1.)).xyz;`);
   shader.fragmentShader='uniform float timberRain;varying vec2 vTimberDetail;varying vec4 vTimberFace;varying vec3 vTimberWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 edgeDistance=min(vTimberFace.xy,vTimberFace.zw-vTimberFace.xy);
    float wornEdge=(1.-smoothstep(.001,.008,min(edgeDistance.x,edgeDistance.y)))*.12;
    vec2 endP=vTimberFace.xy-vTimberFace.zw*.47;
    float endPhase=length(endP*vec2(1.,1.15))*380.;
    float endAA=1.-smoothstep(1.,3.,fwidth(endPhase));
    float endGrain=1.+sin(endPhase)*.12*endAA;
    float waterline=1.-smoothstep(.0,.55,vTimberWorld.y);
    float exposedDeck=1.-smoothstep(1.15,1.7,vTimberWorld.y);
    float timberWet=max(waterline*.60,timberRain*exposedDeck*.75);
    diffuseColor.rgb*=vTimberDetail.x*mix(1.,endGrain,vTimberDetail.y)*(1.+wornEdge)*(1.-timberWet*.22);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=mix(roughnessFactor,.26,timberWet);`);
  };
  material.customProgramCacheKey=()=> 'tidelight-timber-v1';
 }
 return {apply,setRain:(value:number)=>{rain.value=value;}};
}
