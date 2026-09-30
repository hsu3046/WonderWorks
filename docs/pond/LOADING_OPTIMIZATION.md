# Stillwater progressive loading — 2026-09-30

© 2026 AIB Inc. https://www.aib.vote

## Result

All four recommendations from `LOADING_AUDIT.md` are implemented. No source models
were replaced or deleted and no deployment was performed for this change.

| Same-machine local comparison | Before | After |
| --- | ---: | ---: |
| Usable garden (loading overlay closes) | 39.20 s | 12.69 s |
| Full decorative scene prepared | 39.20 s | 24.09 s |
| Requested response bodies, default Garden | 84.42 MB | 51.51 MB |
| Main-pass triangles, default Garden | 11,380,477 | 5,470,877 |
| Main-pass draw calls | 182 | 182 |

One cold-browser-cache run of each static build on the same Mac and in-app
browser, at 20 Mbps download throughput / 40 ms latency, 1885 × 1060 render buffer.
The local Python server does not HTTP-compress GLBs; these are not production
transfer sizes or mobile benchmarks. Browser shader/OS caches were not cleared.
The baseline records its existing ready class; the candidate waits for its first
completed render submission before removing the overlay. Baseline geometry was
unchanged. Original production audit timings are a different network experiment
and must not be compared directly to this table. No FPS, temperature or battery
improvement is claimed from triangle counts.

## Loading lifecycle

- Backdrop, ground textures (including meadow), bridge and gazebo start together.
- Render the complete base garden/water/architecture and enable controls first.
- Start wildlife, hydrangeas and azaleas as independent detached scene chunks.
  Fish, frog and insects load concurrently; the AIB cornea starts with its body.
- Shared GLTF queue permits four active downloads/decodes. No dependency install.
- Attach each completed chunk, refresh water's above-water classification and
  shadows, and invalidate a paused frame. Random seeds, counts and placements
  remain unchanged. A failed decoration leaves the base garden usable and shows
  an error/reload message; feeding distinguishes loading from failure.
- Wait for every writer before disposing a failed chunk. Late chunks after scene
  disposal release their geometry/materials/textures rather than reattaching.
- `pond:first-frame`, `pond:usable`, `pond:details-start`, and
  `pond:details-settled` performance marks distinguish real readiness from the
  misleading HTML load event. `pondDiagnostics().loading` reports partial state.

## Asset preparation

`projects/pond/scripts/optimize-loading.mjs` uses the existing workspace
meshoptimizer dependency (1.1.1, brought in by Three types) and installed `cwebp`.
Run from the repo with `node projects/pond/scripts/optimize-loading.mjs`.
Original files and attribution remain intact. Derivative sizes and simplifier
errors are recorded in `asset-optimization.json`.

- Lossless EXT_meshopt_compression, decoded with Three's bundled decoder. Every
  compressed buffer is decoded offline and compared byte-for-byte before saving.
  Animal and architecture vertex order, positions, normals, UVs, material names,
  and frog morph target data remain unchanged.
- Existing embedded WebP maps are retained. PNG/JPEG color maps use WebP quality
  92 with full-quality alpha; normal/data maps and AIB eye/pigment conversion use
  lossless WebP when smaller. Standalone nature maps keep 1024px resolution and
  use WebP quality 92. No material or lighting settings were changed.
- Distant hydrangea: 12,096 → 2,800 triangles; azalea: 3,489 → 999. Attribute-aware
  simplification retains UV and normal detail. Original close geometry stays
  exact: 47,395 / 11,379 triangles. Counts remain 520 heads / 432 sprigs.
- Initial flower files contain far geometry and shared original texture atlases.
  Near-only files contain geometry without duplicate textures and are requested
  once on approach. Far flowers remain visible until near geometry is ready.
  Hysteresis is unchanged (hydrangea 4/5 m; azalea 3.5/4.5 m).

## Verification

- All project TypeScript checks; 17 pond tests, including five new concurrency,
  rejection, cancellation and partial-scene cleanup cases.
- Full seven-study production build, source archives, SEO and asset checks pass;
  final pond build also passes. Existing large-JS-chunk warning remains.
- Actual browser loads every derivative without GLTF, WebGL or shader errors.
  Bridge/gazebo bounds and plant/animal counts match the audit.
- Garden screenshots before/after retain composition, colors, models and density.
  Approaching both flower beds loads the exact close meshes and switches instances
  (observed: hydrangea 53 near / azalea 45 near). Pausing stops scheduled frames.
- Blocking the monarch request leaves a working base garden and flowers, reports
  wildlife failure, and avoids a fatal loading overlay. Blocking is removed after
  testing. Unit tests cover late results after navigation.
- Temporary browser throttling/cache settings and local test server are restored
  or stopped after verification. No production traffic was used for this test.
