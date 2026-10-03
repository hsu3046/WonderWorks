# Skyglider — environment illustration provenance

Created 2026-10-03 using the built-in OpenAI image generation tool (`image_gen.imagegen`), with transparent background enabled. No external API keys, paid stock download or new dependencies. Original PNGs are retained at their generated paths. Project copies use `cwebp -q 90` with alpha preserved; no manual raster retouching.

Original environment illustrations: © 2026 AIB Inc. (https://www.aib.vote), GPL-3.0-only. Third-party CC0 assets keep their own notices in `public/assets/ATTRIBUTION.md`.

The panorama is mapped onto a 128-triangle cylindrical backdrop with three horizontal repetitions. Distant oak trees use crossed cards; the foreground oak uses the separate foliage-only image because cropping the whole-tree sprite exposed trunk fragments and card boundaries. These are authored art assets, not photographs or evidence of the running app. Actual browser screenshots are under ignored `docs/validation/skyglider/`.

## alpine-panorama-v1

- PNG source: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-098521a0-43b7-4fc9-992b-6f750296a319.png`
- Project asset: `projects/skyglider/public/assets/illustrations/alpine-panorama-v1.webp`
- Resolution: 2172 × 724; WebP: 334,890 bytes.
- SHA-256: `2966d8d8d9460486568b821e7b695e3fa83391e65f386b847be23cdeb35bfd6a`

Final generation prompt (verbatim):

```text
Use case: stylized-concept. Asset type: production game distant mountain panorama texture on a cylindrical background, ultra-wide 3:1 landscape strip. Create an exquisitely painted alpine fantasy mountain range in a restrained semi-realistic illustrated style: layered jagged slate-teal foothills, distant luminous blue-gray peaks, subtle warm ivory snow ridges, atmospheric pale cyan haze, rich painterly natural rock texture without graphic outlines. No buildings, trees in the foreground, characters, text or watermarks. Mountains occupy the lower two thirds, entirely transparent sky above their irregular ridge silhouettes, solid mountain color continuing to the bottom edge. Seamless horizontal wrap: both left and right edges must meet with matching ridge height, color and texture, no empty margins. Lighting from upper left, soft cool morning with warm pale snow accents. Keep the colors delicate and muted to harmonize with a lush emerald valley; highest peak only about two thirds of the texture height. This is an actual environment texture, not a screenshot or mockup. Genuinely transparent background around the mountain silhouettes.
```

## oak-impostor-v1

- PNG source: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-3d234a12-4655-4643-8625-bbb358dd5d84.png`
- Project asset: `projects/skyglider/public/assets/illustrations/oak-impostor-v1.webp`
- Resolution: 1254 × 1254; WebP: 719,922 bytes.
- SHA-256: `531b1d86fb480fa8a40505da4bad1c87ee6a3fc89a08924614e72f50aebc6942`

Final generation prompt (verbatim):

```text
Use case: stylized-concept. Asset type: production game tree impostor texture, isolated full mature broadleaf oak tree, square composition. A graceful mature alpine oak with a naturally branching mossy gray-brown trunk, asymmetrical airy clusters of small lush olive and sage leaves, soft sunlit yellow-green leaf edges, deeper muted forest-green shadows, subtle open gaps through its rounded crown. Semi-realistic hand-painted game environment illustration with fine convincing natural foliage texture and no hard outlines. Entire tree from roots to crown contained within the frame, vertical trunk centered, about 25 percent of height as exposed trunk beneath the foliage, no ground plane, no cast shadow outside the tree, no scenery, no sky, no text, no watermark. Lighting from upper left. True transparent background around the tree and through the crown gaps. This will be used at a distance on crossed flat cards and the crown will also provide textured foliage clusters for a 3D oak. Keep silhouette organic and avoid a symmetrical lollipop shape.
```

## oak-foliage-v1

- PNG source: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-b8b6048b-2d75-4458-b2e9-d2de7cf3482c.png`
- Project asset: `projects/skyglider/public/assets/illustrations/oak-foliage-v1.webp`
- Resolution: 1536 × 1024; WebP: 409,812 bytes.
- SHA-256: `1b7aa9981ff9fa384d6cc0b12392b66999bdac1a765e9934e03d4555d1334b28`

Final generation prompt (verbatim):

```text
Use case: stylized-concept. Asset type: production game foliage-cluster texture on a flat card. One isolated irregular airy cluster of many small oak leaves, about twice as wide as tall, all fully contained in the frame with transparent margins. Beautiful semi-realistic painted forest foliage, subtle natural individual leaf texture, varied sage/olive/fern greens, pale warm sunlight on the upper-left leaves, soft green shaded undersides, delicate scattered leaf silhouettes around the edges and small genuine transparent holes through the center. A single leafy tuft from a mature alpine oak crown, no tree trunk, no big wooden branches, no roots, no ground or sky, no scene, no outlines, no text, no watermark. Tiny twig lines may be nearly hidden inside the leaves. Entire cluster surrounded by truly transparent background, no square-cut foliage edges. This is foliage only, not a complete tree; useful as a rounded but asymmetric crown cluster for a 3D branch.
```

Additional water and wildflower assets added in v10: [full prompt set and saved paths](ILLUSTRATION_ASSETS_V10.md).
