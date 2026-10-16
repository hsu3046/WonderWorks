import { postPlan } from './realtime.js';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { NOISE } from './glsl.js';

// ---------------------------------------------------------------------------
// Offline-quality post pipeline.
//   per sub-frame : scene (HDR, MSAA, depth) -> SSAO -> accumulate (additive)
//   per frame     : god rays -> depth of field -> bloom -> grade/tonemap -> out
// Sub-frame accumulation gives AA + motion blur + soft shadows + noise-free AO.
// ---------------------------------------------------------------------------

const VS = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function mat(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
}

const DEPTH_UTIL = /* glsl */ `
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 uProjInv;
float viewZ(float d){ return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar); }
vec3 viewPosFrom(vec2 uv, float d){
  vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * c; return v.xyz / v.w;
}
`;

function rt(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, ...opts,
  });
}

export const DEFAULT_POST = {
  exposure: 1.0,
  aoStrength: 0.75, aoRadius: 0.9, aoIntensity: 1.3,
  vol: 0.0, volDensity: 0.012, volHeight: 20, volMaxDist: 150, volNoise: 0.5, volBox: null, // volBox: {min:[x,y,z], max:[x,y,z], density}
  godrays: 0.0, godraysDecay: 0.965, godraysThreshold: 10.0,
  dof: false, focusDist: 10, fstop: 4.0, focalLength: 35, maxCoc: 22,
  bloom: 0.06, bloomRadius: 0.85,
  vignette: 0.32, grain: 0.007, chromAb: 0.0015,
  saturation: 1.02, contrast: 1.05, temperature: 0.0, tint: 0.0,
  lift: [0, 0, 0], gain: [1, 1, 1], gamma: [1, 1, 1],
  tonemap: 2, // 0 = ACES, 1 = AgX-punchy, 2 = mix
  highlightWarmth: 0.0,
  clarity: 0.0, sharpen: 0.18, punch: 0.4, flare: 0.0,
};

export class Pipeline {
  constructor(renderer, { width, height, msaa = 4, aoSamples = 16, dofQuality = 1, realtime = false } = {}) {
    this.r = renderer;
    this.realtime = realtime;
    this.msaa = msaa;
    this.aoSamples = aoSamples;
    this.dofQuality = dofQuality;
    this.quad = new FullScreenQuad(null);
    this._build();
    this.setSize(width, height);
  }

