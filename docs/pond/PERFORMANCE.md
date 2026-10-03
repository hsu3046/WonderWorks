# Stillwater performance and preview capture

Measured locally on 2026-10-03, with the user's selected elevated pond camera, Dream light 85%, all detail assets loaded, and the same 1384 × 1105 rendering size. These short desktop checks are not GPU timings or mobile/thermal guarantees.

## Rendering changes

Water captures use one global clipping plane, while the HDR main pass previously used none. Three.js repeatedly recalculated material program parameters as that count alternated. The HDR main pass now uses a neutral plane far below every scene bound, sharing the one-plane shader variant. Prewarming uses the same configuration and restores renderer state. Direct output at zero Dream light keeps its original clipping configuration.

OrbitControls can synchronously invalidate during a paused camera transition. The frame callback previously reserved another RAF afterward, overwriting the reservation and leaving concurrent callbacks. Frame continuation now uses the existing guarded invalidation path.

No scene resolution, geometry density, bloom quality, simulation rate or appearance was reduced.

| Local check | Before | After |
| --- | --- | --- |
| 120-frame running sample | 32.04 fps | 31.81 fps |
| p95 frame interval | 34 ms | 35.5 ms |
| `getParameters` + `getProgram` sampled CPU time / profile duration | 7.48% | 2.54% |
| Main-thread active sampled time / profile duration | 20.61% | 13.75% |
| Paused Waterline transition | 294 draws in 5.11 s; still traveling | 91 draws by 3.2 s; destination reached |
| Frames during the second after completed transition | concurrent callbacks remain | 0; no pending RAF |

The shader lookup samples fell about 66% relative to elapsed profile time. FPS remained around 32; this does not establish a frame-rate improvement. Profiles were approximately 13.14 s before and 10.76 s after. A deterministic paused frame at scene time zero was pixel-identical before/after (865 × 691 screenshot). Inactive scenes also produced zero additional frames during a one-second check.

## Updated gallery media

The latest optimized scene was recorded directly from the rendered canvas, excluding interface overlays. Camera position `[10.921251241247356, 9.7623455621442, 18.922951658394098]`, target `[-1.3021986554318763, 0.2, -5.7026813035341934]`; fixed camera, Dream light 85%, afternoon 14.5, clarity 0.91, breeze 0.35, activity 1, no rain.

- `pond-dream-light.mp4`: 1536 × 1000, 30 fps, 415 frames / 13.833 s, H.264/yuv420p, CRF 22, fast-start, 19,696,870 bytes. Previous preview: 43,499,164 bytes / 31.816 s. The new clip is 55% smaller overall; the duration is shorter, so this is not an equal-duration compression comparison.
- `pond-dream-light.jpg`: poster extracted at one second from the final video.
- Catalog uses fresh filenames for both media, preventing reuse of the earlier cached preview. Gallery retains its existing single shared video decoder, hover playback and poster restoration.
- Original recording, comparison screenshots and CPU profiles remain ignored under `docs/validation/dream-light/`.

## Review

Open the local Stillwater preview, pause, then choose Waterline: the camera should arrive in approximately 2.6 seconds and settle. Try Dream light at 0% and 85%, then Dive in. In the gallery, hover the Stillwater card to play the new angle and leave to restore its matching poster.

Validation: all project TypeScript checks, 79 existing tests (65 study tests plus 14 crawler tests), full site build, source archives, and static SEO/media checks for 10 studies / 12 canonical pages passed. Existing bundle-size warnings remain. Gallery playback loaded the new 1536 × 1000 movie and returned to its matching poster on pointer leave; console/shader logs were clear. Direct zero-glow and underwater glow rendering were also checked.
