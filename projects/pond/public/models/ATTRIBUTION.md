# Animal model credits

The fish models and textures are by **somitsu**, licensed separately from the application under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

- Jikin goldfish: https://sketchfab.com/3d-models/jikin-goldfish-d0be1a7dd54143fab579d63e4f7cd4db
- Tosakin goldfish: https://sketchfab.com/3d-models/tosakin-goldfish-b2f0681c1e2145bcb0289f03ed75ea37
- Creator: https://sketchfab.com/somitsu
- License: https://creativecommons.org/licenses/by/4.0/

Source: the locally licensed Kiboon USDZ assets. Kiboon reduced the texture sizes to 1024 pixels. For Stillwater, AIB Inc. imported them into Blender, evaluated the rest meshes, normalized their axes and scale, and exported GLB. The original rig animation is not included in these web exports. Stillwater supplies its own GPU body/fin deformation and swimming paths, adjusts material normal strength/lighting/alpha, and omits the outer cornea during web rendering. No endorsement is implied.

The fish assets retain CC BY 4.0. Application code remains GNU GPL v3 © 2026 AIB Inc. https://www.aib.vote.

## Newly supplied fish

Ryukin and Shubunkin meshes/textures: **somitsu**, CC BY 4.0. Supplied locally as `Ryukin goldfish.blend` and `Shubunkin  Common goldfish.blend`; author and license are explicitly stated in each file's `Text` block. Creator: https://sketchfab.com/somitsu. The original model files are not claimed as AIB work.

AIB modifications: evaluated rest meshes, disabled cloth evaluation, axis/size normalization, 1024-pixel copied textures, simplified transmission, web material adjustments and custom GPU swimming. Jikin/Tosakin additionally receive per-instance pigment variations. New fish retain the authored source pattern. No endorsement implied.

## Montane Brown Frog

Original model by **ffish.asia / floraZia.com**, https://sketchfab.com/ffishAsia-and-floraZia, **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/.

Supplied derivative: `2 Realistic Frogs Rigged.blend`. User-supplied provenance describes cleanup/mesh editing, baked lower-resolution textures, and added Rigify rigs. The derivative editor's name was not supplied. AIB extracted the Montane Brown Frog (F), evaluated a static rest pose, normalized scale/axes, reduced texture dimensions, and added web skin grain, subdued breathing and contact shading. Original rig animation is not included. No endorsement implied.

The frog model and textures retain CC BY 4.0; application code remains GPL v3. The unused procedural `frog.glb` and earlier `stillwater-frog.blend` study are AIB-authored GPL v3 and are not the currently displayed frog.

## Frog hopping poses (2026-09-30)

`montane-frog-hopping.glb` uses the same CC BY 4.0 Montane Brown Frog mesh/textures. AIB used the supplied Rigify deform vertex weights and hip/knee/shoulder/elbow positions to author four new morph targets: Crouch, Kick, Tuck and Reach. These are AIB-authored poses blended by the web hop controller, not original animation clips. The original rest GLB is retained as an earlier source asset. Source script: `scripts/create-frog-hop-poses.py`; isolated editable scene: `assets/frog-hop-poses.blend`.
