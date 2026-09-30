# Kiboon Momiji foliage — 2026-09-30

The pond maple now uses AIB Inc.'s original Blender-authored Momiji v7 from
`/Users/yuhitomi/Documents/Xcode/Kiboon/assets/Momiji/momiji-mesh-v7.json`.
The checked-in `src/data/momiji-v7.json` is an exact copy of that indexed export:
296 vertices / 356 triangles, seven serrated lobes, curved petiole, and linear
vertex pigments transitioning from red at the palm to gold at the tips.
Kiboon's original `.blend`, JSON and application remain unchanged.

`maple-leaf.ts` maps the source XY blade plane to the garden XZ plane, anchors the
petiole at the branch and normalizes full length to 0.6215 units (55% of the previous 1.13-unit leaf).
Whole-leaf UVs preserve root-to-tip wind weighting in both color and shadow passes;
a separate blade coordinate attribute supplies subtle antialiased veins. Instance
tints are near white. Following the user’s size/color correction, blade/palm pigments
retain 28% of their authored variation around the shared red base; the yellow
tips become a subtle warm red-orange. The brown petiole is not recolored. Tree anchors and the original random sequence remain unchanged. A subsequent
fullness adjustment adds 1,016 leaves with an independent random stream (3,286
total, about45% more), retaining the smaller size and softened pigment.

One shared indexed geometry/material and the existing instanced draw are retained.
No textures, loader, extra draw calls or animation loop are added. Geometry cost
does increase from 38,590 to 1,169,816 triangles for the maple per submitted pass;
this is a detail replacement, not a claimed performance improvement. Compressed
main bundle grows about 26 KB. Fine veins fade at small screen footprints.

Validation: source byte equality, array lengths, index bounds, finite coordinates,
strict TypeScript and production build passed. Browser visual check and console
error check passed. Screenshot: `docs/validation/pond/maple/fuller-soft-red.png`.

Original asset and adaptation: © 2026 AIB Inc. (https://www.aib.vote), GPL v3.
