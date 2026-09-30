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


## Supplied monarch butterfly — 2026-09-30

`monarch-butterfly.glb` is the user-supplied `monarch butterfly 3d model.glb`, copied byte-for-byte. The embedded generator is Tripo; the file does not contain an author or license declaration. This model is not covered by the application's GPL grant or the other animal models' CC BY notices. Provenance/redistribution terms remain to be supplied before public distribution.

AIB runtime work: normalize the pitched +X body to -Z forward, retain the original UV/color/normal/roughness maps, and apply weighted wing rotation with matching normals. Two small instances share one geometry and the texture maps, with independent wing strokes, gliding intervals and flight paths. The source file has no rig or animation clips; web motion is authored by AIB Inc.


Integration: `src/monarch.ts`, awaited by `createInsects` and `createLife` before the existing ready state. The seven colored procedural butterflies remain; there are now nine butterflies including two monarchs (scale 0.25/0.29). The source mesh has 17,538 vertices / 16,965 triangles and costs two additional main-pass mesh draws. The 4,774,660-byte GLB is loaded once. Source maps and geometry are shared, per-instance materials hold the two flap uniforms. Existing scene traversal disposes resources; no separate RAF, timer or animation mixer is added. Pause and visibility continue to use the scene clock.


### Monarch landing and leg poses — 2026-09-30

The two supplied monarchs now alternate between flight, a four-second eased approach, seven/nine seconds resting, and a three-second takeoff. The cycles have different lengths and alternate flower-bearing lily pads 2/5. Contact points sit on different parts of the leaf rim, outside the bloom and the frog's landing choices. The full leaf world transform drives resting position/orientation, including leaf tilt and bobbing; measured lowest foot height sets body clearance.

A separate vertex leg mask excludes the thorax, wings and forward antennae. During flight the lower legs rotate back toward the abdomen and draw inward; normals follow the deformation. Legs extend before contact, stay open throughout rest, and fold again after takeoff. Wingbeats fade into slow resting movements and restart during takeoff. The model has no source rig: these are web-authored weighted deformations, not anatomical bone animation. Existing seven procedural butterflies retain their flight behavior.

`monarch-behavior.ts` is an absolute-scene-time controller, with no new RAF/timer. Regression tests cover leg timing, grounded rest, all four states, multiple cycles, bounds and continuity. Quintic interpolation output is clamped to prevent floating-point overshoot around 1 (~1e-15). Original GLB is unchanged.


### Smaller frog and airborne seeds — 2026-09-30

Frog linear scale is now 0.36 (previously 0.72), including the animated squash scale. Contact shadow dimensions, model ground offset, and pointer sphere radius/center offset are halved to match. Lily landing targets and hop timing remain unchanged. Airborne dandelion seed sprite size is 0.095–0.19 instead of 0.19–0.38; count, transparency and drift are unchanged.


### Painted distant woodland — 2026-09-30

The distant geometry previously occupied only a back arc, leaving bare horizons from other directions. A newly generated transparent panorama now wraps around the garden. A curved lower section meets the meadow, mirrored UV wrapping joins the panorama, and the existing sky remains visible above the silhouettes. The matte follows day/rain tint and is included in water reflection renders. Four nearby hero trees and the shoreline planting stay in 3D; sixteen far trees, fifty distant shrub clusters and thirty-eight distant bamboo stems are replaced.

Runtime image: `public/landscape/painted-woodland-v1.webp` (2172×724, RGBA, 267124 bytes). Prompt and generation provenance: `public/landscape/README.md`. Built-in image generation; WebP format conversion only.

Initial v1 camera before/after: foliage instances 78,880 → 24,836 (68.5% fewer); main-pass triangles 1,571,016 → 1,111,396 (29.3% fewer); draw calls 153 → 154. These are renderer counters, not GPU-time, FPS or battery measurements.

### Meadow/horizon gap correction — 2026-09-30

The lawn extended well beyond the planted grass and hid the lower illustration, exposing a broad bare strip. The v1 image also lacked a usable foreground. Version 2 adds opaque painted meadow vegetation; a shallow elliptical skirt meets the 3D grass and uses planar UVs to prevent radial streaks. Soil/lawn materials fade at the outer planted edge. The vertical horizon remains outside the maximum orbit distance, avoiding an upright cutout inside the garden. Runtime backdrop: one image (441004 bytes), one mesh, 512 triangles, no shadow casting. Main-pass counter: 1,108,836 triangles / 154 draws. No new RAF or dependency. Browser verified default view, elevated reverse orbit and maximum zoom-out with no console errors. Screenshot: `docs/validation/pond/backdrop/gap-fixed.png`.

### Dense painted groundcover — 2026-09-30

