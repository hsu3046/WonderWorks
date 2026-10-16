import * as THREE from 'three';
import { ENV, G, sunDir } from './env.js';
import { SKY_UNIFORMS } from './sky.js';

// ---------------------------------------------------------------------------
// Sun (directional, shadowed), and image based ambient light captured from the
// procedural sky (and optionally the built scene) through PMREM.
// ---------------------------------------------------------------------------

export function createSun(scene, { mapSize = 4096 } = {}) {
  const sun = new THREE.DirectionalLight(ENV.sunColor.clone(), ENV.sunIntensity);
  sun.name = 'sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 1.0;
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 900;
  scene.add(sun);
  scene.add(sun.target);
  sun.userData.baseDir = sunDir.clone();
  fitSunShadow(sun, new THREE.Vector3(0, 0, 0), 90);
  return sun;
}

// Fit the shadow frustum around a sphere (center, radius). Called per shot so the
// 4k shadow map is spent where the camera looks. `jitter` (vec2, radians) offsets
// the sun direction inside the solar disc for soft penumbrae across sub-frames.
export function fitSunShadow(sun, center, radius, jitter = null) {
  const d = sunDir.clone();
  if (jitter) {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(d, up).normalize();
    const up2 = new THREE.Vector3().crossVectors(right, d).normalize();
    d.addScaledVector(right, jitter.x).addScaledVector(up2, jitter.y).normalize();
  }
  sun.position.copy(center).addScaledVector(d, 400);
  sun.target.position.copy(center);
  sun.target.updateMatrixWorld();
  const cam = sun.shadow.camera;
  cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
  cam.near = 400 - radius * 1.6; cam.far = 400 + radius * 1.6;
  if (cam.near < 1) cam.near = 1;
  cam.updateProjectionMatrix();
  sun.shadow.needsUpdate = true;
}

// Render a cube map at `position` of everything in `scene` (or just the sky) and
// convert it into a PMREM environment texture.
export function captureEnvironment(renderer, scene, position, { size = 256, near = 0.5, far = 5000, hideSunDisc = true, layers = null } = {}) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(near, far, rt);
  cubeCam.position.copy(position);
  if (layers) cubeCam.layers.mask = layers;
  const prevDisc = SKY_UNIFORMS.uSunDisc.value;
  if (hideSunDisc) SKY_UNIFORMS.uSunDisc.value = 0.0;
  const prevTarget = renderer.getRenderTarget();
  cubeCam.update(renderer, scene);
  renderer.setRenderTarget(prevTarget);
  SKY_UNIFORMS.uSunDisc.value = prevDisc;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromCubemap(rt.texture);
  const env = envTarget.texture;
  // Preserve ownership: disposing the environment also releases its framebuffer.
  env.addEventListener('dispose', () => envTarget.dispose());
  pmrem.dispose();
  rt.dispose();
  return env;
}

export function captureSkyEnvironment(renderer, sky) {
  const s = new THREE.Scene();
  const clone = sky.clone();
  s.add(clone);
  return captureEnvironment(renderer, s, new THREE.Vector3(0, 2, 0), { size: 256 });
}
