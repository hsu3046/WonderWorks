# Animal model credits

## Kiboon Momiji maple foliage

The pond's maple foliage uses AIB Inc.'s original Blender-authored Momiji v7
indexed mesh and vertex pigment from Kiboon, copied to `src/data/momiji-v7.json`.
AIB adapted axes, size, wind coordinates and blade vein shading for the garden.
© 2026 AIB Inc. https://www.aib.vote — GPL v3. No third-party model/photo texture.

## Imported fish

The four imported Jikin, Tosakin, Ryukin and Shubunkin fish models and textures are by **somitsu**, licensed separately from the application under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

- Jikin goldfish: https://sketchfab.com/3d-models/jikin-goldfish-d0be1a7dd54143fab579d63e4f7cd4db
- Tosakin goldfish: https://sketchfab.com/3d-models/tosakin-goldfish-b2f0681c1e2145bcb0289f03ed75ea37
- Creator: https://sketchfab.com/somitsu
- License: https://creativecommons.org/licenses/by/4.0/

Source: the locally licensed Kiboon USDZ assets. Kiboon reduced the texture sizes to 1024 pixels. For Stillwater, AIB Inc. imported them into Blender, evaluated the rest meshes, normalized their axes and scale, and exported GLB. The original rig animation is not included in these web exports. Stillwater supplies its own GPU body/fin deformation and swimming paths, adjusts material normal strength/lighting/alpha, and omits the outer cornea during web rendering. No endorsement is implied.

The fish assets retain CC BY 4.0. Application code remains GNU GPL v3 © 2026 AIB Inc. https://www.aib.vote.

`jikin-neutral-v1.glb` is an additional AIB modification of the same somitsu Jikin
asset: neutralized the baked lateral body/head rig pose, rebaked the weighted
meshes, normalized orientation/size, and recalculated normals. Original texture
bytes are preserved. This derivative also retains CC BY 4.0.

## Newly supplied fish

Ryukin and Shubunkin meshes/textures: **somitsu**, CC BY 4.0. Supplied locally as `Ryukin goldfish.blend` and `Shubunkin  Common goldfish.blend`; author and license are explicitly stated in each file's `Text` block. Creator: https://sketchfab.com/somitsu. The original model files are not claimed as AIB work.

AIB modifications: evaluated rest meshes, disabled cloth evaluation, axis/size normalization, 1024-pixel copied textures, simplified transmission, web material adjustments and custom GPU swimming. All fish now retain the authored source pattern, without per-instance pigment recoloring. No endorsement implied.

## Montane Brown Frog

Original model by **ffish.asia / floraZia.com**, https://sketchfab.com/ffishAsia-and-floraZia, **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/.

Supplied derivative: `2 Realistic Frogs Rigged.blend`. User-supplied provenance describes cleanup/mesh editing, baked lower-resolution textures, and added Rigify rigs. The derivative editor's name was not supplied. AIB extracted the Montane Brown Frog (F), evaluated a static rest pose, normalized scale/axes, reduced texture dimensions, and added web skin grain, subdued breathing and contact shading. Original rig animation is not included. No endorsement implied.

The frog model and textures retain CC BY 4.0; application code remains GPL v3. The unused procedural `frog.glb` and earlier `stillwater-frog.blend` study are AIB-authored GPL v3 and are not the currently displayed frog.

## Frog hopping poses (2026-09-30)

`montane-frog-hopping.glb` uses the same CC BY 4.0 Montane Brown Frog mesh/textures. AIB used the supplied Rigify deform vertex weights and hip/knee/shoulder/elbow positions to author four new morph targets: Crouch, Kick, Tuck and Reach. These are AIB-authored poses blended by the web hop controller, not original animation clips. The original rest GLB is retained as an earlier source asset. Source script: `scripts/create-frog-hop-poses.py`; isolated editable scene: `assets/frog-hop-poses.blend`.


