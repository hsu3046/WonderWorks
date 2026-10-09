# Bloom Studio — 2026-10-09

© 2026 AIB Inc. — GNU GPL v3.

## Reference observations

The supplied24.25-second recording shows a white-canvas bouquet in a blue ceramic vase; a tap spreads the blooms into a frontal QR code and a second tap gathers them. The upper-right tools include a URL, three flower choices, colour presets and download/copy actions. Samples at0/4/8/12/16/20seconds confirm bouquet/QR states, colour changes and URL edits; exact source geometry, easing and decoder success cannot be inferred from the recording. No source video assets are redistributed. UI credit: Inspired by @ann_nnng, as requested for the same creator in the preceding study.

Our implementation uses four original vase bouquets: roses, daisies, tulips and dahlias. The initial meadow, parterre and water garden were replaced following user feedback. Cream paper, restrained serif typography and miniature botanical illustrations replace the reference's branding. Port4185; independent package, branch codex/bloom-qr.

## Ownership

- state.ts: normalized http/https URL (no credentials, maximum180UTF-8 bytes), H-level QR matrix, bounded template/palette and fragment serialization.
- garden.ts: Three.js renderer, original parametric petal geometry, instanced blossoms/centres/stems/leaves, ceramic lathe and procedural props. Smooth flower positions/quaternions/sizes into QR modules, fixed frontal QR camera, damped OrbitControls in garden state. Uniform unlit material at the QR endpoint prevents internal shadow/highlight contrast from defeating adaptive thresholding. Stops RAF when settled without wind, stops on hidden documents, disposes GPU/input resources on HMR. Native touch scroll/pinch with small-tap vs drag distinction.
- qr.ts: deterministic raster QR with four-module quiet zone and subtle dark-on-dark petal relief; jsQR decode validates exact normalized destination before export.
- main.ts: synchronous UI state and transitions, URL validation, palette/template controls, clipboard sharing and verified PNG export. No uploaded files, server, API credentials or remote URL fetches.

## Dependencies and validation

User explicitly approved local installation of qrcode/jsqr. Existing Three/TypeScript/Vite versions match Foil; each dependency installed inside this project, package-lock committed when releasing. npm audit reported0vulnerabilities at installation. No global installations.

Strict build and decoder regressions passed. Decoder tests cover four palettes, normalized Korean paths/query strings and a long bounded URL; invalid settings/protocol/credentials/overlong input rejected. Browser: all four scenes inspected, default 3D QR decoded successfully, changed URL verified, PNG downloaded to bloom-moon-qr.png. Shadow renderer updated to r186 PCFShadowMap after the runtime reported removed PCFSoftShadowMap. Build warns about the combined Three/decoder chunk; no claim of real-phone scan/print testing. Validation captures in ignored docs/validation/bloom.

Final browser checks:390px mobile has no horizontal overflow; mobile 3D QR and download both decode to the configured URL. Shared moon/lilac fragment restored both settings after reload. Browser error log empty. Scene endpoint pauses RAF; wind-disabled idle scenes resume through OrbitControls change/resize/update. Real-device camera and printing remain untested.

## QR spacing and colour refinement

The QR stage previously extended behind the caption. QR mode now reserves a separate caption/footer band on desktop and mobile. At1352×695 the stage ends25px above the caption, with additional QR quiet space inside the canvas.

Scene and PNG modules share a diagonal botanical gradient for rose, terracotta, lilac and sage palettes. Weighted luminance is capped at108 before the export petal relief so light modules remain detectable by adaptive thresholding. All four palettes passed browser decoding of both the rendered3D QR and exported raster; the four-palette/three-URL decoder regression and strict build passed. Screenshot: docs/validation/bloom/qr-refined.png.

## Bouquet collection revision

All four templates now share the porcelain vase and converging bouquet stems. The original rose arrangement remains unchanged. Daisies use thirteen narrow petals and a larger golden centre; tulips use six upright cupped petals without an exposed centre; dahlias use five concentric layers. Flower counts and dome widths vary by species, and thumbnails/name labels reflect the new collection. Numeric share template slots remain compatible.

## Botanical modelling refinement

