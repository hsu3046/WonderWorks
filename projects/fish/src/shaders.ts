// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { nativeShader } from './native-shader';

export const waterNoise = nativeShader<'float'>(`
fn waterNoise(p: vec2<f32>) -> f32 {
  let i=floor(p);let f=fract(p);let w=f*f*(3.0-2.0*f);
  let a=fract(sin(dot(i,vec2<f32>(127.1,311.7)))*43758.5453);
  let b=fract(sin(dot(i+vec2<f32>(1.0,0.0),vec2<f32>(127.1,311.7)))*43758.5453);
  let c=fract(sin(dot(i+vec2<f32>(0.0,1.0),vec2<f32>(127.1,311.7)))*43758.5453);
  let d=fract(sin(dot(i+vec2<f32>(1.0,1.0),vec2<f32>(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
}`);

export const waterCloud = nativeShader<'float'>(`
fn waterCloud(p: vec2<f32>) -> f32 {
  return waterNoise(p)*.54+waterNoise(p*2.03+13.1)*.27+waterNoise(p*4.11-7.2)*.13+waterNoise(p*8.07)*.06;
}`, [waterNoise]);

// Moving cellular boundaries approximate sunlight refracted through a rippling surface.
export const causticField = nativeShader<'float'>(`
fn causticField(p: vec2<f32>, t: f32) -> f32 {
  let warp = vec2<f32>(sin(p.y*2.0+p.x*.35+t*.42),cos(p.x*1.9-p.y*.3-t*.33));
  let q = p + warp*.43 + vec2<f32>(sin(p.y*3.1-p.x*1.2-t*.23),sin(p.x*2.8+p.y*1.1+t*.31))*.16;
  let cell = floor(q);
  let f = fract(q);
  var d1 = 8.0;
  var d2 = 8.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let g = vec2<f32>(f32(x), f32(y));
      let h = fract(sin(vec2<f32>(dot(cell + g, vec2<f32>(127.1,311.7)), dot(cell + g, vec2<f32>(269.5,183.3)))) * 43758.5453);
      let v = g + .5 + .36 * sin(6.2831 * h + t * .55) - f;
      let d = dot(v, v);
      if (d < d1) { d2 = d1; d1 = d; } else { d2 = min(d2, d); }
    }
  }
  // Broader, lower-contrast caustics keep the seabed gently illuminated.
  let focus=pow(1.0-smoothstep(.0,.42,d2-d1),1.3);
  let footprint=max(length(dpdx(p)),length(dpdy(p)));
  return mix(focus,.18,smoothstep(.1,.65,footprint));
}`);

export const waterFog = nativeShader<'vec3'>(`
fn waterFog(c: vec3<f32>, p: vec3<f32>, eye: vec3<f32>, density: f32) -> vec3<f32> {
  let d = distance(p, eye);
  let farColor = mix(vec3<f32>(.025,.25,.40), vec3<f32>(.055,.40,.55), smoothstep(-2.0,20.0,p.y));
  let transmission = exp(-d * vec3<f32>(density*1.5,density*.75,density*.65));
  return c * transmission + farColor * (1.0 - transmission);
}`);

export const terrainShade = nativeShader<'vec3'>(`
fn terrainShade(p: vec3<f32>, normal: vec3<f32>, eye: vec3<f32>, t: f32, strength: f32, fog: f32, rock: f32) -> vec3<f32> {
  let n = normalize(normal);
  let sun = normalize(vec3<f32>(-.35,.86,.24));
  let lit = max(dot(n,sun),0.0);
  let noise = sin(p.x*1.7 + sin(p.z*2.5)) * sin(p.z*1.9+p.x*.7);
  let sand = vec3<f32>(.045,.30,.40) + noise * .012;
  let stone = vec3<f32>(.055,.25,.29) + noise * .011;
  let base = mix(sand,stone,rock) * (.34 + lit * .66);
  let caustic = causticField(p.xz * 1.3 + p.y * .3,t) + causticField(p.xz*.81-p.y*.18,t*.7)*.55;
  let light = vec3<f32>(.13,.27,.21) * caustic * strength * (.2 + lit*.8);
  return waterFog(base + light,p,eye,fog);
}`, [causticField, waterFog]);

