# Inside wedding portrait

Generated 2026-10-09 with the built-in image generation tool; a fictional Korean adult couple, not a real couple's photo. Source copied unchanged to projects/foil/public/templates/korean-wedding-portrait.png (1086×1448). Used on the inward face of every card cover, with a warm white mount and contain-fit sizing. The portrait follows the hinge, appears on the left when open, and is hidden when closed. Right-side letter and cover foil are unchanged. No image upload service, new dependency, or share payload change.

Texture uses sRGB and the existing paper lighting; materials/textures are disposed with the renderer. Build passed; browser verified open portrait, landscape contain-fit, return to Original and no console errors.

## Final prompt

Use case: photorealistic-natural. Create an elegant editorial wedding portrait of a fictional Korean adult newlywed couple, both around 30 years old, no resemblance to any specific real person. Vertical portrait 3:4. Bride in an ivory silk wedding gown with subtle lace and a sheer veil, holding a small bouquet of white flowers; groom in a classic black tuxedo and white shirt. They stand close together, gently smiling with natural affection, looking toward the camera, waist-up with hands and bouquet visible, anatomically correct. Refined sunlit Korean wedding studio with soft ivory drapery and faint garden greenery out of focus. Warm natural daylight, real skin texture, delicate film grain, understated luxury wedding photography, natural Korean facial features, no beauty-filter plastic skin. Compose both heads comfortably inside the middle 70% of frame with generous margins for a printed album photo. This is a photograph to insert inside a folding greeting card, NOT a picture of a card or album. No text, no logos, no border, no watermark.

© 2026 AIB Inc. — GNU GPL v3.


## Glossy print finish — 2026-10-09

User requested gloss on the photo. Portrait alone now uses MeshPhysicalMaterial with nonmetallic ink (roughness.55), clearcoat.65 / coat roughness.13, explicit PMREM intensity.3 and fine bump.0004. This adds view-dependent photographic coating reflections without changing paper, letter, foil, source image or restored original rotation. Build/type checks passed; browser confirmed moving reflections on rotation and no console errors. Coating intensity reduced after visual inspection to retain face visibility.
