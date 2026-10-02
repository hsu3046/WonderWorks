# Fulgur / Lightning study

Standalone `projects/lightning`, package `vote.aib.wonderworks-lightning`, port
4180. Built in the managed `codex/lightning-simulation` worktree. Existing artwork
source and the primary checkout's uncommitted Stillwater repair are not modified.
The root build creates `/experiments/lightning/index.html` and a Fulgur source ZIP;
a gallery card and production deployment are outside this initial study.

## Reference evidence

User-supplied `/Users/yuhitomi/Downloads/qnjYPMOpyE0aMMfz.mp4`: 1080 × 1080,
30 fps, 10.048 s. Frames sampled every second using ffmpeg, retained only in the
ignored `docs/reference/lightning-frames` directory.

| Time | Observation | Implementation |
| --- | --- | --- |
| 0–2 s | Gray cloud lit from within; cool-white branching channels descend | 3D density field, local charge illumination, emissive branch ribbons |
| 3–5 s | Cloud drifts; lower hemisphere enters the framing | Orbitable chamber with a selectable conducting dome |
| 6–9 s | Several jagged channels with dim blue remnants; floor receives light | Leader/return strokes and afterglow, ground light pool |

User input behind the reference is not proven by these frames. Click-to-strike,
cloud controls, pause, camera orbit and optional sound are original interaction
choices. This recreates visible behavior, not the original voxel simulator.

## Rendering

- `bolt.ts`: seeded, continuous primary channel with two levels of branching;
  bounded CPU generation at a discharge only; 1,800-segment buffer cap. A shared
  12-stroke maximum covers single flashes, short bursts and occasional long chains.
  Automatic renewal waits for every active channel’s final stroke plus its tail,
  including in Fast (2× simulation time).
- `storm-timing.ts`: bounded mixture of one, two or three discharges; independent
  leaders align their first returns within 12 ms. Natural/Fast uses 1×/2× time
  consistently for animation, shutter exposure and renewal.
- `channels.ts`: three preallocated instanced ribbon slots (only active slots draw),
  shader leader/return timing, miter joins, cool corona,
  continuous trunk/branch width profiles, energy-preserving subpixel filtering,
  hot core and shutter-integrated exposure. Wide light spill comes from HDR bloom
  rather than overlapping broad segment ribbons. No per-frame mesh allocation.
- `cloud-field.ts`: bounded sampling of six inset cloud regions, avoiding the previous
  two origin neighborhoods; shared slow translation, scale and shear, evaluated
  once per frame; short shutter-integrated internal flash envelope. Established
  channels stay fixed while the cloud moves.
- `noise.ts`: a 64³ RG8 FBM/cellular noise volume generated once (512 KiB).
- `cloud.ts`: bounded ray march (24–128 samples at ~0.055 world spacing), cellular erosion, directional self-shadow,
  channel-distributed illumination and Beer-style transmittance. Unequal rising
  towers and lower lobes avoid level upper/lower silhouettes. Scene depth clips the volume.
  Rays and sunlight directions are transformed once into the moving cloud frame,
  avoiding repeated inverse transforms at each density/shadow sample. Internal
  flash changes scattered radiance, never opacity or the background color.
- `conductor.ts` / `metal.ts`: shared ellipsoid contact geometry, normal-aligned
  connecting streamer, baked environment reflection and per-channel contact glows
  and analytic reflections. One shared fill light follows the strongest return.
  Automatic strikes choose the camera-facing shoulder once at birth; established
  channels stay fixed and explicit clicks retain the exact surface intersection.
- `scene.ts`: scene+depth HDR target → full-resolution cloud target →
  compositing → bloom → one tone-map/output conversion. Fallback 8-bit targets.
  Concurrent discharges share these passes and the fixed three-light cloud budget.
  Branching inputs coalesce into a single regeneration per frame, preserving
  each channel’s source, contact and seed and showing the new forks immediately.
- `main.ts`: controls, original synthesized thunder (opt-in), same-origin preview
  messages, screenshot saving, status and lifecycle.

Main drawing buffer capped at 1.5 million pixels / DPR 1.5. No other renderer or
server is started. A single RAF owns motion. Pause and hidden state cancel it;
paused controls redraw on demand. Context loss displays a reload instruction.
Cloud body defaults to 50%. Density varies through each lobe, including small air
pockets; Beer-style attenuation controls translucency. No final uniform opacity
multiplier is applied. Cloud resolution follows the capped main buffer, while
bloom retains its separate multi-resolution chain.

## Validation

Channel tests exercise 1,000 seeds for finite values/capacity, continuity and exact
contact, deterministic randomization, and bounded fading. TypeScript is strict.
Browser checks: no shader errors, desktop/mobile controls, pause/strike/resume,
actual frames and geometry count. Measurements and screenshots are in ignored
`docs/validation/lightning`; not a cross-device performance guarantee.

Initial implementation only, superseded by the full-resolution cloud: local
Codex IAB at 1280 × 720: 301 drawn frames in 5.010 s (~60 fps), median16.7 ms,
p95 17.6 ms, maximum17.7 ms. Cloud target640×360; 283 segments in the sampled
strike. No performance claims for mobile hardware from viewport emulation.

Initial verification (2026-10-02): root `npm run check` passed all 21 tests (4 new
lightning cases); full build, 8 source archives and existing catalog SEO checks
passed. Latest standalone build also passed. Pause preserved frame count with no
pending RAF; a camera drag changed viewpoint without incrementing strike count;
a click added exactly one strike. 390 × 844 layout was visually inspected.

## Realism revision

See [REALISM_RESEARCH.md](REALISM_RESEARCH.md) for the 2026-10-02 research,
optical model, physical limitations and updated performance measurements.
Natural/Fast timing controls preserve the same seeded geometry and separate
leader formation, first return, subsequent unbranched returns and afterglow.

See [PERFORMANCE.md](PERFORMANCE.md) for the final 2026-10-03 verification,
unused-envelope and UI-readout optimizations, and exact visual comparison.