// Matte, mottled stone with subdued caustics and a dark contact edge in the sand.
export const rockShade = nativeShader<'vec3'>(`
fn rockShade(p: vec3<f32>, normal: vec3<f32>, eye: vec3<f32>, t: f32, strength: f32, fog: f32) -> vec3<f32> {
  let n=normalize(normal);
  let mineral=waterCloud(p.xz*.85+vec2<f32>(p.y*.73,-p.y*.41));
  let weather=waterCloud(p.xy*1.6+vec2<f32>(p.z*.62,p.z*.37));
  let grain=waterNoise(p.xz*31.0+vec2<f32>(p.y*19.0,p.y*13.0))-.5;
  let grainFade=1.0-smoothstep(.02,.10,max(length(dpdx(p)),length(dpdy(p))));
  var stone=mix(vec3<f32>(.09,.125,.135),vec3<f32>(.28,.30,.27),smoothstep(.23,.78,mineral));
  let algae=smoothstep(.53,.76,weather)*smoothstep(.1,.85,n.y)*.45;
  stone=mix(stone,vec3<f32>(.105,.19,.13),algae)+grain*.035*grainFade;
  let ground=-.45+sin(p.x*.11)*.2+sin(p.z*.08+p.x*.07)*.22;
  let contact=mix(.42,1.0,smoothstep(.0,.65,p.y-ground));
  let lit=.36+max(dot(n,normalize(vec3<f32>(-.35,.86,.24))),0.0)*.64;
  let caustic=causticField(p.xz*.92+p.y*.22,t);
  let light=vec3<f32>(.09,.18,.16)*caustic*strength*max(n.y,.0)*.5;
  return waterFog((stone*lit+light)*contact,p,eye,fog);
}`, [waterCloud,waterNoise,causticField,waterFog]);

export const fishShade = nativeShader<'vec3'>(`
fn fishShade(p: vec3<f32>, normal: vec3<f32>, color: vec3<f32>, skin: vec2<f32>, part: f32, axis: vec3<f32>, eye: vec3<f32>, t: f32, fog: f32) -> vec3<f32> {
  let n = normalize(normal);
  let sun = normalize(vec3<f32>(-.35,.86,.24));
  let view = normalize(eye-p);
  let halfway = normalize(sun+view);
  // Staggered scales stay attached to each body and fade below a pixel footprint.
  let grid = skin * vec2<f32>(30.0,16.0);
  let row = floor(grid.y);
  let stagger = vec2<f32>(grid.x + fract(row*.5),grid.y);
  let cell = floor(stagger);
  let local = fract(stagger)-.5;
  let footprint = max(length(dpdx(grid)),length(dpdy(grid)));
  let resolved = 1.0-smoothstep(.35,1.4,footprint);
  let body = (1.0-step(.5,part))*(1.0-smoothstep(.72,.86,skin.x));
  let seed = fract(sin(dot(cell,vec2<f32>(127.1,311.7)))*43758.5453);
  let tangent = normalize(axis-n*dot(axis,n)+vec3<f32>(.00001));
  let around = normalize(cross(n,tangent));
  let curved = local*vec2<f32>(.27,.19)+vec2<f32>(seed-.5,fract(seed*13.7)-.5)*.16;
  let micro = normalize(n+(tangent*curved.x+around*curved.y)*body*resolved);
  let diffuse = .27+max(dot(n,sun),0.0)*1.05;
  let sheen = pow(max(dot(n,halfway),0.0),32.0)*1.15;
  let glint = pow(max(dot(micro,halfway),0.0),150.0)*6.5;
  let edge = smoothstep(.29,.5,length(local*vec2<f32>(.8,1.0)))*body*resolved;
  let fresnel = pow(1.0-abs(dot(n,view)),3.0);
  let pearl = mix(vec3<f32>(.74,.92,1.0),vec3<f32>(.75,1.0,.91),fresnel);
  let dorsal=smoothstep(.15,.9,cos(skin.y*6.283185));
  let pigment=waterNoise(vec2<f32>(skin.x*18.0,cos(skin.y*6.283185)*5.0));
  let mottling=1.0-dorsal*body*(.05+pigment*.16);
  let flank=smoothstep(.15,.65,abs(sin(skin.y*6.283185)))*body;
  let silverTint=mix(vec3<f32>(.81,.93,1.08),vec3<f32>(.90,1.02,1.02),flank);
  var c = color*silverTint*diffuse*(1.0-edge*.09)*mottling;
  c += pearl*(sheen+glint*mix(.775,.55+seed*.45,resolved)*body+fresnel*.22);
  if (part > 1.5) {
    // A curved wet eye catches the same sun, with no painted-on white dot.
    let eyeSpec = pow(max(dot(n,halfway),0.0),110.0);
    c = color*(.45+max(dot(n,sun),0.0)*.75);
    c += vec3<f32>(.8,.94,1.0)*eyeSpec*select(.8,1.8,part>2.5);
    c += vec3<f32>(.07,.10,.12)*fresnel;
  }
  return waterFog(c,p,eye,fog);
}`, [waterFog,waterNoise]);

