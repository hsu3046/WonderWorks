# Wonderworks gallery

A growing collection of interactive worlds and motion studies.

## Run

Requires Node.js compatible with Vite 8. The existing workspace reuses `../fish/node_modules` through a local symlink; no new dependencies were installed for this gallery.

For a fresh repository or full-source download, run `npm run setup` and `npm run build` from the repository root. Then run `npm run dev` to open http://127.0.0.1:4175/.

The root build compiles every study, prepares gallery copies, generates downloads and builds the static site. `npm run build --prefix projects/gallery` alone is suitable only when those generated experiment copies already exist. `npm run preview` in this directory serves its production build locally.

## Search and sharing

`vite.config.ts` uses `src/render.ts` to prerender the catalog into the initial HTML. Real links keep the collection usable without JavaScript and are enhanced into dialogs when scripts load. The build adds canonical URLs, Open Graph/Twitter metadata, Organization/WebSite/CollectionPage structured data, robots.txt and sitemap.xml. The canonical origin comes from `PUBLIC_SITE_URL` or Vercel's production domain environment variable.

## Design and behavior

- Real Three.js chrome/glass sculpture, physical materials, environment lighting and pointer parallax.
- Card previews use silent, prerecorded footage of the actual experiments. One shared HTML video player serves the entire gallery. No artwork iframe or simulation is initialized by scrolling or hovering.
- Hover starts the selected clip from the beginning; leaving immediately restores its first-frame poster and resets playback to zero. Switching/offscreen/hidden/dialog transitions release the video source. Citrus footage shows pulling, release and bouncing; Watermelon includes a knife cut and an independently moving piece.
- The hero pauses while a clip is preparing/playing. Reduced motion and touch-only input keep static posters; details and full experiences remain accessible.
- Project details include an interactive preview, technology overview, full experience link, license and source download.
- Citrus and Watermelon share one project with two variations.
- Native dialogs provide focus management and Escape closing. Reduced-motion preferences disable hover autoplay and continuous hero motion.
- Actual screenshots provide thumbnails and loading fallbacks. Ocean Shoal requires WebGPU.

## Source

`src/catalog.ts` is the project catalog. `src/main.ts` owns previews/dialogs. `src/sculpture.ts` renders the hero. `src/style.css` defines responsive layouts. `scripts/prepare-works.mjs` packages the experiment copies.

New gallery code: GNU GPL v3, Copyright © 2026 AIB Inc. (https://www.aib.vote). See `SOURCE_NOTICE.md` for artwork and vendor exceptions. The gallery hero is procedural; individual experiments include Blender assets with their own documented provenance.

Card playback lives in `src/previews.ts`. `src/catalog.ts` contains movie/poster paths. `public/media/previews` holds H.264 MP4 clips and matching high-resolution JPEG posters, captured from the actual implementations. The iframe protocol in `scripts/preview-runtime.js` is used only for explicitly requested detail previews and capture tooling; gallery cards do not use it.

Creator credits appear on cards, project details, and Source & credits, driven by `src/catalog.ts`. See [CREDITS.md](CREDITS.md): visual recreations use Inspired by, while Bubble Day uses Original code by.
