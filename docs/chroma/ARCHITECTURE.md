# Chroma Motion architecture

`projects/chroma/src/state.ts`: typed settings, palette/movement catalogue, finite numeric URL parsing and bounds.

`scene.ts`: shared immutable geometries, reusable mesh/material pool, procedural vertex/fragment shading, object transforms, one owned RAF loop and invalidation, resize pixel cap, context-loss message, pointer orbit.

`main.ts`: controls, explicit user pause, deterministic mode resets, random variations, PNG capture, portable URL settings, preview bridge and read-only diagnostics.

`style.css`: responsive studio shell, mobile stacked controls and focus mode. Static builds use relative paths and are copied into gallery/public/experiments/chroma. Gallery cards retain one shared video decoder and reset on leave.

## Aligned sections (2026-09-29)

`geometry.ts` owns the shared geometry pool and deterministic column profiles. Columns use circular XZ sections tilted about X, extruded along a common vertical axis. Their diameter equals their spacing; per-object rigid X/Z rotations and center offsets are removed. A bounded shear in the vertex shader keeps the cap planar, the section circular, and adjacent tangent planes aligned throughout the supported control range. Joined sides use symmetric fill and no rim boost to avoid bright seams in the shared world-space gradient.

Disc lids are constructed in the same XZ plane as sleeve sections. The sleeve and both lids use a single tilt convention. The old Y-dependent radial twist is removed from round geometry: it warped XY lids and misaligned their boundary with the sleeve. Ribbon deformation and the other movement presets retain their original behavior.

`tests/geometry.test.mjs` checks tangent continuity across time/count/amplitude/twist, non-inverted sections, and actual lid/sleeve boundary vertices after scale and rotation. No additional renderer, render target, dependency, or per-frame geometry allocation is introduced.

## Continuous twisted ribbon (2026-09-29, supersedes the plane-based ribbon)

Reference frames at 1.85–2.85 seconds show connected faces of a twisting rectangular band, not two independently intersecting sheets. `geometry.ts` now creates one segmented closed box (192 longitudinal subdivisions), with one shared rotation and centreline bend for every cross-section. Shared edge vertices receive identical deformation. `ribbonProfile()` eases each half-turn and its torsion pulse with continuous values and velocity at repetition boundaries.

The band is viewed head-on, extends slightly past both horizontal viewport edges, and uses a broad square section. A sinusoidal centreline offset preserves the reference front-face width and eases the outer silhouette at the edges. Face-specific warm pink/cream, violet and blue/green gradients change with roll. Other palettes still derive their ribbon colors from their selected colors. Independent ribbons now default to one continuous volume; the multiplicity control creates parallel copies with shared deformation. The Original mix still keeps its existing five-second scene slots.

Regression checks include closed surface edge incidence after positional welding and continuity across half-turn boundaries. Validation: `docs/validation/new-effect/ribbon/RESULTS.md`.

## Wave field: three anchored bars (2026-09-29)

User requested exactly three bars, with their lengths forming a travelling wave. Replaced the staggered depth grid and extra camera pitch with one horizontal row. `waveProfile()` holds all bases at Y=-2.2 and drives height with a sine wave delayed by 120 degrees per bar. Tempo and Elasticity control speed and height excursion. Wave count is fixed at three in URL parsing, rendering, Reset and Surprise me; the multiplicity slider explains and reflects the fixed count. Other modes keep their own arrangements.

Verification: 11 tests pass, including old count-bearing URLs, fixed bases and phase delay. Strict build passed; GPU browser shows three bars, no captured errors, and Surprise me keeps count=3 with its slider disabled. Screenshot: `docs/validation/new-effect/wave/three-bars.png`. The gallery card video uses Original mix and does not include Wave field, so it does not need re-recording for this change.

## Wider Orbit (2026-09-29)

User requested a more spread-out circular orbit. Default centre radius increased from 1.63 to 2.15 (about 32%); removed the Y-axis 0.82 compression. Radius is capped at 2.25 to leave space for the discs at default zoom. Disc size, rotation speed and individual tumbling are unchanged. Strict build and actual GPU browser checked; no captured console errors. Evidence: `docs/validation/new-effect/orbit/wider-orbit.png`.

## Taller floating disc opening (2026-09-29)

Increased lid separation coefficient from 0.9 to 2.1 and sleeve height from `0.45 + wave × 1.5` to `0.6 + wave × 1.8`. The tilt, diameter and opening timing are unchanged. Disc-only framing scale is 0.81 to accommodate the taller silhouette. At default settings the 0–5 second sequence fits within the vertical camera range (sampled half-extent about 3.04 versus 3.15 available). User zoom/elasticity can still enlarge the composition.

Strict build passed; actual 15-second GPU sequence recorded without captured console errors, disc frame contact sheet inspected. Gallery build, MP4, poster and source downloads updated. Evidence: `docs/validation/new-effect/disc/taller-opening.png` and `sequence-sheet.jpg`.

## Wave handoff rhythm (2026-09-29, supersedes the continuous sine wave)

The 120-degree sine offsets started with the right bar already tall and never allowed a collective rest, making the direction hard to read. Wave field now repeats one eased pulse: rise 0.46s, settle 0.74s, 0.32s delay per bar, 2.25s cycle. All bars rest together for about 0.41s before the next pass. The same smoothstep envelope drives every bar; bases stay fixed and Tempo scales the whole rhythm. Peaks occur left/centre/right at 0.46/0.78/1.10s at default tempo.

Twelve tests pass, including crest order, rest interval, fixed bases and wrap continuity. Strict production build passed. Actual GPU two-cycle recording inspected, no captured errors. Evidence: `docs/validation/new-effect/wave-rhythm/rhythm.mp4` and `sequence.jpg`. Gallery runtime and source archives synchronized; Original mix preview does not use Wave field.

