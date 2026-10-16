import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { G, ENV } from './env.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// ---------------------------------------------------------------------------
// Physically based sky: single-scattering Rayleigh/Mie/ozone (Nishita style),
// golden-hour altocumulus cloud layer lit through the atmosphere, HDR sun disc.
// The dome follows the active camera (also for cube captures & reflections).
// ---------------------------------------------------------------------------

export const SKY_UNIFORMS = {
  uSunI: { value: ENV.skySunIntensity },
  uSunDisc: { value: 1.0 },
  uCloudCover: { value: 0.50 },
  uCloudOpacity: { value: 1.0 },
  uCloudScale: { value: 1.0 },
  uCloudOffset: { value: new THREE.Vector2(0, 0) },
  uGroundColor: { value: new THREE.Vector3(0.10, 0.10, 0.11) },
  uSkyTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
};

export const SKY_GLSL = /* glsl */ `
${NOISE}
const float Re = 6360e3;
const float Ra = 6420e3;
const vec3 bR = vec3(5.802e-6, 13.558e-6, 33.1e-6);
const vec3 bO = vec3(0.650e-6, 1.881e-6, 0.085e-6);
const float bM = 11e-6;
const float Hr = 7994.0;
const float Hm = 1200.0;
const float gM = 0.78;

vec2 raySphere(vec3 ro, vec3 rd, float r){
  float b = dot(ro, rd); float c = dot(ro, ro) - r * r; float d = b * b - c;
  if (d < 0.0) return vec2(-1.0); d = sqrt(d); return vec2(-b - d, -b + d);
}
// transmittance from point p toward the sun
vec3 sunTransmittance(vec3 p, vec3 sun){
  vec2 t = raySphere(p, sun, Ra);
  float L = max(t.y, 0.0);
  float odR = 0.0, odM = 0.0;
  const int NL = 8;
  for (int j = 0; j < NL; j++){
    float s = (float(j) + 0.5) / float(NL);
    float tt = L * s * s; float dt = L * 2.0 * s / float(NL);
    float h = length(p + sun * tt) - Re;
    if (h < -50.0) return vec3(0.0);
    h = max(h, 0.0);
    odR += exp(-h / Hr) * dt; odM += exp(-h / Hm) * dt;
  }
  return exp(-(bR * odR + bO * odR * 2.0 + bM * 1.1 * odM));
}
vec3 atmosphere(vec3 dir, vec3 sun, float sunI, out vec3 transmit){
  vec3 ro = vec3(0.0, Re + 60.0, 0.0);
  vec2 t = raySphere(ro, dir, Ra);
  float L = t.y;
  vec2 tg = raySphere(ro, dir, Re);
  if (tg.x > 0.0) L = tg.x;
  const int N = 20;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < N; i++){
    float s = (float(i) + 0.5) / float(N);
    float tt = L * s * s; float dt = L * 2.0 * s / float(N);
    vec3 p = ro + dir * tt;
    float h = max(length(p) - Re, 0.0);
    float hr = exp(-h / Hr) * dt; float hm = exp(-h / Hm) * dt;
    odR += hr; odM += hm;
    vec3 tl = sunTransmittance(p, sun);
    vec3 tv = exp(-(bR * odR + bO * odR * 2.0 + bM * 1.1 * odM));
    vec3 att = tl * tv;
    sumR += att * hr; sumM += att * hm;
  }
  transmit = exp(-(bR * odR + bO * odR * 2.0 + bM * 1.1 * odM));
  float mu = dot(dir, sun);
  float pR = 3.0 / (16.0 * 3.14159265) * (1.0 + mu * mu);
  float g2 = gM * gM;
  float pM = 3.0 / (8.0 * 3.14159265) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * gM * mu, 1.5));
  return sunI * (sumR * bR * pR + sumM * bM * pM);
}

// ---- clouds ----
uniform float uCloudCover;
uniform float uCloudOpacity;
uniform float uCloudScale;
uniform vec2 uCloudOffset;

float cloudDensity(vec2 p){
  // p in km on the cloud plane. Altocumulus: patches of puffy cells.
  vec2 q = p * uCloudScale;
  // large-scale coverage patches, slightly stretched along the wind
  float cov = n_fbm(q * vec2(0.16, 0.28) + 2.0, 4) * 0.5 + 0.5;
  cov = smoothstep(1.0 - uCloudCover - 0.12, 1.0 - uCloudCover + 0.28, cov);
  vec2 w = vec2(n_snoise(q * 0.8 + 5.2), n_snoise(q * 0.8 + 1.3)) * 0.22;
  vec2 c1 = n_worley(q * 2.4 + w * 2.0);
  float puff = 1.0 - c1.x * 1.2;
  vec2 c2 = n_worley(q * 6.3 + w * 5.0 + 9.0);
  puff = puff * 0.72 + (1.0 - c2.x) * 0.38;
  float detail = n_fbm(q * 11.0 + w * 4.0, 2) * 0.12;
  float d = cov * (puff + detail) - 0.36;
  return clamp(d * 2.6, 0.0, 1.0);
}

vec3 skyColor(vec3 dir, vec3 sun, float sunI, float disc){
  vec3 d = dir;
  float below = smoothstep(0.0, -0.08, d.y);
  d.y = max(d.y, 0.0005);
  d = normalize(d);
  vec3 tr;
  vec3 col = atmosphere(d, sun, sunI, tr);
  vec3 sunCol = sunTransmittance(vec3(0.0, Re + 60.0, 0.0), sun);

  // sun disc with limb darkening
  float cosA = dot(d, sun);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  float R = 0.0095;
  if (disc > 0.0) {
    float m = 1.0 - smoothstep(R * 0.92, R, ang);
    float r = clamp(ang / R, 0.0, 1.0);
    float limb = 1.0 - 0.6 * (1.0 - sqrt(max(1.0 - r * r, 0.0)));
    col += sunCol * m * limb * sunI * 700.0 * disc;
    // tight corona
    col += sunCol * sunI * 0.9 * exp(-ang * 60.0) * disc;
  }

  // clouds
  if (dir.y > 0.003) {
    float Hc = 2600.0;
    float tc = Hc / d.y;
    vec2 cp = (d.xz * tc) / 1000.0 + uCloudOffset;
    float den = cloudDensity(cp);
    if (den > 0.001) {
      vec2 sd = normalize(sun.xz + 1e-5);
      // self shadowing: march toward the (low) sun through the layer
      float od = cloudDensity(cp + sd * 0.06) * 0.6 + cloudDensity(cp + sd * 0.16) * 1.0
               + cloudDensity(cp + sd * 0.34) * 1.0 + cloudDensity(cp + sd * 0.65) * 0.8;
      float shadow = exp(-od * 1.15);
      vec3 sunAtCloud = sunTransmittance(vec3(0.0, Re + Hc, 0.0), sun) * vec3(1.0, 0.84, 0.64);
      float mu = dot(d, sun);
      float g1 = 0.65, g2 = -0.2;
      float hg1 = (1.0 - g1*g1) / pow(1.0 + g1*g1 - 2.0*g1*mu, 1.5);
      float hg2 = (1.0 - g2*g2) / pow(1.0 + g2*g2 - 2.0*g2*mu, 1.5);
      float phase = mix(hg2, hg1, 0.5) / 12.566;
      float powder = 1.0 - exp(-den * 3.0);
      vec3 lit = sunAtCloud * sunI * 0.16 * (phase * 7.0 + 0.3) * (shadow * 0.9 + 0.1) * (0.4 + 0.6 * powder);
      // silver lining at thin edges toward the sun
      lit += sunAtCloud * sunI * 0.1 * pow(max(mu, 0.0), 10.0) * (1.0 - den) * 3.0;
      vec3 trz;
      vec3 zen = atmosphere(vec3(0.0, 1.0, 0.0), sun, sunI, trz);
      vec3 amb = zen * 0.95 + col * 0.2;
      vec3 ccol = lit + amb * (0.35 + 0.5 * (1.0 - den));
      float alpha = smoothstep(0.0, 0.55, den) * uCloudOpacity;
      // aerial perspective toward horizon
      float fade = exp(-tc / 52000.0);
      alpha *= smoothstep(0.003, 0.06, d.y);
      ccol = mix(col, ccol, fade);
      col = mix(col, ccol, alpha);
    }
  }
  // below horizon -> ground haze colour
  col = mix(col, col * 0.55 + vec3(0.0), below);
  return col;
}
`;