The lawn now uses a dedicated overhead grass/clover/low-leaf illustration instead of the forest-soil image. One 1254-square WebP (685224 bytes) supplies both color and a subtle 0.018 bump, with mirrored repeat and anisotropic filtering. The existing ground material still receives lighting/shadows and fades into the distant meadow. Pond-bed soil remains unchanged. Grass instance count stays at 78000; no extra meshes, draws, timers or dependencies. Source/provenance/prompt: `public/landscape/MEADOW_GROUND.md`.

### Camera terrain clearance — 2026-09-30

Orbit polar angle is capped at π/2. After controls, damping and preset interpolation, the camera is clamped 0.22 units above the terrain: the existing sloped pond-bed formula inside its ellipse, lawn y=0.25 outside. This preserves the underwater Dive in preset but prevents dragging/zooming beneath the lawn or pond floor. Corrected positions look at the existing orbit target. Verified downward drag + zoom-out in Garden (y=0.50) and Dive (outside lawn y=0.47); Dive preset still reaches y=-0.58. Strict build passes; browser console has no errors.

### Reference-based fish scale swap — 2026-09-30

Per the user's numbered screenshots, the silver/red and charcoal pair (jikin asset, palettes 0/3; references 1/3) now use scale 0.46–0.52. The mottled calico pair (shubunkin asset; reference 2) use 0.18–0.22. These ranges are swapped exactly; Tosakin/Ryukin, counts, palettes and asset attribution names remain unchanged. Existing motion reads the same sizes for depth clearance.

### Smaller water-lily blooms — 2026-09-30

Both flower groups now use uniform scale 0.6 (40% smaller in each dimension), including petals, stamens and center. Leaf size, pad positions and butterfly landing targets remain unchanged.

### Reed alignment and restrained fish pigments — 2026-09-30

Reed seed heads now share the stalk's displaced endpoint and direction quaternion. Their base overlaps the tip by 0.07, eliminating the offset from the old unshifted x coordinate and vertical orientation. Random calls, counts and materials are unchanged.

Fish palette variants now multiply source texels with restrained warm/cool shifts instead of substituting a flat gold pigment with clamped detail. The charcoal variant preserves silver scales and recolors warm patches using source luminance. Original patch boundaries, fin transparency and normal maps remain. Strict production build succeeds.

### Original fish colors, one individual per model, AIB v5 — 2026-09-30

Supersedes the earlier eight-fish/pigment-variation setup. The pond now has five fish: one each of Jikin, Tosakin, Ryukin, Shubunkin and the new AIB Pearl Vermilion v5. Palette attributes and recoloring shader code are removed. Existing user-directed size ranges stay; new v5 uses scale 0.28–0.30. UI count comes from the shared species list.

The latest supplied `Goldfish_Pearl_Vermilion_ScaleRelief_v5.blend` was appended into an isolated Blender scene, exported with its original baked pigments and 44,820 triangles of scale relief intact. Final GLB: one scene / 32 meshes / 158,597 triangles / 8,416,504 bytes. Runtime batches by material and supplies body/fin swimming. Source file and previously active Blender scene are preserved. See model attribution and conversion scripts for provenance and shader limitations.

### Clearer underwater pigments — 2026-09-30

The surface shader previously mixed 11.4% flat green into every refracted pixel even at the default 91% clarity, lifting dark patches and muting red pigment. Replaced the flat mix with gentle multiplicative absorption and a clarity-dependent squared scattering term. The underwater surface tint drops from 24% to 4.5% + murk × 16%; underwater distance-fog density is now 0.025 + murk × 0.035 instead of 0.048. Reflections, ripples, caustics, authored texture colors and scene lighting remain. No added pass, texture or dependency.

The v5 scale normal map uses TEXCOORD_1: fish batching now preserves UV1 and supplies a UV0 fallback for other parts, eliminating the dark incorrect scale shading. Validation: strict TypeScript/production build, two fish-motion tests, five unique species in browser diagnostics and no browser console errors.

### v5 scale speckles and eyes, revised sizes — 2026-09-30

Source Blender material inspection revealed that `GF_Scale_FineGrowthLines_768` is grayscale Height feeding a Bump node, although the GLB declared it as a normalTexture. Interpreting this grayscale field as RGB normals caused dark dots; keeping UV1 alone was insufficient. Runtime now uses the original image as a subtle bumpMap (0.00012), preserving UV1 and raised-scale geometry. No pigment replacement or blur is used.

`GF_Iris_OrganicDepth_1024_Linear` is explicitly Non-Color in Blender: the runtime restores linear color-space sampling instead of sRGB decoding it again. Eye materials use a clearcoat approximation for the omitted cornea, including upgrading the standard pupil material to physical material. Original iris/pupil geometry and color maps are retained; this remains a one-pass approximation of the Blender eye.

Latest numbered references supersede the earlier size choice: Shubunkin (reference 1, calico) now uses 0.28–0.30; AIB goldfish v5 (reference 2, veil tail) uses 0.18–0.22. The two ranges are exchanged, with all other fish unchanged.

