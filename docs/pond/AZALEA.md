# Pink azalea shrubs

2026-09-30 — Original web arrangement by AIB Inc.

## Visual direction

User-supplied reference: [Anncy / Crowdpic azalea photograph](https://www.crowdpic.net/photo/진달래-꽃-봄-식물-진달래꽃-7628). Viewed for the dense distribution of small pink open flowers, visible dark branching and green leaves. The reference image is not bundled or used as a texture.

The supplied `assets/pink azalea 3d model.glb` is a flowering sprig with three prominent open blossoms, buds and leaves. It retains its petal markings and source textures. Six woody shrubs use the same open branch/veined-leaf construction as the approved hydrangea bases, with smaller leaves. Each carries72 small sprigs over the top and sides:432 sprigs, about1296 open blossoms plus buds. Four subtle pink/mauve pigment variations affect petals only. Existing26 hydrangea shrubs/520 heads remain unchanged.

Following the user's height/density correction, all six shrubs now form one overlapping, staggered cluster beside the gazebo on its left (x −8.15…−5.3, z−12.1…−9.7). Crown center height rises from0.72 to1.12 and vertical radius from0.62 to0.82: crown tops rise from1.34 to1.94, similar to the hydrangeas. Shared crown anchors move the branches, foliage and flowers together; roots remain grounded. Small flower size, total flower count and instancing/LOD are unchanged. Strict TypeScript/build and browser visual/error checks passed. Updated screenshot: `docs/validation/azalea/gazebo-cluster.png`.

## Asset preparation

- Original:56 material parts,1,867,866 triangles,56,949,308bytes; source file unchanged.
- Blender5.2.2: isolated source/preparation scenes; open gazebo scene and its view restored.
- Near LOD:11,379triangles; Far LOD:3,489triangles. Normalized sprig height1.
- Packed `public/models/azalea-garden-v1.glb`:2,727,532bytes, two merged meshes sharing padded2048px WebP color/normal atlases. Scalar roughness; no unnecessary roughness texture.
- `scripts/prepare-azalea.py` imports into an isolated scene if missing and prepares both levels. It deliberately refuses to rebuild over an existing prepared scene.
- To reproduce, execute that script with `__file__` set to its absolute path in Blender. Select scene `AI_Azalea_Web_20260930`, export named parents `AI_Azalea_Near` and `AI_Azalea_Far` (children included) into `docs/validation/azalea/near.glb` and `far.glb`. Restore the prior scene. Run `python3 projects/pond/scripts/pack-azalea.py` with Pillow available.

## Runtime and cost

`src/azaleas.ts` uses two InstancedMeshes, shared material/textures, per-instance petal tint and GPU sway with matching shadow deformation. Enter near LOD within3.5 units, exit past4.5; only upload matrices/tints when membership changes. Existing scene loop, pause/visibility and disposal handle the new meshes. Explicit above-water metadata excludes flowers from underwater refraction.

Initial1280×720 Garden:432 far sprigs,1,507,248flower triangles. Main draw calls181→182; refraction remains157, reflection225→227 including shadows. Extra shrub base geometry48,780triangles. This is additional geometry, not a measured FPS improvement; instancing and reduction avoid hundreds of full source copies.

Strict TypeScript/production build and browser visual/console checks pass. Local screenshots/diagnostics are under `docs/validation/azalea/` (ignored). No dependency install, source upload or deployment.

## Attribution

Embedded generator:Tripo. Original creator/license is unspecified in the supplied GLB. The application GPL grant does not license this external source asset; see `public/models/ATTRIBUTION.md`. AIB preparation scripts/runtime are GNU GPL v3, ©2026 AIB Inc. (https://www.aib.vote).