export const oceanShade = nativeShader<'vec3'>(`
fn oceanShade(p: vec3<f32>, eye: vec3<f32>, t: f32, strength: f32) -> vec3<f32> {
  let d=normalize(p-eye);
  let up=smoothstep(0.0,.8,d.y);
  var c=mix(vec3<f32>(.035,.30,.46),vec3<f32>(.14,.55,.72),up);
  let light=pow(max(dot(d,normalize(vec3<f32>(-.22,.9,-.18))),0.0),5.0);
  c+=vec3<f32>(.7,1.25,1.1)*light*strength;
  let surfaceP=eye.xz+d.xz*(26.0-eye.y)/max(d.y,.035);
  // A continuous refracted surface replaces thresholded white cloud/foam patches.
  let footprint=max(length(dpdx(surfaceP)),length(dpdy(surfaceP)));
  let rippleFade=1.0-smoothstep(.4,3.0,footprint);
  let a=dot(surfaceP,vec2<f32>(.32,.18))+t*.72;
  let b=dot(surfaceP,vec2<f32>(-.21,.46))-t*.93;
  let wave=dot(surfaceP,vec2<f32>(.79,.53))+t*1.31+sin(a)*.35;
  let slope=(vec2<f32>(.14,.08)*cos(a)+vec2<f32>(-.065,.14)*cos(b)
    +vec2<f32>(.048,.032)*cos(wave))*rippleFade;
  let refracted=normalize(d+vec3<f32>(slope.x,0.0,slope.y));
  let sunFacing=max(dot(refracted,normalize(vec3<f32>(-.22,.9,-.18))),0.0);
  let glow=pow(sunFacing,6.0);
  let glint=pow(sunFacing,110.0);
  let undulation=(sin(a)*.5+sin(b)*.3+sin(wave)*.2)*rippleFade;
  let surfaceColor=vec3<f32>(.075,.40,.57)+vec3<f32>(.015,.035,.04)*undulation
    +(vec3<f32>(.42,.85,1.0)*glow+vec3<f32>(3.0,3.3,3.2)*glint)*strength;
  c=mix(c,surfaceColor,smoothstep(.08,.55,d.y)*.92);
  return c;
}`);

// Integrate a refracted sunlight field up to the first visible surface, at half resolution.
export const volumeLight = nativeShader<'vec3'>(`
fn volumeLight(end: vec3<f32>, eye: vec3<f32>, t: f32, strength: f32) -> vec3<f32> {
  let delta=end-eye;
  let ray=normalize(delta);
  let distance=min(length(delta),65.0);
  let stepSize=distance/20.0;
  let jitter=.25+.5*fract(sin(dot(ray.xy,vec2<f32>(12.9898,78.233)))*43758.5453);
  let sun=normalize(vec3<f32>(-.38,.9,-.18));
  // Concentrate the dazzling light toward the sun; side views retain fish silhouettes.
  let phase=.18+pow(max(dot(ray,sun),0.0),4.0)*2.4;
  let drift=vec2<f32>(-.42+sin(t*.27)*.12,-.18+cos(t*.23)*.08);
  var sum=0.0;
  for(var i=0;i<20;i++) {
    let travel=(f32(i)+jitter)*stepSize;
    let p=eye+ray*travel;
    let projected=p.xz+drift*(26.0-p.y);
    let q=projected+vec2<f32>(sin(projected.y*.31+t*.85),cos(projected.x*.27-t*.71))*.9;
    let wide=waterNoise(q*.19+vec2<f32>(t*.16,-t*.11));
    let fine=waterNoise(q*.64+vec2<f32>(t*.21,t*.14));
    // Refracted curtains sweep, widen and brighten locally without pulsing the whole screen.
    let curtain=pow(.5+.5*sin(q.x*.65+q.y*.24+t*.65+wide*2.0),3.0);
    let shimmer=.8+.2*sin(t*.8+q.x*.33-q.y*.2);
    let streak=pow(smoothstep(.2,.9,wide),1.4)*(.38+smoothstep(.2,.85,fine)*.95)*(.5+curtain*1.8)*shimmer;
    let below=1.0-smoothstep(24.0,29.0,p.y);
    sum+=streak*exp(-travel*.023)*exp(-max(26.0-p.y,0.0)*.018)*stepSize*below;
  }
  return vec3<f32>(.36,.70,.90)*sum*.18*phase*strength;
}`, [waterNoise]);
