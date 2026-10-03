// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {noiseVolume} from './noise';
import {CLOUD_HEIGHT} from './cloud-field';
export function cloudMaterial(depth:T.DepthTexture,camera:T.PerspectiveCamera){
 const noise=noiseVolume();
 const material=new T.ShaderMaterial({glslVersion:T.GLSL3,depthTest:false,depthWrite:false,uniforms:{uNoise:{value:noise},uDepth:{value:depth},uInverseProjection:{value:camera.projectionMatrixInverse},uCameraMatrix:{value:camera.matrixWorld},uEye:{value:camera.position},uCloudOffset:{value:new T.Vector3(0,CLOUD_HEIGHT,0)},uCloudScale:{value:new T.Vector3(1,1,1)},uCloudShear:{value:0},uTime:{value:0},uDensity:{value:.5},uWind:{value:.35},uLights:{value:[new T.Vector3(),new T.Vector3(),new T.Vector3()]},uFlash:{value:0},uLightPowers:{value:new Float32Array(3)}},
 vertexShader:'out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`precision highp sampler3D;
 in vec2 vUv;out vec4 fragColor;uniform sampler3D uNoise;uniform sampler2D uDepth;
 uniform mat4 uInverseProjection,uCameraMatrix;uniform vec3 uEye,uLights[3],uCloudOffset,uCloudScale;uniform float uTime,uDensity,uWind,uFlash,uCloudShear;uniform float uLightPowers[3];
 float puff(vec3 p,vec3 center,vec3 radius){return 1.-length((p-center)/radius);}
 float mergeCells(float a,float b){float h=max(.15-abs(a-b),0.)/.15;return max(a,b)+h*h*.0375;}
 float shape(vec3 q){
  vec3 drift=vec3(-uTime*uWind*.045,uTime*.007,0.);
  vec2 base=texture(uNoise,(q+drift)*.19+vec3(.31,.07,.53)).rg;
  vec2 detail=texture(uNoise,(q+drift*1.3)*.57).rg;
  float fine=texture(uNoise,(q+drift*1.7)*1.63+vec3(.19,.37,.11)).g;
  // Overlapping storm cells with irregular descending lobes and cellular erosion.
  // Erosion removes density at the edge instead of adding glowing smoke outside.
  vec3 warp=vec3(base.r-.5,base.g-.45,detail.r-.5)*.35;
  vec3 w=q+warp;
  float mass=puff(w,vec3(0.,-.12,0.),vec3(2.45,.80,1.65));
  // Stagger cells in depth as well as width. No line of flat ellipses when
  // viewed end-on, and smooth unions prevent visible intersection creases.
  mass=mergeCells(mass,puff(w,vec3(-1.35,.12,.45),vec3(1.04,.78,1.07))*.85);
  mass=mergeCells(mass,puff(w,vec3(-.72,.66,-.48),vec3(.97,1.16,.96))*.9);
  mass=mergeCells(mass,puff(w,vec3(.85,.42,.50),vec3(1.05,.94,1.02))*.9);
  // Unequal rising towers break the broad, nearly level upper envelope. Their
  // centers also vary in depth so rotating the cloud retains a lobed skyline.
  mass=mergeCells(mass,puff(w,vec3(-.72,1.26,-.45),vec3(.67,.82,.72))*.88);
  mass=mergeCells(mass,puff(w,vec3(.90,.91,.52),vec3(.62,.69,.67))*.84);
  mass=mergeCells(mass,puff(w,vec3(1.6,-.04,-.30),vec3(.92,.68,1.03))*.8);
  mass=mergeCells(mass,puff(w,vec3(.15,-.18,-1.05),vec3(1.22,.65,.81))*.75);
  // Stagger the underside in all three axes. A common height mask would slice
  // these lobes into the same horizontal shelf when viewed from below.
  mass=mergeCells(mass,puff(w,vec3(-1.38,-.63,.48),vec3(.73,.64,.71))*.80);
  mass=mergeCells(mass,puff(w,vec3(-.44,-.91,.72),vec3(.63,.75,.66))*.82);
  mass=mergeCells(mass,puff(w,vec3(.66,-.62,.87),vec3(.87,.49,.64))*.80);
  mass=mergeCells(mass,puff(w,vec3(1.30,-.70,-.27),vec3(.57,.66,.73))*.78);
  mass=mergeCells(mass,puff(w,vec3(.10,-.88,-.88),vec3(.71,.64,.67))*.82);
  float billow=(base.r-.47)*.9+(base.g-.44)*.68;
  // Separate the local billow boundary from optical thickness. A broad density
  // ramp integrates into blurry fog; a dense, saturated ramp becomes solid clay.
  float body=max(0.,mass+billow-.045);
  float edge=1.-smoothstep(.12,.65,body);
  float erosion=((1.-detail.g)*.31+(1.-fine)*.14)*(.45+.55*edge);
  float cells=smoothstep(.24,.64,base.r*.55+base.g*.45);
  float density=smoothstep(.025,.34,body-erosion)*(.28+.72*cells);
  // Density also varies inside each lobe, not only at its silhouette. These
  // small air pockets give the integrated volume relief instead of a fog slab.
  float pockets=smoothstep(.18,.62,detail.g*.65+detail.r*.35);
  density*=.25+.75*pockets;
  // The support reaches zero before every ray-box face, even while noise drifts.
  // This is essential at grazing angles: no rectangular volume cut is exposed.
  float support=1.-length((q-vec3(0.,.22,0.))/vec3(3.55,2.23,2.45));
  density*=smoothstep(0.,.16,support);
  return density*uDensity*2.5;
 }
 // Transform rays once, instead of undoing motion at every density/shadow
 // sample. The unnormalized local direction preserves world-space distances.
 vec3 localDirection(vec3 p){vec3 q=p/uCloudScale;q.x-=q.y*uCloudShear;return q;}
 vec2 boxHit(vec3 ro,vec3 rd){vec3 a=(vec3(-3.65,-2.13,-2.55)-ro)/rd,b=(vec3(3.65,2.55,2.55)-ro)/rd;vec3 lo=min(a,b),hi=max(a,b);return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));}
 float phase(float c,float g){return (1.-g*g)/pow(max(.08,1.+g*g-2.*g*c),1.5);}
 void main(){
  vec4 near=uInverseProjection*vec4(vUv*2.-1.,1.,1.);vec3 rd=normalize((uCameraMatrix*vec4(near.xyz/near.w,0.)).xyz);
  vec3 localEye=localDirection(uEye-uCloudOffset),localRay=localDirection(rd);
  vec2 bounds=boxHit(localEye,localRay);float begin=max(0.,bounds.x),end=bounds.y;
  float depth=texture(uDepth,vUv).r;if(depth<.99999){vec4 view=uInverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);end=min(end,length(view.xyz/view.w));}
  if(end<=begin){fragColor=vec4(0.,0.,0.,1.);return;}
  // A fixed world-space sample spacing keeps grazing views as stable as the
  // front view. Fine edge erosion also needs enough samples along the ray.
  float steps=clamp(ceil((end-begin)/.055),24.,128.);
  float stepSize=(end-begin)/steps;
  float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
  vec3 col=vec3(0.);float transmission=1.;vec3 sun=normalize(vec3(-.6,.8,.3)),localSun=localDirection(sun);
  float silver=phase(dot(rd,sun),.36)*.19;
  const float extinction=1.15;
  for(int i=0;i<128;i++){
   if(float(i)>=steps)break;
   float distance=begin+(float(i)+.38+jitter*.24)*stepSize;
   vec3 p=uEye+rd*distance,q=localEye+localRay*distance;float d=shape(q);
   if(d>.012){
    float optical=shape(q+localSun*.38)*.6+shape(q+localSun*1.05)*1.15;
    float direct=exp(-optical*extinction),powder=1.-exp(-d*1.3);
    float sky=smoothstep(-1.,1.05,(p.y-uCloudOffset.y)/uCloudScale.y);
    // Soft skylight fills the sparse interior; sunlight retains local relief
    // without turning the shadowed lobes into dark, solid-looking clay.
    vec3 illumination=vec3(.07,.09,.12)*(.65+sky*.35)+vec3(.52,.56,.63)*direct*(.35+powder*.45+silver);
    // Three channel locations distribute the in-cloud discharge through its real
    // path. Local optical thickness attenuates the scattered light.
    float flashScatter=0.;
    if(uFlash>.001)for(int j=0;j<3;j++){
     if(uLightPowers[j]<.001)continue;
     vec3 delta=uLights[j]-p;float d2=dot(delta,delta);
     float attenuation=exp(-sqrt(d2)*(.7+d*.22));
     flashScatter+=uLightPowers[j]*(attenuation/(.35+d2)*(.8+.12*phase(dot(rd,normalize(delta+vec3(.0001))),.22))+.12*attenuation);
     // A softer surrounding glow lights nearby billows as well as the tiny
     // channel core. Only radiance changes; opacity and density stay unchanged.
    }
    illumination+=vec3(.63,.70,1.)*flashScatter*1.05;
    float alpha=1.-exp(-d*stepSize*extinction);
    col+=illumination*alpha*transmission;transmission*=1.-alpha;
    if(transmission<.012)break;
   }
  }
  // Translucency comes from the actual density/path length, not a uniform
  // opacity veil applied after an opaque cloud has already been shaded.
  fragColor=vec4(col,transmission);
 }`});
 return {material,dispose(){noise.dispose();material.dispose();}};
}
