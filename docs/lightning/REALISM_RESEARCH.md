# Fulgur: lightning realism revision — 2026-10-02

## Diagnosis

The original effect used 44 evenly spaced samples with independent positional
jitter, regularly spaced branches with constant thickness, and two broad Gaussian
flashes followed by a 1.65-second fade. All forks remained illuminated together.
This produced a sawtooth outline and a persistent luminous tree. A single spherical
cloud light and low-frequency density further flattened the discharge.

## Research and implementation decisions

| Primary source / inspected implementation | Relevant finding | Fulgur decision |
| --- | --- | --- |
| [Kim & Lin, Physically Based Animation and Rendering of Lightning (2004)](https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Kim04.pdf) | Field-dependent stochastic growth and spatial light scattering yield recognizable discharge structure. | Weighted candidate directions, coherent local bends, irregular forks, tapered failed branches and an HDR core/halo. |
| [NOAA/NWS: Negative Flash](https://www.weather.gov/safety/lightning-science-negative-charged-flash) | Descending stepped leaders connect to upward streamers; the bright return travels up the channel. | Faint descending leader, upward growth over the final 8% at ground contact, then an upward return front. |
| [NOAA/NWS Melbourne: What is Lightning?](https://www.weather.gov/mlb/what_is_lightning) | Subsequent strokes follow an established channel; later darts are normally unbranched. | One to five seeded strokes with irregular gaps. Only the first return excites unsuccessful branches. The same trunk is reused. |
| [AI Pulse Daily / lightning-sim](https://github.com/aipulsedaily/lightning-sim/tree/b723e6061fb95682e8bd682a205abacf6989c09d) | Inspected `leader.js`, `returnstroke.js`, `render/bolt.js` and MIT license. Its separation of growth, stroke timing and optical rendering is useful. | Separate immutable topology from optical timing; preserve directional memory and a narrow core. Use analytical shutter integration rather than allocating per-frame channel objects. |
| [triggered-discharge](https://github.com/diluuuu10/triggered-discharge/tree/b04e70417bec5c4b629eb5e10832926af8b75baf) | README/tree describe a full WebGPU field solver and growth pipeline. No root license was found. | Architecture reference only; no source copied or executed. Retain WebGL2 and the existing rendering budget. |
| [NVIDIA GPU Gems, Volume Rendering Techniques](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques) | Volume appearance depends on density, transmittance and illumination along the ray. | FBM/cellular density, two self-shadow samples, front-to-back absorption and three lights distributed along the actual in-cloud channel. |

All new implementation is project-authored GPL-3.0-only code, © AIB Inc.
External repository code/assets are not included; sources above are credited as
research references, not as authors of Fulgur.

## Implemented behavior

- Growth: fourteen locally weighted forward candidates per coarse step, a changing
  directional bias, two sub-step offsets, irregular branching and two branch levels.
  A targeted endpoint remains exact. Instance buffers are uploaded once per flash.
- Timing: 42–79 ms leader formation; one to five returns, 25–103 ms irregular gaps;
  unsuccessful branches extinguish quickly. Continuing current is occasional and
  faint. Cloud-to-cloud events now remain within the cloud instead of ending in
  mid-air above the dome. The initial event makes ground contact.
- Exposure: analytical integration of exponential optical pulses over each rendered
  frame. This prevents a short flash disappearing between frames at lower refresh
  rates. Pausing samples an instantaneous image; summoning while paused shows the
  first return. Natural speed is the default; Slow runs discharge time at 0.16×.
- Rendering: continuous screen-space miter joins, tapered branch widths, white core
  and restrained cool halo; shader return front propagates upward. Thunder starts
  from the first return rather than leader initiation.
- Cloud: one 64³ RG8 volume (512 KiB), baked FBM and cellular noise; multi-cell
  silhouette and a flatter base. 48 ray steps at half width/height, two directional
  shadow samples, channel-driven in-cloud scattering. Flash lighting work is skipped
  when the flash is dark. No new dependencies, texture downloads or worker overhead.

## Physical limits

This is a physically informed visual model, **not a validated electrical solver**.
There is no 3D Laplace/Poisson solve, channel charge conservation, gas thermodynamics
or measured weather data. The local growth field is an artistic approximation.
The optical decay and 1.2 ms return propagation are deliberately display-resolvable;
they must not be interpreted as measured electrical current or true return velocity.
Three local lights approximate distributed scattering, without a full multiple-
scattering solution. The dome is a study object, not a calibrated grounding model.

## Verification

- Strict TypeScript + production Vite build pass. Five lightning tests pass:
  determinism, exact connected contact/upward streamer, 1,000 bounded seeds,
  first-return-only branch illumination, and shutter energy at 30/60/120 Hz.
- Local Codex IAB, 1280×720, 5.016 s: **301 scene frames**, median **16.7 ms**,
  p95 **17.0 ms**, max **17.7 ms**. Sampled discharge generation **0.7 ms**,
  411 segments. This is a local desktop measurement, not a mobile device claim.
- Pause: scene frame count stayed at 4,936 across checks, with no pending RAF.
- 390×844 viewport: controls and Natural/Slow selector fit; cloud and ground render.
- Runtime and shader console checked. Screenshots and measurement JSON are under
  ignored `docs/validation/lightning/realism-*`.

## Conductor contact / metallic surface / orbit revision — 2026-10-02

The next user review identified weak attachment, a plastic-looking dome and awkward
cloud viewing angles. Root causes: endpoint selection alone did not constrain the
approach path to stay outside the solid; there was no local contact emission; the
metal lacked an environment to reflect. Cloud cells lay mostly in one depth plane,
and the old ray box plus fixed sample count were inadequate at grazing angles.

- `conductor.ts` defines one shared ellipsoid (radius 1.1, height 0.77), its analytic
  surface normal and a segment/solid clearance calculation.
- The downward leader meets a 0.32-unit connecting streamer along that normal.
  Failed forks stay above the conductor; the final endpoint remains exact.
  Dome mode routes automatic flashes to its crown. Explicit floor clicks still
  hit the floor, and explicit dome clicks can target its visible side.
- `metal.ts` adds a once-baked 128px PMREM studio environment, polished silver PBR,
  subtle anti-aliased turning marks, a reflective bevel and floor contact shadow.
  A compact arc reflection uses nine points sampled from the actual primary path.
  Contact emission and a nearby light use the very same attachment coordinates and
  return-stroke envelope. No decorative sparks, extra render loop, texture downloads
  or runtime cubemap captures were introduced. HDR-unsupported devices skip PMREM
  and retain the ordinary lighting fallback.
- Cloud cells now occupy front/back depth. Smooth cell unions and a compact density
  support inside a conservative ray box prevent exposed clipping faces. Marching
  uses ~0.075-unit spacing (24–96 bounded steps) with lower-amplitude fixed jitter,
  so thickness changes with camera angle do not stretch a fixed set of samples.
- Tests cover normals at the crown/rim and **250 strikes** with all segment/ellipsoid
  intersections checked, plus the existing seeded topology and timing coverage.
- Orbit checks included side, rear, elevated and low views; clicking the visible
  dome side attached at the clicked ellipsoid coordinates. Full root check passed
  all 24 tests; standalone production build passed; runtime/shader log was clean. Local 1280×720 IAB: **301
  frames / 5.015 s**, median **16.7 ms**, p95 **17.2 ms**, maximum **17.7 ms**;
  sampled strike generation **0.4 ms / 311 segments**. Physical limitations above
  still apply: the attachment is geometry-constrained, not a full field solve.

## Cloud underside / channel width / glow revision — 2026-10-02

The common Y-height density fade created a horizontal underside even though the
outer ray-box boundaries were safe. Replaced that fade with five unequal lower
cells staggered in depth and height. Expanded the smooth ellipsoidal support and
conservative ray bounds together; the existing 24–96 sample budget is retained.

The previous minimum 0.20-pixel core and edge smoothing made fine branches look
too similar in width. Channels now project their actual world-space radius, use
a continuous seeded trunk profile and taper secondary/tertiary branches to finer
tips. Gaussian pixel filtering preserves energy proportional to the actual width
instead of promoting every twig to a minimum bright line.

Increased bloom strength from 0.30 to 0.52 and radius from 0.40 to 0.60. The narrow
channel shader supplies the white center and cool inner halo; bloom supplies the
broad spill. Broad halos on every short ribbon were rejected in visual review
because additive overlaps at sharp bends obscured the centerline with white blobs.
Existing HDR compositing, return timing, metal contact and optical exposure remain.

Strict TypeScript/production build and all seven lightning tests pass. Local IAB
1280×720: **301 scene frames / 5.010 s**, p50 **16.7 ms**, p95 **17.5 ms**, maximum
**17.7 ms**; sampled generation **0.5 ms / 173 segments**. Default, zoomed low and
side views were inspected; runtime/shader warnings and errors were empty. Saved
proof and measurements: ignored `docs/validation/lightning/cloud-branches-glow.png`
and `cloud-glow-performance.json`. This is desktop-local performance evidence.

## Upper silhouette / visible contact revision — 2026-10-02

Upper cloud cells previously had similar heights and radii, producing a broad
level cap. Varied their height, depth and proportions, added two unequal towers,
and expanded the smooth support/ray bounds to contain their complete silhouettes.
The bounded sample count and half-resolution target remain unchanged.

Automatic dome contacts were sampled around the crown in fixed world coordinates,
which could place the contact on the far side or near its silhouette. They now
sample the near shoulder relative to the current camera bearing, over a ±0.95 rad
sector and 40–76% of the dome radius. This is an explicit composition choice, not
a change to the electrical model. The selected point stays fixed for the discharge;
click targeting and normal-aligned attachment remain exact.

A regression covers 1,440 combinations of orbit bearing, minimum/maximum polar
angle, distance and random-sector endpoints: every contact is on the surface and
has a positive surface-normal/view dot product. All **eight tests** and the strict
production build pass. Default and rotated low views were visually inspected.
Local 1280×720 IAB: **301 frames / 5.012 s**, median **16.7 ms**, p95 **17.3 ms**,
maximum **17.7 ms**, sampled generation **0.8 ms**. Runtime/shader log clean.
Proof: `docs/validation/lightning/cloud-peaks-front-contact.png`; measurements:
`cloud-peaks-performance.json` (both ignored).

## Cloud translucency adjustment — 2026-10-02

**Superseded by the density/resolution correction below after user visual review.**

User requested a less opaque cloud. Applied a 0.70 artistic opacity multiplier
to both premultiplied cloud radiance and accumulated absorption at compositing.
This reduces opacity by 30% while retaining the density silhouette and exposing
the internal channel; it is an appearance control, not a physical density change.
Strict production build passed; browser inspection confirmed the internal channel
is visible with no runtime/shader errors. Proof: ignored
`docs/validation/lightning/cloud-translucency.png`.

## Density / resolution correction — 2026-10-02

The user found the previous opacity adjustment muddy and apparently low-resolution.
That adjustment had not changed target dimensions: the existing cloud target was
still half width/height, enlarged by linear filtering. More importantly, density
was rapidly clamped to one and multiplied by seven, hiding most of the interior
behind an opaque skin. The final 0.70 opacity blend revealed the channel uniformly
without repairing density, self-shadowing or the smooth, solid-looking lobes.

- Removed the final opacity multiplier. Transmittance again comes directly from
  density integrated along each ray, with the same extinction coefficient used
  for approximate sunlight attenuation.
- Separated billow boundaries from optical thickness. Added density variation
  inside the lobes, not just at the silhouette, using the existing noise volume.
  Three noise scales shape cellular pockets and finer erosion. Lowered the density
  multiplier to 2.5 and the Cloud body default from 70% to 50%.
- Softer skylight and longer directional shadow sampling retain local depth
  without the former dark solid skin. A very broad density ramp was rejected
  during visual review because its integral looked like blurred fog.
- Cloud now renders at the capped main drawing-buffer resolution (four times the
  previous cloud pixels). Ray spacing is ~0.055 with a hard cap of 128 samples;
  bloom resolution remains separate. No new textures, dependencies or render loop.

Verified quiet cloud, internal flash, enlarged view, and console/shader logs.
Strict production build passes. Local IAB full cloud target **1633×919**: **301
scene frames / 5.010 s**, p50 **16.7 ms**, p95 **16.9 ms**, maximum **17.7 ms**.
This is frame pacing on this desktop, not a claim of unchanged GPU cost or mobile
performance. Proof: ignored `cloud-density-detail.png`,
`cloud-density-transmission.png`, `cloud-density-performance.json` under
`docs/validation/lightning/`.

## Mixed discharge-chain duration — 2026-10-02

The previous 1–5-stroke limit and short inter-stroke gaps made every discharge
finish quickly. The seeded mixture now uses 22% single flashes, 44% short bursts
and 34% extended trains. Extended trains contain 7–12 strokes across 0.65–1.30 s,
with independently weighted intervals, varied strengths and 22–44 ms optical
exponential decay. This is an artistic timing distribution, not a claim about
measured storm statistics. Geometry remains fixed through the train; unsuccessful
forks still illuminate only on the first return. CPU and shader share MAX_STROKES.

Automatic renewal waits for the last return plus 0.45 s, so Slow mode cannot
replace a long train midway. The afterglow readout also follows the final stroke.
Eight tests pass, including 1,000 seeds checking the mixture, late return energy,
branch suppression and eventual extinction. Strict production build passes.

Browser verification followed a seven-stroke chain through its final return at
1.153 s of simulation time. The previous renewal timer expired 79 frames before
that final return; the same discharge continued and completed. Runtime/shader
logs were clean. Natural playback at 1633×919: 301 frames / 5.010 s, p50 16.7 ms,
p95 17.5 ms, maximum 17.7 ms. Ignored evidence: long-chain-check.json,
long-chain-late-return.png and long-chain-performance.json in docs/validation/lightning.

## Raised cloud / embedded initiation — 2026-10-03

Raised the shared cloud center from 3.85 to 4.30 world units. Ray bounds, skylight
height falloff and discharge placement now reference CLOUD_HEIGHT together.
The discharge origin uses a narrow region inside the broad central cell instead
of the previous wider box; the feeder branch is shorter and remains near that
interior region. In-cloud-only endpoints and the flash light track the new height.

A smooth central-cell envelope reduces the sharp channel core while it is buried,
then restores full intensity as it emerges. The volume's actual channel lights
remain active, so the origin reads as scattered light within the cloud instead
of a bright line on its surface. This is an artistic embedded-channel visibility
cue, not a new multiple-scattering solver. Cloud density and resolution are unchanged.

Strict production build and all eight tests pass. Default and side views inspected;
runtime/shader logs clean. Proof: ignored
`docs/validation/lightning/raised-cloud-internal-discharge.png`.


## Varied origins / moving cloud / internal flashes — 2026-10-03

The previous narrow origin box made successive discharges start at nearly the
same location. It is superseded by six inset regions across the existing volume's
left, right, rear and upper lobes. A bounded 32-candidate sampler avoids the last
two neighborhoods without imposing an alternating left/right pattern. History
uses cloud-local coordinates; each origin is transformed to the current moving
cloud once at discharge creation. Origins vary in height and depth as well as X.
The compact feeder points inward for lateral origins, and embedded-core shading
covers the chosen origin as well as the central volume. Return trains retain the
same source and geometry throughout their lifetime.

The cloud previously moved only its internal noise, leaving its main silhouette
stationary. Added slow multi-frequency translation, unequal axis scaling and a
small height-dependent shear, all evaluated once per frame on the CPU. The Drift
control adjusts the pace; pause freezes the shared simulation clock. Ray bounds,
density sampling, source placement and channel attenuation share the same pose.
Transforming the ray into cloud space once avoids inverse coordinate transforms
at every primary and sunlight-shadow sample. Resolution and ray-step caps remain
unchanged; no new textures, render passes, timers or dependencies.

Internal illumination was concentrated tightly around the channels and decayed
with the very short core pulse. Increased local scattering and added a softer
surrounding fill, driven by the same return-stroke schedule with a short 45–88 ms
exponential optical tail. It cannot flash before the first return. Only radiance
changes; density/transmittance are untouched. This is an artistic readability
adjustment, not a physical multiple-scattering or fluid solver.

Strict production build and all 11 tests pass. New cases cover 1,000 origins with
recent-position separation/interior margins, bounded continuous cloud motion and
return-synchronized flash onset/decay. Browser inspection confirmed ten distinct
consecutive origins, quiet cloud movement, internal flash and pause; runtime and
shader logs clean. Full-resolution 1633×919 local IAB observation: 257 frames in
5.002 s (~51 fps), median 16.7 ms, p95 33.4 ms, maximum 34.4 ms. This session did
not sustain the earlier 60 fps measurement; it is not a matched-device baseline
or a mobile guarantee. Coordinate hoisting did not remove the observed pacing
dips, so no performance improvement is claimed.

Ignored evidence: `moving-cloud-internal-flash.png`, `cloud-origins-check.json`,
`cloud-motion-{before,after}.png`, `cloud-motion-check.json`, and
`cloud-motion-performance-final.json` under `docs/validation/lightning/`.


## Branching feedback / Fast / concurrent discharges — 2026-10-03

The old Branching control retained a minimum fork probability/budget even at zero;
its input handler only requested a redraw, although topology was generated only
at the next discharge. Zero now produces a bare trunk. Increasing the value raises
fork count, length and secondary branching, with slightly brighter first-return
forks and a 16 ms decay. Failed forks still do not re-ignite on subsequent returns.
The input coalesces into one topology refresh per frame, retaining source, target,
seed and stroke timing while restarting the visual preview. Pause holds the new
first-return peak. The same-seed browser comparison changed 0 branch segments to
1,275 at maximum without changing the trunk, source, contact or strike counter.

Replaced Slow with Natural (1×) / Fast (2×). Simulation age, cloud motion, renewal
and exposure use the same time rate; changing rate does not reset an active bolt.

A bounded seeded mixture selects 60% singles, 34% pairs and 6% triples (an artistic
distribution). Distinct sources use the existing interior sampler. Contact sampling
favors separate points on the visible metal shoulder. Independent leaders align
first returns within 12 ms for visible overlap, then each channel retains its own
return schedule. Renewal waits for every active channel's final return plus 0.45 s.
Explicit surface clicks continue to select one exact contact.

Three reusable ribbon slots cap geometry at 5,400 allocated / 5,250 generated
segments total. No extra cloud target, bloom chain, RAF or noise texture. The cloud
keeps three scattering sources total (one per channel during a cluster); the metal
reflects and emits at each active contact, with one shared strongest-return fill
light. Floor light pools also follow each contact. Hidden/pause lifecycle remains
shared, and inactive slots contribute neither draw calls nor flash energy.

Strict build and all 14 tests pass, including branching extremes/trunk stability,
1,000 mixture samples, aligned first-return overlap at both speeds and complete
long-chain lifetime. Browser checks confirmed immediate paused slider feedback,
three independent simultaneous paths/contact points (1,791 segments, 2.1 ms
combined CPU generation), clean shader/runtime logs and no premature renewal.
Full-resolution local IAB 1633×919: Natural 301 frames / 5.004 s, median 16.7 ms,
p95 17.1 ms; Fast 301 frames / 5.005 s, median 16.7 ms, p95 17.4 ms. Fast advanced
10.038 simulation seconds in that 5.005-second sample. These are desktop frame
pacing observations, not GPU-cost or mobile guarantees; prior session results
were slower, so no causal performance improvement is claimed.

Ignored evidence: `branching-{minimum,maximum}.png`, `branching-controls-check.json`,
`concurrent-lightning.png`, `concurrent-lightning-check.json`,
`fast-playback-check.json`, `natural-playback-check.json` in docs/validation/lightning.
