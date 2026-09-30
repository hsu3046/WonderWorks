# Supplied Blender assets

The runtime uses GLBs and does not require Blender. `prepare-supplied-assets.py` is an optional conversion script, run in Blender's Python editor after appending the following objects into a new scene. Do not run embedded scripts from the source files.

- `AI_Stillwater_Asset_frog`: from `2 Realistic Frogs Rigged.blend`, append `Montane Brown Frog (F).lower`, `Eye.Right.Smaller.Frog`, `Eye.Left.Smaller.Frog`, and `rig`.
- `AI_Stillwater_Asset_ryukin`: from `Ryukin goldfish.blend`, append `body`, `fin*`, `eye*`, `RIG_Ryukin` and its referenced targets.
- `AI_Stillwater_Asset_shubunkin`: from `Shubunkin  Common goldfish.blend`, append `body`, `fin*`, `RIG_Shubunkin`.

Set the active scene's `prepare_species` custom property to `frog`, `ryukin` or `shubunkin` and run the script once. It creates a separate `AI_Stillwater_Web_*` scene, leaving the input files untouched. Export that scene as GLB, applying modifiers, without animations. Frog output is `montane-frog.glb`; fish outputs use the species names.

For fish mesh preparation, the script evaluates Blender modifiers in a rest pose, with cloth simulation disabled. Web animation is independent GPU deformation. See `public/models/ATTRIBUTION.md` for licensing. The large original user-supplied blend files are kept in the workspace's root `assets/`, not duplicated into this standalone source download. The earlier `create-frog.py` / `detail-frog.py` and `assets/stillwater-frog.blend` are an unused procedural study.

## Frog limb poses

After the frog asset and normalized web scenes exist, run `create-frog-hop-poses.py` in Blender. It checks vertex correspondence, creates `AI_Stillwater_FrogHop_20260930`, and copies meshes before adding four morphs using original rig weights/joint positions. Explicit `from_mix=False`, zero weights, and basis-coordinate initialization prevent accumulating earlier pose shapes. Export the three new objects with shape keys enabled and `apply_modifiers=False` to `montane-frog-hopping.glb`. `assets/frog-hop-poses.blend` contains the isolated generated pose scene. Set all pose values to zero for export. No source Rigify UI script is executed.

## AIB goldfish v5

Append only `GF_Goldfish_Asset` from `assets/AIB_Goldfish_20260930/Goldfish_Pearl_Vermilion_ScaleRelief_v5.blend` into isolated scene `AI_Pond_Goldfish_v5_Export`. Disable copied Subdivision/Solidify modifiers and fin shape-key animation; zero WaterFlow keys while retaining Scale_Relief=1. Run `export-aib-goldfish.py` once, then `finalize-aib-goldfish.py` once in Blender Local. Both restore the previously active scene; do not save over the source file. The first stage refuses an existing output, and the second finalizes that output. Do not rerun simplification on already simplified meshes.

The scripts bake authored pigment and caudal opacity, preserve raised scales, and export static meshes for GPU swimming. Export **both** `use_selection=True` and `use_active_scene=True`: selection alone can include selected meshes from other open scenes. Final GLB must contain exactly one scene with 32 meshes. Source SHA-256: `138d45dd9d3a74aca9e91e14125b3642457dae028a49b064e6830e90d7eb7d90`.