## Continuous column rotation (2026-09-29, supersedes oscillating section tilt)

User requested uninterrupted one-direction turns while retaining the elastic height motion. The previous sine-based lean necessarily stopped and reversed at its extrema. `columnProfile()` now returns an unwrapped roll angle (`time × 0.9 × twist`); the entire cylinder rotates about X. All columns share the same roll, preserving their tangent axes and exact lateral spacing. Caps remain rigid rather than being sheared through a degenerate cross-section. Height amplitude and staggered phase remain unchanged. Default period is about 6.98 seconds; Pause, Tempo=0 or Twist=0 deliberately stop rotation.

Thirteen tests pass, including monotonic angular progression over 60 seconds and tangent alignment. Strict build and GPU full-turn recording passed with no captured console errors. Updated gallery MP4/poster and source archives. Evidence: `docs/validation/new-effect/column-roll/full-turn.mp4`, `frames.jpg`, `studio.png`.

## Readable motion through the face-on pose (2026-09-29)

The previous unwrapped roll was already constant-speed; the remaining perceived hold occurred when a circular cap faced the camera as the body approached its minimum thickness. Retain linear roll and add continuous local axial spin at half its rate so the cap's material gradient continues rotating through that view. Smoothly raise minimum body depth toward 1.2 near face-on alignment; retain the original maximum height and elastic phase pattern. All columns share both angles.

Fourteen tests pass, including monotonic roll/spin, shared axes and front-facing minimum/maximum depth. Strict build and GPU 7.4-second recording passed without captured console errors. Front-passage frames inspected. Gallery MP4/poster/runtime/source archives updated. Evidence: `docs/validation/new-effect/column-seamless/front-pass.jpg` and `turn.mp4`. This corrects the perceptual hold; it does not remove the intentional scene cuts in Original mix.

## Seamless Wave field (2026-09-29, supersedes the gated pulse)

User confirmed the left-centre-right order but requested a smooth continuous wave instead of separate rise/settle gestures. Removed all pulse gates, rest intervals and reset easing. The three bars sample an analytic cosine with equal 120-degree spacing and a left-first starting crest. At default Tempo, the period is 3 seconds and each crest passes to the next bar after 1 second, including right-to-left across the repetition boundary. The sum of bar heights stays constant as the crest moves. Individual extrema ease naturally without a collective pause. Fixed bases, three-bar count and the height range remain unchanged.

Fourteen tests pass, including peak order, period matching, loop velocity continuity, nonzero combined movement and constant total height. Strict build passed; two real GPU cycles recorded without captured console errors and the frame sheet inspected. Evidence: `docs/validation/new-effect/wave-continuous/motion.mp4`, `frames.jpg`, `studio.png`. Gallery runtime and source archives synchronized. Its Original mix card video does not include Wave field, so no video replacement is needed.

## Geometric Original mix transitions (2026-09-29, replaces rejected crossfade)

The user explicitly rejected cross-dissolves: motion must lead into the next form through actual shape deformation. Removed the image compositor and its render targets. Original mix now keeps three opaque, depth-tested parametric patches alive throughout the 15-second cycle. Columns become three adjoining sections of a twisted ribbon; those sections become the lower lid, open sleeve and upper lid of the disc, then return to columns. Individual modes retain their existing geometry and motion.

Each patch shares angular/axial/radial vertex addresses. The GPU interpolates cross-section shape, length and centre position; quaternion interpolation handles orientation separately to prevent pinched surfaces from direct world-position interpolation. Quaternion hemisphere selection is fixed across a transition to avoid a moving shortest-path sign flip. Internal ribbon caps and sleeve cap fans collapse onto their perimeter; adjoining ribbon edges match. Colours interpolate on the same opaque surface; alpha stays one. A single camera moves continuously with the shape.

The 1.6-second quintic morph envelope retains incoming motion pre-roll and continuous pose at each handoff, including the loop. One renderer performs one scene pass with three shared-geometry meshes; no render targets or second image layer. Existing pause, hidden and resize lifecycle remains in use. This is an authored procedural morph, not an exact reconstruction of the source video's transition choreography.

Validation: 21 tests pass, including mesh identity/opacity, pose continuity, quaternion stability over sampled supported controls and parametric seam closure. Strict build and 16-second actual GPU recording passed with no captured console errors. Updated gallery preview, poster, prepared runtime and downloadable sources. Evidence: `docs/validation/new-effect/morph/`.

## Complete five-movement Original mix (2026-09-29)

Extended the approved geometric morph to columns → ribbon → floating disc → orbital play → wave field → columns. Each movement keeps a five-second slot, so the loop is now 25 seconds. The same three persistent patches become the orbiting discs and then three anchored wave bars; individual Orbital play retains its independent multiplicity control/default. No new meshes, fade layers or render targets are introduced.

Orbit uses the existing wide circular path and tumbling rhythm, with patch-specific fixed quaternion hemisphere selection. Wave reuses `waveProfile()` for its anchored bases and continuous left-to-right height wave. Disc-to-orbit closes the sleeve into a solid disc as the three parts spread out; orbit-to-wave lengthens and lines them up; wave-to-columns lifts the baseline and resumes the rolling columns.

Phase offset and shared URL bounds now derive from the 25-second sequence duration, as does Surprise me. Updated the Original mix caption. Tests cover every handoff over two loops, non-degenerate rotation, orbit radius, wave bases and late-cycle URL offsets.

Validation: 23 tests and strict build passed; a 26-second actual GPU recording covered all five modes and the loop, with no captured console errors. Gallery preview is now 25 seconds. Evidence: `docs/validation/new-effect/full-mix/`.
