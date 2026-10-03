# Supplied scenery integration — 2026-10-03

The original `Wonderworks/assets` directory contains 16 GLBs (including two refined architecture versions), fish/frog Blender files, a fish archive and nine raster images. Model metadata and triangle/material counts were inspected; the selected eight web models were each rendered and checked in the local Three.js viewer. The originals are read-only. No new dependencies or external assets were downloaded.

## Applied assets

| Asset | Placement | Shared geometry | Web bytes |
|---|---|---:|---:|
| bridge | 1 arched bridge across the western woodland rill | 23,982 | 3,067,880 |
| gazebo | 2 lookouts near the departure grove and eastern landing area | 22,000 | 2,231,188 |
| cherry | 8 flowering trees across four plateaus | 23,832 | 1,151,604 |
| house | 7 houses near clearings and the high settlement | 18,000 | 2,176,236 |
| castle | 1 detailed landmark at (85, −405), replacing the procedural castle | 31,998 | 2,767,220 |
| hydrangea | 126 small flowerheads after building footprint exclusions | 2,800 | 1,489,508 |
| azalea | 183 small flowering sprigs after building footprint exclusions | 999 | 727,940 |
| butterfly | 4 resting butterflies among departure flowers | 2,999 | 1,624,688 |
| meadow | Softly blended garden ground around the two gazebos | — | 697,628 |
| leaf-floor | Subtle leaf litter around the old oak | — | 728,538 |

Selected inputs, including the existing Pond flower derivatives and two supplied textures, total 282,033,756 bytes. Runtime copies total 16,662,430 bytes; eight shared model geometries total 126,610 triangles. Instantiated scene geometry can be larger than these shared-source counts. This is not an FPS or battery measurement.

## Preparation and placement

`projects/skyglider/scripts/prepare-local-scenery.mjs` performs attribute-aware reduction, compacts unused vertices, converts/resizes embedded textures to 1K WebP and emits self-contained GLBs without a runtime mesh compression decoder. Refined architecture retains its material groups, authored UVs, color, normal and roughness maps. Original image alpha is preserved. The two supplied ground images keep their source dimensions and become WebP. Processing manifest: `public/assets/local/processing.json`; source hashes were checked against unchanged inputs.

`local-scenery-layout.ts` owns the placements and forest/meadow exclusion areas. `local-scenery.ts` bakes source node transforms, preserves proportions and plants rigid architecture on the actual rendered terrain. Low stone plinths close hillside gaps; the arched bridge has four separate supports, leaving its opening clear. `woodland-rill.ts` follows the exact terrain triangle grid, faces upward and stays 12cm above it, with a narrow static curved bank mask. No extra animation loop is added.

Flowers share two instanced batches and use the existing movement-gated, membership-only LOD: enter within 45m, remain until 58m. At least 14m around every landing clearing stays free of new landmarks. Existing character, waterfall, panorama and flight path remain. The earlier procedural castle and village boxes are replaced. Forest RNG draws are retained; only trees/painted tufts intersecting new footprints are excluded. Main valley loads the local assets through the existing loading manager; the character-only page skips them.

The separate woodland/mountain panorama images were inspected but omitted to preserve the accepted unified alpine coastline. Goldfish/frogs and the post-apocalyptic lighthouse were omitted because this scene is an alpine flight route. Original oak contact geometry remains essential to the authored squirrel climb. Unselected assets remain in the source library.

## Local inspection and rights

The dev-only `asset-review.html` provides buttons for the eight model copies and drag orbit. It draws on interaction/resize rather than running a second animation loop, and disposes resources when switching models. The final standalone build retains its main valley and character entries.

Source generator labels do not grant a redistribution license. Supplied asset rights are separate from application GPL/Poly Haven CC0; see `public/assets/ATTRIBUTION.md`. AIB Inc. owns the authored placement and integration code.

## Verification

Build and all26tests passed. Browser checks show the new castle during flight, populated ground around the eastern and western clearings, and flower LOD restoration on return. Final screenshots: `departure-garden-final.png` and `fern-bridge-final.jpg` under `docs/validation/skyglider/local-assets`. Character preview skips all new scene-only assets. Main/character console errors and warnings were empty. Existing673.21KB shared chunk warning remains. Full record: `VALIDATION.md`.

## Measured building scales — 2026-10-03

The previous house heights (8.8–11) and castle height (32) normalized the entire roof/chimney/tower silhouette, making the usable building volumes look miniature. The eight processed GLBs were measured with precise Three.js bounds including source node transforms. Their metadata does not establish physical units; the following are scene dimensions, not certified real-world measurements. Width and depth are before placement yaw.

| Model | Width | Height | Depth | Change |
|---|---:|---:|---:|---|
| House, all seven copies | 10.8225 | 20 | 10.8019 | Height 8.8–11 → 20 |
| Castle | 39.4076 | 60 | 37.3826 | Height 32 → 60 |
| Gazebo, both copies | 5.6897 | 7.2 | 6.7586 | First copy 6.8 → 7.2 |
| Bridge | 10 | 5.3840 | 6.5526 | Existing span retained |

`scenery-scale.ts` stores measured source extents. Every footprint reservation now derives from the scaled horizontal half-diagonal, rather than an unrelated hand-set radius. Rigid grounding checks the actual yaw-transformed bottom geometry vertices against the rendered terrain, allowing only the existing 8cm embed. Foundations fit the expanded footprint; the castle's hillside plinth spans an 8.84-unit terrain height range.

Departure/western cherry trees, three houses and four flower beds were repositioned to avoid overlap and cliff-edge foundations. Flowers also exclude all building footprints, reducing the earlier 390 instances to 309 (126 hydrangeas + 183 azaleas). Existing landing cores remain clear. No source asset or model texture was changed.

Reproduce the exact geometry/placement report from `projects/skyglider` with `node --experimental-strip-types scripts/audit-scenery-scale.mjs`. `SCENERY_SCALE_AUDIT.json` records source extents, scale factors, full scene dimensions, transformed world bounds and foundation samples. The regression suite checks these extents against the actual GLBs, ground contact, 1.5-unit separation between model reservations and guided-flight clearance above architecture.

Build and all 27 tests passed. Actual browser flight shows the enlarged high-settlement castle; landing/orbit at the waterfall glade confirms house proportions and ground contact. Console warnings/errors were empty. Proofs: `docs/validation/skyglider/scenery-scale/castle-final.png`, `house-final.png` and `diagnostics.json`. The existing 673.21KB shared-chunk warning remains.
