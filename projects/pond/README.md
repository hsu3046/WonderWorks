# Stillwater

A living water garden. An original Three.js interpretation of a user-provided garden recording, with a cedar bridge, cherry blossoms, lily pads, a breathing frog and 8 goldfish: two each of Jikin, Tosakin, Ryukin and Shubunkin.

## Run

```sh
npm install
npm run dev
npm run build
```

The local Wonderworks workspace reuses its existing Three.js/TypeScript/Vite installation through the same project-local symlink arrangement as Harbor and Foliage. The downloadable source is standalone; run `npm install` there.

## Explore

- Drag to orbit, scroll or pinch to zoom. Tap the pond for ripples.
- Garden / Waterline / Dive in / Lily pads: smooth camera transitions.
- Feed the fish: scatter food and attract the fish.
- Tune the garden: sunlight, dusk, rain, water clarity, breeze and swimming activity.
- Space: pause. 1–4: viewpoints. F: feed. Escape: close settings.
- Save a moment: export the current canvas as PNG.

Reflection/refraction use half-float targets. The garden and water patterns are generated in code; detailed fish meshes and textures are credited below. The supplied reference video is not redistributed. Water optics and animal behavior are artistic approximations, not a fluid or ecological simulation.

GNU GPL v3 · © 2026 [AIB Inc.](https://www.aib.vote). Three.js and its addons retain their MIT license. Google Fonts: DM Sans and Italiana (SIL Open Font License), with local fallback fonts.

## Animal assets

Fish meshes/textures: somitsu, CC BY 4.0. Jikin/Tosakin use locally supplied Kiboon USDZ sources; Ryukin/Shubunkin use the newly supplied Blender files. Montane Brown Frog: ffish.asia / floraZia.com, CC BY 4.0, from the supplied rigged derivative. See `public/models/ATTRIBUTION.md` for provenance and modifications; assets are licensed separately from the GPL application.

Four fish GLBs total about 14.55 MB; the active morph-capable frog GLB is 9.18 MB. Original rig/cloth animation is not included; web swimming uses independent GPU body/fin deformation, and the frog breathes subtly. Species-specific scales keep Jikin (0.18–0.22), Tosakin (0.17–0.21) and Ryukin (0.16–0.20) compact, with a longer Shubunkin (0.46–0.52). Pigment variants preserve source markings; opaque bodies, restrained fin translucency and bounded roughness prevent missing-color/plastic artifacts.

Optional Blender preparation: `scripts/ASSETS.md`. Existing Blender working studies are retained in `assets/`; the large supplied originals stay in the parent workspace.

## Garden surfaces and swimming

Photographic stone, bark and forest-soil PBR maps: Poly Haven, CC0 (`public/textures/ATTRIBUTION.md`). Stone uses triplanar mapping; bark keeps cylindrical UVs. Trees have staggered, curved boughs; leaves and grass retain procedural geometry with veins, pigment variation and wind bending.

Body waves travel toward the tail. Per-fish stroke phase/effort drives body and fin deformation, with acceleration/gliding, turning bank, deeper travel and restrained vertical motion. Fish bodies cast shadows onto the bed.

### Living garden controls

Fish choose independent paths and depths. In **Lily pads**, move the pointer near the frog or tap it to make it jump to a nearby pad. Dragging still orbits the view; pause freezes the animals and airborne particles together. Butterflies, slender dragonflies and water striders inhabit the garden, alongside drifting cherry petals and dandelion seeds.

Regression check (Node 25+): `node --test tests/*.test.ts`.

The meadow includes 78,000 green grass blades, rooted dandelions and fallen cherry petals. Small translucent water striders leave paired capillary wakes at their rowing feet. Frog jumps preload the folded hind legs before a quick kick, using existing Blender-authored morph targets.
