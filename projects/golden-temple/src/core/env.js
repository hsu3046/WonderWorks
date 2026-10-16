import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Global environment: the single source of truth for the golden-hour setup.
// Coordinates: metres, +Y up, +X east, +Z south (so north is -Z).
// ---------------------------------------------------------------------------

const deg = Math.PI / 180;

// Sun: low golden-hour sun in the west-south-west.
export const SUN_ELEVATION = 6.8 * deg;
export const SUN_AZ_DIR = new THREE.Vector2(-0.94, 0.34).normalize(); // horizontal (x,z) direction TOWARD the sun

export const sunDir = new THREE.Vector3(
  SUN_AZ_DIR.x * Math.cos(SUN_ELEVATION),
  Math.sin(SUN_ELEVATION),
  SUN_AZ_DIR.y * Math.cos(SUN_ELEVATION)
).normalize();

export const ENV = {
  sunDir,
  // colour of direct sunlight at the ground (linear). ~3300K, slightly rosy
  sunColor: new THREE.Color().setRGB(1.0, 0.70, 0.43),
  sunIntensity: 7.0,
  // overall sky radiance scale used by the sky shader
  skySunIntensity: 20.0,
  envIntensity: 1.0,
  exposure: 1.0,
  // fog / aerial perspective
  fogDensity: 1.0, // runtime multiplier (scene.fog.density)
};

// Global uniforms shared BY REFERENCE across every custom shader / patched material.
export const G = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
  uWindStrength: { value: 1.0 },
  uSunDir: { value: sunDir.clone() },
  uSunColor: { value: new THREE.Vector3(ENV.sunColor.r, ENV.sunColor.g, ENV.sunColor.b).multiplyScalar(ENV.sunIntensity) },
  uFrame: { value: 0 },
  uShot: { value: -1 }, // current film shot index (-1 = free camera)
};

// Shared wind GLSL. Requires uniforms uTime, uWindDir, uWindStrength (added by patch()).
// windOffset(worldPos, flex) returns a world-space displacement. flex ~0 at trunk, 1 at leaf tips.
export const WIND_GLSL = /* glsl */ `
vec3 windOffset(vec3 wp, float flex){
  float t = uTime;
  vec2 wd = uWindDir;
  float gust = 0.55 + 0.45 * sin(t * 0.37 + dot(wp.xz, wd) * 0.05) * sin(t * 0.23 + wp.x * 0.02);
  float sway = sin(t * 1.3 + dot(wp.xz, vec2(0.13, 0.11))) * 0.6 + sin(t * 2.1 + wp.y * 0.4 + wp.x * 0.3) * 0.3;
  float flutter = sin(t * 7.0 + dot(wp, vec3(2.1, 1.7, 2.9))) * 0.25 + sin(t * 11.0 + dot(wp, vec3(3.7, 2.3, 1.9))) * 0.12;
  vec3 o;
  o.xz = wd * (sway * 0.06 + gust * 0.05) * flex;
  o.y = flutter * 0.02 * flex;
  o.xz += vec2(flutter * 0.015, -flutter * 0.012) * flex;
  return o * uWindStrength;
}
`;
