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
