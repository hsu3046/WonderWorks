# Tidelight Harbor architecture

## Asset boundary

Blender 5.2.2 LTS, existing local `mcp__blender__` connection. The separately exposed Blender Local connector returned an unavailable/404 response; the already-configured native MCP was verified working without launching another server or installing an addon.

New isolated scene `AI_Tidelight_260929`; original Scene still contains Cube, Light and Camera. Metric scale 1.0. Saved source: `projects/harbor/blender/tidelight-harbor.blend`.

The model scripts work in web Y-up coordinates then convert to Blender Z-up. Static pieces are batched by material. Curved tile roofs, timber mullions, lantern ribs, dock planks, ropes, barrels, crates, cups and two planked hulls are actual geometry. GLB export uses explicit object names.

- harbor.glb — Teahouse + Dock, 5,071,392 bytes
- rowboat.glb — Rowboat, 445,488 bytes
- sailboat.glb — Sailboat, 1,103,844 bytes

Models share no external asset services. Blender source + reproducible scripts are included in the downloadable source.

## Web scene

- `models.ts`: GLB loads with visible progress/error; fine grain via material shader; emissive windows/lamps; four point lights; boat rocking driven by navigation pose; independently rigged original oars and a 96-stamp world-space wake.
- `landscape.ts`: seeded rock deformation/color strata, instanced pine canopies and trunks, island stair, These surroundings are generated in Three.js.
- `environment.ts`: procedural cloud sky, generated tileable water-normal texture, Three.js Water planar reflection (768²), directional + hemisphere lighting, distance fog, rain segments. Five environment presets.
- `main.ts`: one renderer + composer, bloom + OutputPass; camera modes, keyboard/touch helm ownership, boat-follow orbit, responsive dimensions, visible lifecycle, same-origin preview messages.

Water reflects the live geometry into a secondary render target. Bloom is composed before ACES output. Drawing buffers cap at 2.4M pixels / DPR 1.65. Shadow maps update on atmosphere changes and periodically rather than every frame. Dynamic boat shadow positions can lag slightly; their water reflections update every rendered frame.

## Manual navigation (2026-09-29)

`navigation.ts` owns boat X/Z, heading, forward speed, angular inertia and three speed modes (1.4 / 2.6 / 4.2 world metres per second). Simulation substeps cap at 1/120 second. The initial autonomous route stays clear of the dock; pressing WASD or Q takes over continuously without teleporting and selects Drift. Releasing input coasts to rest; S brakes then reverses. Reset scene restores the autonomous route.

Conservative collision bounds protect dock, moored sailboat, islands and a 145-metre sailing radius. They are navigation guards, not mesh-level hull collision or a fluid solver. Reverse away after meeting a boundary.

Keyboard and independent captured pointers feed one helm input. Blur, pause, hidden tabs, mode switches, settings and context loss clear input. Inputs and editable content retain keyboard ownership. The four on-screen arrows also support focused Space/Enter. Drag/scroll retain OrbitControls: after free-look, camera and target translate with the boat without discarding the selected angle or zoom.

Wake history is fixed at 96 independent surface stamps, records the real stern/bow path for forward/reverse and dissipates over 6.5 simulation seconds. Spatial spacing prevents stationary overlap; noise breaks up soft crescent ripples and faint foam. No connected ribbon crosses turns. Each 32×24 grid now lifts the crescent crest above the water (up to roughly 0.2 m before decay), with smooth finite-difference surface normals, soft transparency and shared water/sun color uniforms. A fixed 256-point GPU ballistic spray pool sheds small droplets from both bow shoulders above 0.4 m/s; emission stops with the boat, while existing droplets fall back. This adds one point draw and no new reflection target. No new WebGL context or dependency is introduced.

`rowing.ts` separates original shaft/blade components by welded connectivity before timber mapping, keeping all original triangles and materials. Port/starboard pivots sit at the gunwales. Velocity controls stroke cadence/amplitude, reverse changes sweep, turning biases the two sweeps. Blades dip on the power stroke and lift during recovery; stopping eases back to rest. Source GLB/.blend files remain unchanged; the rig is built at load time.

## Lifecycle

