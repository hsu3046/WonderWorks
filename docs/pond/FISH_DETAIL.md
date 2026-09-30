# Fish detail revision — 2026-09-29

The user found the initial procedural fish awkward and requested the Blender implementation in Kiboon as a reference. Kiboon's actual fish assets are somitsu's Jikin and Tosakin goldfish, licensed CC BY 4.0. Its Blender-authored maple leaf is a separate asset; the fish were not originally authored by AIB.

The initial fish had a bulbous generic body, flat polygon fins, embedded eyes and procedurally painted scales. Stillwater now uses the detailed fish assets themselves, imported from the local Kiboon USDZ files in Blender 5.2.2 LTS and exported as normalized GLBs. The original Kiboon files were read only. Existing Blender startup objects remain in their original scene; the new work lives in `AI_Stillwater_Fish_20260929`.

- 14 Jikin and 14 Tosakin replace 28 procedural koi. UI/catalog now describe goldfish correctly.
- Body shape, mouths, gill seams, eyes, fin rays, pigmentation, and scale normal maps come from the authored models.
- Web normal strength is reduced to 0.36 for skin / 0.30 for fins so scales do not read as hard metallic plates.
- Opaque bodies and thin alpha fins are separated, with material/mesh batching and instancing. The outer transmission cornea is omitted to avoid extra scene refraction passes; iris and black lens remain.
- Blender USD import retained skeletons but produced no animation actions. GLBs contain evaluated rest meshes; independent GPU bending and fin flex are authored for this scene, with fixed attachments and per-fish phase differences. This is not the original skeletal animation.
- GLBs total 6,999,888 bytes. No new package installation. Shared frame time preserves pause, visibility and preview behavior.
- Working Blender copy: `projects/pond/assets/stillwater-fish.blend`. CC BY credits, source URLs, modifications, and original license notices: `projects/pond/public/models/`.

Validation and screenshots: `docs/validation/pond/fish-detail/`.

## Jikin neutral-pose correction — 2026-09-30

The original Jikin export was **not a neutral rest mesh**: its source armature had
15°, 20°, 25° and 30° of cumulative lateral pose rotation on bones n33–n36.
Increasing the runtime swim amplitude could not remove that baked C-shaped body.

`jikin-neutral-v1.glb` now replaces Jikin alone at load time. In the isolated Blender
scene `AI_Jikin_Neutral_20260930`, the original weighted source meshes from
`assets/stillwater-fish.blend` were evaluated after zeroing the lateral Z rotation
of n33–n36 and lateral Y rotation of n32/n84. Translation, scale, vertical posture
and all fin poses were retained. The original source-to-web transform was recovered
from matching body vertices (maximum fit error 1.54e-7). All ten parts were rebaked,
aligned to +X forward, centered laterally, and normalized to the existing 2.2-unit
length. Stale posed custom normals were reset to automatic smooth normals.

Validation: body lateral midpoint error below 0.00042 normalized units across seven
body slices; finite exported positions/normals; ten mesh parts retained; embedded
texture bytes match the original GLB. Strict TypeScript/build and browser rendering
passed without console errors. The existing swimming shader, species scale, colors
and instance count remain unchanged; no new per-frame work. The original GLB and
source Blender file are retained. The user's gazebo scene/view was restored.

Screenshot: `docs/validation/pond/jikin-neutral/dive.png`.