## Supplied monarch butterfly — 2026-09-30

`monarch-butterfly.glb` is the user-supplied `monarch butterfly 3d model.glb`, copied byte-for-byte. The embedded generator is Tripo; the file does not contain an author or license declaration. This model is not covered by the application's GPL grant or the other animal models' CC BY notices. Provenance/redistribution terms remain to be supplied before public distribution.

AIB runtime work: normalize the pitched +X body to -Z forward, retain the original UV/color/normal/roughness maps, and apply weighted wing rotation with matching normals. Two small instances share one geometry and the texture maps, with independent wing strokes, gliding intervals and flight paths. The source file has no rig or animation clips; web motion is authored by AIB Inc.

Additional AIB web modifications: weighted flight leg folding, pre-contact leg extension, eased lily-pad landing/rest/takeoff, and leaf-transform tracking. Source mesh, texture files and attribution remain unchanged.

## AIB Pearl Vermilion goldfish — v5 (2026-09-30)

`aib-goldfish-v5.glb`: © 2026 **AIB Inc.**, https://www.aib.vote, GNU GPL v3. Source: the supplied `AIB_Goldfish_20260930/Goldfish_Pearl_Vermilion_ScaleRelief_v5.blend`, the latest numbered version in that folder.

Web conversion: bake the authored body/scale pigment to textures; preserve the v5 raised-scale geometry; simplify body, fin membranes and rays; normalize nose-to-tail length to 2.2; omit clear outer corneas and export a neutral pose. Tail transparency is baked from the original material mask. Blender-specific optical shaders and rig animation are replaced with glTF materials and Stillwater GPU swimming. 32 source meshes, 158,597 triangles, 8,416,504 bytes. Original Blender file remains unchanged.

Eye repair: `aib-goldfish-v5-cornea.glb` restores the two original curved corneal meshes from the same AIB v5 source (GPL v3). Runtime uses transparent reflection highlights, restores linear sampling for the original iris, and treats the grayscale scale-growth image as bump height.

## Supplied refined wooden architecture — 2026-09-30

`wooden-bridge-refined-v1.glb` and `wooden-gazebo-refined-v1.glb` are web derivatives of the user-supplied files in `assets/Wooden_Bridge_Refined` and `assets/Wooden_Gazebo_Refined`. The supplied GLBs identify Blender as exporter but do not embed original creator/license information. Their source rights are separate from the application GPL license.

AIB web preparation retains geometry, UVs and material groups, resizes texture maps to 2048 pixels, embeds WebP textures, and adds placement, shadows and water reflections. Original Blender/GLB files are preserved.

## Supplied hydrangea — 2026-09-30

`hydrangea-garden-v1.glb` derives from the user-supplied `assets/hydrangea flower 3d model.glb`. Its embedded generator is Tripo; no creator or license declaration was supplied. This asset is not covered by the application's GPL grant or the animal models' CC BY notices. Original provenance and redistribution terms remain unspecified.

AIB web modifications: Blender geometry reduction into close/distant levels, smooth normals, merged meshes, padded color/normal/roughness atlases, WebP packing, instanced garden placement, flower-only color variation and gentle GPU wind. Original GLB remains unchanged. Preparation scripts and details: `docs/pond/HYDRANGEA.md`.

## Supplied pink azalea — 2026-09-30

`azalea-garden-v1.glb` derives from the user-supplied `assets/pink azalea 3d model.glb`. Embedded generator: Tripo; original creator and redistribution license are unspecified. This asset is separate from the application's GPL grant and other models' CC BY notices.

AIB web modifications: isolated Blender reduction to near/far meshes, normalized sprig scale, preserved source UV/pigment detail, padded color/normal atlases, WebP packing, instanced shrub placement, restrained petal tint variation and GPU sway. Original source GLB unchanged. Reference photograph by Anncy on Crowdpic was used for arrangement inspiration only and is not included. Details: `docs/pond/AZALEA.md`.