Final eye treatment also restores the original two curved cornea meshes in `aib-goldfish-v5-cornea.glb` (155,700 bytes), aligned to the existing iris bounds. The membrane uses view-angle transparency and a small studio catchlight for legibility. This is a web reflection approximation, without transmission scene captures. Source/active gazebo scene remain unchanged; extraction script is `scripts/export-goldfish-cornea.py`.

### Refined bridge/gazebo and camera pan — 2026-09-30

Replaced the procedural bridge and pavilion with user-supplied `Wooden_Bridge_Refined_v1.glb` and `Wooden_Gazebo_Refined_v1.glb`. `architecture.ts` preserves proportions, aligns the bridge to an 8.8-unit span at z=-5.7 (base -0.12), and places the 5.8-unit-tall gazebo at z=-11.3 on y=0.25. Authored material groups, UVs, normal/roughness/color maps, shadows and reflections remain. Source files are unchanged.

Web copies retain all 291574/290960 triangles; maps are resized from 4096 to 2048 and embedded with EXT_texture_webp (lossless data maps, high-quality color maps). Total bytes: 85031236 → 28758084. Reproducible conversion: `projects/pond/scripts/prepare-refined-architecture.py`.

OrbitControls now supports right-button drag to pan along the ground plane (speed 0.75), with focus distance bounded to 16 units around the garden. Left-drag rotation, wheel zoom and preset navigation remain. Canvas arrow keys also pan. Right-button/modifier gestures are excluded from the frog/ripple tap handler. Existing terrain clearance still runs after all camera motion. Browser-verified right drag while paused translated camera and target equally by (-2.138, 0, +0.480), maintaining orientation and height, with no console errors.

### Additional garden canopy — 2026-09-30

Added one pink cherry tree at (6.8,-10.2), height 8.2, and four green trees around the rear/sides at (-13,-9.2), (-6.8,-15), (6,-17) and (14,-10). Their heights and green palettes vary. Foreground pond views and the central bridge/gazebo sightline stay open. Generation runs after existing planted geometry so the earlier seeded tree, shrub, reed and grass layout remains unchanged. Added foliage joins the existing instanced leaf mesh and branches join the existing bark batch; no new assets/dependencies or animation loops.

### Architecture proportions and submerged footing — 2026-09-30

Bridge span reduced 8.8 → 6.6 (25% smaller uniformly), with its lowest footing lowered from -0.12 to -1.50 to meet the near-side pond bed instead of appearing on the water surface. Gazebo height increased 5.8 → 6.5 (12.1%), retaining ground contact at y=0.25. Their x/z anchors, materials and original asset files are unchanged.

### Smaller oversized butterflies — 2026-09-30

The seven procedural colored butterflies used scale 0.40–0.54 and read noticeably larger than the modeled monarchs. Their scale range is now 0.26–0.32 (35–41% smaller, with less size variation). The two monarchs, flight paths, wing motion, insect count and landing logic remain unchanged.

### Strider visibility and gazebo height — 2026-09-30

Striders retain hair-thin leg radii and six individuals. Overall scale rises 0.20→0.23; the body now uses a separate darker material at opacity 0.68, while legs remain translucent at 0.46. Foot-contact ring opacity rises 0.15→0.23 and stroke-wave strength 0.26→0.36. No new geometry, particles or passes.

Gazebo height rises again, 6.5→7.2 (+10.8%), with uniform scaling and ground contact y=0.25. Smaller submerged bridge placement remains unchanged.

### Ground-level occlusion and meadow rendering — 2026-09-30

The reported camera (-14.115, 0.474, 29.574) lies beyond the old planted-lawn fade radius. There the 3D ground disappeared, revealing a stretched panoramic meadow skirt and allowing below-ground fish to remain visible. The lawn now remains opaque throughout the navigable area and fades only beyond elliptical radius 5–6. Its existing overhead meadow illustration uses metric UVs and anisotropic filtering at 16. The distant panorama remains behind the ground.

Removed the single-UV 170-unit soil fallback plane. Replaced the clipped rectangular bed, whose outer triangles rose above the lawn, with a radial bed sharing an exact elliptical rim (10 × 7.5) at y=0.25. `terrain.ts` supplies the same continuous height to the visible bed and camera floor guard. Added 8,000 small static outer-meadow tufts, in one instanced batch, to give the illustration depth at low angles; 144,000 additional triangles, no new textures or RAF.

Water Fresnel now uses air/water F0=0.0204 and approaches full reflection at grazing incidence. Removed the 0.85 multiplier that always leaked at least 18.8% of refraction through; attenuation also increases with grazing optical path length. Fish are not globally hidden or toggled by camera height: ground depth occlusion and water optics determine their visibility, preserving the Dive view.

Validation: replayed the reported camera coordinates in a temporary browser tab; the lawn blocks pond fish. Above-water and Dive presets remain available. Four terrain/motion tests and strict build pass.
