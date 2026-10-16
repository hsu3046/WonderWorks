# Architecture

This document explains how Golden Temple turns about 31,000 lines of JavaScript into a film: how the world is built, how one frame is rendered, why the result does not flicker, and how shots, materials and world modules fit together. The [README](../README.md) covers installation and the command-line tools.

- [Conventions](#conventions)
- [Startup](#startup)
- [Rendering one frame](#rendering-one-frame)
- [Why the sub-frame sampling is temporally stable](#why-the-sub-frame-sampling-is-temporally-stable)
- [Light and atmosphere](#light-and-atmosphere)
- [Materials: the patch system](#materials-the-patch-system)
- [World modules](#world-modules)
- [The shot system](#the-shot-system)
- [Adding a module](#adding-a-module)
- [Adding or changing a shot](#adding-or-changing-a-shot)
- [Offline rendering and quality checks](#offline-rendering-and-quality-checks)

## Conventions

- Units are metres. +X is east, +Y is up and +Z is south, so north is −Z. The courtyard ground is at y = 0.
- `src/layout.js` (`L`) is the site plan and the single source of truth for positions and sizes: the hall at (10, 0, −22), the pagoda at (−32, 0, −8), the pond outline, the bridge, the gate at (10, 0, 46), and so on. Modules read their placement from it instead of hard-coding coordinates, so that neighbouring modules agree.
- `src/core/env.js` fixes the time of day. The sun stands 6.8° above the horizon in the west-south-west, its light at the ground is a warm colour of about 3300 K, and shared uniforms (`uTime`, wind, sun direction and colour, `uShot`) live in the object `G`, which every patched shader references.
- Nothing calls `Math.random`. Every module draws from `rng('<name>')` in `src/core/rng.js`, a seeded mulberry32 generator, so each load builds an identical world. The interior's SDF meshing runs in a pool of web workers, and each grid point and vertex is computed by the same pure function, so it is deterministic too.

## Startup

`src/main.js` runs the same sequence in every mode:

1. **Patch three.js shader chunks.** `src/core/fog.js` writes aerial perspective, ambient volumes and a fixed shadow-filter rotation into three.js's shared shader chunks before any material compiles.
2. **Create the renderer, sky, sun and post pipeline.** The renderer has no built-in anti-aliasing or tone mapping; both happen in the pipeline. The shadow map is 8192² at final quality and 2048² at preview quality.
3. **Build the world.** Each module in `ALL_MODULES` (terrain, pond, hall, interior, pagoda, bridge, buildings, props, vegetation) is imported dynamically and its `build(ctx)` is awaited, in that order. A module that throws is logged and skipped, and the rest of the world still builds.
4. **Place anchors.** Modules may declare anchor points for hanging lanterns and bells. They are merged and handed to `props.placeAnchors()`, which instances the lanterns and bells there.
5. **Install ambient volumes** from every module (see [Light and atmosphere](#light-and-atmosphere)). They are baked into GLSL, so this must happen before the first render.
6. **Compile all programs in parallel** (`renderer.compileAsync`). On the Radeon 780M this takes about 70 s for the full scene.
7. **Capture image-based light**: first from the sky alone, then, at final quality, from the built scene at a point in the courtyard.
8. **Finalize modules.** Each module's `finalize(ctx)` runs, for example to capture a local environment map inside the hall.
9. **Enter a mode.** `dev` is the interactive preview with orbit controls and a shot player. `still` renders one view and exposes `window.__renderView(query)` so that `tools/snap.mjs` can render more views without reloading. `render` loops over the frames of the film and posts each one to `tools/render.mjs`.

## Rendering one frame

`renderFrame()` in `src/main.js` renders a frame as a set of sub-frames, and `Pipeline` in `src/core/post.js` does the GPU work:

```text
renderFrame(T)                                   T = film time of the frame
├─ evaluate the shot at T: lens, post settings, shadow region, fade
├─ for k = 0 … spp−1                             sub-frames (spp = 8 in the film)
│   ├─ time     t_k = T + shutter offset(k)       -> uTime, every module's update(t_k)
│   ├─ camera   evaluated at t_k, projection shifted by AA offset(k)
│   ├─ sun      direction jittered by disc point(k), shadow frustum fitted, shadow map re-rendered
│   ├─ scene    -> RGBA16F target, 4x MSAA, float depth texture
│   ├─ SSAO     half resolution, 16 samples, rotation from k, two-pass depth-aware blur
│   ├─ [volumetric light: 48-step ray-march through the sun shadow map, if enabled]
│   └─ accumulate += w_k · colour · mix(1, AO, strength)      (additive blend)
└─ end of frame, on the accumulated HDR image
    ├─ [screen-space god rays, if enabled]
    ├─ depth of field: circle of confusion from focus distance, focal length and f-stop; scatter-as-gather blur
    ├─ bloom: 7-level downsample/upsample chain, Karis average on the first level
    └─ grade: exposure, sharpening, tone mapping (50/50 blend of a fitted ACES and AgX), white balance,
       lift/gamma/gain, saturation, contrast, vignette, chromatic aberration, grain and dither
       -> canvas, or an 8-bit target that is read back and sent to ffmpeg
```

Averaging sub-frames replaces several effects that real-time engines approximate separately:

| Effect | Comes from |
|---|---|
| Anti-aliasing | A sub-pixel projection offset per sub-frame, weighted by a Gaussian reconstruction filter |
| Motion blur | Each sub-frame samples a different moment within a 180° shutter, and both the camera and the animated scene (wind, water, koi, smoke, flames) are evaluated at that moment |
| Soft sun shadows | The sun direction moves inside a small disc, so penumbrae widen with distance from the occluder, as they do under the real sun |
| Clean ambient occlusion | Each sub-frame rotates the SSAO kernel, and the average removes the noise |

In render mode, sub-frame times are clamped to the current shot, so motion blur never spans a cut. The film fades in over its first 0.9 s and out over its last 1.4 s by scaling exposure.

The volumetric ray-march and the god-ray pass are off in the film (`vol` and `godrays` are 0 by default and can be enabled through the URL). The light shafts inside the hall come from the interior module (`src/world/interior-fx.js`): camera-aligned slices limited to the hall's volume that sample the same sun shadow map, so the shafts follow the real window and door openings.

## Why the sub-frame sampling is temporally stable

A common approach is to seed the sampling with the frame number. In a film that is visible: a static roof tile receives a different set of samples every frame, so its edges crawl, shadow penumbrae shimmer and ambient occlusion buzzes. Golden Temple uses a different rule:

**Every sampling pattern depends only on the sub-frame index `k`, never on the frame number.**

If the camera does not move and nothing animated touches a surface, frame N and frame N+1 therefore compute bit-identical pixels for it. If the camera moves, the pattern stays fixed relative to the screen and behaves like an ordinary fixed reconstruction filter, so there is no per-frame noise to show up as shimmer. The patterns are:

| Pattern | Definition |
|---|---|
| AA offset | `o_k = (2·H₂(k+1) − 1, 2·H₃(k+1) − 1)` pixels, where H₂ and H₃ are the Halton sequences in bases 2 and 3. The footprint is 2 px wide. |
| AA weight | `w_k ∝ exp(−\|o_k\|² / (2 · 0.5²))`, a Gaussian with σ = 0.5 px, normalised to sum to 1. A wide, smooth filter instead of a 1-px box is what keeps thin geometry (railings, lattice, roof-tile edges) from crawling in slow camera moves. |
| Shutter time | `t_k = t + ((π(k) + 0.5)/spp − 0.5) · 0.5 · Δt`, with the permutation `π(k) = (5k + 1) mod spp` (`7k + 1` when spp is a multiple of 5). The permutation decorrelates the moment in time from the AA offset, so motion blur and anti-aliasing do not line up into patterns. |
| Sun jitter | A golden-angle disc: `r_k = √((k + 0.5)/spp)`, `θ_k = 2.39996·k + 0.7`, offset `0.0065 · r_k · (cos θ_k, sin θ_k)` radians around the sun direction. |
| SSAO and volumetric jitter | Seeded by the sub-frame counter. |
| Shadow-map filtering | three.js rotates its PCF taps with screen-space noise, which crawls when the camera moves. `src/core/fog.js` replaces that rotation with a constant, and the softness comes from the sun jitter instead. |

Only two things change from frame to frame on purpose: film grain and dither, which are seeded by the frame number at a very low amplitude, and animation driven by `uTime`.

These choices were checked by measuring rendered footage, not only single frames. The tools for that are listed under [Offline rendering and quality checks](#offline-rendering-and-quality-checks).

## Light and atmosphere

- **Sky (`src/core/sky.js`).** A single-scattering atmosphere in the style of Nishita: Rayleigh, Mie and ozone extinction, 20 samples along the view ray and 8 toward the sun. A cloud layer is lit through the same atmosphere, and the sun disc is HDR. The sky dome follows whichever camera renders it, including cube cameras and the planar reflection of the pond.
- **Sun (`src/core/lighting.js`).** One directional light. Each shot declares a shadow region `{ center, radius }`, and `fitSunShadow()` fits the orthographic shadow frustum around it for every sub-frame. With an 8192² map and a 22 m radius, a shadow-map texel is about 5 mm across. A shot can also exclude whole modules from casting shadows (`noShadow`); the sanctum shot, for instance, excludes the trees, terrain and outer buildings.
- **Image-based light.** The environment is a PMREM of a 256² cube capture: first of the sky, then (at final quality) of the built scene. Modules can capture local environments in `finalize`. The hall captures its interior twice, so the second capture already contains one bounce of the first.
- **Aerial perspective (`src/core/fog.js`).** Exponential height fog with a 22 m scale height, a thin long-distance air term, and a Henyey–Greenstein glow toward the sun (g = 0.78). It is computed per fragment inside every material by replacing three.js's fog shader chunks, so the planar water reflection gets the same haze as the direct view.
- **Ambient volumes.** Up to 48 boxes `{ min, max, tint, soft }` in which sky light is mostly blocked: the hall interior, under the pagoda's eaves, and so on. Inside a box, the image-based diffuse and specular light and the fog in-scatter are multiplied by the tint, with edges softened by a signed-distance falloff. They are compiled into GLSL as constants, which is why `setAmbientVolumes()` must run before the first render.

## Materials: the patch system

`patch(material, hooks)` in `src/core/materials.js` injects GLSL into any `MeshStandardMaterial` or `MeshPhysicalMaterial` (and the common hooks into basic and Lambert materials), so procedural surfaces keep three.js's physically based lighting, shadows, image-based light and fog.

Every patched shader gets `vWPos` (world position) and `vWNrm` (world normal) in both stages, the global uniforms (`uTime`, `uWindDir`, `uWindStrength`, `uSunDir`, `uSunColor`, `uShot`), the shared noise library (`n_*` functions in `src/core/glsl.js`), `windOffset(worldPos, flex)`, and the bump helper `n_bumpView(viewPos, viewNormal, height, strength)`.

| Hook | Runs | Typically modifies |
|---|---|---|
| `vertexHead` | vertex declarations | attributes, varyings, functions |
| `vertexWorld` | after the world transform | `wPos4.xyz` (wind, sway) |
| `fragHead` | fragment declarations | globals shared between hooks |
| `fragColor` | after `<color_fragment>` | `diffuseColor` (linear RGB) |
| `fragRough` | after `<roughnessmap_fragment>` | `roughnessFactor` |
| `fragMetal` | after `<metalnessmap_fragment>` | `metalnessFactor` |
| `fragNormal` | after `<normal_fragment_maps>` | `normal` (view space) |
| `fragEmissive` | after `<emissivemap_fragment>` | `totalEmissiveRadiance` |
| `fragPhysical` | after `<lights_physical_fragment>` | physical material parameters |
| `fragLight` | after `<lights_fragment_end>` | `reflectedLight` (for example leaf translucency) |
| `fragEnd` | before `<opaque_fragment>` | `outgoingLight` |
| `uniforms`, `defines` | | extra uniforms (shared by reference) and defines |

The program cache key is a hash of the hook strings, so materials with identical hooks share one compiled program. `depthMaterialFor(hooks)` builds a matching depth material, so geometry displaced in `vertexWorld` (wind on leaves, for example) casts shadows that move with it.

```js
const { std } = ctx.mat;
const agedGold = std({ color: 0xffffff, roughness: 0.3, metalness: 1.0 }, {
  fragHead: `float g_h;`,
  fragColor: `
    g_h = n_fbm3(vWPos * 6.0, 3);
    diffuseColor.rgb *= vec3(1.0, 0.72, 0.32) * (0.85 + 0.15 * g_h);`,
  fragRough: `roughnessFactor = clamp(roughnessFactor + 0.2 * g_h, 0.05, 1.0);`,
  fragNormal: `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0015);`,
});
```

`materials()` returns the shared set, `ctx.M`: vermilion and black lacquer, several golds and gold leaf, bronze, roof tile, plaster, granite (clean and mossy), raw and polished wood, lattice green, lantern glow and flame. The snippets behind them are exported as `PROC.lacquer()`, `PROC.gold()`, `PROC.bronze()`, `PROC.roofTile()`, `PROC.plaster()`, `PROC.granite()` and `PROC.wood()`, so modules can make variants.

## World modules

A world module is a file in `src/world/` that exports `build(ctx)`. Helper files carry the module's name as a prefix (`pagoda-parts.js`, `pond-lotus.js`, and so on).

| Module | Contents |
|---|---|
| `terrain` | Courtyard ground (raked gravel, moss), stone paving, the pond bed, wooded hills and mountain ridges, an instanced backdrop forest, ground cover |
| `pond` | Water with planar reflections, stone edging, an island, lotus colonies, water lilies, koi, floating leaves and petals |
| `hall` | The main hall's exterior: two-tier roof, karahafu porch, granite podium, columns, bracket sets, gold fittings |
| `interior` | The inner sanctum: the golden Amida on a lotus throne with its mandorla, attendant figures, altar and offerings, canopies, banners, coffered ceiling, light shafts, dust and incense smoke |
| `pagoda` | The five-storey pagoda, generated per side and rotated about its axis |
| `bridge` | The arched vermilion bridge: deck planks, arch boards, railings with giboshi, granite piers |
| `buildings` | The viewing pavilion, the enclosing corridor, the south gate, the bell tower and two side halls |
| `props` | Stone lanterns, hanging bronze lanterns, wind bells, the incense burner, the water basin, stepping stones |
| `vegetation` | Black pines, maples, cherries, clipped shrubs and ferns: recursive branch skeletons meshed as tubes, foliage as instanced cards with canvas-drawn atlases |

### The module contract

```js
export async function build(ctx) {
  // ...
  return { object, anchors, update, finalize, ambientVolumes };
}
```

`ctx` contains:

| Field | Meaning |
|---|---|
| `THREE`, `renderer`, `scene`, `camera` | three.js and the live objects |
| `L` | the site plan from `src/layout.js` |
| `G`, `ENV`, `sunDir` | shared uniforms, the environment constants and the sun direction |
| `M` | the shared material set |
| `mat` | `{ patch, std, phys, glow, PROC, depthMaterialFor }` |
| `geom` | geometry helpers: `Builder` (merges geometry per material), `instanced()`, `lathe()`, `sweep()`, `tubeAlong()`, `mat4()` and math helpers |
| `rng` | the seeded generator factory: `ctx.rng('my-module')` |
| `quality` | `'preview'` or `'final'` |
| `onUpdate(fn)` | registers another per-sub-frame callback |
| `captureEnv(pos, opts)` | captures a local PMREM environment from a point in the scene |
| `modules` | the results of the modules built earlier, for example `ctx.modules.terrain.heightAt` or `ctx.modules.pond.site` |

The returned object may contain:

| Field | Meaning |
|---|---|
| `object` | An `Object3D` added to the scene. Returning a bare `Object3D` instead of an object is also accepted. |
| `anchors` | `{ hangingLanterns: [...], bells: [...], smallBells: [...] }`, each entry `{ pos: [x, y, z], scale, rotY }`. `props` places lanterns and bells at these points, so a building only has to say where its hooks are. |
| `update(t, ctx)` | Called for every sub-frame with the film time, for animation that is not done in a shader. |
| `finalize(ctx)` | Called after the global environment capture, for local environment captures and other work that needs the finished scene. |
| `ambientVolumes` | Boxes `{ min, max, tint, soft }` that dim sky light (see above). |

Modules also return other fields that later modules read (`terrain.field`, `terrain.heightAt`, `pond.site`) and a `showcase` list of review cameras, which the renderer ignores.

Modules can read the shot list too. The pond places its hero lotus and its beaded leaf at the focus point of the first key of shots 2 and 9 and keeps the camera paths clear of stems. The vegetation module lays out the backlit maple spray of shot 10 in the frame of that shot's first key, keeps the foliage of framing trees out of protected regions of the film cameras' frames, and gives leaves seen up close by a ground-level camera a translucent material. Shaders can test `uShot`, the index of the shot being rendered, to switch per-shot details such as sun glitter on the water or drifting leaves.

## The shot system

`src/shots.js` defines `SHOTS`, ten entries of `SHOT_DUR = 7` seconds each:

```js
{
  name: 'Wind bell - ...',
  ease: 'reveal',                 // 'inout' (default), 'reveal' or 'linear'
  keys: [                         // two or more camera keys
    { pos: [x, y, z], look: [x, y, z], focal: 40, focus: 2.15, fstop: 4 },
    // ...
  ],
  near: 0.04,                     // near plane for macro work
  shadow: { center: [x, y, z], radius: 21 },   // region the sun shadow map covers
  noShadow: ['vegetation'],       // modules that cast no shadow in this shot
  post: { dof: true, exposure: 1.0, fog: 0.65 }, // overrides of DEFAULT_POST in src/core/post.js
  smooth: 0.22,                   // optional Gaussian smoothing, sigma in seconds
}
```

`evalShot(i, t)` returns the camera for shot `i` at local time `t`:

- The progress `u` comes from the ease curve. `reveal` lingers on the close-up, accelerates into the move and lands softly. `linear` is for shots whose keys are already sampled from a continuous function.
- With two keys, the position is interpolated linearly. With more, it follows a Catmull-Rom curve.
- Orientation is interpolated as a direction vector, not as a look-at point. A close-up looking at something 1 m away and a wide shot looking 40 m away therefore turn smoothly, and the look distance is interpolated in log space.
- Focal length and f-stop are interpolated per key, and the focus distance in log space, so a lens can rack focus and zoom during the move.
- `smooth` averages the raw camera over ±2.5σ with 13 Gaussian taps, extrapolating by point reflection beyond the ends of the shot so that velocity stays continuous. This removes acceleration snaps from hand-placed keys.

Each module may own the cameras of its hero shots. `src/shotkeys/<module>.js` exports `{ <shotIndex>: { ...fields } }` (zero-based indices), and the fields replace those of the base definition (`Object.assign`). Nine of the ten shots are owned this way (numbered 1–10 here, as in the film): shots 2 and 9 by `pond`, 3 by `bridge`, 4 by `pagoda`, 5 and 8 by `buildings`, 6 by `hall`, 7 by `interior` and 10 by `vegetation`. Shot 1 is defined only in `shots.js`. The `interior` and `vegetation` shots are written as continuous functions (an arc-length path with a speed profile and separate look, focus and focal-length curves), sampled every 0.25 s into 29 keys with linear easing.

In render mode, frame `f` is at film time `T = f / fps`, in shot `floor(T / 7)` at local time `T − 7 · shot`.

## Adding a module

1. Add the module's placement to `src/layout.js`.
2. Create `src/world/<name>.js`:

   ```js
   // src/world/shrine.js
   export async function build(ctx) {
     const { M, geom, L } = ctx;
     const R = ctx.rng('shrine');                       // seeded, never Math.random
     const [x, y, z] = L.shrine.center;
     const b = new geom.Builder();                       // merges geometry per material
     b.box(M.granite, 3.2, 0.4, 3.2, [x, y + 0.2, z], [0, 0, 0], 0.04);
     for (let i = 0; i < 4; i++) {
       const a = (i + 0.5) * Math.PI / 2;
       const lean = [R.range(-0.008, 0.008), 0, R.range(-0.008, 0.008)];   // slightly out of plumb
       b.cyl(M.lacquerRed, 0.11, 0.12, 2.4, [x + Math.cos(a) * 1.3, y + 1.6, z + Math.sin(a) * 1.3], lean);
     }
     return {
       object: b.build({ name: 'shrine' }),
       anchors: { bells: [{ pos: [x + 1.5, y + 2.7, z + 1.5], scale: 0.8, rotY: 0 }] },
       ambientVolumes: [{ min: [x - 1.5, y + 0.4, z - 1.5], max: [x + 1.5, y + 2.8, z + 1.5], tint: [0.45, 0.4, 0.35], soft: 0.4 }],
     };
   }
   ```

3. Add the name to `ALL_MODULES` in `src/main.js`, after any module it reads from `ctx.modules`. Anchors are collected after all modules are built, so their order does not matter for anchors.
4. Look at it on its own with a fallback ground, then in context:

   ```bash
   node tools/snap.mjs "modules=shrine&cam=24,2,-20&look=30,1.5,-30&w=1280&h=720" out/shrine.png
   node tools/snap.mjs "w=1280&h=720" --view "cam=24,2,-20&look=30,1.5,-30" out/shrine-full.png
   ```

5. If the module owns a shot, add `src/shotkeys/<name>.js` and include it in `OVERRIDES` in `src/shotkeys/index.js`.

Keep repeated parts instanced (`geom.instanced`), merge static parts per material with `geom.Builder`, reuse `ctx.M` where possible, and patch new materials rather than writing `ShaderMaterial`s, so that fog, ambient volumes and shadows keep working.

## Adding or changing a shot

- **Changing a shot.** Edit the module override in `src/shotkeys/` if one exists. Fields set there replace the same fields in `src/shots.js`, so editing the base definition of an overridden field has no effect.
- **Adding a shot.** Append an entry to `SHOTS`. `FILM_DURATION` follows automatically (`SHOTS.length × 7 s`), but several tools assume the 70-second cut: `tools/render.mjs` renders 70 s unless you pass `--to`, `tools/score.mjs` edits the music to 70 s, the flicker tools assume cuts every 7 s, and the preview's number keys reach only 10 shots (`?shot=10&t=…` still works).

A workable loop for camera work:

```bash
node tools/camcheck.mjs                                   # speed, turn rate and acceleration spikes, CPU only
node tools/sheet.mjs --shots 4 --t 0,1,2,3,4,5,6,6.9 --tag s5   # shot 5 (index 4) at eight moments
node tools/render.mjs --from 1680 --to 2100 --spp 2 --w 960 --h 540 --out out/s5-draft.mp4   # its frames as a draft
```

Once a final segment is rendered, `tools/splice.mjs --base out/temple.mp4 --seg out/seg.mp4 --from A --to B --out out/new.mp4` puts it into the finished film.

## Offline rendering and quality checks

`tools/render.mjs` starts an HTTP server and an ffmpeg process, then opens the page in headless Chrome in `render` mode. For each frame the page renders the sub-frames into an 8-bit target, reads it back with `readRenderTargetPixelsAsync` and POSTs the raw RGBA pixels. The server writes them straight into ffmpeg's stdin (libx264, CRF 14, preset `slow`, `tune film`, BT.709). Chrome is launched with the GPU watchdog disabled, because single frames take seconds, and on Windows with ANGLE's Direct3D 11 backend, which the film was rendered with. A lock file in `out/` keeps `snap.mjs` and `render.mjs` from using the GPU at the same time.

On the AMD Radeon 780M the full film takes about 4 hours: about 2 minutes to build the world and compile shaders (about 8 minutes on a fresh clone, before the shader cache in `out/.chrome-profile` exists), then 4,200 frames at about 3.35 s of wall-clock time each (235 minutes). That time includes cool-down pauses of 60 ms after every frame and 15 s every 250 frames, about 8 minutes in total, which keep a laptop iGPU from running at its thermal limit for hours.

The quality tools measure footage instead of single frames:

| Tool | Measures |
|---|---|
| `camcheck.mjs` | Samples every shot at 60 fps on the CPU and reports top speed, turn rate, and the largest acceleration and angular-acceleration spikes, which show up as stutter. |
| `lumaflicker.mjs` | Mean luma of a 4×4 grid of screen regions per frame and the high-pass `\|L(t) − (L(t−1) + L(t+1))/2\|` per region. Smooth exposure and camera changes cancel out; light and shadow flicker remains. Frames next to cuts are skipped. |
| `mcflicker.mjs` | Predicts every odd frame from its even neighbours with ffmpeg's motion-compensated interpolation and reports the residual. Smooth motion is predicted away; shimmer and crawl remain. |
| `flickercheck.mjs` | The mean second temporal difference of luma at 480×270, per shot. |
| `splice.mjs` | Replaces a frame range of a finished film with a re-rendered segment, frame-accurate, so a fix does not require a full re-render. |
