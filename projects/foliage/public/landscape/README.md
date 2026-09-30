# Illustrated meadow

© 2026 AIB Inc. (https://www.aib.vote). GNU GPL v3.

`meadow-ground-v1.webp` is the original Wonderworks meadow illustration reused from Stillwater: 1254 × 1254, 685224 bytes. Created with the built-in image generator on 2026-09-30; source PNG `assets/meadow-ground-v1.png`. The generation prompt and provenance are recorded in `projects/pond/public/landscape/MEADOW_GROUND.md`.

The painted grass, clover and moss tile is diffuse color only, in sRGB. World-space UVs repeat at 0.34 cycles/unit using mirrored wrapping, mipmaps and anisotropy up to 16. Seasonal shaders add autumn dry-grass color and cover the illustration with snow. Existing lights, shadows and fog affect the terrain. No extra drawing pass or animation loop.

The distant forest does not need an additional image download: four views of the hero tree are baked into an atlas once, with separate wood/leaf layers. 240 staggered cards keep the 360° forest and seasonal bare branches. This replaces the former 1100-card distribution.
