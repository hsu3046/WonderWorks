# Tidelight Harbor

An original, interactive harbor study, inspired by a user-supplied video. A Blender-built timber tea house, dock and boats sit on reflective water, surrounded by a procedural archipelago.

## Run

Requires Node.js 22+ and WebGL2.

```sh
npm install
npm run dev
npm run build
```

Development: http://127.0.0.1:4177 . Production output: `dist/` (relative asset paths). In the authoring workspace, `node_modules` links to the existing Fish dependencies; the source download declares its own exact dependencies for independent installation.

## Explore

- Drag / pinch / wheel: orbit and zoom; takes over from the automatic camera.
- 1 / 2 / 3 / 4: overview, follow the rowboat, guided pier promenade, whale watch.
- WASD: take the helm, accelerate, brake/reverse and turn. Q: speed mode. Touch arrows work independently.
- 18 gulls flap and glide; three shoals of 20 fish avoid the boat and occasionally leap. A humpback surfaces, breathes and dives offshore. Whale watch follows it and indicates the next surfacing.
- Atmosphere: Golden hour, First light, Sea mist, Moonrise, Passing rain.
- Breeze, haze and lantern brightness are individually adjustable.
- Space: pause all animation. H: hide/show the interface.
- Hidden tabs stop rendering. Reduced motion begins paused.

The pier mode follows a guided path. Free orbit does not provide collision detection or a first-person walking controller. Audio is not included.

## Blender source

`blender/tidelight-harbor.blend` is the editable source, created in Blender 5.2.2 LTS. Its `AI_Tidelight_260929` scene contains the original assets; the pre-existing default scene was retained.

`common.py`, `01_house.py`, `02_dock_boats.py` reproduce the models in a separate named scene. Run common + a numbered stage in a shared execution namespace. Stage 1 refuses to overwrite an existing named scene. GLB export uses selected roots: Teahouse + Dock, Rowboat, Sailboat. Boat roots should be at the origin when exported; the web app supplies their positions and animation.

## Stack and attribution

Three.js r186, WebGL2, TypeScript, Vite, GLTFLoader, Water planar reflections, bloom and ACES tone mapping. All geometry and normal maps are generated locally; the reference video and its soundtrack are not distributed. Google Fonts loads Cormorant Garamond and DM Sans with local serif/sans-serif fallbacks.

GNU GPL v3. © 2026 [AIB Inc.](https://www.aib.vote). Third-party libraries retain their own licenses.
