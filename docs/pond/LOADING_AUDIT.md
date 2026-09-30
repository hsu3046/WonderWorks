# Stillwater loading audit — 2026-09-30

Investigation only; no runtime/source-asset changes or deployment. AIB Inc.

## Measured production load

Measured the deployed `/experiments/pond/index.html` in the Codex in-app browser
on the user's Mac, without network throttling. One existing-cache visit and one
browser-cache-disabled reload. Cache disabling was restored and the temporary tab
closed. Local development servers remained stopped.

| Measurement | Result |
| --- | ---: |
| HTML responseStart (cold browser cache) | 20.5 ms |
| DOMContentLoaded | 422.5 ms |
| Standard load event | 1,258.8 ms |
| Last required asset responseEnd | 8,579.9 ms |
| Resource transferSize total, excluding blob URLs | 72,975,239 bytes |
| Decoded resource bodies (not decoded GPU memory) | 84,424,410 bytes |
| Main JavaScript transfer body | 232,635 bytes |
| Last required asset responseEnd with existing cache | 2,546 ms |

The normal load event is misleading: module-level async scene creation continues
long afterward. Resource Timing proves an >=8.58-second dependency wait on this
cold-cache run. **Exact first rendered/interactive frame time was not captured.**
The ready observer was attached after readiness, so its timestamp is not used.
No CPU/GPU compilation-duration claim is made; console error check was clear.
This is one desktop/network sample, not a mobile benchmark or percentile.

## Observed waterfall

Seconds from navigation start, cold browser cache:

| Stage | Start | Last response |
| --- | ---: | ---: |
| Painted woodland | 0.402 | 0.473 |
| Nine nature textures | 0.474 | 1.151 |
| Painted ground | 1.152 | 1.231 |
| Bridge + gazebo | 1.259 | 4.021 |
| Hydrangea | 4.233 | 4.774 |
| Azalea | 4.859 | 5.100 |
| Five fish | 5.233 | 7.103 |
| AIB fish cornea | 7.170 | 7.199 |
| Frog | 7.302 | 8.080 |
| Monarch butterfly | 8.167 | 8.580 |

`scene.ts` awaits backdrop, then garden, then life. `garden.ts` awaits nature
materials, architecture, hydrangeas and azaleas in sequence. `life.ts` waits for
fish, then frog, then insects/monarch. Within some stages requests are parallel,
but otherwise independent stages cannot start until earlier ones finish.
`main.ts` closes the loading overlay and attaches controls only after all of this.
The render loop/ResizeObserver also starts after scene assembly. Thus tiny
background wildlife blocks the entire initial experience.

## Large assets

| Model | File MB | HTTP encoded MB | Embedded image MB | Mesh triangles |
| --- | ---: | ---: | ---: | ---: |
| Bridge | 15.93 | 12.38 | 7.41 | 291,574 |
| Gazebo | 12.83 | 9.77 | 4.83 | 290,960 |
| Hopping frog | 9.18 | 8.30 | 6.58 | 29,898 |
| AIB goldfish | 8.42 | 6.75 | 3.71 | 158,597 |
| Hydrangea (both LODs) | 6.48 | 5.84 | 3.71 | 59,491 |
| Monarch | 4.77 | 4.36 | 4.01 | 16,965 |

Geometry compression extensions (Meshopt/Draco) are absent in these files.
Bridge/gazebo already use WebP, so converting their image format alone is not a
complete solution. Frog uses PNG; monarch mixes PNG/JPEG. Nine standalone nature
textures are 1024px JPEGs totaling approximately7.4 MB, a compression opportunity.
The unused older frog/Jikin GLBs are present in deployment output but were **not
requested**; removing them alone does not improve this page's loading waterfall.

## Initial rendering pressure (separate from download time)

Runtime diagnostics at the Garden view:182 main draw calls and11,380,477 main-pass
triangles. The water reports227 reflection and157 refraction calls (with different
visibility/shadow work); do not assume every pass has the main triangle count.
The distant hydrangeas alone submit6,289,920 triangles (520 ×12,096) and azaleas
1,507,248 (432 ×3,489). Reduced/full LOD geometry is shipped together. The new maple
submits1,169,816 triangles. These contribute to initialization/upload/first-render
cost and sustained load, but their separate elapsed costs need profiling.

## Recommended order, preserving appearance

1. Remove unnecessary serial asset dependencies: start independent requests
   together, then attach their results in deterministic order. Bound concurrency
   to avoid simultaneous decode/upload spikes; parallelism cannot eliminate73 MB.
2. Decouple first usable garden from secondary wildlife/flowers. Render ground,
   water and architecture first, attach decorative groups progressively, with
   explicit loading/error cleanup. This improves perceived readiness without
   reducing the completed scene's detail.
3. Optimize largest models/textures: remove unneeded attributes, compress geometry,
   re-encode oversized maps, and validate close-up normal/alpha/eye appearance.
   Preserve frog morph targets and all visible materials. No package installation
   or asset conversion has been performed in this audit.
4. Make distant flower LODs materially cheaper and defer near-only data. Current
   far hydrangea geometry is too expensive at this instance count. Compare the
   same viewpoints before/after rather than increasing simplification blindly.
5. Re-measure cold/warm readiness and long tasks after each independent change.
   No quantified speedup is promised before implementation and measurement.
