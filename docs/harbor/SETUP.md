# Setup and integration

Run `npm run dev` inside `projects/harbor` for port 4177. `npm run build` runs strict TypeScript then Vite. Exact dependencies match Fish/Chroma; no new package installation was performed.

Build harbor before `npm run prepare:works` in `projects/gallery`, then build the gallery. Gallery launch path must include `/experiments/harbor/index.html`. Omitting index.html under Vite public directories can route to the gallery SPA.

`?preview=1` hides chrome and starts with rendering held after the initial frame. Parent controls use same-origin `wonderworks:ready`, `wonderworks:play`, `wonderworks:pause` messages. The child accepts play/pause only from its actual parent and its own origin.

To open Blender on macOS: `open -a Blender`. The existing native MCP was already functional in this session. Do not start an extra server merely because the separate cloud connector is unavailable.

## Boat controls

- W: accelerate; S: brake, then reverse; A/D: port/starboard. Steering needs water speed.
- Q or the speed button: Cruise → Swift → Quiet. The boat eases towards the new limit.
- Drift selects the follow camera. Keyboard helm input also switches to Drift automatically.
- Drag to look, scroll/pinch to zoom; tracking continues. Select Drift again to restore chase view.
- Touch: hold arrows; forward and turn may be held independently. Reset scene restores automatic drift.
- Space: pause; 1/2/3/4: cameras; H: interface.

Navigation tests: `node --experimental-strip-types --test projects/harbor/tests/navigation.test.mjs` from workspace root.

`Whale watch` (4) opens the offshore observer camera. The first breath starts soon after scene reset; the whale then dives and returns on a 44-second scene-time cycle. Pause freezes wildlife and its effects.