const atmosphereMap = { value: null }, atmosphereConstants = { value: null };
const cloudNear = {value:null}, cloudFar={value:null};

// Cache only time-invariant atmosphere. Clouds, disc and sky tint remain live.
export function prepareSkyCache(renderer) {
  const make = (w,h,body) => {
    const target=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:false,wrapS:THREE.RepeatWrapping});
    const material=new THREE.ShaderMaterial({uniforms:{...SKY_UNIFORMS,uSunDir:G.uSunDir,uSunI:SKY_UNIFORMS.uSunI},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 vUv; uniform vec3 uSunDir; uniform float uSunI; ${SKY_GLSL} void main(){${body}}`,depthTest:false,depthWrite:false});
    const quad=new FullScreenQuad(material), previous=renderer.getRenderTarget();
    try {renderer.setRenderTarget(target);quad.render(renderer);} finally {renderer.setRenderTarget(previous);quad.dispose();material.dispose();}
    return target;
  };
  // Square elevation coordinates devote more texels to the golden-hour horizon.
  const map=make(1024,256,`float a=(vUv.x-.5)*6.2831853; float y=vUv.y*vUv.y; vec3 d=vec3(cos(a)*sqrt(1.-y*y),y,sin(a)*sqrt(1.-y*y));vec3 tr; gl_FragColor=vec4(atmosphere(d,normalize(uSunDir),uSunI,tr),1.);`);
  const constants=make(3,1,`vec3 sun=normalize(uSunDir),tr,c; if(vUv.x<.333)c=sunTransmittance(vec3(0.,Re+60.,0.),sun);else if(vUv.x<.666)c=sunTransmittance(vec3(0.,Re+2600.,0.),sun);else c=atmosphere(vec3(0.,1.,0.),sun,uSunI,tr);gl_FragColor=vec4(c,1.);`);
  const near=make(2048,2048,'float d=cloudDensity((vUv-.5)*64.);gl_FragColor=vec4(d,d,d,1.);');
  const far=make(1024,1024,'float d=cloudDensity((vUv-.5)*256.);gl_FragColor=vec4(d,d,d,1.);');
  atmosphereMap.value=map.texture;atmosphereConstants.value=constants.texture;
  cloudNear.value=near.texture;cloudFar.value=far.texture;
  return {dispose(){map.dispose();constants.dispose();near.dispose();far.dispose();}};
}

export function createSky(cached = false) {
  let skyCode=SKY_GLSL;
  if(cached) skyCode=skyCode
    .replace('float cloudDensity(vec2 p){','float cloudDensityRaw(vec2 p){')
    .replace('vec3 skyColor(vec3 dir, vec3 sun, float sunI, float disc){',`float cloudDensity(vec2 p){
      float d=max(abs(p.x),abs(p.y));
      if(d<30.)return texture2D(uCloudNear,p/64.+.5).r;
      if(d<32.)return mix(texture2D(uCloudNear,p/64.+.5).r,texture2D(uCloudFar,p/256.+.5).r,smoothstep(30.,32.,d));
      if(d<124.)return texture2D(uCloudFar,p/256.+.5).r;
      if(d<128.)return mix(texture2D(uCloudFar,p/256.+.5).r,cloudDensityRaw(p),smoothstep(124.,128.,d));
      return cloudDensityRaw(p);
    }
    vec3 skyColor(vec3 dir, vec3 sun, float sunI, float disc){`)

    .replace('vec3 col = atmosphere(d, sun, sunI, tr);','vec3 col = texture2D(uAtmosphere, vec2(atan(d.z,d.x)/6.2831853+.5,sqrt(max(d.y,0.0)))).rgb;')
    .replace('vec3 sunCol = sunTransmittance(vec3(0.0, Re + 60.0, 0.0), sun);','vec3 sunCol = texture2D(uAtmosphereConstants,vec2(1.0/6.0,.5)).rgb;')
    .replace('sunTransmittance(vec3(0.0, Re + Hc, 0.0), sun)','texture2D(uAtmosphereConstants,vec2(.5,.5)).rgb')
    .replace('atmosphere(vec3(0.0, 1.0, 0.0), sun, sunI, trz)','texture2D(uAtmosphereConstants,vec2(5.0/6.0,.5)).rgb');
  const geo = new THREE.SphereGeometry(4800, 64, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCloudNear: cloudNear,uCloudFar: cloudFar,
      uAtmosphere: atmosphereMap,
      uAtmosphereConstants: atmosphereConstants,
      uSunDir: G.uSunDir,
      uTime: G.uTime,
      ...SKY_UNIFORMS,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.99999; // at far plane
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uSunI;
      uniform float uSunDisc;
      uniform vec3 uSkyTint;
      varying vec3 vDir;
      uniform sampler2D uCloudNear; uniform sampler2D uCloudFar;
      uniform sampler2D uAtmosphere;
      uniform sampler2D uAtmosphereConstants;
      ${skyCode}
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyColor(d, normalize(uSunDir), uSunI, uSunDisc) * uSkyTint;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000; // draw after other opaques so only visible sky pixels are shaded
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
  return mesh;
}
