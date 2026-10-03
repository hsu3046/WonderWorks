// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import type {Assets} from './assets.ts';
import {random,terrainHeight} from './landscape.ts';
import {SEA,FALL_SITES,FALL_GRID,fallProfile,fallPoint} from './water-layout.ts';
const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.04)*.28+noise(p*4.1)*.15;}
`;

export function createWater(scene:T.Scene,assets:Pick<Assets,'ocean'|'fallVeil'>,time:{value:number}){
  // One small static shoreline lookup follows the same terrain as collision and rendering.
  const width=201,height=214,data=new Uint8Array(width*height);
  for(let z=0;z<height;z++)for(let x=0;x<width;x++)data[z*width+x]=Math.round(T.MathUtils.clamp((terrainHeight(x/(width-1)*800-400,z/(height-1)*850-645)+16)/128,0,1)*255);
  const shore=new T.DataTexture(data,width,height,T.RedFormat);shore.minFilter=shore.magFilter=T.LinearFilter;shore.needsUpdate=true;
  const water=new T.MeshPhysicalMaterial({roughness:.30,metalness:.08,transparent:true,opacity:.98,envMapIntensity:1.10});
  water.onBeforeCompile=s=>{
    s.uniforms.uTime=time;s.uniforms.uOcean={value:assets.ocean};s.uniforms.uShore={value:shore};
    s.vertexShader='varying vec3 vWater;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWater=(modelMatrix*vec4(transformed,1.)).xyz;');
    s.fragmentShader='uniform float uTime;uniform sampler2D uOcean;uniform sampler2D uShore;varying vec3 vWater;\n'+noiseGLSL+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float dx=cos(vWater.x*.17+uTime*.72)*.030+cos((vWater.x+vWater.z)*.39-uTime*.94)*.023;
      float dz=sin(vWater.z*.21-uTime*.64)*.030+cos((vWater.x+vWater.z)*.39-uTime*.94)*.023;
      normal=normalize((viewMatrix*vec4(normalize(vec3(-dx,1.,-dz)),0.)).xyz);
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vWater.xz;
      vec3 painted=texture2D(uOcean,p*.018+vec2(uTime*.0006,-uTime*.00035)).rgb;
      diffuseColor.rgb=mix(vec3(.026,.17,.21),painted*vec3(.94,1.08,1.10),.76);
      vec2 coastUv=(p-vec2(-400.,-645.))/vec2(800.,850.);
      float inside=step(0.,coastUv.x)*step(0.,coastUv.y)*step(coastUv.x,1.)*step(coastUv.y,1.);
      float land=texture2D(uShore,clamp(coastUv,0.,1.)).r*128.-16.;
      float coast=inside*smoothstep(-4.,-.6,land)*(1.-smoothstep(.3,1.2,land));
      float lace=smoothstep(.34,.72,fbm(p*.38+vec2(uTime*.08,-uTime*.06)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.63,.79,.74),coast*lace*.62);
      diffuseColor.a*=1.-smoothstep(${SEA.fadeStart.toFixed(1)},${SEA.radius.toFixed(1)},distance(p,vec2(${SEA.x.toFixed(1)},${SEA.z.toFixed(1)})));
    `);
  };
  const lake=new T.Mesh(new T.CircleGeometry(SEA.radius,160),water);lake.rotation.x=-Math.PI/2;lake.position.set(SEA.x,SEA.level,SEA.z);lake.renderOrder=-2;lake.name='Painted sea fading into the horizon';scene.add(lake);

  const mistPositions:number[]=[],seeds:number[]=[],rng=random(391);
  const baseMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:time,uVeil:{value:assets.fallVeil},uPhase:{value:0}}]),
    vertexShader:`varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`uniform float uTime;uniform float uPhase;uniform sampler2D uVeil;varying vec2 vUv;${noiseGLSL}
      #include <fog_pars_fragment>
      void main(){
      // Keep the painted silhouette and opacity still; only low-contrast light moves down the stream.
      vec2 uv=vUv;
      vec4 veil=texture2D(uVeil,uv);
      vec2 flowUv=vec2(uv.x*18.+uPhase,uv.y*5.+uTime*.72);
      float footprint=max(length(dFdx(flowUv)),length(dFdy(flowUv)));
      float flow=mix(.5,noise(flowUv),1.-smoothstep(.12,.55,footprint));
      float edge=smoothstep(0.,.06,uv.x)*smoothstep(0.,.06,1.-uv.x);
      float alpha=veil.a*edge*.84*smoothstep(0.,.06,uv.y);
      vec3 tint=mix(vec3(.55,.76,.78),vec3(.90,.96,.93),.66);
      gl_FragColor=vec4(mix(veil.rgb,tint,.22)*(1.+(flow-.5)*.10),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`});
  FALL_SITES.forEach((site,seed)=>{
    const profile=fallProfile(site),{columns,rows}=FALL_GRID,positions:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
      const t=row/rows,u=column/columns,p=fallPoint(profile,t,u);positions.push(p.x,p.y,p.z);uv.push(u,1-t);
      if(row<rows&&column<columns){const a=row*(columns+1)+column,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const material=baseMaterial.clone();material.uniforms.uTime=time;material.uniforms.uVeil!.value=assets.fallVeil;material.uniforms.uPhase!.value=seed*3.71;
    const sheet=new T.Mesh(g,material);sheet.renderOrder=1;sheet.name=`Terrain-fitted cascade ${seed+1}`;scene.add(sheet);
    const impact=fallPoint(profile,1,.5);
    const foamMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,
      uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:time,uPhase:{value:seed*2.73}}]),
      vertexShader:`varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uTime;uniform float uPhase;varying vec2 vUv;${noiseGLSL}
        #include <fog_pars_fragment>
        void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float grain=fbm(p*9.+uPhase+uTime*.15);
        float ripple=pow(.5+.5*sin(r*30.-uTime*2.4+grain*5.),4.);
        float a=(1.-smoothstep(.45,1.,r))*(.07+grain*.16+ripple*.22);gl_FragColor=vec4(.72,.87,.83,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
        }`});
    // UniformsUtils.merge copies scalar uniforms; reconnect every animated layer to the scene clock.
    foamMaterial.uniforms.uTime=time;
    const foam=new T.Mesh(new T.CircleGeometry(site.width*.85,48),foamMaterial);foam.rotation.x=-Math.PI/2;foam.scale.y=.72;foam.position.set(impact.x,SEA.level+.025,impact.z);foam.renderOrder=2;scene.add(foam);
    for(let i=0;i<80;i++){const a=rng()*Math.PI*2,r=Math.sqrt(rng())*site.width*.55;mistPositions.push(impact.x+Math.cos(a)*r,.65+rng()*4.6,impact.z+Math.sin(a)*r*.6);seeds.push(rng());}
  });
  baseMaterial.dispose();
  const mg=new T.BufferGeometry();mg.setAttribute('position',new T.Float32BufferAttribute(mistPositions,3));mg.setAttribute('seed',new T.Float32BufferAttribute(seeds,1));
  const mist=new T.Points(mg,new T.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:time}]),
    vertexShader:`attribute float seed;uniform float uTime;varying float vSeed;
      #include <fog_pars_vertex>
      void main(){vSeed=seed;vec3 p=position;p.x+=sin(uTime*.35+seed*17.)*1.7;p.y+=sin(uTime*.5+seed*34.)*.9;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp((600.+seed*700.)/-mvPosition.z,1.,55.);
      #include <fog_vertex>
      }`,
    fragmentShader:`varying float vSeed;
      #include <fog_pars_fragment>
      void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r*r),3.)*(.055+vSeed*.035);gl_FragColor=vec4(.75,.87,.85,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`
  }));mist.material.uniforms.uTime=time;mist.renderOrder=3;scene.add(mist);
  return {count:FALL_SITES.length,dispose:()=>shore.dispose()};
}
