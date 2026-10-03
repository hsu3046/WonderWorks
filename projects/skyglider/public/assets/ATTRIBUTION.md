# Skyglider — asset credits

Original code, procedural glider, terrain, architecture and interface: **© 2026 AIB Inc. (https://www.aib.vote)**, GNU GPL v3. The license does not replace the licenses of third-party assets.

The following assets are from [Poly Haven](https://polyhaven.com), released under [CC0 1.0](https://polyhaven.com/license). Verified 2026-10-02. Download URLs, file sizes and SHA-256 hashes are in `manifest.json`.

| Asset | Author(s) | Use / changes |
|---|---|---|
| [Tree Bark 03](https://polyhaven.com/a/tree_bark_03) | Rob Tuytel | 1K color/normal maps on the departure tree and wooden bridge. |
| [Rock Face](https://polyhaven.com/a/rock_face) | Greg Zaal, Dario Barresi | 1K maps, triplanar mapping, reduced red saturation and added slope-dependent moss. |
| [Rock Wall 08](https://polyhaven.com/a/rock_wall_08) | Amal Kumar | 1K color/normal maps on the original castle geometry. |
| [Forest Ground 04](https://polyhaven.com/a/forest_ground_04) | Rob Tuytel, Rico Cilliers | 1K maps blended on the upper terrain slopes. |
| [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) | Rob Tuytel, Rico Cilliers | Twig color and alpha atlas only; UV regions selected for the original lightweight pine geometry. The 478 MB model is not included. |
| [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel, Rico Cilliers | Original glTF and 1K textures, normalized and instanced near the departure tree. |
| [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) | Kless Gyzen | Original glTF and 1K maps, normalized and instanced near the departure tree. |
| [Island Tree 02](https://polyhaven.com/a/island_tree_02) | Rob Tuytel, Rico Cilliers | Original 1,072,213 triangles simplified to 28,278; all three materials retained. Textures resized to 512px WebP. Opaque geometric leaves. Processing details in `island_tree_02/processing.json`. |
| [Kloofendal 48d Partly Cloudy — Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | Greg Zaal, Jarod Guest | Original 2K HDR sky and image-based lighting. |
| [Aerial Rocks 01](https://polyhaven.com/a/aerial_rocks_01) | Rob Tuytel | Retained research texture set. |

The glider skin (`squirrel-v3.glb`), 14-bone rig, groom and details are original work by **AIB Inc.**, GPL-3.0-only. Its reproducible authoring source is `scripts/build-squirrel.mjs`. No commercial character model was purchased or redistributed. The supplied film and squirrel reference images are not bundled with this project. The CC0 download manifest covers external environment assets, not this original GPL character.

Three.js: MIT, copyright its authors. Cormorant Garamond and Manrope are loaded through Google Fonts under their respective SIL Open Font Licenses. Authoring-only meshoptimizer: MIT, © Arseny Kapoulkine. Original third-party notices remain in the dependencies and source assets.

The three environment illustrations in `illustrations/` are original assets created for this project with the built-in OpenAI image generation tool: alpine panorama, distant oak sprite and oak foliage cluster. **© 2026 AIB Inc. (https://www.aib.vote)**, GPL-3.0-only. Converted from generated transparent PNG originals to alpha-preserving WebP. Prompts, source paths and deployed sizes are recorded in `docs/skyglider/ILLUSTRATION_ASSETS.md`; the external CC0 manifest does not cover these authored illustrations.

The v10 illustrations are also original built-in OpenAI image generation assets: `ocean-ripples-v1.webp`, `waterfall-veil-v1.webp`, `wildflower-tuft-v1.webp` and `wildflower-meadow-v1.webp`. **© 2026 AIB Inc. (https://www.aib.vote)**, GPL-3.0-only. Original PNGs retained; project copies converted to WebP with sprite alpha preserved. Full prompts, saved paths, sizes and hashes: `docs/skyglider/ILLUSTRATION_ASSETS_V10.md`. These original assets are separate from the Poly Haven CC0 manifest.

The v11 `coastal-forest-v1.webp` is an original built-in OpenAI image generation asset, **© 2026 AIB Inc. (https://www.aib.vote)**, GPL-3.0-only. It supplies canopy/moss/rock paint on the distant coastal foothills. Original PNG retained; production copy converted to WebP. Prompt and saved paths: `docs/skyglider/ILLUSTRATION_ASSETS_V11.md`.

The v12 runtime backdrop `alpine-coast-panorama-v2.webp` is an original built-in OpenAI image generation edit of the original mountain panorama, **© 2026 AIB Inc. (https://www.aib.vote)**, GPL-3.0-only. It integrates the mountains, coastal forest, rocky headlands and islands. Alpha preserved in WebP; input/output PNGs retained. Full prompt, source/output paths and hash: `docs/skyglider/ILLUSTRATION_ASSETS_V12.md`. The v1 panorama and v11 canopy are retained for provenance and are no longer loaded.


## User-supplied local scenery — 2026-10-03

The files in `local/` are web derivatives of the user's Wonderworks asset library. Bridge and gazebo derive from `assets/Wooden_Bridge_Refined/Wooden_Bridge_Refined_v1.glb` and `assets/Wooden_Gazebo_Refined/Wooden_Gazebo_Refined_v1.glb` (Blender exporter). Cherry, house, castle and butterfly derive from the supplied cherry-tree, whimsical-house, fantasy-castle and monarch-butterfly GLBs (Tripo exporter). Hydrangea and azalea reuse the user's flower models through the existing Pond project's atlas and distant geometry derivatives, then repack those maps to 1K WebP. `meadow.webp` and `leaf-floor.webp` are format conversions of the supplied `meadow-ground-v1.png` and `foliage-autumn-ground-v1.png`.

These supplied models do not embed a creator or redistribution license. Their source rights remain separate from the application GPL and the Poly Haven CC0 assets; conversion does not expand rights. Existing source files are unchanged. Runtime placement, grounding, batching, shader integration and the offline preparation code are original AIB Inc. work. Source paths, SHA-256 checksums, geometry counts and conversion sizes: `local/processing.json`. Rebuild: `scripts/prepare-local-scenery.mjs <original Wonderworks directory>`.