One RAF owner, invalidation for static controls. Wildlife uses the same scene time; it adds no timers or animation loops. Explicit pause, hidden tabs and inactive gallery iframe stop animation/rendering. Time does not jump on resumption. Control changes while paused invalidate a frame. Context loss offers reload; initialization failure offers retry.

The gallery card uses a prerecorded actual-canvas MP4 and its first frame as the poster. One shared gallery video; pointer leave resets to the initial poster. GLB/WebGL initialization only occurs after explicit live-preview/open action.

## Limits

This is an independent recreation of the reference's atmosphere, not exact original source. Pier movement is guided; orbit has distance/polar bounds, not geometry collision. Water is a flat reflection plane with animated normals, not volumetric fluid simulation. Rain is visual; no weather physics or audio. Physical mobile GPU/thermal behavior is not measured.

## Timber refinement (2026-09-29)

`timber.ts` discovers connected pieces by welded position topology without modifying exported normals or topology. Longest-axis mapping aligns grain with individual beams and planks; surface attributes carry piece variation, end-cap masks and face edge distances. Two generated 1024² shared textures provide albedo and packed height/roughness. Surface shaders add worn edges and derivative-filtered end grain. Rain/waterline moisture modulates roughness and color. This treatment runs in Three.js and is not baked into the original .blend/GLB files. See `docs/validation/harbor/materials/RESULTS.md`.

## Wildlife (2026-09-29)

`wildlife-motion.ts` defines deterministic whale surfacing and fish leap envelopes; `wildlife.ts` builds original procedural anatomy and integrates it with water. Existing static gull triangles have been replaced, not duplicated.

- 18 instanced gulls: shaped bodies, head/beak, dark wing tips, GPU hinged wing strokes with alternating glide intervals; six low flyers cross the open foreground bay.
- 60 instanced fish: three shoals, vertex tail flex, silver/dark dorsal coloration, smooth boat avoidance, occasional smooth leaps and landing ripples. Underwater fish are revealed through small feathered water windows; an underwater color plane prevents sky-colored holes. The rest of the water remains opaque.
- One 7.4-metre humpback body with long pectoral fins, curved dorsal fin, paired flukes, eye/blowhole details, a 180-point mist plume and surface rings. Its 44-second scene-time encounter connects surfacing, breathing, forward pitch and raised flukes. YXZ Euler order keeps dive pitch in the whale's local heading frame.
- A fourth camera (`Whale watch`, key 4) follows the offshore area, displays encounter status and widens framing on narrow screens. Existing helm and camera modes remain available.

Water renders before transparent mist/ripples (`renderOrder=-10`) to avoid painting over particles that do not write depth. Water GLSL already declares a local `distance`; injected expressions use `length(delta)` to avoid shadowing the built-in function. Sun/water tint uniforms are shared with existing atmosphere presets. There is still one WebGL context and one existing planar reflection target. These are procedural visual behaviors, not a biological/fluid simulation.

## Giant humpback and water interaction — 2026-09-29

- Root cause: a 7.4m body mostly underwater, only a brief small breath, 44s cycle with nearly 20s hidden, and no volumetric dive splash.
- Body scale 2.5 (18.5m profile), 36s cycle, longer surface passage with two breaths, head-first pitch and raised flukes. Deeper descent occurs after the tail rises. Whale-watch framing widened on desktop/mobile.
- `whale-water.ts`: a 2,800-point fixed GPU pool combines a jet/mist plume, dripping flukes and ballistic entry spray. Eight instanced annular grids provide raised displacement waves plus two torn water sheets. Impact origin is sampled at the fluke crossing and stays at the surface after the animal sinks. No extra RAF or reflection target.
- Final strict builds and 14 tests passed; sampled fixed-time effects/reset, giant-body scale, above-water blowhole, stable splash origin, existing helm/rowing/wake. GPU rendered 32s encounter with no new console errors; desktop and 390×844 mobile checked. Existing bundle warning remains; physical-device thermal/GPU timings not measured.
- During validation, GLSL reserved identifier `patch` was renamed `waveUv`; point sizes/opacity reduced after inspecting the splash, and radial striping in foam removed.
- Gallery runtime, description, 30-second actual-scene hover video/first-frame poster and downloadable sources synchronized.
