# Prism Studio

Study 013, standalone at `projects/prism`, port 4186. Original implementation © 2026 AIB Inc., GPL v3. Existing pinned Three.js/TypeScript/Vite toolchain, no new dependencies.

## Input and rendering

- File picker, drag/drop, and direct HTTP(S) image URL. Remote loading uses browser CORS, credentials omitted and no referrer. There is no image proxy or storage service.
- 20 MiB encoded limit including streaming responses without content-length, 20-second fetch budget, 15-second decode guard, max 80 MP decoded dimensions, 1800-pixel texture resize. Formats: JPG, PNG, WebP, AVIF, GIF (one decoded frame).
- Every replacement owns a generation and abort controller. Only the latest successful decode replaces the texture. Old or failed loads retain the visible card. Canvas processing composites alpha over ivory and preserves aspect ratio without cropping.
- One Three.js plane and original GLSL fragment shader. Six distinct material families: Cosmos (random reflective discs), Spectrum (parallel diffraction), Starlight (five-point foil stamps), Crystalline (Voronoi facets), Contour (curved etched grooves), Gilded (warm metal and glitter).
- Shader composes print, view-dependent spectrum, material texture, micro glints, border and lacquer. It deliberately operates on source display RGB without Three tone-mapping to preserve the original comparison. This is an artistic approximation, not a measured optical simulation of a particular card print run.
- Full/artwork/reverse masks use an adjustable UV rectangle. This is a layout approximation, not semantic character segmentation or an exact per-card factory mask.
- Original comparison removes all foil layers. Saved transparent PNG captures current angle/material, up to 1600px on the long side; it is a still image, not interactive holography.

## Interaction and lifecycle

Card-local ray hit before gesture ownership. Hover tilt and drag are bounded front-facing rotations, exponentially followed at 9/s. Touch uses pan-y/pinch-zoom, horizontal intent threshold, second-pointer cancellation, pointer capture/release, blur/resize/visibility cancellation. Arrow keys and reset are alternatives; reduced motion disables autonomous tilt and interpolation. Idle render stops after settling; automatic mode runs only when visible and not directly manipulated. Texture, renderer, geometry, observers and listeners are disposed on HMR.

## Reference evidence

User video `/Users/yuhitomi/Downloads/1x67_A5nypimAm2J.mp4` (28.46s, 1160×1168), inspected at 0/4/8/12/16/20/24 seconds. White demo with tilted trading card and controls; observed changing stars, rainbow bands, particles and glare. The source pointer gesture is inferred from tilt, not proven from the recording. Its assets/code are not included.

Primary implementation references consulted 2026-10-11:
- https://poke-holo.simey.me/ — families of collectible-card foil effects.
- https://hover-tilt.simey.me/bespoke/pokemon-cards/ — masking separates print regions, and reflected colour/glare layers respond to tilt. No CSS, foil maps, logos or card images copied.

## Sample provenance

`public/art/lunara.jpg`: original fantasy trading-card artwork generated with the built-in image generation tool, then encoded as JPEG for delivery. Source generated PNG: exec-d3d65a25-3173-406e-9d12-a95c88dfff94.png. Prompt: flat 5:7 collector card, LUNARA / CELESTIAL FOX / 120; silver engraved celestial border, original white moon fox over a midnight botanical garden, cream Moonlit Reverie text panel, PRISM ARCHIVE / 001 / 006; no pre-existing franchise characters/logos, no baked foil glare. User-uploaded or linked artwork retains its own rights. Reference video is not redistributed.

## Validation

Run `npm run test --prefix projects/prism` and `npm run build --prefix projects/prism`. Unit coverage checks URL schemes, credentials, crossed mask edges, malformed/oversized uploads, bounded remote streaming and failed requests. Browser checks cover material changes, source loading, errors, masks, snapshot download and responsive layout. Real-device Safari gesture and GPU/thermal testing remain separate.

### Verified 2026-10-11

- Six input/mask tests passed; strict TypeScript and Vite production build passed. Vite reports the existing Three.js-sized bundle warning (547 kB minified / 139 kB gzip).
- Browser: all six finishes, original comparison, automatic-tilt control, file picker, live CORS image URL, reverse coverage, PNG download and invalid-image retention checked. No browser console errors.
- Public Pokémon card URL was used only for runtime input verification; not bundled or saved as a project asset. Saved sample PNG inspected at the current angle with reverse coverage.
- Responsive 390×844 and desktop 1280×800 views inspected. Proof images are in ignored `docs/validation/prism/`.
