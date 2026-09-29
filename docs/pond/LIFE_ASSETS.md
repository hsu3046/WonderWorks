# Stillwater life refinement — 2026-09-29

Fish were too large and visually repetitive. The initial shared scale range of 0.30–0.52 has been superseded by species-specific ranges (see the material/size correction below). The final user revision limits the scene to 8 fish: two each of Jikin, Tosakin, Ryukin and Shubunkin.

Ryukin and Shubunkin were extracted in the connected Blender 5.2.2 instance from the user-supplied `.blend` files in the workspace `assets/` directory. The existing Tosakin export is retained; the newly supplied Tosakin source and Fish Perch archive are not needed by this scene. Fish source artwork is somitsu, CC BY 4.0, as confirmed by the text blocks in both new Blender files.

The original models' scales, fin rays and body proportions are preserved. Jikin/Tosakin use original red/white, charcoal/bronze and a restrained gold variation; recoloring retains the source markings and scale detail. Ryukin/Shubunkin retain their source patterns. The flat ivory override has been removed. All four species share the existing GPU deformation and swim paths. Their original NLA/cloth animation is not exported.

The frog is the supplied Montane Brown Frog (F), replacing the intermediate AIB procedural frog. Original model: ffish.asia / floraZia.com (CC BY 4.0), with cleanup, mesh edits, baked lower-resolution textures and Rigify rigs in the supplied derivative, according to the user's provenance. The derivative editor's name was not supplied. Three static meshes retain the source texture/UVs; rest pose is normalized to fit the lily pad. Breathing is a restrained web deformation rather than playback of the source rig. Actual geometry, mottled skin, toes, mouth and eyes now come from the supplied model.

Conversion: append to separate `AI_Stillwater_Asset_*` scenes, evaluate meshes with cloth disabled, normalize axes/scale, copy materials/images, reduce new fish maps to 1024 and frog maps to at most 2048, remove transmission, export selected web scenes. No embedded rig scripts are executed. Root input files stay unchanged. Reproducible preparation: `projects/pond/scripts/prepare-supplied-assets.py`; append instructions: `scripts/ASSETS.md`.

Runtime adds approximately 14.9 MB of GLBs (Ryukin 3.93 MB, Shubunkin 3.62 MB, frog 7.39 MB). Fish remain instanced; the frog adds three mesh draws plus a contact shadow. No new dependencies. Existing one-frame-loop pause/visibility lifecycle is retained.

## Final swimming and garden revision

The previous motion translated a rigid-looking body at constant speed with an unrelated vertical sine. Each fish now maintains a stroke phase, effort, speed and smoothed turning bank. The travelling deformation grows toward the tail, fin strokes share its phase, velocity accelerates into a modest pulse/glide, and depth changes are damped. Normal depth is roughly 0.78–1.04 below the surface, with a shallower feeding approach. Separate timing or animation loops were not introduced. Bodies now cast/receive shadows; shadow silhouettes use the static rest mesh, so fine tail shadow deformation is approximate.

Nature defects: shared diagonal planar UVs stretched grain over merged stone/trunks, and uniformly flat vegetation lacked detail. Photographic diffuse/normal/roughness sets (Poly Haven CC0, local 1K maps) replace rock, bark and soil noise. Rock uses triplanar projection, dampness and subtle moss; bark preserves length-scaled cylindrical UVs. Tree branches now join at staggered heights with bends; leaf blades have a raised midrib, veins and pigment variation, grass has tapered curved geometry and patch-dependent height/color. The pond bed shares the photographed ground maps instead of the former repeated pebble drawing. Dragonflies have smaller oval translucent wings. Vegetation remains procedural geometry.

## Species sizes and material correction

All four GLBs are normalized to 2.2 units from nose to tail; this does not make their body volumes equivalent. `fish-species.ts` now supplies shared asset order, scale bounds and pigment variants: Jikin 0.18–0.22, Tosakin 0.17–0.21, Ryukin 0.16–0.20, Shubunkin 0.46–0.52. Fancy goldfish average approximately 51–56% smaller in linear size than the previous shared range; the slender Shubunkin averages 20% larger. There remain two of each species.

Ryukin's GLTF material had `vertexColors=true`, but batching removed the color attributes. Its textured surface consequently used a missing color input. Since the Blender material uses the authored texture, batching now explicitly disables vertex colors rather than keeping irrelevant exported paint layers. Browser inspection reproduced the mismatch before the fix and verified all 15 batches after it.

The former roughness scalar was multiplied by each source roughness map and could approach zero. Skin/fins now have a post-map roughness floor of 0.48, zero metalness/clearcoat, subdued environment reflections and stronger source scale normals. Eyes remain separately glossy. Bodies are opaque; fins retain the source alpha cutouts but clamp surviving pixels to 0.72–0.98 opacity. Gold shifts only warm source markings; charcoal retains mottled silver/brown detail. No flat ivory or all-over gold wash remains.

