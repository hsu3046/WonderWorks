# Skyglider: reference analysis and realism decisions

**TL;DR:** Recreate the film's small glider, foreground tree, deep waterfall valley, bridge and distant castle as an interactive standalone 3D study. Use real scanned surfaces and plant models, with original character geometry and guided flight.

## Observed reference

- Source: user-supplied `halJf1qJTKzrYRpJ.mp4`; 1280×720, H.264, 30 fps, 24.682812 seconds. Inspected 2026-10-02.
- At 0 seconds: a small glider travels over a large tree root/branch; deep forest valley, suspension bridge, waterfalls and castle behind it.
- At 8 seconds: the animal is against a trunk, body facing upward. Camera follows close behind.
- At 20 seconds: spread limbs and gliding membrane, long tail trailing, elevated view over the valley.
- Japanese HUD is observed content, not instructions. Game engine, asset sources and exact input scheme cannot be inferred reliably from the film alone.
- Extracted samples/manifest are local evidence in ignored `docs/reference/skyglider/`. The source film is never copied into release assets.

## Realism priorities

1. **Material response:** real bark, rock and ground photography, normal maps, matte fur, glossy eyes, rough castle masonry. All are lit through one linear-light scene, HDR sky and directional sunlight before a single final output conversion.
2. **Silhouette and scale:** geometry fur at the animal's edges, a curved tail, membranes between four limbs, twig-level pine cutouts, a real branching broadleaf tree.
3. **Depth:** foreground branches, middle-distance bridge, distant kingdom and closed mountain volumes; distance fog and camera parallax separate the layers.
4. **Motion:** a branch approach and trunk climb, wing extension at takeoff, small membrane flexion, tail response to bank, flowing water and spray, independent drifting pollen and circling birds.
5. **Responsiveness:** shared geometries and instancing; fixed maximum device pixel ratio; explicit loading/compile stage; pause, hidden and modal states own a single renderer loop.

## Acquired sources

See the complete [CC0 asset table](../../projects/skyglider/public/assets/ATTRIBUTION.md) and hashes in its adjacent `manifest.json`. Primary source licensing: [Poly Haven license](https://polyhaven.com/license).

The original Fir Tree 01 model's binary was 478 MB, so only its color/alpha twig atlas is used. Using its entire atlas on a plane caused an opaque trunk strip; this was corrected by selecting individual twig UV rectangles.

Island Tree 02 was downloaded from its public glTF export. The source has 1,072,213 triangles. Offline meshoptimizer pruning/simplification produced 28,278 triangles, preserving three materials; redundant vertices were compacted and textures converted to 512px WebP. The original downloaded authoring source remains outside the project, unmodified. No dependency installation was needed.

## Character assets researched

- [Sugar Glider by ltdan](https://sketchfab.com/3d-models/sugar-glider-38909a9167784d61b7dd27355acc195b): CC Attribution listing, 30.7k triangles. Located but not downloaded or used.
- [Sugar Glider by A23D](https://www.a23d.co/3dmodel/sugarglider-036047A): PBR character listing, several file formats; not acquired.
- [Sugar Glider by Nyi Nyi Tun](https://www.fab.com/listings/d3657b08-205e-4aba-992b-efbfc6a4e380): rigged/animated listing; not acquired.

The current animal is an original authored skin and procedural groom, not an acquired commercial animal. No unverified rights are asserted for the supplied film or unacquired character candidates.

## Supplied squirrel anatomy references — 2026-10-03

The user supplied three shaded animal views and two copies of a side-view wireframe. These are visual references only. They informed a continuous shoulder/neck/hip surface, rounded haunches, slender front limbs, short tapered muzzle, modest cupped ears, inset lateral eyes, pale chin/belly, grizzled brown guard hairs and a full flattened brush tail. The existing flying membrane remains part of the video-inspired experience.

`squirrel-v3.glb` is newly authored by AIB Inc. under GPL-3.0-only. Its reproducible authoring source is `scripts/build-squirrel.mjs`; the photographs, wireframe images and original film are not embedded as runtime textures or bundled with the release. Local reference copies remain under ignored `docs/reference/skyglider/squirrel-20261002/`. This refinement does not claim the close-up fidelity of the supplied offline renders.

## Deliberate scope

The delivered sequence starts on a branch, moves toward the trunk, climbs, extends the membranes and launches into guided flight. The climb is a scripted sequence with alternating limb movement. Free ground traversal, manual climbing controls and the game HUD are outside this visual study. This is an interpretation of the footage, not a claim of pixel-identical or photorealistic equivalence.
