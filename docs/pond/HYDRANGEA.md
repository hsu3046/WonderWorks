# Stillwater hydrangea flowerbeds

2026-09-30 · AIB Inc. · Local implementation, not deployed.

## Botanical direction

The supplied model depicts a mophead hydrangea: tightly clustered rounded flowerheads above broad, toothed leaves. The garden groups twelve smaller heads at slightly different heights above each of eleven existing shrub crowns, leaving the bridge/pavilion approach open. The original 26 shrubs are retained; flowering crowns are taller, with flowers nested into their foliage instead of rising directly from the lawn. The existing pond is the location interpreted from the request's “well surroundings”; no new well is introduced.

References: [RHS hydrangea overview](https://www.rhs.org.uk/plants/hydrangea/shrubby), [RHS mophead cultivar morphology](https://www.rhs.org.uk/plants/160676/hydrangea-macrophylla-buttons-n-bows-monrey-h/details), [RHS growing guide](https://www.rhs.org.uk/plants/hydrangea/shrubby/growing-guide). Blue/pink variation is inspired by real cultivars and soil-dependent pigmentation; the scene does not simulate soil chemistry.

Each shrub carries blue, lavender, dusty pink and a smaller pale green young flowerhead, with subtle per-head variation. Shader masking preserves the authored green leaves and stems. GPU wind bends tips slightly and uses the same deformation in shadows. Open woody branches and individual cupped, veined leaves support the flowers; the former opaque ellipsoid shrub interiors have been removed.

Yellow dandelions increase from 320 to 1,100, arranged in irregular drifts around the shore. Narrow ray florets, green basal rosettes and leafless stems preserve their recognizable shape. Saturated yellow vertex colors compensate for the bright environment and tone mapping; seed particles are unchanged. Placement retries are bounded and exclude the pavilion and hydrangea centers.

## Source and preparation

Source: user-supplied `assets/hydrangea flower 3d model.glb`, about 62 MiB, 27 mesh/material parts, 81 embedded textures and 1,967,852 triangles. Embedded generator: Tripo. No author or license declaration was found; rights remain separate from application GPL. Original file is untouched.

Blender Local imported into an isolated scene, leaving the open gazebo scene and original .blend untouched. Source and reduced renders were compared in `docs/validation/hydrangea/` (ignored evidence directory). Two geometry levels retain authored UVs and materials:

| Level | Triangles per specimen | Reduction |
|---|---:|---|
| Close | 47,395 | Decimate .024, minimum 140 faces per part |
| Distant | 12,096 | Decimate .006, minimum 80 faces per part |

Rebuild using installed Blender with `projects/pond/scripts/prepare-hydrangea.py`, then `python3 projects/pond/scripts/pack-hydrangea.py` (Pillow required). Intermediate exports live in the ignored validation folder. The packer merges geometry to one mesh per level and consolidates 27 material sets into three shared 2048px padded atlases. Base color WebP quality93; normal/roughness use lossless WebP. Final `public/models/hydrangea-garden-v1.glb`: 6,481,240 bytes. A source asset is required to reproduce it; intermediate exports are not committed.

## Runtime cost and validation

132 specimens share two instanced batches, three textures and one visible material. Close detail enters at 4m and exits at 5m for the smaller flower size to avoid threshold flicker; batch uploads only occur when membership changes. No CPU per-vertex animation. Existing scene lifecycle disposes geometry, shared texture maps and custom shadow materials.

Before the user-requested taller shrub revision, at the initial 1280×720 Garden camera: all 44 specimens use distant geometry (532,224 hydrangea triangles); complete main pass reports 179 calls and 2,737,917 triangles. The preceding local garden reported 178 calls and 2,034,373 triangles. This feature adds geometry; the reduction avoids rendering 86.6 million source triangles for 44 copies. These are renderer counters, not GPU timings or FPS measurements.

Browser checks cover initial Garden, Waterline and Lily pads, packed texture/color integrity, console errors and unchanged animation. Distance-based LOD is implemented; a close-range transition has not been isolated in the browser check. TypeScript/build and pond behavior tests are run after changes.

### Photo-based shrub correction

User's follow-up photo establishes that flowerheads belong above a taller leafy shrub and multiple colors should coexist on one bush. All 26 original shrubs are restored. Eleven nearest distinct shrubs carry the 44 heads; selected crowns are stretched vertically, while the supplied model's lower leaves overlap the existing crown to avoid a floating appearance. Four pigment families coexist per shrub; the pale green heads are 18% smaller. Final initial Garden main pass: 179 calls, 2,756,517 triangles. Final build and 10 pond tests pass; browser console has no errors. Screenshot: `docs/validation/hydrangea/shrub-crowns.png`.

### Mixed dandelion stages

The user requested yellow flowers mixed with white mature seed heads. Total rooted plants remain 1,100: 715 yellow flowers and 385 white seed heads interleaved within the same drifts. Seed heads use 56 small radial filament cards distributed over a sphere, a shared procedural alpha-cutout texture and instanced stems. No per-frame plant geometry updates. Existing 140 airborne seed particles remain unchanged. Strict TypeScript/build pass, runtime diagnostics confirm the split, and browser console has no errors. Screenshot: `docs/validation/hydrangea/mixed-dandelions.png`.


### Current rendering correction: open shrubs and soft seed heads

The user reported rock-like shrub bases and dark, hard seed heads. The bases were opaque textured ellipsoids insufficiently hidden by silhouette leaves. They are now replaced with seven slender branches and 360 additional cupped, veined leaves per shrub; all 26 shrub positions remain. Additional foliage uses a separate RNG stream to preserve existing placement. Each of the 11 flowering shrubs now carries 12 heads (132 total), approximately half the previous individual size, distributed over the curved crown with mixed colors.

The old seed-head sphere was assembled from 56 overlapping tangent cards. Their hard alpha-cutout intersections left regular dark gaps. Each seed head now uses a single camera-facing soft-alpha filament image with bright unlit color, no depth writing, and scene fog. Fine radial seed stalks and branching pappus filaments are painted into one shared 256px texture. This removes the faceted pattern and reduces seed-head geometry from 112 to 2 triangles per plant. Counts remain 715 yellow /385 white; airborne seeds unchanged. The shader-shifted head has expanded bounds and disposes its shared texture on material disposal.

Final Garden main-pass counters:181calls/3,999,975triangles, including1,596,672 distant hydrangea triangles. More blossoms add geometry; this is not an FPS improvement claim. Strict TypeScript/build and browser shader/console checks pass. Evidence: `docs/validation/hydrangea/leafy-shrubs-soft-seeds.png`. Local only.

### All shrubs, 20 heads each

User requested flowers on every shrub and approximately20heads per shrub. All26existing shrub crowns now carry20heads each (520total); small individual size and within-shrub mixed colors remain. Runtime diagnostic confirmed26/20/520 and no console errors; strict TypeScript/build passed. The far LOD totals6,289,920flower triangles, so shared instancing limits draw calls but does not eliminate the increased geometry workload. No new asset/dependency or deployment. Evidence:`docs/validation/hydrangea/all-shrubs-20.png`.