## Living garden revision — 2026-09-30

Fish no longer follow phase-shifted ellipses. Each has a deterministic random destination, independent 9–23 second reconsideration timer, cruising speed, damped vertical velocity, turning bank and stroke phase. They pick new targets on arrival; feeding temporarily redirects each toward a separate location near the food. Depth is bounded by the sloping pond bed and body clearance. Species sizes, pigments and two-per-species limit are preserved.

The frog now moves between nearby non-flowering lily pads. Pointer entry or a tap triggers a short crouch, 0.70-second ballistic-style arc, landing compression and a ripple. It also occasionally hops independently. A two-second recovery prevents repeated pointer events from restarting a jump. This is a whole-model web animation with subtle breathing, not playback of the original Rigify rig. The hover ray uses a small world-space hit sphere; touch uses the existing tap-versus-drag check. Paused scenes ignore frog interactions.

Five dragonflies have a narrow nine-segment abdomen, compact thorax, tiny eyes and four translucent wings. Seven butterflies have paired hinged scalloped wings, painted veins and separate bobbing flights. Six water striders coast between short paddle strokes; their six bent legs meet faint water dimples and emit small ripples.

760 curved cherry petals (previously 220 point sprites) tumble through the garden. 140 dandelion seeds use fine parachute-filament/stem sprites with a slower drift. Both are GPU-instanced, one draw each, and share the scene clock and breeze setting. All animals share the existing frame loop. No new dependencies or downloaded assets. Procedural artwork is AIB Inc. GPL v3; existing somitsu and frog CC BY credits remain.

## Limb poses, color variety and water-lily detail — 2026-09-30

Water striders are now 20% of their former linear size, including feet/contact rings. Their propulsion speed and ripple strength are reduced to match.

Butterflies use seven separately painted wing textures (orange, blue, violet, cream, coral, yellow and green); multiplying tints over the former orange texture could not produce clear blues. All retain dark veins, margins and spots. Each fish species now has two pigment variants: original/charcoal Jikin, original/gold Tosakin and Ryukin, original/copper-cool-silver Shubunkin. Authored markings, scale normals and prior gloss/opacity bounds are retained.

The frog now loads `montane-frog-hopping.glb` (9.18 MB) with Crouch/Kick/Tuck/Reach position and normal morphs. In connected Blender 5.2.2, AIB copied the normalized mesh into a separate scene and used the supplied Rigify deform weights and anatomical joint locations to make limb poses. Vertex correspondence with the source was checked (max error 2.98e-7). Original input scenes/files were not edited. Poses blend on the existing 1.08-second hop clock with smooth, bounded weights, reaching full rear-leg extension shortly after takeoff, tucking during flight and extending the forefeet before landing. Whole-body squash is reduced. Source script and isolated editable Blender scene are included. This is newly authored motion, not playback of source animation clips.

`lilies.ts` supplies circular cut leaves with a shallow bowl and irregular raised rim, shared 512px pigment/branching-vein and bump textures. Nine leaves vary in tint and rotation. Flowers use three staggered whorls of thin, pointed, cupped petal surfaces with longitudinal pigment veins, a compact center and 48 stamens. Each whorl is batched instead of drawing individual thick ellipsoids. All plant/insect textures in this revision are procedural AIB artwork; model CC BY notices remain separate.


### Meadow and delicate wildlife — 2026-09-30

- Dragonfly linear scale 0.62; butterflies 0.40–0.54 instead of 0.70–0.95. Wing palettes and flight paths are preserved.
- Water striders retain their small 0.20 size. Opaque one-pixel lines were replaced by tapered instanced cylinders (0.00022–0.00034 world radius), translucent grey-green bodies/legs, short front legs, long rowing middle legs and rear stabilisers. Paired capillary waves originate at the middle feet on each power stroke and remain at their world contact position as the insect glides away; six subtle dimples track the feet. A fixed pool of 48 wave slots uses the shared clock, with no added animation loop.
- Frog preload blends Crouch 0.34 + Tuck 0.66 at 0.24 s, so the hind feet fold in before release. Full Kick at 0.40 s; takeoff at 0.30 s, landing at 1.02 s and recovery at 1.24 s. The existing Blender-authored morph asset is unchanged. Blender Local was disconnected in this session; no new Blender editing or export was performed.
- Airborne dandelion seed opacity multiplied by 0.56. Green grass increased from 34,000 to 78,000 blades with a near-shore density bias. Added 320 rooted dandelions and 4,200 ground petals in irregular drifts around the cherry tree and along the bank. Pond bed material remains separate from the greener lawn material.
- Existing fish limits, sizes, original patterns, asset attributions and pause/visibility lifecycle preserved.