References: [RHS tulip guide](https://www.rhs.org.uk/plants/tulip/growing-guide/), [RHS dahlia guide](https://www.rhs.org.uk/plants/dahlia/growing-guide/), [RHS gerbera guide](https://www.rhs.org.uk/plants/gerbera). These support cup-shaped tulips, distinct layered dahlia forms and the broad colour range of gerbera-type daisies. Geometry is an original stylized interpretation, not a botanical reconstruction.

Tulips now have taller, narrower cups with rounded petal edges, longer lance-like leaves and staggered stem heights. Daisies use two offset narrow-petal layers; dahlias use six layers with increasing inner petal density. Per-vertex warm shading gives petals gentle depth, enabled only on the garden material so endpoint QR colours remain unchanged. Eight colours per palette are distributed deterministically across flowers, cached per bloom and reused through the morph. Palette swatches show all eight colours.

Validation after botanical refinement: strict TypeScript/Vite build and export decoder regressions passed; browser-rendered daisy, tulip and dahlia QR endpoints plus downloadable rasters decoded successfully.

## Tulip material study

Tulips now use a dedicated physical material with modest transmission (0.16), thin thickness (0.035), high roughness and restrained sheen. A shared procedural bump texture supplies longitudinal micro-ridges; vertex colour deepens the base. This is a stylized thin-petal approximation, not a full subsurface scattering model. Geometry morphs provide stable individual opening weights and asymmetric tips. Curved tube stems and irregular leaf angles soften the arrangement. Tulip colours follow a 60/30/10 main/related/accent distribution with slight per-flower variation; other species retain their mixed palettes. QR endpoints keep their separate unlit material. Morph textures are recreated to match updated module counts and disposed alongside the bump texture.

Validation: strict build and decoder tests pass. Switching tulip → daisy → tulip renders without console errors; both rendered tulip QR and export decode successfully.

## Flower selection polish

Selection cards use generated botanical photos (built-in image generation, four separate original assets), optimized to 480px JPEGs in public/flowers. Names are simply Roses, Daisies, Tulips and Dahlias; supplementary numbers and subtitles were removed. Photos are illustrative thumbnails, not captures of the procedural 3D model. Added Cherry as the fifth palette; restore bounds derive from collection lengths, and decoder/fragment regressions cover the new palette. Removed the decorative leading URL arrow while retaining the submit button.

## Reference-driven bouquet and vase rendering

Generated flower thumbnails guide this procedural interpretation: fewer larger blooms, varied heights, curved stems, larger leaves, layered cupped rose petals, restrained related colours. All petal geometries now have UVs for fine grain and physical material sheen. RoomEnvironment/PMREM supplies studio reflections with explicit GPU disposal. The new ivory vase uses a smooth lathed exterior, continuous thick rim and inner wall, glazed roughness/bump texture, unglazed foot and soft contact shadow. Decorative blue rings/dots were removed to match the reference. These are real-time procedural approximations rather than photo reconstruction. QR endpoint materials remain separate.

## Flower centres

Tulip centres now include six filaments with elongated ochre/brown anthers and a central pistil with three stigma lobes, following [Flora of North America](https://www.efloras.org/florataxon.aspx?flora_id=1&taxon_id=133974). Daisy discs use small raised golden florets instead of a plain sphere. Double roses/dahlias retain petal-covered centres. Centre geometry shares each bloom's position, rotation, scale and wind, and shrinks fully out before the QR endpoint.

## Centre gradient and restrained stamens

Rose/dahlia vertex colours now combine inner-whorl depth and petal-root depth for a darker centre fading to pale tips. Tulips/daisies retain a gentler root-to-tip treatment. Tulip anthers are approximately one third narrower, shorter and lighter warm beige; filaments and pistil sit lower inside the cup. QR material ignores vertex colours, and centres still disappear during transformation.

## Centre pigment correction

Per-instance centrePigment and per-vertex petalDepth now drive a physical-material shader blend: pink/coloured blooms fade toward rose red, white/cream/yellow blooms toward warm gold. This replaces brightness-only shading while leaving pale outer petals and the separate QR endpoint material intact. The pigment buffer is recreated with flower geometry after palette/template changes.

## Tulip foliage and tepal variation

Tulip leaves now use a dedicated upright lance-shaped surface with a curved tip and shallow cupping, attached lower on stems at varied heights. Sparse secondary leaves avoid a dense horizontal collar. Each of the six tepals has deterministic pigment-strength, vertical falloff and lateral blush-width/offset differences, matching the generated reference more closely. Non-tulip leaf placement remains unchanged.

Tulip reference correction: reopened the generated source image. Foliage now has an arched rising base and outward/downturned tip, with distinct upper and lower leaf inclinations; reduced leaf density and increased blade width. Flower cups are taller with smaller top radii and much less opening variation, matching the mostly closed reference blooms.

Tulip proportion adjustment: flower radius rises quickly from the base and stays fuller through its lower half for a rounded cylindrical cup, preserving the narrower opening. Leaf arches rise higher, with less tip drop and a modest upward inclination for lower leaves.

Latest balance adjustment: Roses and Daisies recolour three previously non-accent visible blooms to warm white using stable distributed indices. Tulip cups use a gently convex side profile instead of straight cylinders; leaf arches rise higher while retaining outward curvature.

Tulip leaf directional fix: XYZ Euler composition applied pitch after radial yaw, creating a common world-direction bias. Use YXZ for local tilt followed by radial heading, with outward tip inclination. Four cardinal headings verified equal positive radial tip projection (0.64). Explicitly retain XYZ for other species to avoid shared dummy transform state leaking.

Tulip density correction: reduce foliage from 17 blades to eight, rooted at evenly spaced rim positions, with wider outward arcs. This removes the dense central tuft while preserving tall curved leaves.

## Gallery integration
Study 12 is registered in the shared catalog. Root setup installs Bloom independently (qrcode/jsQR are not in the shared fish toolchain). Build copies the experiment, packages its source ZIP and validates its canonical page and preview assets. Root check includes QR decode tests across all palettes. `?preview=1` hides studio chrome for gallery recording.
