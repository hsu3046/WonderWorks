# Rendering performance — 2026-09-30

This pass audits all seven studies (including both Fruit Jelly variants) and the gallery. It removes redundant work while retaining model detail, particle populations, texture sizes, render resolution, lighting, reflection quality and simulation substeps.

## Changes and evidence

| Study | Change | Verified result |
| --- | --- | --- |
| Fruit Jelly — citrus and watermelon | Allocation-free tetrahedron volume calculation; bounded edge lengths use a direct square root instead of `Math.hypot` rescaling. Both variants share this solver. | Citrus reference workload: 480 physics steps, 1,008 tetrahedra, median **233.02 → 166.63 ms (28.5% less CPU time)**. Over 600 steps including grab/release, maximum position difference **6.06e-14**, velocity difference **2.56e-13**. Watermelon cutting still creates two stable pieces with no inverted elements. |
| Through the Seasons | Cache seed-derived leaf schedules at double precision; evaluate blossom once per count; reuse lighting colors; share grass density/shape evaluation across position and normals. Skip the hero leaf mesh and its shadows when every leaf has exactly zero growth. | 100 counts of 26,000 leaves: median **69.20 → 15.25 ms (78.0% less CPU time)**. Counts match 1,515 combinations of species, date and elapsed fall time. Clear winter (`year=.06`) main-camera triangles **1,021,312 → 85,312 (91.6% fewer)**; calls **8 → 6**. Same paused frame is pixel-identical with collapsed leaves enabled/disabled. |
| Stillwater | Update scene world matrices once before refraction, reflection and final rendering; keep all three passes and their original resolutions. | Whole-scene matrix traversal **3 → 1** above water (**2 → 1** underwater). All 219 scene nodes still receive their updates. Same paused 1280×720 frame is pixel-identical when automatic per-pass updates are re-enabled. One traversal measured approximately 0.018 ms locally: this is a small CPU saving, not removal of the expensive water passes. |
| Ocean Shoal | Use squared distances for 32-neighbor comparisons; return immediately from inactive pointer/shock forces. Keep separate velocity/integration dispatches. | Removes **196,608 explicit neighbor square-root expressions per step**. Actual WebGPU run: **6,144/6,144 fish finite**, normal speed/depth bounds and pointer/ripple response; no shader errors. Squared arithmetic can introduce tiny floating-point differences in long evolving trajectories. |
| Tidelight Harbor | Update world matrices once before the main and reflection passes; cache helm DOM references and write only changed values; avoid per-key temporary arrays. | Boat controls and reflections work. Over **1,341 frames**, helm changes caused **38 DOM mutations**, versus the previous unconditional **5,364 writes**. Weather, wildlife and rowing remain animated. |
| Chroma Motion | Update morph palette uniforms only when the palette changes; notify the displayed mode only when it changes. | Removes **27 repeated color assignments per frame** in Original mix. Full 25-second sequence, palette switch and mode transitions verified; no changes to morph math, mesh density or timing. |
| Bubble Day | One RAF owner for menu pause, document visibility and gallery activation; reset the time origin on resume; reuse the near-shadow direction vector. Probe visibility uses the current bubble list while preserving the POV film's reflection needs. | Menu pause: **0 new frame requests, 0 simulated frames**. Controlled `document.hidden` signal: same result; visibility restoration resumes. The existing probe already skipped most idle work; the change prevents a stale prior instance count from keeping it active. |
| Gallery | Reviewed hero lifecycle, shared video preview and copied standalone adapters. Adapted Bubble Day's preview to its single RAF owner. | Initial page has **1 canvas, 0 embedded experiment iframes, 0 mounted videos**. Existing shared-decoder preview and offscreen hero suspension are retained. No new simultaneous artwork renderers. |

## Measurement conditions

- Apple M1 Pro, macOS, Node v25.8.2; browser checks in the Codex in-app Chromium browser, 1280×720.
- CPU benchmarks use nine alternating before/after samples after warming both paths; final recorded run was taken after closing temporary browser tests and completing builds.
- Earlier sampling during concurrent graphics activity was noisy (including a reversed median). These are repeatable isolated workload measurements, **not end-to-end FPS improvements** or device-independent speed promises.
- Triangle counts above cover the main-camera render reported by Three.js; shadow work is additional. Avoid presenting these as complete GPU timings.
- Grass shader savings describe source-level repeated evaluations; a GPU compiler may already eliminate some duplicate expressions.
- No mobile GPU timing, sustained thermal or battery measurements were performed. High-resolution water/reflection and postprocessing remain material costs; reducing them would require a separate visual quality decision.

## Validation

- Strict TypeScript checks for all six builds and **80 automated tests** passed (9 pond tests; 71 physics, input, season, navigation, wildlife and motion tests).
- Full site build, regenerated experiment copies/source ZIPs, and static SEO/asset checks passed (7 studies, 9 canonical pages).
- Browser checks covered every study: fish force interaction, summer/winter tree rendering, harbor helm, full morph sequence/palette change, bubble pause/resume, citrus nudge and watermelon cut. No application/shader errors observed.
- Local evidence is stored in ignored `docs/validation/performance/`: benchmark JSON and PNG comparisons. Pond and winter before/after RGB pixel differences are zero.
- Changes are local; this optimization pass has not been pushed or deployed.

## Reproduce the CPU comparison

Preserve a reference solver before changing it, or extract a known baseline revision:

```sh
git show b423558:projects/jelly/citrus/physics.js > /tmp/wonderworks-baseline-physics.js
node scripts/benchmark-performance.mjs /tmp/wonderworks-baseline-physics.js
npm run check
node --test projects/jelly/citrus/*.test.mjs projects/jelly/melon/*.test.mjs projects/jelly/jelly-shared/*.test.mjs projects/foliage/tests/*.test.mjs projects/harbor/tests/*.test.mjs projects/chroma/tests/*.test.mjs
npm run build
```

Close other heavy workloads before comparing runs. The benchmark checks motion agreement as well as elapsed CPU time. The volume regression test separately checks the scalar formula against the original triple product.

## Maintenance constraints

- Pond/harbor scene roots stay at the identity transform. Update animated objects, then call `scene.updateMatrixWorld()` before any render pass; do not move this update ahead of animation or re-enable per-pass traversal accidentally.
- Winter culling only applies when growth is exactly zero (`year <= .20` or `year >= 1`), including cherry blossom. Autumn ground leaves and every partially growing spring leaf remain rendered.
- Keep Bubble Day's manual capture path separate from its RAF loop. Gallery activation must use `app.setActive`, not introduce a second scheduler. Preserve POV-film probe updates even when no external bubbles remain.
- Do not lower physics iterations, remove shadow/reflection passes or reduce asset populations as an unmeasured follow-up optimization.

© 2026 AIB Inc. · https://www.aib.vote
