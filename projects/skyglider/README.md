# Skyglider

A flying-squirrel journey through an alpine fantasy valley. Original browser study inspired by the supplied `halJf1qJTKzrYRpJ.mp4` reference.

**© 2026 AIB Inc. (https://www.aib.vote) · GNU GPL v3**. Poly Haven models/textures retain CC0; user-supplied scenery has separate source rights. See [asset credits](public/assets/ATTRIBUTION.md).

## Run

```sh
cd projects/skyglider
npm ci
npm run dev
```

Open **http://127.0.0.1:4182/**. This worktree already has an APFS copy of the existing project dependencies; no packages were installed for this implementation. Standalone build: `npm run build`; numerical safety checks: `npm test`.

## Explore

- **Take flight / Space**: a 10.5-second branch approach, climb to the crown, gather and forward leap, then an 82-second guided glide; Space pauses during flight.
- **Drag / scroll / pinch**: orbit the following camera and adjust distance.
- **WASD / arrow keys**: walk along the departure bough or explore dry ground after landing; during flight, bank left/right and change altitude. On small touch displays, use the arrow controls.
- **Land nearby / L**: leave the flight route and descend into the nearest suitable forest clearing. The button appears after takeoff. Landing can be paused; once on the ground, drag to look around and use **Back to the oak / R** to start another journey.
- **R**: return to the old oak. **H**: hide/show interface. **P**: pause the whole scene.
- Sun button: golden-hour light. Camera button: save the actual canvas as PNG.
- Field guide: controls, journey speed, sources. Opening it suspends the renderer.

The initial state respects reduced motion. Hidden tabs and explicit pause stop the single requestAnimationFrame loop. A paused camera interaction renders only the invalidated frame.

## What is included

- Original glider with a continuous 14-bone skin, grizzled brown fur and pale belly, recessed reflective eyes, sculpted nose, cupped ears, detailed paws, distance-driven bounding and climbing, fur-covered folding wing membranes and a bushy tail.
- Scanned PBR surface maps, real fern/moss-rock models and an optimized broadleaf tree; an HDR sky supplies reflections and ambient light.
- Three-dimensional terrain, distant mountains, castle, village, suspension bridge, flowing waterfall shaders, mist, pollen and circling birds.
- TypeScript strict + Three.js WebGL2 + Vite. Browser WebGL2 hardware acceleration is required.

This is a focused visual flight experience. Manual climbing controls, collecting items, combat, a complete game physics system, physical fur simulation and the reference's original assets are not implemented. Water uses approximate reflections and procedural flow, rather than a full fluid simulation.

The project is standalone and is not added to the production gallery. Research, design decisions and validation: `../../docs/skyglider/`.

## Assets

Checked-in assets run without the Poly Haven API. `scripts/fetch-assets.py` reproduces the direct CC0 texture/fern/rock downloads. The tree authoring script accepts a separately downloaded original Poly Haven glTF folder and uses the existing workspace meshoptimizer and `cwebp`; it is not part of the runtime or normal build. `manifest.json` verifies the checked-in, processed tree files.

Inspect the squirrel at **http://127.0.0.1:4182/character.html**. It has six views, four poses and an optional animation loop. Try **Side → Running → Animate**, **Gliding → Top**, or **Resting → Face**. It uses the same model factory as the valley. To regenerate the original body after sculpt changes: `node --experimental-strip-types scripts/build-squirrel.mjs`.

Painted alpine scenery and distant oak cards provide detailed silhouettes at low geometry cost. Nearby oak branches remain 3D, with curved tapered limbs and dedicated foliage clusters. Static architecture is merged per material; broadleaf and ground-detail LOD reuse authored transforms. Asset provenance and prompts: `../../docs/skyglider/ILLUSTRATION_ASSETS.md`.

Water and meadow update: illustrated ripples, terrain-fitted waterfall veils with impact foam/spray, a circular sea fading into distance fog and seven organic painted wildflower meadows with nearby sprite detail. Full new illustration provenance: `../../docs/skyglider/ILLUSTRATION_ASSETS_V10.md`.
