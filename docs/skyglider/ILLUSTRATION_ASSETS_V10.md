# Skyglider — water and flower illustrations (v10)

Created 2026-10-03 with the built-in OpenAI image generation tool (`image_gen.imagegen`). Four distinct new production assets; no new dependency or external API key. PNG originals are retained. Project copies use `cwebp -q 88`; transparency is preserved for waterfall and flower sprites. Original illustrations © 2026 AIB Inc. (https://www.aib.vote), GPL-3.0-only; external CC0 notices remain unchanged.

The ocean tile supplies world-space painted water color; animated normals and terrain-derived shoreline foam remain 3D. The isolated waterfall sprite overlays a continuous terrain-fitted cascade, with shader-driven grain and impact spray. Meadow ground color blends into the terrain without separate overlapping ground quads; crossed flower cards are drawn only nearby (65m enter /85m exit), while the painted ground remains visible at distance. These images are environment textures, not screenshots or measurements. Actual application evidence is under ignored `docs/validation/skyglider/`.

## ocean-ripples-v1

- Original PNG: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-67ccc79b-867b-4ff3-8692-992c36399591.png`
- Final saved asset: `projects/skyglider/public/assets/illustrations/ocean-ripples-v1.webp`
- Resolution 1254 × 1254; 286,922 bytes.
- SHA-256: `c99c1d51e96d5df5909460d5cbddcccb6bea133a964df66220be2441becff308`
- Transparent background: false.

Final prompt (verbatim):

```text
Use case: stylized-concept. Asset type: seamless square top-down ocean surface albedo texture for a 3D illustrated alpine valley. Entire image is gently moving turquoise and muted sea-teal water, with beautiful fine painted wavelets, elongated subtle ripples and a few soft pale aquamarine caustic highlights. Delicate painterly natural texture, restrained semi-realistic hand-painted game environment, visually compatible with muted blue alpine mountains and emerald forest. Uniform overhead orthographic view with no horizon, no sky, no coast, no islands, no boats or objects, no letters or border. Gentle lateral variation but no huge dark patches, no white breaking surf, no large foam lines. No cast lighting or perspective baked in. Perfectly seamless horizontal and vertical tiling, matching opposing edges. Rich detail but calm water, moderately dark teal midtones, soft low contrast highlights; the engine will add actual reflections and animated normals. Produce only the usable texture, no mockup.
```

## waterfall-veil-v1

- Original PNG: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-efc016c7-cd15-4da8-9629-b4c68f879e70.png`
- Final saved asset: `projects/skyglider/public/assets/illustrations/waterfall-veil-v1.webp`
- Resolution 724 × 2172; 684,906 bytes.
- SHA-256: `3cbd5812323c49ab02a5ae9a3da818ce74c72195c848be253944a1cf429d2424`
- Transparent background: true.

Final prompt (verbatim):

```text
Use case: stylized-concept. Asset type: tall 1:3 transparent waterfall water-stream sprite texture for a 3D alpine waterfall, no cliff or backdrop. Only the falling water: irregular narrow milk-white and pale aqua filaments cascade vertically from the upper edge, subtly separate into wispy airy streaks and droplets on the way down, gradually break up into a soft diffuse plume of spray near the lower edge. Graceful taper and naturally uneven side edges, genuine transparent holes between water filaments and true transparent background around the sprite. A softly painted semi-realistic game environment texture with fine convincing fluid streaks, soft pale cyan shaded areas and warm ivory highlights, flowing water rather than smoke or hair. No hard rectangular edges, no symmetrical curtain, no rocks, scenery, pool, ground, sky, words or watermark. Most opaque near the upper-center streaming water, softer and fragmented toward bottom and edges. Fully isolated actual alpha cutout, pure water only, useful layered over animated shader ripples.
```

## wildflower-tuft-v1

- Original PNG: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-b1e4ecbb-7803-48c1-bf30-ac3058d4c9e3.png`
- Final saved asset: `projects/skyglider/public/assets/illustrations/wildflower-tuft-v1.webp`
- Resolution 1536 × 1024; 489,454 bytes.
- SHA-256: `25aa4fba4b87ca71edf1e918361acec8f025d476f22aca9a9495727a170ad54a`
- Transparent background: true.

Final prompt (verbatim):

```text
Use case: stylized-concept. Asset type: isolated wildflower meadow tuft sprite for crossed flat cards in a 3D alpine valley, landscape 3:2 composition. One airy irregular low patch of alpine meadow flowers with many small ivory daisies, a few pale golden buttercups and soft lilac bluebells, slender stems and delicate sage green grasses. Restrained semi-realistic painted natural game environment texture, fine convincing petals and botanical detail, soft daylight from upper left, subdued emerald/sage/cream/lavender palette compatible with painted teal alpine mountains. Full clump completely inside frame, low wide asymmetrical silhouette, no giant single flower, dense enough to read as a meadow patch but with genuine small transparent gaps between stems. Three quarter side view with a slight view down onto blooms, stems rise from a narrow bottom band, little height variation, no ground plane or background. True transparent background, no frame, no border, no text, no watermark, no cast shadow outside the tuft. This is a production foliage texture, not a screenshot.
```

## wildflower-meadow-v1

- Original PNG: `/Users/yuhitomi/.codex/generated_images/01a0fc3e-5c40-7c43-9f5a-4a66dded1fa1/exec-607162f9-506d-4fe2-ac1f-af42b736c54d.png`
- Final saved asset: `projects/skyglider/public/assets/illustrations/wildflower-meadow-v1.webp`
- Resolution 1254 × 1254; 713,604 bytes.
- SHA-256: `9a992bca18e9cad52bf497b8d08bcf3001bac5a09ef11ddbb43daa6e47597160`
- Transparent background: false.

Final prompt (verbatim):

```text
Use case: stylized-concept. Asset type: seamless square top-down wildflower meadow ground texture for a 3D alpine valley. Beautiful restrained semi-realistic hand-painted meadow carpet, sage and olive grasses mixed with tiny wildflowers: many ivory daisies, occasional pale golden buttercups and soft dusty lavender blooms. Fine textured blades and tiny scattered petals, irregular organic small clusters and natural gaps of earth and moss, viewed perfectly overhead orthographically with no perspective, no stems standing toward camera, no horizon, no objects, no rocks, no giant flower. Sparse tiny flowers only, at a realistic small scale relative to grass; muted fine pattern rather than garish polka dots. Soft diffuse neutral lighting, no directional cast shadows or bright white glare. Perfectly seamless tiling on both axes, opposing edges match in color and texture. Painterly convincing natural ground detail compatible with emerald forest and teal alpine mountains. No text, no watermark, no frame. Entire image is usable texture.
```
