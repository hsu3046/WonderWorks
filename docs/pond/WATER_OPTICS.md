# Stillwater water optics — 2026-09-30

The pond combines analytic waves, a small GPU ripple simulation, depth-based absorption and projected caustics. Existing fish assets, colors, sizes, independent swimming, plants and 520 hydrangea heads remain intact.

## Shared water field

`src/water-field.ts` owns three low-steepness Gerstner waves and three derivative-aware FBM octaves. A 128×96 half-float ping-pong field adds interactive displacement and normals. Surface geometry, optical distortion and caustics sample the same field. Shoreline taper includes its derivative, avoiding a normal discontinuity.

The GPU wave equation stores current/previous height in RG. Grid spacing is 0.15625 world units; the 1/60 second fixed step uses a stable Laplacian coefficient 0.03640889 (wave speed 1.6). At most four steps are processed per frame. Velocity damping, mild height damping and extra shore damping remove residual energy. The elliptical shoreline and two large rock proxies block propagation. Up to 32 queued impulses from existing water taps, rain and frogs enter once, then propagate. An inactive field stops after 20 seconds. This is a height field, not fluid volume simulation.

The scene owns scheduling; no new RAF loop. Paused `dt=0` preserves the solver. Existing page-visibility handling stops scene work. Targets/materials are disposed with the scene. Renderer target/tone mapping are restored even on failure.

## Reflection, refraction and color

`src/water.ts` retains planar reflection at 60% viewport resolution and full-resolution refraction, adding a depth texture to reconstruct underwater receiver positions. Schlick uses water F0=0.0204. Underwater views account for the water-to-air critical angle and total internal reflection.

Beer–Lambert transmittance is `exp(-absorption * pathLength)`, with different RGB absorption and a clarity-dependent term. Path length now comes from reconstructed depth, so shallow shoreline water and deeper water differ without washing every fish with the same color. Refraction rejects foreground/above-water samples. Offscreen renders stay linear; tone mapping/output conversion happen at final presentation.

This is screen-space refraction: it cannot recover geometry hidden from the capture camera or outside the capture. Gerstner horizontal displacement is small; normals use height derivatives without a full horizontal-displacement Jacobian.

## Caustics

A shared 256×192 half-float map stores focusing intensity and refracted horizontal ray slope. Refracted sunlight footprints and their finite-difference Jacobian estimate focusing over the sloped bed. Receiver shaders trace backward toward the water, refine the projected coordinate with the local refracted slope, and apply depth/daylight attenuation. Floor, stones and fish share this field; eyes are excluded from fish caustic emission.

This replaces the independent decorative noise pattern. It is an approximation, with a bounded artistic focusing gain of six, not spectral ray tracing/global illumination. Large-scale bed shape is approximated and fine occlusion does not cast additional caustic shadows.

## Fish and rendering work

GPU body/tail deformation remains. `fish-school.ts` adds weak boids alignment and cohesion to existing separation and independent destinations. Only fish within 2.4 units, within 0.45 depth, and outside a rear blind sector contribute. Steering magnitude is capped by its weights at 0.18, with reduced influence while feeding. A reusable pose snapshot removes update-order bias.

Above-water planting is excluded from the refraction pass using conservative bounds or explicit hydrangea metadata, while retaining the first pass's shadow casters. In the initial 1280×720 Garden view, 23 dry batches were skipped; counters were reflection 225 (including shadows), refraction 157 and main 181. These are pass draw counts, not measured FPS/GPU-time improvements. The new simulation adds two 128×96 targets, one 256×192 target, a depth texture and fullscreen work. Dense flowers still dominate scene geometry.

## Verification

- `npm run build --prefix projects/pond`: strict TypeScript and production bundle pass; existing large-chunk warning remains.
- `node --test projects/pond/tests/*.test.ts`: 12 tests pass, including independent movement/depth bounds and new local schooling tests.
- With pond Vite running, open `/tests/water-field.browser.html` for an actual WebGL half-float readback test. No dependencies added. It is a development test page, not a production build entry.
- Two splats: after 60 steps peak height 0.0109100, energy 0.00921339. Twenty zero-dt updates preserve state/step count. After 900 further steps peak 0.000025034, energy 1.7951e-7; all finite, PASS.
- Browser Garden/Waterline/Dive views render without console errors. Rain and dusk controls work. Pause keeps scene time 161.7176 and GPU step count 7916 unchanged across separate observations; resume works.
- Local evidence: `docs/validation/water-optics/` (ignored screenshots/readback results).

To inspect visually: switch between Garden, Waterline and Dive in; tap open water; select Soft rain; pause/resume; compare Sunlit/Dusk. Fish should remain independently swimming and retain their original pigments.

## References

- [GPU Gems: Effective Water Simulation](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)
- [GPU Gems: Rendering Water Caustics](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics)
- [PBRT: Transmittance](https://pbr-book.org/4ed/Volume_Scattering/Transmittance)
- [Craig Reynolds: Boids](https://www.red3d.com/cwr/boids/)

Implementation © 2026 AIB Inc. — GNU GPL v3. Source asset attribution remains unchanged.

## Ripple tuning — 2026-09-30

Direct taps use strength 3 and radius 0.60 (previously 1 and 0.22); other GPU impulse callers retain their original settings. Input strength/radius are bounded, and the solver height remains bounded at ±0.10. The stronger tap was checked in the actual scene; the separate GPU readback recheck stalled before returning results, so no new numerical decay result is claimed.

Water striders use separate tiny capillary highlight meshes, not GPU field impulses. Their previous bright double rings followed an obsolete wave formula. They now follow the shared water height, use one softly fading ring, peak alpha 0.075 instead of 0.36, and lifetime 0.95 instead of 1.45 seconds; growth is smaller. Contact dimples use alpha 0.08 instead of 0.23. Animal bodies and movement remain unchanged.