  _build() {
    const NOI = NOISE;
    // ---- SSAO (alchemy / SAO style) ----
    this.aoMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tDepth;
      uniform vec2 uRes;
      uniform float uRadius;
      uniform float uIntensity;
      uniform float uFrame;
      uniform mat4 uProj;
      ${DEPTH_UTIL}
      ${NOI}
      vec3 vp(vec2 uv){ return viewPosFrom(uv, texture2D(tDepth, uv).x); }
      void main(){
        float d = texture2D(tDepth, vUv).x;
        if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
        vec3 P = viewPosFrom(vUv, d);
        vec2 px = 1.0 / uRes;
        vec3 pr = vp(vUv + vec2(px.x, 0.0)), pl = vp(vUv - vec2(px.x, 0.0));
        vec3 pu = vp(vUv + vec2(0.0, px.y)), pd = vp(vUv - vec2(0.0, px.y));
        vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
        vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
        vec3 N = normalize(cross(dx, dy));
        float rpx = uRadius * uProj[1][1] * 0.5 * uRes.y / -P.z;
        rpx = min(rpx, 120.0);
        float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uFrame * 0.618034);
        float ao = 0.0;
        const int NS = ${this.aoSamples};
        float r2 = uRadius * uRadius;
        for (int i = 0; i < NS; i++){
          float fi = (float(i) + 0.5) / float(NS);
          float ang = (float(i) * 2.39996 + noise * 6.2831);
          float rr = sqrt(fi) * rpx;
          vec2 off = vec2(cos(ang), sin(ang)) * rr * px;
          vec3 S = vp(vUv + off);
          vec3 v = S - P;
          float vv = dot(v, v);
          float vn = dot(v, N);
          float f = max(r2 - vv, 0.0) / r2;
          ao += f * f * f * max((vn - 0.01 * -P.z) / (vv + 0.01), 0.0);
        }
        ao = max(0.0, 1.0 - ao * uIntensity * 2.0 / float(NS));
        gl_FragColor = vec4(ao, ao, ao, 1.0);
      }
    `, {
      tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uIntensity: { value: 1 },
      uFrame: { value: 0 }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
      cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
    });

    this.aoBlurMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tAO;
      uniform sampler2D tDepth;
      uniform vec2 uDir;
      uniform vec2 uRes;
      ${DEPTH_UTIL}
      void main(){
        float d0 = -viewZ(texture2D(tDepth, vUv).x);
        float sum = 0.0, wsum = 0.0;
        for (int i = -4; i <= 4; i++){
          vec2 uv = vUv + uDir * float(i) / uRes;
          float a = texture2D(tAO, uv).x;
          float d = -viewZ(texture2D(tDepth, uv).x);
          float w = exp(-float(i * i) / 10.0) * exp(-abs(d - d0) / (0.02 * d0 + 0.01) );
          sum += a * w; wsum += w;
        }
        float r = sum / max(wsum, 1e-4);
        gl_FragColor = vec4(r, r, r, 1.0);
      }
    `, {
      tAO: { value: null }, tDepth: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2() },
      uProjInv: { value: new THREE.Matrix4() }, cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
    });

    // ---- volumetric sun scattering (ray-marched through the sun shadow map) ----
    this.volMat = mat(/* glsl */ `
      precision highp sampler2DShadow;
      varying vec2 vUv;
      uniform sampler2D tDepth;
      uniform sampler2DShadow tShadow;
      uniform mat4 uShadowMatrix;
      uniform mat4 uCamWorld;
      uniform vec3 uCamPos;
      uniform vec3 uSunDir;
      uniform float uFrame;
      uniform float uMaxDist;
      uniform float uDensity;      // base scattering coefficient at ground (1/m)
      uniform float uHeightFall;   // m
      uniform vec3 uBoxMin; uniform vec3 uBoxMax; uniform float uBoxDensity;
      uniform float uNoiseAmt;
      uniform float uTime;
      ${DEPTH_UTIL}
      ${NOI}
      float density(vec3 p){
        float d = uDensity * exp(-max(p.y, 0.0) / uHeightFall);
        vec3 inb = step(uBoxMin, p) * step(p, uBoxMax);
        d += uBoxDensity * inb.x * inb.y * inb.z;
        if (uNoiseAmt > 0.0) d *= 1.0 + uNoiseAmt * n_snoise3(p * 0.18 + vec3(uTime * 0.05, 0.0, uTime * 0.03));
        return max(d, 0.0);
      }
      void main(){
        float dz = texture2D(tDepth, vUv).x;
        vec3 vpos = viewPosFrom(vUv, min(dz, 0.999999));
        vec3 wpos = (uCamWorld * vec4(vpos, 1.0)).xyz;
        vec3 ray = wpos - uCamPos;
        float dist = length(ray);
        vec3 dir = ray / dist;
        float L = min(dist, uMaxDist);
        const int N = 48;
        float dt = L / float(N);
        float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uFrame * 0.618034);
        float T = 1.0;
        float acc = 0.0;
        for (int i = 0; i < N; i++){
          float t = (float(i) + jit) * dt;
          vec3 p = uCamPos + dir * t;
          vec4 sc = uShadowMatrix * vec4(p, 1.0);
          sc.xyz /= sc.w;
          float vis = 1.0;
          if (all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) {
            vis = texture(tShadow, vec3(sc.xy, sc.z - 0.0005));
          }
          float s = density(p);
          acc += T * s * vis * dt;
          T *= exp(-s * dt);
        }
        float mu = dot(dir, uSunDir);
        float g = 0.72;
        float hg = (1.0 - g*g) / pow(1.0 + g*g - 2.0*g*mu, 1.5) / 12.566;
        float iso = 1.0 / 12.566;
        float phase = mix(iso, hg, 0.8);
        gl_FragColor = vec4(vec3(acc * phase), 1.0);
      }
    `, {
      tDepth: { value: null }, tShadow: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3() },
      uFrame: { value: 0 }, uMaxDist: { value: 150 }, uDensity: { value: 0.01 }, uHeightFall: { value: 20 },
      uBoxMin: { value: new THREE.Vector3(1e5, 1e5, 1e5) }, uBoxMax: { value: new THREE.Vector3(-1e5, -1e5, -1e5) }, uBoxDensity: { value: 0 },
      uNoiseAmt: { value: 0.5 }, uTime: { value: 0 },
      uProjInv: { value: new THREE.Matrix4() }, cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
    });

    // ---- accumulate (additive) ----
    this.accMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tAO;
      uniform sampler2D tVol;
      uniform float uAOStrength;
      uniform float uWeight;
      uniform float uUseAO;
      uniform float uUseVol;
      uniform vec3 uVolColor;
      uniform vec2 uVolTexel;
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb;
        if (uUseAO > 0.5) {
          float ao = texture2D(tAO, vUv).x;
          c *= mix(1.0, ao, uAOStrength);
        }
        if (uUseVol > 0.5) {
          vec3 v = texture2D(tVol, vUv).rgb * 0.4;
          v += (texture2D(tVol, vUv + vec2(uVolTexel.x, 0.0)).rgb + texture2D(tVol, vUv - vec2(uVolTexel.x, 0.0)).rgb
              + texture2D(tVol, vUv + vec2(0.0, uVolTexel.y)).rgb + texture2D(tVol, vUv - vec2(0.0, uVolTexel.y)).rgb) * 0.15;
          c += v * uVolColor;
        }
        c = min(c, vec3(60000.0));
        if (any(isnan(c))) c = vec3(0.0);
        gl_FragColor = vec4(c * uWeight, uWeight);
      }
    `, {
      tColor: { value: null }, tAO: { value: null }, tVol: { value: null }, uAOStrength: { value: 0.7 }, uWeight: { value: 1 }, uUseAO: { value: 1 },
      uUseVol: { value: 0 }, uVolColor: { value: new THREE.Vector3(1, 1, 1) }, uVolTexel: { value: new THREE.Vector2() },
    }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });

    // ---- god rays ----
    this.godMaskMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uSun;
      uniform float uAspect;
      uniform float uThreshold;
      void main(){
        float d = texture2D(tDepth, vUv).x;
        vec3 c = texture2D(tColor, vUv).rgb;
        float sky = step(0.99999, d);
        vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
        float fall = exp(-dot(dv, dv) * 14.0);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 m = c / max(l, 1e-4) * min(max(l - uThreshold, 0.0), 6.0);
        gl_FragColor = vec4(m * sky * fall, 1.0);
      }
    `, { tColor: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uThreshold: { value: 1 } });

    this.godBlurMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tIn;
      uniform vec2 uSun;
      uniform float uStep;
      uniform float uDecay;
      uniform float uFrame;
      void main(){
        vec2 delta = (uSun - vUv) * uStep;
        float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uFrame) * 43758.5453);
        vec2 uv = vUv + delta * jit;
        vec3 sum = vec3(0.0); float w = 1.0, ws = 0.0;
        for (int i = 0; i < 24; i++){
          sum += texture2D(tIn, uv).rgb * w; ws += w;
          w *= uDecay; uv += delta;
        }
        gl_FragColor = vec4(sum / ws, 1.0);
      }
    `, { tIn: { value: null }, uSun: { value: new THREE.Vector2() }, uStep: { value: 0.02 }, uDecay: { value: 0.96 }, uFrame: { value: 0 } });

    this.addMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tA;
      uniform sampler2D tB;
      uniform vec3 uTintB;
      void main(){ gl_FragColor = vec4(texture2D(tA, vUv).rgb + texture2D(tB, vUv).rgb * uTintB, 1.0); }
    `, { tA: { value: null }, tB: { value: null }, uTintB: { value: new THREE.Vector3(1, 1, 1) } });

    // ---- depth of field (scatter-as-gather, Gustafsson) ----
    this.cocMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform float uFocus, uFocal, uFstop, uSensor, uWidth, uMaxCoc;
      ${DEPTH_UTIL}
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb;
        float z = -viewZ(texture2D(tDepth, vUv).x);
        float f = uFocal * 0.001;
        float A = f / uFstop;
        float coc = A * f * (z - uFocus) / (z * (uFocus - f));
        float px = coc / (uSensor * 0.001) * uWidth;
        px = clamp(px, -uMaxCoc, uMaxCoc);
        gl_FragColor = vec4(c, px);
      }
    `, {
      tColor: { value: null }, tDepth: { value: null }, uFocus: { value: 10 }, uFocal: { value: 35 }, uFstop: { value: 4 },
      uSensor: { value: 36 }, uWidth: { value: 1920 }, uMaxCoc: { value: 20 },
      uProjInv: { value: new THREE.Matrix4() }, cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
    });

    this.dofMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tCoc; // rgb color, a = signed coc px
      uniform vec2 uRes;
      uniform float uMaxCoc;
      uniform float uRadScale;
      void main(){
        vec4 c0 = texture2D(tCoc, vUv);
        float centerSize = abs(c0.a);
        vec3 color = c0.rgb;
        float tot = 1.0;
        float radius = uRadScale;
        float ang = 0.0;
        vec2 px = 1.0 / uRes;
        for (int i = 0; i < 600; i++){
          if (radius >= uMaxCoc) break;
          ang += 2.39996323;
          vec2 tc = vUv + vec2(cos(ang), sin(ang)) * px * radius;
          vec4 s = texture2D(tCoc, tc);
          float sampleSize = abs(s.a);
          if (s.a > c0.a) sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
          float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
          color += mix(color / tot, s.rgb, m);
          tot += 1.0;
          radius += uRadScale / radius;
        }
        gl_FragColor = vec4(color / tot, 1.0);
      }
    `, { tCoc: { value: null }, uRes: { value: new THREE.Vector2() }, uMaxCoc: { value: 20 }, uRadScale: { value: 0.6 } });

    // ---- bloom (CoD / Unreal style mip chain) ----
    this.downMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tIn;
      uniform vec2 uTexel;
      uniform float uKaris;
      vec3 s(vec2 o){
        vec3 c = texture2D(tIn, vUv + o * uTexel).rgb;
        if (uKaris > 0.5) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c *= 24.0 / (24.0 + l); }
        return c;
      }
      float kw(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
      void main(){
        vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
        vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
        vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
        vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
        vec3 r;
        if (uKaris > 0.5) {
          vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
          float w0 = kw(g0), w1 = kw(g1), w2 = kw(g2), w3 = kw(g3), w4 = kw(g4);
          r = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
        } else {
          r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
        }
        gl_FragColor = vec4(max(r, vec3(0.0)), 1.0);
      }
    `, { tIn: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 } });

    this.upMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tIn;
      uniform vec2 uTexel;
      uniform float uRadius;
      vec3 s(vec2 o){ return texture2D(tIn, vUv + o * uTexel * uRadius).rgb; }
      void main(){
        vec3 r = s(vec2(0)) * 4.0 + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
               + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
        gl_FragColor = vec4(r / 16.0, 1.0);
      }
    `, { tIn: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } }, {
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true,
    });

    // ---- final grade ----
    this.finalMat = mat(/* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tBloom;
      uniform sampler2D tLocal;
      uniform float uClarity;
      uniform float uSharpen;
      uniform float uBloom;
      uniform float uExposure;
      uniform float uSaturation, uContrast, uVignette, uGrain, uChromAb, uFrame, uTonemap, uHiWarm, uPunch;
      uniform vec3 uWB;
      uniform vec3 uLift, uGamma, uGain;
      uniform vec2 uRes;
      uniform vec2 uSunUV;
      uniform float uFlare;
      uniform vec3 uFlareTint;
      float sunVisibility(){
        if (uFlare <= 0.0) return 0.0;
        float v = 0.0;
        for (int i = 0; i < 9; i++){
          float a = float(i) * 0.6981;
          vec2 o = i == 0 ? vec2(0.0) : vec2(cos(a), sin(a)) * 3.0 / uRes;
          float l = dot(texture2D(tColor, uSunUV + o).rgb, vec3(0.2126, 0.7152, 0.0722));
          v += smoothstep(20.0, 200.0, l);
        }
        float onScreen = step(0.0, uSunUV.x) * step(uSunUV.x, 1.0) * step(0.0, uSunUV.y) * step(uSunUV.y, 1.0);
        return v / 9.0 * onScreen;
      }
      vec3 lensFlare(vec2 uv, float vis){
        if (vis <= 0.001) return vec3(0.0);
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 sun = uSunUV;
        vec2 axis = vec2(0.5) - sun;
        vec3 acc = vec3(0.0);
        // ghosts along the optical axis
        const int NG = 6;
        float gpos[6]; gpos[0] = 0.55; gpos[1] = 0.85; gpos[2] = 1.15; gpos[3] = 1.42; gpos[4] = 1.75; gpos[5] = 2.1;
        float grad[6]; grad[0] = 0.035; grad[1] = 0.06; grad[2] = 0.025; grad[3] = 0.11; grad[4] = 0.045; grad[5] = 0.16;
        vec3 gcol[6]; gcol[0] = vec3(1.0, 0.6, 0.25); gcol[1] = vec3(0.35, 0.8, 0.6); gcol[2] = vec3(1.0, 0.45, 0.3); gcol[3] = vec3(0.4, 0.55, 1.0); gcol[4] = vec3(0.9, 0.8, 0.4); gcol[5] = vec3(0.5, 0.75, 1.0);
        for (int i = 0; i < NG; i++){
          vec2 c = sun + axis * gpos[i];
          float d = length((uv - c) * asp);
          float r = grad[i];
          float disc = smoothstep(r, r * 0.75, d) * (0.35 + 0.65 * smoothstep(0.0, r, d));
          acc += gcol[i] * disc * 0.05;
        }
        // soft halo ring around the sun
        float ds = length((uv - sun) * asp);
        acc += vec3(1.0, 0.7, 0.4) * smoothstep(0.30, 0.34, ds) * smoothstep(0.40, 0.34, ds) * 0.018;
        // horizontal streak
        vec2 dv = (uv - sun) * asp;
        acc += vec3(1.0, 0.75, 0.5) * exp(-abs(dv.y) * 220.0) * exp(-abs(dv.x) * 4.0) * 0.35;
        // veiling glare
        acc += vec3(1.0, 0.72, 0.45) * exp(-ds * 7.0) * 0.12;
        return acc * vis * uFlareTint;
      }
      ${NOI}
      vec3 acesFit(vec3 v){
        const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
        const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
        v = inM * v;
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return clamp(outM * (a / b), 0.0, 1.0);
      }
      // AgX (Troy Sobotka / Benjamin Wrensch fit) with punchy look
      vec3 agxContrast(vec3 x){
        vec3 x2 = x * x; vec3 x4 = x2 * x2;
        return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      }
      vec3 agx(vec3 v){
        const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                            0.0784335999999992, 0.878468636469772, 0.0784336,
                            0.0792237451477643, 0.0791661274605434, 0.879142973793104);
        const float mn = -12.47393, mx = 4.026069;
        v = m * v;
        v = clamp(log2(max(v, 1e-10)), mn, mx);
        v = (v - mn) / (mx - mn);
        return agxContrast(v);
      }
      vec3 agxEotf(vec3 v){
        const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                             -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                             -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
        v = mi * v;
        return pow(max(v, 0.0), vec3(2.2));
      }
      vec3 agxPunchy(vec3 v){
        float l = dot(v, vec3(0.2126, 0.7152, 0.0722));
        vec3 off = vec3(0.0), sl = vec3(1.0), pw = vec3(mix(1.0, 1.12, uPunch));
        float sat = mix(1.0, 1.2, uPunch);
        v = pow(max(v * sl + off, 0.0), pw);
        return l + sat * (v - l);
      }
      vec3 toSRGB(vec3 c){
        c = clamp(c, 0.0, 1.0);
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main(){
        vec2 uv = vUv;
        vec2 cc = uv - 0.5;
        float r2 = dot(cc, cc);
        vec3 col;
        if (uChromAb > 0.0) {
          vec2 o = cc * r2 * uChromAb * 4.0;
          col.r = texture2D(tColor, uv - o).r;
          col.g = texture2D(tColor, uv).g;
          col.b = texture2D(tColor, uv + o).b;
        } else col = texture2D(tColor, uv).rgb;
        if (uSharpen > 0.0) {
          vec2 px = 1.0 / uRes;
          vec3 n = texture2D(tColor, uv + vec2(px.x, 0.0)).rgb + texture2D(tColor, uv - vec2(px.x, 0.0)).rgb
                 + texture2D(tColor, uv + vec2(0.0, px.y)).rgb + texture2D(tColor, uv - vec2(0.0, px.y)).rgb;
          vec3 d = col - n * 0.25;
          // limit to avoid halos on very bright edges
          col = max(col + uSharpen * clamp(d, -0.5 * (col + 0.05), 0.5 * (col + 0.05)), 0.0);
        }
        if (uClarity != 0.0) {
          float l0 = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float lb = dot(texture2D(tLocal, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
          float r = log2((l0 + 0.02) / (lb + 0.02));
          col *= exp2(uClarity * clamp(r, -2.0, 2.0) * 0.5);
        }
        if (uBloom > 0.0) col += texture2D(tBloom, uv).rgb * uBloom;
        col += lensFlare(uv, sunVisibility()) * uFlare;
        col *= uExposure * uWB;
        // highlight warmth (film-like halation of the bright end)
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, col * vec3(1.06, 0.98, 0.88), clamp(lum * 0.25, 0.0, 1.0) * uHiWarm);
        vec3 tA = acesFit(col * 0.85);
        vec3 tX = agxEotf(agxPunchy(agx(col)));
        vec3 t = uTonemap < 0.5 ? tA : (uTonemap < 1.5 ? tX : mix(tA, tX, 0.5));
        // grade (display referred)
        t = pow(max(t, 0.0), 1.0 / uGamma);
        t = t * uGain + uLift * (1.0 - t);
        float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
        t = l + (t - l) * uSaturation;
        t = (t - 0.5) * uContrast + 0.5 + (uContrast - 1.0) * 0.0;
        // vignette
        float vig = 1.0 - uVignette * smoothstep(0.15, 0.95, r2 * 2.2);
        t *= vig;
        t = clamp(t, 0.0, 1.0);
        vec3 o = toSRGB(t);
        // grain (luma dependent) + dither
        float gr = n_hash13(vec3(gl_FragCoord.xy, uFrame)) - 0.5;
        float gr2 = n_hash13(vec3(gl_FragCoord.xy * 0.5 + 17.0, uFrame + 3.0)) - 0.5;
        float gl = (gr * 0.6 + gr2 * 0.4);
        o += gl * uGrain * (1.0 - o * 0.7);
        o += (n_hash13(vec3(gl_FragCoord.xy, uFrame + 11.0)) - 0.5) / 255.0;
        gl_FragColor = vec4(o, 1.0);
      }
    `, {
      tColor: { value: null }, tBloom: { value: null }, tLocal: { value: null }, uClarity: { value: 0 }, uSharpen: { value: 0 }, uBloom: { value: 0.05 }, uExposure: { value: 1 },
      uSaturation: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0.3 }, uGrain: { value: 0.03 }, uChromAb: { value: 0.002 },
      uFrame: { value: 0 }, uTonemap: { value: 1 }, uHiWarm: { value: 0 }, uPunch: { value: 1 }, uWB: { value: new THREE.Vector3(1, 1, 1) },
      uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uRes: { value: new THREE.Vector2() },
      uSunUV: { value: new THREE.Vector2(-1, -1) }, uFlare: { value: 0 }, uFlareTint: { value: new THREE.Vector3(1, 1, 1) },
    });

    this.copyMat = mat(/* glsl */ `
      varying vec2 vUv; uniform sampler2D tIn;
      void main(){ gl_FragColor = texture2D(tIn, vUv); }
    `, { tIn: { value: null } });
  }

  dispose() {
    for(const value of Object.values(this)) {
      if(value?.isWebGLRenderTarget || value?.isMaterial) value.dispose();
    }
    this.bloomMips?.forEach(t=>t.dispose());this.quad.dispose();
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    const dispose = (t) => t && t.dispose();
    [this.sceneRT, this.aoRT, this.aoRT2, this.accRT, this.workA, this.workB, this.godA, this.godB, this.outRT, this.volRT, this.localMip].forEach(dispose);
    (this.bloomMips || []).forEach(dispose);
    const depthTex = new THREE.DepthTexture(w, h, THREE.FloatType);
    depthTex.format = THREE.DepthFormat;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: this.msaa, depthBuffer: true, depthTexture: depthTex,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    this.aoRT = rt(hw, hh, { type: THREE.UnsignedByteType });
    this.aoRT2 = rt(hw, hh, { type: THREE.UnsignedByteType });
    this.accRT = rt(w, h);
    this.workA = this.realtime ? null : rt(w, h);
    this.workB = this.realtime ? null : rt(w, h);
    this.godA = this.realtime ? null : rt(hw, hh);
    this.volRT = this.realtime ? null : rt(hw, hh);
    this.godB = this.realtime ? null : rt(hw, hh);
    this.bloomMips = [];
    let bw = w, bh = h;
    for (let i = 0; i < 7; i++) {
      bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2));
      this.bloomMips.push(rt(bw, bh));
    }
    this.outRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.localMip = this.realtime ? null : rt(this.bloomMips[3].width, this.bloomMips[3].height);
  }

  _pass(material, target, clear = true) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    if (clear) this.r.clear(true, false, false);
    this.quad.render(this.r);
  }

  setSun(sun, sunDir, sunColorVec3) { this.sun = sun; this.sunDirRef = sunDir; this.sunColorRef = sunColorVec3; }

  ensureTarget(name, half = false) {
    return this[name] ||= rt(half ? Math.ceil(this.w/2) : this.w, half ? Math.ceil(this.h/2) : this.h);
  }

  beginFrame(P = DEFAULT_POST, spp = 1) {
    this.direct = this.realtime && spp === 1 && P.aoStrength <= .001 && P.vol <= 0;
    if (this.direct) { this.subCount=0; return; }
    this.r.setRenderTarget(this.accRT);
    this.r.setClearColor(0x000000, 0);
    this.r.clear(true, true, false);
    this.subCount = 0;
  }

  // Render one sub-frame and add it (weighted) into the accumulation buffer.
  subframe(scene, camera, weight, P, frameIndex = 0) {
    const r = this.r;
    const prevAuto = r.autoClear;
    r.autoClear = true;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(scene, camera);
    r.autoClear = false;
    if(this.direct) { this.subCount++; r.autoClear=prevAuto; return; }
    const useAO = P.aoStrength > 0.001;
    if (useAO) {
      const u = this.aoMat.uniforms;
      u.tDepth.value = this.sceneRT.depthTexture;
      u.uRes.value.set(this.aoRT.width, this.aoRT.height);
      u.uRadius.value = P.aoRadius;
      u.uIntensity.value = P.aoIntensity;
      u.uFrame.value = this.subCount;
      u.uProj.value.copy(camera.projectionMatrix);
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
      this._pass(this.aoMat, this.aoRT);
      const b = this.aoBlurMat.uniforms;
      b.tDepth.value = this.sceneRT.depthTexture;
      b.uRes.value.set(this.aoRT.width, this.aoRT.height);
      b.uProjInv.value.copy(camera.projectionMatrixInverse);
      b.cameraNear.value = camera.near; b.cameraFar.value = camera.far;
      b.tAO.value = this.aoRT.texture; b.uDir.value.set(1, 0); this._pass(this.aoBlurMat, this.aoRT2);
      b.tAO.value = this.aoRT2.texture; b.uDir.value.set(0, 1); this._pass(this.aoBlurMat, this.aoRT);
    }
    const useVol = P.vol > 0 && this.sun && this.sun.shadow.map && this.sun.shadow.map.depthTexture;
    if (useVol) {
      this.ensureTarget('volRT',true);
      const v = this.volMat.uniforms;
      v.tDepth.value = this.sceneRT.depthTexture;
      v.tShadow.value = this.sun.shadow.map.depthTexture;
      v.uShadowMatrix.value.copy(this.sun.shadow.matrix);
      v.uCamWorld.value.copy(camera.matrixWorld);
      v.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      v.uSunDir.value.copy(this.sunDirRef);
      v.uFrame.value = this.subCount;
      v.uMaxDist.value = P.volMaxDist; v.uDensity.value = P.volDensity; v.uHeightFall.value = P.volHeight; v.uNoiseAmt.value = P.volNoise;
      v.uTime.value = this.time || 0;
      if (P.volBox) { v.uBoxMin.value.fromArray(P.volBox.min); v.uBoxMax.value.fromArray(P.volBox.max); v.uBoxDensity.value = P.volBox.density; }
      else { v.uBoxMin.value.set(1e5, 1e5, 1e5); v.uBoxMax.value.set(-1e5, -1e5, -1e5); v.uBoxDensity.value = 0; }
      v.uProjInv.value.copy(camera.projectionMatrixInverse); v.cameraNear.value = camera.near; v.cameraFar.value = camera.far;
      this._pass(this.volMat, this.volRT);
    }
    const a = this.accMat.uniforms;
    a.uUseVol.value = useVol ? 1 : 0;
    a.tVol.value = this.volRT?.texture || this.sceneRT.texture;
    a.uVolTexel.value.set(1 / (this.volRT?.width || 1), 1 / (this.volRT?.height || 1));
    if (useVol) a.uVolColor.value.copy(this.sunColorRef).multiplyScalar(P.vol);
    a.tColor.value = this.sceneRT.texture;
    a.tAO.value = this.aoRT.texture;
    a.uUseAO.value = useAO ? 1 : 0;
    a.uAOStrength.value = P.aoStrength;
    a.uWeight.value = weight;
    this._pass(this.accMat, this.accRT, false);
    this.subCount++;
    r.autoClear = prevAuto;
  }

  // Finish the frame: god rays, DOF, bloom, grade. target=null -> canvas
  endFrame(camera, P, sunWorldDir, target = null, frameIndex = 0) {
    const r = this.r;
    r.autoClear = false;
    let src = this.direct ? this.sceneRT : this.accRT;

    // ---- god rays ----
    if (P.godrays > 0.0) {
      this.ensureTarget('godA',true); this.ensureTarget('godB',true); this.ensureTarget('workA');
      const sp = camera.position.clone().addScaledVector(sunWorldDir, 1000).project(camera);
      const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
      if (camDir.dot(sunWorldDir) > 0.05) {
        const sun = new THREE.Vector2(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
        const m = this.godMaskMat.uniforms;
        m.tColor.value = src.texture; m.tDepth.value = this.sceneRT.depthTexture; m.uSun.value.copy(sun);
        m.uAspect.value = this.w / this.h; m.uThreshold.value = P.godraysThreshold;
        this._pass(this.godMaskMat, this.godA);
        const g = this.godBlurMat.uniforms;
        g.uSun.value.copy(sun); g.uDecay.value = P.godraysDecay; g.uFrame.value = 0;
        g.tIn.value = this.godA.texture; g.uStep.value = 0.012; this._pass(this.godBlurMat, this.godB);
        g.tIn.value = this.godB.texture; g.uStep.value = 0.03; this._pass(this.godBlurMat, this.godA);
        g.tIn.value = this.godA.texture; g.uStep.value = 0.07; this._pass(this.godBlurMat, this.godB);
        const ad = this.addMat.uniforms;
        ad.tA.value = src.texture; ad.tB.value = this.godB.texture; ad.uTintB.value.set(P.godrays, P.godrays * 0.92, P.godrays * 0.8);
        this._pass(this.addMat, this.workA);
        src = this.workA;
      }
    }

    // ---- DOF ----
    if (P.dof) {
      this.ensureTarget('workA'); this.ensureTarget('workB');
      const c = this.cocMat.uniforms;
      c.tColor.value = src.texture; c.tDepth.value = this.sceneRT.depthTexture;
      c.uFocus.value = P.focusDist; c.uFocal.value = P.focalLength; c.uFstop.value = P.fstop;
      c.uWidth.value = this.w; c.uMaxCoc.value = P.maxCoc * (this.w / 1920);
      c.uProjInv.value.copy(camera.projectionMatrixInverse); c.cameraNear.value = camera.near; c.cameraFar.value = camera.far;
      const dst = src === this.workA ? this.workB : this.workA;
      this._pass(this.cocMat, dst);
      const d = this.dofMat.uniforms;
      d.tCoc.value = dst.texture; d.uRes.value.set(this.w, this.h); d.uMaxCoc.value = P.maxCoc * (this.w / 1920);
      d.uRadScale.value = this.dofQuality >= 1 ? 0.55 : 1.2;
      const dst2 = dst === this.workA ? this.workB : this.workA;
      this._pass(this.dofMat, dst2);
      src = dst2;
    }

    // ---- bloom ----
    const mips = this.bloomMips;
    const plan = this.realtime ? postPlan(P.bloom,P.clarity) : {down:7,up:true,local:true};
    let inTex = src.texture, inW = this.w, inH = this.h;
    for (let i = 0; i < plan.down; i++) {
      const u = this.downMat.uniforms;
      u.tIn.value = inTex; u.uTexel.value.set(1 / inW, 1 / inH); u.uKaris.value = i === 0 ? 1 : 0;
      this._pass(this.downMat, mips[i]);
      inTex = mips[i].texture; inW = mips[i].width; inH = mips[i].height;
    }
    if(plan.local) {
      this.localMip ||= rt(mips[3].width,mips[3].height);
      this.copyMat.uniforms.tIn.value = mips[3].texture;
      this._pass(this.copyMat, this.localMip);
    }
    for (let i = plan.up ? mips.length - 1 : 0; i > 0; i--) {
      const u = this.upMat.uniforms;
      u.tIn.value = mips[i].texture; u.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height); u.uRadius.value = P.bloomRadius;
      this._pass(this.upMat, mips[i - 1], false);
    }

    // ---- final ----
    const f = this.finalMat.uniforms;
    f.tColor.value = src.texture; f.tBloom.value = mips[0].texture;
    f.tLocal.value = this.localMip?.texture || src.texture; f.uClarity.value = P.clarity; f.uSharpen.value = P.sharpen;
    f.uBloom.value = P.bloom; f.uExposure.value = P.exposure;
    f.uSaturation.value = P.saturation; f.uContrast.value = P.contrast; f.uVignette.value = P.vignette;
    f.uGrain.value = P.grain; f.uChromAb.value = P.chromAb; f.uFrame.value = frameIndex % 1000;
    f.uTonemap.value = P.tonemap; f.uHiWarm.value = P.highlightWarmth; f.uPunch.value = P.punch;
    const wb = whiteBalance(P.temperature, P.tint);
    f.uWB.value.set(wb[0], wb[1], wb[2]);
    f.uLift.value.fromArray(P.lift); f.uGamma.value.fromArray(P.gamma); f.uGain.value.fromArray(P.gain);
    f.uRes.value.set(this.w, this.h);
    f.uFlare.value = P.flare || 0;
    {
      const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
      if (camDir.dot(sunWorldDir) > 0.05) {
        const sp = camera.position.clone().addScaledVector(sunWorldDir, 1000).project(camera);
        f.uSunUV.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
      } else { f.uSunUV.value.set(-5, -5); f.uFlare.value = 0; }
    }
    this._pass(this.finalMat, target);
    r.autoClear = true;
  }
}

// simple temperature/tint white balance multipliers (temperature: -1 cool .. +1 warm)
function whiteBalance(t, tint) {
  return [1 + 0.12 * t + 0.02 * tint, 1 - 0.06 * tint, 1 - 0.14 * t + 0.02 * tint];
}
