# Cassette — a little tape, endless light

A translucent holographic cassette for Wonderworks. Turn it through a full 360°, watch the reels rewind behind the window, name the label and save a picture.

© 2026 [AIB Inc.](https://www.aib.vote). GNU GPL v3. No new runtime dependencies.

## Run

Uses the repository's installed shared Vite/TypeScript/Three.js toolchain. On a fresh checkout run root `npm run setup`, which links Cassette automatically.

```sh
npm run dev --prefix projects/cassette # http://127.0.0.1:4188/
npm run test --prefix projects/cassette
npm run build --prefix projects/cassette
```

- Drag anywhere on the stage to rotate freely in any direction; release with a flick for a little inertia. Scroll to zoom. Arrow keys turn it; R resets. On touch, horizontal strokes rotate and vertical strokes scroll the page.
- `REW`, `PLAY` and `STOP` drive the reels. Each reel turns at the tape speed divided by its own pack radius, so the emptier reel spins faster; reaching either end of the tape auto-reverses.
- `360°` toggles the slow automatic turn with a gentle rock and float. Reduced-motion settings disable autonomous movement.
- Holographic shine, four shell tints and a 20-character label title. The label is drawn in the browser with Canvas 2D; no image assets are shipped.
- `Save a picture` renders a PNG at up to 1600 px on the long side.

Study 015 in the root gallery, deployed at `/experiments/cassette/index.html` by the root build. Inspired by [@ann_nnng](https://x.com/ann_nnng). Google Fonts DM Sans/Instrument Serif retain their OFL terms.
