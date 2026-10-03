# Stillwater dream light

© 2026 AIB Inc. (https://www.aib.vote) · GNU GPL v3

The garden now has warm, deliberately exaggerated soft light inspired by Japanese animation. Bright flowers, foliage, lanterns and water highlights spill light into their surroundings while the original scene remains sharp. A camera-facing sun core and feathered aureole follow the existing sun direction; scene depth occludes them, and water can reflect them.

`Tune the garden → Dream light` controls the effect from 0–150%, default 85%. Zero bypasses the effect and hides the new sun source. Rain scales bloom to 48%. Underwater now uses a lower extraction threshold and 105% of the surface bloom strength, with stronger warm scattering; this follows the user’s request for less clinical fish clarity. Daylight contributes to the overall strength, leaving a gentler glow at dusk. This is an artistic bloom effect, not volumetric scattering or a change to the physical illumination model.

## Rendering contract

- `src/dream-light.ts` wraps the existing water renderer in a full-resolution, linear half-float main target with two MSAA samples. Reflection and refraction retain their existing resolution and linear color pipeline. There is no extra scene capture or animation loop.
- Bright extraction, two downsample blurs and two upsample blurs operate on three sizes of light buffer. Final tuning reduces blur offsets from 1.5 to 1.05 pixels (30%) and increases fine-detail reconstruction from 28% to 42%. The largest is 35% of the scene dimensions, capped at 640 pixels on its longest axis. Two additional reconstruction buffers avoid read/write feedback.
- The final fullscreen pass adds a yellow-warm halo to the scene texture (with a small water-column diffusion only when submerged), then applies the existing ACES tone mapping and sRGB output conversion exactly once. The sun shader follows the same intermediate/final output contract.
- Half-float capability and framebuffer completeness are checked. An unsupported or incomplete light target bypasses the effect, hides the sun source and displays an original-lighting notice. All render targets and materials are released on disposal; renderer target and tone-mapping state are restored after rendering and asynchronous shader preparation.
- Delayed asset preparation compiles the clipped water, unclipped HDR main and direct-output variants before attachment. Water records the actual main-scene draw/triangle counts before the fullscreen passes replace renderer statistics.
- Resize follows the existing scene pixel budget; pause, hidden-page handling and saved photographs use the same scene/render lifecycle.

## Verification — 2026-10-03

Strict TypeScript and production build passed; the existing 20 pond tests passed. Browser checks covered Sunlit, Dusk, Soft rain, Garden, Waterline and Dive in; console/shader logs were clear. A portrait viewport resized the canvas/light targets to 390×844 / 137×296, 69×148, 35×74, then the viewport override was reset.

The same paused pose at simulation time 27.1041 and wave step 785 was captured at 0% and 85%; changing the effect did not advance the simulation. The two screenshots show retained architecture/fish detail and softer light around blossoms, lanterns and reflected highlights.

Before the user’s subsequent contrast/warmth/underwater refinement, at a settled Waterline view, 1384×1105 canvas on this Mac, a short 90-frame sample measured 38.15fps / p95 33.4ms with the effect and 38.85fps / p95 33.4ms at zero. These are sequential local samples, not a sustained thermal or mobile-device benchmark. Initial loading and camera transition were excluded from this comparison. The effect adds six fullscreen draws and HDR/MSAA memory, with extra texture taps for water diffusion; no general performance improvement is claimed.

## User refinement — 2026-10-03

The user requested stronger underwater light/reflections, slightly less overall blur, higher light contrast and a little more yellow warmth. Surface extraction threshold is now 0.80 (previously 0.65), underwater 0.52 (previously 0.85). Daylight receives a small directional-light increase and ambient reduction proportional to Dream light; sun color and halo shift toward yellow. At the default 85%, the underwater bloom multiplier is 1.05 versus the original 0.35.

Water receives a bounded artistic reflection lift above its physical Fresnel value (the total internal reflection limit remains 1), stronger sun glints, depth-dependent diffusion of refraction samples and 42.5% stronger wave-derived caustics at the default setting. Submerged views also receive warm depth fog and a modest four-tap scattering blend; this deliberately gives up pristine fish sharpness. Zero Dream light restores the original lighting/optics values. No simulation, fish geometry, plant layout or scene-resolution changes were made.

Final refined Garden, Waterline and Dive in views were checked in a fresh browser preview; console/shader logs were clear. Final strict production build and the 20 existing pond tests passed.

Local proof captures are ignored under `docs/validation/dream-light/`. No dependency was installed.

## Review

Open the local pond preview on port 4179. Compare Dream light at 0%, 85% and 150%; try Dusk and Soft rain, then Waterline and Dive in. Pause the garden and change only Dream light to compare the same pose. Save a moment to confirm that the photograph includes the glow.
