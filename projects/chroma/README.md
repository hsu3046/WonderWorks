# Chroma Motion

A configurable motion study for Wonderworks. Soft gradient cylinders, twisting ribbons and floating discs are reconstructed from a user-supplied visual reference; orbital and wave arrangements extend the idea.

© 2026 AIB Inc. — https://www.aib.vote · GNU GPL v3

## Run

```sh
npm install
npm run dev
npm run build
npm test # Node 22.18+
```

Development: http://127.0.0.1:4176/. `dist/` is a static site with relative asset paths. In this workspace, node_modules reuses the existing Fish toolchain; no packages were installed for this study.

## Play

Choose a movement or let **Original mix** cycle through the reference-inspired scenes. Select a palette, then change tempo, elasticity, twist and multiplicity. Fine adjustments expose grain, scale and phase. Drag the artwork to orbit. Space pauses, R restarts, H hides the interface; buttons provide the same pause/restart controls. Mobile keeps page scrolling and cancels a drag if a scroll takes over.

**Surprise me** remixes the current movement. **Save frame** generates a PNG. **Copy variation link** encodes all parameters in the URL; if clipboard access fails, the URL still updates for manual sharing. Animation position/camera orbit are not included in presets. Reduced motion starts paused.

## Implementation

- Strict TypeScript, Three.js 0.186.0, WebGL2 and custom GLSL.
- Reused cylinder, sleeve, cap and ribbon geometry. Vertex deformation and continuous colour fields; no model or texture download.
- One renderer, one RAF scheduler. Pause and zero tempo stop continuous work; resize/control changes invalidate one frame. Hidden pages stop the scheduler and reset the time delta on return.
- Resolution limited to DPR 2 / 2.2 million pixels. No bloom chain or extra render targets.
- `?preview=1` hides the shell and supports the gallery's same-origin pause/play and ready-frame protocol. Gallery cards use a recorded video, never an automatically running instance.

## Source and reference

The supplied 720×720 MP4 is an observation reference only. It is not bundled, streamed, or redistributed. Geometry, shader code and controls are an original reconstruction, not the source code of the reference. The reference's exact easing, camera and original software are unknown. Its soundtrack is not used. Google Fonts supplies DM Sans and Manrope with local system-font fallbacks. Three.js retains its MIT license.
