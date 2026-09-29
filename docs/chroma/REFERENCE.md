# Chroma Motion — reference evidence

User asks for reproduction plus a configurable family of effects. Input: local j5gqpNdPz7Rb898l.mp4, 720×720 H.264 at 24fps, duration 15.557s. Contact sheets: docs/validation/new-effect/reference-sheet.jpg and reference-motion.jpg.

## Observations

- Pure black ground; no visible interface or user input.
- Around 0–1.5 seconds: three contiguous cylinders vary in height and tilt; elliptical caps face and turn away from the camera.
- Around 1.5–2.8 seconds: broad overlapping surfaces bend/twist into a ribbon with warm/cool opposing gradients.
- Around 2.8–4.5 seconds: a wide cylinder tilts; caps lift apart from the sleeve. A new tall-column arrangement follows.
- Soft pink/lilac/coral gradients against saturated violet, cyan and pale green. Fine texture is visible.
- Similar arrangements recur across the ~15.5-second clip.

## Reconstruction choices (not claims about original implementation)

Single WebGL2 renderer. Analytic transforms animate cylinders and discs; a vertex shader deforms ribbons; fragment shaders provide smooth directional colour fields and cap shading. A 15-second sequence uses separate five-second arrangements and a short scale transition. This is a visual reconstruction, not pixel-identical motion recovery.

Orbit and wave are additional arrangements. Palette/tempo/elasticity/twist/count/grain/scale/phase controls make the technique reusable. Pointer orbit and responsive controls are new interactions; the recording offers no evidence of original controls. Original audio/assets are not included.
