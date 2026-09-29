# Decisions

- Keep the approved Chroma five-mode morph unchanged; new project is `vote.aib.wonderworks-foliage`, port 4178.
- Reference only the lower video. Preserve central tree, grass, distant forest, long shadow, leaf counters and compact controls.
- Procedural geometry/textures allow seasons and foliage to change continuously without external asset downloads or Blender runtime. Original reference video remains outside the downloadable source.
- Use deterministic GPU leaf trajectories, one scene renderer and shared geometry for a bounded rendering cost.
- Sound is explicitly opt-in. Rain/thunder audio is synthesized, with no autoplay sound.
- Four-season and day drift are independently controlled. Weather may be changed directly at any date.

### Mature tree and organic meadow — 2026-09-29

- Taller 4.25-unit trunk, stronger roots, ten staggered scaffold limbs and a central leader. Camera target raised to preserve the larger silhouette.
- 26,000 leaves distributed over outer branches and inner sprays, including lower crown layers. Species, falling leaves and seasonal controls preserved.
- 160,000 curved grass blades in five-blade tufts, variable widths/heights, coherent gusts, bent normals, and meadow color noise. Near and distant grass zones overlap. Full winter snow hides submerged grass.
- Four forest silhouettes share one atlas and one instanced draw; varied proportions, buried roots, layered forest placement. Nonperiodic ground noise replaces stripes.
- Seven state tests and strict production build pass. Summer desktop, 390×844 mobile, winter and 17-second weather/season preview visually checked. No new shader/console errors after correction of the GLSL reserved identifier. Desktop sample: 120 frames over 2.003 seconds; this is one local sample, not a device-wide benchmark.
- Gallery execution copy, MP4/poster and downloadable sources updated. Proof: docs/validation/foliage/mature-tree/.

### Independent gentle leaf fall — 2026-09-29

- Replaced positive-X landing bias with independent azimuth/radius per leaf and a smaller shared wind drift. Each leaf receives an independent release time and 5.5–11.5 second flight duration.
- Per-leaf rocking, signed spin, lateral flutter and low vertical oscillation settle smoothly into a stationary ground pose. Visible material normals and depth/shadow material reuse the same deformation.
- Autumn progression slows to 1/1200 year per second, versus 1/150 elsewhere, with smooth seasonal shoulders. Flight timing uses that same scale: avoids thousands of simultaneous falls. Default speed-1 autumn capture contained 863 airborne leaves; the previous dense revision had about 7,000.
- Holding an autumn date continues staggered releases; summer remains attached. Switching auto/manual resets the manual release clock. Counters use the same seeded schedule as the GPU.
- Ten tests pass, including quadrant coverage, release ordering, eventual settling and airborne population bounds. Strict build and a 17-second GPU preview pass without console errors. Gallery clip/poster and source archives refreshed. The 8-second manual-autumn.webm records the earlier dense intermediate; preview.webm is the final gentle revision.
