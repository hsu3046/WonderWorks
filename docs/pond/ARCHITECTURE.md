# Stillwater architecture

`projects/pond` / `vote.aib.wonderworks-pond` / port 4179. Three.js WebGL2 + strict TypeScript + Vite. Procedural garden plus somitsu fish assets (CC BY 4.0), no new installed dependency.

- `garden.ts`: merged stone/wood geometry, a common arch curve for bridge rails/boards, pavilion roofs, lanterns, layered trees, 78,880 foliage instances and 78k green grass blades, concentrated near the water.
- `meadow.ts`: 320 rooted dandelions with toothed basal rosettes and narrow ray florets, plus 4,200 settled cherry petals; two instanced batches.
- `striders.ts`: sub-pixel world-space tapered legs, translucent bodies, six contact dimples and paired expanding capillary wakes at the rowing legs. Shared scene clock and wind; no additional RAF.
- `life.ts`: eight dynamic fish instance transforms, lily pads and flowers; delegates independent steering to `fish-motion.ts`, frog interaction/hops to `frog.ts`, and dragonflies/butterflies/water striders to `insects.ts`. `drifting.ts` animates 760 curved petals and 140 dandelion sprites in two instanced draws.
- `koi.ts`: async GLB loading for Jikin/Tosakin/Ryukin/Shubunkin; Blender-normalized detailed meshes and texture/normal maps, two instances per species, material batching, flexible fin roots, individual swim phases. Cornea transmission omitted to avoid nested refraction captures. Original USDZ rig animation did not import; deformation is authored in GLSL. See model attribution for CC BY 4.0 source credits.
- `water.ts`: full-resolution scene refraction target, 60%-resolution mirrored/clipped reflection target, displaced grid, Fresnel mixing, sun glints and 10 bounded traveling ripple impulses. Underwater camera bypasses reflection and gains depth fog. Each offscreen target stays linear/HDR; the dream-light composite owns final tone mapping/color conversion when enabled, otherwise final materials retain direct output.
- `dream-light.ts`: occluded warm sun aureole, full-resolution HDR main target and three-scale soft bloom. Six fullscreen passes share the existing RAF, with weather/underwater attenuation, resize/disposal handling and original-light fallback. `Dream light` defaults to 85%, with 0% direct output and a 150% maximum; see `DREAM_LIGHT.md`.
- `scene.ts`: one RAF, shared simulation time, light/time/weather, camera interpolation with OrbitControls takeover, rain and petals, hidden/paused/context-loss/disposal lifecycle. Pixel ratio capped at 1.6 and 2M pixels. No concurrent live artwork card renderers in gallery.
- `main.ts`: English controls, accessible labels, keyboard alternatives, preset selection, photo download, same-origin preview pause/play.

Known limits: procedural materials/animals are stylized. Caustics are analytic approximations, refraction uses a screen-space offset, and shoreline uses an elliptical basin. No fluid solver, physically exact dispersion, or full obstacle-aware animal path planning (rocks use simple repulsion). A full pond renderer is opened only through explicit experiment interaction; gallery uses a recorded video.

HDR main/capture passes share a one-plane shader configuration, with a neutral clipping plane for the main view. RAF continuation shares the guarded invalidation reservation, including synchronous OrbitControls changes. See `PERFORMANCE.md` for measured costs, appearance checks and the updated gallery recording pose.

### Supplied life models and PBR update

See `LIFE_ASSETS.md`: async nature materials (`nature-materials.ts`), 8 fish / 4 species, source-derived frog, phased swimming and local Poly Haven PBR maps. `createGarden` now completes texture loading before the ready handshake.
